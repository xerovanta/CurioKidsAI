/**
 * Pure mathematical shape matching engine for CurioKids AI AirDraw.
 * Compares a series of {x, y} drawing path points to a target shape.
 * Returns { match: boolean, confidence: number (0-100), feedback: string }
 */

// Helper: Calculate Euclidean distance
function getDistance(p1, p2) {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

// Helper: Perpendicular distance from a point to a line segment
function perpendicularDistance(p, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  if (dx === 0 && dy === 0) {
    return getDistance(p, lineStart);
  }

  const t = ((p.x - lineStart.x) * dx + (p.y - lineStart.y) * dy) / (dx * dx + dy * dy);
  const clampedT = Math.max(0, Math.min(1, t));
  const projX = lineStart.x + clampedT * dx;
  const projY = lineStart.y + clampedT * dy;

  return Math.sqrt(Math.pow(p.x - projX, 2) + Math.pow(p.y - projY, 2));
}

// Helper: Douglas-Peucker path simplification
function simplifyPath(points, epsilon) {
  if (!points || points.length < 3) return points || [];

  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > maxDist) {
      index = i;
      maxDist = d;
    }
  }

  if (maxDist > epsilon) {
    const results1 = simplifyPath(points.slice(0, index + 1), epsilon);
    const results2 = simplifyPath(points.slice(index), epsilon);
    return results1.slice(0, results1.length - 1).concat(results2);
  } else {
    return [points[0], points[end]];
  }
}

// Helper: Smooth a numeric array using moving average
function smoothArray(arr, windowSize = 5) {
  const smoothed = [];
  const half = Math.floor(windowSize / 2);
  for (let i = 0; i < arr.length; i++) {
    let sum = 0;
    let count = 0;
    for (let w = -half; w <= half; w++) {
      const idx = i + w;
      if (idx >= 0 && idx < arr.length) {
        sum += arr[idx];
        count++;
      }
    }
    smoothed.push(sum / count);
  }
  return smoothed;
}

