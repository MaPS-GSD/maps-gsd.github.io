// Global parameters
const IMG_WIDTH = 1600;
const IMG_HEIGHT = 1200;
const GAZE_X_COLNAME = "gaze x [px]";
const GAZE_Y_COLNAME = "gaze y [px]";
const GAZE_RADIUS = 100; // in pixels
const GAZE_HUE_RANGE = [240, 0]; // in degrees
const GAZE_HUE_ALPHA_RANGE = [0, 90]; // in [0, 100] range 


// Process variables (do not modify)
// const fitRatio = 0.80;
let canvas;
let csvFile;
let bgImg;
let gazeImgBW, gazeImgHue;
let msg = `Drag and drop a background image and/or a valid gaze CSV file on this canvas.`;
let worker_gaze2field, worker_field2bw, worker_field2hue;

function setup() {
  worker_gaze2field = new Worker('js/worker-gaze-to-field.js');
  worker_field2bw = new Worker('js/worker-field-to-bw.js');
  worker_field2hue = new Worker('js/worker-field-to-hue.js');

  canvas = createCanvas(IMG_WIDTH, IMG_HEIGHT);
  canvas.drop(gotFile);

  imageMode(CENTER);
  fill(255);
  noStroke();
  textAlign(CENTER, CENTER);
}

function draw() {
  background(0);

  if (bgImg) {
    image(bgImg, 0.5 * width, 0.5 * height);
    fill(0);
  }

  // if (gazeImgBW) {
  //   // const boxS = width > height ? fitRatio * height : fitRatio & width;
  //   // const scaleRatio = gazeImg.width > gazeImg.height ? boxS / gazeImg.width : boxS / gazeImg.height;
  //   // const imgW = scaleRatio * gazeImg.width;
  //   // const imgH = scaleRatio * gazeImg.height;
  //   // image(gazeImg, 0.5 * width, 0.5 * height, imgW, imgH);
  //   image(gazeImgBW, 0.5 * width, 0.5 * height);
  // }

  if (gazeImgHue) {
    if (!bgImg) background(255);
    image(gazeImgHue, 0.5 * width, 0.5 * height);
    fill(0);
  }

  if (csvFile) {
    textSize(12);
    text(`File name: '${csvFile.name}', file type: ${csvFile.type}, file size: ${csvFile.size} bytes`, width / 2, 30);
  }

  textSize(24);
  text(msg, width / 2, height - 40);
}


function gotFile(file) {

  if (file.type === 'image') {
    msg = 'Loading image...';

    bgImg = createImg(file.data, 'background image', 'anonymous', function() {
      bgImg.hide();
      msg = `Loaded image with size ${bgImg.width} x ${bgImg.height}.`;
    });

    return;
  }

  csvFile = file;

  msg = 'Parsing file...';

  csv = parseCSV(file);
  // console.log(csv[0]);

  msg = `Parsed CSV file with ${csv.length} rows and ${csv[0].length} columns.`;

  // Use workers to push all the heavy computation to a separate thread
  worker_gaze2field.postMessage({
    type: 'computeGazeMap',
    csv,
    IMG_WIDTH,
    IMG_HEIGHT,
    GAZE_X_COLNAME,
    GAZE_Y_COLNAME,
    GAZE_RADIUS,
    // scope: this  // cannot pass methods to worker! 
    // foo: function() { return 'bar';}   // same!
  });

  worker_gaze2field.onmessage = function(event) {
    switch (event.data.type) {
      case 'progress':
        msg = `Computing gaze field: ${Math.round(100 * event.data.value)}%`;
        break;

      case 'gazeField':
        handleGazeField(event.data.field, event.data.size);
        break;
      
      case 'error':
        msg = `Error: ${event.data.error}`;
        break;
    }
  }
}



function handleGazeField(field, size) {
  console.log(`Received gaze field with ${field.length} elements.`);
  console.log(`Field size: ${size.width} x ${size.height}`);
  // console.log(`Bounds: minVal=${bounds.minVal}, maxVal=${bounds.maxVal}`);

  worker_field2bw.postMessage({
    type: 'computeBWImage',
    field,
    size
  });

  worker_field2bw.onmessage = function(event) {
    switch (event.data.type) {
      case 'progress':
        msg = `Computing gaze BW image: ${Math.round(100 * event.data.value)}%`;
        break;

      case 'fieldImg':
        keepImgBW(event.data.pixels);
        worker_field2hue.postMessage({
          type: 'computeHUEImage',
          field,
          size, 
          range: GAZE_HUE_RANGE,
          alphas: GAZE_HUE_ALPHA_RANGE
        });
        break;
      
      case 'error':
        msg = `Error: ${event.data.error}`;
        break;
    }
  }

  worker_field2hue.onmessage = function(event) {
    switch (event.data.type) {
      case 'progress':
        msg = `Computing gaze HUE image: ${Math.round(100 * event.data.value)}%`;
        break;

      case 'fieldImg':
        keepImgHUE(event.data.pixels);
        break;
      
      case 'error':
        msg = `Error: ${event.data.error}`;
        break;
    }
  } 
}


function keepImgBW(pixels) {
  gazeImgBW = createImage(IMG_WIDTH, IMG_HEIGHT);
  gazeImgBW.loadPixels();
  // gazeImg.pixels = pixels;  // this doesn't work: pixels array is read-only 
  gazeImgBW.pixels.set(pixels);  // but this does: https://stackoverflow.com/a/14331581/1934487
  gazeImgBW.updatePixels();

  // msg = `Press 's' to save the gaze maps as images.`;
}

function keepImgHUE(pixels) {
  gazeImgHue = createImage(IMG_WIDTH, IMG_HEIGHT);
  gazeImgHue.loadPixels();
  gazeImgHue.pixels.set(pixels);
  gazeImgHue.updatePixels();

  msg = `Press 's' to save the gaze maps as images.`;
}




function keyPressed() {
  if (key === 's') {
    save(gazeImgBW, 'gaze_map_bw.png');
    save(gazeImgHue, 'gaze_map_hue.png');
  }
}

