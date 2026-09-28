import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";
import { createComicTransition, settleWithin } from "../src/themes/kisara/lib/comicTransition.ts";
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
  const image = make("", { comicSrc: "/comic.webp" }, "img");
  scene.append(paper);
  const caption = make("kisara-comic-navigation");
  caption.setAttribute("id", "navigation");
  const branches = ["home", "blog", "games", "projects", "about"].map(id => {
    const branch = make("kisara-comic-panel", { kisaraRouteBranch: id });
    const link = make("", { kisaraRouteKind: "page", kisaraRouteId: id }, "a");
    branch.append(link);
    caption.append(branch);
    return branch;
  });
  branches[0].querySelector("a")!.append(image);
  const groups = ["home", "blog", "games", "projects", "about"].map(id => {
    const group = make("", { comicRoutes: id });
    group.hidden = id !== "home";
    caption.append(group);
    return group;
  });
  scene.append(caption);
  for (let i = 0; i < 5; i++) scene.append(make("comic-caption", { comicCaption: "" }));
  const doc = Object.assign(new EventTarget(), {
    hidden: false, visibilityState: "visible", createElement: (tag: string) => new FakeNode(tag),
    querySelectorAll: () => [], body: { dataset: {}, append(node: FakeNode) { nodes.push(node); } },
  });
  const win = Object.assign(new EventTarget(), {
    innerHeight: 900, matchMedia: () => ({ matches: false }), setTimeout, clearTimeout,
  });
  const previous = ["document", "window", "getComputedStyle"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
  Object.defineProperty(globalThis, "window", { configurable: true, value: win });
  Object.defineProperty(globalThis, "getComputedStyle", { configurable: true, value: () => ({ zoom: ".9" }) });
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

function gateHandoffFixture(f: ReturnType<typeof fixture>, controller: AbortController, ready: Promise<void>) {
  const home = readFileSync(new URL("../src/themes/kisara/pages/HomePage.astro", import.meta.url), "utf8");
  const functions = [
    ["setHomeRailTransition", "isOpeningStopCurrent"],
    ["enterNextPage", "finalizeLovebrainExit"],
    ["drawTitleLens", "glitchAlphabet"],
  ];
  // Execute the production handoff and material gate, not a second model of their ordering.
  const source = functions.map(([name, next]) => {
    const start = home.indexOf(`const ${name} =`);
    const end = home.indexOf(`const ${next} =`, start);
    assert.ok(start >= 0 && end > start, `${name}/${next}`);
    return home.slice(start, end);
  }).join("\n");
  const events: string[] = [];
  const railStates: boolean[] = [];
  const state = {
    comicTransition: createComicTransition(controller.signal, false),
    openingMemoryScene: { preparePresentation: () => ready },
    pageMode: "gate", scrollTransitionDirection: "idle", lovebrainActive: false,
    scrollFrame: 0, disposed: false, gateReturnGuardUntil: 0, lastObservedScrollY: 0,
    gateVisualResetPending: false, foundSelfState: "", homeSectionInputGuardUntil: 0,
    lastTitleLensPaintTimestamp: 0, mobileFrameInterval: 0,
    gate: { clientWidth: 1440, style: { setProperty() {} } },
    titleLensCanvas: { dataset: { active: "true" } },
    titleLensRenderer: { draw: () => events.push("draw"), clear: () => events.push("clear-lens") },
    clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
    performance, CustomEvent, document: f.doc,
    window: { scrollY: 0, dispatchEvent: (event: CustomEvent) => railStates.push(event.detail.active) },
    cancelSmoothScroll: () => events.push("cancel-scroll"),
    clearOpeningTitleBridgeDissolve: () => events.push("clear-bridge"),
    clearReleaseTransientEffects: () => events.push("clear-effects"),
    setPostReleaseActive: (active: boolean) => events.push(`post-release:${active}`),
    getNextPageTop: () => 900,
    setScrollPosition: (y: number) => { events.push("scroll"); state.window.scrollY = y; },
    resetOpeningMemoryPresentation: () => events.push("reset-comic"),
    finalizeGateResetForNextPage: () => events.push("reset-gate"),
    render: () => events.push("render"),
    console,
  };
  Object.assign(f.scene, { preparePresentation: () => ready, settlePresentation: () => events.push("settle-comic") });
  state.openingMemoryScene = f.scene as typeof state.openingMemoryScene;
  const api = vm.runInNewContext(
    stripTypeScriptTypes(source) + "\n({ enterNextPage, drawTitleLens });", state
  );
  return { state, events, api, railStates };
}

test("The real Gate keeps liquid rendering through preparation and reveal, then resets under full paper", async () => {
  const f = fixture();
  const controller = new AbortController();
  try {
    const ready = deferred();
    const { state, events, api, railStates } = gateHandoffFixture(f, controller, ready.promise);
    api.enterNextPage();
    assert.equal(state.comicTransition.active, true);
    assert.equal(state.pageMode, "gate");
    api.drawTitleLens(1000, { opacity: 1, sourceOpacity: 0 });
    assert.deepEqual(events, ["draw"]);
    ready.resolve();
    await flush();
    api.enterNextPage();
    api.drawTitleLens(1100, { opacity: 1, sourceOpacity: 0 });
    assert.equal(f.nodes.length, 1);
    assert.deepEqual(events, ["draw", "draw"], "No cleanup while the underlying title is visible");
    f.animations.find(animation => animation.node.className === "kisara-comic-paper")!.finish();
    await flush();
    assert.equal(state.pageMode, "gate", "The remaining layers finish before the covered commit");
    f.finish();
    await flush();
    assert.equal(state.pageMode, "next");
    assert.equal(state.comicTransition.active, false);
    assert.deepEqual(railStates, [true, false]);
    assert.deepEqual(events.slice(2), [
      "clear-bridge", "clear-effects", "post-release:false", "scroll", "reset-gate",
      "reset-comic", "settle-comic", "render",
    ]);
    assert.equal(f.nodes.length, 0);
  } finally { controller.abort(); f.restore(); }
});

test("Aborting a Gate flight never clears the exposed material or commits the reset", async () => {
  for (const duringMotion of [false, true]) {
    const f = fixture();
    const controller = new AbortController();
    try {
      const ready = deferred();
      const { state, events, api, railStates } = gateHandoffFixture(f, controller, ready.promise);
      api.enterNextPage();
      if (duringMotion) ready.resolve();
      await flush();
      controller.abort();
      await flush();
      assert.equal(state.pageMode, "gate");
      assert.equal(state.comicTransition.active, false);
      assert.deepEqual(railStates, [true, false]);
      assert.equal(f.nodes.length, 0);
      assert.deepEqual(events, ["render"]);
      ready.resolve();
      await flush();
      assert.deepEqual(events, ["render"], "A late decode cannot commit the cancelled handoff");
    } finally { controller.abort(); f.restore(); }
  }
});

test("Entry reveals five framed page links over the paper before committing the scroll", async () => {
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
    const panels = f.animations.filter(animation => animation.node.className === "kisara-comic-panel");
    const paper = f.animations.find(animation => animation.node.className === "kisara-comic-paper")!;
    assert.equal(panels.length, 5);
    assert.equal(paper.options.delay, 0);
    assert.deepEqual(panels.map(panel => panel.options.delay), [0, 25, 50, 75, 100]);
    assert.equal(paper.options.easing, "cubic-bezier(.23,1,.32,1)");
    assert.ok(Math.max(...f.animations.map(animation => Number(animation.options.delay) + Number(animation.options.duration))) <= 530);
    assert.ok(panels.every(panel => panel.frames.every(frame => frame.clipPath === undefined)));
    assert.deepEqual(paper.frames.map(frame => frame.opacity), [1, 1]);
    assert.ok(paper.frames.every(frame => frame.clipPath === "none"));
    const page = f.animations.find(animation => animation.node.className === "kisara-comic")!;
    assert.deepEqual(page.frames.map(frame => frame.opacity), [0, 1]);
    f.finish();
    assert.equal(await run, true);
    assert.equal(commits, 1);
    assert.equal(f.nodes.length, 0);
    assert.equal(transition.active, false);
  } finally { controller.abort(); f.restore(); }
});

