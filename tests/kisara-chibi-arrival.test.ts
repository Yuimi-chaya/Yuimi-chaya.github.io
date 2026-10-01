import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = readFileSync(new URL("../src/themes/kisara/lib/chibiStage.ts", import.meta.url), "utf8");

function mount(embedded = true) {
  class Node {
    attributes = new Set<string>();
    dataset = { ready: "true" };
    rect = { top: 650, bottom: 900, height: 250 };
    setAttribute(key: string) { this.attributes.add(key); }
    removeAttribute(key: string) { this.attributes.delete(key); }
    hasAttribute(key: string) { return this.attributes.has(key); }
    toggleAttribute(key: string, value: boolean) {
      if (value) this.setAttribute(key);
      else this.removeAttribute(key);
    }
    getBoundingClientRect() { return this.rect; }
  }
  const root = new Node();
  const homeChapter = embedded ? new Node() : null;
  if (homeChapter) homeChapter.rect = { top: 0, bottom: 1000, height: 1000 };
  const nodes = new Map(Array.from({ length: 4 }, (_, index) => [index, new Node()]));
  const document = { hidden: false };
  const start = source.indexOf("  const resetArrival =");
  const end = source.indexOf("  const visibilityObserver =", start);
  assert.ok(start >= 0 && end > start);
  const lifecycle = vm.runInNewContext(
    source.slice(start, end) + "\n({ refreshVisibility, suspendStage });",
    {
      root, nodes, embedded, homeChapter, document, window: { innerHeight: 1000 },
      stageVisible: false, drag: null, dragFrame: { cancel() {} }, cancelScene() {},
    }
  ) as { refreshVisibility(): void; suspendStage(): void };
  const settle = () => nodes.forEach(node => node.setAttribute("data-arrival-settled"));
  const settled = () => [...nodes.values()].every(node => node.hasAttribute("data-arrival-settled"));
  const leave = (direction: "above" | "below") => {
    const rect = direction === "above"
      ? { top: -1000, bottom: 0, height: 1000 }
      : { top: 1000, bottom: 2000, height: 1000 };
    root.rect = rect;
    if (homeChapter) homeChapter.rect = rect;
    lifecycle.refreshVisibility();
  };
  const enter = () => {
    root.rect = { top: 650, bottom: 900, height: 250 };
    if (homeChapter) homeChapter.rect = { top: 0, bottom: 1000, height: 1000 };
    lifecycle.refreshVisibility();
  };
  return { root, homeChapter, document, lifecycle, settle, settled, leave, enter };
}

test("003 reentry rearms all four arrivals from either adjacent chapter", () => {
  const app = mount();
  for (const direction of ["below", "above", "below"] as const) {
    app.enter();
    assert.equal(app.root.hasAttribute("data-entered"), true);
    app.settle();
    app.leave(direction);
    assert.equal(app.root.hasAttribute("data-entered"), false);
    assert.equal(app.settled(), false);
    app.enter();
    assert.equal(app.root.hasAttribute("data-entered"), true);
    assert.equal(app.settled(), false, "all four wrappers are eligible for a new entrance");
  }
});

test("Scrolling within 003 and tab suspension preserve arrival settlement and character state", () => {
  const app = mount();
  app.enter();
  app.settle();
  app.root.rect = { top: 1100, bottom: 1350, height: 250 };
  app.lifecycle.refreshVisibility();
  assert.equal(app.root.hasAttribute("data-entered"), true, "cast offscreen but chapter still visible");
  assert.equal(app.settled(), true);
  app.enter();
  assert.equal(app.settled(), true);
  app.document.hidden = true;
  app.lifecycle.refreshVisibility();
  app.lifecycle.suspendStage();
  assert.equal(app.settled(), true);
  app.document.hidden = false;
  app.enter();
  assert.equal(app.settled(), true, "returning to the same chapter must not replay");
});

test("A rearmed cast waits for layout and sufficient visibility before playing", () => {
  const app = mount();
  app.enter();
  app.settle();
  app.leave("below");
  app.root.rect = { top: 950, bottom: 1200, height: 250 };
  app.homeChapter!.rect = { top: 0, bottom: 1000, height: 1000 };
  app.lifecycle.refreshVisibility();
  assert.equal(app.root.hasAttribute("data-entered"), false);
  app.root.dataset.ready = "";
  app.enter();
  assert.equal(app.root.hasAttribute("data-entered"), false);
  app.root.dataset.ready = "true";
  app.lifecycle.refreshVisibility();
  assert.equal(app.root.hasAttribute("data-entered"), true);
});

test("Standalone stages retain their existing lifecycle", () => {
  const app = mount(false);
  app.root.setAttribute("data-entered");
  app.settle();
  app.leave("above");
  app.enter();
  assert.equal(app.settled(), true);
  assert.equal(app.root.hasAttribute("data-entered"), true);
});

test("Chapter observation and CSS preserve stagger, interruption and reduced motion", () => {
  assert.match(source, /if \(homeChapter\) visibilityObserver\?\.observe\(homeChapter\)/);
  const css = readFileSync(new URL("../src/themes/kisara/styles/home-event-video.css", import.meta.url), "utf8");
  assert.match(css, /kisara-embedded-chibi-pop 500ms cubic-bezier\(0\.23, 1, 0\.32, 1\)/);
  assert.match(css, /animation-delay: calc\(var\(--chibi-order\) \* 70ms\)/);
  assert.match(css, /kisara-chapter-flight[^}]*animation-play-state: paused/);
  assert.match(css, /prefers-reduced-motion: reduce[^]*kisara-chibi-arrival[^}]*animation: none/);
});
