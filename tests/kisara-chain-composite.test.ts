import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { stripTypeScriptTypes } from "node:module";
import { readFileSync } from "node:fs";
import sharp from "sharp";

const source = readFileSync(new URL("../src/themes/kisara/lib/titleChainComposite.ts", import.meta.url), "utf8");
const raw = { width: 128, height: 128, channels: 4 as const };
function rectangle(x: number, y: number, width: number, height: number) {
  const pixels = Buffer.alloc(128 * 128 * 4);
  for (let row = y; row < y + height; row++) pixels.fill(255, (row * 128 + x) * 4, (row * 128 + x + width) * 4);
  return pixels;
}
async function execute(context: any) {
  for (const operation of context.operations) {
    const pixels = Buffer.from(operation.image.pixels);
    for (let i = 3; i < pixels.length; i += 4) pixels[i] = Math.round(pixels[i] * operation.alpha);
    const blend = operation.mode === "source-over" ? "over"
      : operation.mode.replace("destination-", "dest-") as "dest-over" | "dest-out" | "dest-in";
    context.canvas.pixels = await sharp(context.canvas.pixels, { raw })
      .composite([{ input: pixels, raw, blend }]).raw().toBuffer();
  }
}
function canvas(width = 128, height = 128) {
  const surface: any = { width, height, pixels: Buffer.alloc(width * height * 4) };
  const context: any = {
    canvas: surface, globalAlpha: .7, globalCompositeOperation: "source-over",
    operations: [], transforms: [], stack: [],
    save() { this.stack.push([this.globalAlpha, this.globalCompositeOperation]); },
    restore() { [this.globalAlpha, this.globalCompositeOperation] = this.stack.pop(); },
    setTransform(...args: number[]) { this.transforms.push(args); },
    clearRect() {},
    drawImage(image: any, ...args: number[]) {
      this.operations.push({ image, args, alpha: this.globalAlpha, mode: this.globalCompositeOperation });
    }
  };
  surface.getContext = () => context;
  return { surface, context };
}
function fixture() {
  const mask = canvas(), outside = canvas(), front = canvas(), back = canvas();
  const factory = vm.runInNewContext(stripTypeScriptTypes(source.replace("export function", "function"))
    + "; createTitleChainComposite", { document: { createElement: () => outside.surface } });
  const controller = new AbortController();
  const glyph = { canvas: mask.surface, left: 12, top: 7, width: 90, height: 80 };
  return { mask, outside, front, back, glyph, controller, compose: factory(controller.signal) };
}

test("chain composition uses the title's own ink mask at its CSS placement", () => {
  const { mask, outside, front, back, glyph, compose, controller } = fixture();
  assert.equal(compose(front.context, back.context, glyph, 1.25, 1), true);
  assert.equal(outside.context.operations[1].image, mask.surface);
  assert.deepEqual(Array.from(outside.context.operations[1].args), [12, 7, 90, 80]);
  assert.deepEqual(outside.context.transforms.slice(0, 2), [[1, 0, 0, 1, 0, 0], [1.25, 0, 0, 1.25, 0, 0]]);
  assert.deepEqual(back.context.operations[0].args, [12, 7, 90, 80]);
  compose(front.context, back.context, glyph, .75, .4);
  assert.equal(outside.context.operations.length, 4);
  back.surface.width = 256;
  compose(front.context, back.context, glyph, .75, 1);
  assert.equal(outside.surface.width, 256);
  assert.equal(mask.surface.width, 128);
  controller.abort();
  assert.equal(outside.surface.width, 0);
  assert.equal(outside.surface.height, 0);
  assert.equal(compose(front.context, back.context, glyph, .75, 1), false);
});

