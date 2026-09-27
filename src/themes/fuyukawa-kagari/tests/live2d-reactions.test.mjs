import assert from "node:assert/strict";
import test from "node:test";
import { createLive2dReactions, live2dGazeTarget } from "../lib/live2d-input.mjs";

class Target {
  events = new Map();
  hidden = false;
  classList = { contains: () => false };
  addEventListener(name, fn) {
    if (!this.events.has(name)) this.events.set(name, new Set());
    this.events.get(name).add(fn);
  }
  removeEventListener(name, fn) { this.events.get(name)?.delete(fn); }
  dispatch(name, event = {}) { for (const fn of this.events.get(name) ?? []) fn(event); }
}

function fixture({ reduced = false, delayed = false } = {}) {
  const doc = new Target(), win = new Target(), root = new Target(), canvas = new Target();
  const media = new Target();
  media.matches = reduced;
  let now = 1000, timerId = 0, ready = !delayed, draws = 0;
  const timers = new Map();
  win.performance = { now: () => now };
  win.matchMedia = () => media;
  win.setTimeout = (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId; };
  win.clearTimeout = (id) => timers.delete(id);
  canvas.getBoundingClientRect = () => ({ left: 14, top: 300, width: 280, height: 400 });
  const ids = ["ParamAngleX", "ParamAngleY", "ParamAngleZ", "ParamBodyAngleX", "ParamEyeBallX", "ParamEyeBallY",
    "ParamEyeLOpen", "ParamEyeROpen", "ParamEyeLSmile", "ParamEyeRSmile", "ParamMouthForm", "ParamMouthOpenY",
    "ParamBrowLY", "ParamBrowRY", "ParamHairSide"];
  const defaults = [0, 0, 0, 0, 0, 0, 1, 1, 0.5, 0.5, 0, 0, 0, 0, 0];
  const values = [...defaults];
  let rendered = {}, physicsPose = {};
  const get = (id) => values[ids.indexOf(id)];
  const raw = { parameters: { ids, values }, update() {
    draws++;
    rendered = Object.fromEntries(ids.map((id, i) => [id, values[i]]));
  } };
  // The real SDK has THREE objects. CubismModel has methods, NOT .parameters.
  const model = {
    getModel: () => raw,
    getParameterMinimumValue: (i) => i < 3 ? -30 : i === 3 ? -10 : [6, 7, 8, 9, 11].includes(i) ? 0 : -1,
    getParameterMaximumValue: (i) => i < 3 ? 30 : i === 3 ? 10 : 1,
    getParameterValueByIndex: (i) => values[i],
    setParameterValueByIndex: (i, value) => { values[i] = value; },
    update() { raw.update(); }
  };
  let runtimeBlink = 1;
  const physics = { evaluate() { physicsPose = { x: get("ParamAngleX"), z: get("ParamAngleZ") }; } };
  const outer = {
    _model: model, _physics: physics, getModel: () => ready ? model : null,
    update() {
      if (!ready) return;
      // Runtime loads saved motion state, breath/drag, physics, then generates the mesh once.
      values.splice(0, values.length, ...defaults);
      values[0] = 30;
      values[2] = -30;
      values[6] = values[7] = runtimeBlink;
      physics.evaluate();
      model.update();
    }
  };
  const original = { outer: outer.update, model: model.update, physics: physics.evaluate };
  class AppDelegate {
    constructor() {
      this.mouseMoveEventListener = () => { throw new Error("legacy coordinates/hitTest ran"); };
      this.mouseEndedEventListener = () => {};
      this.tapEventListener = () => {};
      doc.addEventListener("mousemove", this.mouseMoveEventListener);
      doc.addEventListener("mouseout", this.mouseEndedEventListener);
      doc.addEventListener("pointerdown", this.tapEventListener);
      this.subdelegates = { at: () => ({ getLive2DManager: () => ({ _models: { at: () => outer }, onDrag() {} }) }) };
    }
    run() { return "running"; }
  }
  const originalRun = AppDelegate.prototype.run;
  const controller = createLive2dReactions(AppDelegate, doc, win, () => 0.25);
  controller.start(root, canvas);
  const delegate = new AppDelegate();
  assert.equal(delegate.run(), "running");
  const step = (ms = 16) => { now += ms; outer.update(); return rendered; };
  const event = (extra = {}) => ({ target: canvas, pointerType: "mouse", button: 0, isPrimary: true,
    pointerId: 1, clientX: 154, clientY: 444, ...extra });
  const tap = (extra = {}) => { root.dispatch("pointerdown", event(extra)); doc.dispatch("pointerup", event(extra)); };
  const fireTimer = (ms) => {
    const entry = [...timers].find(([, value]) => value.ms === ms);
    assert.ok(entry, "expected timer " + ms);
    timers.delete(entry[0]); entry[1].fn();
  };
  return { doc, win, root, canvas, media, controller, delegate, outer, model, physics, original, originalRun,
    AppDelegate, event, tap, step, fireTimer, timers, get draws() { return draws; },
    get physicsPose() { return physicsPose; }, setReady: () => { ready = true; },
    setBlink: (value) => { runtimeBlink = value; } };
}

