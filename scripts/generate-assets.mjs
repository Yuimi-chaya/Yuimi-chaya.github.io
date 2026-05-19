import { copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

const outDir = new URL("../public/assets/", import.meta.url);
await mkdir(outDir, { recursive: true });

const sourceMusicDir = new URL("../MUSIC/", import.meta.url);
const publicMusicDir = new URL("../public/music/", import.meta.url);
const audioExtensions = new Set([".mp3", ".flac", ".wav", ".ogg", ".m4a"]);

function extensionOf(filename) {
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index).toLowerCase() : "";
}

function publicMusicPath(filename) {
  return `/music/${filename.split("/").map(encodeURIComponent).join("/")}`;
}

async function syncMusicLibrary() {
  let entries = [];

  try {
    entries = await readdir(sourceMusicDir, { withFileTypes: true });
  } catch {
    await mkdir(publicMusicDir, { recursive: true });
    await writeFile(new URL("manifest.json", publicMusicDir), "[]\n");
    return;
  }

  await mkdir(publicMusicDir, { recursive: true });
  const tracks = entries
    .filter((entry) => entry.isFile() && audioExtensions.has(extensionOf(entry.name)))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { sensitivity: "base" }));

  await Promise.all(
    tracks.map((entry) => copyFile(new URL(entry.name, sourceMusicDir), new URL(entry.name, publicMusicDir)))
  );

  const manifest = tracks.map((entry, index) => {
    const title = entry.name.replace(/\.[^.]+$/, "");
    return {
      id: `track-${index + 1}`,
      title,
      file: entry.name,
      src: publicMusicPath(entry.name)
    };
  });

  await writeFile(new URL("manifest.json", publicMusicDir), `${JSON.stringify(manifest, null, 2)}\n`);
}

await syncMusicLibrary();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function png(width, height, draw) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a = 255] = draw(x, y, width, height);
      const i = row + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function clamp(v, min = 0, max = 255) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function hash(x, y) {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967295;
}

function ellipse(x, y, cx, cy, rx, ry) {
  return Math.hypot((x - cx) / rx, (y - cy) / ry) < 1;
}

const animeCover = png(2048, 1152, (x, y, w, h) => {
  const nx = x / w;
  const ny = y / h;
  const snow = ny > 0.5 ? (ny - 0.5) * 110 : 0;
  const skyGlow = Math.max(0, 1 - Math.hypot(nx - 0.55, ny - 0.24) * 1.6);
  let r = 102 + ny * 38 + skyGlow * 24 + snow;
  let g = 118 + ny * 34 + skyGlow * 30 + snow;
  let b = 132 + ny * 42 + skyGlow * 42 + snow;

  const rail = y > h * 0.07 && y < h * 0.23 && (x % 96 < 10 || Math.abs(y - h * 0.12) < 5);
  if (rail) {
    r = 42;
    g = 52;
    b = 64;
  }

  const bench = x > w * 0.62 && x < w * 0.91 && y > h * 0.18 && y < h * 0.3;
  if (bench && ((y - h * 0.18) % 32 < 16 || Math.abs(y - h * 0.3) < 6)) {
    r = 104;
    g = 78;
    b = 58;
  }

  const shadow = ellipse(x, y, w * 0.67, h * 0.77, 520, 130);
  if (shadow) {
    r *= 0.62;
    g *= 0.68;
    b *= 0.78;
  }

  const hood = ellipse(x, y, w * 0.46, h * 0.43, 405, 365);
  const hoodTrim = ellipse(x, y, w * 0.45, h * 0.38, 435, 405) && !ellipse(x, y, w * 0.47, h * 0.42, 340, 320);
  const scarf = ellipse(x, y, w * 0.46, h * 0.63, 520, 210) || ellipse(x, y, w * 0.35, h * 0.58, 350, 160);
  const face = ellipse(x, y, w * 0.49, h * 0.43, 210, 255);
  const hair = ellipse(x, y, w * 0.48, h * 0.32, 265, 180) || ellipse(x, y, w * 0.38, h * 0.42, 130, 245);
  const coat = ellipse(x, y, w * 0.5, h * 0.82, 470, 300);

  if (coat) {
    r = 72;
    g = 104;
    b = 144;
  }
  if (hood || scarf) {
    const plaidA = x % 92 < 10 || y % 78 < 8;
    const plaidB = (x + y) % 128 < 9;
    r = plaidA ? 170 : plaidB ? 214 : 117;
    g = plaidA ? 128 : plaidB ? 190 : 54;
    b = plaidA ? 96 : plaidB ? 138 : 45;
  }
  if (hoodTrim) {
    r = 220;
    g = 218;
    b = 205;
  }
  if (face) {
    const blush = ellipse(x, y, w * 0.55, h * 0.49, 60, 28) || ellipse(x, y, w * 0.43, h * 0.49, 62, 28);
    r = blush ? 224 : 216;
    g = blush ? 154 : 184;
    b = blush ? 154 : 169;
  }
  if (hair) {
    const strand = (x + y * 2) % 62 < 14;
    r = strand ? 173 : 154;
    g = strand ? 178 : 161;
    b = strand ? 205 : 196;
  }

  const eyeL = ellipse(x, y, w * 0.44, h * 0.45, 42, 52);
  const eyeR = ellipse(x, y, w * 0.55, h * 0.44, 48, 58);
  if (eyeL || eyeR) {
    const shine = ellipse(x, y, eyeL ? w * 0.43 : w * 0.54, h * 0.42, 12, 15);
    r = shine ? 230 : 47;
    g = shine ? 246 : 113;
    b = shine ? 255 : 184;
  }

  const mouth = ellipse(x, y, w * 0.51, h * 0.54, 34, 16) && y > h * 0.535;
  if (mouth) {
    r = 105;
    g = 42;
    b = 58;
  }

  if (hash(Math.floor(x / 5), Math.floor(y / 5)) > 0.992 && ny < 0.95) {
    r = 240;
    g = 246;
    b = 250;
  }

  const vignette = Math.hypot(nx - 0.5, ny - 0.5);
  r *= 1 - Math.max(0, vignette - 0.42) * 0.55;
  g *= 1 - Math.max(0, vignette - 0.42) * 0.55;
  b *= 1 - Math.max(0, vignette - 0.42) * 0.55;

  return [clamp(r), clamp(g), clamp(b), 255];
});

