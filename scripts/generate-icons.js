import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const iconsDir = path.join(__dirname, '..', 'icons');

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// CRC32 implementation for PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([lenBuf, body, crcBuf]);
}

function generatePNG(width, height, pixelFn) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // 8 bits per channel
  ihdr.writeUInt8(6, 9); // RGBA color type
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
  const ihdrChunk = makeChunk('IHDR', ihdr);

  const raw = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = a;
    }
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

// Distance to rounded rectangle
function sdRoundRect(px, py, rx, ry, rw, rh, radius) {
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  const dx = Math.abs(px - cx) - (rw / 2 - radius);
  const dy = Math.abs(py - cy) - (rh / 2 - radius);
  const ox = Math.max(dx, 0);
  const oy = Math.max(dy, 0);
  const inside = Math.min(Math.max(dx, dy), 0);
  return Math.sqrt(ox * ox + oy * oy) + inside - radius;
}

// Check if point (px, py) is inside the thick 'V' shape
function isInsideV(px, py, cx, topY, botY, halfW, thickness) {
  if (py < topY || py > botY) return 0;
  const progress = (py - topY) / (botY - topY); // 0 at top, 1 at bottom
  
  // Left arm center x at this y
  const leftArmX = (cx - halfW) + progress * halfW;
  // Right arm center x at this y
  const rightArmX = (cx + halfW) - progress * halfW;

  const distLeft = Math.abs(px - leftArmX);
  const distRight = Math.abs(px - rightArmX);
  const minDist = Math.min(distLeft, distRight);

  // Smooth antialiasing over 1.5px
  if (minDist <= thickness / 2 - 0.75) return 1.0;
  if (minDist >= thickness / 2 + 0.75) return 0.0;
  return 1.0 - (minDist - (thickness / 2 - 0.75)) / 1.5;
}

// Painter for App Icon
function paintAppIcon(x, y, size, isMaskable = false) {
  // Background gradient: #1e3a8a (deep blue) at top-left to #2563eb to #3b82f6 (vibrant blue)
  const diag = (x + y) / (size * 2);
  let bgR = Math.round(30 + diag * 29);
  let bgG = Math.round(58 + diag * 72);
  let bgB = Math.round(138 + diag * 107);
  let bgA = 255;

  if (isMaskable) {
    // Maskable icon: full-bleed background to edges
    // Safe zone is central 80% circle (radius size * 0.40)
    const cx = size / 2;
    const cy = size / 2;

    // Draw central badge shield
    const badgeW = size * 0.65;
    const badgeH = size * 0.65;
    const badgeX = cx - badgeW / 2;
    const badgeY = cy - badgeH / 2;
    const badgeRad = size * 0.14;
    const dBadge = sdRoundRect(x, y, badgeX, badgeY, badgeW, badgeH, badgeRad);

    let innerR = 37, innerG = 99, innerB = 235;
    if (dBadge <= 0) {
      // Inside badge: lighter vibrant blue
      const bDiag = (x - badgeX + y - badgeY) / (badgeW + badgeH);
      innerR = Math.round(37 + bDiag * 30);
      innerG = Math.round(99 + bDiag * 40);
      innerB = Math.round(235 + bDiag * 20);
      bgR = innerR; bgG = innerG; bgB = innerB;
    } else if (dBadge < 2) {
      const alpha = 1 - (dBadge / 2);
      bgR = Math.round(bgR * (1 - alpha) + 59 * alpha);
      bgG = Math.round(bgG * (1 - alpha) + 130 * alpha);
      bgB = Math.round(bgB * (1 - alpha) + 246 * alpha);
    }

    // Draw 'V' glyph inside safe zone
    const vTopY = cy - size * 0.18;
    const vBotY = cy + size * 0.17;
    const vHalfW = size * 0.19;
    const vThick = size * 0.085;
    const vAlpha = isInsideV(x, y, cx, vTopY, vBotY, vHalfW, vThick);

    if (vAlpha > 0) {
      bgR = Math.round(bgR * (1 - vAlpha) + 255 * vAlpha);
      bgG = Math.round(bgG * (1 - vAlpha) + 255 * vAlpha);
      bgB = Math.round(bgB * (1 - vAlpha) + 255 * vAlpha);
    }

    // Small visitor check/dot badge at top right
    const dotX = cx + size * 0.19;
    const dotY = cy - size * 0.17;
    const dotR = size * 0.045;
    const dDot = Math.hypot(x - dotX, y - dotY) - dotR;
    if (dDot <= 0) {
      bgR = 34; bgG = 197; bgB = 94; // emerald #22c55e
    } else if (dDot < 1.5) {
      const a = 1 - dDot / 1.5;
      bgR = Math.round(bgR * (1 - a) + 34 * a);
      bgG = Math.round(bgG * (1 - a) + 197 * a);
      bgB = Math.round(bgB * (1 - a) + 94 * a);
    }

    return [bgR, bgG, bgB, 255];
  }

  // Non-maskable ("any"): rounded rectangle card with margin
  const margin = size * 0.06;
  const cardW = size - margin * 2;
  const cardH = size - margin * 2;
  const radius = size * 0.22;
  const dCard = sdRoundRect(x, y, margin, margin, cardW, cardH, radius);

  if (dCard > 1.5) {
    return [0, 0, 0, 0]; // Transparent outside
  }

  const cx = size / 2;
  const cy = size / 2;

  // Draw 'V' glyph
  const vTopY = cy - size * 0.22;
  const vBotY = cy + size * 0.21;
  const vHalfW = size * 0.24;
  const vThick = size * 0.105;
  const vAlpha = isInsideV(x, y, cx, vTopY, vBotY, vHalfW, vThick);

  if (vAlpha > 0) {
    bgR = Math.round(bgR * (1 - vAlpha) + 255 * vAlpha);
    bgG = Math.round(bgG * (1 - vAlpha) + 255 * vAlpha);
    bgB = Math.round(bgB * (1 - vAlpha) + 255 * vAlpha);
  }

  // Emerald verification dot at top-right of 'V'
  const dotX = cx + size * 0.24;
  const dotY = cy - size * 0.20;
  const dotR = size * 0.055;
  const dDot = Math.hypot(x - dotX, y - dotY) - dotR;
  if (dDot <= 0) {
    bgR = 34; bgG = 197; bgB = 94; // emerald green
  } else if (dDot < 1.5) {
    const a = 1 - dDot / 1.5;
    bgR = Math.round(bgR * (1 - a) + 34 * a);
    bgG = Math.round(bgG * (1 - a) + 197 * a);
    bgB = Math.round(bgB * (1 - a) + 94 * a);
  }

  // Card boundary antialiasing
  if (dCard > 0) {
    const alpha = (1.5 - dCard) / 1.5;
    bgA = Math.round(255 * Math.max(0, Math.min(1, alpha)));
  }

  return [bgR, bgG, bgB, bgA];
}

