// Минимальный PNG: чтение (без чересстрочности) и запись RGBA. Без зависимостей.
'use strict';
const zlib = require('zlib');

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function decode(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('не PNG');
  let off = 8, w = 0, h = 0, depth = 0, ctype = 0, palette = null, trns = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    off += 12 + len;
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9];
      if (data[12] !== 0) throw new Error('чересстрочный PNG не поддерживается');
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  const bpp = Math.max(1, (channels * depth) >> 3);
  const stride = (w * channels * depth + 7) >> 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(stride * h);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = px.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? out[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[i] = v & 255;
    }
    prev = out;
  }
  const rgba = Buffer.alloc(w * h * 4);
  const sample = (row, i) => {
    if (depth === 8) return row[i];
    const bit = i * depth;
    return (row[bit >> 3] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
  };
  for (let y = 0; y < h; y++) {
    const row = px.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (ctype === 3) {
        const k = sample(row, x);
        rgba[o] = palette[k * 3]; rgba[o + 1] = palette[k * 3 + 1]; rgba[o + 2] = palette[k * 3 + 2];
        rgba[o + 3] = trns && k < trns.length ? trns[k] : 255;
      } else if (ctype === 6) {
        row.copy(rgba, o, x * 4, x * 4 + 4);
      } else if (ctype === 2) {
        rgba[o] = row[x * 3]; rgba[o + 1] = row[x * 3 + 1]; rgba[o + 2] = row[x * 3 + 2]; rgba[o + 3] = 255;
      } else {
        const g = ctype === 0 ? sample(row, x) * (255 / ((1 << depth) - 1)) : row[x * 2];
        rgba[o] = rgba[o + 1] = rgba[o + 2] = g; rgba[o + 3] = ctype === 4 ? row[x * 2 + 1] : 255;
      }
    }
  }
  return { width: w, height: h, data: rgba };
}

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(b) {
  let c = -1;
  for (const v of b) c = CRC[(c ^ v) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encode({ width, height, data }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) data.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([SIG, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function blank(width, height) {
  return { width, height, data: Buffer.alloc(width * height * 4) };
}

function blit(dst, src, sx, sy, w, h, dx, dy) {
  for (let y = 0; y < h; y++) {
    if (sy + y >= src.height) break;
    const from = ((sy + y) * src.width + sx) * 4;
    src.data.copy(dst.data, ((dy + y) * dst.width + dx) * 4, from, from + Math.min(w, src.width - sx) * 4);
  }
}

// увеличение без сглаживания — для превью
function scale(img, k) {
  const out = blank(img.width * k, img.height * k);
  for (let y = 0; y < out.height; y++)
    for (let x = 0; x < out.width; x++)
      img.data.copy(out.data, (y * out.width + x) * 4, ((Math.floor(y / k)) * img.width + Math.floor(x / k)) * 4, ((Math.floor(y / k)) * img.width + Math.floor(x / k)) * 4 + 4);
  return out;
}

module.exports = { decode, encode, blank, blit, scale };
