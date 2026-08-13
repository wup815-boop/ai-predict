/**
 * generate-pwa-icons.js
 *
 * アクセントカラー(#16A085)の背景に、成長比較を表す2本の白いバーを描いた
 * シンプルなPWAアイコンを生成する。外部画像・依存ライブラリなしでPNGを
 * 直接エンコードする（Node標準のzlibのみ使用）。
 *
 * 実行: node scripts/generate-pwa-icons.js
 */

const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

function crc32(buf) {
  if (!crc32.table) {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[n] = c >>> 0;
    }
    crc32.table = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crc32.table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  const ihdr = chunk("IHDR", ihdrData);

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const idat = chunk("IDAT", compressed);
  const iend = chunk("IEND", Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const [br, bg, bb] = [22, 160, 133]; // #16A085
  for (let i = 0; i < size * size; i++) {
    buf[i * 4] = br;
    buf[i * 4 + 1] = bg;
    buf[i * 4 + 2] = bb;
    buf[i * 4 + 3] = 255;
  }

  const cx = size / 2;
  const cy = size / 2;
  const barW = size * 0.12;
  const gap = size * 0.06;
  const h1 = size * 0.28; // shorter bar (A)
  const h2 = size * 0.46; // taller bar (B)

  function fillRect(x0, y0, x1, y1) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    for (let y = y0; y < y1; y++) {
      if (y < 0 || y >= size) continue;
      for (let x = x0; x < x1; x++) {
        if (x < 0 || x >= size) continue;
        const idx = (y * size + x) * 4;
        buf[idx] = 255;
        buf[idx + 1] = 255;
        buf[idx + 2] = 255;
        buf[idx + 3] = 255;
      }
    }
  }

  fillRect(cx - gap / 2 - barW, cy - h1 / 2, cx - gap / 2, cy + h1 / 2);
  fillRect(cx + gap / 2, cy - h2 / 2, cx + gap / 2 + barW, cy + h2 / 2);

  return buf;
}

function generate(size, outPath) {
  const rgba = drawIcon(size);
  const png = encodePNG(size, size, rgba);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${size}x${size}, ${png.length} bytes)`);
}

const root = path.join(__dirname, "..");
generate(32, path.join(root, "src", "app", "icon.png"));
generate(180, path.join(root, "src", "app", "apple-icon.png"));
generate(192, path.join(root, "public", "icons", "icon-192.png"));
generate(512, path.join(root, "public", "icons", "icon-512.png"));
