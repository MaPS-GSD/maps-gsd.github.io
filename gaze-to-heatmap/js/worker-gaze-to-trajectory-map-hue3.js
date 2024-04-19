importScripts('utils.js');
importScripts('color-functions.js');


/**
 * Computes a heatmap of gaze based on temporal movement across frames. 
 * This version blends color better than v2, but has no alpha! 🤷‍♂️
 */
onmessage = (event) => {
  console.log(`Started map computation: "${event.data.name}"`);

  function pixelID(x, y) {
    if (x < 0 || x >= data.IMG_WIDTH || y < 0 || y >= data.IMG_HEIGHT) return -1;
    return y * data.IMG_WIDTH + x;
  }

  const data = event.data;
  let gazeSets = data.gazeSets;

  // For this one, we are going to work directly on the pixel data,
  // as if painting over and fine-tuning blending colors based on intensity.
  const pixelCount = data.IMG_HEIGHT * data.IMG_WIDTH;
  const pixels = new Float32Array(pixelCount * 4).fill(255);  // let's use a float array for better precision
  // // Init to a transparent white (was getting black halos)
  // for (let i = 0; i < pixelCount; i++) {
  //   pixels[i * 4 + 3] = 0;
  // }

  
  // Iterate over each gaze, and 'tint' the hue field with a corresponding time-based hue.
  const gazeCount = gazeSets.reduce((acc, set) => acc + set.length, 0);
  let total = 0;
  let skippedCount = 0;
  let x, y, pid, d, v, n, h, i4, a;
  let x0, x1, y0, y1;
  let rgb;
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

      // Compute base color for this gaze point 
      n = total / gazeCount;
      h = data.GAZE_HUE_RANGE[0] + n * huelen;
      rgb = HSBToRGB([h, 100, 100]);

      // Compute the affected pixel area of this gaze point
      x = Math.round(gaze.x);
      y = Math.round(gaze.y);
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
          i4 = pid * 4;
          // Blend colors based on intensity
          pixels[i4] = pixels[i4] * (1 - v) + rgb[0] * v;
          pixels[i4 + 1] = pixels[i4 + 1] * (1 - v) + rgb[1] * v;
          pixels[i4 + 2] = pixels[i4 + 2] * (1 - v) + rgb[2] * v;

          // Keep the strongest alpha
          a = 2.55 * (data.GAZE_ALPHA_RANGE[0] + v * alphalen);
          pixels[i4 + 3] = Math.max(pixels[i4 + 3], a);
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

  postMessage({
    name: event.data.name,
    type: 'pixelData',
    pixels,
  });
}