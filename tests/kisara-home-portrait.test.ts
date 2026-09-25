import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { bindHomeEventPortrait, homePortraitLayout } from "../src/themes/kisara/lib/homeEventPortrait.ts";

function fixture(reduced = false) {
  class Element extends EventTarget {
    dataset: Record<string, string> = {};
    attributes = new Set<string>();
    hidden = false;
    image = { loading: "lazy" };
    style = { setProperty(_key: string, _value: string) {} };
    setAttribute(key: string) { this.attributes.add(key); }
    removeAttribute(key: string) { this.attributes.delete(key); }
    hasAttribute(key: string) { return this.attributes.has(key); }
    querySelector(_selector: string): unknown { return this.image; }
  }
  const root = Object.assign(new Element(), {
    clientWidth: 1440, clientHeight: 900,
    getBoundingClientRect: () => ({ width: 1440, height: 900 }),
    querySelectorAll: (selector: string) => selector === "[data-portrait-knife]" ? knives : frames,
  });
  const rig = new Element(), bubble = new Element();
  const knives = Array.from({ length: 3 }, () => new Element());
  const frames = Array.from({ length: 4 }, (_, index) => Object.assign(new Element(), { hidden: index !== 0 }));
  root.querySelector = selector => selector === "[data-portrait-rig]" ? rig : bubble;
  let now = 0, id = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const motion = Object.assign(new EventTarget(), { matches: reduced });
  const window = Object.assign(new EventTarget(), {
    matchMedia: () => motion,
    setTimeout(callback: () => void, delay: number) {
      timers.set(++id, { at: now + delay, callback });
      return id;
    },
    clearTimeout(key: number) { timers.delete(key); },
  });
  const globals = { window, performance: { now: () => now }, ResizeObserver: undefined };
  const originals = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.entries(globals).forEach(([key, value]) => Object.defineProperty(globalThis, key, { configurable: true, value }));
  const runtime = bindHomeEventPortrait(root as unknown as HTMLElement);
  const advance = (elapsed: number) => {
    const end = now + elapsed;
    for (;;) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      now = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
    }
    now = end;
  };
  return {
    runtime, root, rig, bubble, knives, frames, motion, timers, advance,
    destroy() {
      runtime.destroy();
      originals.forEach((descriptor, key) => {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      });
    },
  };
}

test("003 portrait stays attached to the mapped knife tip and its bubble fits narrow and tall screens", () => {
  for (const [width, height] of [[320, 760], [390, 844], [768, 1200], [820, 1180], [1440, 900], [2560, 1080]]) {
    const box = homePortraitLayout(width, height);
    const scale = box.mediaWidth / 1920;
    assert.ok(box.mediaWidth >= width * 1.12 && box.mediaHeight >= height * 1.12);
    assert.ok(Math.abs(box.portraitX + box.size * .46 - (750 * scale + box.x)) < .001);
    assert.ok(Math.abs(box.portraitY + box.size * .12 - (373 * scale + box.y)) < .001);
    const half = box.bubbleWidth / 2;
    assert.ok(box.portraitX - half >= 19.99, `${width}: bubble left edge`);
    assert.ok(box.portraitX + half <= width - 19.99, `${width}: bubble right edge`);
    assert.ok(box.portraitY + box.size / 2 + 30 + 200 < height);
  }
});

test("003 uses unzoomed local geometry so media still covers the full 90 percent stage", () => {
  const f = fixture();
  const values = new Map<string, number>();
  f.root.getBoundingClientRect = () => ({ width: 1296, height: 810 });
  f.root.style.setProperty = (key: string, value: string) => { values.set(key, Number.parseFloat(value)); };
  try {
    // This runtime callback is also invoked after a ResizeObserver notification.
    window.dispatchEvent(new Event("resize"));
    const width = values.get("--board-width")!, height = values.get("--board-height")!;
    const x = values.get("--board-x")!, y = values.get("--board-y")!;
    assert.ok(x <= 0 && y <= 0);
    assert.ok((width + x) * .9 >= 1296);
    assert.ok((height + y) * .9 >= 810);
    const expected = homePortraitLayout(1440, 900);
    assert.equal(values.get("--portrait-x"), expected.portraitX);
    assert.equal(values.get("--portrait-y"), expected.portraitY);
  } finally { f.destroy(); }
});

test("003 expanded reaction and mobile caption have separate space inside the scene", () => {
  for (const [width, height] of [[320, 820], [390, 844], [760, 820], [768, 1200], [1280, 820], [1920, 1080]]) {
    const box = homePortraitLayout(width, height);
    const imageHeight = (box.bubbleWidth - 32 - 52 - 12) * .75;
    const bubbleBottom = box.portraitY + box.size / 2 + 24 + 32 + imageHeight + 12 + 31;
    assert.ok(bubbleBottom < height, `${width}: reaction bottom`);
    if (width <= 760) {
      const captionTop = box.portraitY + box.size / 2 + 284;
      assert.ok(captionTop - bubbleBottom >= 16, `${width}: caption gap`);
      assert.ok(captionTop + 145 < height, `${width}: caption bottom`);
    }
  }
});

