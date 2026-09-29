import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { buildTitleChainRig, partitionTitleChainRing, sampleTitleChainCurve } from "../src/themes/kisara/lib/titleChainRig.ts";
import { chainMaterialCell } from "../src/themes/kisara/lib/titleChainMaterial.ts";

const home = readFileSync(new URL("../src/themes/kisara/pages/HomePage.astro", import.meta.url), "utf8");
const atlas = new URL("../public/themes/kisara/assets/title-chain-steel.webp", import.meta.url);
const sample = { x: 64, y: 64, angle: .45, plane: "front" };
const cut = { x: 64, y: 64, nx: .8, ny: .6, unit: .5, frontBefore: false, frontAfter: true };
const path = { depthCuts: [cut] } as Parameters<typeof partitionTitleChainRing>[0];
const fragments = () => partitionTitleChainRing(path, sample, 36, 1, .4, .6);

test("production glyph edges use ink bearings and the same baseline as the liquid-title mask", () => {
  for (const descent of [0, 4]) {
    const prefixes = [180, 251, 380, 519, 638, 777];
    const widths = [180, 80, 130, 140, 120, 140];
    const text = "Kisara";
    const box = { left: 100, top: 40, width: 777 * 1.5, height: 258 };
    const context = {
      save() {}, restore() {}, font: "", textBaseline: "",
      measureText(value: string) {
        const index = text.indexOf(value);
        return { width: value.length === 1 ? widths[index] : prefixes[value.length - 1],
          actualBoundingBoxLeft: -3, actualBoundingBoxRight: (widths[index] ?? 777) - 5,
          actualBoundingBoxAscent: value.length > 1 || index < 2 ? 150 : 108,
          actualBoundingBoxDescent: descent };
      }
    };
    const source = home.slice(home.indexOf("const rebuildTitleChainLayout ="), home.indexOf("const resizeTitleChains ="));
    const scope = vm.runInNewContext(`${source}; rebuildTitleChainLayout(); chainGlyphLayout`, {
      chainBackContext: context, title: {}, chainTitleBox: box, chainCounterContext: {},
      window: { getComputedStyle: () => ({ fontWeight: "700", fontSize: "200px", fontFamily: "Georgia" }) },
      measureTitleChainCounter: () => null, chainGlyphLayout: null, chainRig: {},
      chainLinkUnitCache: new Map()
    });
    const baseline = box.top + box.height * .5 + (150 - (descent || 200 * .16)) * 1.5 * .5;
    scope.glyphBounds.forEach((glyph: { left: number; right: number; top: number; bottom: number }, i: number) => {
      const origin = prefixes[i] - widths[i];
      assert.equal(glyph.left, box.left + (origin + 3) * 1.5);
      assert.equal(glyph.right, box.left + (origin + widths[i] - 5) * 1.5);
      assert.equal(glyph.top, baseline - (i < 2 ? 150 : 108) * 1.5);
      assert.equal(glyph.bottom, baseline + descent * 1.5);
    });
  }
});

test("glyph depth changes at letter edges or after the counter aperture, never at chain crossings", () => {
  const rig = buildTitleChainRig(
    { left: 0, top: 0, width: 1100, height: 260 },
    { textLeft: 0, textRight: 1100, gaps: [], anchorBounds: [] }, [32, 31, 31]
  );
  for (const path of rig.paths) {
    for (const cut of path.depthCuts) {
      const atEdge = path.glyphBackZones.some(zone =>
        Math.abs(cut.x - zone.left) < .05 || Math.abs(cut.x - zone.right) < .05);
      const afterCounter = path.counter && path.counterUnit
        && cut.frontBefore && !cut.frontAfter && cut.unit > path.counterUnit
        && cut.unit < path.counterUnit + .15
        && ((cut.x - path.counter.x) / path.counter.radiusX) ** 2
          + ((cut.y - path.counter.y) / path.counter.radiusY) ** 2 > 1;
      assert.ok(atEdge || afterCounter, `Unexpected glyph cut at ${cut.x}, ${cut.y}`);
      if (atEdge) assert.equal(cut.ny, 0);
      for (const crossing of rig.crossings) {
        assert.ok(Math.hypot(cut.x - crossing.x, cut.y - crossing.y) > 2);
      }
    }
  }
  for (let i = 0; i < rig.crossings.length; i++) {
    const a = rig.crossings[i];
    for (const b of rig.crossings.slice(i + 1)) {
      assert.ok(Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) > a.radius + b.radius + 1,
        "Local repaint rectangles cannot change a neighboring crossing");
    }
  }
});

