import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import postcss from "postcss";
import { bindVideoStill } from "../src/themes/kisara/lib/videoStill.ts";

const read = (path: string) => readFileSync(new URL(`../src/themes/kisara/${path}`, import.meta.url), "utf8");
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

function fixture(cached = false) {
  const controller = new AbortController();
  const video = Object.assign(new EventTarget(), { readyState: 0 });
  let ready = false;
  const pending: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
  const image = Object.assign(new EventTarget(), {
    loading: "lazy", complete: cached, naturalWidth: 1920,
    hasAttribute: () => ready,
    setAttribute: () => { ready = true; },
    decode: () => new Promise<void>((resolve, reject) => pending.push({ resolve, reject })),
  });
  bindVideoStill(video as unknown as HTMLVideoElement, image as unknown as HTMLImageElement, controller.signal);
  return { video, image, pending, controller, ready: () => ready };
}

test("Terminal stills warm with playback and never become visible before decoding", async () => {
  const f = fixture();
  try {
    assert.equal(f.image.loading, "lazy");
    assert.equal(f.pending.length, 0);
    f.video.dispatchEvent(new Event("loadedmetadata"));
    f.video.dispatchEvent(new Event("playing"));
    f.video.dispatchEvent(new Event("ended"));
    assert.equal(f.pending.length, 1, "Concurrent media events reuse the decode");
    assert.equal(f.ready(), false, "Ended alone cannot uncover a first-frame background");
    f.pending[0].resolve();
    await flush();
    assert.equal(f.ready(), true);
    f.video.dispatchEvent(new Event("playing"));
    assert.equal(f.pending.length, 1, "Re-entry reuses the decoded still");
  } finally { f.controller.abort(); }
});

test("Cached, failed, late-loading and aborted stills preserve a safe handoff", async () => {
  const cached = fixture(true);
  cached.pending[0].resolve();
  await flush();
  assert.equal(cached.ready(), true);
  cached.controller.abort();

  const f = fixture();
  try {
    f.video.dispatchEvent(new Event("playing"));
    f.pending[0].reject(new Error("Image unavailable"));
    await flush();
    assert.equal(f.ready(), false, "Keep the video visible on failed decode");
    f.image.dispatchEvent(new Event("load"));
    assert.equal(f.pending.length, 2);
    f.pending[1].resolve();
    await flush();
    assert.equal(f.ready(), true);
  } finally { f.controller.abort(); }

  const aborted = fixture();
  aborted.video.dispatchEvent(new Event("playing"));
  aborted.controller.abort();
  aborted.pending[0].resolve();
  await flush();
  assert.equal(aborted.ready(), false, "Late decoding cannot mutate a departed route");
});

const declarations = (path: string, selector: string) => {
  const values: Record<string, string> = {};
  postcss.parse(read(path)).walkRules(rule => {
    if (rule.selector !== selector) return;
    rule.walkDecls(decl => { values[decl.prop] = decl.value; });
  });
  return values;
};

test("One-shot media overlays decoded terminal stills atomically and leaves the video underneath", () => {
  for (const [path, selector] of [
    ["styles/home.css", ".kisara-fridge-last-frame"],
  ]) {
    assert.equal(declarations(path, selector).transition, "none");
    assert.equal(declarations(path, selector)["z-index"], "1");
  }
  assert.equal(declarations("styles/home.css",
    ".kisara-fridge-scene.is-fridge-open .kisara-fridge-last-frame[data-video-still-ready]").opacity, "1");
  assert.equal(declarations("styles/home-event-video.css", ".kisara-home-board-still")["z-index"], "1");
  assert.equal(declarations("styles/home-event-video.css", ".kisara-home-video-media::after")["z-index"], "2");
  for (const path of ["styles/home-event-video.css"]) {
    postcss.parse(read(path)).walkRules(rule => {
      if (!rule.selector.includes('"complete"')) return;
      rule.walkDecls("visibility", decl => assert.notEqual(decl.value, "hidden", rule.selector));
    });
  }
  assert.match(read("lib/homeEvent.ts"), /bindVideoStill\(video/);
  assert.match(read("components/KisaraFridgeScene.astro"), /bindVideoStill\(video/);
});

test("002 and 003 retain both colored seam strips without the obsolete fridge slash underneath", () => {
  const css = "styles/home-transitions.css";
  assert.equal(declarations(css,
    ".kisara-home-transition::before,\n.kisara-home-transition::after").content, '""');
  assert.equal(declarations(css, ".kisara-home-transition::before").background, "#ad3c60");
  assert.equal(declarations(css, ".kisara-home-transition::after").background, "#7bb6b2");
  assert.doesNotMatch(read(css), /\.is-fridge-to-event(?:::before|::after)?\s*\{/);
  assert.equal(declarations(css, ".kisara-home-transition").height, "96px");
  assert.equal(declarations(css, ".kisara-home-transition")["margin-block"], "-48px");
  assert.doesNotMatch(read("styles/home.css"), /\.kisara-fridge-deck::(?:before|after)/);
  assert.doesNotMatch(read("styles/home.css"), /linear-gradient\(108deg, transparent 0 43%/);
});

test("Fridge visibility at the end boundary completes without seeking back to zero", () => {
  const source = read("components/KisaraFridgeScene.astro");
  const start = source.indexOf("const syncSceneAfterVisibility =");
  const end = source.indexOf("const scheduleVisibilitySync =", start);
  const state = {
    sceneVisible: true, waitingForFreshEntry: false, opened: false, openingStarted: true,
    document: { hidden: false }, video: { paused: true, ended: true },
    measureSceneVisibility: () => true, stopLoop() {}, ensureLoop() {},
    finishOpening: () => { completions++; },
    resetActiveOpening: () => { resets++; },
    startOpening: () => { starts++; },
  };
  let completions = 0, resets = 0, starts = 0;
  new Function("scope", `with (scope) { ${stripTypeScriptTypes(source.slice(start, end))} syncSceneAfterVisibility(); }`)(state);
  assert.deepEqual({ completions, resets, starts }, { completions: 1, resets: 0, starts: 0 });
});

test("The chibi cutscene pauses at exit and rewinds only when the next playback starts", () => {
  const source = read("lib/chibiStage.ts");
  const clear = source.slice(source.indexOf("const clearAppleScene ="), source.indexOf("const cancelScene ="));
  assert.match(clear, /appleVideo\.pause\(\)/);
  assert.doesNotMatch(clear, /currentTime\s*=/);
  const play = source.slice(source.indexOf("const startAppleMedia ="), source.indexOf("const configureAppleScene ="));
  assert.match(play, /appleVideo\.currentTime = 0/);
});