const hero = png(1536, 864, (x, y, w, h) => {
  const nx = x / w;
  const ny = y / h;
  const glow = Math.max(0, 1 - Math.hypot(nx - 0.68, ny - 0.42) * 1.8);
  const desk = ny > 0.68 ? (ny - 0.68) * 90 : 0;
  let r = 15 + nx * 18 + glow * 58 + desk;
  let g = 18 + ny * 18 + glow * 78 + desk * 0.6;
  let b = 22 + glow * 118 + desk * 0.35;

  const grid = (x % 48 < 2 || y % 48 < 2) && ny > 0.2 && ny < 0.72;
  if (grid) {
    r += 12;
    g += 34;
    b += 46;
  }

  const panel = x > w * 0.5 && x < w * 0.9 && y > h * 0.22 && y < h * 0.62;
  if (panel) {
    r += 10;
    g += 28;
    b += 42;
    if ((x + y) % 37 < 5) {
      r += 30;
      g += 75;
      b += 95;
    }
  }

  const head = Math.hypot((x - w * 0.31) / 110, (y - h * 0.44) / 135) < 1;
  const hair = Math.hypot((x - w * 0.28) / 150, (y - h * 0.38) / 130) < 1 && y < h * 0.48;
  const body = Math.abs(x - w * 0.32) < 165 && y > h * 0.53 && y < h * 0.78;
  if (body || hair) {
    r = 33 + glow * 20;
    g = 38 + glow * 18;
    b = 52 + glow * 24;
  }
  if (head) {
    r = 188;
    g = 162;
    b = 146;
  }

  const hairStrand = hair && ((x + y * 2) % 41 < 9);
  if (hairStrand) {
    r = 79;
    g = 93;
    b = 128;
  }

  const accentLine = panel && (Math.abs(y - h * 0.36) < 3 || Math.abs(y - h * 0.49) < 3);
  if (accentLine) {
    r = 130;
    g = 239;
    b = 230;
  }

  if (hash(Math.floor(x / 3), Math.floor(y / 3)) > 0.997 && ny < 0.65) {
    r = 220;
    g = 235;
    b = 255;
  }

  return [clamp(r), clamp(g), clamp(b), 255];
});

const avatar = png(512, 512, (x, y, w, h) => {
  const nx = (x - w / 2) / (w / 2);
  const ny = (y - h / 2) / (h / 2);
  const d = Math.hypot(nx, ny);
  let r = 16;
  let g = 20;
  let b = 25;
  let a = d < 0.95 ? 255 : 0;
  if (d < 0.95) {
    const ring = Math.abs(d - 0.72) < 0.025;
    const slash = Math.abs(nx * 0.75 + ny) < 0.08 && d < 0.62;
    const core = d < 0.22;
    r += 30 + (1 - d) * 20;
    g += 36 + (1 - d) * 35;
    b += 48 + (1 - d) * 60;
    if (ring || slash || core) {
      r = 128;
      g = 232;
      b = 224;
    }
    if (Math.abs(nx - 0.3) < 0.06 && Math.abs(ny + 0.18) < 0.18) {
      r = 255;
      g = 126;
      b = 161;
    }
  }
  return [clamp(r), clamp(g), clamp(b), a];
});

await writeFile(new URL("hero-console.png", outDir), hero);
await writeFile(new URL("hero-anime-cover.png", outDir), animeCover);
await writeFile(new URL("avatar-sigil.png", outDir), avatar);