test("glyph masking follows title opacity while keeping rear metal beneath the DOM title", () => {
  const { mask, outside, front, back, glyph, compose } = fixture();
  for (const opacity of [1, .4, 0]) {
    compose(front.context, back.context, glyph, 1, opacity);
    const erase = outside.context.operations.at(-1);
    const under = back.context.operations.at(-1), merge = front.context.operations.at(-1);
    assert.equal(erase.image, mask.surface);
    assert.equal(erase.alpha, opacity);
    assert.equal(erase.mode, "destination-out");
    assert.equal(under.image, mask.surface);
    assert.equal(under.alpha, opacity);
    assert.equal(under.mode, "destination-in");
    assert.equal(merge.image, outside.surface);
    assert.equal(merge.mode, "destination-over");
    assert.equal(merge.alpha, 1);
    for (const context of [outside.context, front.context, back.context]) {
      assert.equal(context.globalAlpha, .7);
      assert.equal(context.globalCompositeOperation, "source-over");
    }
  }
});

test("one combined chain surface stays opaque after fractional display scaling unlike independent layers", async () => {
  for (const size of [97, 113, 141, 179]) {
    const { front, back, outside, glyph, compose } = fixture();
    const rear = rectangle(20, 20, 44, 88), face = rectangle(64, 20, 44, 88);
    back.surface.pixels = rear;
    front.surface.pixels = face;
    compose(front.context, back.context, glyph, 1, 1);
    await execute(outside.context);
    await execute(back.context);
    await execute(front.context);
    const resize = (pixels: Buffer) => sharp(pixels, { raw }).resize(size, size).png().toBuffer();
    const legacy = await sharp(await resize(face)).composite([{ input: await resize(rear) }]).raw().toBuffer();
    const merged = await sharp(await resize(front.surface.pixels)).raw().toBuffer();
    const middle = Math.floor(size / 2);
    const offsets = [-2, -1, 0, 1, 2].map(dx => (middle * size + middle + dx) * 4 + 3);
    const oldAlpha = Math.min(...offsets.map(offset => legacy[offset]));
    assert.ok(oldAlpha < 250, "Reproduce the resampling crack at size " + size + ", alpha " + oldAlpha);
    assert.equal(Math.min(...offsets.map(offset => merged[offset])), 255,
      "Resize only after the two halves share one backing surface");
  }
});

test("the measured ink mask occludes rear wires but not glyph holes or front wires", async () => {
  const { mask, outside, front, back, glyph, compose } = fixture();
  back.surface.pixels = rectangle(20, 20, 44, 88);
  front.surface.pixels = rectangle(64, 20, 44, 88);
  mask.surface.pixels = rectangle(40, 40, 40, 40);
  for (let y = 55; y < 65; y++) mask.surface.pixels.fill(0, (y * 128 + 48) * 4, (y * 128 + 56) * 4);
  compose(front.context, back.context, glyph, 1, 1);
  await execute(outside.context);
  await execute(back.context);
  await execute(front.context);
  const alpha = (surface: typeof front.surface, x: number, y: number) =>
    surface.pixels[(y * 128 + x) * 4 + 3];
  assert.equal(alpha(front.surface, 45, 45), 0);
  assert.equal(alpha(back.surface, 45, 45), 255);
  assert.equal(alpha(front.surface, 50, 60), 255);
  assert.equal(alpha(back.surface, 50, 60), 0);
  assert.equal(alpha(front.surface, 70, 45), 255);
  assert.equal(alpha(front.surface, 30, 45), 255);
  const title = Buffer.from(mask.surface.pixels);
  for (let i = 0; i < title.length; i += 4) {
    if (title[i + 3]) { title[i] = 230; title[i + 1] = 45; title[i + 2] = 100; }
  }
  const layered = await sharp(back.surface.pixels, { raw }).composite([
    { input: title, raw, blend: "over" },
    { input: front.surface.pixels, raw, blend: "over" }
  ]).raw().toBuffer();
  assert.deepEqual(Array.from(layered.subarray((45 * 128 + 45) * 4, (45 * 128 + 45) * 4 + 4)),
    [230, 45, 100, 255], "The actual title covers the rear link");
  assert.equal(layered[(60 * 128 + 50) * 4 + 3], 255, "The counter keeps the continuous link");
});
