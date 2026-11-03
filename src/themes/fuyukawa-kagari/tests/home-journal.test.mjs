import assert from "node:assert/strict";
import test from "node:test";
import { mountHomeJournal } from "../lib/home-journal.mjs";

function emitter(extra = {}) {
  const events = new Map();
  return Object.assign({
    events,
    addEventListener(type, callback) {
      if (!events.has(type)) events.set(type, new Set());
      events.get(type).add(callback);
    },
    removeEventListener(type, callback) { events.get(type)?.delete(callback); },
    emit(type, values = {}) { for (const callback of events.get(type) ?? []) callback({ type, ...values }); },
  }, extra);
}

function fixture({ reduce = false, waapi = true, observer = true } = {}) {
  const animations = [], frames = new Map();
  const doc = emitter({ hidden: false }), reduced = emitter({ matches: reduce });
  let serial = 0, intersection;
  const elements = Array.from({ length: 5 }, () => ({
    animate: waapi ? (keyframes, timing) => {
      const animation = { keyframes, timing, currentTime: null, paused: false, cancelled: false,
        pause() { this.paused = true; }, cancel() { this.cancelled = true; } };
      animations.push(animation);
      return animation;
    } : undefined,
  }));
  const win = emitter({
    innerHeight: 800, scrollY: 0, matchMedia: () => reduced,
    requestAnimationFrame(callback) { frames.set(++serial, callback); return serial; },
    cancelAnimationFrame(id) { frames.delete(id); },
    IntersectionObserver: observer ? class {
      constructor(callback) { this.callback = callback; intersection = this; }
      observe(target) { this.target = target; }
      disconnect() { this.disconnected = true; }
    } : undefined,
  });
  const root = emitter({ ownerDocument: doc, querySelectorAll: () => elements,
    getBoundingClientRect: () => ({ top: 1200 - win.scrollY }) });
  const cleanup = mountHomeJournal(root, win);
  const step = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); };
  const scroll = y => { win.scrollY = y; win.emit("scroll"); step(); };
  return { win, doc, root, reduced, animations, elements, frames, step, scroll, cleanup, get intersection() { return intersection; } };
}

test("native scrolling scrubs one paused journal entrance in both directions without rebuilding it", () => {
  const f = fixture();
  assert.equal(f.animations.length, 5);
  assert.ok(f.animations.every(animation => animation.paused && animation.currentTime === 0));
  assert.deepEqual(f.animations.map(animation => animation.timing.delay), [0, 50, 100, 150, 200]);
  f.scroll(550);
  assert.ok(f.animations.every(animation => animation.currentTime === 220));
  f.scroll(900);
  assert.ok(f.animations.every(animation => animation.currentTime === 440));
  f.scroll(550);
  assert.ok(f.animations.every(animation => animation.currentTime === 220));
  assert.equal(f.animations.length, 5);
  assert.equal(f.win.events.has("wheel"), false);
  assert.equal(f.win.events.has("touchmove"), false);
  f.cleanup();
});

test("large scroll jumps settle correctly even when intersection callbacks report only the exit", () => {
  const f = fixture();
  f.win.scrollY = 1700;
  f.intersection.callback([{ isIntersecting: false }]);
  assert.ok(f.animations.every(animation => animation.currentTime === 440));
  f.win.scrollY = 0;
  f.intersection.callback([{ isIntersecting: false }]);
  assert.ok(f.animations.every(animation => animation.currentTime === 0));
  f.win.scrollY = 550;
  f.intersection.callback([{ isIntersecting: true }]);
  assert.ok(f.animations.every(animation => animation.currentTime === 220));
  f.cleanup();
});

test("keyboard and focus navigation cancel the effects so partially entered articles remain readable", () => {
  for (const type of ["focusin", "keydown"]) {
    const f = fixture();
    f.scroll(550);
    if (type === "focusin") f.root.emit(type);
    else f.doc.emit(type, { key: "End" });
    assert.ok(f.animations.every(animation => animation.cancelled));
    f.scroll(0);
    assert.equal(f.animations.length, 5);
    f.cleanup();
  }
});

test("reduced motion, hidden tabs, page restoration and disposal never leave hidden content or live handlers", () => {
  const f = fixture({ reduce: true });
  assert.equal(f.animations.length, 0);
  f.reduced.matches = false; f.reduced.emit("change");
  assert.equal(f.animations.length, 5);
  f.doc.hidden = true; f.scroll(900);
  assert.ok(f.animations.every(animation => animation.currentTime === 0));
  f.doc.hidden = false; f.doc.emit("visibilitychange"); f.step();
  assert.ok(f.animations.every(animation => animation.currentTime === 440));
  f.win.emit("pagehide");
  assert.ok(f.animations.every(animation => animation.cancelled));
  f.win.emit("pageshow");
  assert.equal(f.animations.length, 10);
  assert.ok(f.animations.slice(5).every(animation => animation.currentTime === 440));
  f.reduced.matches = true; f.reduced.emit("change");
  assert.ok(f.animations.every(animation => animation.cancelled));
  f.cleanup();
  f.intersection.callback([{ isIntersecting: true }]);
  f.win.emit("pageshow");
  assert.equal(f.animations.length, 10);
  assert.equal(f.frames.size, 0);
  assert.equal(f.intersection.disconnected, true);
  for (const node of [f.win, f.doc, f.root, f.reduced]) assert.ok([...node.events.values()].every(handlers => !handlers.size));
});

test("missing WAAPI leaves the document static and missing observers still permit native scroll updates", () => {
  const staticView = fixture({ waapi: false });
  assert.equal(staticView.animations.length, 0);
  assert.equal(staticView.win.events.size, 0);
  staticView.cleanup();
  const fallback = fixture({ observer: false });
  fallback.scroll(900);
  assert.ok(fallback.animations.every(animation => animation.currentTime === 440));
  fallback.cleanup();
  mountHomeJournal(null, {})();
});
