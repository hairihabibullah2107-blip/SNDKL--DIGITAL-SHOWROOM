/**
 * Automatic client-side Canvas Background Remover (Canva-style).
 * 1. Samples outer border pixels robustly to identify dominant backdrop color.
 * 2. Performs edge-connected BFS flood fill with Euclidean RGB tolerance + smooth alpha feathering.
 * 3. Cleans enclosed interior background holes (e.g. inside letters O/A/R) matching the outer background.
 * 4. Applies subtle edge color de-fringing so artwork blends cleanly on dark & colored shirts.
 */

export interface RemoveBgOptions {
  tolerance?: number; // 15 to 90, default 40
  feather?: number; // edge smoothing range, default 16
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

export async function removeImageBackground(
  dataUrl: string,
  options: RemoveBgOptions = {}
): Promise<string> {
  const tolerance = options.tolerance ?? 40;
  const feather = options.feather ?? 16;

  const img = await loadImage(dataUrl);
  const maxDim = 960;
  let width = img.naturalWidth || img.width || 400;
  let height = img.naturalHeight || img.height || 400;

  if (width > maxDim || height > maxDim) {
    const ratio = Math.min(maxDim / width, maxDim / height);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return dataUrl;

  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // If already transparent PNG/SVG on corners, keep transparency intact
  const corners = [
    0,
    (width - 1) * 4,
    (height - 1) * width * 4,
    ((height - 1) * width + (width - 1)) * 4,
  ];
  const transparentCorners = corners.filter((idx) => data[idx + 3] < 20).length;
  if (transparentCorners >= 3) {
    return dataUrl;
  }

  // Sample border pixels using bucketed median/dominant color estimation
  const borderSamples: Array<[number, number, number]> = [];
  const stepX = Math.max(1, Math.floor(width / 32));
  const stepY = Math.max(1, Math.floor(height / 32));

  for (let x = 0; x < width; x += stepX) {
    const t = x * 4;
    const b = ((height - 1) * width + x) * 4;
    borderSamples.push([data[t], data[t + 1], data[t + 2]]);
    borderSamples.push([data[b], data[b + 1], data[b + 2]]);
  }
  for (let y = 0; y < height; y += stepY) {
    const l = y * width * 4;
    const r = (y * width + (width - 1)) * 4;
    borderSamples.push([data[l], data[l + 1], data[l + 2]]);
    borderSamples.push([data[r], data[r + 1], data[r + 2]]);
  }

  const rs = borderSamples.map((s) => s[0]).sort((a, b) => a - b);
  const gs = borderSamples.map((s) => s[1]).sort((a, b) => a - b);
  const bs = borderSamples.map((s) => s[2]).sort((a, b) => a - b);
  const mid = Math.floor(borderSamples.length / 2);
  const bgR = rs[mid] ?? 255;
  const bgG = gs[mid] ?? 255;
  const bgB = bs[mid] ?? 255;

  const totalPixels = width * height;
  const visited = new Uint8Array(totalPixels);
  const removedMask = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let head = 0;
  let tail = 0;

  const colorDist = (pixelIdx: number) => {
    const i = pixelIdx * 4;
    const dr = data[i] - bgR;
    const dg = data[i + 1] - bgG;
    const db = data[i + 2] - bgB;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  const hardCutoff = tolerance;
  const softCutoff = tolerance + feather;

  const tryPush = (px: number) => {
    if (px < 0 || px >= totalPixels || visited[px]) return;
    const dist = colorDist(px);
    if (dist <= softCutoff) {
      visited[px] = 1;
      queue[tail++] = px;
    }
  };

  for (let x = 0; x < width; x++) {
    tryPush(x);
    tryPush((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    tryPush(y * width);
    tryPush(y * width + (width - 1));
  }

  while (head < tail) {
    const curr = queue[head++];
    const dist = colorDist(curr);
    const i = curr * 4;

    if (dist <= hardCutoff) {
      data[i + 3] = 0;
      removedMask[curr] = 1;
    } else {
      const alphaRatio = (dist - hardCutoff) / Math.max(1, feather);
      data[i + 3] = Math.min(data[i + 3], Math.round(alphaRatio * 255));
    }

    if (dist <= hardCutoff + feather * 0.65) {
      const cx = curr % width;
      const cy = (curr - cx) / width;
      if (cx > 0) tryPush(curr - 1);
      if (cx < width - 1) tryPush(curr + 1);
      if (cy > 0) tryPush(curr - width);
      if (cy < height - 1) tryPush(curr + width);
    }
  }

  // Pass 2: Canva-style interior background hole cleanup (letters like O, A, R, loops)
  const holeCutoff = Math.max(12, tolerance * 0.72);
  for (let px = 0; px < totalPixels; px++) {
    if (visited[px]) continue;
    const i = px * 4;
    if (data[i + 3] === 0) continue;
    const dist = colorDist(px);
    if (dist <= holeCutoff) {
      data[i + 3] = 0;
      removedMask[px] = 1;
    } else if (dist <= holeCutoff + feather * 0.6) {
      const alphaRatio = (dist - holeCutoff) / Math.max(1, feather * 0.6);
      data[i + 3] = Math.min(data[i + 3], Math.round(alphaRatio * 255));
    }
  }

  // Pass 3: Subtle edge halo decontamination on semi-transparent fringe pixels
  for (let px = 0; px < totalPixels; px++) {
    const i = px * 4;
    const a = data[i + 3];
    if (a > 0 && a < 210) {
      const alphaNorm = a / 255;
      data[i] = Math.max(0, Math.min(255, Math.round((data[i] - bgR * (1 - alphaNorm)) / Math.max(0.25, alphaNorm))));
      data[i + 1] = Math.max(
        0,
        Math.min(255, Math.round((data[i + 1] - bgG * (1 - alphaNorm)) / Math.max(0.25, alphaNorm)))
      );
      data[i + 2] = Math.max(
        0,
        Math.min(255, Math.round((data[i + 2] - bgB * (1 - alphaNorm)) / Math.max(0.25, alphaNorm)))
      );
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}
