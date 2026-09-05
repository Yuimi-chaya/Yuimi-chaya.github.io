import assert from "node:assert/strict";
import test from "node:test";
import { createComicTransition, settleWithin } from "../src/themes/kisara/lib/comicTransition.ts";
import { bindComicOpening } from "../src/themes/kisara/lib/comicOpening.ts";

const flush = async () => { for (let i = 0; i < 14; i++) await Promise.resolve(); };
const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
};

function fakeDocument() {
  const animations: Array<{ finished: Promise<void>; finish: () => void; cancel: () => void }> = [];
  const nodes: FakeNode[] = [];
  class FakeNode {
    style: Record<string, unknown> = {};
    children: FakeNode[] = [];
    className = "";
    append(node: FakeNode) { this.children.push(node); }
    setAttribute() {}
    remove() { const index = nodes.indexOf(this); if (index >= 0) nodes.splice(index, 1); }
    animate() {
      const completion = deferred();
      const animation = { finished: completion.promise, finish: completion.resolve, cancel() {} };
      animations.push(animation);
      return animation;
    }
  }
  const doc = Object.assign(new EventTarget(), {
    hidden: false,
    createElement: () => new FakeNode(),
    body: { append(node: FakeNode) { nodes.push(node); } },
  });
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
  return {
    doc, animations, nodes,
    restore() {
      if (previous) Object.defineProperty(globalThis, "document", previous);
      else Reflect.deleteProperty(globalThis, "document");
    },
  };
}

test("Scene position commits only after both coverage and material readiness", async () => {
  const f = fakeDocument();
  const controller = new AbortController();
  try {
    const transition = createComicTransition(controller.signal, false);
    const ready = deferred();
    let commits = 0;
    const run = transition.run({ prepare: () => ready.promise, commit: () => { commits++; } });
    assert.equal(f.nodes.length, 1);
    assert.equal(commits, 0);
    f.animations.slice(0, 2).forEach(animation => animation.finish());
    await flush();
    assert.equal(commits, 0);
    ready.resolve();
    await flush();
    assert.equal(commits, 1);
    assert.equal(f.nodes.length, 1);
    f.animations.slice(2).forEach(animation => animation.finish());
    assert.equal(await run, true);
    assert.equal(f.nodes.length, 0);
    assert.equal(transition.active, false);
  } finally { controller.abort(); f.restore(); }
});

test("Fridge keeps its cover until the media handoff settles", async () => {
  const f = fakeDocument();
  const controller = new AbortController();
  try {
    const firstFrame = deferred();
    const transition = createComicTransition(controller.signal, false);
    const run = transition.run({ commit: () => firstFrame.promise, reveal: "fade" });
    f.animations.forEach(animation => animation.finish());
    await flush();
    assert.equal(f.animations.length, 2);
    firstFrame.resolve();
    await flush();
    assert.equal(f.animations.length, 3);
    f.animations[2].finish();
    await run;
    assert.equal(f.nodes.length, 0);
  } finally { controller.abort(); f.restore(); }
});

test("Abort during coverage prevents a late scroll commit and removes the curtain", async () => {
  const f = fakeDocument();
  const controller = new AbortController();
  try {
    const transition = createComicTransition(controller.signal, false);
    let commits = 0;
    const run = transition.run({ commit: () => { commits++; } });
    controller.abort();
    assert.equal(await run, false);
    assert.equal(commits, 0);
    assert.equal(f.nodes.length, 0);
    assert.equal(transition.active, false);
  } finally { f.restore(); }
});

test("Repeated input cannot create two simultaneous chapter transitions", async () => {
  const f = fakeDocument();
  const controller = new AbortController();
  try {
    const transition = createComicTransition(controller.signal, false);
    const first = transition.run({ commit() {} });
    assert.equal(await transition.run({ commit() { throw new Error("Duplicate commit"); } }), false);
    assert.equal(f.nodes.length, 1);
    controller.abort();
    await first;
  } finally { f.restore(); }
});

test("Reduced motion completes without geometric animation or a residual blocker", async () => {
  const f = fakeDocument();
  const controller = new AbortController();
  try {
    const transition = createComicTransition(controller.signal, true);
    let commits = 0;
    await transition.run({ commit() { commits++; } });
    assert.equal(commits, 1);
    assert.equal(f.animations.length, 0);
    assert.equal(f.nodes.length, 0);
  } finally { controller.abort(); f.restore(); }
});

test("A failed or hung prerequisite has a bounded wait", async () => {
  const controller = new AbortController();
  await settleWithin(Promise.reject(new Error("Decode failed")), 20, controller.signal);
  await settleWithin(new Promise(() => {}), 5, controller.signal);
  controller.abort();
});

test("Comic entrance recovers when the tab hides while its image is decoding", async () => {
  const f = fakeDocument();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const imageReady = deferred();
  const classList = () => {
    const values = new Set<string>();
    return {
      add: (...names: string[]) => names.forEach(name => values.add(name)),
      remove: (...names: string[]) => names.forEach(name => values.delete(name)),
      contains: (name: string) => values.has(name),
    };
  };
  const image = { src: "", dataset: { comicSrc: "/comic.webp" }, classList: classList(), decode: () => imageReady.promise };
  const scene = Object.assign(new EventTarget(), {
    classList: classList(),
    querySelectorAll: (selector: string) => selector === "[data-comic-src]" ? [image] : [],
    getBoundingClientRect: () => ({ top: 0, bottom: 800 }),
  });
  const win = Object.assign(new EventTarget(), {
    innerHeight: 800, matchMedia: () => ({ matches: false }), setTimeout, clearTimeout,
  });
  Object.defineProperty(globalThis, "window", { configurable: true, value: win });
  let runtime: ReturnType<typeof bindComicOpening> | undefined;
  try {
    runtime = bindComicOpening(scene as unknown as HTMLElement);
    assert.equal(scene.classList.contains("is-comic-armed"), true);
    f.doc.hidden = true;
    f.doc.dispatchEvent(new Event("visibilitychange"));
    f.doc.hidden = false;
    f.doc.dispatchEvent(new Event("visibilitychange"));
    imageReady.resolve();
    await flush();
    assert.equal(scene.classList.contains("is-comic-armed"), false);
    assert.equal(scene.classList.contains("is-comic-entering"), true);
    runtime.reset();
    void runtime.enter();
    await flush();
    assert.equal(scene.classList.contains("is-comic-armed"), false);
  } finally {
    runtime?.destroy();
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
    f.restore();
  }
});
