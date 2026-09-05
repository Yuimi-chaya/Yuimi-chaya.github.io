import assert from "node:assert/strict";
import test from "node:test";
import { createComicTransition, settleWithin } from "../src/themes/kisara/lib/comicTransition.ts";
import { comicSpreadPoints } from "../src/themes/kisara/lib/comicMotion.ts";
import { bindComicOpening } from "../src/themes/kisara/lib/comicOpening.ts";

const flush = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };
const deferred = () => {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
};

function fixture() {
  const nodes: FakeNode[] = [];
  const animations: Array<{
    node: FakeNode; frames: Keyframe[]; options: KeyframeAnimationOptions;
    finished: Promise<void>; finish: () => void; cancel: () => void;
  }> = [];
  class FakeNode extends EventTarget {
    tagName: string;
    className = "";
    style = { opacity: "", transform: "", clipPath: "" };
    attributes = new Map<string, string>();
    children: FakeNode[] = [];
    dataset: Record<string, string> = {};
    hidden = false;
    inert = false;
    src = "";
    rect = { left: 0, top: 0, right: 1440, bottom: 900, width: 1440, height: 900 };
    decode = () => Promise.resolve();
    constructor(tag = "div") { super(); this.tagName = tag.toUpperCase(); }
    get classList() {
      return {
        contains: (name: string) => this.className.split(" ").includes(name),
        add: (...names: string[]) => { this.className = [...new Set([...this.className.split(" ").filter(Boolean), ...names])].join(" "); },
        remove: (...names: string[]) => { this.className = this.className.split(" ").filter(name => !names.includes(name)).join(" "); },
        toggle: (name: string, force: boolean) => { if (force) this.classList.add(name); else this.classList.remove(name); },
      };
    }
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    getAttribute(name: string) { return this.attributes.get(name) ?? null; }
    hasAttribute(name: string) { return this.attributes.has(name); }
    removeAttribute(name: string) { this.attributes.delete(name); }
    append(node: FakeNode) { this.children.push(node); }
    remove() { const index = nodes.indexOf(this); if (index >= 0) nodes.splice(index, 1); }
    getBoundingClientRect() { return this.rect; }
    matches(selector: string) {
      if (selector.startsWith(".")) return this.classList.contains(selector.slice(1));
      if (selector === "[style]") return Object.values(this.style).some(Boolean);
      if (selector.startsWith("[")) return this.hasAttribute(selector.slice(1, -1));
      return this.tagName === selector.toUpperCase();
    }
    querySelectorAll(selector: string): FakeNode[] {
      return this.children.flatMap(child => [
        ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector),
      ]);
    }
    querySelector(selector: string) { return this.querySelectorAll(selector)[0] ?? null; }
    cloneNode(deep = false): FakeNode {
      const copy = new FakeNode(this.tagName);
      copy.className = this.className;
      copy.attributes = new Map(this.attributes);
      copy.dataset = { ...this.dataset };
      copy.style = { ...this.style };
      copy.rect = { ...this.rect };
      copy.hidden = this.hidden;
      copy.src = this.src;
      if (deep) this.children.forEach(child => copy.append(child.cloneNode(true)));
      return copy;
    }
    animate(frames: Keyframe[], options: KeyframeAnimationOptions) {
      const completion = deferred();
      const animation = {
        node: this, frames, options, finished: completion.promise,
        finish: completion.resolve, cancel: () => completion.reject(new Error("Cancelled")),
      };
      animations.push(animation);
      return animation;
    }
  }
  const make = (className: string, data: Record<string, string> = {}, tag = "div") => {
    const node = new FakeNode(tag);
    node.className = className;
    for (const [key, value] of Object.entries(data)) {
      node.dataset[key] = value;
      node.setAttribute(`data-${key.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)}`, value);
    }
    return node;
  };
  const scene = make("kisara-comic", {}, "kisara-opening-memory-scene");
  const paper = make("kisara-comic-paper");
  for (let i = 0; i < 4; i++) paper.append(make("kisara-comic-panel"));
  const portrait = make("kisara-comic-portrait");
  portrait.rect = { left: 650, top: 60, right: 1210, bottom: 1040, width: 560, height: 980 };
  const image = make("", { comicSrc: "/comic.webp" }, "img");
  portrait.append(image);
  scene.append(paper);
  scene.append(portrait);
  const caption = make("kisara-comic-navigation", { comicCaption: "" });
  caption.setAttribute("id", "navigation");
  const branches = ["home", "blog"].map(id => {
    const branch = make("", { kisaraRouteBranch: id });
    const link = make("", { kisaraRouteKind: "page", kisaraRouteId: id }, "a");
    branch.append(link);
    caption.append(branch);
    return branch;
  });
  const groups = ["home", "blog"].map(id => {
    const group = make("", { comicRoutes: id });
    group.hidden = id !== "home";
    caption.append(group);
    return group;
  });
  scene.append(caption);
  for (let i = 0; i < 5; i++) scene.append(make("comic-caption", { comicCaption: "" }));
  const doc = Object.assign(new EventTarget(), {
    hidden: false, createElement: (tag: string) => new FakeNode(tag),
    querySelectorAll: () => [], body: { append(node: FakeNode) { nodes.push(node); } },
  });
  const win = Object.assign(new EventTarget(), {
    innerHeight: 900, matchMedia: () => ({ matches: false }), setTimeout, clearTimeout,
  });
  const previous = ["document", "window"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
  Object.defineProperty(globalThis, "window", { configurable: true, value: win });
  return {
    scene: scene as unknown as HTMLElement, rawScene: scene, image, branches, groups,
    doc, win, nodes, animations,
    finish: () => animations.forEach(animation => animation.finish()),
    restore() {
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
    },
  };
}

