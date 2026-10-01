import assert from "node:assert/strict";
import { setMaxListeners } from "node:events";
import { readFileSync } from "node:fs";
import test from "node:test";
import { chapterPose, createChapterTransition, type ChapterKind } from "../src/themes/kisara/lib/chapterTransition.ts";
import { watchChibiStage } from "../src/themes/kisara/lib/chibiLoader.ts";
import { waitForVideoFrame } from "../src/themes/kisara/lib/videoFrame.ts";

setMaxListeners(0);
const read = (path: string) => readFileSync(new URL(`../src/themes/kisara/${path}`, import.meta.url), "utf8");
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };

function fixture(reduced = false) {
  const animations: Array<{ finish: () => void; cancel: () => void; frames: Keyframe[] }> = [];
  class Node extends EventTarget {
    dataset: Record<string, string> = {};
    style = { opacity: "", transform: "", clipPath: "", position: "", zIndex: "" };
    className = "";
    inert = false;
    isConnected = true;
    children: Node[] = [];
    surface: Node | null = null;
    parent: Node | null = null;
    attributes = new Map<string, string>();
    rect = { top: 5000, bottom: 5500, height: 500, width: 1200 };
    setAttribute(key: string, value: string) { this.attributes.set(key, value); }
    querySelectorAll() { return this.children; }
    querySelector() { return this.surface; }
    getBoundingClientRect() { return this.rect; }
    append(node: Node) { this.children.push(node); node.parent = this; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
    animate(frames: Keyframe[]) {
      let resolve!: () => void;
      const finished = new Promise<void>(done => { resolve = done; });
      const animation = { finish: () => resolve(), cancel: () => resolve(), frames, finished };
      animations.push(animation);
      return animation;
    }
  }
  const stage = new Node();
  const body = new Node();
  const observers: Observer[] = [];
  class Observer {
    disconnected = false;
    callback: Function;
    constructor(callback: Function) { this.callback = callback; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
    emit() { this.callback([{ isIntersecting: true }]); }
  }
  const doc = Object.assign(new EventTarget(), {
    hidden: false, body, querySelector: () => stage, createElement: () => new Node(),
  });
  const paints = new Map<number, FrameRequestCallback>();
  let paintSerial = 0;
  const win = Object.assign(new EventTarget(), {
    innerHeight: 900,
    requestAnimationFrame(callback: FrameRequestCallback) { paints.set(++paintSerial, callback); return paintSerial; },
    cancelAnimationFrame(id: number) { paints.delete(id); },
  });
  const globals = { document: doc, window: win, IntersectionObserver: Observer };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.entries(globals).forEach(([key, value]) => Object.defineProperty(globalThis, key, { configurable: true, value }));
  const controller = new AbortController();
  const runtime = createChapterTransition(controller.signal, reduced);
  const chapter = (kind: ChapterKind) => {
    const node = new Node();
    node.surface = new Node();
    if (kind !== "stage") node.dataset.kisaraHomeStop = kind;
    if (kind === "004" || kind === "stage") {
      for (let i = 0; i < (kind === "004" ? 3 : 4); i++) node.append(new Node());
    }
    return node;
  };
  return {
    runtime, controller, stage, body, observers, doc, win, animations, chapter,
    paint() { const pending = [...paints.values()]; paints.clear(); pending.forEach(callback => callback(0)); },
    finish() { animations.forEach(animation => animation.finish()); },
    restore() {
      controller.abort();
      doc.dispatchEvent(new Event("astro:before-swap"));
      previous.forEach((value, key) => {
        if (value) Object.defineProperty(globalThis, key, value);
        else Reflect.deleteProperty(globalThis, key);
      });
    },
  };
}

const element = (node: unknown) => node as HTMLElement;

test("Chapter poses are distinct and reverse along the same scene path", () => {
  const kinds: ChapterKind[] = ["002", "003", "004", "stage"];
  assert.equal(new Set(kinds.map(kind => chapterPose(kind, false, true))).size, 4);
  for (const kind of kinds) {
    assert.equal(chapterPose(kind, false, true), chapterPose(kind, true, false));
    assert.equal(chapterPose(kind, false, false), chapterPose(kind, true, true));
  }
});

test("All six adjacent chapter handoffs relocate once under coverage and restore real scene styles", async () => {
  for (const [a, b] of [["002", "003"], ["003", "004"], ["004", "stage"]] as const) {
    for (const reverse of [false, true]) {
      const f = fixture();
      try {
        const from = f.chapter(reverse ? b : a), to = f.chapter(reverse ? a : b);
        let commits = 0;
        const run = f.runtime.run(element(from), element(to), reverse, () => {
          assert.equal(f.body.children[0].style.opacity, "1");
          commits++;
        });
        assert.equal(f.runtime.active, true);
        assert.equal(commits, 0);
        assert.equal(f.body.children.length, 1);
        assert.equal(from.style.opacity, "", "the section background must never fade");
        assert.equal(from.style.zIndex, "", "joining strips must not change stacking order");
        assert.equal(f.body.children[0].children.length, 0, "no shutter or cloned scene DOM");
        assert.equal(await f.runtime.run(element(from), element(to), reverse, () => commits++), false);
        f.finish(); await flush();
        assert.equal(commits, 1);
        assert.equal(f.runtime.active, true);
        f.finish(); await run;
        assert.equal(f.runtime.active, false);
        assert.equal(f.body.children.length, 0);
        for (const node of [from, to, from.surface!, to.surface!, ...to.children]) {
          assert.deepEqual(node.style, { opacity: "", transform: "", clipPath: "", position: "", zIndex: "" });
        }
      } finally { f.restore(); }
    }
  }
});

test("Aborting before or after relocation cannot leave a cover or commit twice", async () => {
  for (const afterCommit of [false, true]) {
    const f = fixture();
    try {
      let commits = 0;
      const run = f.runtime.run(element(f.chapter("003")), element(f.chapter("004")), false, () => commits++);
      if (afterCommit) { f.finish(); await flush(); }
      f.controller.abort();
      await run;
      assert.equal(commits, afterCommit ? 1 : 0);
      assert.equal(f.body.children.length, 0);
      assert.equal(f.runtime.active, false);
    } finally { f.restore(); }
  }
});

test("Reduced motion and a hidden document relocate immediately without animated covers", async () => {
  for (const reduced of [false, true]) {
    const f = fixture(reduced);
    try {
      f.doc.hidden = !reduced;
      let commits = 0;
      await f.runtime.run(element(f.chapter("002")), element(f.chapter("003")), false, () => commits++);
      assert.equal(commits, 1);
      assert.equal(f.animations.length, 0);
      assert.equal(f.body.children.length, 0);
    } finally { f.restore(); }
  }
});

test("Hidden-tab interruption settles both phases and releases navigation", async () => {
  const f = fixture();
  try {
    let commits = 0;
    const run = f.runtime.run(element(f.chapter("004")), element(f.chapter("stage")), false, () => commits++);
    f.doc.hidden = true;
    f.doc.dispatchEvent(new Event("visibilitychange"));
    await run;
    assert.equal(commits, 1);
    assert.equal(f.runtime.active, false);
    assert.equal(f.body.children.length, 0);
  } finally { f.restore(); }
});

test("An unavailable animation implementation falls through to a usable destination", async () => {
  const f = fixture();
  try {
    const from = f.chapter("003");
    from.surface!.animate = () => { throw new Error("Animation unavailable"); };
    let commits = 0;
    await f.runtime.run(element(from), element(f.chapter("004")), false, () => commits++);
    assert.equal(commits, 1);
    assert.equal(f.body.children.length, 0);
  } finally { f.restore(); }
});

test("Chapter coverage stays opaque until destination media is ready", async () => {
  const f = fixture();
  try {
    let ready!: () => void;
    const media = new Promise<void>(resolve => { ready = resolve; });
    const run = f.runtime.run(element(f.chapter("004")), element(f.chapter("003")), true, () => media);
    f.finish(); await flush();
    assert.equal(f.body.children[0].style.opacity, "1");
    assert.equal(f.animations.length, 2, "reveal must not start while the video still holds an old frame");
    ready(); await flush();
    assert.ok(f.animations.length > 2);
    f.finish(); await run;
    assert.equal(f.body.children.length, 0);
  } finally { f.restore(); }
});

function videoFixture() {
  const f = fixture();
  const frames = new Map<number, Function>();
  let serial = 0;
  const video = Object.assign(new EventTarget(), {
    currentTime: 0, readyState: 4, seeking: false, paused: false,
    requestVideoFrameCallback(callback: Function) { frames.set(++serial, callback); return serial; },
    cancelVideoFrameCallback(id: number) { frames.delete(id); },
  });
  return {
    ...f, video, frames,
    frame(mediaTime: number) {
      const [id, callback] = frames.entries().next().value!;
      frames.delete(id);
      callback(0, { mediaTime });
    },
  };
}

test("Video readiness ignores a retained end frame and resolves only after the seek is decoded", async () => {
  const f = videoFixture();
  try {
    let ready = false;
    const pending = waitForVideoFrame(f.video as unknown as HTMLVideoElement, f.controller.signal)
      .then(value => { ready = value; });
    f.frame(3);
    await flush();
    assert.equal(ready, false);
    assert.equal(f.frames.size, 1);
    f.video.seeking = true;
    f.frame(0);
    await flush();
    assert.equal(ready, false);
    f.video.seeking = false;
    f.video.currentTime = .04;
    f.frame(.04);
    await pending;
    assert.equal(ready, true);
    assert.equal(f.frames.size, 0);
  } finally { f.restore(); }
});

test("Video readiness cancels pending callbacks on abort, background or media error", async () => {
  for (const reason of ["abort", "hidden", "error"]) {
    const f = videoFixture();
    try {
      const pending = waitForVideoFrame(f.video as unknown as HTMLVideoElement, f.controller.signal);
      if (reason === "abort") f.controller.abort();
      if (reason === "hidden") { f.doc.hidden = true; f.doc.dispatchEvent(new Event("visibilitychange")); }
      if (reason === "error") f.video.dispatchEvent(new Event("error"));
      assert.equal(await pending, false);
      assert.equal(f.frames.size, 0);
    } finally { f.restore(); }
  }
});

test("Video readiness has a bounded timeout and a seeking-aware event fallback", async () => {
  const f = videoFixture();
  try {
    assert.equal(await waitForVideoFrame(f.video as unknown as HTMLVideoElement, f.controller.signal, 5), false);
    assert.equal(f.frames.size, 0);
    Object.assign(f.video, { requestVideoFrameCallback: undefined, seeking: true });
    let ready = false;
    const pending = waitForVideoFrame(f.video as unknown as HTMLVideoElement, f.controller.signal).then(value => { ready = value; });
    f.video.dispatchEvent(new Event("playing"));
    await flush();
    assert.equal(ready, false);
    f.video.seeking = false;
    f.video.dispatchEvent(new Event("seeked"));
    await flush();
    assert.equal(ready, false);
    f.paint();
    assert.equal(ready, false);
    f.paint();
    await pending;
    assert.equal(ready, true);
  } finally { f.restore(); }
});

test("Chapter commit failures propagate once and still restore navigation and scene styles", async () => {
  for (const asynchronous of [false, true]) {
    const f = fixture();
    try {
      const from = f.chapter("003"), to = f.chapter("004");
      let calls = 0;
      const run = f.runtime.run(element(from), element(to), false, () => {
        calls++;
        if (asynchronous) return Promise.reject(new Error("Commit failed"));
        throw new Error("Commit failed");
      });
      const rejected = assert.rejects(run, /Commit failed/);
      f.finish();
      await rejected;
      assert.equal(calls, 1);
      assert.equal(f.body.children.length, 0);
      assert.equal(from.surface!.style.opacity, "");
      assert.equal(f.runtime.active, false);
    } finally { f.restore(); }
  }
});

test("Stage loader stays cold offscreen and imports only once near the viewport", async () => {
  const f = fixture();
  try {
    let loads = 0, binds = 0;
    watchChibiStage(async () => { loads++; return { initKisaraChibiStage: () => { binds++; } }; });
    assert.equal(loads, 0);
    f.observers[0].emit();
    f.observers[0].emit();
    await flush();
    assert.equal(loads, 1);
    assert.equal(binds, 1);
    assert.equal(f.observers[0].disconnected, true);
    f.stage.dispatchEvent(new Event("focusin"));
    await flush();
    assert.equal(loads, 1);
  } finally { f.restore(); }
});

test("A late stage import cannot bind a detached or replaced page", async () => {
  const f = fixture();
  try {
    let done!: (module: { initKisaraChibiStage: () => void }) => void;
    let binds = 0;
    watchChibiStage(() => new Promise(resolve => { done = resolve; }));
    f.observers[0].emit();
    f.doc.dispatchEvent(new Event("astro:before-swap"));
    done({ initKisaraChibiStage: () => { binds++; } });
    await flush();
    assert.equal(binds, 0);
    assert.equal(f.observers[0].disconnected, true);
    assert.equal(f.stage.dataset.loaderBound, undefined);
  } finally { f.restore(); }
});

test("Stage loading resumes after a hidden near-viewport observation", async () => {
  const f = fixture();
  try {
    let loads = 0;
    watchChibiStage(async () => { loads++; return { initKisaraChibiStage() {} }; });
    f.doc.hidden = true;
    f.observers[0].emit();
    assert.equal(loads, 0);
    f.stage.rect.top = 800;
    f.doc.hidden = false;
    f.doc.dispatchEvent(new Event("visibilitychange"));
    await flush();
    assert.equal(loads, 1);
  } finally { f.restore(); }
});

test("Cleanup preserves article rules, frame boundaries, current fridge headings and all stage interactions", () => {
  const theme = read("styles/theme.css"), home = read("styles/home.css");
  const chibi = read("components/KisaraChibiStage.astro"), runtime = read("lib/chibiStage.ts");
  assert.doesNotMatch(theme, /\.kisara-(?:page-lead|directory-shell|identity-shell|game-list|project-list|footer-wave)(?![\w-])/);
  assert.match(theme, /\.kisara-article-shell/);
  assert.match(theme, /\.kisara-article-end nav/);
  assert.match(theme, /\.kisara-not-found nav/);
  assert.doesNotMatch(home, /kisara-fridge-(?:inventory|curtain|veil-image)|kisara-home-projects/);
  assert.match(home, /kisara-fridge-overlay-heading/);
  assert.match(home, /kisara-fridge-findings-status/);
  assert.doesNotMatch(home, /url\([^)]*fridge-/);
  assert.doesNotMatch(chibi, /kisara-chibi-(?:city|beacon|ambient|floor)|backdrop-filter/);
  assert.match(chibi, /:not\(\[data-ready\]\) \.kisara-chibi/);
  assert.match(runtime, /const playApplePrelude =[^]*loadAppleVideo\(\)/);
  assert.doesNotMatch(runtime, /applePreloadObserver/);
  for (const token of ["playAppleScene", "playJealousyScene", "dragFrame.flush()", "lostpointercapture"]) assert.ok(runtime.includes(token));
  const fridge = read("components/KisaraFridgeScene.astro");
  assert.match(fridge, /class="kisara-fridge-first-frame"/);
  assert.doesNotMatch(fridge, /\sposter=/);
  assert.match(fridge, /waitForVideoFrame\(video, readyFrameController\.signal\)/);
  const join = read("styles/home-transitions.css"), chapter = read("lib/chapterTransition.ts");
  assert.match(join, /height: 96px;\s*margin-block: -48px/);
  assert.match(join, /display: flow-root/);
  assert.doesNotMatch(chapter, /style\.zIndex|motion\.animate\(from,|motion\.animate\(to,/);
  assert.match(chapter, /motion\.animate\(surfaceOf\(from\)/);
  assert.match(home, /is-fridge-resetting[^}]*\.kisara-fridge-last-frame[^}]*transition: none/);
  const board = read("components/KisaraHomeEventVideo.astro");
  assert.match(board, /kisara-home-board-first" src="[^"]*home-event-003-new-first\.webp"/);
  assert.doesNotMatch(board, /\sposter=/);
});

test("Home ends at 004 and embeds one interactive cast in 003; Blog uses its own compact ending", () => {
  const home = read("pages/HomePage.astro");
  const stops = home.slice(home.indexOf("const homeSectionStops ="), home.indexOf("let scrollFrame =", home.indexOf("const homeSectionStops =")));
  assert.match(home, /showFooter=\{false\}/);
  assert.doesNotMatch(stops, /kisara-footer/);
  assert.doesNotMatch(home, /is-latest-to-footer/);
  assert.match(read("components/KisaraLatestNotes.astro"), /<footer class="kisara-latest-footer"><KisaraFooterMeta \/><\/footer>/);
  assert.match(read("components/KisaraHomeEventVideo.astro"), /<KisaraChibiStage embedded \/>/);
  const layout = read("layouts/KisaraLayout.astro");
  assert.match(layout, /pageKey !== "blog" \|\| isArticlePage/);
  assert.match(read("pages/BlogIndexPage.astro"), /kisara-blog-archive-tail/);
  const css = read("styles/home-event-video.css");
  assert.match(css, /\[data-entered\] \.kisara-chibi:not\(\[data-arrival-settled\]\) \.kisara-chibi-arrival/);
  assert.doesNotMatch(css.slice(css.indexOf("@keyframes kisara-embedded-chibi-pop"), css.indexOf(".kisara-home-video-media {")), /var\(--chibi-[xy]\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
