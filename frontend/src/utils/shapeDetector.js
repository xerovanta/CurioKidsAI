/**
 * Custom Canvas-based computer vision utility for Shape Detection in pure JS.
 * Detects Circle, Triangle, and Square/Rectangle from a video frame.
 */

// Helper: Grayscale pixel values
function grayscale(pixels, width, height) {
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    // Standard luminance weights
    gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return gray;
}

// 2. Preprocessing: Gaussian Blur (3x3 low-pass smoothing filter) to remove paper noise
function gaussianBlur(gray, width, height) {
  const blurred = new Uint8ClampedArray(width * height);
  const kernel = [
    [1, 2, 1],
    [2, 4, 2],
    [1, 2, 1]
  ];
  const weight = 16;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let cy = -1; cy <= 1; cy++) {
        for (let cx = -1; cx <= 1; cx++) {
          sum += gray[(y + cy) * width + (x + cx)] * kernel[cy + 1][cx + 1];
        }
      }
      blurred[y * width + x] = Math.round(sum / weight);
    }
  }

  // Copy borders
  for (let x = 0; x < width; x++) {
    blurred[x] = gray[x];
    blurred[(height - 1) * width + x] = gray[(height - 1) * width + x];
  }
  for (let y = 0; y < height; y++) {
    blurred[y * width] = gray[y * width];
    blurred[y * width + (width - 1)] = gray[y * width + (width - 1)];
  }

  return blurred;
}

// Complete Canny Edge Detection: Sobel Gradients -> Non-Maximum Suppression -> Hysteresis Thresholding
function cannyEdgeDetection(gray, width, height, sensitivity = 80) {
  // sensitivity ranges from 30 (highly sensitive) to 140 (less sensitive)
  const highThreshold = sensitivity;
  const lowThreshold = sensitivity * 0.4;

  const dx = new Int16Array(width * height);
  const dy = new Int16Array(width * height);
  const mag = new Float32Array(width * height);
  const nms = new Uint8ClampedArray(width * height);
  const edges = new Uint8ClampedArray(width * height);

  // 1. Compute Sobel gradients
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      // Sobel kernel X
      const gx = 
        -1 * gray[(y - 1) * width + (x - 1)] + 1 * gray[(y - 1) * width + (x + 1)] +
        -2 * gray[y * width + (x - 1)]       + 2 * gray[y * width + (x + 1)] +
        -1 * gray[(y + 1) * width + (x - 1)] + 1 * gray[(y + 1) * width + (x + 1)];

      // Sobel kernel Y
      const gy = 
        -1 * gray[(y - 1) * width + (x - 1)] - 2 * gray[(y - 1) * width + x] - 1 * gray[(y - 1) * width + (x + 1)] +
         1 * gray[(y + 1) * width + (x - 1)] + 2 * gray[(y + 1) * width + x] + 1 * gray[(y + 1) * width + (x + 1)];

      dx[idx] = gx;
      dy[idx] = gy;
      mag[idx] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  // 2. Non-Maximum Suppression (NMS)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const m = mag[idx];
      if (m < lowThreshold) {
        nms[idx] = 0;
        continue;
      }

      const gx = dx[idx];
      const gy = dy[idx];

      const absGx = Math.abs(gx);
      const absGy = Math.abs(gy);

      let isLocalMax = true;

      if (absGx > absGy * 2.414) {
        // Horizontal direction
        if (m < mag[idx - 1] || m < mag[idx + 1]) isLocalMax = false;
      } else if (absGy > absGx * 2.414) {
        // Vertical direction
        if (m < mag[idx - width] || m < mag[idx + width]) isLocalMax = false;
      } else {
        // Diagonals
        const sign = (gx * gy) > 0 ? 1 : -1;
        if (sign > 0) {
          // 45 degrees diagonal
          if (m < mag[idx - width - 1] || m < mag[idx + width + 1]) isLocalMax = false;
        } else {
          // 135 degrees diagonal
          if (m < mag[idx - width + 1] || m < mag[idx + width - 1]) isLocalMax = false;
        }
      }

      if (isLocalMax) {
        nms[idx] = m >= highThreshold ? 2 : 1; // 2 = strong edge, 1 = weak edge
      } else {
        nms[idx] = 0;
      }
    }
  }

  // 3. Hysteresis Edge Tracking (BFS to trace weak edges connected to strong ones)
  const queue = [];
  const visited = new Uint8ClampedArray(width * height);

  // Seed with strong edges
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (nms[idx] === 2) {
        queue.push(idx);
        visited[idx] = 1;
        edges[idx] = 255;
      }
    }
  }

  const dirs = [
    -width - 1, -width, -width + 1,
    -1,                 1,
     width - 1,  width,  width + 1
  ];

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    for (let d = 0; d < 8; d++) {
      const neighbor = curr + dirs[d];
      if (neighbor >= 0 && neighbor < width * height) {
        if (visited[neighbor] === 0 && nms[neighbor] === 1) {
          visited[neighbor] = 1;
          edges[neighbor] = 255;
          queue.push(neighbor);
        }
      }
    }
  }

  return edges;
}

