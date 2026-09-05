import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";
import sharp from "sharp";
import { chainAtlas, chainLinkPitch, chainMaterialCell, createTitleChainMaterial } from "../src/themes/kisara/lib/titleChainMaterial.ts";
import { rasterChainTile } from "../scripts/lib/kisara-chain-raster.mjs";

const asset = fileURLToPath(new URL("../public/themes/kisara/assets/title-chain-steel.webp", import.meta.url));
const home = readFileSync(new URL("../src/themes/kisara/pages/HomePage.astro", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/themes/kisara/styles/home.css", import.meta.url), "utf8");

test("chain atlas is bounded, lossless, and reproducible from the source geometry", async () => {
  const metadata = await sharp(asset).metadata();
  assert.equal(metadata.width, chainAtlas.cellWidth * chainAtlas.steps);
  assert.equal(metadata.height, chainAtlas.cellHeight * 4);
  assert.ok(statSync(asset).size < 110_000);
  assert.ok(metadata.width! * metadata.height! * 4 < 4 * 1024 * 1024);
  for (const edgeOn of [false, true]) {
    for (const arc of ["near", "far"] as const) {
      for (const heat of [0, 0.5, 1]) {
        const cell = chainMaterialCell(heat, edgeOn, arc);
        const pixels = await sharp(asset).extract({ left: cell.x, top: cell.y, width: cell.width, height: cell.height }).raw().toBuffer();
        const expected = rasterChainTile(heat, edgeOn, arc === "near");
        for (let i = 0; i < pixels.length; i += 4) {
          assert.equal(pixels[i + 3], expected[i + 3]);
          // RGB under fully transparent WebP pixels is intentionally unspecified.
          if (expected[i + 3] === 0) continue;
          for (let channel = 0; channel < 3; channel++) {
            assert.equal(pixels[i + channel], expected[i + channel], `material ${heat}/${edgeOn}/${arc}, pixel ${i / 4}`);
          }
        }
      }
    }
  }
});

test("all heat states retain the exact opaque wire and hollow aperture", () => {
  for (const edgeOn of [false, true]) {
    for (const near of [false, true]) {
      const cold = rasterChainTile(0, edgeOn, near);
      let opaque = 0;
      let bright = 0;
      for (let step = 0; step < chainAtlas.steps; step++) {
        const tile = rasterChainTile(step / (chainAtlas.steps - 1), edgeOn, near);
        for (let i = 0; i < tile.length; i += 4) {
          assert.equal(tile[i + 3], cold[i + 3]);
          if (step === 0 && tile[i + 3] === 255) opaque++;
          if (step === 16 && tile[i + 1] > 140 && tile[i + 3] === 255) bright++;
        }
        const center = (chainAtlas.cellHeight / 2 * chainAtlas.cellWidth + chainAtlas.cellWidth / 2) * 4;
        assert.equal(tile[center + 3], 0);
      }
      assert.ok(opaque > 350);
      // Even the heated material keeps pale metal reflections.
      if (near === edgeOn) assert.ok(bright > 5);
    }
  }
});

test("near and far material halves never overpaint each other's wire", () => {
  for (const edgeOn of [false, true]) {
    const far = rasterChainTile(0, edgeOn, false);
    const near = rasterChainTile(0, edgeOn, true);
    for (let i = 3; i < far.length; i += 4) {
      assert.ok(far[i] === 0 || near[i] === 0);
    }
  }
});

test("edge-on links preserve wire thickness instead of squashing the entire link", () => {
  const widths = [false, true].map((edgeOn) => {
    const top = rasterChainTile(0, edgeOn, edgeOn);
    const column = chainAtlas.cellWidth / 2;
    let covered = 0;
    for (let y = 0; y < chainAtlas.cellHeight / 2; y++) {
      if (top[(y * chainAtlas.cellWidth + column) * 4 + 3] > 128) covered++;
    }
    return covered;
  });
  assert.ok(widths[0] >= 10);
  assert.ok(Math.abs(widths[0] - widths[1]) <= 1);
});

test("heat cells stay in bounds and change monotonically", () => {
  let previous = -1;
  for (let index = -100; index < 1200; index++) {
    const cell = chainMaterialCell(index / 1000, true, "near");
    assert.ok(cell.x >= previous);
    assert.ok(cell.x >= 0 && cell.x <= 16 * chainAtlas.cellWidth);
    assert.equal(cell.y, 3 * chainAtlas.cellHeight);
    previous = cell.x;
  }
  assert.equal(chainMaterialCell(NaN, false, "far").x, 0);
});

function fixture() {
  const previousImage = Object.getOwnPropertyDescriptor(globalThis, "Image");
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const timers = new Map<number, Function>();
  let id = 0;
  const images: FakeImage[] = [];
  class FakeImage extends EventTarget {
    decoding = "";
    naturalWidth = 0;
    sources: string[] = [];
    removed = false;
    constructor() { super(); images.push(this); }
    set src(value: string) { this.sources.push(value); }
    removeAttribute() { this.removed = true; }
  }
  Object.defineProperty(globalThis, "Image", { configurable: true, value: FakeImage });
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    setTimeout(callback: Function, delay: number) {
      assert.equal(delay, 1800);
      timers.set(++id, callback);
      return id;
    },
    clearTimeout(id: number) { timers.delete(id); }
  } });
  const controller = new AbortController();
  const material = createTitleChainMaterial(controller.signal);
  const draws: unknown[][] = [];
  const lines: number[] = [];
  const context = {
    globalAlpha: 0.35,
    lineWidth: 0,
    save() {}, restore() {}, scale() {}, beginPath() {}, ellipse() {}, lineTo() {},
    stroke() { lines.push(this.lineWidth); },
    drawImage(...args: unknown[]) { draws.push(args); }
  } as unknown as CanvasRenderingContext2D;
  return {
    material, controller, image: images[0], timers, context, draws, lines,
    restore() {
      controller.abort();
      if (previousImage) Object.defineProperty(globalThis, "Image", previousImage);
      else Reflect.deleteProperty(globalThis, "Image");
      if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
      else Reflect.deleteProperty(globalThis, "window");
    }
  };
}

