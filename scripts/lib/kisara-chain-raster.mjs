import { chainAtlas } from "../../src/themes/kisara/lib/titleChainMaterial.ts";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const geometry = new Map();
const normalize = (vector) => {
  const length = Math.hypot(...vector);
  return vector.map((value) => value / length);
};
const key = normalize([-0.38, -0.64, 0.67]);
const fill = normalize([0.62, 0.5, 0.4]);
const half = normalize([key[0], key[1], key[2] + 1]);
const dot = (normal, light) => Math.max(0, normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2]);

function profileGeometry(edgeOn) {
  if (geometry.has(edgeOn)) return geometry.get(edgeOn);
  const { cellWidth: width, cellHeight: height, wire, connectorProjection } = chainAtlas;
  const scale = width / chainAtlas.width;
  const radius = (chainAtlas.linkHeight - wire) / 2;
  const straight = (chainAtlas.linkWidth - chainAtlas.linkHeight) / 2;
  const tube = wire / 2;
  const projection = edgeOn ? connectorProjection : 1;
  const points = [];
  const steps = 96;
  for (let index = 0; index < steps; index++) {
    const angle = index / steps * Math.PI * 2;
    const cosine = Math.cos(angle);
    points.push({
      x: (cosine < 0 ? -straight : straight) + radius * cosine,
      y: radius * Math.sin(angle) * projection
    });
  }
  const pixels = new Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = (x + 0.5) / scale - chainAtlas.width / 2;
      const py = (y + 0.5) / scale - chainAtlas.height / 2;
      let distanceSquared = Infinity;
      let nearestX = 0;
      let nearestY = 0;
      for (let index = 0; index < points.length; index++) {
        const a = points[index];
        const b = points[(index + 1) % points.length];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const t = clamp(((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy));
        const qx = a.x + t * dx;
        const qy = a.y + t * dy;
        const squared = (px - qx) ** 2 + (py - qy) ** 2;
        if (squared < distanceSquared) {
          distanceSquared = squared;
          nearestX = qx;
          nearestY = qy;
        }
      }
      const distance = Math.sqrt(distanceSquared);
      const coverage = clamp((tube - distance) * scale + 0.5);
      if (coverage === 0) continue;
      const nx = (px - nearestX) / tube;
      const ny = (py - nearestY) / tube;
      const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, distance / tube) ** 2));
      const normal = [nx, ny, nz];
      const keyLight = dot(normal, key);
      const fillLight = dot(normal, fill);
      const grain = (Math.sin(x * 17.13 + y * 43.77) * 43758.5453) % 1;
      const cavity = Math.sign(py) * (py - nearestY) < 0 ? 0.88 : 1;
      const body = (36 + keyLight * 54 + fillLight * 14 + grain * 1.4) * cavity;
      const specular = Math.pow(dot(normal, half), 22) * 117;
      const edgeWear = Math.pow(dot(normal, half), 5) * 7;
      pixels[y * width + x] = {
        coverage, body, specular, edgeWear,
        near: (nearestY >= 0) !== edgeOn
      };
    }
  }
  geometry.set(edgeOn, pixels);
  return pixels;
}

export function rasterChainTile(heat, edgeOn, near) {
  const pixels = profileGeometry(edgeOn);
  const output = Buffer.alloc(chainAtlas.cellWidth * chainAtlas.cellHeight * 4);
  const blend = clamp(heat);
  for (let index = 0; index < pixels.length; index++) {
    const pixel = pixels[index];
    if (!pixel || pixel.near !== near) continue;
    const alpha = Math.round(pixel.coverage * 255);
    if (alpha === 0) continue;
    const { body, specular, edgeWear } = pixel;
    const oxide = blend * (1 - clamp(specular / 117) * 0.85);
    const color = [
      body * (0.9 + oxide * 0.24) + specular + edgeWear,
      body * (0.98 - oxide * 0.57) + specular * 0.98 + edgeWear * (1 - oxide * 0.36),
      body * (1.04 - oxide * 0.56) + specular + edgeWear * (1 - oxide * 0.32)
    ];
    for (let channel = 0; channel < 3; channel++) output[index * 4 + channel] = Math.round(clamp(color[channel], 0, 255));
    output[index * 4 + 3] = alpha;
  }
  return output;
}
