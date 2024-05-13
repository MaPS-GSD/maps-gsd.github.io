// Global parameters (tweak to taste)
const IMG_WIDTH = 1600;
const IMG_HEIGHT = 1200;
const GAZE_X_COLNAME = "gaze x [px]";
const GAZE_Y_COLNAME = "gaze y [px]";
const GAZE_FIXATION_COLNAME = "fixation id";
const GAZE_TIMESTAMP_COLNAME = "timestamp [ns]";
let GAZE_INCLUDE_FIXATION_ONLY = false;
let GAZE_RADIUS = 30; // in pixels
let GAZE_LINE_WEIGHT = 2; // in pixels
let GAZE_HUE_RANGE = [240, -50]; // in degrees
let GAZE_ALPHA_RANGE = [0, 70]; // in [0, 100] range 

// When computing gaze locations inside object masks, 
// only consider gaze points that are within this distance 
// or grater from the boundary. 
let GAZE_LOCATION_MASK_SAFE_OFFSET = 0;


// Color scales! 🌈
// For now, we will be only using _named_ color scales from the R colorBrewer package.
// You can check their names here: 
// https://www.datanovia.com/en/blog/the-a-z-of-rcolorbrewer-palette/,
// Or check the console output in the app for a list of all names. 
// Cool ones are 'Viridis', 'Spectral', 'RdYlGn' (Red-Yellow-Green), 
// 'PuOr' (Purple-Orange), etc.
// Note that most Brewer color scales go from lighter to darker,
// so if you want to link smaller values to darker colors, you should reverse the scale.
// const COLOR_SCALE_NAME = 'RdYlGn';
let COLOR_SCALE_NAME = 'Viridis';  // gradient scale
let COLOR_SCALE_NAME_CAT = 'Set2';  // categorical scale
// const COLOR_SCALE_RANGE = [0, 1];  // the value range for the color scale in [0,1] 
let COLOR_SCALE_RANGE = [1, 0];  // this flips the color scale 
let COLOR_SCALE_INTERPOLATION_MODE = 'rgb';

console.log("Available color scale names: ", getChromaColorScales());
console.log("See more at https://www.datanovia.com/en/blog/the-a-z-of-rcolorbrewer-palette/")




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
let worker_gaze2field;
let currentMapId = 0;
let topText = "";
let bottomText = "";

// Optional mask polygons for gaze containment
let objectMasks;

// The collection of generated maps.
let maps = [{
  name: 'Gaze Heatmap - B&W',
  type: 'worker',
  worker: (() => {
    // We need this IIFE to create a new Worker instance
    // and attach the onmessage callback to it.
    const w = new Worker('js/worker-field-to-map-bw.js');
    w.onmessage = loadMapWorkerCallback('Gaze Heatmap - B&W');
    return w;
  })(),
  image: null
}, 
{
  name: 'Gaze Heatmap - Hue',
  type: 'worker',
  worker: (() => {
    const w = new Worker('js/worker-field-to-map-hue.js');
    w.onmessage = loadMapWorkerCallback('Gaze Heatmap - Hue');
    return w;
  })(),
  image: null
},
{
  name: 'Gaze Trajectory Path - B&W',
  type: 'function',
  func: fieldToTrajectoryPathBW,
  image: null
},
{
  name: 'Gaze Trajectory Path - Hue',
  type: 'function',
  func: fieldToTrajectoryPathHUE,
  image: null
},
{
  name: 'Gaze Trajectory Path - Color Scale',
  type: 'function',
  func: fieldToTrajectoryPathColorScale,
  image: null
},
{
  name: 'Gaze Trajectory Map - Hue v1',
  type: 'worker',
  worker: (() => {
    const w = new Worker('js/worker-gaze-to-trajectory-map-hue.js');
    w.onmessage = loadMapWorkerCallback('Gaze Trajectory Map - Hue v1');
    return w;
  })(),
  image: null
},
{
  name: 'Gaze Trajectory Map - Hue v2',
  type: 'worker',
  worker: (() => {
    const w = new Worker('js/worker-gaze-to-trajectory-map-hue2.js');
    w.onmessage = loadMapWorkerCallback('Gaze Trajectory Map - Hue v2');
    return w;
  })(),
  image: null
},
{
  name: 'Gaze Trajectory Map - Hue v3',
  type: 'worker',
  worker: (() => {
    const w = new Worker('js/worker-gaze-to-trajectory-map-hue3.js');
    w.onmessage = loadMapWorkerCallback('Gaze Trajectory Map - Hue v3');
    return w;
  })(),
  image: null
},
{
  name: 'Gaze Trajectory Map - Color Scale v2',
  type: 'worker',
  worker: (() => {
    const w = new Worker('js/worker-gaze-to-trajectory-map-cs2.js');
    w.onmessage = loadMapWorkerCallback('Gaze Trajectory Map - Color Scale v2');
    return w;
  })(),
  image: null
},
{
  name: 'Gaze Trajectory Map - Color Scale v3',
  type: 'worker',
  worker: (() => {
    const w = new Worker('js/worker-gaze-to-trajectory-map-cs3.js');
    w.onmessage = loadMapWorkerCallback('Gaze Trajectory Map - Color Scale v3');
    return w;
  })(),
  image: null
},
{
  name: 'Gaze Speed Path - Color Scale',
  type: 'function',
  func: fieldToSpeedPathColorScale,
  image: null
},
{
  name: 'Gaze Location - Object Masks',
  type: 'function',
  func: gazeToMaskedLocations,
  image: null,
  data: null
}
];




