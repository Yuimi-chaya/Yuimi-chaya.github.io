import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";
import postcss from "postcss";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const heroSource = read("src/themes/kisara/lib/worksHero.ts");
const styles = read("src/themes/kisara/styles/projects.css");
const flush = async () => { for (let index = 0; index < 8; index++) await Promise.resolve(); };
const deferred = () => {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

class Node extends EventTarget {
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  nodes = new Map<string, Node>();
  hidden = false;
  querySelector(selector: string) { return this.nodes.get(selector) ?? null; }
  hasAttribute(name: string) { return this.attributes.has(name); }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
}

function fixture(reduced = false) {
  const document = Object.assign(new Node(), { hidden: false });
  const window = new Node();
  const root = new Node();
  const hero = new Node();
  const replay = new Node();
  const motion = Object.assign(new Node(), { matches: reduced });
  const plays: ReturnType<typeof deferred>[] = [];
  const frames = new Map<number, (_: number, metadata: { mediaTime: number }) => void>();
  const timers = new Map<number, () => void>();
  let nextId = 0;
  const video = Object.assign(new Node(), {
    paused: true, ended: false, muted: false, error: null as null | { code: number },
    readyState: 0, currentTime: 0, seeking: false, preload: "none", loads: 0, pauses: 0,
    load() { this.loads++; this.error = null; },
    pause() { this.paused = true; this.pauses++; },
    play() { this.paused = false; const next = deferred(); plays.push(next); return next.promise; },
    requestVideoFrameCallback(fn: (_: number, metadata: { mediaTime: number }) => void) {
      const id = ++nextId; frames.set(id, fn); return id;
    },
    cancelVideoFrameCallback(id: number) { frames.delete(id); }
  });
  Object.defineProperty(video, "src", {
    get: () => video.attributes.get("src") ?? "",
    set: (value: string) => video.attributes.set("src", value)
  });
  let currentTime = 0;
  Object.defineProperty(video, "currentTime", {
    get: () => currentTime,
    set: (value: number) => { currentTime = value; if (value === 0) video.ended = false; }
  });
  video.dataset.src = "/themes/kisara/assets/works-opening.mp4";
  const decoding: ReturnType<typeof deferred>[] = [];
  const still = Object.assign(new Node(), {
    complete: false, naturalWidth: 1920, loading: "eager",
    decode() { const next = deferred(); decoding.push(next); return next.promise; }
  });
  root.nodes.set("[data-works-intro]", hero);
  hero.nodes.set("[data-works-intro-video]", video);
  hero.nodes.set("[data-works-intro-replay]", replay);
  hero.nodes.set(".kisara-index-film-still", still);
  let observer!: { callback: (entries: any[]) => void; disconnected: boolean };
  class Observer {
    disconnected = false;
    callback: (entries: any[]) => void;
    constructor(callback: (entries: any[]) => void) { this.callback = callback; observer = this; }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  const setTimer = (fn: () => void) => { const id = ++nextId; timers.set(id, fn); return id; };
  Object.assign(window, {
    matchMedia: () => motion,
    requestAnimationFrame: setTimer,
    cancelAnimationFrame: (id: number) => timers.delete(id)
  });
  const source = [
    read("src/themes/kisara/lib/videoFrame.ts"),
    read("src/themes/kisara/lib/videoStill.ts"),
    heroSource.replace(/^import .*;\r?\n/gm, ""),
    "bindWorksHero"
  ].join("\n").replaceAll("export function", "function");
  const bind = vm.runInNewContext(stripTypeScriptTypes(source), {
    window, document, AbortController, IntersectionObserver: Observer,
    setTimeout: setTimer, clearTimeout: (id: number) => timers.delete(id)
  });
  const cleanup = bind(root);
  const visible = (value: boolean) => observer.callback([{ isIntersecting: value }]);
  const frame = () => {
    video.readyState = 2;
    video.currentTime = .1;
    video.dispatchEvent(new Event("playing"));
    const callbacks = [...frames.values()];
    frames.clear();
    callbacks.forEach(fn => fn(0, { mediaTime: .1 }));
  };
  const ended = () => { video.ended = true; video.dispatchEvent(new Event("ended")); };
  return { root, hero, video, still, replay, motion, window, document, plays, frames,
    timers, decoding, observer, cleanup, visible, frame, ended };
}

test("Works film waits for visibility and a decoded frame, then holds its terminal frame", async () => {
  const f = fixture();
  assert.equal(f.video.loads, 0);
  assert.equal(f.hero.dataset.videoState, "idle");
  assert.equal(f.video.muted, true);
  f.visible(true);
  assert.equal(f.video.loads, 1);
  assert.equal(f.plays.length, 1);
  assert.equal(f.hero.hasAttribute("data-frame-ready"), false);
  f.frame();
  f.plays[0].resolve();
  await flush();
  assert.equal(f.hero.dataset.videoState, "playing");
  assert.equal(f.hero.hasAttribute("data-frame-ready"), true);
  f.ended();
  assert.equal(f.hero.dataset.videoState, "complete");
  assert.equal(f.still.hasAttribute("data-video-still-ready"), false);
  f.decoding[0].resolve();
  await flush();
  assert.equal(f.still.hasAttribute("data-video-still-ready"), true);
  f.visible(false);
  f.visible(true);
  assert.equal(f.plays.length, 1, "Scrolling back does not replay the short film");
  f.cleanup();
});

test("Rapid replay and late rejected play promises cannot overwrite newer playback or completion", async () => {
  const f = fixture();
  f.visible(true);
  f.replay.dispatchEvent(new Event("click"));
  assert.equal(f.plays.length, 2);
  f.frame();
  f.plays[1].resolve();
  await flush();
  f.plays[0].reject(new Error("Old play aborted"));
  await flush();
  assert.equal(f.hero.dataset.videoState, "playing");
  assert.equal(f.video.paused, false);
  f.replay.dispatchEvent(new Event("click"));
  f.ended();
  f.plays[2].reject(new Error("Ended before promise settled"));
  await flush();
  assert.equal(f.hero.dataset.videoState, "complete");
  f.cleanup();
});

test("Background tabs and offscreen heroes pause, resume unfinished media and clean up on route departure", async () => {
  const f = fixture();
  f.visible(true);
  f.visible(false);
  assert.equal(f.video.paused, true);
  f.plays[0].resolve();
  await flush();
  f.visible(true);
  assert.equal(f.plays.length, 2);
  f.document.hidden = true;
  f.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(f.video.paused, true);
  f.document.hidden = false;
  f.document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(f.plays.length, 3);
  f.cleanup();
  assert.equal(f.video.paused, true);
  assert.equal(f.observer.disconnected, true);
  assert.equal(f.frames.size, 0);
  assert.equal(f.timers.size, 0);
  f.plays[2].reject(new Error("Navigated away"));
  f.replay.dispatchEvent(new Event("click"));
  f.motion.dispatchEvent(new Event("change"));
  await flush();
  assert.equal(f.plays.length, 3);
  assert.doesNotThrow(() => f.cleanup());
});

test("Reduced motion stays static without fetching video, and changing the preference remains safe", () => {
  const f = fixture(true);
  f.visible(true);
  assert.equal(f.video.loads, 0);
  assert.equal(f.hero.dataset.videoState, "static");
  assert.equal(f.replay.hidden, true);
  f.motion.matches = false;
  f.motion.dispatchEvent(new Event("change"));
  assert.equal(f.plays.length, 1);
  assert.equal(f.replay.hidden, false);
  f.motion.matches = true;
  f.motion.dispatchEvent(new Event("change"));
  assert.equal(f.video.paused, true);
  assert.equal(f.hero.dataset.videoState, "static");
  f.cleanup();
});

test("A blocked or timed-out autoplay keeps a still and permits a later readiness or explicit retry", async () => {
  const f = fixture();
  f.visible(true);
  f.plays[0].reject(new Error("Autoplay blocked"));
  await flush();
  assert.equal(f.hero.dataset.videoState, "static");
  f.replay.dispatchEvent(new Event("click"));
  assert.equal(f.plays.length, 2);
  const timeouts = [...f.timers.values()];
  timeouts.forEach(fn => fn());
  await flush();
  assert.equal(f.hero.dataset.videoState, "static");
  f.video.dispatchEvent(new Event("canplay"));
  assert.equal(f.plays.length, 3);
  assert.equal(f.video.loads, 1, "Late readiness does not restart the request");
  f.cleanup();
});

test("New Astro media nodes load independently and BFCache restoration starts a fresh one-shot", () => {
  const f = fixture();
  f.visible(true);
  f.ended();
  f.window.dispatchEvent(new Event("pagehide"));
  f.window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
  assert.equal(f.plays.length, 2);
  assert.equal(f.video.currentTime, 0);
  assert.equal(f.hero.hasAttribute("data-frame-ready"), false);
  f.cleanup();
  const next = fixture();
  next.visible(true);
  assert.equal(next.video.loads, 1);
  assert.equal(next.plays.length, 1);
  next.cleanup();
});

test("A queued ended event cannot restart natural completion or cancel a newly sought replay", () => {
  const f = fixture();
  f.visible(true);
  f.video.ended = true;
  f.video.paused = true;
  f.visible(false);
  f.visible(true);
  assert.equal(f.plays.length, 1);
  assert.equal(f.hero.dataset.videoState, "complete");
  f.replay.dispatchEvent(new Event("click"));
  assert.equal(f.plays.length, 2);
  assert.equal(f.video.ended, false);
  f.video.dispatchEvent(new Event("ended"));
  assert.equal(f.video.paused, false, "A stale ended event cannot stop the new replay");
  f.cleanup();
});

test("BFCache restoration while the hero is offscreen rewinds before the next visible playback", () => {
  const f = fixture();
  f.visible(true);
  f.video.currentTime = .4;
  f.visible(false);
  f.window.dispatchEvent(new Event("pagehide"));
  f.window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted: true }));
  assert.equal(f.video.currentTime, 0);
  assert.equal(f.plays.length, 1, "Do not play behind the archive");
  f.visible(true);
  assert.equal(f.plays.length, 2);
  assert.equal(f.video.currentTime, 0);
  f.cleanup();
});

