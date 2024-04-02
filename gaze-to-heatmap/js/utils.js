function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function smoothStep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

function distance(x0, y0, x1, y1) {
  // calculate distance between two points
  return Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
}

function remap(value, oldMin, oldMax, newMin, newMax) {
  return (value - oldMin) * (newMax - newMin) / (oldMax - oldMin) + newMin;
}


function remapFloatArray(arr, oldMin, oldMax, newMin, newMax) {
  const oldRange = oldMax - oldMin;
  const newRange = newMax - newMin;

  const remapped = new Float32Array(arr.length);

  for (let i = 0; i < arr.length; i++) {
    remapped[i] = (arr[i] - oldMin) * newRange / oldRange + newMin;
  }

  return remapped;
}



function computeBounds(arr) {
  let minPos = 0
  let minVal = arr[minPos];
  let maxPos = 0;
  let maxVal = arr[maxPos];

  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < minVal) {
      minVal = arr[i];
      minPos = i;
    }
    if (arr[i] > maxVal) {
      maxVal = arr[i];
      maxPos = i;
    }
  }

  return {
    minVal,
    minPos,
    maxVal,
    maxPos
  };
}


function parseCSV(file) {
  const csv = [];

  // Split rows by new line character
  const rows = file.data.split('\n');

  // Split each row in columns using the comma as separator.
  rows.forEach((row) => {
    csv.push(row.split(','));
  })
  // Be careful! If your data contains text wrapped in "" with commas inside,
  // the above method will split those cells!

  return csv;
}

