import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import { getHomeChapterProgress } from "../src/themes/kisara/lib/homeScrollRail.ts";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const runtime = read("src/themes/kisara/lib/layoutRuntime.js");

function mount({ home = true, y = 900, gate = false } = {}) {
  class Node extends EventTarget {
    dataset: Record<string, string> = {};
    classes = new Set<string>();
    attributes = new Map<string, string>();
    properties = new Map<string, string>();
    classList = {
      contains: (key: string) => this.classes.has(key),
      toggle: (key: string, active: boolean) => active ? this.classes.add(key) : this.classes.delete(key),
    };
    style = { setProperty: (key: string, value: string) => this.properties.set(key, value) };
    get clientHeight() { return this.classes.has("is-home-chapters") ? 260 : 800; }
    getBoundingClientRect() { return { height: this.clientHeight * .9 }; }
    setAttribute(key: string, value: string) { this.attributes.set(key, value); }
    querySelectorAll() { return marks; }
  }
  const marks = home ? Array.from({ length: 5 }, () => new Node()) : [];
  const rail = new Node();
  const body = new Node();
  if (home) body.classes.add("kisara-home-page");
  const source = new Node();
  Object.assign(source.dataset, { kisaraScrollActive: String(gate), kisaraScrollProgress: "0.45", kisaraScrollStage: "outer-bind" });
  const root = { scrollHeight: 5500, dataset: { theme: "kisara" } };
  const win = Object.assign(new EventTarget(), { scrollY: y, innerHeight: 900, innerWidth: 1440 });
  let measurements = 0;
  const stops = [900, 1900, 3200, 4000, 4500].map(top => ({
    getBoundingClientRect() { measurements++; return { top: top - win.scrollY }; },
  }));
  const doc = Object.assign(new EventTarget(), {
    body, documentElement: root, scrollingElement: root,
    querySelector: (selector: string) => selector === "[data-kisara-scrollbar]" ? rail
      : selector === "[data-kisara-gate]" && home ? source : null,
    querySelectorAll: () => stops,
  });
  const frames = new Map<number, () => void>();
  let serial = 0;
  let resize = () => {};
  const code = runtime.slice(runtime.indexOf("const gateStageLabels"), runtime.indexOf("  const closePanel ="))
    .replace("export const initKisaraLayoutRuntime", "const initKisaraLayoutRuntime")
    + "}; initKisaraLayoutRuntime();";
  vm.runInNewContext(code, {
    window: win, document: doc, HTMLElement: Node, Element: Node, AbortController, CustomEvent,
    getHomeChapterProgress,
    requestAnimationFrame: (fn: () => void) => { frames.set(++serial, fn); return serial; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    ResizeObserver: class { constructor(fn: () => void) { resize = fn; } observe() {} },
  });
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); };
  const transition = (active: boolean) => win.dispatchEvent(new CustomEvent("kisara:home-transition", { detail: { active } }));
  const scroll = (value: number) => { win.scrollY = value; win.dispatchEvent(new Event("scroll")); flush(); };
  flush();
  return { rail, marks, root, win, scroll, transition, flush, resize: () => { resize(); flush(); }, measured: () => measurements };
}

test("Unequal chapters occupy equal rail intervals with continuous touch progress", () => {
  const tops = [900, 1900, 3200, 4000, 4500];
  assert.equal(getHomeChapterProgress(tops, 0), null);
  assert.equal(getHomeChapterProgress([], 900), null);
  tops.forEach((y, index) => assert.deepEqual(getHomeChapterProgress(tops, y), { index, progress: index / 4 }));
  assert.equal(getHomeChapterProgress(tops, 2550)?.progress, .375);
  assert.equal(getHomeChapterProgress(tops, 9999)?.progress, 1);
  assert.equal(getHomeChapterProgress([900, 1900, 1900], 1900)?.progress, 1);
});

test("Covered forward and reverse jumps keep the visible chapter unchanged until settlement", () => {
  const app = mount({ y: 1900 });
  assert.equal(app.rail.dataset.stage, "1");
  app.transition(true);
  const before = [...app.rail.properties];
  const reads = app.measured();
  app.root.scrollHeight = 900;
  app.scroll(0);
  app.resize();
  assert.deepEqual([...app.rail.properties], before);
  assert.equal(app.measured(), reads, "covered frames must not read transient geometry");
  assert.equal(app.rail.classes.has("is-idle"), false);
  app.root.scrollHeight = 5500;
  app.scroll(3200);
  app.transition(false);
  app.flush();
  assert.equal(app.rail.dataset.stage, "2");
  assert.equal(app.rail.properties.get("--kisara-scroll-progress"), "0.5");
  app.transition(true);
  app.scroll(900);
  assert.equal(app.rail.dataset.stage, "2");
  app.transition(false);
  app.flush();
  assert.equal(app.rail.dataset.stage, "0");
});

test("Reload in a chapter and footer uses local track pixels at ninety percent zoom", () => {
  const app = mount({ y: 3200 });
  assert.equal(app.rail.attributes.get("aria-valuetext"), "Home 第 3 章，共 4 章");
  assert.equal(app.rail.dataset.stage, "2");
  assert.equal(app.rail.dataset.chapterMotion, "false");
  app.scroll(4500);
  assert.equal(app.rail.dataset.chapterMotion, "true");
  assert.equal(app.rail.attributes.get("aria-valuetext"), "Home 页尾");
  assert.equal(app.rail.properties.get("--kisara-scroll-thumb-y"), "252px");
  assert.equal((252 + 8) * .9, 260 * .9);
});

test("Gate return restores the gate rail and other pages keep document scrolling", () => {
  const app = mount({ y: 900, gate: true });
  app.transition(true);
  app.scroll(0);
  assert.ok(app.rail.classes.has("is-home-chapters"));
  app.transition(false);
  app.flush();
  assert.ok(app.rail.classes.has("is-gate-progress"));
  assert.ok(!app.rail.classes.has("is-home-chapters"));
  assert.equal(app.rail.properties.get("--kisara-scroll-progress"), "0.45");
  const other = mount({ home: false, y: 2300 });
  assert.ok(!other.rail.classes.has("is-home-chapters"));
  assert.equal(other.rail.attributes.get("aria-label"), "页面滚动进度");
  assert.equal(other.rail.properties.get("--kisara-scroll-progress"), "0.5");
});
