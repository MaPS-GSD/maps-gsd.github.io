// Global parameters
const IMG_WIDTH = 1600;
const IMG_HEIGHT = 1200;
const GAZE_X_COLNAME = "gaze x [px]";
const GAZE_Y_COLNAME = "gaze y [px]";
const GAZE_FIXATION_COLNAME = "fixation id";
const GAZE_TIMESTAMP_COLNAME = "timestamp [ns]";
const GAZE_INCLUDE_FIXATION_ONLY = false;
// const GAZE_INCLUDE_ALL_FILES = true;  // not used anymore
const GAZE_RADIUS = 30; // in pixels
const GAZE_HUE_RANGE = [240, -50]; // in degrees
const GAZE_HUE_ALPHA_RANGE = [0, 70]; // in [0, 100] range 

// UI params (do not modify)
const TEXT_SIZE_L = 14;
const TEXT_SIZE_M = 12;
const TEXT_SIZE_S = 10;
const TEXT_FONT = "Consolas";
const COLOR_BG = [255, 255, 255];
const COLOR_TEXT = [127, 127, 127];

// Process variables (do not modify)
let canvas;
let canvasSize;
// let csvFile;
let csvFiles = [];
let bgImg;
let showBGImg = true;
let gazeImgBW, gazeImgHue;
let worker_gaze2field, 
    worker_field2bw, 
    worker_field2hue, 
    worker_gaze2trajectory_hue;

// The collection of generated maps.
let maps = [];
let currentMapId = 0;
let topText = "";
let bottomText = "";

function setup() {
  // Set up workers
  worker_gaze2field = new Worker('js/worker-gaze-to-field.js');
  worker_gaze2field.onmessage = function(event) {
    switch (event.data.type) {
      case 'progress':
        bottomText = `Computing gaze field: ${Math.round(100 * event.data.value)}%`;
        break;

      case 'gazeField':
        handleGazeField(event.data.field, event.data.size);
        break;
      
      case 'error':
        bottomText = `Error: ${event.data.error}`;
        break;
    }
  }
  
  worker_field2bw = new Worker('js/worker-field-to-map-bw.js');
  worker_field2bw.onmessage = loadMapWorkerCallback('Gaze Heatmap: B&W');

  worker_field2hue = new Worker('js/worker-field-to-map-hue.js');
  worker_field2hue.onmessage = loadMapWorkerCallback('Gaze Heatmap: Hue');

  worker_gaze2trajectory_hue = new Worker('js/worker-gaze-to-trajectory-map-hue.js');
  worker_gaze2trajectory_hue.onmessage = loadMapWorkerCallback('Gaze Trajectory: Hue');


  // Set canvas up
  canvasSize = fitCanvasToWindow();
  canvas = createCanvas(canvasSize.width, canvasSize.height); 
  canvas.drop(gotFile);

  // Set styles 
  imageMode(CENTER);
  fill(COLOR_TEXT);
  noStroke();
  textFont(TEXT_FONT);
  textAlign(CENTER, CENTER);

  resetApp();
}

function draw() {
  background(COLOR_BG);

  // Render bg
  if (bgImg && showBGImg) {
    image(bgImg, 0.5 * width, 0.5 * height, width, height);
  }

  // Render current map
  let imgObj = maps[currentMapId];
  if (imgObj && imgObj.image) {
    image(imgObj.image, 0.5 * width, 0.5 * height, width, height);
    bottomText = `Displaying computed map ${currentMapId + 1}/${maps.length}: '${imgObj.name}'`;
  }

  // Render UI stuff
  textSize(TEXT_SIZE_S);
  text(topText, width / 2, TEXT_SIZE_S);

  textSize(TEXT_SIZE_L);
  text(bottomText, width / 2, height - TEXT_SIZE_L);
}


