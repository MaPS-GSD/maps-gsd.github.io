importScripts('utils.js');
importScripts('color-functions.js');


/**
 * Computes a heatmap of gaze based on temporal movement across frames. 
 * Uses a hue-based field to represent time, and an alpha field to represent intensity.
 * The result is a little meh, there is a v2 version that uses a direct color+alpha blend
 * approach.
 */
onmessage = (event) => {
  console.log(`Started map computation: "${event.data.name}"`);

  function pixelID(x, y) {
    if (x < 0 || x >= data.IMG_WIDTH || y < 0 || y >= data.IMG_HEIGHT) return -1;
    return y * data.IMG_WIDTH + x;
  }

  const data = event.data;
  let gazeSets = data.gazeSets;

  // Create a field of hue values per pixel,
  // and init to base hue
  const pixelCount = data.IMG_HEIGHT * data.IMG_WIDTH;
  const hues = new Float32Array(pixelCount).fill(data.GAZE_HUE_RANGE[0]);
  const alphas = new Float32Array(pixelCount).fill(0.0);
  
  // Iterate over each gaze, and 'tint' the hue field with a corresponding time-based hue.
  const gazeCount = gazeSets.reduce((acc, set) => acc + set.length, 0);
  let total = 0;
  let skippedCount = 0;
  let x, y, pid, d, v, n, h, i4, a;
  let x0, x1, y0, y1;
  let rgba;
  const huelen = data.GAZE_HUE_RANGE[1] - data.GAZE_HUE_RANGE[0];
  const alphalen = data.GAZE_ALPHA_RANGE[1] - data.GAZE_ALPHA_RANGE[0];
  
  for (let i = 0; i < gazeSets.length; i++) {
    const gazeSet = gazeSets[i];
    for (let j = 0; j < gazeSet.length; j++) {
      const gaze = gazeSet[j];

      if (data.GAZE_INCLUDE_FIXATION_ONLY && isNaN(gaze.fixation)) {
        skippedCount++;
        total++;
        continue;
      }

      n = total / gazeCount;
      h = data.GAZE_HUE_RANGE[0] + n * huelen;

      x = Math.round(gaze.x);
      y = Math.round(gaze.y);

      // Compute the affected map area
      x0 = Math.min(Math.max(x - data.GAZE_RADIUS, 0), data.IMG_WIDTH - 1);
      x1 = Math.min(Math.max(x + data.GAZE_RADIUS, 0), data.IMG_WIDTH - 1);
      y0 = Math.min(Math.max(y - data.GAZE_RADIUS, 0), data.IMG_HEIGHT - 1);
      y1 = Math.min(Math.max(y + data.GAZE_RADIUS, 0), data.IMG_HEIGHT - 1);

      for (let j = x0; j <= x1; j++) {
        for (let k = y0; k <= y1; k++) {
          pid = pixelID(j, k);
          if (pid < 0) continue;
          d = distance(x, y, j, k);
          v = 1.0 - smoothStep(0, data.GAZE_RADIUS, d);
          alphas[pid] = Math.max(alphas[pid], v);  // keep whichever alpha has been historically higher
          hues[pid] = hues[pid] * (1 - v) + h * v;  // blend the hues based on strength
        }
      }

      total++;

      postMessage({
        type: 'progress',
        value: total / gazeCount
      });
    }
  }

  if (data.GAZE_INCLUDE_FIXATION_ONLY && skippedCount > 0) { 
    console.log(`Skipped ${skippedCount} rows because they're not fixations.`);
  }
  
  // Now convert the hues+alpha to a field of pixel color values
  const pixels = new Uint8ClampedArray(pixelCount * 4);
  for (let i = 0; i < pixelCount; i++) {
    h = hues[i];
    a = data.GAZE_ALPHA_RANGE[0] + alphas[i] * alphalen;
    rgba = HSBToRGB([h, 100, 100, a]);
    i4 = i * 4;
    pixels[i4] = rgba[0];
    pixels[i4 + 1] = rgba[1];
    pixels[i4 + 2] = rgba[2];
    pixels[i4 + 3] = rgba[3];
  }
  console.log("Finished gaze to Trajectory Map: Hue.");

  postMessage({
    name: event.data.name,
    type: 'pixelData',
    pixels,
  });
}