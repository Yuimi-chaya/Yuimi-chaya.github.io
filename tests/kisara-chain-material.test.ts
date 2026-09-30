import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";
import sharp from "sharp";
import { chainAtlas, chainLinkPitch, chainMaterialCell, chainOccludedBrightness, createTitleChainMaterial } from "../src/themes/kisara/lib/titleChainMaterial.ts";
import { rasterChainTile } from "../scripts/lib/kisara-chain-raster.mjs";
import { buildTitleChainRig, fitTitleChainConnector, orientTitleChainRing, partitionTitleChainRing, sampleTitleChainCurve, titleChainDefinitions } from "../src/themes/kisara/lib/titleChainRig.ts";

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
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const timers = new Map<number, Function>();
  let id = 0;
  const images: FakeImage[] = [];
  const shadowCalls: unknown[][] = [];
  const shadowContext = {
    globalCompositeOperation: "source-over", fillStyle: "",
    drawImage(...args: unknown[]) { shadowCalls.push(["image", ...args]); },
    fillRect(...args: number[]) { shadowCalls.push(["fill", this.globalCompositeOperation, this.fillStyle, ...args]); }
  };
  const shadowCanvas = { width: 0, height: 0, getContext: () => shadowContext };
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    createElement(tag: string) { assert.equal(tag, "canvas"); return shadowCanvas; }
  } });
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
    material, controller, image: images[0], timers, context, draws, lines, shadowCanvas, shadowCalls,
    restore() {
      controller.abort();
      if (previousImage) Object.defineProperty(globalThis, "Image", previousImage);
      else Reflect.deleteProperty(globalThis, "Image");
      if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
      else Reflect.deleteProperty(globalThis, "window");
      if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
      else Reflect.deleteProperty(globalThis, "document");
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

test("occluded links reuse an alpha-preserving shadow cache across heat states and release it on abort", () => {
  const f = fixture();
  try {
    f.material.prepare();
    f.image.naturalWidth = 2448;
    f.image.dispatchEvent(new Event("load"));
    assert.deepEqual([f.shadowCanvas.width, f.shadowCanvas.height], [1224, 192]);
    assert.ok(f.shadowCanvas.width * f.shadowCanvas.height * 4 < 1024 * 1024);
    assert.equal(f.shadowCalls.length, 2);
    assert.equal(f.shadowCalls[1][1], "source-atop");
    assert.equal(f.shadowCalls[1][2], `rgba(0,0,0,${1 - chainOccludedBrightness})`);
    for (const heat of [0, .5, 1]) {
      f.material.draw(f.context, 36, false, "near", heat, true);
      const draw = f.draws.at(-1)!;
      const cell = chainMaterialCell(heat, false, "near");
      assert.equal(draw[0], f.shadowCanvas);
      assert.deepEqual(draw.slice(1, 5), [cell.x / 2, cell.y / 2, cell.width / 2, cell.height / 2]);
      assert.equal(f.context.globalAlpha, .35, "Occlusion changes RGB, not opacity");
    }
    f.material.draw(f.context, 36, false, "near", 1, false);
    assert.equal(f.draws.at(-1)![0], f.image);
    f.image.dispatchEvent(new Event("load"));
    assert.equal(f.shadowCalls.length, 2, "Repeated load or paint cannot recreate the cache");
    assert.deepEqual(f.image.sources, [chainAtlas.url]);
    f.controller.abort();
    assert.deepEqual([f.shadowCanvas.width, f.shadowCanvas.height], [0, 0]);
  } finally { f.restore(); }
});

test("shadow-cache allocation failure keeps the atlas usable and failed media still has a dark fallback", () => {
  const f = fixture();
  try {
    f.shadowCanvas.getContext = () => { throw new Error("No extra canvas"); };
    f.material.prepare();
    f.image.naturalWidth = 2448;
    f.image.dispatchEvent(new Event("load"));
    f.material.draw(f.context, 36, false, "near", 0, true);
    assert.equal(f.draws[0][0], f.image);
  } finally { f.restore(); }
  const failed = fixture();
  try {
    failed.material.prepare();
    failed.image.dispatchEvent(new Event("error"));
    failed.material.draw(failed.context, 36, false, "near", 0, true);
    assert.equal(failed.context.strokeStyle, "rgb(46,50,54)");
    assert.equal(failed.context.globalAlpha, .35);
  } finally { failed.restore(); }
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

function geometryFixture(width: number, height = width * 0.22, customGaps?: number[]) {
  const source = home.slice(home.indexOf("const chainDefinitions ="), home.indexOf("const drawChainLinkArc ="))
    + home.slice(home.indexOf("const drawTitleChains ="), home.indexOf("const drawEnergy ="));
  const box = { left: width * 0.32, top: 70, width, height };
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const state = {
    chainTitleBox: box,
    chainGlyphLayout: {
      gaps: customGaps?.map(value => box.left + width * value) ?? [],
      anchorBounds: [], textLeft: 0, textRight: 0
    },
    chainLinkUnitCache: new Map(),
    chainRig: null,
    drawChainCrossings() {},
    composeTitleChains: () => true,
    gate: { style: { getPropertyValue: () => "1" } },
    buildTitleChainRig, fitTitleChainConnector, orientTitleChainRing, partitionTitleChainRing, sampleTitleChainCurve, titleChainDefinitions,
    mobilePerformance: false,
    velocity: 0, burstVelocity: 0,
    fullTurn: Math.PI * 2,
    clamp, chainLinkPitch,
    phaseProgress: (value: number, start: number, end: number) => clamp((value - start) / (end - start), 0, 1),
    easeOutCubic: (value: number) => 1 - (1 - value) ** 3,
    smootherstep: (value: number) => value ** 3 * (value * (value * 6 - 15) + 10)
  };
  const scope = vm.runInNewContext(`${source}; ({
    chainDefinitions, resolveTitleChainPath, buildTitleChainLinkUnits, getChainLinkDimensions,
    sampleTitleChain, sampleTitleChainTravel, drawTitleChains
  })`, state);
  return { scope, state, box };
}

test("production weave paths keep equal spacing, parity, buried tails, and stable release geometry", () => {
  for (const width of [390, 720, 1200]) {
    const { scope, box } = geometryFixture(width);
    for (const definition of scope.chainDefinitions) {
      const path = scope.resolveTitleChainPath(definition, 1, 0);
      const release = scope.resolveTitleChainPath(definition, 1, 0.3);
      assert.deepEqual(path.points, release.points);
      const spacing = scope.buildTitleChainLinkUnits(definition, width < 420);
      const core = spacing.records.filter((record: { distanceUnit: number }) => record.distanceUnit >= 0 && record.distanceUnit <= 1);
      const step = 1 / (core.length - 1);
      assert.ok(spacing.totalLength * step <= chainLinkPitch(scope.getChainLinkDimensions(definition).width, width < 420) + 1e-6,
        "N gaps need N+1 rings; the count must not silently stretch the pitch");
      for (let i = 1; i < core.length; i++) {
        assert.ok(Math.abs(core[i].distanceUnit - core[i - 1].distanceUnit - step) < 1e-9);
      }
      assert.equal((spacing.records.length - core.length) % 2, 0);
      const sourceTip = definition.direction > 0 ? spacing.records[0].distanceUnit : spacing.records.at(-1).distanceUnit - 1;
      assert.ok(Math.abs(sourceTip) >= spacing.entryOverscan);
      assert.ok(spacing.entryOverscan * spacing.totalLength >= definition.entryOverscan * width * 1.5 - 1e-6);
      const destination = definition.direction > 0 ? path.points.at(-1).x : path.points[0].x;
      assert.ok(destination > box.left && destination < box.left + width);
      assert.equal(scope.buildTitleChainLinkUnits(definition, width < 420), spacing);
    }
  }
});

test("chain integration retains motion boundaries without live material construction or layer filters", () => {
  const render = home.slice(home.indexOf("const drawChainLinkArc ="), home.indexOf("const drawChainLayer ="));
  assert.doesNotMatch(render, /createLinearGradient|shadowBlur|context\.ellipse|coldSprite|hotSprite|verticalProfile/);
  assert.doesNotMatch(render, /variantSeed|41011/);
  assert.match(render, /const size = scale;/);
  assert.match(home, /mobilePerformance \? null : createTitleChainMaterial\(signal\)/);
  assert.match(home, /const visibility = activation \* introFade \* burstFade;/);
  assert.match(render, /alpha \* chainMaterialVisibility/);
  assert.match(home, /const centerDissolve = phaseProgress\(intro, 0\.16, 0\.5\)/);
  assert.match(home, /chainRig \?\?= buildTitleChainRig/);
  assert.match(home, /outside - 0\.04\) \/ 0\.36/);
  for (const side of ["back", "front"]) {
    const rule = styles.match(new RegExp(`\\.kisara-title-chain-canvas-${side} \\{([^}]+)\\}`))![1];
    assert.doesNotMatch(rule, /filter/);
  }
});

test("asymmetric chains keep a sparse local clasp and the right chain returns to the right", () => {
  for (const width of [320, 390, 720, 1200, 1920]) {
    for (const ratio of [0.18, 0.22, 0.3]) {
      const { scope, box, state } = geometryFixture(width, width * ratio);
      assert.equal(scope.chainDefinitions.length, 3);
      for (const definition of scope.chainDefinitions) {
        const path = scope.resolveTitleChainPath(definition, 1, 0);
        assert.equal(scope.resolveTitleChainPath(definition, 0.5, 0.2), path, "The rig is not rebuilt during playback");
        const points = [];
        for (let i = 0; i <= 300; i++) {
          const sample = scope.sampleTitleChain(definition, path, i / 300, 1, 0, 5000);
          points.push(sample);
          assert.ok(Number.isFinite(sample.x + sample.y + sample.angle));
        }
        if (definition.route === "right-clasp") {
          assert.equal(path.segmentCount, 5);
          assert.equal(points[0].plane, "back");
          assert.equal(points.at(-1).plane, "front");
          const counter = (state.chainRig as any).counter;
          const hole = scope.sampleTitleChain(definition, path, path.counterUnit, 1, 0, 0);
          assert.ok(Math.hypot(hole.x - counter.x, hole.y - counter.y) < box.height * 0.004);
          assert.equal(hole.crossing, false, "A complete ring owns the glyph passage");
          const ingress = points.slice(240);
          for (let i = 1; i < ingress.length; i++) {
            assert.ok(ingress[i].x > ingress[i - 1].x && ingress[i].y > ingress[i - 1].y,
              "The source approaches the counter directly, without an extra crest");
          }
          assert.ok(ingress.some(point => point.plane === "back"),
            "The outgoing first-a stem passage belongs behind the title");
          assert.equal(points.at(-1).plane, "front", "The source emerges beyond the first a");
          assert.ok(path.points[2].x > path.points[3].x, "The central path turns back locally");
          assert.ok(path.points[2].x - path.points[3].x < box.width * 0.2, "The return cannot become the whole composition");
          const tail = points[0];
          assert.ok(tail.x > counter.x + box.width * 0.25 && tail.x < box.left + box.width,
            "After clasping, the leading end wraps back across the right letters");
          assert.ok(Math.min(...points.map(point => point.x)) > counter.x - box.width * 0.12,
            "The right chain cannot travel back into the left weave");
        }
      }
      const crossings = (state.chainRig as any).crossings;
      assert.ok(crossings.length <= 5, "Do not restore a dense central tangle");
      assert.ok(crossings.every((point: any) => point.ids[0] !== point.ids[1]));
      for (const pair of ["0,1", "0,2"]) {
        assert.equal(crossings.filter((point: any) => point.ids.join(",") === pair).length, 2);
      }
      for (const crossing of crossings) {
        const samples = crossing.ids.map((id: number, arm: number) => {
          const definition = scope.chainDefinitions[id];
          return scope.sampleTitleChain(definition, scope.resolveTitleChainPath(definition, 1, 0),
            crossing.units[arm], 1, 0, 0);
        });
        assert.equal(crossing.ids[crossing.overIndex], crossing.overId);
        if (samples[0].plane !== samples[1].plane) {
          assert.equal(samples[crossing.overIndex].plane, "front");
        }
      }
    }
  }
});

test("the rig follows measured glyph gaps and font/layout cache invalidation", () => {
  const { scope, state, box } = geometryFixture(960, 205, [0.23, 0.33, 0.49, 0.68, 0.82]);
  const first = scope.resolveTitleChainPath(scope.chainDefinitions[2], 1, 0);
  const firstCounterX = (state.chainRig as any).counter.x;
  const firstSpacing = scope.buildTitleChainLinkUnits(scope.chainDefinitions[2], false);
  state.chainGlyphLayout.gaps = [0.2, 0.32, 0.47, 0.63, 0.8].map(value => box.left + box.width * value);
  state.chainRig = null;
  state.chainLinkUnitCache.clear();
  const updated = scope.resolveTitleChainPath(scope.chainDefinitions[2], 1, 0);
  assert.notEqual(updated, first);
  assert.notEqual(scope.buildTitleChainLinkUnits(scope.chainDefinitions[2], false), firstSpacing);
  assert.ok((state.chainRig as any).counter.x < firstCounterX);
  const rebuild = home.slice(home.indexOf("const rebuildTitleChainLayout ="), home.indexOf("const resizeTitleChains ="));
  assert.ok(rebuild.includes("chainRig = null;") && rebuild.includes("chainLinkUnitCache.clear();"));
});

test("hand-authored tangents stay continuous while the left sweeps differ in span and rhythm", () => {
  const { scope } = geometryFixture(1200);
  const paths = scope.chainDefinitions.slice(0, 2).map((definition: any) => scope.resolveTitleChainPath(definition, 1, 0));
  assert.notDeepEqual(paths[0].points, paths[1].points);
  assert.equal(paths[0].curves.length, 5);
  assert.equal(paths[1].curves.length, 3);
  for (const definition of scope.chainDefinitions) {
    const path = scope.resolveTitleChainPath(definition, 1, 0);
    for (let i = 1; i < path.curves.length; i++) {
      const boundary = i / path.curves.length;
      const before = scope.sampleTitleChain(definition, path, boundary - 1e-6, 1, 0, 0);
      const after = scope.sampleTitleChain(definition, path, boundary + 1e-6, 1, 0, 0);
      assert.ok(Math.abs(Math.atan2(Math.sin(before.angle - after.angle), Math.cos(before.angle - after.angle))) < 0.0002);
    }
  }
});

test("the long left chain turns back into s while the right return stays behind r and the last a", () => {
  const { scope, box } = geometryFixture(1200);
  const left = scope.resolveTitleChainPath(scope.chainDefinitions[0], 1, 0);
  assert.ok(left.points.at(-1).x < left.points.at(-2).x - box.width * .08);
  assert.ok(left.points.at(-1).y > box.top + box.height * .8);
  const right = scope.resolveTitleChainPath(scope.chainDefinitions[2], 1, 0);
  for (let i = 0; i <= 40; i++) {
    const sample = sampleTitleChainCurve(right, i / 100);
    assert.equal(sample.plane, sample.x >= right.glyphBackZones[0].left ? "back" : "front");
  }
  assert.ok(home.includes("arcPart, heat, occluded"));
});

test("a measured counter owns the right chain's front-to-back passage rather than a generic wave boundary", () => {
  const { scope, state, box } = geometryFixture(1200);
  const counter = { x: box.left + box.width * 0.545, y: box.top + box.height * 0.73, radiusX: 21, radiusY: 23 };
  Object.assign(state.chainGlyphLayout, { counter });
  const definition = scope.chainDefinitions[2];
  const path = scope.resolveTitleChainPath(definition, 1, 0);
  assert.deepEqual(path.points[4], { x: counter.x, y: counter.y });
  const hole = scope.sampleTitleChain(definition, path, path.counterUnit, 1, 0, 0);
  const center = sampleTitleChainCurve(path, path.counterUnit);
  assert.ok(Math.hypot(center.x - counter.x, center.y - counter.y) < 0.001);
  assert.ok(Math.hypot(hole.x - counter.x, hole.y - counter.y) < Math.min(counter.radiusX, counter.radiusY) * 0.1);
  assert.equal(hole.crossing, false);
  assert.equal(hole.plane, "front", "The entering ring cannot disappear behind the letter inside its opening");
  assert.equal(path.counterUnit, 4 / 5);
  assert.ok(home.includes("counter: measureTitleChainCounter(chainCounterContext, style, glyphBounds[3])"));
});

test("the local clasp closes its sides without moving the measured aperture", () => {
  for (const width of [390, 720, 1200]) {
    const { scope, box } = geometryFixture(width);
    const path = scope.resolveTitleChainPath(scope.chainDefinitions[2], 1, 0);
    const glyphWidth = box.width * (.64 - .47);
    const counterHandle = path.curves[4][1].x - path.points[4].x;
    assert.ok(counterHandle > 0 && counterHandle <= glyphWidth * .4);
    const thickness = scope.getChainLinkDimensions(scope.chainDefinitions[0]).width
      * 1.16 * chainAtlas.linkHeight / chainAtlas.linkWidth;
    assert.ok(path.points[2].x - path.points[3].x <= glyphWidth * .18 + thickness * .5 + 1e-8,
      "The compact return includes the painted body at its inward bend");
    const left = scope.resolveTitleChainPath(scope.chainDefinitions[0], 1, 0);
    assert.ok(left.points[4].x - (box.left + box.width * .47) <= glyphWidth * .5);
  }
});

test("the cinched return keeps its two crossings and front-plane ownership", () => {
  for (const width of [320, 390, 720, 1200, 1920]) {
    for (const ratio of [.18, .22, .3]) {
      const { scope, state, box } = geometryFixture(width, width * ratio);
      const left = scope.resolveTitleChainPath(scope.chainDefinitions[0], 1, 0);
      const right = scope.resolveTitleChainPath(scope.chainDefinitions[2], 1, 0);
      const glyphLeft = box.left + box.width * .47;
      const glyphWidth = box.width * (.64 - .47);
      if (width >= 720) {
        assert.ok(left.points[3].x <= glyphLeft + glyphWidth * .181,
          "The upper left shoulder must pull away from the loose outer arc");
        assert.ok(left.points[4].x <= glyphLeft + glyphWidth * .241,
          "The lower left shoulder must follow the same tightened return");
      }
      assert.ok(Math.hypot(right.points[4].x - (state.chainRig as any).counter.x,
        right.points[4].y - (state.chainRig as any).counter.y) < 1e-8);
      const clasp = (state.chainRig as any).crossings.filter((point: any) => point.ids.join(",") === "0,2");
      assert.equal(clasp.length, 2, "Tightening cannot create an extra chain intersection");
      for (const crossing of clasp) {
        const a = sampleTitleChainCurve(left, crossing.units[0]);
        const b = sampleTitleChainCurve(right, crossing.units[1]);
        assert.equal(a.plane, "front");
        assert.equal(b.plane, "front");
      }
    }
  }
});

test("the right return hooks inside the left return and keeps a flat counter exit", () => {
  for (const width of [1100, 1200, 1920]) {
    const { scope } = geometryFixture(width);
    const left = scope.resolveTitleChainPath(scope.chainDefinitions[0], 1, 0);
    const right = scope.resolveTitleChainPath(scope.chainDefinitions[2], 1, 0);
    assert.ok(right.points[3].x < left.points[3].x,
      "The inner bend must enter the left loop instead of touching its outer edge");
    assert.ok(right.points[3].y > left.points[3].y && right.points[3].y < left.points[4].y,
      "The right hook folds inside the left loop's vertical opening");
    const exit = sampleTitleChainCurve(right, right.counterUnit);
    assert.ok(Math.abs(exit.tangentY / exit.tangentX) < .2,
      "The counter return leaves nearly horizontally instead of dipping into another loose arc");
  }
});

test("the hooked bend reserves the painted link thickness instead of just crossing centerlines", () => {
  for (const width of [320, 390, 720, 1100, 1200, 1920]) {
    for (const ratio of [.18, .22, .3]) {
      const { scope, box } = geometryFixture(width, width * ratio);
      const left = scope.resolveTitleChainPath(scope.chainDefinitions[0], 1, 0);
      const right = scope.resolveTitleChainPath(scope.chainDefinitions[2], 1, 0);
      const glyphLeft = box.left + width * .47;
      const glyphWidth = width * .17;
      const thickness = Math.max(
        scope.getChainLinkDimensions(scope.chainDefinitions[0]).width,
        scope.getChainLinkDimensions(scope.chainDefinitions[2]).width
      ) * 1.16 * chainAtlas.linkHeight / chainAtlas.linkWidth;
      const inset = Math.min(thickness * .5, glyphWidth * .095);
      assert.ok(Math.abs(right.points[3].x - (glyphLeft + glyphWidth * .13 - inset)) < 1e-8,
        "The inward hook must offset the actual painted half-width, with a narrow-glyph limit");
      assert.ok(right.points[3].x > glyphLeft);
      assert.ok(right.points[3].x < left.points[3].x);
      assert.ok(right.points[3].y > left.points[3].y && right.points[3].y < left.points[4].y);
    }
  }
});

test("the local clasp tolerates different measured counter positions without growing extra crossings", () => {
  for (const x of [0.515, 0.54, 0.58, 0.6]) {
    for (const y of [0.7, 0.78, 0.82]) {
      const { scope, state, box } = geometryFixture(1100);
      const counter = { x: box.left + box.width * x, y: box.top + box.height * y, radiusX: 20, radiusY: 25 };
      Object.assign(state.chainGlyphLayout, { counter });
      const path = scope.resolveTitleChainPath(scope.chainDefinitions[2], 1, 0);
      const clasp = (state.chainRig as any).crossings.filter((point: any) => point.ids.join(",") === "0,2");
      assert.equal(clasp.length, 2);
      assert.deepEqual(clasp.map((point: any) => point.overId), [2, 0]);
      const left = scope.resolveTitleChainPath(scope.chainDefinitions[0], 1, 0);
      for (const crossing of clasp) {
        const a = sampleTitleChainCurve(left, crossing.units[0]);
        const b = sampleTitleChainCurve(path, crossing.units[1]);
        assert.equal(a.plane, "front");
        assert.equal(b.plane, "front");
      }
      assert.ok((state.chainRig as any).crossings.length <= 5);
      const center = sampleTitleChainCurve(path, path.counterUnit);
      assert.ok(Math.hypot(center.x - counter.x, center.y - counter.y) < 1e-8);
      assert.ok(path.points[0].x > counter.x + box.width * 0.25);
    }
  }
});

test("central shoulders and their control handles follow lowercase glyph bounds, not the capital-height box", () => {
  for (const lowercaseTop of [0.29, 0.4, 0.48]) {
    const { scope, state, box } = geometryFixture(1100, 270);
    const edges = [0, .23, .33, .49, .67, .81, 1];
    const glyphBounds = edges.slice(0, -1).map((left, i) => ({
      left: box.left + box.width * left,
      right: box.left + box.width * edges[i + 1],
      top: box.top + box.height * (i < 2 ? 0 : lowercaseTop),
      bottom: box.top + box.height * .94
    }));
    const glyph = glyphBounds[3];
    const counter = { x: glyph.left + (glyph.right - glyph.left) * .4,
      y: glyph.top + (glyph.bottom - glyph.top) * .73, radiusX: 20, radiusY: 22 };
    Object.assign(state.chainGlyphLayout, { glyphBounds, counter });
    const left = scope.resolveTitleChainPath(scope.chainDefinitions[0], 1, 0);
    const right = scope.resolveTitleChainPath(scope.chainDefinitions[2], 1, 0);
    for (const curve of [left.curves[2], ...right.curves.slice(1, 4)]) {
      for (const point of curve) {
        assert.ok(point.y >= glyph.top, "Bezier handles cannot lift the central wrap above the lowercase shoulder");
      }
    }
    assert.ok(right.points[2].y - glyph.top < (glyph.bottom - glyph.top) * .4,
      "The upper return stays above the local bite instead of being pinned to the loose glyph shoulder");
    assert.ok(right.points[2].x > glyph.left && right.points[2].x < glyph.right);
    assert.ok(right.points[3].x < left.points[3].x && right.points[3].x > glyph.left);
    const hole = sampleTitleChainCurve(right, right.counterUnit);
    assert.ok(Math.hypot(hole.x - counter.x, hole.y - counter.y) < 1e-8);
  }
});

test("cinching a narrow lowercase glyph never expands its return above the old shoulder", () => {
  for (const width of [320, 390]) {
    for (const lowercaseTop of [.29, .4, .48]) {
      const { scope, state, box } = geometryFixture(width, width * .18);
      const edges = [0, .23, .33, .49, .67, .81, 1];
      const glyphBounds = edges.slice(0, -1).map((left, index) => ({
        left: box.left + width * left, right: box.left + width * edges[index + 1],
        top: box.top + box.height * (index < 2 ? 0 : lowercaseTop),
        bottom: box.top + box.height * .94
      }));
      Object.assign(state.chainGlyphLayout, { glyphBounds });
      const path = scope.resolveTitleChainPath(scope.chainDefinitions[2], 1, 0);
      const glyph = glyphBounds[3];
      assert.ok(path.points[2].y >= glyph.top + (glyph.bottom - glyph.top) * .08 - 1e-8,
        "A tight mobile glyph cannot accommodate an expanded upper return");
      assert.equal((state.chainRig as any).crossings
        .filter((point: any) => point.ids.join(",") === "0,2").length, 2);
    }
  }
});

test("source fade distances stay far outside the word regardless of the authored curve length", () => {
  for (const width of [390, 720, 1200]) {
    const { scope, box } = geometryFixture(width);
    for (const definition of scope.chainDefinitions) {
      const path = scope.resolveTitleChainPath(definition, 0.5, 0);
      const spacing = scope.buildTitleChainLinkUnits(definition, width < 420);
      assert.equal(spacing.entryReferenceLength, width * 1.5);
      const distance = 0.22 * spacing.entryReferenceLength / spacing.totalLength;
      const unit = definition.direction > 0 ? -distance : 1 + distance;
      const sample = scope.sampleTitleChainTravel(definition, path, unit, spacing, 0.5, 0, 0);
      const margin = definition.direction > 0 ? box.left - sample.x : sample.x - box.left - width;
      assert.ok(margin >= width * 0.2, "Half-visible source links must still be well outside the word");
    }
  }
});

test("chain release keeps wire geometry stationary across timestamps and intro phases", () => {
  for (const width of [390, 720, 1200]) {
    const { scope } = geometryFixture(width);
    for (const definition of scope.chainDefinitions) {
      const path = scope.resolveTitleChainPath(definition, 1, 0);
      for (const unit of [.12, .3, .51, .68, .85]) {
        const baseline = scope.sampleTitleChain(definition, path, unit, 1, 0, 0);
        for (const intro of [0, .02, .08, .15, .26, .45]) {
          for (const timestamp of [0, 150, 380, 720, 1200, 5500]) {
            const actual = scope.sampleTitleChain(definition, path, unit, 1, intro, timestamp);
            assert.deepEqual(actual, baseline, "Release light and ash may move; the wire cannot shake");
          }
        }
      }
    }
  }
});

test("rendered links keep connected apertures and complementary depth fragments throughout scrolling and dissolution", () => {
  for (const width of [390, 720, 1200]) {
    const { scope, state, box } = geometryFixture(width);
    let records: any[] = [];
    const context = { setTransform() {}, clearRect() {} };
    const canvas = () => ({ width: width * 1.64, height: box.height + 140, style: { opacity: "0" } });
    Object.assign(state, {
      chainBackCanvas: canvas(), chainFrontCanvas: canvas(),
      titleDataMaskCanvas: { width: 128, height: 128 },
      chainMaskBox: { left: box.left, top: box.top, width: box.width, height: box.height },
      chainBackContext: context, chainFrontContext: context,
      chainCanvasWidth: width * 1.64, chainCanvasHeight: box.height + 140,
      titleDataCanvasWidth: width * 1.16,
      chainPixelRatio: 1, chainMaterial: { visibility: () => 1 }, chainMaterialVisibility: 1,
      chainLastPaintTimestamp: 0, chainLastPaintFill: -1, chainLastPaintIntro: -1,
      chargeIntroProgress: 0, burstProgress: 0,
      randomSeed: (value: number) => { const x = Math.sin(value) * 43758.5453; return x - Math.floor(x); },
      drawChainLayer: (_: unknown, layer: any[], isFront: boolean) => {
        assert.ok(layer.every(record => record.arcMode === "full"), "Near/far wire arcs are independent of glyph clipping");
        records.push(...layer.filter(record => record.alpha > 0.01).map(record => ({ ...record, paintPlane: isFront ? "front" : "back" })));
      },
      drawChainLeader() {}, drawTitleSealEtching() {}, drawChainShatterParticles() {}, drawChainRupture() {}, drawContractHeartImprint() {},
      clearTitleChains() {}
    });
    let framesWithBothGroups = 0;
    let splitRings = 0;
    let forwardCounterFrames = 0;
    let reverseCounterFrames = 0;
    let forwardCrossingFrames = 0;
    let reverseCrossingFrames = 0;
    const fills = Array.from({ length: 61 }, (_, index) => index / 60);
    let timestamp = 100;
    for (const intro of [0, 0.08, 0.16, 0.22, 0.35]) {
      Object.assign(state, { chargeIntroProgress: intro });
      const sequence = intro === 0 ? [...fills, ...fills.toReversed()] : [1];
      for (const [position, fill] of sequence.entries()) {
        records = [];
        scope.drawTitleChains(timestamp += 40, fill);
        assert.equal((state as any).chainBackCanvas.style.opacity,
          (state as any).chainFrontCanvas.style.opacity,
          "The rear wire must remain below the real title at the same visibility");
        const links = new Map(records.map(record => [`${record.definition.id}:${record.linkIndex}`, record]));
        if (intro === 0 && fill === 1) {
          for (const definition of scope.chainDefinitions.filter((definition: any) => definition.direction > 0)) {
            const spacing = scope.buildTitleChainLinkUnits(definition, width < 420);
            const path = scope.resolveTitleChainPath(definition, 1, 0);
            const tail = records.filter(record => record.definition.id === definition.id
              && Math.hypot(record.sample.x - path.points.at(-1).x, record.sample.y - path.points.at(-1).y)
                < scope.getChainLinkDimensions(definition).width * 2);
            assert.ok(tail.length >= 2, "Paint the complete s tail instead of fading it before the glyph");
            assert.ok(tail.every(record => Math.abs(record.alpha - 1) < 1e-8),
              "Both s tails retain solid metal opacity at full tension");
            assert.ok(tail.some(record => record.paintPlane === "back"),
              "The solid tail ends behind the s stroke");
            const terminalIndex = spacing.records.findIndex((record: any) => record.distanceUnit === 1);
            if (definition.route === "left-upper") {
              assert.ok(!records.some(record => record.definition.id === definition.id && record.linkIndex === terminalIndex),
                "Hide only the exposed upper-return terminal ring");
              assert.ok(tail.some(record => record.linkIndex === terminalIndex - 1),
                "Keep the neighboring connector solid instead of fading the whole tail");
            } else {
              assert.ok(tail.some(record => record.linkIndex === terminalIndex),
                "Keep the lower tail's downward terminal ring");
            }
          }
        }
        const fragments = new Map<string, any[]>();
        for (const record of records) {
          const key = `${record.definition.id}:${record.linkIndex}`;
          const group = fragments.get(key) ?? [];
          group.push(record);
          fragments.set(key, group);
        }
        for (const group of fragments.values()) {
          if (group.length < 2) continue;
          splitRings++;
          assert.ok(group.every(record => record.clip?.length >= 3));
          const area = group.reduce((sum, record) => sum + Math.abs(record.clip.reduce((cross: number, point: any, i: number) => {
            const next = record.clip[(i + 1) % record.clip.length];
            return cross + point.x * next.y - next.x * point.y;
          }, 0)) * .5, 0);
          const record = group[0];
          const width = scope.getChainLinkDimensions(record.definition).width * 1.16;
          const lengthScale = record.linkIndex % 2 ? record.lengthScale : 1;
          assert.ok(Math.abs(area - width * width * lengthScale * 1.4) < 1e-5,
            "Depth fragments must cover the ring's paint bounds without a missing strip");
        }
        for (const record of records) {
          if (record.linkIndex % 2 === 0) continue;
          const before = links.get(`${record.definition.id}:${record.linkIndex - 1}`);
          const after = links.get(`${record.definition.id}:${record.linkIndex + 1}`);
          if (!before || !after) continue;
          const width = scope.getChainLinkDimensions(record.definition).width * 1.16;
          const halfSpan = width * record.lengthScale * .45;
          for (const [side, neighbor] of [[-1, before], [1, after]] as const) {
            const tipX = record.sample.x + side * Math.cos(record.sample.angle) * halfSpan;
            const tipY = record.sample.y + side * Math.sin(record.sample.angle) * halfSpan;
            const anchorX = neighbor.sample.x - side * neighbor.sample.tangentX * width * .34;
            const anchorY = neighbor.sample.y - side * neighbor.sample.tangentY * width * .34;
            assert.ok(Math.hypot(tipX - anchorX, tipY - anchorY) < .001, "A connector cannot detach during scrolling");
          }
          assert.ok(Number.isFinite(record.lengthScale) && record.lengthScale > 0,
            "The fitted connector must keep a valid span; its endpoints above own continuity");
        }
        const counter = (state.chainRig as any)?.counter;
        const counterCore = records.filter(record => record.definition.id === 2 && counter
          && ((record.sample.x - counter.x) / counter.radiusX) ** 2
            + ((record.sample.y - counter.y) / counter.radiusY) ** 2 < .2);
        if (counterCore.length) {
          if (intro === 0) {
            if (position < fills.length) forwardCounterFrames++;
            else reverseCounterFrames++;
          }
          assert.ok(counterCore.some(record => record.paintPlane === "front"),
            "The aperture retains its front-side ring fragment");
          for (const record of counterCore.filter(record => record.paintPlane === "back")) {
            assert.ok(record.clip?.every((point: any) =>
              point.x >= Math.round(counter.x + counter.radiusX) - 1e-6),
            "Only the wire beyond the counter's right edge may enter the rear glyph plane");
          }
        }
        const lowerCrossing = (state.chainRig as any)?.crossings.find((point: any) =>
          point.ids.join(",") === "0,2" && point.overId === 0);
        const crossingLinks = records.filter(record => lowerCrossing
          && lowerCrossing.ids.includes(record.definition.id)
          && Math.hypot(record.sample.x - lowerCrossing.x, record.sample.y - lowerCrossing.y)
            < lowerCrossing.radius + scope.getChainLinkDimensions(record.definition).width * .58);
        if (new Set(crossingLinks.map(record => record.definition.id)).size === 2) {
          if (intro === 0) {
            if (position < fills.length) forwardCrossingFrames++;
            else reverseCrossingFrames++;
          }
          for (const record of crossingLinks.filter(record => record.paintPlane === "back")) {
            const paintedWidth = scope.getChainLinkDimensions(record.definition).width * 1.16;
            const halfLength = paintedWidth * (record.linkIndex % 2 ? record.lengthScale : 1) * .7;
            const halfHeight = paintedWidth * .5;
            const polygon = record.clip ?? [
              [-halfLength, -halfHeight], [halfLength, -halfHeight],
              [halfLength, halfHeight], [-halfLength, halfHeight]
            ].map(([x, y]) => ({
              x: record.sample.x + x * Math.cos(record.sample.angle) - y * Math.sin(record.sample.angle),
              y: record.sample.y + x * Math.sin(record.sample.angle) + y * Math.cos(record.sample.angle)
            }));
            const { x, y, radius } = lowerCrossing;
            assert.ok(
              polygon.every((p: any) => p.x <= x - radius) || polygon.every((p: any) => p.x >= x + radius)
                || polygon.every((p: any) => p.y <= y - radius) || polygon.every((p: any) => p.y >= y + radius),
              `A rear s-tail fragment cannot enter the front clasp rectangle at width=${width}, fill=${fill}, intro=${intro}`
            );
          }
        }
        const left = records.filter(record => record.definition.direction > 0);
        const right = records.filter(record => record.definition.direction < 0);
        if (!left.length || !right.length) continue;
        framesWithBothGroups++;
      }
    }
    assert.ok(framesWithBothGroups > 10);
    assert.ok(splitRings > 10, "Exercise real links spanning both glyph planes, not just center-based ownership");
    assert.ok(forwardCounterFrames > 2 && reverseCounterFrames > 2,
      "Exercise the clasp in both scroll directions");
    assert.ok(forwardCrossingFrames > 2 && reverseCrossingFrames > 2,
      "Exercise the interlocked lower crossing in both scroll directions");
  }
  assert.ok(home.includes("leader.sample.plane === \"back\" ? chainBackContext : chainFrontContext"));
  assert.ok(home.includes("* destinationFade"));
});

test("same-plane crossings paint complete chain groups without interleaving their half-rings", () => {
  const calls: { id: number; link: number; arc: string }[] = [];
  const source = home.slice(home.indexOf("const drawChainLayer ="), home.indexOf("const drawChainLeader ="));
  const draw = vm.runInNewContext(`${source}; drawChainLayer`, {
    mobilePerformance: false, chainTitleBox: { width: 1200 },
    drawChainLinkArc: (_context: unknown, _sample: unknown, link: number, definition: { id: number },
      _alpha: number, _heat: number, _front: boolean, arc: string) => calls.push({ id: definition.id, link, arc })
  });
  const records = [0, 1, 2].flatMap(id => [0, 1, 2, 3].map(linkIndex => ({
    definition: { id }, linkIndex, arcMode: "full", alpha: 1, heat: 0, sample: {}, scale: 1, lengthScale: 1
  })));
  draw({}, records, true);
  assert.deepEqual(calls.map(call => call.id), [0, 1, 2].flatMap(id => Array(8).fill(id)));
  for (const record of records) {
    assert.deepEqual(calls.filter(call => call.id === record.definition.id && call.link === record.linkIndex)
      .map(call => call.arc), ["far", "near"]);
  }
});