function gotFile(file) {
  // New maps
  maps = [];

  if (file.type === 'image') {
    bottomText = 'Loading image...';

    bgImg = createImg(file.data, 'background image', 'anonymous', function() {
      bgImg.hide();
      bottomText = `Loaded background image with size ${bgImg.width} x ${bgImg.height}.`;
    });

    return;
  }

  const csvF = {
    file: file,
    gazeData: csvToJSON(file).map(parseGazeJSON)
  }
  csvFiles.push(csvF);

  topText = `Loaded file: '${file.name}', file type: ${file.type}, file size: ${file.size} bytes`;

  bottomText = 'Parsing file...';

  // Use workers to push all the heavy computation to a separate thread
  const gazeSets = csvFiles.map(f => f.gazeData);
  worker_gaze2field.postMessage({
    // type: 'computeGazeMap',
    gazeSets,
    IMG_WIDTH,
    IMG_HEIGHT,
    GAZE_INCLUDE_FIXATION_ONLY,
    // GAZE_INCLUDE_ALL_FILES,
    GAZE_RADIUS,
    // scope: this  // cannot pass methods to worker! 
    // foo: function() { return 'bar';}   // same!
  });

  // This one doesn't rely on gaze to field computation,
  // so can done in parallel.
  worker_gaze2trajectory_hue.postMessage({
    gazeSets,
    IMG_WIDTH,
    IMG_HEIGHT,
    GAZE_INCLUDE_FIXATION_ONLY,
    // GAZE_INCLUDE_ALL_FILES,
    GAZE_RADIUS,
    GAZE_HUE_RANGE,
    GAZE_HUE_ALPHA_RANGE
  });
}

/**
 * Takes a JSON-formatted gaze data, parses the columns into a more
 * usable format, and returns only the relevant columns.
 * @param {*} gaze 
 */
function parseGazeJSON(gaze) {
  const x = parseFloat(gaze[GAZE_X_COLNAME]);
  const y = parseFloat(gaze[GAZE_Y_COLNAME]);
  const t = parseInt(gaze[GAZE_TIMESTAMP_COLNAME]);
  const fixation = parseInt(gaze[GAZE_FIXATION_COLNAME]);

  return {
    // ...gaze,  // no need to keep original data
    x,
    y,
    t,
    fixation
  };
}


/**
 * What to do when the worker is done computing the gaze field.
 * @param {*} field 
 * @param {*} size 
 */
function handleGazeField(field, size) {
  console.log(`Received gaze field with ${field.length} elements.`);
  console.log(`Field size: ${size.width} x ${size.height}`);
  // console.log(`Bounds: minVal=${bounds.minVal}, maxVal=${bounds.maxVal}`);

  // Start the workers in parallel
  worker_field2bw.postMessage({
    // type: 'computeBWImage',
    field,
    size
  });

  worker_field2hue.postMessage({
    // type: 'computeHUEImage',
    field,
    size, 
    range: GAZE_HUE_RANGE,
    alphas: GAZE_HUE_ALPHA_RANGE
  });

  // Convert field to gaze-trajectory map
  fieldToTrajectoryMapBW();
  fieldToTrajectoryMapHUE();
}

/**
 * Clears everything and resets the app to its initial state.
 */
function resetApp() {
  maps = [];
  csvFiles = [];
  bgImg = null;
  topText = '';
  bottomText = `Drag and drop a background image and/or a valid gaze CSV file on this canvas.`;
}



// ███╗   ███╗ █████╗ ██████╗ ███████╗
// ████╗ ████║██╔══██╗██╔══██╗██╔════╝
// ██╔████╔██║███████║██████╔╝███████╗
// ██║╚██╔╝██║██╔══██║██╔═══╝ ╚════██║
// ██║ ╚═╝ ██║██║  ██║██║     ███████║
// ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝     ╚══════╝
//                                    
// Map-generation functions that cannot be wrapped in a worker
// because they are p5.js-based (and p5.js cannot be used in workers).

/**
 * Creates a simple map with a black polyline connecting all gaze points.
 */
function fieldToTrajectoryMapBW() {
  const pg = createGraphics(IMG_WIDTH, IMG_HEIGHT);

  // Draw gaze points as a polyline
  pg.stroke(0);
  pg.strokeWeight(1);
  pg.noFill();
  pg.beginShape();
  for (let i = 0; i < csvFiles.length; i++) {
    const gazeData = csvFiles[i].gazeData;
    for (let j = 0; j < gazeData.length; j++) {
      const x = gazeData[j].x;
      const y = gazeData[j].y;
      pg.vertex(x, y);
    }
  }
  pg.endShape();

  const img = pg.get();
  maps.push({
    name: 'Gaze Trajectory B&W',
    image: img,
  });
}

/**
 * Creates a simple map with a colored polyline connecting all gaze points.
 * Uses HUE global settings and range. 
 */
