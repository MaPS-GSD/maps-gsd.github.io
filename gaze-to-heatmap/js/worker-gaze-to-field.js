// I guess no URLs for importScripts? 
// importScripts('https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.2/p5.min.js');
// importScripts('p5.min.js');  // also doesn't work, needs the `window` object!! 😭😭😭

importScripts('utils.js');


/**
 * Parses the gaze data on the CSV file and converts it to a field
 * of gaze values for each pixel in the image. 
 */
onmessage = (event) => {
  // console.log(self);
  
  console.log("Started gaze to field conversion.");
  
  const data = event.data;
  const gazeSets = event.data.gazeSets;

  if (!data.GAZE_INCLUDE_ALL_FILES) {
    gazeSets = gazeSets.slice(-1);
  }

  function pixelID(x, y) {
    return y * data.IMG_WIDTH + x;
  }
  
  const pixelCount = data.IMG_HEIGHT * data.IMG_WIDTH;

  const field = new Float32Array(pixelCount);
  // let maxVal = 0;
  // let maxLoc = [0, 0];
  let x, y, pid, d, v;
  let x0, x1, y0, y1;
  let skippedCount = 0;
  const gazeCount = gazeSets.reduce((acc, set) => acc + set.length, 0);
  let total = 0;

  for (let gid = 0; gid < gazeSets.length; gid++) {
    const gazeSet = gazeSets[gid];
    for (let i = 0; i < gazeSet.length; i++) {
      const gaze = gazeSet[i];
      if (data.GAZE_INCLUDE_FIXATION_ONLY && isNaN(gaze.fixation)) {
        // console.log(`Skipping row ${i} because it's not a fixation.`);
        skippedCount++;
        continue;
      }

      x = Math.round(gaze.x);
      y = Math.round(gaze.y);
      pid = pixelID(x, y);

      // Compute the affected map area
      x0 = Math.min(Math.max(x - data.GAZE_RADIUS, 0), data.IMG_WIDTH - 1);
      x1 = Math.min(Math.max(x + data.GAZE_RADIUS, 0), data.IMG_WIDTH - 1);
      y0 = Math.min(Math.max(y - data.GAZE_RADIUS, 0), data.IMG_HEIGHT - 1);
      y1 = Math.min(Math.max(y + data.GAZE_RADIUS, 0), data.IMG_HEIGHT - 1);

      for (let j = x0; j <= x1; j++) {
        for (let k = y0; k <= y1; k++) {
          pid = pixelID(j, k);
          d = distance(x, y, j, k);
          v = 1.0 - smoothStep(0, data.GAZE_RADIUS, d);
          field[pid] += v;
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

  console.log("Finished gaze to field conversion.");

  postMessage({
    type: 'gazeField',
    field,
    size: { width: data.IMG_WIDTH, height: data.IMG_HEIGHT },
  });
}