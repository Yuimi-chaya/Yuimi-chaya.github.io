import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryEditor, memoryEdits } from "../src/themes/kisara/lib/gateMemoryEdit.ts";
import { memoryTimeline } from "../src/themes/kisara/lib/gateStory.ts";
import { advanceGateAutoplay } from "../src/themes/kisara/lib/gateAutoplay.ts";

const ready = () => true;
const activeShots = (frame: ReturnType<ReturnType<typeof createMemoryEditor>["snapshot"]>) =>
  frame.weights.flatMap((weight, index) => weight > 0 ? [index] : []);

test("every boundary has a continuous handoff in both directions without threshold flicker", () => {
  for (let index = 0; index < memoryTimeline.length; index++) {
    const start = memoryTimeline[index].start;
    const editor = createMemoryEditor(start - 0.01);
    const before = editor.snapshot();
    const initial = editor.update(start + 0.005, 0, ready);
    assert.deepEqual(initial.weights, before.weights);
    assert.equal(initial.baseOpacity, before.baseOpacity);
    assert.equal(editor.active, true);
    const halfway = editor.update(start + 0.0005, 40, ready);
    assert.ok(halfway.weights[index] > 0 && halfway.weights[index] < 1);
    for (let i = 0; i < 20; i++) editor.update(start + (i % 2 ? -0.001 : 0.001), 16, ready);
    assert.deepEqual(activeShots(editor.snapshot()), [index]);
    assert.equal(editor.active, false);
    const backward = editor.update(start - 0.005, 0, ready);
    assert.deepEqual(activeShots(backward), [index]);
    assert.equal(editor.active, true);
    for (let i = 0; i < 20; i++) editor.update(start - 0.005, 16, ready);
    assert.equal(editor.active, false);
    assert.deepEqual(activeShots(editor.snapshot()), index ? [index - 1] : []);
    assert.equal(editor.snapshot().baseOpacity, index ? 0 : 1);
  }
});

test("stopping inside a reaction edit still finishes in real time at 30/60/120 Hz", () => {
  for (const fps of [30, 60, 120]) {
    for (const index of [6, 7, 8]) {
      const start = memoryTimeline[index].start;
      const editor = createMemoryEditor(start - 0.01);
      editor.update(start + 0.005, 10000, ready);
      assert.equal(editor.active, true);
      let elapsed = 0;
      while (editor.active && elapsed < 300) {
        editor.update(start + 0.005, 1000 / fps, ready);
        elapsed += 1000 / fps;
      }
      assert.equal(editor.active, false);
      assert.ok(elapsed >= memoryEdits[index].duration - 0.01);
      assert.ok(elapsed <= memoryEdits[index].duration + 1000 / fps + 0.01);
      assert.deepEqual(activeShots(editor.snapshot()), [index]);
    }
  }
});

test("reversing and resuming a partial dissolve keeps its current opacity", () => {
  const editor = createMemoryEditor(0.49);
  editor.update(0.51, 0, ready);
  const forward = editor.update(0.51, 40, ready);
  assert.ok(forward.weights[6] > 0 && forward.weights[6] < 0.5);
  assert.deepEqual(editor.update(0.49, 0, ready), forward);
  const reverse = editor.update(0.49, 20, ready);
  assert.ok(reverse.weights[6] < forward.weights[6]);
  assert.deepEqual(editor.update(0.51, 0, ready), reverse);
  for (let i = 0; i < 15; i++) editor.update(0.51, 16, ready);
  assert.deepEqual(activeShots(editor.snapshot()), [6]);
  assert.equal(editor.active, false);
});

test("detail softens during overlap and returns sharp without a color or exposure layer", () => {
  const editor = createMemoryEditor(0.49);
  editor.update(0.51, 0, ready);
  for (let i = 0; i < 5; i++) editor.update(0.51, 18, ready);
  const middle = editor.snapshot();
  assert.ok(Math.abs(middle.weights[5] - 0.5) < 1e-10);
  assert.ok(Math.abs(middle.weights[6] - 0.5) < 1e-10);
  assert.equal(middle.softness[5], 1);
  assert.equal(middle.softness[6], 1);
  assert.equal('bridgeOpacity' in middle, false);
  assert.equal('bridgeColor' in middle, false);
  const interrupted = editor.update(0.49, 0, ready);
  assert.deepEqual(interrupted, middle);
  for (let i = 0; i < 20; i++) editor.update(0.49, 16, ready);
  assert.ok(editor.snapshot().softness.every(value => value === 0));
});

test("decoding delays retain the old shot and retargeting never replaces a visible image", () => {
  const editor = createMemoryEditor(0.49);
  const old = editor.snapshot();
  for (let i = 0; i < 100; i++) assert.deepEqual(editor.update(0.51, 500, () => false), old);
  assert.equal(editor.active, false);
  assert.deepEqual(editor.update(0.51, 10000, ready).weights, old.weights);
  const mid = editor.update(0.51, 30, ready);
  assert.ok(mid.weights[6] > 0);
  assert.deepEqual(editor.update(0.9, 0, ready), mid);
  assert.equal(editor.active, true);
  let elapsed = 0;
  while (editor.active && elapsed < 500) {
    const frame = editor.update(0.9, 10, ready);
    assert.ok(activeShots(frame).length <= 2);
    assert.equal(frame.weights[7], 0, "A rapid scrub must not replay intermediate shots");
    elapsed += 10;
  }
  assert.equal(editor.active, false);
  assert.deepEqual(activeShots(editor.snapshot()), [8]);
});

test("reduced motion omits soft layers and never uncovers the blue base", () => {
  const editor = createMemoryEditor();
  for (const fill of [0.03, 0]) {
    editor.update(fill, 0, ready, true);
    for (let i = 0; i < 12; i++) {
      const frame = editor.update(fill, 10, ready, true);
      assert.ok(frame.softness.every(value => value === 0));
      assert.equal(frame.weights[0] + (1 - frame.weights[0]) * frame.baseOpacity, 1);
    }
  }
  assert.equal(editor.snapshot().baseOpacity, 1);
});

test("AUTO retains every authored shot at 30/60/120 Hz without queued edits", () => {
  for (const fps of [30, 60, 120]) {
    const editor = createMemoryEditor();
    const seen: number[] = [];
    const dwell = memoryTimeline.map(() => 0);
    let fill = 0;
    for (let elapsed = 0; elapsed < 9000; elapsed += 1000 / fps) {
      fill = advanceGateAutoplay(fill, 1000 / fps);
      const frame = editor.update(fill, 1000 / fps, ready);
      const shot = frame.weights.findIndex(weight => weight > 0.7);
      if (shot >= 0) {
        if (!seen.includes(shot)) seen.push(shot);
        dwell[shot] += 1000 / fps;
      }
      assert.ok(activeShots(frame).length <= 2);
    }
    assert.deepEqual(seen, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
    for (const index of [2, 3, 4, 5]) assert.ok(dwell[index] > 350);
    assert.equal(editor.active, false);
  }
});

test("reset and a background time jump cannot leave softness or replay an old edit", () => {
  const editor = createMemoryEditor(0.49);
  editor.update(0.51, 0, ready);
  const bounded = editor.update(0.51, 30000, ready);
  assert.ok(bounded.weights[6] < 0.5);
  editor.reset(0);
  assert.equal(editor.snapshot().baseOpacity, 1);
  assert.equal(editor.active, false);
  editor.reset(1);
  assert.deepEqual(activeShots(editor.snapshot()), [8]);
  assert.ok(editor.snapshot().softness.every(value => value === 0));
});
