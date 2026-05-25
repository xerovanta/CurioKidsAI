/**
 * Utility for real-time canvas-based color detection.
 * Extracts pixels from the video frame, converts to HSV, and classifies the color.
 */

// Helper: Convert RGB values to HSV (Hue, Saturation, Value)
export function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
      default:
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360), // 0 - 360 degrees
    s: Math.round(s * 100), // 0 - 100 %
    v: Math.round(v * 100)  // 0 - 100 %
  };
}

// Predefined HSV threshold ranges for kid-friendly target colors
export const COLOR_RANGES = {
  // Exotic colors (Checked first for Expert Mode difficulty mapping)
  crimson: [
    { hMin: 336, hMax: 350, sMin: 55, vMin: 40 }
  ],
  coral: [
    { hMin: 12, hMax: 22, sMin: 50, vMin: 50 }
  ],
  lime: [
    { hMin: 70, hMax: 95, sMin: 55, vMin: 55 }
  ],
  turquoise: [
    { hMin: 165, hMax: 190, sMin: 45, vMin: 45 }
  ],
  fuchsia: [
    { hMin: 295, hMax: 325, sMin: 50, vMin: 50 }
  ],
  lavender: [
    { hMin: 250, hMax: 285, sMin: 15, vMin: 50 }
  ],
  // Standard colors (Checked second)
  red: [
    { hMin: 0, hMax: 11, sMin: 40, vMin: 35 },
    { hMin: 345, hMax: 360, sMin: 40, vMin: 35 }
  ],
  orange: [
    { hMin: 13, hMax: 35, sMin: 45, vMin: 40 }
  ],
  yellow: [
    { hMin: 36, hMax: 65, sMin: 35, vMin: 45 }
  ],
  green: [
    { hMin: 66, hMax: 164, sMin: 30, vMin: 30 }
  ],
  blue: [
    { hMin: 191, hMax: 249, sMin: 35, vMin: 30 }
  ],
  purple: [
    { hMin: 286, hMax: 335, sMin: 30, vMin: 30 }
  ]
};

/**
 * Classify a color from a given HSV value
 * @returns {string|null} The matching color key or null if neutral (black/white/gray)
 */
export function classifyHsv(h, s, v) {
  // Filter out neutrals first
  if (v < 18) return 'black';
  if (s < 15 && v > 75) return 'white';
  if (s < 15) return 'gray';

  for (const [colorName, ranges] of Object.entries(COLOR_RANGES)) {
    for (const range of ranges) {
      const matchHue = range.hMin <= range.hMax
        ? (h >= range.hMin && h <= range.hMax)
        : (h >= range.hMin || h <= range.hMax); // wrapping ranges like red
        
      if (matchHue && s >= range.sMin && v >= range.vMin) {
        return colorName;
      }
    }
  }

  return null;
}

/**
 * Capture frame from video stream, crop to bounding box, sample central pixels, and return the color
 * @param {HTMLVideoElement} video 
 * @param {object} bbox - Bounding box { x, y, width, height }
 * @returns {object} { colorName, rgb: {r, g, b}, hsv: {h, s, v} }
 */
export function detectColorInRegion(video, bbox = null) {
  if (!video || video.readyState < 2) return null;

  // Use a temporary offscreen canvas for sampling
  const canvas = document.createElement('canvas');
  canvas.width = 100;
  canvas.height = 100;
  const ctx = canvas.getContext('2d');

  let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;

  // If a bounding box is supplied from object detection, focus on it
  if (bbox) {
    sx = Math.max(0, bbox.x);
    sy = Math.max(0, bbox.y);
    sw = Math.min(video.videoWidth - sx, bbox.width);
    sh = Math.min(video.videoHeight - sy, bbox.height);
  } else {
    // Default to the middle 30% of the camera feed
    sw = video.videoWidth * 0.3;
    sh = video.videoHeight * 0.3;
    sx = (video.videoWidth - sw) / 2;
    sy = (video.videoHeight - sh) / 2;
  }

  // Check bounds safety
  if (sw <= 0 || sh <= 0) return null;

  // Draw the sampled area onto our small offscreen canvas
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, 100, 100);

  // Sample pixel data from the central 40x40 region of our cropped canvas
  const imgData = ctx.getImageData(30, 30, 40, 40);
  const pixels = imgData.data;

  let rSum = 0, gSum = 0, bSum = 0, count = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    rSum += pixels[i];
    gSum += pixels[i+1];
    bSum += pixels[i+2];
    count++;
  }

  if (count === 0) return null;

  const r = Math.round(rSum / count);
  const g = Math.round(gSum / count);
  const b = Math.round(bSum / count);

  const hsv = rgbToHsv(r, g, b);
  const colorName = classifyHsv(hsv.h, hsv.s, hsv.v);

  return {
    colorName,
    rgb: { r, g, b },
    hsv,
    bbox: { x: sx, y: sy, width: sw, height: sh }
  };
}