test("003 reveals the paired bubble immediately and lands three short strikes before cycling", () => {
  const f = fixture();
  try {
    f.runtime.reveal();
    assert.equal(f.root.hasAttribute("data-bubble-ready"), true);
    f.advance(5000);
    assert.equal(f.timers.size, 0);
    f.runtime.setActive(true);
    f.advance(219);
    assert.ok(f.knives.every(knife => !knife.hasAttribute("data-landed")));
    for (let index = 0; index < 3; index++) {
      f.advance(index === 0 ? 1 : 260);
      assert.equal(f.knives[index].hasAttribute("data-landed"), true);
      assert.notEqual(f.rig.dataset.impact, String(index + 1));
      f.advance(120);
      assert.equal(f.rig.dataset.impact, String(index + 1));
    }
    f.advance(260);
    assert.equal(f.root.hasAttribute("data-bubble-ready"), true);
    assert.ok(f.frames.every(frame => frame.image.loading === "eager"));
    for (const expected of [1, 2, 3, 0]) {
      f.advance(3200);
      assert.deepEqual(f.frames.map(frame => frame.hidden), f.frames.map((_, index) => index !== expected));
    }
  } finally { f.destroy(); }
});

test("003 pauses the remaining strike delay offscreen without a catch-up burst", () => {
  const f = fixture();
  try {
    f.runtime.setActive(true);
    f.runtime.reveal();
    f.advance(250);
    f.runtime.setActive(false);
    assert.equal(f.timers.size, 0);
    f.advance(10000);
    assert.equal(f.rig.dataset.impact, undefined);
    f.runtime.setActive(true);
    f.advance(89);
    assert.equal(f.rig.dataset.impact, undefined);
    f.advance(1);
    assert.equal(f.rig.dataset.impact, "1");
    f.advance(4000);
    f.runtime.setActive(false);
    const hidden = f.frames.map(frame => frame.hidden);
    f.advance(10000);
    assert.deepEqual(f.frames.map(frame => frame.hidden), hidden);
  } finally { f.destroy(); }
});

test("003 bubble can be clicked during knife entry without cancelling the strikes", () => {
  const f = fixture();
  try {
    f.runtime.setActive(true);
    f.runtime.reveal();
    f.bubble.dispatchEvent(new Event("click"));
    assert.equal(f.frames[1].hidden, false);
    assert.equal(f.timers.size, 1);
    f.advance(1400);
    assert.equal(f.rig.dataset.impact, "3");
    assert.ok(f.knives.every(knife => knife.hasAttribute("data-landed")));
    f.runtime.reveal();
    assert.equal(f.timers.size, 1);
    assert.equal(f.frames[1].hidden, false);
  } finally { f.destroy(); }
});

test("003 uses outlined single-edge blades behind the portrait rim and a matching impact clock", () => {
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const css = read("src/themes/kisara/styles/home-event-video.css");
  const component = read("src/themes/kisara/components/KisaraHomeEventVideo.astro");
  assert.match(component, /class="kisara-home-knife-art" viewBox="0 0 64 224"/);
  assert.doesNotMatch(component, /kisara-home-knife-handle|kisara-home-knife-blade/);
  assert.match(css, /\.kisara-home-portrait-photo \{[^}]*z-index: 2/);
  assert.match(css, /\.kisara-home-knife \{[^}]*z-index: 1/);
  assert.match(css, /kisara-knife-arrive 120ms/);
  assert.match(css, /prefers-reduced-motion: reduce[^]*animation: none/);
  assert.doesNotMatch(css, /rotate\(-1[126]deg\)|translateY\(-130px\)/);
});

test("003 reduced motion settles without timers while all four pairs remain keyboard-clickable", () => {
  const f = fixture(true);
  try {
    f.runtime.setActive(true);
    f.runtime.reveal();
    assert.equal(f.rig.dataset.impact, "3");
    assert.equal(f.root.hasAttribute("data-bubble-ready"), true);
    assert.equal(f.timers.size, 0);
    f.bubble.dispatchEvent(new Event("click"));
    assert.equal(f.frames[1].hidden, false);
    f.motion.matches = false;
    f.motion.dispatchEvent(new Event("change"));
    f.advance(3200);
    assert.equal(f.frames[2].hidden, false);
    f.motion.matches = true;
    f.motion.dispatchEvent(new Event("change"));
    assert.equal(f.timers.size, 0);
  } finally { f.destroy(); }
});

test("003 bubble holds on hover or focus, and reset and destruction clear the full presentation", () => {
  const f = fixture();
  try {
    f.runtime.setActive(true);
    f.runtime.reveal();
    f.advance(2550);
    f.bubble.dispatchEvent(new Event("focus"));
    f.advance(9000);
    assert.equal(f.frames[0].hidden, false);
    f.bubble.dispatchEvent(new Event("click"));
    assert.equal(f.frames[1].hidden, false);
    f.bubble.dispatchEvent(new Event("pointerenter"));
    f.bubble.dispatchEvent(new Event("blur"));
    assert.equal(f.timers.size, 0);
    f.bubble.dispatchEvent(new Event("pointerleave"));
    f.advance(3200);
    assert.equal(f.frames[2].hidden, false);
    f.runtime.reset();
    assert.equal(f.timers.size, 0);
    assert.equal(f.root.hasAttribute("data-portrait-ready"), false);
    assert.equal(f.rig.dataset.impact, "0");
    assert.ok(f.knives.every(knife => !knife.hasAttribute("data-landed")));
    assert.equal(f.frames[0].hidden, false);
    f.runtime.reveal();
    f.runtime.destroy();
    assert.equal(f.timers.size, 0);
    f.runtime.setActive(true);
    f.bubble.dispatchEvent(new Event("click"));
    assert.equal(f.timers.size, 0);
  } finally { f.destroy(); }
});