function setup() {
  // Set up workers
  worker_gaze2field = new Worker('js/worker-gaze-to-field.js');
  worker_gaze2field.onmessage = function(event) {
    switch (event.data.type) {
      case 'progress':
        bottomText = `Computing gaze field: ${Math.round(100 * event.data.value)}%`;
        break;

      case 'gazeField':
        handleGazeField(event);
        break;
      
      case 'error':
        bottomText = `Error: ${event.data.error}`;
        break;
    }
  }
  
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
  const map = maps[currentMapId];
  if (map && map.image) {
    image(map.image, 0.5 * width, 0.5 * height, width, height);
    bottomText = `Displaying computed map ${currentMapId + 1}/${maps.length}: '${map.name}'`;
  }

  // Render UI stuff
  textSize(TEXT_SIZE_S);
  text(topText, width / 2, TEXT_SIZE_S);

  textSize(TEXT_SIZE_L);
  text(bottomText, width / 2, height - TEXT_SIZE_L);
}


/**
 * What to do when a user drops a file on the canvas.
 * @param {*} file 
 * @returns 
 */
function gotFile(file) {
  // console.log(file);

  topText = `Loaded file: '${file.name}', file type: ${file.type}, file size: ${file.size} bytes`;

  // Background image?
  if (file.type === 'image') {
    bottomText = 'Loading image...';
    
    bgImg = createImg(file.data, 'background image', 'anonymous', function() {
      bgImg.hide();
      bottomText = `Loaded background image with size ${bgImg.width} x ${bgImg.height}.`;
    });
    
    return;
  }

  // JSON file with object masks?
  if (file.type === 'application' && file.subtype === 'json') {
    // Is it a mask file?
    if (file.data['type'] === 'object-masks') {
      objectMasks = file.data;
    }
    const msg = `Imported mask file with ${objectMasks['objects'].length} objects`;
    console.log(msg);
    bottomText = msg;

    if (csvFiles.length > 0) {
      compute();
    }
    return;
  }

  // CSV file with gazes?
  if (file.type === 'text' && file.subtype === 'csv') {
    const csvF = {
      file: file,
      gazeData: csvToJSON(file).map(parseGazeJSON)
    }
    csvFiles.push(csvF);
    
    bottomText = 'Parsing file...';
    
    compute();

    return;
  }
}

