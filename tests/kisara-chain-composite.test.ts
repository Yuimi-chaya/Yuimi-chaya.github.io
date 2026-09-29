import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { stripTypeScriptTypes } from "node:module";
import { readFileSync } from "node:fs";
import sharp from "sharp";

const source = readFileSync(new URL("../src/themes/kisara/lib/titleChainComposite.ts", import.meta.url), "utf8");
const layout = { font: "700 176px Georgia", textLeft: 20, baseline: 90, widthScale: 1.2 };
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
    const blend = operation.mode.replace("destination-", "dest-") as "dest-over" | "dest-out";
    context.canvas.pixels = await sharp(context.canvas.pixels, { raw })
      .composite([{ input: pixels, raw, blend }]).raw().toBuffer();
  }
}
function canvas(width = 128, height = 128) {
  const surface: any = { width, height, pixels: Buffer.alloc(width * height * 4) };
  const context: any = {
    canvas: surface, globalAlpha: .7, globalCompositeOperation: "source-over",
    operations: [], text: [], transforms: [], stack: [],
    save() { this.stack.push([this.globalAlpha, this.globalCompositeOperation]); },
    restore() { [this.globalAlpha, this.globalCompositeOperation] = this.stack.pop(); },
    setTransform(...args: number[]) { this.transforms.push(args); },
    translate(...args: number[]) { this.transforms.push(args); },
    scale(...args: number[]) { this.transforms.push(args); },
    fillText(...args: unknown[]) { this.text.push({ args, font: this.font, baseline: this.textBaseline }); },
    drawImage(image: any, x: number, y: number) {
      this.operations.push({ image, x, y, alpha: this.globalAlpha, mode: this.globalCompositeOperation });
    }
  };
  surface.getContext = () => context;
  return { surface, context };
}
function fixture() {
  const mask = canvas(), front = canvas(), back = canvas();
  const factory = vm.runInNewContext(stripTypeScriptTypes(source.replace("export function", "function"))
    + "; createTitleChainComposite", { document: { createElement: () => mask.surface } });
  const controller = new AbortController();
  return { mask, front, back, controller, compose: factory(controller.signal) };
}

test("chain composition caches measured glyph ink and invalidates it on layout, ratio, and backing-size changes", () => {
  const { mask, front, back, compose, controller } = fixture();
  assert.equal(compose(front.context, back.context, layout, 1, 1), true);
  assert.deepEqual(Array.from(mask.context.text[0].args), ["Kisara", 0, 0]);
  assert.equal(mask.context.text[0].font, layout.font);
  assert.equal(mask.context.text[0].baseline, "alphabetic");
  assert.deepEqual(mask.context.transforms, [[1, 0, 0, 1, 0, 0], [20, 90], [1.2, 1.2]]);
  compose(front.context, back.context, layout, 1, .4);
  assert.equal(mask.context.text.length, 1);
  compose(front.context, back.context, layout, .75, 1);
  assert.equal(mask.context.text.length, 2);
  back.surface.width = 256;
  compose(front.context, back.context, layout, .75, 1);
  assert.equal(mask.surface.width, 256);
  const next = { ...layout, baseline: 92 };
  compose(front.context, back.context, next, .75, 1);
  assert.equal(mask.context.text.length, 4);
  controller.abort();
  assert.equal(mask.surface.width, 0);
  assert.equal(mask.surface.height, 0);
  assert.equal(compose(front.context, back.context, next, .75, 1), false);
});

test("glyph masking follows title opacity and compositing restores both context states", () => {
  const { mask, front, back, compose } = fixture();
  for (const opacity of [1, .4, 0]) {
    compose(front.context, back.context, layout, 1, opacity);
    const erase = back.context.operations.at(-1), merge = front.context.operations.at(-1);
    assert.equal(erase.image, mask.surface);
    assert.equal(erase.alpha, opacity);
    assert.equal(erase.mode, "destination-out");
    assert.equal(merge.image, back.surface);
    assert.equal(merge.mode, "destination-over");
    assert.equal(merge.alpha, 1);
    for (const context of [front.context, back.context]) {
      assert.equal(context.globalAlpha, .7);
      assert.equal(context.globalCompositeOperation, "source-over");
      assert.deepEqual(context.transforms.at(-1), [1, 0, 0, 1, 0, 0]);
    }
  }
});

test("one combined chain surface stays opaque after fractional display scaling unlike independent layers", async () => {
  for (const size of [97, 113, 141, 179]) {
    const { front, back, compose } = fixture();
    const rear = rectangle(20, 20, 44, 88), face = rectangle(64, 20, 44, 88);
    back.surface.pixels = rear;
    front.surface.pixels = face;
    compose(front.context, back.context, layout, 1, 1);
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
  const { mask, front, back, compose } = fixture();
  back.surface.pixels = rectangle(20, 20, 44, 88);
  front.surface.pixels = rectangle(64, 20, 44, 88);
  mask.surface.pixels = rectangle(40, 40, 40, 40);
  for (let y = 55; y < 65; y++) mask.surface.pixels.fill(0, (y * 128 + 48) * 4, (y * 128 + 56) * 4);
  compose(front.context, back.context, layout, 1, 1);
  await execute(back.context);
  await execute(front.context);
  const alpha = (x: number, y: number) => front.surface.pixels[(y * 128 + x) * 4 + 3];
  assert.equal(alpha(45, 45), 0);
  assert.equal(alpha(50, 60), 255);
  assert.equal(alpha(70, 45), 255);
  assert.equal(alpha(30, 45), 255);
});