test("Film layout shares one complete frame, respects theme zoom and cannot create a scroll runway", () => {
  const css = postcss.parse(styles);
  assert.match(styles, /object-fit: contain/);
  const media = css.nodes.find((node: any) => node.selector === ".kisara-index-film video,\n.kisara-index-film-poster,\n.kisara-index-film-still") as any;
  assert.ok(media, "Video and still share exactly the same geometry");
  assert.match(media.toString(), /object-position: right center/);
  assert.match(styles, /min-height: min\(620px, calc\(78svh \/ var\(--kisara-scale, 1\)\)\)/);
  assert.match(styles, /@media \(max-width: 860px\)/);
  assert.match(styles, /aspect-ratio: 16 \/ 9/);
  assert.match(styles, /data-video-state="complete"[\s\S]*data-video-still-ready/);
  assert.doesNotMatch(heroSource, /addEventListener\(["'](?:wheel|scroll)|scrollTo|scrollIntoView/);
  for (const name of ["works-opening.mp4", "works-opening-first.webp", "works-opening-last.webp"]) {
    assert.ok(statSync(new URL(`../public/themes/kisara/assets/${name}`, import.meta.url)).size > 0);
  }
  const page = read("src/themes/kisara/pages/ProjectsPage.astro");
  assert.match(page, /data-src="\/themes\/kisara\/assets\/works-opening\.mp4"/);
  assert.doesNotMatch(page, /\bautoplay\b|\bloop\b|worksHero[^"']*\?url/);
  assert.match(page, /entry !== generation/);
  assert.match(page, /releaseIndex\(\);[\s\S]*releaseHero\(\);/);
});
