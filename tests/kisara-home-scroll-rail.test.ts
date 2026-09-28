import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import postcss from "postcss";
import { getHomeChapterProgress } from "../src/themes/kisara/lib/homeScrollRail.ts";

const read = (path: string) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const runtime = read("src/themes/kisara/lib/layoutRuntime.js");

function mount({ home = true, y = 900 } = {}) {
  class Node extends EventTarget {
    dataset: Record<string, string> = {};
    classes = new Set<string>();
    attributes = new Map<string, string>();
    properties = new Map<string, string>();
    classList = {
      contains: (key: string) => this.classes.has(key),
      toggle: (key: string, active: boolean) => active ? this.classes.add(key) : this.classes.delete(key),
    };
    style = { transform: "", height: "", setProperty: (key: string, value: string) => this.properties.set(key, value) };
    get clientHeight() { return this.classes.has("is-home-rail") ? 260 : 800; }
    getBoundingClientRect() { return { height: this.clientHeight * .9 }; }
    setAttribute(key: string, value: string) { this.attributes.set(key, value); }
    querySelector(selector: string) { return selector === ".kisara-scrollbar-progress" ? fill : thumb; }
  }
  const fill = new Node();
  const thumb = new Node();
  const rail = new Node();
  if (home) rail.classes.add("is-home-rail");
  const body = new Node();
  if (home) body.classes.add("kisara-home-page");
  const root = { scrollHeight: 5500, dataset: { theme: "kisara" } };
  const win = Object.assign(new EventTarget(), { scrollY: y, innerHeight: 900, innerWidth: 1440 });
  let measurements = 0;
  const stops = [900, 1900, 3200, 4000, 4500].map(top => ({
    getBoundingClientRect() { measurements++; return { top: top - win.scrollY }; },
  }));
  const doc = Object.assign(new EventTarget(), {
    body, documentElement: root, scrollingElement: root,
    querySelector: (selector: string) => selector === "[data-kisara-scrollbar]" ? rail : null,
    querySelectorAll: () => stops,
  });
  const frames = new Map<number, () => void>();
  let serial = 0;
  let resize = () => {};
  const code = runtime.slice(runtime.indexOf("const clamp ="), runtime.indexOf("  const closePanel ="))
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
  const advanceGate = (value: number) => {
    win.dispatchEvent(new CustomEvent("kisara:gate-progress", { detail: { active: true, progress: value, stage: "awakening" } }));
    flush();
  };
  return { rail, fill, thumb, root, win, scroll, transition, flush, advanceGate, resize: () => { resize(); flush(); }, measured: () => measurements };
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
  assert.equal(app.rail.dataset.chapter, "2");
  app.transition(true);
  const before = [app.fill.style.transform, app.thumb.style.transform];
  const reads = app.measured();
  app.root.scrollHeight = 900;
  app.scroll(0);
  app.resize();
  assert.deepEqual([app.fill.style.transform, app.thumb.style.transform], before);
  assert.equal(app.measured(), reads, "covered frames must not read transient geometry");
  assert.equal(app.rail.classes.has("is-idle"), false);
  app.root.scrollHeight = 5500;
  app.scroll(3200);
  app.transition(false);
  app.flush();
  assert.equal(app.rail.dataset.chapter, "3");
  assert.equal(app.fill.style.transform, "scaleY(0.5)");
  app.transition(true);
  app.scroll(900);
  assert.equal(app.rail.dataset.chapter, "3");
  app.transition(false);
  app.flush();
  assert.equal(app.rail.dataset.chapter, "1");
});

test("Reload in a chapter and footer uses local track pixels at ninety percent zoom", () => {
  const app = mount({ y: 3200 });
  assert.equal(app.rail.attributes.get("aria-valuetext"), "Home 第 3 章，共 4 章");
  assert.equal(app.rail.dataset.chapter, "3");
  assert.equal(app.rail.dataset.railMotion, "false");
  app.scroll(4500);
  assert.equal(app.rail.dataset.railMotion, "true");
  assert.equal(app.rail.attributes.get("aria-valuetext"), "Home 页尾");
  assert.equal(app.thumb.style.transform, "translate3d(0,252px,0)");
  assert.equal((252 + 8) * .9, 260 * .9);
});