test("one atlas request serves every arc, heat state, and repeat without alpha crossfades", () => {
  const f = fixture();
  try {
    assert.equal(f.image.sources.length, 0);
    f.material.prepare();
    f.material.prepare();
    assert.deepEqual(f.image.sources, [chainAtlas.url]);
    assert.equal(f.material.visibility(100), 0);
    f.image.naturalWidth = 2448;
    f.image.dispatchEvent(new Event("load"));
    assert.equal(f.timers.size, 0);
    assert.equal(f.material.visibility(100), 0);
    assert.equal(f.material.visibility(160), 0.5);
    assert.equal(f.material.visibility(220), 1);
    for (const heat of [0, 0.2, 0.5, 0.85, 1]) {
      f.material.draw(f.context, 36, false, "near", heat);
    }
    assert.equal(f.draws.length, 5);
    assert.equal(f.context.globalAlpha, 0.35);
    assert.equal(f.lines.length, 0);
    f.material.draw(f.context, 36, true, "full", 0.5);
    assert.equal(f.draws.length, 7);
    assert.equal(f.material.visibility(10000), 1);
  } finally { f.restore(); }
});

test("failed and stalled material requests use the solid fallback with bounded waiting", () => {
  for (const outcome of ["error", "timeout"]) {
    const f = fixture();
    try {
      f.material.prepare();
      if (outcome === "error") f.image.dispatchEvent(new Event("error"));
      else [...f.timers.values()][0]();
      assert.equal(f.timers.size, 0);
      f.material.visibility(100);
      assert.equal(f.material.visibility(220), 1);
      f.material.draw(f.context, 36, true, "full", 1);
      assert.equal(f.draws.length, 0);
      assert.deepEqual(f.lines, [chainAtlas.wire, chainAtlas.wire]);
      f.image.naturalWidth = 2448;
      f.image.dispatchEvent(new Event("load"));
      f.material.draw(f.context, 36, false, "near", 1);
      assert.equal(f.draws.length, 0);
    } finally { f.restore(); }
  }
});