/**
 * Traces all contours from a binary edge map
 * Returns array of arrays of {x, y} coordinate points
 */
function findAllContours(edges, width, height) {
  const contours = [];
  const visited = new Uint8ClampedArray(width * height);

  const dirs = [
    [0, 1], [1, 1], [1, 0], [1, -1],
    [0, -1], [-1, -1], [-1, 0], [-1, 1]
  ];

  // Restrict slightly to avoid scanning absolute camera edges
  const minY = Math.round(height * 0.05);
  const maxY = Math.round(height * 0.95);
  const minX = Math.round(width * 0.05);
  const maxX = Math.round(width * 0.95);

  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const idx = y * width + x;
      if (edges[idx] === 255 && visited[idx] === 0) {
        const contour = [];
        let cx = x;
        let cy = y;
        let dirIndex = 0;
        let steps = 0;

        // Trace up to 800 steps to allow for larger detailed shapes
        while (steps < 800) {
          contour.push({ x: cx, y: cy });
          visited[cy * width + cx] = 1;

          let foundNext = false;
          for (let i = 0; i < 8; i++) {
            const checkDir = (dirIndex + i) % 8;
            const nx = cx + dirs[checkDir][0];
            const ny = cy + dirs[checkDir][1];

            if (nx >= minX && nx < maxX && ny >= minY && ny < maxY) {
              const nidx = ny * width + nx;
              if (edges[nidx] === 255 && visited[nidx] === 0) {
                cx = nx;
                cy = ny;
                dirIndex = (checkDir + 5) % 8; // Bias search direction to follow line
                foundNext = true;
                break;
              }
            }
          }

          if (!foundNext) break;
          steps++;
        }

        // Only keep contours with enough points to be a genuine shape
        if (contour.length >= 25) {
          contours.push(contour);
        }
      }
    }
  }

  return contours;
}

/**
 * Simplifies a path of points using Douglas-Peucker corner approximation
 */
function simplifyContour(points, epsilon) {
  if (!points || points.length < 3) return points || [];

  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    if (!points[i] || !points[0] || !points[end]) continue;
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > maxDist) {
      index = i;
      maxDist = d;
    }
  }

  if (maxDist > epsilon) {
    const results1 = simplifyContour(points.slice(0, index + 1), epsilon);
    const results2 = simplifyContour(points.slice(index), epsilon);
    const safeResults1 = Array.isArray(results1) ? results1 : [];
    const safeResults2 = Array.isArray(results2) ? results2 : [];
    return safeResults1.slice(0, Math.max(0, safeResults1.length - 1)).concat(safeResults2);
  } else {
    if (!points[0] || !points[end]) return [];
    return [points[0], points[end]];
  }
}