console.log('Generating PWA Icons...');

// 1. icon-192.png (192x192, purpose: any)
const p192 = generatePNG(192, 192, (x, y) => paintAppIcon(x, y, 192, false));
fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), p192);
console.log('✔ Generated icons/icon-192.png');

// 2. icon-512.png (512x512, purpose: any)
const p512 = generatePNG(512, 512, (x, y) => paintAppIcon(x, y, 512, false));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), p512);
console.log('✔ Generated icons/icon-512.png');

// 3. icon-maskable-512.png (512x512, purpose: maskable, full bleed with safe zone)
const pMaskable = generatePNG(512, 512, (x, y) => paintAppIcon(x, y, 512, true));
fs.writeFileSync(path.join(iconsDir, 'icon-maskable-512.png'), pMaskable);
console.log('✔ Generated icons/icon-maskable-512.png');

// 4. apple-touch-icon.png (180x180, iOS Safari PNG requirement)
const pApple = generatePNG(180, 180, (x, y) => paintAppIcon(x, y, 180, false));
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), pApple);
console.log('✔ Generated icons/apple-touch-icon.png');

// 5. favicon-32.png (32x32)
const pFavicon = generatePNG(32, 32, (x, y) => paintAppIcon(x, y, 32, false));
fs.writeFileSync(path.join(iconsDir, 'favicon-32.png'), pFavicon);
console.log('✔ Generated icons/favicon-32.png');

// 6. icon.svg (Scalable vector)
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e3a8a"/>
      <stop offset="50%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
    <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="dropShadow" x="-10%" y="-10%" width="120%" height="125%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#0f172a" flood-opacity="0.25"/>
    </filter>
  </defs>

  <!-- Outer Rounded Card -->
  <rect x="32" y="32" width="448" height="448" rx="100" fill="url(#bgGrad)" filter="url(#dropShadow)"/>
  <rect x="32" y="32" width="448" height="448" rx="100" fill="url(#badgeGrad)"/>

  <!-- Subtle Campus Gate / Pass Accent Arc -->
  <circle cx="256" cy="256" r="160" fill="none" stroke="#ffffff" stroke-width="2" stroke-opacity="0.2" stroke-dasharray="12 12"/>

  <!-- Bold V Monogram -->
  <path d="M 148 152 L 230 366 C 238 386 274 386 282 366 L 364 152 C 370 136 354 122 338 126 C 330 128 322 134 320 142 L 256 312 L 192 142 C 188 132 178 126 168 126 C 150 126 142 142 148 152 Z" fill="#ffffff"/>

  <!-- Online / Verified Badge Dot -->
  <circle cx="376" cy="144" r="28" fill="#22c55e" stroke="#ffffff" stroke-width="6"/>
</svg>`;
fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgContent);
console.log('✔ Generated icons/icon.svg');

console.log('All PWA icons generated successfully!');
