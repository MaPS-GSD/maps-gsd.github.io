// ██╗   ██╗████████╗██╗██╗     ███████╗
// ██║   ██║╚══██╔══╝██║██║     ██╔════╝
// ██║   ██║   ██║   ██║██║     ███████╗
// ██║   ██║   ██║   ██║██║     ╚════██║
// ╚██████╔╝   ██║   ██║███████╗███████║
//  ╚═════╝    ╚═╝   ╚═╝╚══════╝╚══════╝
//                                      
// Dependency-less utility functions for common tasks.

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

function distanceSq(x0, y0, x1, y1) {
  // calculate square distance between two points
  return (x1 - x0) ** 2 + (y1 - y0) ** 2;
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

// Function to calculate the area of a triangle given by three points
function triangleArea(x1, y1, x2, y2, x3, y3) {
  return Math.abs((x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)) / 2.0);
}

/**
 * Compute the area of a polygon 
 * @param {*} vertices A polygon in the form of an array of [x, y, x, y, ...] coordinates.
 * @returns 
 */
function polygonArea(vertices) {
  // copilot-generated
  let area = 0;
  for (let i = 0; i < vertices.length; i += 2) {
    const x0 = vertices[i];
    const y0 = vertices[i + 1];
    const x1 = vertices[(i + 2) % vertices.length];
    const y1 = vertices[(i + 3) % vertices.length];
    area += x0 * y1 - x1 * y0;
  }
  return Math.abs(area / 2);
}


function polygonCenter(vertices) {
  // copilot-generated
  let cx = 0;
  let cy = 0;
  let area = polygonArea(vertices);
  for (let i = 0; i < vertices.length; i += 2) {
    const x0 = vertices[i];
    const y0 = vertices[i + 1];
    const x1 = vertices[(i + 2) % vertices.length];
    const y1 = vertices[(i + 3) % vertices.length];
    const cross = x0 * y1 - x1 * y0;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  return [cx / (6 * area), cy / (6 * area)];
}


/**
 * Computes the center of gravity of a simple, non self-intersecting polygon.
 * @param {*} vertices 
 * @returns 
 */
function polygonCenter(vertices) {
  // Initialize sums for centroid coordinates and total area
  let centroidX = 0;
  let centroidY = 0;
  let totalArea = 0;

  const x1 = vertices[0], y1 = vertices[1]; // First vertex
  
  // Loop through the vertices of the polygon in pairs
  for (let i = 2; i < vertices.length - 2; i += 2) {
      // Get the x, y coordinates of the current and next vertex
      const x2 = vertices[i], y2 = vertices[i + 1]; // Current vertex
      const x3 = vertices[i + 2], y3 = vertices[i + 3]; // Next vertex

      // Calculate the area of the current triangle
      const area = triangleArea(x1, y1, x2, y2, x3, y3);

      // Calculate the centroid of the current triangle
      const triangleCentroidX = (x1 + x2 + x3) / 3;
      const triangleCentroidY = (y1 + y2 + y3) / 3;

      // Add the weighted centroid to the sum
      centroidX += triangleCentroidX * area;
      centroidY += triangleCentroidY * area;

      // Add the area to the total area
      totalArea += area;
  }

  // Divide the weighted sum by the total area to get the centroid coordinates
  centroidX /= totalArea;
  centroidY /= totalArea;

  // Return the centroid as an object
  return [centroidX, centroidY];
}


/**
 * Checks a point for containment within a polygon.
 * @param {*} vertices A polygon in the form of an array of [x, y, x, y, ...] coordinates.
 * @param {*} x 
 * @param {*} y 
 * @returns 
 */
function pointInPolygon(vertices, x, y) {
  // copilot-generated
  let inside = false;
  for (let i = 0, j = vertices.length - 2; i < vertices.length; j = i, i += 2) {
    if (((vertices[i + 1] > y) !== (vertices[j + 1] > y)) &&
      (x < (vertices[j] - vertices[i]) * (y - vertices[i + 1]) / (vertices[j + 1] - vertices[i + 1]) + vertices[i])) {
      inside = !inside;
    }
  }
  return inside;
}


/**
 * Computes the closest point on a polygon to a given point.
 * @param {*} vertices A polygon in the form of an array of [x, y, x, y, ...] coordinates.
 * @param {*} x 
 * @param {*} y 
 * @returns 
 */
function closestPointOnPolygon(vertices, x, y) {
  // copilot-generated
  let closestDistance = Infinity;
  let closestPoint = [0, 0];

  for (let i = 0; i < vertices.length; i += 2) {
    const x0 = vertices[i];
    const y0 = vertices[i + 1];
    const x1 = vertices[(i + 2) % vertices.length];
    const y1 = vertices[(i + 3) % vertices.length];

    // Calculate the closest point on the segment
    const closest = closestPointOnSegment(x0, y0, x1, y1, x, y);

    // Calculate the distance to the point
    const d2 = distanceSq(x, y, closest[0], closest[1]);

    // If this is the closest point so far, store it.
    if (d2 < closestDistance) {
      closestDistance = d2;
      closestPoint = closest;
    }
  }

  return closestPoint;
}


/**
 * Computes the closest point on a segment to a given point.
 * @param {*} x0 
 * @param {*} y0 
 * @param {*} x1 
 * @param {*} y1 
 * @param {*} x 
 * @param {*} y 
 * @param {*} limitToSegment
 * @returns 
 */
function closestPointOnSegment(x0, y0, x1, y1, x, y, limitToSegment = true) {
  // copilot-generated
  const dx = x1 - x0;
  const dy = y1 - y0;
  const t = ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy);
  if (limitToSegment) {
    if (t < 0) return [x0, y0];
    if (t > 1) return [x1, y1];
  }
  return [x0 + t * dx, y0 + t * dy];
}


/**
 * Computes the SDF of a point to a polygon.
 * @param {*} vertices 
 * @param {*} x 
 * @param {*} y 
 * @returns 
 */
function SDFPolygon(vertices, x, y) {
  const cp = closestPointOnPolygon(vertices, x, y);
  const d = distance(x, y, cp[0], cp[1]);
  return pointInPolygon(vertices, x, y) ? -d : d;
}



/**
 * A function that takes a color in #RRGGBB hex format and 
 * an alpha value as a  0-255 integer, and returns the #AARRGGBB hex format.
 * @param {*} hexColor 
 * @param {*} alpha 
 * @returns 
 */
function addAlpha(hexColor, alpha) {
  const hexAlpha = alpha.toString(16).padStart(2, '0');
  return `#${hexColor.slice(1)}${hexAlpha}`;
}