function compute() {
  const gazeSets = csvFiles.map(f => f.gazeData);

  // Use workers to push all the heavy computation to a separate thread.
  // Precompute the gaze field, and the callback
  // will trigger maps aftewards.
  worker_gaze2field.postMessage({
    // type: 'computeGazeMap',
    gazeSets,
    IMG_WIDTH,
    IMG_HEIGHT,
    GAZE_INCLUDE_FIXATION_ONLY,
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


function handleGazeField(event) {
  // console.log(`Received gaze field with ${field.length} elements.`);
  // console.log(`Field size: ${size.width} x ${size.height}`);

  // Create a big fat context object to pass to all the workers
  const context = {
    field: event.data.field,
    size: event.data.size,
    gazeSets: csvFiles.map(f => f.gazeData),
    IMG_WIDTH,
    IMG_HEIGHT,
    GAZE_INCLUDE_FIXATION_ONLY,
    GAZE_RADIUS,
    GAZE_LINE_WEIGHT,
    GAZE_HUE_RANGE,
    GAZE_ALPHA_RANGE,
    COLOR_SCALE_NAME,
    COLOR_SCALE_NAME_CAT,
    COLOR_SCALE_RANGE,
    COLOR_SCALE_INTERPOLATION_MODE,
    GAZE_LOCATION_MASK_SAFE_OFFSET,
    TEXT_FONT,
    TEXT_SIZE_S,
    TEXT_SIZE_M,
    TEXT_SIZE_L
  }

  // Start the workers
  maps.forEach(mmap => {
    const mapCtx = {name: mmap.name, ...context};
    if (mmap.type == 'worker') 
    {
      mmap.worker.postMessage(mapCtx);
    }
    else if (mmap.type == 'function') {
      mmap.func(mapCtx);
    }
  })
}

/**
 * Clears everything and resets the app to its initial state.
 */
function resetApp() {
  resetMaps();
  csvFiles = [];
  bgImg = null;
  topText = '';
  bottomText = `Drag and drop a background image and/or a valid gaze CSV file on this canvas.`;
}

function resetMaps() {
  maps.forEach(map => map.image = null);  
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
function fieldToTrajectoryPathBW(ctx) {
  // Draw gaze points as a polyline
  const pg = createGraphics(ctx.IMG_WIDTH, ctx.IMG_HEIGHT);
  pg.stroke(0);
  pg.strokeWeight(ctx.GAZE_LINE_WEIGHT);
  pg.noFill();
  pg.beginShape();
  for (let i = 0; i < ctx.gazeSets.length; i++) {
    const gazeData = ctx.gazeSets[i];
    for (let j = 0; j < gazeData.length; j++) {
      const x = gazeData[j].x;
      const y = gazeData[j].y;
      pg.vertex(x, y);
    }
  }
  pg.endShape();

  const img = pg.get();
  const map = maps.find(m => m.name == ctx.name);
  map.image = img;
}

/**
 * Creates a simple map with a colored polyline connecting all gaze points.
 * Uses HUE global settings and range. 
 */
function fieldToTrajectoryPathHUE(ctx) {
  const vertices = [];
  for (let i = 0; i < ctx.gazeSets.length; i++) {
    const gazeData = ctx.gazeSets[i];
    for (let j = 0; j < gazeData.length; j++) {
      vertices.push(gazeData[j].x, gazeData[j].y);
    }
  }
  const lineCount = Math.max(vertices.length / 2 - 1, 0);

  const pg = createGraphics(ctx.IMG_WIDTH, ctx.IMG_HEIGHT);
  pg.noFill();
  pg.strokeWeight(ctx.GAZE_LINE_WEIGHT);
  const hueLen = ctx.GAZE_HUE_RANGE[1] - ctx.GAZE_HUE_RANGE[0];
  for (let i = 0; i < lineCount; i++) {
    const x1 = vertices[i * 2];
    const y1 = vertices[i * 2 + 1];
    const x2 = vertices[i * 2 + 2];
    const y2 = vertices[i * 2 + 3];
    const n = i / lineCount;
    const hue = ctx.GAZE_HUE_RANGE[0] + hueLen * n;
    const rgba = HSBToRGB([hue, 100, 100, 100]);
    pg.stroke(rgba);
    pg.line(x1, y1, x2, y2);
  }

  const img = pg.get();
  const map = maps.find(m => m.name == ctx.name);
  map.image = img;
}


/**
 * Creates a simple map with a colored polyline connecting all gaze points.
 * Uses a Chroma Color Scale following . 
 */
function fieldToTrajectoryPathColorScale(ctx) {
  const vertices = [];
  for (let i = 0; i < ctx.gazeSets.length; i++) {
    const gazeData = ctx.gazeSets[i];
    for (let j = 0; j < gazeData.length; j++) {
      vertices.push(gazeData[j].x, gazeData[j].y);
    }
  }
  const lineCount = Math.max(vertices.length / 2 - 1, 0);

  const colorScale = chroma.scale(ctx.COLOR_SCALE_NAME)
    .mode(ctx.COLOR_SCALE_INTERPOLATION_MODE);
  const colorScaleLen = ctx.COLOR_SCALE_RANGE[1] - ctx.COLOR_SCALE_RANGE[0];

  const pg = createGraphics(ctx.IMG_WIDTH, ctx.IMG_HEIGHT);
  pg.noFill();
  pg.strokeWeight(ctx.GAZE_LINE_WEIGHT);
  for (let i = 0; i < lineCount; i++) {
    const x1 = vertices[i * 2];
    const y1 = vertices[i * 2 + 1];
    const x2 = vertices[i * 2 + 2];
    const y2 = vertices[i * 2 + 3];
    const n = i / lineCount;
    const nc = ctx.COLOR_SCALE_RANGE[0] + colorScaleLen * n;
    // const rgba = colorScale(nc).rgba();
    // rgba[3] = 255;  // chroma does 0-1 alpha
    // pg.stroke(rgba);
    const rgb = colorScale(nc).rgb();
    pg.stroke(rgb);
    pg.line(x1, y1, x2, y2);
  }

  const img = pg.get();
  const map = maps.find(m => m.name == ctx.name);
  map.image = img;
}


/**
 * Draws a path colored by gaze speed.
 * Uses a Chroma Color Scale. 
 */
function fieldToSpeedPathColorScale(ctx) {
  const vertices = [];
  for (let i = 0; i < ctx.gazeSets.length; i++) {
    const gazeData = ctx.gazeSets[i];
    for (let j = 0; j < gazeData.length; j++) {
      vertices.push(gazeData[j].x, gazeData[j].y);
    }
  }
  const lineCount = Math.max(vertices.length / 2 - 1, 0);
  
  // Compute speeds
  const speeds = [];
  for (let i = 0; i < lineCount; i++) {
    const x1 = vertices[i * 2];
    const y1 = vertices[i * 2 + 1];
    const x2 = vertices[i * 2 + 2];
    const y2 = vertices[i * 2 + 3];
    const d = distance(x1, y1, x2, y2);
    // We have to assume for this one that all intervals are the same... 
    // const t = ctx.gazeSets[0][i + 1].t - ctx.gazeSets[0][i].t;
    // const s = d / t;
    // speeds.push(s);
    speeds.push(d);
  }
  const speedRange = computeBounds(speeds);
  const speedLen = speedRange.maxVal - speedRange.minVal;


  const colorScale = chroma.scale(ctx.COLOR_SCALE_NAME)
    .mode(ctx.COLOR_SCALE_INTERPOLATION_MODE);
  const colorScaleLen = ctx.COLOR_SCALE_RANGE[1] - ctx.COLOR_SCALE_RANGE[0];

  const pg = createGraphics(ctx.IMG_WIDTH, ctx.IMG_HEIGHT);
  pg.noFill();
  pg.strokeWeight(ctx.GAZE_LINE_WEIGHT);
  for (let i = 0; i < lineCount; i++) {
    const x1 = vertices[i * 2];
    const y1 = vertices[i * 2 + 1];
    const x2 = vertices[i * 2 + 2];
    const y2 = vertices[i * 2 + 3];
    const s = speeds[i];
    const n = (s - speedRange.minVal) / speedLen;
    const nc = ctx.COLOR_SCALE_RANGE[0] + colorScaleLen * n;
    const rgb = colorScale(nc).rgb();
    pg.stroke(rgb);
    pg.line(x1, y1, x2, y2);
  }

  const img = pg.get();
  const map = maps.find(m => m.name == ctx.name);
  map.image = img;
}


// This could have been a worker, but since we need to use p5.js
// to draw the image, we'll do here for the time being...
function gazeToMaskedLocations(ctx) {
  const map = maps.find(m => m.name == ctx.name);

  // No masks? Done.
  if (!objectMasks) {
    map.image = imgFromColor(ctx.IMG_WIDTH, ctx.IMG_HEIGHT, 0,0,0);
    return;
  }

  // Create a dic of objects
  const areas = {};
  objectMasks.objects.forEach(obj => {
    areas[obj.name] = {
      count: 0,
      points: []
    };
  });

  // Remmebert that containment in SDFs is negative  
  const threshold = -ctx.GAZE_LOCATION_MASK_SAFE_OFFSET;

  // Iterate over all the gaze sets, and for each gaze point,
  // figure out if it's inside any of the masks.
  // Multiple masks per point are allowed.
  objectMasks.objects.forEach(mask => {
    const name = mask.name;
    const vert = mask.vertices;

    ctx.gazeSets.forEach(set => {
      set.forEach(gaze => {
        const sdf = SDFPolygon(vert, gaze.x, gaze.y);
        if (sdf <= threshold) {
          areas[name]['count']++;
          areas[name]['points'].push([gaze.x, gaze.y]);
        }
      });
    });
  });

  // Compute gaze location totals with ratios
  const gazeCount = ctx.gazeSets.reduce((acc, set) => acc + set.length, 0);
  const maskData = objectMasks.objects.map(obj => {
    const name = obj.name;
    const poly = objectMasks.objects.find(o => o.name == name).vertices;
    const count = areas[name]['count'];
    const ratio = count / gazeCount;
    const points = areas[name]['points'];
    return {name, poly, count, ratio, points};
  });

  // Store only important numerical information for export
  map.data = maskData.map(m => {
    return {
      name: m.name,
      count: m.count,
      ratio: m.ratio
    };
  })

  // Represent these visually
  const colorSet = chroma.brewer[ctx.COLOR_SCALE_NAME_CAT];
  const pg = createGraphics(ctx.IMG_WIDTH, ctx.IMG_HEIGHT);
  pg.background(255);
  pg.textAlign(CENTER, CENTER);
  for (let i = 0; i < maskData.length; i++) {
    const mask = maskData[i];
    const color = colorSet[i % colorSet.length];
    const color50 = addAlpha(color, 127);
    const color25 = addAlpha(color, 63);
    
    // Draw poly + fill
    pg.stroke(color);
    pg.strokeWeight(2);
    pg.strokeJoin(ROUND);
    pg.fill(color25);
    pg.beginShape();
    for (let j = 0; j < mask.poly.length; j += 2) {
      pg.vertex(mask.poly[j], mask.poly[j + 1]);
    }
    pg.endShape(CLOSE);

    // Draw points
    pg.stroke(color50);
    mask.points.forEach(p => {
      pg.point(p[0], p[1]);
    });

    // Draw text
    const msg = `${mask.name}\n(${mask.count} / ${(100 * mask.ratio).toFixed(2)}%)`;
    const c = polygonCenter(mask.poly);
    pg.fill(color);
    pg.noStroke();
    pg.textFont(ctx.TEXT_FONT);
    pg.textSize(ctx.TEXT_SIZE_L);
    pg.text(msg, c[0], c[1]);
  }

  map.image = pg.get();
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
 * Creates a solid color p5.Image.
 * @param {*} r 
 * @param {*} g 
 * @param {*} b 
 * @returns 
 */
function imgFromColor(w, h, r, g, b) {
  const pg = createGraphics(w, h);
  pg.background(r, g, b);
  return pg.get();
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
        const name = event.data.name;
        const map = maps.find(m => m.name == name);
        map.image = img;
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
      if (map.data) {
        saveJSON(map.data, `${safeFilename(csvfilename)}_${safeFilename(map.name)}_data.json`);
      }
      return;
      
    // Toggle background image
    case 'b':
    case 'B':
      showBGImg = !showBGImg;
      return;

    // Reset app
    case 'r':
    case 'R':
      resetApp();
      return;

    // Recompute everything
    case 'u':
    case 'U':
      compute();
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


// A function that iterates over all the keys of the chroma.brewer object
// and returns an array with the names of the color scales.
function getChromaColorScales() {
  const scales = [];
  for (const key in chroma.brewer) {
    scales.push(key);
  }
  return scales;
}