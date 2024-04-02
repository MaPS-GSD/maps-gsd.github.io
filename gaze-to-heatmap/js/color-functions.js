/**
 * Converts RGBA to HSBA color. Max ranges are RGBA[255, 255, 255, 255] to HSB[360, 100, 100, 100].
 * @param {Array} rgb An array of [R, G, B, A] colors. A is optional.
 * @returns The [H, S, B, A] color.
 * @see https://www.30secondsofcode.org/js/s/rgb-to-hsb
 */
function RGBToHSB(rgb) {
  let r = rgb[0];
  let g = rgb[1];
  let b = rgb[2];
  r /= 255;
  g /= 255;
  b /= 255;
  const v = Math.max(r, g, b),
    n = v - Math.min(r, g, b);
  const h = n === 0 ? 0 : n && v === r ? (g - b) / n : v === g ? 2 + (b - r) / n : 4 + (r - g) / n;
  const a = 100 * rgb[3] / 255 ?? 100;
  return [
    60 * (h < 0 ? h + 6 : h),
    v && (n / v) * 100,
    v * 100,
    a
  ];
};

/**
 * Converts RGBA to HSBA color. Max ranges are HSB[360, 100, 100, 100] to RGBA[255, 255, 255, 255].
 * @param {Array} hsb An array of [H, S, B, A] colors. A is optional.
 * @returns The [H, S, B, A] color.
 * @see https://www.30secondsofcode.org/js/s/hsb-to-rgb
 */
function HSBToRGB(hsb) {
  let h = hsb[0];
  let s = hsb[1];
  let b = hsb[2];
  s /= 100;
  b /= 100;
  // const k = (n) => (n + h / 60) % 6;  // fails for large negative hues
  const k = (n) => ((n + h / 60) % 6 + 6) % 6;  // use positive modulo: // https://stackoverflow.com/a/1082938/1934487
  const f = (n) => b * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
  const a = 255 * hsb[3] / 100 ?? 255;
  return [
    255 * f(5),
    255 * f(3),
    255 * f(1),
    a
  ];
};


/**
 * Interpolates linearly between two colors in RGBA space. 
 * @param {Array} a Start RGBA color
 * @param {Array} b End RGBA color
 * @param {Number} t Interpolation parameter 
 * @returns [R, G, B, A] color array
 */
function lerpRGB(a, b, t) {
  return [
    a[0] + t * (b[0] - a[0]),   // R
    a[1] + t * (b[1] - a[1]),   // G
    a[2] + t * (b[2] - a[2]),   // B
    a[3] + t * (b[3] - a[3])    // A
  ];
}

/**
 * Interpolates linearly between two colors in HSVA space. 
 * Assumes the input colors are in HSVA format too.
 * @param {Array} a Start HSVA color
 * @param {Array} b End HSVA color
 * @param {Number} t Interpolation parameter 
 * @returns [H, S, V, A] color array
 * @see https://www.alanzucconi.com/2016/01/06/colour-interpolation/
 */
function lerpHSV(a, b, t) {
  // Hue interpolation
  let h;
  let d = b[0] - a[0];

  // Take the shortest direction
  // if (a[0] > b[0]) {
  //   // Swap hues
  //   let h3 = b[0];
  //   b[0] = a[0];
  //   a[0] = h3;
  //   d = -d;
  //   t = 1 - t;
  // }
  if (d > 179) {
    a[0] = a[0] + 360;
    h = (a[0] + t * (b[0] - a[0])) % 360;
  }
  if (d <= 179) {
    h = a[0] + t * d
  }
  // Interpolates the rest
  return [
    a[0] + t * (b[0] - a[0]),   // H
    a[1] + t * (b[1] - a[1]),   // S
    a[2] + t * (b[2] - a[2]),   // V
    a[3] + t * (b[3] - a[3])    // A
  ];
}

