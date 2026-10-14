// Generates the PWA icons (no dependencies): Moss tile with three Cream bars of
// decreasing length, echoing the Home progress rows. Run: node tools/make-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'web', 'icons');
const MOSS = [0x00, 0x4d, 0x40];
const CREAM = [0xe5, 0xea, 0xde];
const SS = 4; // supersampling per axis

// Bars in unit coordinates, inside the maskable safe zone (centre 80%).
const BARS = [
  { y: 0.36, len: 1.0 },
  { y: 0.5, len: 0.72 },
  { y: 0.64, len: 0.44 },
];
const BAR_X0 = 0.27;
const BAR_X1 = 0.73;
const BAR_H = 0.085;

function inPill(x, y, x0, x1, cy, r) {
  if (Math.abs(y - cy) > r) return false;
  if (x >= x0 + r && x <= x1 - r) return true;
  const cx = x < x0 + r ? x0 + r : x1 - r;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function inRoundedSquare(x, y, r) {
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** Returns [r,g,b,a] for a unit-space sample. */
function sample(x, y, corner) {
  if (corner && !inRoundedSquare(x, y, corner)) return [0, 0, 0, 0];
  for (const b of BARS) {
    const x1 = BAR_X0 + (BAR_X1 - BAR_X0) * b.len;
    if (inPill(x, y, BAR_X0, x1, b.y, BAR_H / 2)) return [...CREAM, 255];
  }
  return [...MOSS, 255];
}

function render(size, corner) {
  const px = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [cr, cg, cb, ca] = sample((pxi + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size, corner);
          r += cr * ca; g += cg * ca; b += cb * ca; a += ca;
        }
      }
      const i = (py * size + pxi) * 4;
      px[i] = a ? Math.round(r / a) : 0;
      px[i + 1] = a ? Math.round(g / a) : 0;
      px[i + 2] = a ? Math.round(b / a) : 0;
      px[i + 3] = Math.round(a / (SS * SS));
    }
  }
  return px;
}

function png(size, rgba) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const ICONS = [
  { file: 'icon-192.png', size: 192, corner: 0.2 }, // "any": own rounded corners
  { file: 'icon-512.png', size: 512, corner: 0.2 },
  { file: 'icon-maskable-512.png', size: 512, corner: 0 }, // full bleed; the OS masks it
  { file: 'apple-touch-icon.png', size: 180, corner: 0 }, // iOS rounds it
];

fs.mkdirSync(OUT, { recursive: true });
for (const { file, size, corner } of ICONS) {
  fs.writeFileSync(path.join(OUT, file), png(size, render(size, corner)));
  console.log('wrote', file);
}

const bars = BARS.map(b => {
  const x0 = BAR_X0 * 64, w = (BAR_X1 - BAR_X0) * b.len * 64, h = BAR_H * 64;
  return `<rect x="${x0.toFixed(2)}" y="${(b.y * 64 - h / 2).toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" rx="${(h / 2).toFixed(2)}" fill="#E5EADE"/>`;
}).join('');
fs.writeFileSync(
  path.join(OUT, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12.8" fill="#004D40"/>${bars}</svg>\n`
);
console.log('wrote favicon.svg');