test("Exit fades the intact page with its panels, then covers the fridge until a fresh frame", async () => {
  const f = fixture();
  const controller = new AbortController();
  try {
    const firstFrame = deferred();
    let commits = 0;
    const transition = createComicTransition(controller.signal, false);
    const run = transition.run({ scene: f.scene, mode: "leave", commit: () => { commits++; return firstFrame.promise; } });
    await flush();
    assert.equal(commits, 0, "Do not start opening the fridge under the outgoing comic");
    const panels = f.animations.filter(animation => animation.node.className === "kisara-comic-panel");
    const paper = f.animations.find(animation => animation.node.className === "kisara-comic-paper")!;
    assert.deepEqual(panels.map(panel => panel.options.delay), [60, 45, 30, 15, 0]);
    assert.ok(paper.frames.every(frame => frame.opacity === 1 && frame.clipPath === "none"));
    const page = f.animations.find(animation => animation.node.className === "kisara-comic")!;
    assert.equal(page.options.delay, 0, "Paper and content leave together, not as an empty oval");
    assert.deepEqual(page.frames.map(frame => frame.opacity), [1, 0]);
    const exitDuration = Math.max(...f.animations.map(animation => Number(animation.options.delay) + Number(animation.options.duration)));
    assert.ok(exitDuration <= 480);
    f.finish();
    await flush();
    assert.equal(commits, 1);
    assert.equal(paper.node.style.opacity, "1");
    assert.equal(page.node.style.opacity, "0");
    assert.ok(panels.every(panel => panel.node.style.opacity === "0"));
    assert.equal(f.nodes.length, 1);
    assert.match(f.nodes[0].className, /is-leave/);
    const count = f.animations.length;
    firstFrame.resolve();
    await flush();
    assert.equal(f.animations.length, count + 1);
    assert.equal(f.animations.at(-1)?.options.duration, 100);
    assert.ok(exitDuration + Number(f.animations.at(-1)?.options.duration) <= 580);
    f.finish();
    await run;
    assert.equal(f.nodes.length, 0);
  } finally { controller.abort(); f.restore(); }
});

