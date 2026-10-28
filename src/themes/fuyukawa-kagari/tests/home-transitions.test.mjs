import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import { mountHomeTransitions } from "../lib/home-transitions.mjs";

const settle = () => new Promise(resolve => setImmediate(resolve));
const lock = "is-fuyukawa-transition-locked";
function fixture({ fine = true, reduce = false } = {}) {
  const animations = [], calls = [], timers = new Map();
  let serial = 0;
  class Node {
    events = new Map();
    dataset = {};
    attributes = new Map();
    values = new Set();
    classList = {
      add: (...names) => names.forEach(name => this.values.add(name)),
      remove: (...names) => names.forEach(name => this.values.delete(name)),
      contains: name => this.values.has(name),
      toggle: (name, value) => value ? this.values.add(name) : this.values.delete(name),
    };
    style = { setProperty() {} };
    hidden = false;
    querySelector() { return null; }
    querySelectorAll() { return []; }
    contains() { return false; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    remove() { this.removed = true; }
    addEventListener(type, callback) {
      if (!this.events.has(type)) this.events.set(type, new Set());
      this.events.get(type).add(callback);
    }
    removeEventListener(type, callback) { this.events.get(type)?.delete(callback); }
    dispatchEvent(event) { for (const callback of this.events.get(event.type) ?? []) callback(event); }
    emit(type, extra = {}) { this.dispatchEvent({ type, ...extra }); }
    animate(frames, timing) {
      let resolve, reject;
      const animation = {
        element: this, frames, timing, cancelled: false,
        finished: new Promise((yes, no) => { resolve = yes; reject = no; }),
        finish: () => resolve(),
        cancel() { this.cancelled = true; reject(new Error("cancelled")); },
      };
      animations.push(animation);
      return animation;
    }
  }
  const window = Object.assign(new Node(), {
    scrollY: 0, innerHeight: 800,
    Event: class { constructor(type) { this.type = type; } },
    getComputedStyle: () => ({ transform: "none" }),
    scrollTo({ top, behavior }) { calls.push({ top, behavior }); this.scrollY = top; },
    setTimeout(callback, duration) { const id = ++serial; timers.set(id, { callback, duration }); return id; },
    clearTimeout: id => timers.delete(id),
    requestAnimationFrame: () => 1, cancelAnimationFrame() {},
  });
  const root = new Node(), document = Object.assign(new Node(), { hidden: false, documentElement: root });
  const motion = Object.assign(new Node(), { matches: reduce });
  const pointer = Object.assign(new Node(), { matches: fine });
  window.matchMedia = query => query.includes("reduced-motion") ? motion : pointer;
  let screen;
  document.createElement = () => (screen = new Node());
  document.body = { append() {} };
  const hero = new Node(), profile = new Node(), heroScene = new Node();
  hero.querySelector = () => heroScene;
  hero.getBoundingClientRect = () => ({ top: -window.scrollY, bottom: 800 - window.scrollY });
  heroScene.querySelector = selector => selector === ".identity-terminal" ? profile : null;
  const heading = new Node(), leaves = Array.from({ length: 4 }, () => new Node());
  const railStage = Object.assign(new Node(), { clientHeight: 800 });
  const rail = Object.assign(new Node(), { dataset: { railMode: "scroll" }, offsetHeight: 2360 });
  rail.getBoundingClientRect = () => ({ top: 800 - window.scrollY });
  rail.querySelector = selector => selector === ".chapter-rail-stage" ? railStage : heading;
  rail.querySelectorAll = () => leaves;
  const next = new Node();
  next.getBoundingClientRect = () => ({ top: 3160 - window.scrollY });
  next.querySelectorAll = () => Array.from({ length: 3 }, () => new Node());
  document.querySelector = selector => ({
    "[data-hero-stage]": hero, "[data-manga-rail]": rail, ".home-content-bg": next,
  })[selector] ?? null;
  const controller = mountHomeTransitions(window, document);
  const wheel = (deltaY, extra = {}) => {
    const event = {
      type: "wheel", deltaY, deltaX: 0, deltaMode: 0, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, ...extra,
    };
    window.dispatchEvent(event);
    return event;
  };
  const enter = () => {
    const event = { deltaY: 80, preventDefault() { this.defaultPrevented = true; } };
    controller.enterContents(event);
    return event;
  };
  const complete = async () => {
    const opening = animations.at(-1);
    opening.finish();
    await settle();
    for (const animation of animations) animation.finish();
    await settle();
  };
  return { window, document, root, hero, heroScene, profile, rail, railStage, next, motion, pointer,
    controller, wheel, enter, complete, animations, calls, timers, get screen() { return screen; } };
}

test("the first white cover hides the instant relocation and staggers real chapter elements", async () => {
  const f = fixture();
  assert.equal(f.enter().defaultPrevented, true);
  assert.ok(f.root.classList.contains(lock));
  assert.equal(f.window.scrollY, 0, "no scroll displacement before opaque coverage");
  assert.equal(f.animations[0].frames[0].opacity, 0);
  assert.equal(f.animations[0].frames[1].opacity, 1);
  assert.equal(f.wheel(120).defaultPrevented, true);
  f.window.scrollY = 75;
  f.window.emit("scroll");
  assert.equal(f.window.scrollY, 0, "a drift is corrected to the current locked position");
  f.animations[0].finish();
  await settle();
  assert.equal(f.window.scrollY, 800);
  assert.ok(f.calls.every(call => call.behavior === "instant"));
  assert.deepEqual(f.animations.slice(1, 6).map(animation => animation.timing.delay), [0, 50, 100, 150, 200]);
  for (const animation of f.animations) animation.finish();
  await settle();
  assert.equal(f.controller.isRunning(), false);
  assert.equal(f.screen.hidden, true);
  assert.equal(f.root.classList.contains(lock), false);
  f.controller.cleanup();
});

test("the last active card is not the exit boundary and oversized wheels stop at the actual rail end", async () => {
  const f = fixture();
  f.window.scrollY = 2240;
  assert.equal(f.wheel(30).defaultPrevented, false);
  assert.equal(f.animations.length, 0);
  assert.equal(f.wheel(10, { deltaMode: 1 }).defaultPrevented, true);
  assert.equal(f.window.scrollY, 2360);
  assert.equal(f.animations.length, 0, "the rail still finishes before the next wheel changes scenes");
  assert.equal(f.wheel(60).defaultPrevented, true);
  assert.equal(f.animations[0].frames[0].clipPath, "inset(0 0 0 100%)");
  assert.equal(f.window.scrollY, 2360, "the outgoing scene stays fixed while the paper wipe closes");
  await f.complete();
  assert.equal(f.window.scrollY, 3160);
  assert.equal(f.wheel(160).defaultPrevented, false, "the tag scene and articles retain native forward scrolling");
  f.window.scrollY = 4400;
  assert.equal(f.wheel(600).defaultPrevented, false);
  f.controller.cleanup();
});

test("native scroll displacement beyond a wheel's prediction cannot expose both sections", async () => {
  for (const displaced of [2368, 2700, 3380]) {
    const f = fixture();
    f.window.scrollY = 2320;
    f.window.emit("scroll");
    assert.equal(f.wheel(20).defaultPrevented, false);
    f.window.scrollY = displaced;
    f.window.emit("scroll");
    assert.equal(f.window.scrollY, 2360, "actual displacement must return to the rail's settled endpoint");
    assert.equal(f.controller.isRunning(), true);
    await f.complete();
    assert.equal(f.window.scrollY, 3160);
    assert.equal(f.controller.isRunning(), false);
    f.window.scrollY = 3450;
    f.window.emit("scroll");
    assert.equal(f.controller.isRunning(), false, "later article scrolling stays native");
    f.controller.cleanup();
  }
});

test("a wheel arriving after the native scroll already entered the section gap still uses the cover", async () => {
  const f = fixture();
  f.window.scrollY = 2710;
  assert.equal(f.wheel(80).defaultPrevented, true);
  assert.equal(f.window.scrollY, 2360);
  assert.equal(f.controller.isRunning(), true);
  await f.complete();
  assert.equal(f.window.scrollY, 3160);
  f.controller.cleanup();
});

test("reverse native displacement crosses the same covered boundary while explicit navigation stays available", async () => {
  const f = fixture();
  f.document.emit("keydown", { key: "End" });
  f.window.scrollY = 3300;
  f.window.emit("scroll");
  f.wheel(-10);
  f.window.scrollY = 2800;
  f.window.emit("scroll");
  assert.equal(f.window.scrollY, 3160);
  assert.equal(f.controller.isRunning(), true);
  await f.complete();
  assert.equal(f.window.scrollY, 2360);
  f.document.emit("keydown", { key: "End" });
  f.window.scrollY = 4500;
  f.window.emit("scroll");
  assert.equal(f.controller.isRunning(), false);
  f.document.emit("click", { target: { closest: () => true } });
  f.window.scrollY = 3160;
  f.window.emit("scroll");
  assert.equal(f.controller.isRunning(), false);
  f.controller.cleanup();
});

test("reverse boundaries use the same cover and never reuse the hero's zero-position lock", async () => {
  const f = fixture();
  f.window.scrollY = 3300;
  assert.equal(f.wheel(-200).defaultPrevented, true);
  assert.equal(f.window.scrollY, 3160);
  f.wheel(-60);
  assert.equal(f.window.scrollY, 3160);
  assert.equal(f.animations[0].frames[0].clipPath, "inset(0 100% 0 0)");
  await f.complete();
  assert.equal(f.window.scrollY, 2360);
  f.window.scrollY = 900;
  f.wheel(-200);
  assert.equal(f.window.scrollY, 800);
  f.wheel(-60);
  await f.complete();
  assert.equal(f.window.scrollY, 0);
  f.controller.cleanup();
});

test("a deliberate reversal during an entrance queues a covered return instead of exposing a scroll jump", async () => {
  const f = fixture();
  f.enter();
  f.wheel(-10);
  f.wheel(-30);
  await f.complete();
  assert.equal(f.controller.isRunning(), true);
  assert.equal(f.window.scrollY, 800);
  await f.complete();
  assert.equal(f.window.scrollY, 0);
  assert.equal(f.controller.isRunning(), false);
  f.controller.cleanup();
});

test("a queued return from the tag scene only announces the final settled scene", async () => {
  const f = fixture();
  const ready = [];
  f.document.addEventListener("fuyukawa:home-scene-ready", () => ready.push(f.window.scrollY));
  f.window.scrollY = 2360;
  f.wheel(60);
  f.wheel(-40);
  await f.complete();
  assert.equal(f.window.scrollY, 3160);
  assert.equal(f.controller.isRunning(), true);
  assert.deepEqual(ready, [], "the tag rain must not start in the middle of a queued return");
  await f.complete();
  assert.equal(f.window.scrollY, 2360);
  assert.deepEqual(ready, [2360]);
  f.controller.cleanup();
});

test("resize, navigation, reduced motion, hidden pages and cleanup release every animation and lock", async () => {
  for (const action of [
    f => f.window.emit("resize"),
    f => f.window.emit("hashchange"),
    f => f.window.emit("pagehide"),
    f => { f.motion.matches = true; f.motion.emit("change"); },
    f => { f.document.hidden = true; f.document.emit("visibilitychange"); },
    f => f.document.emit("keydown", { key: "PageDown" }),
    f => f.document.emit("focusin"),
    f => f.document.emit("click", { target: { closest: () => true } }),
    f => f.controller.cleanup(),
  ]) {
    const f = fixture();
    f.enter();
    action(f);
    await settle();
    assert.equal(f.controller.isRunning(), false);
    assert.equal(f.root.classList.contains(lock), false);
    assert.equal(f.screen.hidden, true);
    assert.equal(f.timers.size, 0);
    assert.equal(f.window.scrollY, 0, "a late animation cannot relocate a cancelled route");
    f.controller.cleanup();
    assert.ok([...f.window.events.values(), ...f.document.events.values()].every(callbacks => callbacks.size === 0));
    assert.ok(f.screen.removed);
  }
});

test("native fallbacks, widgets, zoom and horizontal swipes bypass the scene gates", () => {
  for (const options of [{ reduce: true }, { fine: false }]) {
    const f = fixture(options);
    assert.notEqual(f.enter().defaultPrevented, true);
    f.window.scrollY = 2360;
    assert.equal(f.wheel(100).defaultPrevented, false);
    f.controller.cleanup();
  }
  const f = fixture();
  f.window.scrollY = 2360;
  for (const extra of [{ ctrlKey: true }, { deltaX: 300 }, { target: { closest: () => true } }]) {
    assert.equal(f.wheel(100, extra).defaultPrevented, false);
  }
  f.root.classList.add("is-notice-open");
  assert.equal(f.wheel(100).defaultPrevented, false);
  f.controller.cleanup();
});

test("hero calls the cover only on a new downward wheel after the profile transform has finished", async () => {
  const f = fixture();
  const source = await fs.readFile(new URL("../lib/home-hero.mjs", import.meta.url), "utf8");
  const context = vm.createContext({
    window: f.window, document: f.document, history: {}, location: { hash: "" }, transitions: f.controller,
    requestAnimationFrame: f.window.requestAnimationFrame, cancelAnimationFrame: f.window.cancelAnimationFrame,
  });
  vm.runInContext(source.replace("export function", "function") + "\nvar stopHero = mountHomeHero(transitions);", context);
  f.wheel(200);
  [...f.timers.values()].find(timer => timer.duration === 260).callback();
  f.wheel(80);
  assert.equal(f.controller.isRunning(), false);
  f.profile.emit("transitionend", { target: f.profile, propertyName: "opacity" });
  assert.equal(f.controller.isRunning(), false);
  f.profile.emit("transitionend", { target: f.profile, propertyName: "transform" });
  assert.equal(f.controller.isRunning(), false);
  f.wheel(80);
  assert.equal(f.controller.isRunning(), true);
  assert.equal(f.window.scrollY, 0);
  context.stopHero();
  f.controller.cleanup();
  await settle();
});