test("Gate hides the chapter rail and other pages keep document scrolling", () => {
  const app = mount({ y: 900 });
  app.transition(true);
  app.scroll(0);
  assert.ok(app.rail.classes.has("is-home-rail"));
  app.transition(false);
  app.flush();
  assert.equal(app.rail.dataset.chapter, "0");
  assert.equal(app.rail.attributes.get("aria-hidden"), "true");
  assert.equal(app.fill.style.transform, "scaleY(0)");
  app.advanceGate(.45);
  assert.equal(app.rail.attributes.get("aria-hidden"), "true");
  assert.equal(app.fill.style.transform, "scaleY(0)");
  const other = mount({ home: false, y: 2300 });
  assert.ok(!other.rail.classes.has("is-home-rail"));
  assert.equal(other.rail.attributes.get("aria-label"), "页面滚动进度");
  assert.equal(other.fill.style.transform, "scaleY(0.5)");
});

test("Chapter rail begins at 01 and remains absent throughout the opening", () => {
  const app = mount({ y: 0 });
  assert.equal(app.rail.dataset.chapter, "0");
  assert.equal(app.rail.attributes.get("aria-hidden"), "true");
  for (const progress of [0, .2, 1]) {
    app.advanceGate(progress);
    assert.equal(app.rail.dataset.chapter, "0");
    assert.equal(app.fill.style.transform, "scaleY(0)");
  }
  app.transition(true);
  app.scroll(900);
  app.transition(false);
  app.flush();
  assert.equal(app.rail.attributes.get("aria-hidden"), "false");
  assert.equal(app.fill.style.transform, "scaleY(0)");
  assert.equal(app.rail.dataset.chapter, "1");
  app.scroll(1900);
  assert.equal(app.fill.style.transform, "scaleY(0.25)");
  app.transition(true);
  app.scroll(0);
  assert.equal(app.fill.style.transform, "scaleY(0.25)");
  app.transition(false);
  app.flush();
  assert.equal(app.thumb.style.transform, "translate3d(0,0px,0)");
  assert.equal(app.rail.attributes.get("aria-hidden"), "true");
  assert.equal(app.rail.dataset.railMotion, "true");
  app.resize();
  app.advanceGate(0);
  assert.equal(app.rail.dataset.railMotion, "true", "duplicate notifications must not cut an ongoing return short");
  assert.equal(app.rail.properties.size, 0, "no inherited transform variables are written to the track");
});

test("Home track geometry and layer ordering are independent of transition and progress state", () => {
  const sheet = postcss.parse(read("src/themes/kisara/styles/scrollbar.css"));
  const home = sheet.nodes.find(node => node.type === "rule" && node.selector === ".kisara-scrollbar.is-home-rail") as postcss.Rule;
  const props = new Map(home.nodes.filter(node => node.type === "decl").map(node => [node.prop, node.value]));
  assert.equal(props.get("z-index"), "10042");
  assert.equal(props.get("transform"), "translate3d(0, -50%, 0)");
  assert.equal(props.get("will-change"), "transform");
  const opening = sheet.nodes.find(node => node.type === "rule" && node.selector?.includes('.kisara-scrollbar.is-home-rail[data-chapter="0"]')) as postcss.Rule;
  assert.ok(opening);
  assert.equal(opening.nodes.find(node => node.type === "decl" && node.prop === "opacity")?.value, "0");
  const layout = read("src/themes/kisara/layouts/KisaraLayout.astro");
  assert.match(layout, /\["01", "02", "03", "04", "◇"\]/);
  assert.doesNotMatch(layout, /\["00", "01", "02", "03", "04", "◇"\]/);
  sheet.walkRules(rule => {
    assert.ok(!rule.selector.includes("data-kisara-home-transition"));
    assert.ok(!rule.selector.includes("is-home-chapters"));
    if (rule.selector.includes("data-rail-motion") || rule.selector.includes("data-chapter=")) {
      rule.walkDecls(decl => assert.ok(!["z-index", "width", "height", "top", "display", "font-weight"].includes(decl.prop)));
    }
  });
  const reduced = sheet.nodes.find(node => node.type === "atrule" && node.params === "(prefers-reduced-motion: reduce)") as postcss.AtRule;
  assert.ok(reduced);
  reduced.walkRules(rule => {
    assert.ok(rule.selector.includes('.is-home-rail[data-rail-motion="true"] .kisara-scrollbar-thumb'));
    rule.walkDecls("transition", decl => assert.equal(decl.value, "none"));
  });
});