test("Returning reveals the reset Gate underneath the departing intact page", async () => {
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

test("Each of the five framed page links selects only its own route group", () => {
  const f = fixture();
  const runtime = bindComicOpening(f.scene);
  try {
    for (let index = 0; index < 5; index++) {
      f.branches[index].dispatchEvent(new Event("focusin"));
      assert.deepEqual(f.groups.map(group => group.hidden), f.groups.map((_, i) => i !== index));
      assert.deepEqual(f.branches.map(branch => branch.querySelector("a")?.getAttribute("aria-expanded")),
        f.branches.map((_, i) => String(i === index)));
    }
  } finally { runtime.destroy(); f.restore(); }
});

test("Every viewport keeps the paper rectangular throughout the flight", async () => {
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1440, 900], [2560, 1080]]) {
    const f = fixture();
    const controller = new AbortController();
    try {
      Object.assign(f.rawScene.rect, { width, height });
      const transition = createComicTransition(controller.signal, false);
      const run = transition.run({ scene: f.scene, mode: "enter", commit() {} });
      await flush();
      assert.ok(f.animations.every(animation =>
        animation.frames.every(frame => frame.clipPath === undefined || frame.clipPath === "none")));
      f.finish();
      await run;
    } finally { controller.abort(); f.restore(); }
  }
});