function perpendicularDistance(p, lineStart, lineEnd) {
  if (!p || !lineStart || !lineEnd || p.x === undefined || lineStart.x === undefined || lineEnd.x === undefined) {
    return 0;
  }
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  if (dx === 0 && dy === 0) {
    return Math.sqrt(Math.pow(p.x - lineStart.x, 2) + Math.pow(p.y - lineStart.y, 2));
  }

  const t = ((p.x - lineStart.x) * dx + (p.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  const clampedT = Math.max(0, Math.min(1, t));
  const projX = lineStart.x + clampedT * dx;
  const projY = lineStart.y + clampedT * dy;

  return Math.sqrt(Math.pow(p.x - projX, 2) + Math.pow(p.y - projY, 2));
}

/**
 * Main analyzer function: Samples canvas frame, processes edges, approximates corners, and returns shape classification
 */
export function detectShape(video, bbox = null, sensitivity = 80) {
  if (!video || video.readyState < 2) return null;

  const canvas = document.createElement('canvas');
  const width = 120;
  const height = 120;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;

  // Use a central targeting box for scanning the shape
  if (bbox) {
    sx = Math.max(0, bbox.x);
    sy = Math.max(0, bbox.y);
    sw = Math.min(video.videoWidth - sx, bbox.width);
    sh = Math.min(video.videoHeight - sy, bbox.height);
  } else {
    // Aligns perfectly to a perfect square in the absolute center
    const minDim = Math.min(video.videoWidth, video.videoHeight);
    const targetSize = Math.round(minDim * 0.42);
    sw = targetSize;
    sh = targetSize;
    sx = Math.round((video.videoWidth - sw) / 2);
    sy = Math.round((video.videoHeight - sh) / 2);
  }

  if (sw <= 0 || sh <= 0) return null;

  // Draw region to processing canvas
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  const gray = grayscale(imgData.data, width, height);
  
  // Apply Gaussian blur to smooth out noise
  const smoothed = gaussianBlur(gray, width, height);
  
  // Advanced Canny Edge Detection with thin single-pixel tracking
  const edges = cannyEdgeDetection(smoothed, width, height, sensitivity);

  // Scan entire image for all substantial contours
  const contours = findAllContours(edges, width, height);
  if (!contours || contours.length === 0) {
    return { shapeName: 'scanning', confidence: 0, pointsCount: 0 };
  }

  // Choose the longest contour (this represents the primary drawn shape/toy)
  let longestContour = contours[0];
  for (let i = 1; i < contours.length; i++) {
    if (contours[i].length > longestContour.length) {
      longestContour = contours[i];
    }
  }

  const contourPoints = longestContour;

  // Simplify contour using epsilon threshold to count corners (lenient value 6.5)
  const simplified = simplifyContour(contourPoints, 6.5);
  if (!simplified || simplified.length < 2) {
    return { shapeName: 'scanning', confidence: 0, pointsCount: contourPoints.length };
  }
  const cornersCount = simplified.length - 1;

  // Calculate circularity index to find smooth circles
  const perimeter = contourPoints.length;
  let area = 0;
  for (let i = 0; i < simplified.length - 1; i++) {
    const pt1 = simplified[i];
    const pt2 = simplified[i+1];
    if (pt1 && pt2 && pt1.x !== undefined && pt2.x !== undefined) {
      area += (pt1.x * pt2.y) - (pt2.x * pt1.y);
    }
  }
  area = Math.abs(area) / 2;

  const circularity = perimeter === 0 ? 0 : (4 * Math.PI * area) / (perimeter * perimeter);

  let shapeName = 'scanning';
  let confidence = 0;

  // Lenient Heuristics for Children Drawings & Real-world Toys
  if (circularity >= 0.42) {
    if (cornersCount === 3 && circularity < 0.58) {
      shapeName = 'triangle';
      confidence = Math.round(70 + (0.58 - circularity) * 100);
    } else {
      shapeName = 'circle';
      // Scale circularity between 0.42 and 0.85 to confidence between 60 and 98
      const rawConf = 60 + ((circularity - 0.42) / 0.43) * 38;
      confidence = Math.min(98, Math.max(60, Math.round(rawConf)));
    }
  } else {
    // Polygon (Triangle or Square)
    if (cornersCount === 3) {
      shapeName = 'triangle';
      confidence = 95;
    } else if (cornersCount === 4) {
      // messier hand-drawings check
      if (circularity < 0.45) {
        shapeName = 'triangle';
        confidence = 75;
      } else {
        shapeName = 'square';
        confidence = 95;
      }
    } else if (cornersCount === 5) {
      if (circularity < 0.40) {
        shapeName = 'triangle';
        confidence = 70;
      } else {
        shapeName = 'square';
        confidence = 82;
      }
    } else if (cornersCount === 6) {
      if (circularity < 0.38) {
        shapeName = 'triangle';
        confidence = 60;
      } else {
        shapeName = 'square';
        confidence = 72;
      }
    } else {
      // Highly wiggly/rough drawing
      if (circularity >= 0.38) {
        shapeName = 'circle';
        confidence = 60;
      } else {
        shapeName = 'square';
        confidence = 55;
      }
    }
  }

  // Calculate actual bounding box of the traced contour inside the 120x120 space
  let minX = 120, maxX = 0, minY = 120, maxY = 0;
  contourPoints.forEach(pt => {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  });

  // Scale the bounding box of the shape back to the main video space
  const shapeBbox = {
    x: sx + (minX / 120) * sw,
    y: sy + (minY / 120) * sh,
    width: ((maxX - minX) / 120) * sw,
    height: ((maxY - minY) / 120) * sh
  };

  return {
    shapeName,
    confidence,
    cornersCount,
    circularity: Math.round(circularity * 100) / 100,
    pointsCount: contourPoints.length,
    contourPoints,        // raw points relative to scanned region (drawn scaled)
    simplifiedPoints: simplified, // simplified corners relative to scanned region
    bbox: { x: sx, y: sy, width: sw, height: sh }, // scanned region bbox in video space
    shapeBbox             // actual shape bounding box in video space
  };
}