export function matchShape(path, targetShape) {
  // Guard: Not enough points drawn
  if (!path || path.length < 15) {
    return {
      match: false,
      confidence: 10,
      feedback: "✏️ The line is too short! Try drawing a larger shape!"
    };
  }

  const target = targetShape.toLowerCase();
  
  // 1. Calculate path dimensions and center of mass
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let sumX = 0, sumY = 0;
  
  path.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    sumX += p.x;
    sumY += p.y;
  });

  const width = maxX - minX;
  const height = maxY - minY;
  const center = { x: sumX / path.length, y: sumY / path.length };
  const size = Math.max(width, height);

  if (size < 40) {
    return {
      match: false,
      confidence: 15,
      feedback: "🧐 That's a tiny drawing! Make it nice and big!"
    };
  }

  // Check closure (distance between start and end)
  const startPt = path[0];
  const endPt = path[path.length - 1];
  const closureDist = getDistance(startPt, endPt);
  const isClosed = closureDist < size * 0.28; // lenient closure threshold for kids

  // Match shape routing
  switch (target) {
    case 'circle': {
      // Calculate average distance from center (radius)
      let distSum = 0;
      path.forEach(p => {
        distSum += getDistance(p, center);
      });
      const avgRadius = distSum / path.length;

      // Compute variance in radius (how perfect is the circle)
      let sqDiffSum = 0;
      path.forEach(p => {
        const d = getDistance(p, center);
        sqDiffSum += Math.pow(d - avgRadius, 2);
      });
      const stdDev = Math.sqrt(sqDiffSum / path.length);
      const relativeDev = stdDev / avgRadius; // coefficient of variation

      let confidence = 0;
      let feedback = "";

      if (relativeDev < 0.15) {
        confidence = 95;
      } else if (relativeDev < 0.28) {
        confidence = 70 + Math.round((0.28 - relativeDev) * 150);
      } else {
        confidence = Math.max(10, Math.round(70 - (relativeDev - 0.28) * 100));
      }

      // Closure penalty
      if (!isClosed) {
        confidence -= 15;
        feedback = "🌀 Almost! Try bringing the end of your circle back to the start!";
      } else if (relativeDev >= 0.25) {
        feedback = "🥚 A bit bumpy! Try to draw a smooth, round circle!";
      } else {
        feedback = "🎉 Beautiful circle! Outstanding job!";
      }

      confidence = Math.max(0, Math.min(100, confidence));
      return {
        match: confidence >= 60,
        confidence,
        feedback
      };
    }

    case 'triangle': {
      // Triangles simplified with high epsilon (12% of shape size)
      const simplified = simplifyPath(path, size * 0.11);
      const corners = simplified.length - 1; // last point matches first point in D-P typically

      let confidence = 0;
      let feedback = "";

      if (corners === 3) {
        confidence = 92;
      } else if (corners === 4) {
        confidence = 78; // Very good, might have slightly messy start/end overlap
      } else if (corners === 2) {
        confidence = 45;
        feedback = "📐 Looks like a straight line! Try drawing three sharp corners!";
      } else {
        confidence = Math.max(15, 90 - Math.abs(corners - 3) * 20);
      }

      if (!isClosed) {
        confidence -= 12;
        if (!feedback) feedback = "📐 Try connecting the lines at the end to close your triangle!";
      }

      if (!feedback) {
        if (corners > 4) {
          feedback = "📐 That has quite a few corners! Try making just three clean corners!";
        } else {
          feedback = "🌟 Super triangle! The corners look great!";
        }
      }

      confidence = Math.max(0, Math.min(100, confidence));
      return {
        match: confidence >= 60,
        confidence,
        feedback
      };
    }

    case 'square': {
      // Squares simplified with epsilon (10% of shape size)
      const simplified = simplifyPath(path, size * 0.10);
      const corners = simplified.length - 1;

      let confidence = 0;
      let feedback = "";

      if (corners === 4) {
        confidence = 94;
      } else if (corners === 5) {
        confidence = 82; // good square with extra start/end junction point
      } else if (corners === 3) {
        confidence = 50;
        feedback = "🧱 That has 3 corners like a triangle! Try drawing four square corners!";
      } else {
        confidence = Math.max(15, 90 - Math.abs(corners - 4) * 18);
      }

      // Check aspect ratio to ensure it is squarish, not a super skinny line
      const aspectRatio = width / height;
      if (aspectRatio < 0.4 || aspectRatio > 2.5) {
        confidence -= 20;
        feedback = "🧱 Make sure your square has matching wide and tall sides!";
      }

      if (!isClosed) {
        confidence -= 10;
        if (!feedback) feedback = "🧱 Connect the last corner to the starting point to seal your square!";
      }

      if (!feedback) {
        if (corners > 5) {
          feedback = "🧱 A bit curvy! Try drawing sharp, straight edges and four corners!";
        } else {
          feedback = "🎉 Excellent! A fantastic, solid square!";
        }
      }

      confidence = Math.max(0, Math.min(100, confidence));
      return {
        match: confidence >= 60,
        confidence,
        feedback
      };
    }

    case 'star': {
      // Radial peak-valley analysis
      // Calculate distance from center for each point sequentially
      const radialDistances = path.map(p => getDistance(p, center));
      
      // Smooth the signals to avoid pixel/jitter peaks
      const smoothed = smoothArray(radialDistances, 7);
      
      // Detect local extrema (peaks and valleys)
      let peaks = 0;
      let valleys = 0;
      
      for (let i = 1; i < smoothed.length - 1; i++) {
        const prev = smoothed[i - 1];
        const curr = smoothed[i];
        const next = smoothed[i + 1];
        
        if (curr > prev && curr > next) {
          // Verify it's a prominent peak (e.g., at least 15% outer size from center)
          if (curr > size * 0.18) {
            peaks++;
            i += 5; // skip neighborhood to avoid double-counting
          }
        } else if (curr < prev && curr < next) {
          if (curr < size * 0.45) {
            valleys++;
            i += 5;
          }
        }
      }

      let confidence = 0;
      let feedback = "";

      // A perfect star has 5 outer peaks
      if (peaks === 5) {
        confidence = 95;
      } else if (peaks === 4 || peaks === 6) {
        confidence = 75;
      } else {
        confidence = Math.max(20, 90 - Math.abs(peaks - 5) * 18);
      }

      if (peaks < 4) {
        feedback = "⭐️ Draw five pointy tips popping out from the center!";
      } else if (peaks > 6) {
        feedback = "⭐️ Very spiky! Try drawing exactly five star tips!";
      } else {
        feedback = "✨ Sparkly! That is a stellar star!";
      }

      confidence = Math.max(0, Math.min(100, confidence));
      return {
        match: confidence >= 60,
        confidence,
        feedback
      };
    }

    case 'heart': {
      // Heart check logic:
      // 1. Should have bilateral symmetry: left half mirrors right half
      // 2. Cusp/dip at top-center: near center.x, y has a local minimum/maximum indent
      // 3. Sharp point at bottom-center: near center.x, y is at absolute maximum (lowest on screen)
      
      // Left vs Right symmetry test
      let leftPoints = 0;
      let rightPoints = 0;
      path.forEach(p => {
        if (p.x < center.x) leftPoints++;
        else rightPoints++;
      });
      
      const balance = Math.min(leftPoints, rightPoints) / Math.max(leftPoints, rightPoints);

      // Top cusp vs bottom point check
      // Canvas coordinates: Top is y=0, bottom is y=480
      let topY = Infinity;
      let bottomY = -Infinity;
      let bottomPt = null;

      path.forEach(p => {
        if (p.y < topY) topY = p.y;
        if (p.y > bottomY) {
          bottomY = p.y;
          bottomPt = p;
        }
      });

      // Bottom point should be close to center.x
      const bottomCenterness = Math.abs(bottomPt.x - center.x) / width;

      // Find top center area points (middle 30% of X width)
      const topCenterPoints = path.filter(p => Math.abs(p.x - center.x) < width * 0.15);
      
      // There should be a cleft: meaning the y value in the middle is larger (further down)
      // than the peaks on the upper left and upper right.
      let cleftDetected = false;
      if (topCenterPoints.length > 0) {
        const topCenterY = Math.min(...topCenterPoints.map(p => p.y));
        // Check if there are points on the left/right of center that go higher up (lower Y)
        const leftPeaks = path.filter(p => p.x < center.x - width * 0.15 && p.y < topCenterY);
        const rightPeaks = path.filter(p => p.x > center.x + width * 0.15 && p.y < topCenterY);
        if (leftPeaks.length > 0 && rightPeaks.length > 0) {
          cleftDetected = true;
        }
      }

      let confidence = 40; // baseline for drawing
      let feedback = "";

      if (balance > 0.6) confidence += 20; // good balance
      if (bottomCenterness < 0.22) confidence += 20; // pointed at bottom center
      if (cleftDetected) confidence += 20; // cleft at top center

      if (confidence < 60) {
        if (!cleftDetected) {
          feedback = "💖 Try adding a little dip at the top middle of your heart!";
        } else if (bottomCenterness >= 0.22) {
          feedback = "💖 Make sure the bottom of your heart points right down the middle!";
        } else {
          feedback = "💖 Try making both left and right sides match!";
        }
      } else {
        feedback = "🎉 Splendid! That's a beautiful heart full of love!";
      }

      confidence = Math.max(0, Math.min(100, confidence));
      return {
        match: confidence >= 60,
        confidence,
        feedback
      };
    }

    default:
      return {
        match: true,
        confidence: 80,
        feedback: "🎨 Awesome drawing! Let's submit it!"
      };
  }
}
