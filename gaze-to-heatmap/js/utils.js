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

function easeOutExpo(x) {
  // https://graphtoy.com/?f1(x,t)=1%20-%20pow(2%20,%20-10%20*%20x)&v1=true&grid=1&coords=0.4643520777883696,0.5094777018983969,1.2183071759372475
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
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


/**
 * Reads a CSV file and returns an array of arrays.
 * @param {*} file 
 * @returns 
 */
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

/**
 * Turns a CSV into an array of objects, using the first row as headers.
 * @param {*} csvFile 
 * @returns 
 */
function csvToJSON(csvFile) {
  // Guess the new line character used in the file
  const nlc = detectNewLineCharacter(csvFile.data);

  // Split the file into rows
  const rows = csvFile.data.split(nlc);
  const headers = rows[0].split(',');

  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i].split(',');
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    data.push(obj);
  }

  return data;
}


// A function that takes a string, and turns it into a 
// filename safe string by replacing all non-alphanumeric characters
// and with underscores, removing leading and trailing spaces, and
// converting the string to lowercase.
function safeFilename(str) {
  return str.replace(/[^a-z0-9]/gi, '_').trim().toLowerCase();
}


// A function that takes a string loaded from a file
// and makes a best guess about the new line character used.
function detectNewLineCharacter(str) {
  // gpt-generated
  if (str.includes('\r\n')) {
    return '\r\n';
  } else if (str.includes('\r')) {
    return '\r';
  } else {
    return '\n';
  }
}