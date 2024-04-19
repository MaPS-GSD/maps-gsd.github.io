importScripts('utils.js');

/**
 * Takes a numerical field, and computes the [R, G, B, A...] array
 * of pixels, where the field values are mapped to a grayscale.
 */
onmessage = (event) => {
  console.log(`Started map computation: "${event.data.name}"`);
  
  const field = event.data.field;
  const bounds = computeBounds(field);
  const maxv = bounds.maxVal;
  
  const pixels = new Uint8ClampedArray(field.length * 4);
  const notifyAt = Math.floor(field.length / 100);

  let i4;
  for (let i = 0; i < field.length; i++) {
    const v = field[i] / maxv;
    const c = Math.floor(v * 255 + 0.5);
    i4 = i * 4;
    pixels[i4] = c;
    pixels[i4 + 1] = c;
    pixels[i4 + 2] = c;
    pixels[i4 + 3] = 255;

    if (i % notifyAt === 0) {
      postMessage({
        type: 'progress',
        value: i / field.length
      });
    }
  }

  console.log("Finished field to BW pixel array.");

  postMessage({
    name: event.data.name,
    type: 'pixelData',
    pixels,
  });
}