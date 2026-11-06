import assert from "node:assert/strict";
import test from "node:test";
import { bindWorksDetails } from "../src/core/interactions/worksDetails.js";

class Target {
  listeners = new Map<string, Set<(event: any) => void>>();
  addEventListener(type: string, callback: (event: any) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(callback);
  }
  removeEventListener(type: string, callback: (event: any) => void) { this.listeners.get(type)?.delete(callback); }
  emit(type: string, event: any = {}) { this.listeners.get(type)?.forEach((callback) => callback(event)); }
}

class Animation {
  node: Element;
  frames: Record<string, string>[];
  options: any;
  progress = 0;
  cancels = 0;
  finished: Promise<void>;
  resolve!: () => void;
  reject!: (error: Error) => void;
  constructor(node: Element, frames: Record<string, string>[], options: any) {
    this.node = node;
    this.frames = frames;
    this.options = options;
    this.finished = new Promise<void>((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
  }
  value(property: string) {
    const from = this.frames[0][property], to = this.frames[1][property];
    if (!from || !to) return null;
    return from.split(" ").map((value, index) =>
      `${Number.parseFloat(value) + (Number.parseFloat(to.split(" ")[index]) - Number.parseFloat(value)) * this.progress}px`
    ).join(" ");
  }
  finish() { this.progress = 1; this.resolve(); }
  cancel() {
    this.cancels++;
    if (this.node.animation === this) this.node.animation = null;
    this.reject(new Error("Cancelled"));
  }
}

class Element extends Target {
  tag: string;
  scene: any;
  attributes = new Map<string, string>();
  style = { height: "", overflow: "", gridTemplateRows: "" };
  children: Element[] = [];
  parent: Element | null = null;
  hidden = false;
  inert = false;
  naturalHeight = 0;
  baseHeight = 100;
  animation: Animation | null = null;
  focusCalls: any[] = [];
  animate?: (frames: Record<string, string>[], options: any) => Animation;
  constructor(tag: string, scene: any) {
    super();
    this.tag = tag;
    this.scene = scene;
    this.animate = (frames, options) => {
      const animation = new Animation(this, frames, options);
      this.animation = animation;
      scene.animations.push(animation);
      return animation;
    };
  }
  get ownerDocument() { return this.scene.document; }
  append(child: Element) { child.parent = this; this.children.push(child); return child; }
  matches(selector: string): boolean {
    return selector.split(",").some((part) => {
      part = part.trim();
      return part.startsWith("[") ? this.attributes.has(part.slice(1, -1)) : this.tag === part;
    });
  }
  closest(selector: string): Element | null { return this.matches(selector) ? this : this.parent?.closest(selector) ?? null; }
  querySelectorAll(selector: string): Element[] {
    return this.children.flatMap((child) => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector: string) { return this.querySelectorAll(selector)[0] ?? null; }
  contains(node: Element | null): boolean { return node === this || !!node?.parent && this.contains(node.parent); }
  getAttribute(name: string) { return this.attributes.get(name) ?? null; }
  setAttribute(name: string, value: string) {
    if (name === "open") { this.open = true; return; }
    this.attributes.set(name, value);
    if (name === "name" && this.open && value) this.closeNamedPeers();
  }
  removeAttribute(name: string) {
    if (name === "open") this.open = false;
    else this.attributes.delete(name);
  }
  get open() { return this.attributes.has("open"); }
  set open(value: boolean) {
    if (this.open === value) return;
    if (value) this.attributes.set("open", "");
    else this.attributes.delete("open");
    if (value && this.getAttribute("name")) this.closeNamedPeers();
    this.scene.toggles.add(this);
  }
  closeNamedPeers() {
    for (const detail of this.scene.details) {
      if (detail !== this && detail.getAttribute("name") === this.getAttribute("name")) detail.open = false;
    }
  }
  focus(options?: any) { this.focusCalls.push(options); this.scene.document.activeElement = this; }
  get offsetHeight(): number {
    if (this.hidden) return 0;
    if (this.matches("[data-works-disclosure-item]")) {
      const detail = this.querySelector("details")!;
      return this.baseHeight + (detail.open ? this.querySelector("[data-works-disclosure-content]")!.offsetHeight : 0);
    }
    if (this.matches("[data-works-disclosure-inner]")) return this.closest("details")!.open || this.scene.closedMetrics ? this.naturalHeight : 0;
    if (this.matches("[data-works-disclosure-content]")) {
      if (!this.closest("details")!.open && !this.scene.closedMetrics) return 0;
      const height = this.animation?.value("height") ?? this.style.height;
      return height ? Number.parseFloat(height) : this.children[0].offsetHeight;
    }
    return 0;
  }
  get offsetTop() {
    const index = this.scene.items.filter((item: Element) => !item.hidden).indexOf(this);
    const row = Math.floor(index / this.scene.columns);
    return this.scene.rows().slice(0, row).reduce((sum: number, height: number) => sum + height + 12, 0);
  }
}

function fixture(heights = [200, 200, 140, 180], supported = true, closedMetrics = false) {
  const document = Object.assign(new Target(), { hidden: false, activeElement: null as Element | null });
  const motion = Object.assign(new Target(), { matches: false });
  const scene: any = {
    document, columns: 2, closedMetrics, animations: [] as Animation[], details: [] as Element[], items: [] as Element[],
    toggles: new Set<Element>(), frames: new Map<number, () => void>(), nextFrame: 0
  };
  const root = new Element("section", scene);
  const grid = root.append(new Element("div", scene));
  grid.setAttribute("data-works-disclosure-layout", "");
  const records = heights.map((height) => {
    const item = grid.append(new Element("article", scene));
    item.setAttribute("data-works-disclosure-item", "");
    scene.items.push(item);
    const detail = item.append(new Element("details", scene));
    scene.details.push(detail);
    detail.setAttribute("data-works-disclosure", "");
    detail.setAttribute("name", "project-notes");
    const summary = detail.append(new Element("summary", scene));
    const content = detail.append(new Element("div", scene));
    content.setAttribute("data-works-disclosure-content", "");
    if (!supported) content.animate = undefined;
    const inner = content.append(new Element("div", scene));
    inner.setAttribute("data-works-disclosure-inner", "");
    inner.naturalHeight = height;
    const link = inner.append(new Element("a", scene));
    return { item, detail, summary, content, inner, link };
  });
  scene.rows = () => {
    const fixed = grid.animation?.value("gridTemplateRows") ?? grid.style.gridTemplateRows;
    if (fixed) return fixed.split(" ").map(Number.parseFloat);
    const visible = scene.items.filter((item: Element) => !item.hidden);
    return visible.reduce((rows: number[], item: Element, index: number) => {
      const row = Math.floor(index / scene.columns);
      rows[row] = Math.max(rows[row] ?? 0, item.offsetHeight);
      return rows;
    }, []);
  };
  let observer: any;
  const window = Object.assign(new Target(), {
    document,
    matchMedia: () => motion,
    getComputedStyle: (node: Element) => ({
      getPropertyValue: () => "cubic-bezier(.23, 1, .32, 1)",
      gridTemplateRows: node === grid ? scene.rows().map((height: number) => `${height}px`).join(" ") : ""
    }),
    requestAnimationFrame: (callback: () => void) => { const id = ++scene.nextFrame; scene.frames.set(id, callback); return id; },
    cancelAnimationFrame: (id: number) => scene.frames.delete(id),
    ResizeObserver: class {
      callback: () => void;
      observed: Element[] = [];
      disconnected = false;
      constructor(callback: () => void) { this.callback = callback; observer = this; }
      observe(node: Element) { this.observed.push(node); }
      disconnect() { this.disconnected = true; }
    }
  });
  const controller = bindWorksDetails(root, "--test-ease", window);
  const click = (target: Element, detail = 1, defaultPrevented = false) => {
    const event = { target, detail, button: 0, defaultPrevented, preventDefault() { this.defaultPrevented = true; } };
    root.emit("click", event);
    const summary = target.closest("summary");
    if (!event.defaultPrevented && summary && !target.closest("a, button, input, select, textarea, label")) {
      const owner = summary.closest("details")!;
      owner.open = !owner.open;
    }
    return event;
  };
  const flushToggles = () => {
    for (let index = 0; scene.toggles.size && index < 20; index++) {
      const queued = [...scene.toggles] as Element[];
      scene.toggles.clear();
      queued.forEach((node) => node.emit("toggle"));
    }
  };
  const complete = async () => {
    scene.animations.filter((animation: Animation) => animation.node.animation === animation).forEach((animation: Animation) => animation.finish());
    for (let index = 0; index < 5; index++) await Promise.resolve();
    flushToggles();
  };
  const advance = (progress: number) => scene.animations.forEach((animation: Animation) => {
    if (animation.node.animation === animation) animation.progress = progress;
  });
  const raf = () => { const callbacks = [...scene.frames.values()]; scene.frames.clear(); callbacks.forEach((callback: any) => callback()); };
  return { root, grid, document, motion, window, scene, records, controller, observer, click, complete, advance, raf, flushToggles };
}

test("Works disclosures animate real height, preserve row flow and return to intrinsic sizing", async () => {
  const f = fixture();
  const [a, , below] = f.records;
  assert.equal(a.detail.getAttribute("name"), null);
  f.click(a.summary);
  assert.equal(a.detail.open, true);
  assert.equal(a.content.offsetHeight, 0);
  assert.equal(a.summary.getAttribute("aria-expanded"), "true");
  f.advance(.5);
  assert.equal(a.content.offsetHeight, 100);
  assert.equal(below.item.offsetTop, 212);
  for (const animation of f.scene.animations as Animation[]) {
    assert.equal(animation.options.duration, 240);
    assert.ok(animation.frames.every((frame) => !("transform" in frame)), "No whole-card or text scaling");
  }
  await f.complete();
  assert.equal(a.content.style.height, "");
  assert.equal(a.content.style.overflow, "");
  assert.equal(f.grid.style.gridTemplateRows, "");
  assert.equal(a.content.offsetHeight, 200);
  assert.equal(below.item.offsetTop, 312);
  f.controller.cleanup();
});

test("closed native content with measurable geometry is never opened for measurement", async () => {
  const f = fixture(undefined, true, true);
  const [a, ...others] = f.records;
  assert.ok(others.every((record) => record.content.offsetHeight > 0), "Geometry alone does not prove visibility");
  f.click(a.summary);
  assert.ok(others.every((record) => record.detail.open === false), "Unselected content must not flash open");
  assert.equal(a.content.offsetHeight, 0, "The requested disclosure also starts from its actual closed state");
  f.advance(.5);
  assert.ok(others.every((record) => record.detail.open === false));
  await f.complete();
  f.click(a.summary);
  f.advance(.5);
  f.click(others[0].summary);
  assert.ok(others.slice(1).every((record) => record.detail.open === false));
  await f.complete();
  f.controller.cleanup();
});

test("same-row handoff holds the row envelope while both disclosures move", async () => {
  const f = fixture();
  const [a, b, below] = f.records;
  f.click(a.summary);
  await f.complete();
  f.click(b.summary);
  assert.equal(a.detail.open, true, "Closing content stays rendered until its animation finishes");
  assert.equal(a.content.inert, true);
  assert.equal(a.summary.getAttribute("aria-expanded"), "false");
  f.advance(.5);
  assert.equal(a.content.offsetHeight, 100);
  assert.equal(b.content.offsetHeight, 100);
  assert.equal(below.item.offsetTop, 312, "The next row must not dip up between equal-height peers");
  f.click(a.summary);
  assert.equal(below.item.offsetTop, 312, "Rapid reversal captures the allocated row, not its shorter cards");
  await f.complete();
  assert.equal(a.detail.open, true);
  assert.equal(b.detail.open, false);
  f.controller.cleanup();
});

test("unequal peer handoff smoothly interpolates the allocated row rather than snapping at completion", async () => {
  const f = fixture([240, 120, 140, 180]);
  const [a, b, below] = f.records;
  f.click(a.summary);
  await f.complete();
  f.click(b.summary);
  f.advance(.5);
  assert.equal(below.item.offsetTop, 292);
  await f.complete();
  assert.equal(below.item.offsetTop, 232);
  f.controller.cleanup();
});

test("mid-flight close and reopen continue from the current height and ignore old completions", async () => {
  const f = fixture();
  const [a] = f.records;
  f.click(a.summary);
  f.advance(.5);
  const old = [...f.scene.animations] as Animation[];
  f.click(a.summary);
  assert.equal(a.content.offsetHeight, 100);
  f.advance(.5);
  assert.equal(a.content.offsetHeight, 50);
  f.click(a.summary);
  assert.equal(a.content.offsetHeight, 50);
  old.forEach((animation) => animation.finish());
  await Promise.resolve();
  assert.equal(a.summary.getAttribute("aria-expanded"), "true");
  await f.complete();
  assert.equal(a.detail.open, true);
  assert.equal(a.content.offsetHeight, 200);
  f.controller.cleanup();
});

test("keyboard activation stays immediate and unrelated links or controls keep native behavior", () => {
  const f = fixture();
  const [a, b] = f.records;
  f.click(a.summary, 0);
  assert.equal(a.detail.open, true);
  assert.equal(f.scene.animations.length, 0);
  assert.equal(f.click(a.link).defaultPrevented, false);
  const filter = f.root.append(new Element("button", f.scene));
  assert.equal(f.click(filter).defaultPrevented, false);
  const summaryLink = b.summary.append(new Element("a", f.scene));
  assert.equal(f.click(summaryLink).defaultPrevented, false);
  assert.equal(b.detail.open, false);
  f.click(b.summary, 0);
  assert.equal(a.detail.open, false);
  assert.equal(b.detail.open, true);
  assert.equal(f.scene.animations.length, 0);
  assert.equal(f.root.listeners.has("keydown"), false);
  assert.equal(f.window.listeners.has("scroll"), false);
  f.controller.cleanup();
});

test("a focused closing body hands focus to the requested summary without scrolling", () => {
  const f = fixture();
  const [a, b] = f.records;
  f.click(a.summary, 0);
  f.document.activeElement = a.link;
  f.click(b.summary);
  assert.equal(f.document.activeElement, b.summary);
  assert.deepEqual(b.summary.focusCalls.at(-1), { preventScroll: true });
  assert.equal(a.content.inert, true);
  f.controller.cleanup();
});

test("filtering or pagination can settle motion before hiding and never resurrects hidden details", async () => {
  const f = fixture();
  const [a] = f.records;
  f.click(a.summary);
  f.advance(.5);
  const old = [...f.scene.animations] as Animation[];
  f.controller.finish();
  a.item.hidden = true;
  a.detail.removeAttribute("open");
  f.flushToggles();
  old.forEach((animation) => animation.finish());
  await Promise.resolve();
  a.item.hidden = false;
  assert.equal(a.detail.open, false);
  assert.equal(a.content.style.height, "");
  f.click(a.summary);
  await f.complete();
  assert.equal(a.detail.open, true);
  f.controller.cleanup();
});

test("reduced motion, hidden tabs and pagehide settle the intended state and release height locks", () => {
  const f = fixture();
  const [a] = f.records;
  f.click(a.summary);
  f.motion.matches = true;
  f.motion.emit("change");
  assert.equal(a.detail.open, true);
  assert.equal(a.content.style.height, "");
  assert.equal(f.grid.style.gridTemplateRows, "");
  const count = f.scene.animations.length;
  f.click(a.summary);
  assert.equal(a.detail.open, false);
  assert.equal(f.scene.animations.length, count);
  f.motion.matches = false;
  f.click(a.summary);
  f.document.hidden = true;
  f.document.emit("visibilitychange");
  assert.equal(a.content.style.height, "");
  f.document.hidden = false;
  f.click(a.summary);
  f.window.emit("pagehide");
  assert.equal(a.detail.open, false);
  f.controller.cleanup();
});

test("natural content changes retarget active height and breakpoint resize restores auto rows", async () => {
  const f = fixture();
  const [a] = f.records;
  assert.ok(f.observer.observed.every((node: Element) => node.matches("[data-works-disclosure-inner]")));
  f.click(a.summary);
  f.advance(.5);
  a.inner.naturalHeight = 300;
  f.observer.callback();
  assert.equal(f.scene.frames.size, 1);
  f.raf();
  assert.equal(a.content.offsetHeight, 100);
  await f.complete();
  assert.equal(a.content.offsetHeight, 300);
  f.click(a.summary);
  f.scene.columns = 1;
  f.window.emit("resize");
  assert.equal(a.detail.open, false);
  assert.equal(f.grid.style.gridTemplateRows, "");
  f.controller.cleanup();
});

test("cleanup is idempotent, restores native name/ARIA/styles and rejects stale controller work", async () => {
  const f = fixture();
  const [a] = f.records;
  f.click(a.summary);
  const old = [...f.scene.animations] as Animation[];
  const next = bindWorksDetails(f.root, "--test-ease", f.window);
  f.controller.cleanup();
  f.controller.finish();
  assert.equal(f.root.listeners.get("click")?.size, 1);
  next.cleanup();
  next.cleanup();
  old.forEach((animation) => animation.finish());
  await Promise.resolve();
  for (const record of f.records) {
    assert.equal(record.detail.getAttribute("name"), "project-notes");
    assert.equal(record.summary.getAttribute("aria-expanded"), null);
    assert.equal(record.detail.getAttribute("data-works-expanded"), null);
    assert.equal(record.content.style.height, "");
    assert.equal(record.content.inert, false);
    assert.equal(record.detail.listeners.get("toggle")?.size, 0);
  }
  assert.equal(f.root.listeners.get("click")?.size, 0);
  assert.equal(f.motion.listeners.get("change")?.size, 0);
  assert.equal(f.document.listeners.get("visibilitychange")?.size, 0);
  assert.equal(f.window.listeners.get("resize")?.size, 0);
  assert.equal(f.scene.frames.size, 0);
  assert.equal(f.records.filter((record) => record.detail.open).length, 1);
});

test("synchronous external close survives finish and cleanup before its queued toggle", () => {
  const f = fixture();
  const [a] = f.records;
  f.click(a.summary);
  f.advance(.5);
  a.detail.open = false;
  f.controller.finish();
  assert.equal(a.detail.open, false);
  f.click(a.summary);
  a.detail.open = false;
  f.controller.cleanup();
  assert.equal(a.detail.open, false);
});

test("missing WAAPI preserves unmodified native disclosures and exclusive grouping", () => {
  const f = fixture(undefined, false);
  const [a, b] = f.records;
  assert.equal(a.detail.getAttribute("name"), "project-notes");
  assert.equal(f.root.listeners.get("click")?.size ?? 0, 0);
  f.click(a.summary);
  assert.equal(a.detail.open, true);
  f.click(b.summary);
  assert.equal(a.detail.open, false);
  assert.equal(b.detail.open, true);
  assert.equal(a.summary.getAttribute("aria-expanded"), null);
  f.controller.cleanup();
});
