import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryEditor, memoryEdits } from "../src/themes/kisara/lib/gateMemoryEdit.ts";
import { memoryTimeline } from "../src/themes/kisara/lib/gateStory.ts";
import { advanceGateAutoplay } from "../src/themes/kisara/lib/gateAutoplay.ts";

const ready = () => true;
const activeShots = (frame: ReturnType<ReturnType<typeof createMemoryEditor>["snapshot"]>) =>
  frame.weights.flatMap((weight, index) => weight > 0 ? [index] : []);

test("action edits cut cleanly in both directions without flickering at the boundary", () => {
  for (const index of [1, 2, 3]) {
    const start = memoryTimeline[index].start;
    const editor = createMemoryEditor(start - 0.01);
    assert.deepEqual(activeShots(editor.update(start + 0.005, 0, ready)), [index]);
    for (const jitter of [-0.001, 0.001, 0, -0.0005, 0.0005]) {
      assert.deepEqual(activeShots(editor.update(start + jitter, 16, ready)), [index]);
      assert.equal(editor.active, false);
    }
    assert.deepEqual(activeShots(editor.update(start - 0.005, 0, ready)), [index - 1]);
    assert.equal(editor.active, false);
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
  for (let i = 0; i < 8; i++) editor.update(0.51, 16, ready);
  assert.deepEqual(activeShots(editor.snapshot()), [6]);
  assert.equal(editor.active, false);
});

test("exposure and impact edits keep exactly one solid shot and reverse their cover", () => {
  for (const index of [0, 4, 5]) {
    const start = memoryTimeline[index].start;
    const editor = createMemoryEditor(start - 0.01);
    editor.update(start + 0.005, 0, ready);
    const mid = editor.update(start + 0.005, memoryEdits[index].duration * 0.4, ready);
    assert.ok(mid.bridgeOpacity > 0);
    assert.deepEqual(editor.update(start - 0.005, 0, ready), mid);
    for (let i = 0; i < 10; i++) {
      const frame = editor.update(start - 0.005, 10, ready);
      assert.equal(frame.baseOpacity + frame.weights.reduce((sum, value) => sum + value, 0), 1);
      assert.ok(frame.weights.every(value => value === 0 || value === 1));
    }
    assert.equal(editor.active, false);
    assert.equal(editor.snapshot().bridgeOpacity, 0);
  }
});

test("decoding delays retain the old shot and cannot consume the eventual transition", () => {
  const editor = createMemoryEditor(0.49);
  const old = editor.snapshot();
  for (let i = 0; i < 100; i++) assert.deepEqual(editor.update(0.51, 500, () => false), old);
  assert.equal(editor.active, false);
  assert.deepEqual(editor.update(0.51, 10000, ready), old);
  assert.equal(editor.active, true);
  assert.ok(editor.update(0.51, 30, ready).weights[6] > 0);
  const skipped = editor.update(0.9, 0, ready);
  assert.deepEqual(activeShots(skipped), [8]);
  assert.equal(editor.active, false);
  assert.equal(skipped.bridgeOpacity, 0);
});

test("reduced motion removes all exposure flashes and never uncovers the blue base", () => {
  const editor = createMemoryEditor();
  editor.update(0.03, 0, ready, true);
  for (let i = 0; i < 10; i++) {
    const frame = editor.update(0.03, 10, ready, true);
    assert.equal(frame.bridgeOpacity, 0);
    assert.equal(frame.weights[0] + (1 - frame.weights[0]) * frame.baseOpacity, 1);
  }
  editor.update(0, 0, ready, true);
  for (let i = 0; i < 10; i++) {
    const frame = editor.update(0, 10, ready, true);
    assert.equal(frame.bridgeOpacity, 0);
    assert.equal(frame.weights[0] + (1 - frame.weights[0]) * frame.baseOpacity, 1);
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

test("reset and a background time jump cannot leave a cover or replay an old edit", () => {
  const editor = createMemoryEditor(0.49);
  editor.update(0.51, 0, ready);
  const bounded = editor.update(0.51, 30000, ready);
  assert.ok(bounded.weights[6] < 0.5);
  editor.reset(0);
  assert.equal(editor.snapshot().baseOpacity, 1);
  assert.equal(editor.active, false);
  editor.reset(1);
  assert.deepEqual(activeShots(editor.snapshot()), [8]);
  assert.equal(editor.snapshot().bridgeOpacity, 0);
});
