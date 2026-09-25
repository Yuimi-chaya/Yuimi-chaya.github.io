import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import sharp from "sharp";
import {
  memoryScenes, transformationScenes, memoryTimeline, memoryFillDuration,
  getMemoryFrame, getMemoryBlackout, getMemoryWarmIndices, advanceMemoryProgress,
  advanceMemoryBlackout, memoryBrightenDuration
} from "../src/themes/kisara/lib/gateStory.ts";
import { gateRelease, getTransformationFrame } from "../src/themes/kisara/lib/gateRelease.ts";

const home = readFileSync(new URL("../src/themes/kisara/pages/HomePage.astro", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/themes/kisara/styles/home.css", import.meta.url), "utf8");

test("the story preserves the supplied order and reuses established reaction and smoke assets", () => {
  assert.deepEqual(memoryScenes.map(scene => scene.id), [
    "intercept", "rescue", "draw", "leap", "impact", "fallen", "embrace", "approach", "kiss"
  ]);
  assert.deepEqual(transformationScenes.map(scene => scene.id), ["smoke-wide", "detail", "silhouette"]);
  assert.equal(memoryScenes[1].image, "/themes/kisara/assets/memory-rescue.webp");
  assert.equal(memoryScenes[6].image, "/themes/kisara/assets/memory-embrace.webp");
  assert.equal(memoryScenes[8].image, "/themes/kisara/assets/memory-kiss.webp");
  assert.doesNotMatch(JSON.stringify([...memoryScenes, ...transformationScenes]), /memory-attack|memory-clash|kisara\/stage|\.png/);
  assert.equal((home.match(/data-kisara-scene-slot="/g) ?? []).length, 2);
});

test("action inserts have shorter dwell than reactions and all nine shots read at 30/60/120Hz", () => {
  for (const fps of [30, 60, 120]) {
    const dwell = memoryScenes.map(() => 0);
    const order: number[] = [];
    for (let ms = 0; ms <= memoryFillDuration; ms += 1000 / fps) {
      const frames = memoryScenes.map((_, index) => getMemoryFrame(index, ms / memoryFillDuration)!);
      const dominant = frames.findLastIndex(frame => frame.opacity > 0.7);
      if (dominant >= 0) {
        dwell[dominant] += 1000 / fps;
        if (!order.includes(dominant)) order.push(dominant);
      }
    }
    assert.deepEqual(order, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    for (const index of [2, 3, 4, 5]) {
      assert.ok(dwell[index] >= 200 && dwell[index] <= 700, `${index + 1}: ${dwell[index]}ms`);
      assert.ok(dwell[index] < dwell[1] * 0.6);
    }
    for (const index of [0, 1, 6, 7, 8]) assert.ok(dwell[index] > 750);
  }
});

test("ordinary edits crossfade without a blank interval and fit two slots including the kiss to smoke bridge", () => {
  const check = (frames: Array<{ opacity: number } | null>, covered: boolean) => {
    const active = frames.filter(frame => frame && frame.opacity > 0.00005);
    assert.ok(active.length <= 2);
    if (covered) {
      const coverage = 1 - active.reduce((remaining, frame) => remaining * (1 - frame!.opacity), 1);
      assert.ok(coverage > 0.7, `No empty interval during a dissolve: ${coverage}`);
    }
  };
  for (let step = 0; step <= 10000; step++) {
    const fill = step / 10000;
    check(memoryScenes.map((_, index) => getMemoryFrame(index, fill)), fill >= 0.065);
    const intro = fill * gateRelease.introHandoff;
    check([
      ...memoryScenes.map((_, index) => getMemoryFrame(index, 1, intro)),
      ...transformationScenes.map((_, index) => getTransformationFrame(index, intro))
    ], true);
  }
});

test("the close-up pushes in and closes to black before the kiss, then opens only after the swap", () => {
  let scale = 0;
  let black = 0;
  for (let step = 0; step <= 100; step++) {
    const fill = 0.702 + step / 100 * (0.825 - 0.702);
    const next = getMemoryFrame(7, fill)!;
    assert.ok(next.scale >= scale);
    assert.ok(getMemoryBlackout(fill) >= black);
    scale = next.scale;
    black = getMemoryBlackout(fill);
  }
  assert.ok(scale > 1.22);
  for (const fill of [0.825, 0.834, 0.85, 0.87]) assert.equal(getMemoryBlackout(fill), 1);
  assert.equal(getMemoryFrame(8, 0.87)!.opacity, 1);
  assert.equal(getMemoryFrame(7, 0.87)!.opacity, 0);
  assert.ok(getMemoryBlackout(0.906) > 0.7, "The kiss emerges gradually, not immediately after the swap");
  assert.equal(getMemoryBlackout(0.975), 0);
  assert.equal(getMemoryBlackout(0.84, 0.1), 0);
  assert.equal(getMemoryBlackout(0.84, 0, true), 0.3);
});

test("forward scroll never recoils into a retired shot and deliberate reverse remains available", () => {
  for (const fps of [30, 60, 120]) {
    let progress = 0;
    let velocity = 0;
    const ratio = 60 / fps;
    for (const target of [.17, .32, .42, .56, .71, .9, 1, .82, .55, .15, 0]) {
      const direction = Math.sign(target - progress);
      velocity += direction * .004;
      for (let step = 0; step < fps * 2; step++) {
        const next = advanceMemoryProgress(progress, target, velocity, ratio, .06, .76);
        assert.ok((next.progress - progress) * direction >= -1e-12);
        assert.ok((target - next.progress) * direction >= -1e-12);
        progress = next.progress;
        velocity = next.velocity;
      }
      assert.ok(Math.abs(progress - target) < .0001);
    }
  }
});

test("a fast scroll cannot skip the black-to-kiss brighten and it converges at every refresh rate", () => {
  for (const fps of [30, 60, 120]) {
    let opacity = 1;
    let elapsed = 0;
    while (opacity > .00001) {
      const next = advanceMemoryBlackout(opacity, 0, 1000 / fps);
      assert.ok(next <= opacity && next >= 0);
      opacity = next;
      elapsed += 1000 / fps;
    }
    assert.ok(elapsed >= memoryBrightenDuration - .01);
    assert.ok(elapsed <= memoryBrightenDuration + 1000 / fps);
  }
  assert.equal(advanceMemoryBlackout(.2, 1, 16), 1, "Reversing into the close-up can close the eye again");
  assert.ok(advanceMemoryBlackout(1, 0, 4000) > .9, "A suspended tab cannot consume the whole reveal");
});

test("scrubbing a frame has no wall-clock drift and reduced motion removes camera movement", () => {
  for (const fill of [0.12, 0.21, 0.36, 0.42, 0.61, 0.77, 0.94]) {
    const index = memoryTimeline.findLastIndex(scene => fill >= scene.start);
    const expected = getMemoryFrame(index, fill);
    getMemoryFrame(index, fill + 0.01);
    assert.deepEqual(getMemoryFrame(index, fill), expected);
    const quiet = getMemoryFrame(index, fill, 0, true)!;
    assert.equal(quiet.scale, 1.02);
    assert.equal(quiet.shiftX, 0);
    assert.equal(quiet.shiftY, 0);
    assert.equal(quiet.blur, 0);
  }
  assert.equal(getMemoryFrame(100, 0.5), null);
});

test("prefetch looks two shots ahead and keeps the previous shot for reverse scrubbing", () => {
  assert.deepEqual(getMemoryWarmIndices(0), [0, 1]);
  for (let step = 0; step <= 100; step++) {
    const fill = step / 100;
    const active = Math.max(0, memoryTimeline.findLastIndex(scene => fill >= scene.start));
    const warm = getMemoryWarmIndices(fill);
    assert.ok(warm.includes(active));
    if (active > 0) assert.ok(warm.includes(active - 1));
    if (active < 8) assert.ok(warm.includes(active + 1));
    assert.ok(warm.length <= 4);
  }
});

test("all story images are web-sized, valid and under the aggregate download budget", async () => {
  let total = statSync(new URL("../public/themes/kisara/assets/fight.webp", import.meta.url)).size;
  for (const scene of [...memoryScenes, ...transformationScenes]) {
    const url = new URL(`../public${scene.image}`, import.meta.url);
    const data = readFileSync(url);
    const metadata = await sharp(data).metadata();
    assert.equal(metadata.format, "webp");
    assert.ok(metadata.width! <= 1920 && metadata.height! <= 1200);
    assert.ok(metadata.width! >= 1200 && data.length <= 125000);
    total += statSync(url).size;
  }
  assert.ok(total < 850000, `${total} bytes`);
});

test("atmosphere removes scene blur, flashing haze and halo particles and respects lifecycle", () => {
  assert.doesNotMatch(styles, /kisara-memory-flare|kisara-ambient-particle-halo|\.kisara-ambient-particles i::after/);
  const slotStyles = styles.slice(styles.indexOf(".kisara-gate-scene-slot {"), styles.indexOf(".kisara-gate-background-fight {"));
  assert.doesNotMatch(slotStyles, /blur|blend-mode|gradient/);
  assert.match(styles, /is-story-suspended[^]*animation-play-state: paused/);
  assert.match(styles, /prefers-reduced-motion: reduce[^]*\.kisara-ambient-particles[^]*display: none/);
  assert.match(home, /gate\.classList\.toggle\("is-story-suspended", document\.visibilityState === "hidden"\)/);
});

test("the restored film grade is limited to the opening story and never grades the final stage", () => {
  const grade = styles.match(/\.kisara-gate-atmosphere \{\s*z-index:[^}]*\}/)![0];
  const media = styles.match(/\.kisara-gate-bridge-current \{\s*z-index:[^}]*\}/)![0];
  const shots = styles.match(/\.kisara-gate-scene-slot \{[^}]*\}/)![0];
  assert.doesNotMatch(media, /filter:/);
  assert.match(shots, /filter: saturate\(0\.94\) contrast\(1\.04\)/);
  assert.match(grade, /z-index: 30/);
  assert.match(home, /kisara-gate-atmosphere"><\/div>\s*<\/div>\s*<canvas\s+class="kisara-space-lens-canvas"/);
  assert.match(styles, /:is\(\.is-bursting, \.is-burst-complete, \.is-post-release\) \.kisara-gate-atmosphere \{\s*visibility: hidden;/);
  assert.match(grade, /opacity: calc\(1 - var\(--kisara-memory-blackout\)\)/);
  assert.match(grade, /linear-gradient\(112deg, rgba\(20, 25, 55, 0\.22\)/);
  assert.match(grade, /rgba\(255, 190, 210, 0\.1\)/);
  assert.match(grade, /radial-gradient\(ellipse at 50% 46%/);
  assert.doesNotMatch(grade, /blur\(|animation:|backdrop-filter|url\(/);
  assert.match(styles, /data-yuimi-performance="lite"\] :is\(\.kisara-gate-background-base, \.kisara-gate-scene-slot\) \{\s*filter: none;/);
});

test("intro preparation includes the kiss, both fast shots and the reconstruction carrier", () => {
  const requested: string[] = [];
  let ready = false;
  const state = {
    memorySceneRecords: [{ id: "kiss" }],
    transformationSceneRecords: [{ id: "10" }, { id: "11" }, { id: "12" }],
    isSceneImageReady(record: { id: string }) { requested.push(record.id); return ready; }
  };
  const start = home.indexOf("const areIntroImagesReady =");
  const end = home.indexOf("let sceneSlotOverflowWarned", start);
  const check = vm.runInNewContext(home.slice(start, end) + "\nareIntroImagesReady;", state);
  assert.equal(check(), false);
  assert.deepEqual(requested, ["kiss", "10", "11", "12"], "No short-circuit may delay warming a later shot");
  ready = true;
  assert.equal(check(), true);
});
