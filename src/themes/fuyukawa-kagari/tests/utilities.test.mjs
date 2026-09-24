import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import postcss from "postcss";
import sharp from "sharp";
import { clampWaifuPosition, mountWaifuAnchor } from "../lib/waifu-anchor.mjs";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const layout = read("layouts/BaseLayout.astro");
const css = postcss.parse(read("styles/refresh.css"));
const declarations = (root, selector) => {
  const values = {};
  root.walkRules((rule) => {
    if (rule.selector !== selector || rule.parent.type !== "root") return;
    rule.walkDecls((declaration) => { values[declaration.prop] = declaration.value; });
  });
  return values;
};
const section = (start, end) => layout.slice(layout.indexOf(start), layout.indexOf(end));

class Element {
  constructor() {
    this.events = new Map();
    this.attributes = {};
    this.styles = {};
    this.style = {
      setProperty: (key, value) => { this.styles[key] = value; },
      removeProperty: (key) => { delete this.style[key]; delete this.styles[key]; }
    };
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle: (name, force = !classes.has(name)) => {
        if (force) classes.add(name); else classes.delete(name);
        return force;
      }
    };
    this.value = "0";
    this.textContent = "";
  }
  addEventListener(name, handler, options = {}) {
    const handlers = this.events.get(name) ?? new Set();
    handlers.add(handler);
    this.events.set(name, handlers);
    options.signal?.addEventListener("abort", () => handlers.delete(handler));
  }
  removeEventListener(name, handler) { this.events.get(name)?.delete(handler); }
  dispatch(name, event = {}) { for (const handler of [...(this.events.get(name) ?? [])]) handler(event); }
  setAttribute(key, value) { this.attributes[key] = value; }
}

test("drawer has a viewport-sized flex frame and a visible, independently scrollable panel", () => {
  const dock = declarations(css, "body[data-fuyukawa] .toy-dock");
  const panel = declarations(css, "body[data-fuyukawa] .toy-dock-panel");
  assert.equal(dock.top, "var(--dock-top)");
  assert.match(dock.bottom, /safe-area-inset-bottom/);
  assert.equal(dock.display, "flex");
  assert.equal(panel.display, "block");
  assert.equal(panel["min-height"], "0");
  assert.equal(panel["max-height"], "100%");
  assert.equal(panel["overflow-y"], "auto");
  assert.equal(panel["overscroll-behavior-y"], "contain");
  assert.equal(panel["scrollbar-width"], "thin");
  assert.equal(declarations(css, "body[data-fuyukawa] .toy-dock-panel::-webkit-scrollbar").display, "block");
  const source = read("styles/refresh.css");
  assert.match(source, /max-height: 600px[^]*?--dock-top: 76px/);
  assert.match(layout, /aria-expanded="false" aria-controls="toy-dock-panel"/);
  assert.match(layout, /id="toy-dock-panel"/);
});

test("drawer pin, second-click close, hover reentry and Escape agree with aria-expanded", () => {
  const dock = new Element(), handle = new Element(), doc = new Element(), win = new Element();
  const timers = new Map();
  let id = 0;
  dock.contains = (node) => node === dock || node === handle;
  dock.matches = () => dock.hovered || dock.focused;
  dock.querySelector = (selector) => selector === ":focus" ? (dock.focused ? handle : null) : handle;
  handle.closest = () => handle;
  handle.blur = () => { dock.focused = false; };
  doc.querySelector = () => dock;
  win.setTimeout = (fn) => { timers.set(++id, fn); return id; };
  win.clearTimeout = (key) => timers.delete(key);
  vm.runInNewContext(section("let toyDockCloseTimer", 'const live2dBase ='), {
    document: doc, window: win, Node: Element, Element, queueMicrotask
  });
  dock.hovered = true;
  doc.dispatch("pointerover", { target: handle });
  assert.equal(handle.attributes["aria-expanded"], "true");
  doc.dispatch("click", { target: handle });
  assert.equal(dock.classList.contains("is-pinned"), true);
  doc.dispatch("click", { target: handle });
  assert.equal(handle.attributes["aria-expanded"], "false");
  assert.equal(dock.classList.contains("is-dismissed"), true);
  doc.dispatch("pointerover", { target: handle });
  assert.equal(handle.attributes["aria-expanded"], "true");
  win.dispatch("keydown", { key: "Escape" });
  assert.equal(handle.attributes["aria-expanded"], "false");
  dock.hovered = false;
  dock.focused = true;
  doc.dispatch("focusin", { target: handle });
  assert.equal(handle.attributes["aria-expanded"], "true");
  doc.dispatch("astro:before-swap");
  assert.equal(handle.attributes["aria-expanded"], "false");
});