test("the right clasp remains in front through the a counter and changes depth after leaving it", () => {
  for (const x of [.515, .54, .58, .6]) for (const y of [.7, .78, .82]) {
    const counter = { x: 1100 * x, y: 260 * y, radiusX: 20, radiusY: 25 };
    const rig = buildTitleChainRig(
      { left: 0, top: 0, width: 1100, height: 260 },
      { textLeft: 0, textRight: 1100, gaps: [], anchorBounds: [], counter }, [32, 31, 31]
    );
    const clasp = rig.paths[2];
    const cut = clasp.depthCuts.find(part => part.frontBefore && !part.frontAfter);
    assert.equal(sampleTitleChainCurve(clasp, clasp.counterUnit!).plane, "front");
    if (!cut) {
      assert.equal(clasp.glyphBackZones[1].from, 1,
        "A narrow glyph wall must not force a partial depth split");
      continue;
    }
    assert.ok(cut.unit > clasp.counterUnit!);
    assert.ok(cut.x < clasp.glyphBackZones[1].right);
    const distance = ((cut.x - counter.x) / counter.radiusX) ** 2
      + ((cut.y - counter.y) / counter.radiusY) ** 2;
    assert.ok(distance > 1, "The split must be hidden by letter ink after the open counter");
  }
});

test("chain crossings repaint in place with the upper strand last, without changing glyph canvas", () => {
  const commands: string[] = [];
  const canvas = {
    save() { commands.push("save"); }, restore() { commands.push("restore"); },
    beginPath() {}, rect() { commands.push("rect"); }, clip() { commands.push("clip"); },
    clearRect() { commands.push("clear"); }
  };
  const records = [0, 0, 1, 1].map(id => ({
    definition: { id }, sample: { x: 64, y: 64 }, scale: 1, lengthScale: 1
  }));
  const source = home.slice(home.indexOf("const drawChainCrossings ="), home.indexOf("const drawChainLeader ="));
  const draw = vm.runInNewContext(`${source}; drawChainCrossings`, {
    chainRig: { crossings: [{ x: 64, y: 64, radius: 70, ids: [0, 1], overId: 0 }] },
    chainPixelRatio: 1.5, getChainLinkDimensions: () => ({ width: 32 }),
    drawChainLayer(context: object, ordered: typeof records, front: boolean) {
      assert.equal(context, canvas);
      assert.equal(front, false);
      assert.deepEqual(Array.from(ordered, record => record.definition.id), [1, 1, 0, 0]);
      commands.push("paint");
    }
  });
  draw(canvas, records, false);
  assert.deepEqual(commands, ["save", "rect", "clip", "clear", "paint", "restore"]);
});

test("crossing repaint retains corner-overlapping wires and skips an already correct order", () => {
  const painted: number[][] = [];
  const state = {
    chainRig: { crossings: [{ x: 100, y: 100, radius: 70, ids: [0, 1], overId: 0 }] },
    chainPixelRatio: 1, getChainLinkDimensions: () => ({ width: 32 }),
    drawChainLayer(_: unknown, records: { definition: { id: number } }[]) {
      painted.push(Array.from(records, record => record.definition.id));
    }
  };
  const source = home.slice(home.indexOf("const drawChainCrossings ="), home.indexOf("const drawChainLeader ="));
  const draw = vm.runInNewContext(`${source}; drawChainCrossings`, state);
  const canvas = { save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, clearRect() {} };
  const records = [0, 1, 2].map(id => ({
    definition: { id }, sample: id === 2 ? { x: 190, y: 190 } : { x: 100, y: 100 },
    scale: 1, lengthScale: 1
  }));
  draw(canvas, records, true);
  assert.deepEqual(painted, [[1, 2, 0]], "A ring overlapping a square corner must be repainted after clearing");
  state.chainRig.crossings[0].overId = 1;
  draw(canvas, records, true);
  assert.equal(painted.length, 1);
});

test("a depth boundary splits one ring's paint region into complementary local polygons", () => {
  const parts = fragments();
  assert.deepEqual(parts.map(part => part.plane), ["back", "front"]);
  const area = (points: { x: number; y: number }[]) => Math.abs(points.reduce((sum, p, i) => {
    const q = points[(i + 1) % points.length];
    return sum + p.x * q.y - q.x * p.y;
  }, 0)) * .5;
  assert.ok(Math.abs(parts.reduce((sum, part) => sum + area(part.clip!), 0) - 36 * 36 * 1.4) < 1e-8);
  for (const part of parts) {
    for (const point of part.clip!) {
      const signed = (point.x - cut.x) * cut.nx + (point.y - cut.y) * cut.ny;
      assert.ok(part.plane === "front" ? signed > -1e-8 : signed < 1e-8);
    }
  }
  assert.deepEqual(partitionTitleChainRing(path, sample, 36, 1, .1, .2), [{ plane: "front", clip: null }]);
});