test("aborting before or after decode releases media, listeners, and pending work", () => {
  for (const loaded of [false, true]) {
    const f = fixture();
    try {
      f.material.prepare();
      if (loaded) {
        f.image.naturalWidth = 2448;
        f.image.dispatchEvent(new Event("load"));
      }
      f.controller.abort();
      assert.equal(f.timers.size, 0);
      assert.equal(f.image.removed, true);
      f.image.naturalWidth = 2448;
      f.image.dispatchEvent(new Event("load"));
      f.material.prepare();
      f.material.draw(f.context, 36, false, "full", 0.5);
      assert.equal(f.draws.length, 0);
      assert.equal(f.lines.length, 0);
      assert.equal(f.image.sources.length, 1);
    } finally { f.restore(); }
  }
});

test("production weave paths keep equal spacing, parity, buried tails, and stable release geometry", () => {
  const source = home.slice(home.indexOf("const chainDefinitions ="), home.indexOf("const drawChainLinkArc ="));
  for (const width of [390, 720, 1200]) {
    const box = { left: width * 0.32, top: 70, width, height: width * 0.22 };
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    const scope = vm.runInNewContext(`${source}; ({ chainDefinitions, resolveTitleChainPath, buildTitleChainLinkUnits, getChainLinkDimensions })`, {
      chainTitleBox: box,
      chainGlyphLayout: { gaps: [], anchorBounds: [], textLeft: 0, textRight: 0 },
      chainLinkUnitCache: new Map(),
      mobilePerformance: false,
      velocity: 0, burstVelocity: 0,
      fullTurn: Math.PI * 2,
      clamp, chainLinkPitch,
      phaseProgress: (value: number, start: number, end: number) => clamp((value - start) / (end - start), 0, 1),
      easeOutCubic: (value: number) => 1 - (1 - value) ** 3,
      smootherstep: (value: number) => value ** 3 * (value * (value * 6 - 15) + 10)
    });
    for (const definition of scope.chainDefinitions) {
      const path = scope.resolveTitleChainPath(definition, 1, 0);
      const release = scope.resolveTitleChainPath(definition, 1, 0.3);
      assert.deepEqual(path.points, release.points);
      const spacing = scope.buildTitleChainLinkUnits(definition, width < 420);
      const core = spacing.records.filter((record: { distanceUnit: number }) => record.distanceUnit >= 0 && record.distanceUnit <= 1);
      const step = 1 / (core.length - 1);
      for (let i = 1; i < core.length; i++) {
        assert.ok(Math.abs(core[i].distanceUnit - core[i - 1].distanceUnit - step) < 1e-9);
      }
      assert.equal((spacing.records.length - core.length) % 2, 0);
      const sourceTip = definition.direction > 0 ? spacing.records[0].distanceUnit : spacing.records.at(-1).distanceUnit - 1;
      assert.ok(Math.abs(sourceTip) >= definition.entryOverscan);
      const destination = definition.direction > 0 ? path.points.at(-1).x : path.points[0].x;
      assert.ok(destination > box.left && destination < box.left + width);
      assert.equal(scope.buildTitleChainLinkUnits(definition, width < 420), spacing);
    }
  }
});

test("chain integration retains motion boundaries without live material construction or layer filters", () => {
  const render = home.slice(home.indexOf("const drawChainLinkArc ="), home.indexOf("const drawChainLayer ="));
  assert.doesNotMatch(render, /createLinearGradient|shadowBlur|context\.ellipse|coldSprite|hotSprite|verticalProfile/);
  assert.match(home, /mobilePerformance \? null : createTitleChainMaterial\(signal\)/);
  assert.match(home, /const visibility = activation \* introFade \* burstFade;/);
  assert.match(render, /alpha \* chainMaterialVisibility/);
  assert.match(home, /const centerDissolve = phaseProgress\(intro, 0\.16, 0\.5\)/);
  assert.match(home, /const localPull = 0/);
  assert.match(home, /outside - 0\.04\) \/ 0\.36/);
  for (const side of ["back", "front"]) {
    const rule = styles.match(new RegExp(`\\.kisara-title-chain-canvas-${side} \\{([^}]+)\\}`))![1];
    assert.doesNotMatch(rule, /filter/);
  }
});
