importScripts('utils.js');
importScripts('color-functions.js');

/**
 * Takes a numerical field, and computes the [R, G, B, A...] array
 * of pixels, where the field values are mapped to a HSV hue wheel.
 */
onmessage = (event) => {
  console.log("Started field to HSV pixel array.");

  const field = event.data.field;
  const bounds = computeBounds(field);
  const maxv = bounds.maxVal;
  const range = event.data.range;
  const alphas = event.data.alphas;

  const pixels = new Uint8ClampedArray(field.length * 4);
  const notifyAt = Math.floor(field.length / 100);

  let i4;
  for (let i = 0; i < field.length; i++) {
    const h = remap(field[i], 0, maxv, range[0], range[1]);
    let a = remap(field[i], 0, maxv, 0, 1);
    a = easeOutExpo(a);
    a = remap(a, 0, 1, alphas[0], alphas[1]);
    const hsva = [h, 100, 100, a];
    const rgba = HSBToRGB(hsva);

    i4 = i * 4;
    pixels[i4] = rgba[0];
    pixels[i4 + 1] = rgba[1];
    pixels[i4 + 2] = rgba[2];
    pixels[i4 + 3] = rgba[3];

    if (i % notifyAt === 0) {
      postMessage({
        type: 'progress',
        value: i / field.length
      });
    }
  }

  console.log("Finished field to HSV pixel array.");

  postMessage({
    type: 'pixelData',
    pixels,
  });
}