// Global parameters
const IMG_WIDTH = 1600;
const IMG_HEIGHT = 1200;
const GAZE_X_COLNAME = "gaze x [px]";
const GAZE_Y_COLNAME = "gaze y [px]";
const GAZE_FIXATION_COLNAME = "fixation id";
const GAZE_TIMESTAMP_COLNAME = "timestamp [ns]";
const GAZE_INCLUDE_FIXATION_ONLY = false;
const GAZE_INCLUDE_ALL_FILES = true;
const GAZE_RADIUS = 30; // in pixels
const GAZE_HUE_RANGE = [240, -50]; // in degrees
const GAZE_HUE_ALPHA_RANGE = [0,  70]; // in [0, 100] range 

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
let worker_gaze2field, worker_field2bw, worker_field2hue;

// The collection of generated maps.
const maps = {};
const mapNames = [
  "Gaze Heatmap: B&W",
  "Gaze Heatmap: Hue"
];
let currentMapId = 1;
let topText = "";
let bottomText = `Drag and drop a background image and/or a valid gaze CSV file on this canvas.`;

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
}

function draw() {
  background(COLOR_BG);

  // Render bg
  if (bgImg && showBGImg) {
    image(bgImg, 0.5 * width, 0.5 * height, width, height);
  }

  // Render current map
  let img = maps[mapNames[currentMapId]];
  if (img) {
    // console.log("rendering " + img + " map");
    image(img, 0.5 * width, 0.5 * height, width, height);
    bottomText = `Displaying '${mapNames[currentMapId]}'`;
  }

  // Render UI stuff
  textSize(TEXT_SIZE_S);
  text(topText, width / 2, TEXT_SIZE_S);

  textSize(TEXT_SIZE_L);
  text(bottomText, width / 2, height - TEXT_SIZE_L);
}


function gotFile(file) {

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
  worker_gaze2field.postMessage({
    type: 'computeGazeMap',
    gazeSets: csvFiles.map(f => f.gazeData),
    IMG_WIDTH,
    IMG_HEIGHT,
    GAZE_INCLUDE_FIXATION_ONLY,
    GAZE_INCLUDE_ALL_FILES,
    GAZE_RADIUS,
    // scope: this  // cannot pass methods to worker! 
    // foo: function() { return 'bar';}   // same!
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
}

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

      case 'fieldImg':
        const img = imgFromPixels(event.data.pixels);
        maps[mapName] = img;
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
    // Save the gaze maps as images
    case 's':
    case 'S':
      // save(gazeImgBW, 'gaze_map_bw.png');
      // save(gazeImgHue, 'gaze_map_hue.png');
      mapNames.forEach(name => {
        const img = maps[name];
        if (img) {
          save(img, `${safeFilename(csvFile.name)}_${safeFilename(name)}.png`);
        }
      });
      return;
      
    // Toggle background image
    case 'b':
    case 'B':
      showBGImg = !showBGImg;
      return;

    }
    
  // Switch between gaze maps with arrow keys
  switch(keyCode) {
    case LEFT_ARROW:
      currentMapId = (currentMapId - 1 + mapNames.length) % mapNames.length;
      return;
    case RIGHT_ARROW:
      currentMapId = (currentMapId + 1) % mapNames.length;
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