test("About game entries use small complete thumbnails in an actual grid", () => {
  const root = postcss.parse(read("pages/AboutPage.astro").match(/<style>([\s\S]*?)<\/style>/)[1]);
  const card = declarations(root, ".about-game-card");
  const image = declarations(root, ".about-game-card img");
  assert.equal(card.display, "grid");
  assert.equal(card["grid-template-columns"], "92px minmax(0, 1fr)");
  assert.equal(image.width, "92px");
  assert.equal(image.height, "64px");
  assert.equal(image["min-height"], "0");
  assert.equal(image["object-fit"], "contain");
  root.walkRules((rule) => {
    if (rule.selector === ".about-game-card img") {
      rule.walkDecls("object-fit", (decl) => assert.equal(decl.value, "contain"));
    }
  });
  assert.equal(declarations(root, ".about-game-card div")["min-height"], "0");
  assert.doesNotMatch(read("styles/refresh-pages.css"), /\.about-game-card (?:img|div|h3|p)\s*\{/);
});

test("Home title keeps dark ink and a white contour over manga artwork", () => {
  const title = declarations(css, "body[data-fuyukawa] .hero h1");
  const titleSvg = readFileSync(new URL("../../../../public/themes/fuyukawa-kagari/assets/hero-title.svg", import.meta.url), "utf8");
  const ink = titleSvg.match(/<use[^>]+fill="(#[a-f\d]{6})"/)?.[1];
  assert.equal(ink, "#465575");
  assert.match(titleSvg, /stroke="#fff" stroke-width="100"[^>]+paint-order="stroke fill"/);
  assert.equal(title["-webkit-text-stroke"], "0");
  assert.match(title.filter, /drop-shadow\(3px 4px 0 #e9b9d0\)/);
  const linear = (v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
  const rgb = ink.slice(1).match(/../g).map((part) => linear(parseInt(part, 16) / 255));
  const luminance = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  assert.ok(1.05 / (luminance + .05) > 7);
});

test("sakura uses small notched artwork and compositor-only nested animations", async () => {
  assert.match(read("components/SakuraRain.astro"), /length: 16/);
  assert.match(read("components/SakuraRain.astro"), /<i><\/i>/);
  assert.match(layout, /<SakuraRain \/>/);
  assert.doesNotMatch(layout, /length: 34/);
  for (const name of ["fuyukawa-petal-fall", "fuyukawa-petal-flutter"]) {
    const rule = css.nodes.find((node) => node.type === "atrule" && node.name === "keyframes" && node.params === name);
    assert.ok(rule);
    rule.walkDecls((decl) => assert.ok(["opacity", "transform"].includes(decl.prop), decl.prop));
  }
  assert.match(css.toString(), /data-yuimi-visibility="hidden"[^]*?animation-play-state: paused/);
  assert.match(css.toString(), /prefers-reduced-motion: reduce[^]*?\.sakura-rain \{ display: none/);
  assert.match(css.toString(), /data-yuimi-performance="lite"[^]*?\.sakura-rain \{ display: none/);
  assert.equal(declarations(css, "body[data-fuyukawa] .sakura-rain").opacity, "1");
  assert.equal(declarations(css, "body[data-fuyukawa] .sakura-rain span").height, "var(--sakura-size)");
  assert.match(read("components/SakuraRain.astro"), /opacity: \(0.86/);
  const image = await sharp(fileURLToPath(new URL("../../../../public/themes/fuyukawa-kagari/assets/sakura-petal.svg", import.meta.url)))
    .resize(96, 128).ensureAlpha().raw().toBuffer();
  let visible = 0, transparent = 0;
  for (let i = 3; i < image.length; i += 4) { if (image[i] > 0) visible++; else transparent++; }
  assert.ok(visible > 4000 && transparent > 1000);
});

test("Live2D position and visibility remain defined without any CDN stylesheet", () => {
  const waifu = declarations(css, "body[data-fuyukawa] #waifu");
  assert.equal(waifu.position, "fixed");
  assert.equal(waifu.top, "auto");
  assert.match(waifu.bottom, /safe-area-inset-bottom/);
  assert.match(waifu["--waifu-size"], /100dvh/);
  assert.equal(declarations(css, "body[data-fuyukawa] #waifu.waifu-active").opacity, "1");
  assert.equal(declarations(css, "body[data-fuyukawa] #waifu.waifu-hidden").display, "none");
  assert.match(layout, /drag: false/);
  assert.match(layout, /anchorWaifu\(waifu\)/);
  assert.match(layout, /astro:before-swap", hideLive2dForRoute/);
});

test("drag bounds do not depend on document scroll or page height", () => {
  for (const [viewportWidth, viewportHeight, size] of [[1440, 900, 280], [390, 844, 220], [320, 240, 176]]) {
    for (const left of [-5000, 0, 100, 99999]) {
      for (const top of [-5000, 0, 100, 99999]) {
        const result = clampWaifuPosition(left, top, size, size, viewportWidth, viewportHeight);
        assert.ok(result.left >= 8 && result.top >= 8);
        assert.ok(result.left + size <= viewportWidth - 8);
        assert.ok(result.top + size <= viewportHeight - 8);
      }
    }
  }
  assert.doesNotMatch(read("lib/waifu-anchor.mjs"), /scrollY|scrollHeight|pageY|requestAnimationFrame|setInterval/);
});

test("Live2D drag is clamped, reflows after resize, and releases captures/listeners on cleanup", () => {
  const root = new Element(), doc = new Element(), win = new Element();
  win.innerWidth = 1000;
  win.innerHeight = 700;
  doc.visibilityState = "visible";
  doc.body = { appendChild: (node) => { node.parentElement = doc.body; } };
  root.ownerDocument = doc;
  root.style.top = "10000px";
  root.getBoundingClientRect = () => {
    const [x = 0, y = 0] = (root.style.translate ?? "").split(" ").map(parseFloat);
    return { left: 14 + (x || 0), top: win.innerHeight - 288 + (y || 0), width: 280, height: 280 };
  };
  let captured = null;
  root.setPointerCapture = (id) => { captured = id; };
  root.hasPointerCapture = (id) => captured === id;
  root.releasePointerCapture = (id) => { captured = null; root.dispatch("lostpointercapture", { pointerId: id }); };
  const cleanup = mountWaifuAnchor(root, win);
  assert.equal(root.parentElement, doc.body);
  assert.equal(root.style.top, undefined);
  root.dispatch("pointerdown", { button: 0, isPrimary: true, target: { id: "live2d" }, pointerId: 1, clientX: 24, clientY: 430 });
  root.dispatch("pointermove", { pointerId: 1, clientX: 5000, clientY: 8000 });
  let rect = root.getBoundingClientRect();
  assert.equal(rect.left + rect.width, 992);
  assert.equal(rect.top + rect.height, 692);
  root.dispatch("pointerup", { pointerId: 1 });
  assert.equal(captured, null);
  win.innerWidth = 480;
  win.innerHeight = 400;
  win.dispatch("resize");
  rect = root.getBoundingClientRect();
  assert.ok(rect.left >= 8 && rect.left + rect.width <= 472);
  assert.ok(rect.top >= 8 && rect.top + rect.height <= 392);
  root.classList.add("waifu-hidden");
  const lastTranslation = root.style.translate;
  win.dispatch("resize");
  assert.equal(root.style.translate, lastTranslation);
  root.classList.remove("waifu-hidden");
  root.dispatch("pointerdown", { button: 0, isPrimary: true, target: { id: "live2d" }, pointerId: 2, clientX: 24, clientY: 140 });
  cleanup();
  assert.equal(captured, null);
  for (const node of [root, doc, win]) {
    for (const handlers of node.events.values()) assert.equal(handlers.size, 0);
  }
});

test("resource loading deduplicates requests but recreates styles removed by a head swap", async () => {
  const nodes = [];
  const doc = {
    head: {
      querySelectorAll: () => nodes,
      appendChild: (node) => nodes.push(node)
    },
    createElement: () => ({ remove() { const index = nodes.indexOf(this); if (index >= 0) nodes.splice(index, 1); } })
  };
  const context = vm.createContext({ document: doc });
  vm.runInContext(`const live2dResources = new Map(); ${section("const loadExternalResource =", "const setWaifuVisibility =")} globalThis.load = loadExternalResource;`, context);
  const url = "https://example.test/waifu.css";
  const first = context.load(url, "css");
  assert.equal(context.load(url, "css"), first);
  assert.equal(nodes.length, 1);
  nodes[0].onload();
  await first;
  nodes[0].remove();
  const second = context.load(url, "css");
  assert.notEqual(first, second);
  assert.equal(nodes.length, 1);
  nodes[0].onerror();
  await assert.rejects(second);
  assert.equal(nodes.length, 0);
  const third = context.load(url, "css");
  nodes[0].onload();
  await third;
});

test("rapid hide/show cancels stale Live2D hiding without changing its viewport anchor", () => {
  const waifu = new Element(), toggle = new Element(), timers = new Map();
  let nextTimer = 0, anchors = 0;
  const context = vm.createContext({
    document: { getElementById: () => waifu },
    window: {
      setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; },
      clearTimeout(id) { timers.delete(id); }
    },
    localStorage: { setItem() {}, removeItem() {} },
    anchorWaifu: () => { anchors++; },
    live2dToggle: toggle,
    setLive2dStatus() {}
  });
  vm.runInContext("let live2dVisible = true, live2dVisibilityTimer = 0;" +
    section("const setWaifuVisibility =", "const showWaifuMessage =") +
    "globalThis.show = setWaifuVisibility;", context);
  context.show(false);
  assert.equal(timers.size, 1);
  context.show(true);
  assert.equal(timers.size, 0);
  assert.equal(waifu.classList.contains("waifu-active"), true);
  assert.equal(waifu.classList.contains("waifu-hidden"), false);
  assert.equal(anchors, 1);
  context.show(false);
  for (const fn of timers.values()) fn();
  assert.equal(waifu.classList.contains("waifu-hidden"), true);
});

test("late widget polling cannot revive Live2D after the route generation changes", () => {
  const timers = [], waifu = new Element();
  let found = false, callbacks = 0;
  const context = vm.createContext({
    document: { getElementById: () => found ? waifu : null },
    window: { setTimeout: (fn) => timers.push(fn) },
    isHomeRoute: () => true
  });
  vm.runInContext("let live2dGeneration = 1;" +
    section("const waitForWaifu =", "const ensureLocalWaifuFallback =") +
    "globalThis.wait = waitForWaifu;", context);
  context.wait(() => { callbacks++; });
  assert.equal(timers.length, 1);
  found = true;
  vm.runInContext("live2dGeneration++;", context);
  timers.shift()();
  assert.equal(callbacks, 0);
  context.wait(() => { callbacks++; });
  assert.equal(callbacks, 1);
});

test("music UI preserves zero volume, icon children, seek fill and live playback state", async () => {
  const nodes = new Map(), doc = new Element(), win = new Element();
  for (const name of ["toggle", "prev", "next", "volume", "seek", "current", "duration", "note", "status", "volume-label"]) {
    nodes.set(`[data-music-${name}]`, new Element());
  }
  nodes.set(".music-track", new Element());
  doc.querySelector = (selector) => nodes.get(selector);
  doc.body = new Element();
  const storage = () => {
    const data = new Map();
    return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  };
  const localStorage = storage();
  localStorage.setItem("yuimi-radio-state-v1", JSON.stringify({ volume: 0 }));
  win.location = { origin: "https://example.test" };
  class Audio extends Element {
    constructor() { super(); this.volume = .28; this.paused = true; this.currentTime = 25; this.duration = 100; }
    load() {}
    async play() { this.paused = false; this.dispatch("play"); }
    pause() { this.paused = true; this.dispatch("pause"); }
  }
  const context = vm.createContext({
    document: doc, window: win, localStorage, sessionStorage: storage(), Audio,
    URL, AbortController, fetch: async () => ({ json: async () => [{ id: "1", title: "A track", src: "/track.mp3" }] })
  });
  vm.runInContext(section("const musicCacheKey =", "window.__yuimiRadio ??=") + "globalThis.player = createYuimiRadio();", context);
  const player = context.player;
  const toggle = nodes.get("[data-music-toggle]");
  toggle.textContent = "existing icon children";
  await player.init();
  player.bind();
  assert.equal(nodes.get("[data-music-volume]").value, "0");
  assert.equal(nodes.get("[data-music-volume-label]").textContent, "0%");
  assert.equal(toggle.textContent, "existing icon children");
  await player.audio.play();
  assert.equal(toggle.attributes["aria-pressed"], "true");
  assert.equal(nodes.get("[data-music-status]").textContent, "播放中");
  const seek = nodes.get("[data-music-seek]");
  seek.value = "80";
  seek.dispatch("input");
  assert.equal(seek.styles["--range-fill"], "80%");
  assert.equal(nodes.get("[data-music-current]").textContent, "01:20");
  seek.dispatch("change");
  assert.equal(player.audio.currentTime, 80);
  player.audio.pause();
  assert.equal(toggle.attributes["aria-label"], "播放音乐");
  player.bind();
  assert.equal(toggle.events.get("click").size, 1);
  for (const controller of ["controlAbort", "audioAbort", "unlockAbort"]) player[controller]?.abort();
});