test("gaze uses viewport coordinates, survives scroll offsets and is radially bounded", () => {
  const canvas = { getBoundingClientRect: () => ({ left: 14, top: 300, width: 280, height: 400 }) };
  const faceAnchor = live2dGazeTarget({ clientX: 114.8, clientY: 380 }, canvas);
  assert.ok(Math.abs(faceAnchor.x) < 0.001 && Math.abs(faceAnchor.y) < 0.001);
  const first = live2dGazeTarget({ clientX: 250, clientY: 200, pageY: 200 }, canvas);
  const scrolled = live2dGazeTarget({ clientX: 250, clientY: 200, pageY: 5200 }, canvas);
  assert.deepEqual(first, scrolled);
  for (const clientX of [-1e9, 0, 1e9]) for (const clientY of [-1e9, 0, 1e9]) {
    const result = live2dGazeTarget({ clientX, clientY }, canvas);
    assert.ok(Math.hypot(result.x, result.y) <= 1.000001);
  }
  assert.deepEqual(live2dGazeTarget(null, canvas), { x: 0, y: 0 });
});

test("actual three-layer SDK lifecycle composes a visible wink before exactly one mesh update", () => {
  const f = fixture();
  f.tap();
  const pose = f.step(350);
  assert.equal(f.draws, 1);
  assert.equal(pose.ParamEyeROpen, 0);
  assert.equal(pose.ParamEyeLOpen, 1);
  assert.equal(pose.ParamMouthForm, -0.6);
  assert.equal(pose.ParamMouthOpenY, 0.42);
  assert.ok(pose.ParamEyeLSmile > 0.25, "the open eye is not forced into an extreme smile");
  assert.equal(f.physicsPose.x, pose.ParamAngleX);
  assert.equal(f.physicsPose.z, pose.ParamAngleZ);
  const neutral = f.step(1800);
  assert.equal(neutral.ParamEyeROpen, 1);
  assert.equal(neutral.ParamMouthOpenY, 0);
  assert.equal(neutral.ParamMouthForm, 0);
  f.tap();
  assert.equal(f.step(350).ParamEyeLOpen, 0, "alternate wink");
  f.controller.destroy();
});

test("capture-induced pointerleave does not cancel a click, but a round-trip drag does", () => {
  const f = fixture();
  f.root.dispatch("pointerdown", f.event());
  f.canvas.dispatch("pointerleave", f.event());
  f.doc.dispatch("pointerup", f.event());
  assert.equal(f.step(350).ParamEyeROpen, 0);
  f.step(1800);
  f.root.dispatch("pointerdown", f.event());
  f.doc.dispatch("pointermove", f.event({ clientX: 230 }));
  f.doc.dispatch("pointerup", f.event());
  assert.equal(f.step(350).ParamEyeLOpen, 1);
  f.tap({ pointerType: "touch" });
  assert.equal(f.step(350).ParamEyeLOpen, 0, "touch works through the same captured event path");
  f.controller.destroy();
});