function fieldToTrajectoryMapHUE() {
  const vertices = [];
  for (let i = 0; i < csvFiles.length; i++) {
    const gazeData = csvFiles[i].gazeData;
    for (let j = 0; j < gazeData.length; j++) {
      vertices.push(gazeData[j].x, gazeData[j].y);
    }
  }
  const lineCount = Math.max(vertices.length / 2 - 1, 0);

  const pg = createGraphics(IMG_WIDTH, IMG_HEIGHT);
  pg.noFill();
  pg.strokeWeight(5);
  const hueLen = GAZE_HUE_RANGE[1] - GAZE_HUE_RANGE[0];
  for (let i = 0; i < lineCount; i++) {
    const x1 = vertices[i * 2];
    const y1 = vertices[i * 2 + 1];
    const x2 = vertices[i * 2 + 2];
    const y2 = vertices[i * 2 + 3];
    const n = i / lineCount;
    const hue = GAZE_HUE_RANGE[0] + hueLen * n;
    const rgba = HSBToRGB([hue, 100, 100, 100]);
    pg.stroke(rgba);
    pg.line(x1, y1, x2, y2);
  }

  const img = pg.get();
  maps.push({
    name: 'Gaze Trajectory HUE',
    image: img,
  });
}






// ██╗   ██╗████████╗██╗██╗     ███████╗
// ██║   ██║╚══██╔══╝██║██║     ██╔════╝
// ██║   ██║   ██║   ██║██║     ███████╗
// ██║   ██║   ██║   ██║██║     ╚════██║
// ╚██████╔╝   ██║   ██║███████╗███████║
//  ╚═════╝    ╚═╝   ╚═╝╚══════╝╚══════╝
//                                      

/**
 * Creates a p5.Image from a pixel array.
 * @param {*} pixels 
 * @returns 
 */
function imgFromPixels(pixels) {
  const img = createImage(IMG_WIDTH, IMG_HEIGHT);
  img.loadPixels();
  //// this doesn't work: pixels array is read-only 
  // img.pixels = pixels;  
  // but this does: https://stackoverflow.com/a/14331581/1934487
  img.pixels.set(pixels);
  img.updatePixels();
  return img;
}


/**
 * Returns the main callback function for the Map workers.
 * @param {*} mapName 
 * @returns 
 */
function loadMapWorkerCallback(mapName) {
  const cb = function(event) {
    switch (event.data.type) {
      case 'progress':
        bottomText = `Computing '${mapName}': ${Math.round(100 * event.data.value)}%`;
        break;

      case 'pixelData':
        const img = imgFromPixels(event.data.pixels);
        maps.push({
          name: mapName,
          image: img,
        });
        break;
      
      case 'error':
        bottomText = `Error: ${event.data.error}`;
        break;
    }
  } 
  return cb;
}




function keyPressed() {
  switch(key) {
    // Save currently displayed map
    case 's':
    case 'S':
      const map = maps[currentMapId];
      const csvfilename = csvFiles.length == 1 ? csvFiles[0].file.name : `multiple_csv`;
      save(map.image, `${safeFilename(csvfilename)}_${safeFilename(map.name)}.png`);
      return;
      
    // Toggle background image
    case 'b':
    case 'B':
      showBGImg = !showBGImg;
      return;

    // Clear all images
    case 'r':
    case 'R':
      resetApp();
      return;
  }

    
  // Switch between gaze maps with arrow keys
  switch(keyCode) {
    case LEFT_ARROW:
      currentMapId = (currentMapId - 1 + maps.length) % maps.length;
      return;
    case RIGHT_ARROW:
      currentMapId = (currentMapId + 1) % maps.length;
      return;
  }
}

function windowResized() {
  canvasSize = fitCanvasToWindow();
  resizeCanvas(canvasSize.width, canvasSize.height);
  // console.log(`Resized canvas to ${canvasSize.width} x ${canvasSize.height}`);
}

// A function that computes width and height of the canvas
// to fit the window, while keeping the aspect ratio of the image.
function fitCanvasToWindow() {
  const windowRatio = windowWidth / windowHeight;
  const imgRatio = IMG_WIDTH / IMG_HEIGHT;

  if (windowRatio > imgRatio) {
    return {
      width: Math.floor(imgRatio * windowHeight),
      height: Math.floor(windowHeight)
    };
  } else {
    return {
      width: Math.floor(windowWidth),
      height: Math.floor(windowWidth / imgRatio)
    };
  }
}

