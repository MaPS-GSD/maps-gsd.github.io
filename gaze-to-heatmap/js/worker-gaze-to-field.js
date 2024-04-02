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

  function pixelID(x, y) {
    return y * data.IMG_WIDTH + x;
  }
  
  const pixelCount = data.IMG_HEIGHT * data.IMG_WIDTH;
  const gazeXCol = data.csv[0].indexOf(data.GAZE_X_COLNAME);
  const gazeYCol = data.csv[0].indexOf(data.GAZE_Y_COLNAME);
  
  if (gazeXCol === -1 || gazeYCol === -1) {
    return {
      type: 'error',
      msg: `❌ Columns '${data.GAZE_X_COLNAME}' and/or '${data.GAZE_Y_COLNAME}' not found in the CSV file`
    }
  }
  
  const field = new Float32Array(pixelCount);
  // let maxVal = 0;
  // let maxLoc = [0, 0];
  let x, y, pid, d, v;
  let x0, x1, y0, y1;
  for (let i = 1; i < data.csv.length; i++) {
    x = parseInt(data.csv[i][gazeXCol]);
    y = parseInt(data.csv[i][gazeYCol]);
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

    postMessage({
      type: 'progress',
      value: i / data.csv.length
    });
  }

  // const bounds = computeBounds(field);

  console.log("Finished gaze to field conversion.");

  postMessage({
    type: 'gazeField',
    field,
    size: { width: data.IMG_WIDTH, height: data.IMG_HEIGHT },
    // bounds,
  });
}


function dist(x0, y0, x1, y1) {
  // calculate distance between two points
  return Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
}