test("glyph cuts share a device-pixel boundary instead of separating two antialiased half-rings", async () => {
  for (const ratio of [.5, .75, 1, 1.28]) for (const direction of [-1, 1]) for (const horizontal of [false, true]) {
    const edge = Object.freeze({ ...cut, x: 64.25, y: 64.25, nx: horizontal ? 0 : direction, ny: horizontal ? direction : 0 });
    const parts = partitionTitleChainRing({ depthCuts: [edge] } as typeof path, sample, 36, 1, .4, .6, ratio);
    const wire = '<rect x="46" y="54" width="36" height="20" rx="8" fill="none" stroke="#fff" stroke-width="3.6"/>';
    const masked = parts.map((part, i) => '<defs><clipPath id="p' + i + '"><polygon points="'
      + part.clip!.map(point => point.x + ',' + point.y).join(' ') + '"/></clipPath></defs><g clip-path="url(#p' + i + ')">' + wire + '</g>').join('');
    const render = (body: string) => sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">'
      + '<g transform="scale(' + ratio + ')">' + body + '</g></svg>')).ensureAlpha().raw().toBuffer();
    const full = await render(wire), split = await render(masked);
    let checked = 0;
    for (let i = 3; i < full.length; i += 4) {
      if (full[i] < 240) continue;
      checked++;
      assert.ok(split[i] >= full[i] - 5, 'A common depth edge must not cut a translucent crack through the wire');
    }
    assert.ok(checked > 5);
  }
});

test("production arc painting applies the same world-space clip before rotating either wire half", () => {
  const commands: string[] = [];
  const polygons: number[][][] = [];
  const context = {
    globalAlpha: 1, globalCompositeOperation: "", imageSmoothingEnabled: false,
    save() {}, restore() {}, beginPath() { polygons.push([]); },
    moveTo(x: number, y: number) { polygons.at(-1)!.push([x, y]); },
    lineTo(x: number, y: number) { polygons.at(-1)!.push([x, y]); },
    closePath() {}, clip() { commands.push("clip"); },
    translate() { commands.push("translate"); }, rotate() {}, scale() {}
  };
  const source = home.slice(home.indexOf("const drawChainLinkArc ="), home.indexOf("const drawChainLayer ="));
  const draw = vm.runInNewContext(`${source}; drawChainLinkArc`, {
    chainMaterialVisibility: 1, randomSeed: () => .5, getChainLinkDimensions: () => ({ width: 36 / 1.16 }),
    chainMaterial: { draw() { commands.push("paint"); } }
  });
  for (const part of fragments()) {
    for (const arc of ["far", "near"]) {
      draw(context, sample, 0, { id: 0, type: "weave" }, 1, 0, part.plane === "front", arc, 0, 1, 1, part.clip);
    }
  }
  assert.deepEqual(commands, Array.from({ length: 4 }, () => ["clip", "translate", "paint"]).flat());
  assert.deepEqual(polygons[0], polygons[1]);
  assert.deepEqual(polygons[2], polygons[3]);
  assert.notDeepEqual(polygons[0], polygons[2]);
});

test("pixel rendering retains the complete metal wire when a ring spans both depth layers", async () => {
  const png = await sharp(readFileSync(atlas)).png().toBuffer();
  const image = `data:image/png;base64,${png.toString("base64")}`;
  for (const edgeOn of [false, true]) {
    const wire = ["far", "near"].map(arc => {
      const cell = chainMaterialCell(.5, edgeOn, arc as "far" | "near");
      return `<svg x="-24" y="-16" width="48" height="32" viewBox="${cell.x} ${cell.y} 144 96">
        <image width="2448" height="384" href="${image}"/></svg>`;
    }).join("");
    const ring = `<g transform="translate(64 64) rotate(${sample.angle * 180 / Math.PI})">${wire}</g>`;
    const masked = fragments().map((part, i) => `<defs><clipPath id="cut${i}" clipPathUnits="userSpaceOnUse">
      <polygon points="${part.clip!.map(p => `${p.x},${p.y}`).join(" ")}"/></clipPath></defs>
      <g clip-path="url(#cut${i})">${ring}</g>`).join("");
    const render = (content: string) => sharp(Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">${content}</svg>`
    )).ensureAlpha().raw().toBuffer();
    const full = await render(ring);
    const split = await render(masked);
    let wirePixels = 0;
    for (let i = 3; i < full.length; i += 4) {
      if (full[i] < 64) continue;
      wirePixels++;
      assert.ok(split[i] >= full[i] * .68, "A layer switch cannot remove a wire segment");
      if (full[i] - split[i] <= 8) continue;
      const x = ((i - 3) / 4) % 128 + .5;
      const y = Math.floor((i - 3) / 4 / 128) + .5;
      assert.ok(Math.abs((x - cut.x) * cut.nx + (y - cut.y) * cut.ny) < 1.5,
        "Only the subpixel antialiasing edge may differ from uncut paint");
    }
    assert.ok(wirePixels > 70);
  }
});