test("tracking eases eyes before head, clamps diagonals, feeds physics bounded angles and recenters", () => {
  const f = fixture();
  const event = f.event({ clientX: 100000, clientY: -100000 });
  f.doc.dispatch("pointermove", event);
  const first = f.step();
  assert.ok(first.ParamEyeBallX / 0.45 > first.ParamAngleX / 8);
  let pose;
  for (let i = 0; i < 200; i++) pose = f.step();
  assert.ok(Math.abs(pose.ParamAngleX) <= 8 && Math.abs(pose.ParamAngleY) <= 5.5);
  assert.ok(Math.abs(pose.ParamEyeBallX) <= 0.45 && Math.abs(pose.ParamEyeBallY) <= 0.34);
  assert.equal(pose.ParamAngleZ, 0);
  assert.ok(Math.abs(f.physicsPose.x) <= 8);
  assert.equal(event.clientX, 100000, "shared browser event is not rewritten");
  f.win.dispatch("blur");
  for (let i = 0; i < 200; i++) pose = f.step();
  assert.ok(Math.abs(pose.ParamAngleX) < 0.001 && Math.abs(pose.ParamEyeBallX) < 0.001);
  f.controller.destroy();
});

test("hover changes the rendered face and does not erase runtime blinks", () => {
  const f = fixture();
  f.canvas.dispatch("pointerenter", f.event());
  let pose;
  for (let i = 0; i < 40; i++) pose = f.step();
  assert.ok(pose.ParamEyeLSmile < 0.42 && pose.ParamMouthForm < -0.2);
  f.setBlink(0.25);
  assert.equal(f.step().ParamEyeLOpen, 0.25);
  f.controller.destroy();
});

test("idle expressions and independent blinks render, reduced motion keeps deliberate expressions only", () => {
  const f = fixture();
  f.fireTimer(11250);
  assert.ok(f.step(350).ParamMouthForm < -0.5);
  f.step(4000);
  assert.equal(f.step(85).ParamEyeLOpen, 0);
  f.controller.destroy();
  const quiet = fixture({ reduced: true });
  assert.equal([...quiet.timers.values()].some(({ ms }) => ms > 1000), false);
  quiet.tap();
  const pose = quiet.step(350);
  assert.equal(pose.ParamEyeROpen, 0);
  assert.equal(pose.ParamAngleX, 0);
  assert.equal(pose.ParamAngleZ, 0);
  quiet.controller.destroy();
});

test("late model loading, hide/show and disposal restore only owned hooks and listeners", () => {
  const f = fixture({ delayed: true });
  assert.equal(f.model.update, f.original.model);
  assert.doesNotThrow(() => f.doc.dispatch("mousemove"), "legacy loading-time hitTest is detached");
  f.setReady(); f.fireTimer(120);
  assert.notEqual(f.model.update, f.original.model);
  f.controller.stop();
  assert.equal(f.model.update, f.original.model);
  assert.equal(f.outer.update, f.original.outer);
  assert.equal(f.physics.evaluate, f.original.physics);
  assert.equal(f.timers.size, 0);
  f.controller.start(f.root, f.canvas);
  f.tap(); assert.equal(f.step(350).ParamEyeROpen, 0);
  f.controller.destroy();
  assert.equal(f.AppDelegate.prototype.run, f.originalRun);
  assert.equal(f.timers.size, 0);
  assert.ok(f.doc.events.get("mousemove").has(f.delegate.mouseMoveEventListener));
  for (const target of [f.root, f.canvas, f.win]) {
    for (const handlers of target.events.values()) assert.equal(handlers.size, 0);
  }
});
