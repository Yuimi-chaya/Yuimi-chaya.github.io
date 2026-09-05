import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("study.js", import.meta.url), "utf8");

class Element extends EventTarget {
  constructor(value = "") {
    super();
    this.value = value;
    this.dataset = {};
    this.attributes = new Map();
    this.style = {};
    this.hidden = false;
    this.disabled = false;
    this.src = "";
    this.checked = false;
    const tokens = new Set();
    this.classList = {
      add: (...values) => values.forEach(value => tokens.add(value)),
      remove: (...values) => values.forEach(value => tokens.delete(value)),
      contains: value => tokens.has(value),
      toggle: (value, force = !tokens.has(value)) => {
        if (force) tokens.add(value);
        else tokens.delete(value);
        return force;
      },
    };
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return name === "src" ? this.src : this.attributes.get(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  fire(name) { this.dispatchEvent(new Event(name)); }
  decode() { return Promise.resolve(); }
}

const flush = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};

async function fixture({ reducedMotion = false } = {}) {
  const ids = [
    "stage", "comic", "portrait-image", "fridge", "fridge-video", "fridge-final",
    "next", "replay", "stage-message", "scene-view", "compare-view", "comparison",
    "zoom", "zoom-value",
  ];
  const nodes = Object.fromEntries(ids.map(id => [id, new Element()]));
  const materials = ["hybrid", "vector"].map(value => new Element(value));
  const views = ["scene", "compare"].map(value => new Element(value));
  const crops = ["full", "face"].map(value => new Element(value));
  const images = [new Element(), new Element()];
  const size = new Element();
  const document = new Element();
  document.hidden = false;
  document.querySelector = selector => selector === ".material-size" ? size : nodes[selector.slice(1)];
  document.querySelectorAll = selector => ({
    '[name="material"]': materials,
    '[name="view"]': views,
    '[name="crop"]': crops,
    "[data-size]": [],
    ".inspect-frame > img": images,
  })[selector] ?? [];
  const timers = new Map();
  let clock = 0, nextTimer = 1, videoFrame = null;
  const window = new Element();
  const video = nodes["fridge-video"];
  video.dataset.src = "../../public/themes/kisara/assets/fridge-opening-002.mp4";
  video.paused = true;
  video.readyState = 0;
  video.currentTime = 0;
  video.seeking = false;
  video.playCalls = 0;
  video.pause = () => { video.paused = true; };
  video.play = () => {
    video.playCalls++;
    video.paused = false;
    return Promise.resolve();
  };
  video.requestVideoFrameCallback = callback => { videoFrame = callback; return 1; };
  video.cancelVideoFrameCallback = () => { videoFrame = null; };
  nodes["portrait-image"].src = "assets/subject-hybrid.webp";
  nodes.zoom.value = "1";
  nodes["stage-message"].hidden = true;
  const setTimer = (callback, delay) => {
    const id = nextTimer++;
    timers.set(id, { callback, due: clock + delay });
    return id;
  };
  const context = vm.createContext({
    document, window, matchMedia: () => ({ matches: reducedMotion }),
    setTimeout: setTimer, clearTimeout: id => timers.delete(id),
    AbortController, Image: Element, console,
  });
  new vm.Script(source).runInContext(context);
  await flush();
  const advance = milliseconds => {
    const until = clock + milliseconds;
    for (;;) {
      const next = [...timers].filter(([, timer]) => timer.due <= until)
        .sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      clock = next[1].due;
      timers.delete(next[0]);
      next[1].callback();
    }
    clock = until;
  };
  const frame = () => { const callback = videoFrame; videoFrame = null; callback?.(); };
  const ready = () => { video.readyState = 2; video.fire("loadeddata"); };
  return { nodes, materials, views, crops, images, document, video, advance, frame, ready };
}

test("002 waits for coverage and the first decoded video frame", async () => {
  const f = await fixture();
  f.nodes.next.fire("click");
  f.ready();
  f.advance(719);
  assert.equal(f.video.playCalls, 0);
  f.advance(1);
  assert.equal(f.video.playCalls, 1);
  assert.equal(f.nodes.stage.dataset.state, "fridge");
  assert.equal(f.nodes.stage.classList.contains("is-covered"), true);
  assert.equal(f.nodes.next.disabled, true);
  f.frame();
  assert.equal(f.nodes.stage.classList.contains("is-video-ready"), true);
  f.advance(180);
  assert.equal(f.nodes.stage.classList.contains("is-covered"), false);
  assert.equal(f.nodes.next.disabled, false);
  f.nodes.next.fire("click");
  assert.equal(f.nodes.stage.dataset.state, "comic");
  assert.equal(f.video.paused, true);
});

test("A replay cancels timers and late callbacks from the previous transition", async () => {
  const f = await fixture();
  f.nodes.next.fire("click");
  f.nodes.replay.fire("click");
  f.ready();
  f.advance(15000);
  f.frame();
  assert.equal(f.nodes.stage.dataset.state, "comic");
  assert.equal(f.video.playCalls, 0);
  assert.equal(f.nodes["stage-message"].hidden, true);
});

test("Cached video waits for a completed seek instead of exposing its old frame", async () => {
  const f = await fixture();
  f.video.readyState = 4;
  f.video.seeking = true;
  f.nodes.next.fire("click");
  f.advance(720);
  assert.equal(f.video.playCalls, 0);
  f.video.seeking = false;
  f.video.fire("seeked");
  assert.equal(f.video.playCalls, 1);
});

test("Reduced-motion handoff stays black until a decoded frame is available", async () => {
  const f = await fixture({ reducedMotion: true });
  f.nodes.next.fire("click");
  f.advance(60);
  assert.equal(f.nodes.stage.classList.contains("is-covered"), true);
  assert.equal(f.video.playCalls, 0);
  f.ready();
  f.frame();
  assert.equal(f.nodes.stage.dataset.state, "fridge");
});

test("Media failure restores an interactive comic and a readable error", async () => {
  const f = await fixture();
  f.nodes.next.fire("click");
  f.video.fire("error");
  assert.equal(f.nodes.stage.dataset.state, "comic");
  assert.equal(f.nodes.next.disabled, false);
  assert.equal(f.nodes["stage-message"].hidden, false);
});

test("Suspending during loading neither times out nor starts hidden playback", async () => {
  const f = await fixture();
  f.nodes.next.fire("click");
  f.document.hidden = true;
  f.document.fire("visibilitychange");
  f.ready();
  f.advance(20000);
  assert.equal(f.video.playCalls, 0);
  assert.equal(f.nodes["stage-message"].hidden, true);
  f.document.hidden = false;
  f.document.fire("visibilitychange");
  assert.equal(f.video.playCalls, 1);
  f.frame();
  f.document.hidden = true;
  f.document.fire("visibilitychange");
  assert.equal(f.video.paused, true);
  f.document.hidden = false;
  f.document.fire("visibilitychange");
  assert.equal(f.video.paused, false);
});

test("Compare view cancels playback; material and zoom controls remain functional", async () => {
  const f = await fixture();
  f.materials[1].fire("change");
  await flush();
  assert.equal(f.nodes["portrait-image"].src, "assets/subject-vector.svg");
  f.nodes.next.fire("click");
  f.ready();
  f.advance(720);
  f.frame();
  f.views[1].fire("change");
  assert.equal(f.nodes["scene-view"].hidden, true);
  assert.equal(f.nodes["compare-view"].hidden, false);
  assert.equal(f.video.paused, true);
  f.nodes.zoom.value = "1.7";
  f.nodes.zoom.fire("input");
  assert.equal(f.images[0].style.transform, "translateX(-50%) scale(1.7)");
  f.crops[1].fire("change");
  assert.equal(f.nodes.comparison.dataset.crop, "face");
  assert.equal(f.nodes.zoom.value, "1");
});

test("A visible stalled load exits its black cover after the bounded timeout", async () => {
  const f = await fixture();
  f.nodes.next.fire("click");
  f.advance(10000);
  assert.equal(f.nodes.stage.dataset.state, "comic");
  assert.equal(f.nodes.stage.classList.contains("is-covered"), false);
  assert.equal(f.nodes.next.disabled, false);
  assert.equal(f.nodes["stage-message"].hidden, false);
});