test("Entry grows the actual comic from its subject before committing the scroll", async () => {
  const f = fixture();
  const controller = new AbortController();
  try {
    const ready = deferred();
    let commits = 0;
    const transition = createComicTransition(controller.signal, false);
    const run = transition.run({ scene: f.scene, mode: "enter", prepare: () => ready.promise, commit: () => { commits++; } });
    await flush();
    assert.equal(f.nodes.length, 0, "Keep the original page visible while decoding");
    ready.resolve();
    await flush();
    assert.equal(commits, 0);
    assert.equal(f.nodes.length, 1);
    assert.equal(f.nodes[0].children[0].tagName, "DIV", "Never mount a cloned custom-element runtime");
    assert.equal(f.nodes[0].children[0].inert, true);
    assert.equal(f.nodes[0].inert, false, "The outer input blocker must still receive pointer hits");
    assert.equal(f.nodes[0].querySelectorAll("[id]").length, 0);
    const subject = f.animations.find(animation => animation.node.className === "kisara-comic-portrait")!;
    const paper = f.animations.find(animation => animation.node.className === "kisara-comic-paper")!;
    assert.equal(subject.options.delay, 0);
    assert.ok(Number(paper.options.delay) > Number(subject.options.delay));
    assert.equal(paper.options.easing, "cubic-bezier(.23,1,.32,1)");
    assert.ok(Math.max(...f.animations.map(animation => Number(animation.options.delay) + Number(animation.options.duration))) <= 650);
    assert.match(String(paper.frames[0].clipPath), /^polygon\(/);
    f.finish();
    assert.equal(await run, true);
    assert.equal(commits, 1);
    assert.equal(f.nodes.length, 0);
    assert.equal(transition.active, false);
  } finally { controller.abort(); f.restore(); }
});

test("Exit removes paper before the subject, then holds black for the fridge's fresh frame", async () => {
  const f = fixture();
  const controller = new AbortController();
  try {
    const firstFrame = deferred();
    let commits = 0;
    const transition = createComicTransition(controller.signal, false);
    const run = transition.run({ scene: f.scene, mode: "leave", commit: () => { commits++; return firstFrame.promise; } });
    await flush();
    assert.equal(commits, 0, "Do not start opening the fridge under the outgoing comic");
    const subject = f.animations.find(animation => animation.node.className === "kisara-comic-portrait")!;
    const paper = f.animations.find(animation => animation.node.className === "kisara-comic-paper")!;
    assert.ok(Number(subject.options.delay) > Number(paper.options.delay));
    const exitDuration = Math.max(...f.animations.map(animation => Number(animation.options.delay) + Number(animation.options.duration)));
    assert.ok(exitDuration <= 580);
    f.finish();
    await flush();
    assert.equal(commits, 1);
    assert.equal(paper.node.style.opacity, "0");
    assert.equal(subject.node.style.opacity, "0");
    assert.equal(f.nodes.length, 1);
    assert.match(f.nodes[0].className, /is-leave/);
    const count = f.animations.length;
    firstFrame.resolve();
    await flush();
    assert.equal(f.animations.length, count + 1);
    assert.equal(f.animations.at(-1)?.options.duration, 100);
    assert.ok(exitDuration + Number(f.animations.at(-1)?.options.duration) <= 680);
    f.finish();
    await run;
    assert.equal(f.nodes.length, 0);
  } finally { controller.abort(); f.restore(); }
});

test("Returning reveals the reset Gate underneath the reverse spread without a black cover", async () => {
  const f = fixture();
  const controller = new AbortController();
  try {
    let commits = 0;
    const transition = createComicTransition(controller.signal, false);
    const run = transition.run({ scene: f.scene, mode: "return", commit: () => { commits++; } });
    await flush();
    assert.equal(commits, 1);
    assert.match(f.nodes[0].className, /is-return/);
    assert.doesNotMatch(f.nodes[0].className, /is-leave/);
    f.finish();
    await run;
    assert.equal(f.nodes.length, 0);
  } finally { controller.abort(); f.restore(); }
});

test("A viewport resize settles to unmasked paper before the real page can move", async () => {
  const f = fixture();
  const controller = new AbortController();
  try {
    const committed = deferred();
    let commits = 0;
    const transition = createComicTransition(controller.signal, false);
    const run = transition.run({ scene: f.scene, mode: "enter", commit: () => { commits++; return committed.promise; } });
    await flush();
    f.nodes[0].children[0].rect.width = 2560;
    f.win.dispatchEvent(new Event("resize"));
    await flush();
    assert.equal(commits, 1);
    assert.equal(f.nodes[0].querySelector(".kisara-comic-paper")?.style.clipPath, "none");
    committed.resolve();
    await run;
    assert.equal(f.nodes.length, 0);
  } finally { controller.abort(); f.restore(); }
});

test("Abort during decoding or motion cannot commit a late scroll or leave a flight behind", async () => {
  for (const duringMotion of [false, true]) {
    const f = fixture();
    const controller = new AbortController();
    try {
      let commits = 0;
      const transition = createComicTransition(controller.signal, false);
      const run = transition.run({
        scene: f.scene, mode: "enter",
        prepare: duringMotion ? undefined : () => new Promise(() => {}),
        commit: () => { commits++; },
      });
      await flush();
      controller.abort();
      assert.equal(await run, false);
      assert.equal(commits, 0);
      assert.equal(f.nodes.length, 0);
      assert.equal(transition.active, false);
    } finally { f.restore(); }
  }
});

test("Repeated input cannot create two simultaneous comic flights", async () => {
  const f = fixture();
  const controller = new AbortController();
  try {
    const transition = createComicTransition(controller.signal, false);
    const options = { scene: f.scene, mode: "enter" as const, commit() {} };
    const first = transition.run(options);
    assert.equal(await transition.run(options), false);
    await flush();
    assert.equal(f.nodes.length, 1);
    controller.abort();
    await first;
  } finally { f.restore(); }
});

test("Reduced motion commits without a clone or geometric animation", async () => {
  const f = fixture();
  const controller = new AbortController();
  try {
    let commits = 0;
    const transition = createComicTransition(controller.signal, true);
    await transition.run({ scene: f.scene, mode: "enter", commit: () => { commits++; } });
    assert.equal(commits, 1);
    assert.equal(f.animations.length, 0);
    assert.equal(f.nodes.length, 0);
  } finally { controller.abort(); f.restore(); }
});

test("Hiding a tab settles the finite flight, and a throwing commit always cleans it up", async () => {
  const f = fixture();
  const controller = new AbortController();
  try {
    const transition = createComicTransition(controller.signal, false);
    const run = transition.run({ scene: f.scene, mode: "enter", commit() {} });
    await flush();
    f.doc.hidden = true;
    f.doc.dispatchEvent(new Event("visibilitychange"));
    assert.equal(await run, true);
    assert.equal(f.nodes.length, 0);
    f.doc.hidden = false;
    const failed = transition.run({ scene: f.scene, mode: "enter", commit() { throw new Error("Commit failed"); } });
    const failure = assert.rejects(failed, /Commit failed/);
    await flush();
    f.finish();
    await failure;
    assert.equal(f.nodes.length, 0);
    assert.equal(transition.active, false);
  } finally { controller.abort(); f.restore(); }
});

test("A failed or hung prerequisite has a bounded wait", async () => {
  const controller = new AbortController();
  await settleWithin(Promise.reject(new Error("Decode failed")), 20, controller.signal);
  await settleWithin(new Promise(() => {}), 5, controller.signal);
  controller.abort();
});

test("Comic entrance recovers from hidden decoding, and a transported scene does not replay", async () => {
  const f = fixture();
  const imageReady = deferred();
  f.image.decode = () => imageReady.promise;
  const runtime = bindComicOpening(f.scene);
  try {
    assert.equal(f.scene.classList.contains("is-comic-armed"), true);
    f.doc.hidden = true;
    f.doc.dispatchEvent(new Event("visibilitychange"));
    f.doc.hidden = false;
    f.doc.dispatchEvent(new Event("visibilitychange"));
    imageReady.resolve();
    await flush();
    assert.equal(f.scene.classList.contains("is-comic-entering"), true);
    runtime.settle();
    assert.equal(f.scene.classList.contains("is-comic-armed"), false);
    assert.equal(f.scene.classList.contains("is-comic-entering"), false);
    const count = f.animations.length;
    await runtime.enter();
    assert.equal(f.animations.length, count, "Do not replay when the transient copy leaves");
    runtime.reset();
    void runtime.enter();
    await flush();
    assert.ok(f.animations.length > count);
    f.finish();
    await flush();
    assert.equal(f.scene.classList.contains("is-comic-entering"), false);
  } finally { runtime.destroy(); f.restore(); }
});

test("The editorial index keeps focus, expanded state, and two-tap navigation in sync", () => {
  const f = fixture();
  const runtime = bindComicOpening(f.scene);
  try {
    f.branches[1].dispatchEvent(new Event("focusin"));
    assert.equal(f.groups[0].hidden, true);
    assert.equal(f.groups[1].hidden, false);
    assert.equal(f.branches[1].querySelector("a")?.getAttribute("aria-expanded"), "true");
    const first = new Event("click", { cancelable: true });
    f.branches[1].querySelector("a")?.dispatchEvent(first);
    assert.equal(first.defaultPrevented, true);
    const second = new Event("click", { cancelable: true });
    f.branches[1].querySelector("a")?.dispatchEvent(second);
    assert.equal(second.defaultPrevented, false);
    const escape = Object.assign(new Event("keydown"), { key: "Escape" });
    f.scene.dispatchEvent(escape);
    assert.equal(f.groups[0].hidden, false);
    assert.equal(f.branches[1].querySelector("a")?.getAttribute("aria-expanded"), "false");
  } finally { runtime.destroy(); f.restore(); }
});

test("The irregular paper contour covers every corner at desktop, mobile, and landscape sizes", () => {
  const inside = ([x, y]: number[], points: number[][]) => {
    let result = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [a, b] = points[i], [c, d] = points[j];
      if ((b > y) !== (d > y) && x < (c - a) * (y - b) / (d - b) + a) result = !result;
    }
    return result;
  };
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1440, 900], [2560, 1080]]) {
    for (const origin of [.35, .65, .88]) {
      const points = comicSpreadPoints(width, height, width * origin, height * .3, 1);
      for (const corner of [[0, 0], [width, 0], [0, height], [width, height]]) {
        assert.ok(inside(corner, points), `${width}x${height} must cover ${corner}`);
      }
      const seed = comicSpreadPoints(width, height, width * origin, height * .3, 0);
      assert.ok(seed.every(point => inside(point, points)));
      assert.ok(points.flat().every(Number.isFinite));
    }
  }
});
