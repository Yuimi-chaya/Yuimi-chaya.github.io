import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import vm from "node:vm";
import test from "node:test";
import sharp from "sharp";
import postcss from "postcss";
import { parse } from "@astrojs/compiler";
import { springStep, layerOffsets, nearestRailIndex, mountMangaScene, mountAlbum, mountArchive, mountChapterRail } from "../lib/manga-runtime.mjs";

const root = process.cwd();
const theme = path.join(root, "src/themes/fuyukawa-kagari");
const assets = path.join(root, "public/themes/fuyukawa-kagari/assets");
const read = (file) => fs.readFile(path.join(theme, file), "utf8");
const manifest = JSON.parse(await fs.readFile(path.join(assets, "manga/manifest.json"), "utf8"));

test("artwork derivatives have correct dimensions, transparent stickers and bounded byte counts", async () => {
  let bytes = 0;
  for (const output of manifest.outputs) {
    const file = path.join(assets, "manga", output.file);
    const buffer = await fs.readFile(file);
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.width, output.width, output.file);
    assert.equal(metadata.height, output.height, output.file);
    assert.equal(buffer.length, output.bytes);
    assert.equal(crypto.createHash("sha256").update(buffer).digest("hex"), output.sha256);
    assert.ok(output.bytes < 900_000, output.file);
    if (/kagari-|haruto-|festival-pair|hero-character/.test(output.file)) assert.ok(metadata.hasAlpha, output.file);
    bytes += buffer.length;
  }
  assert.ok(bytes < 3_500_000);
  assert.equal(manifest.sourceFiles.length, 55);
  assert.ok(manifest.outputs.every((output) => output.sources.every((source) => !source.endsWith(".mp4"))));
});

test("all 55 source artworks remain byte-identical", async () => {
  for (const source of manifest.sourceFiles) {
    const bytes = await fs.readFile(path.join(root, source.file));
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), source.sha256, source.file);
  }
});

test("the transparent hero preserves original opaque pixels without resampling colour", async () => {
  const original = await sharp(path.join(assets, "hero-wallpaper.jpg")).resize(1920, 1080).removeAlpha().raw().toBuffer();
  const foreground = await sharp(path.join(assets, "manga/hero-character.webp")).ensureAlpha().raw().toBuffer();
  const mask = await sharp(path.join(theme, "art/hero-subject-mask.svg")).resize(1920, 1080).ensureAlpha().extractChannel(3).raw().toBuffer();
  let opaque = 0, transparent = 0;
  for (let i = 0; i < 1920 * 1080; i++) {
    assert.equal(foreground[i * 4 + 3], mask[i], `alpha pixel ${i}`);
    if (!mask[i]) { transparent++; continue; }
    if (mask[i] === 255) {
      opaque++;
      for (let c = 0; c < 3; c++) assert.equal(foreground[i * 4 + c], original[i * 3 + c], `RGB pixel ${i}`);
    }
  }
  assert.ok(opaque > 400_000 && transparent > 1_500_000);
});

test("background reconstruction preserves every pixel in the intact original panel regions", async () => {
  const original = await sharp(path.join(assets, "hero-wallpaper.jpg")).resize(1920, 1080).removeAlpha().raw().toBuffer();
  const background = await sharp(path.join(assets, "manga/hero-manga.webp")).removeAlpha().raw().toBuffer();
  for (const rect of manifest.hero.preservedRegions) {
    for (let y = rect.top; y < rect.top + rect.height; y++) {
      const from = (y * 1920 + rect.left) * 3;
      assert.deepEqual(background.subarray(from, from + rect.width * 3), original.subarray(from, from + rect.width * 3));
    }
  }
});

test("spring and parallax remain bounded across frame rates and oversized deltas", () => {
  for (const fps of [30, 60, 120]) {
    let position = 0, velocity = 0;
    for (let i = 0; i < fps * 4; i++) {
      ({ position, velocity } = springStep(position, velocity, 1, 1 / fps));
      assert.ok(Number.isFinite(position) && Math.abs(position) <= 1.08);
    }
    assert.ok(Math.abs(position - 1) < .001);
  }
  for (const x of [-10, -1, 0, 1, 10]) {
    for (const y of [-10, -1, 0, 1, 10]) {
      const { front, back } = layerOffsets(x, y, 20);
      assert.ok(Math.abs(front.x) < 10 && Math.abs(front.y) < 15);
      assert.ok(Math.abs(back.x) < 5 && Math.abs(back.y) < 9);
      // A 24px overscan on each side contains both layers at every permitted pose.
      assert.ok(Math.abs(front.x) < 24 && Math.abs(front.y) < 24);
    }
  }
});

function element(dataset = {}) {
  const events = new Map();
  return {
    dataset, events, style: {}, attributes: {}, isConnected: true, hidden: false,
    addEventListener(event, handler) {
      if (!events.has(event)) events.set(event, new Set());
      events.get(event).add(handler);
    },
    removeEventListener(event, handler) { events.get(event)?.delete(handler); },
    dispatch(event, value = {}) { for (const handler of events.get(event) ?? []) handler(value); },
    setAttribute(key, value) { this.attributes[key] = value; },
    removeAttribute(key) { delete this.attributes[key]; },
    querySelector() {}, querySelectorAll() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1200, height: 700 }; }
  };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

function sceneFixture({ reduce = false, fine = true, decode = () => Promise.resolve() } = {}) {
  const root = element();
  const front = Object.assign(element(), { decode, naturalWidth: 1920 });
  const back = Object.assign(element(), { decode, naturalWidth: 1920 });
  root.querySelector = (selector) => selector === "[data-manga-front]" ? front : back;
  const reduced = Object.assign(element(), { matches: reduce });
  const pointer = Object.assign(element(), { matches: fine });
  const frames = new Map();
  let frameId = 0, observer, time = 0;
  const win = Object.assign(element(), {
    scrollY: 0, navigator: { connection: {} },
    matchMedia: (query) => query.includes("reduced") ? reduced : pointer,
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
    IntersectionObserver: class {
      constructor(callback) { observer = this; this.callback = callback; this.disconnected = false; }
      observe() {}
      disconnect() { this.disconnected = true; }
    }
  });
  const doc = Object.assign(element(), { hidden: false, documentElement: { dataset: {} } });
  const cleanup = mountMangaScene(root, win, doc);
  const step = () => {
    time += 1000 / 60;
    const batch = [...frames.values()]; frames.clear();
    batch.forEach((callback) => callback(time));
  };
  return { root, front, back, win, doc, reduced, pointer, frames, step, observer, cleanup };
}

test("scene swaps layers atomically after decode, sleeps at rest and tears down all listeners", async () => {
  const fixture = sceneFixture();
  assert.equal(fixture.root.dataset.ready, undefined);
  await settle();
  assert.equal(fixture.root.dataset.ready, "true");
  fixture.root.dispatch("pointermove", { clientX: 1000, clientY: 550, pointerType: "mouse" });
  for (let i = 0; i < 280; i++) fixture.step();
  assert.match(fixture.front.style.transform, /translate3d\(6\.000px/);
  assert.equal(fixture.frames.size, 0);
  fixture.root.dispatch("pointerleave");
  fixture.step();
  assert.ok(fixture.frames.size > 0);
  fixture.cleanup();
  assert.equal(fixture.frames.size, 0);
  assert.ok(fixture.observer.disconnected);
  assert.equal(fixture.front.style.transform, "");
  assert.ok([...fixture.win.events.values()].every((handlers) => handlers.size === 0));
  assert.ok([...fixture.root.events.values()].every((handlers) => handlers.size === 0));
});

test("scene stops for reduced motion, coarse pointer, hidden, offscreen and lite modes", async () => {
  for (const options of [{ reduce: true }, { fine: false }]) {
    const fixture = sceneFixture(options);
    await settle();
    fixture.root.dispatch("pointermove", { clientX: 1000, clientY: 550 });
    assert.equal(fixture.frames.size, 0);
    assert.equal(fixture.root.dataset.ready, "true");
    fixture.cleanup();
  }
  const fixture = sceneFixture();
  await settle();
  fixture.root.dispatch("pointermove", { clientX: 1000, clientY: 550 });
  fixture.step();
  fixture.doc.hidden = true;
  fixture.doc.dispatch("visibilitychange");
  assert.equal(fixture.frames.size, 0);
  assert.equal(fixture.front.style.transform, "");
  fixture.doc.hidden = false;
  fixture.doc.dispatch("visibilitychange");
  fixture.observer.callback([{ isIntersecting: false }]);
  assert.equal(fixture.frames.size, 0);
  fixture.observer.callback([{ isIntersecting: true }]);
  fixture.doc.documentElement.dataset.yuimiPerformance = "lite";
  fixture.step();
  assert.equal(fixture.frames.size, 0);
  fixture.cleanup();
});

test("failed or late image decode never reveals an incomplete scene", async () => {
  const failed = sceneFixture({ decode: () => Promise.reject(new Error("Image missing")) });
  await settle();
  assert.equal(failed.root.dataset.ready, "false");
  assert.equal(failed.frames.size, 0);
  failed.cleanup();
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  const late = sceneFixture({ decode: () => promise });
  late.cleanup();
  resolve();
  await settle();
  assert.equal(late.root.dataset.ready, undefined);
  assert.equal(late.frames.size, 0);
});

test("album keeps one complete picture selected and removes its handlers", () => {
  const root = element();
  const tabs = Array.from({ length: 3 }, () => element());
  const pages = Array.from({ length: 3 }, () => element());
  root.querySelectorAll = (selector) => selector.includes("tab") ? tabs : pages;
  const cleanup = mountAlbum(root);
  tabs[2].dispatch("click");
  assert.deepEqual(pages.map((page) => page.hidden), [true, true, false]);
  assert.deepEqual(tabs.map((tab) => tab.attributes["aria-pressed"]), ["false", "false", "true"]);
  cleanup();
  assert.ok(tabs.every((tab) => tab.events.get("click").size === 0));
});

test("archive filters include empty categories and restore every entry", () => {
  const root = element();
  const tabs = ["all", "tech", "anime", "life"].map((archiveCategory) => element({ archiveCategory }));
  const entries = ["tech", "life", "tech"].map((entryCategory) => element({ entryCategory }));
  const count = element();
  root.querySelectorAll = (selector) => selector.includes("archive-category") ? tabs : entries;
  root.querySelector = () => count;
  const cleanup = mountArchive(root);
  tabs[2].dispatch("click");
  assert.ok(entries.every((entry) => entry.hidden));
  assert.equal(count.textContent, "0 篇笔记");
  tabs[1].dispatch("click");
  assert.deepEqual(entries.map((entry) => entry.hidden), [false, true, false]);
  tabs[0].dispatch("click");
  assert.ok(entries.every((entry) => !entry.hidden));
  cleanup();
});

test("chapter controls target real leaf positions and account for track ends", () => {
  assert.equal(nearestRailIndex([0, 324, 648, 972], 600), 2);
  const root = element(), stage = element(), previous = element(), next = element(), label = element();
  root.style = { getPropertyValue() { return ""; }, setProperty() {}, removeProperty() {} };
  const track = Object.assign(element(), { scrollLeft: 0, scrollWidth: 1296, clientWidth: 400, scrollTo(value) { this.scrollLeft = Math.min(value.left, this.scrollWidth - this.clientWidth); } });
  const items = [0, 324, 648, 972].map((offsetLeft) => Object.assign(element(), { offsetLeft }));
  root.querySelectorAll = () => items;
  root.querySelector = (selector) => ({ ".chapter-rail-stage": stage, "[data-rail-track]": track, "[data-rail-prev]": previous, "[data-rail-next]": next, "[data-rail-position]": label })[selector];
  const frames = [];
  const win = Object.assign(element(), { matchMedia: () => ({ matches: true }), requestAnimationFrame: (callback) => { frames.push(callback); return frames.length; }, cancelAnimationFrame() {} });
  win.matchMedia = () => Object.assign(element(), { matches: true });
  const cleanup = mountChapterRail(root, win);
  assert.equal(root.dataset.railMode, "native");
  assert.equal(track.tabIndex, 0);
  assert.equal(previous.disabled, true);
  next.dispatch("click");
  assert.equal(track.scrollLeft, 324);
  track.dispatch("scroll"); frames.pop()();
  assert.equal(label.textContent, "02 / 04");
  assert.equal(items[1].attributes["data-rail-active"], "true");
  assert.equal(items[0].attributes["data-rail-active"], undefined);
  next.dispatch("click"); next.dispatch("click");
  track.dispatch("scroll"); frames.pop()();
  assert.equal(next.disabled, true);
  cleanup();
  assert.equal(root.dataset.railMode, undefined);
  assert.ok([...track.events.values()].every((handlers) => handlers.size === 0));
});

test("vertical chapter runway advances, reverses and releases scrolling without wheel capture", () => {
  const root = element(), stage = Object.assign(element(), { clientHeight: 600, clientWidth: 500 });
  const previous = element(), next = element(), label = element();
  const styles = new Map();
  root.style = {
    getPropertyValue: (name) => styles.get(name) ?? "",
    setProperty: (name, value) => styles.set(name, value),
    removeProperty: (name) => styles.delete(name)
  };
  const track = Object.assign(element(), { scrollLeft: 0, scrollWidth: 2060, clientWidth: 500, scrollTo() {} });
  const items = [250, 770, 1290, 1810].map((offsetLeft) => Object.assign(element(), { offsetLeft }));
  root.querySelectorAll = () => items;
  root.querySelector = (selector) => ({ ".chapter-rail-stage": stage, "[data-rail-track]": track, "[data-rail-prev]": previous, "[data-rail-next]": next, "[data-rail-position]": label })[selector];
  const reduced = Object.assign(element(), { matches: false });
  const fine = Object.assign(element(), { matches: true });
  const frames = new Map();
  let frameId = 0;
  const win = Object.assign(element(), {
    scrollY: 0,
    matchMedia: (query) => query.includes("reduced") ? reduced : fine,
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
    scrollTo({ top, behavior }) { this.scrollY = top; this.lastBehavior = behavior; this.dispatch("scroll"); }
  });
  root.getBoundingClientRect = () => ({ top: 500 - win.scrollY });
  const step = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((callback) => callback()); };
  const cleanup = mountChapterRail(root, win);
  assert.equal(root.dataset.railMode, "scroll");
  assert.equal(track.tabIndex, -1);
  assert.equal(styles.get("--rail-runway"), "2160px");
  assert.equal(track.style.transform, "translate3d(0px, 0, 0)");
  win.scrollY = 500 + 540;
  win.dispatch("scroll"); step();
  assert.equal(track.style.transform, "translate3d(-540px, 0, 0)");
  assert.equal(label.textContent, "02 / 04");
  previous.dispatch("click"); step();
  assert.equal(win.scrollY, 500);
  assert.equal(win.lastBehavior, "smooth");
  win.scrollY = 500 + 1560 + 500;
  win.dispatch("scroll"); step();
  assert.equal(track.style.transform, "translate3d(-1560px, 0, 0)");
  assert.equal(label.textContent, "04 / 04");
  assert.equal(next.disabled, true);
  win.scrollY = 500 + 520;
  win.dispatch("scroll"); step();
  assert.equal(label.textContent, "02 / 04");
  assert.equal(items[3].attributes["data-rail-active"], undefined);
  track.dispatch("focusin", { target: items[2] }); step();
  assert.equal(win.scrollY, 500 + 1040);
  assert.equal(win.lastBehavior, "instant");
  assert.equal(items[2].attributes["data-rail-active"], "true");
  reduced.matches = true; reduced.dispatch("change");
  assert.equal(root.dataset.railMode, "native");
  assert.equal(track.tabIndex, 0);
  assert.equal(styles.has("--rail-runway"), false);
  assert.equal(track.style.transform, "");
  cleanup();
  assert.ok([...win.events.values()].every((handlers) => handlers.size === 0));
  assert.ok([...fine.events.values()].every((handlers) => handlers.size === 0));
  assert.ok([...reduced.events.values()].every((handlers) => handlers.size === 0));
});

test("manga CSS stays theme-local, responsive, and never crops article covers", async () => {
  const source = await read("styles/manga.css") + "\n" + await read("styles/manga-pages.css");
  const css = postcss.parse(source);
  css.walkRules((rule) => {
    for (const selector of postcss.list.comma(rule.selector)) assert.ok(selector.startsWith("body[data-fuyukawa]"), selector);
  });
  css.walkDecls("font-size", (declaration) => assert.doesNotMatch(declaration.value, /vw|cqw/));
  assert.doesNotMatch(source, /\.post-cover-frame\s+img|\.journal-entry\s*>\s*img/);
  assert.match(source, /inset: -24px/);
  assert.match(source, /\.manga-scene-camera \.manga-scene-front \{[^}]*object-fit: contain/);
  assert.match(source, /height: calc\(100% - 64px\)/);
  assert.match(source, /body\[data-fuyukawa\] :where\(\.manga-art\)/);
  assert.match(source, /max-width: 480px/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(await read("lib/manga-runtime.mjs"), /preventDefault|deviceorientation|setInterval/);
  assert.match(source, /\.chapter-track::-webkit-scrollbar \{ display: none; \}/);
  assert.match(source, /\.chapter-rail\[data-rail-mode="scroll"\] \.chapter-rail-stage \{ position: sticky/);
  assert.match(source, /:has\(\.chapter-rail\[data-rail-mode="scroll"\]\) \{ overflow-x: clip; \}/);
  assert.match(await read("components/ChapterRail.astro"), /class="chapter-rail-stage"/);
  assert.match(source, /\.chapter-rail-stage \{ width: 100%; overflow: clip; \}/);
  assert.doesNotMatch(await read("pages/BlogIndexPage.astro"), /compact-post-row|class="post-list"/);
  assert.match(await read("layouts/BaseLayout.astro"), /canonicalPath !== "\/" && <link rel="stylesheet" href=\{mangaPagesHref\}/);
});

test("Home title uses baked outlines and a nearly complete pen-mask reveal", async () => {
  const home = await read("pages/HomePage.astro");
  const refresh = await read("styles/refresh.css");
  const mobile = await read("styles/manga.css");
  const svg = await fs.readFile(path.join(assets, "hero-title.svg"), "utf8");
  assert.match(home, /<h1><img src="\/themes\/fuyukawa-kagari\/assets\/hero-title\.svg" alt="Yuimi Lab" \/><\/h1>/);
  assert.match(refresh, /\.hero-copy \{[^}]*translateY\(calc\(-20px \+ \(1 - var\(--copy-opacity\)\) \* -30px\)\)/);
  assert.match(refresh, /\.hero h1 \{[^}]*aspect-ratio: 451\.824 \/ 94/);
  assert.match(await read("tools/prepare-title-lettering.py"), /segoeprb\.ttf/);
  assert.match(svg, /<path id="glyph-Y" d="M874 664V665/);
  assert.match(mobile, /max-width: 760px[^]*?\.hero-copy \{[^}]*top: 118px;[^}]*transform: translateY\(calc\(\(1 - var\(--copy-opacity\)\) \* -30px\)\)/);
  assert.equal((svg.match(/class="pen"/g) ?? []).length, 18);
  assert.equal((svg.match(/<use href="#glyph-/g) ?? []).length, 8);
  assert.doesNotMatch(svg, /<text|@font-face|href="\/themes\/kisara/);
  assert.match(svg, /@media\(prefers-reduced-motion:reduce\)\{\.pen\{animation:none\}\}/);
  assert.ok(Buffer.byteLength(svg) < 16_000);

  const full = svg.replaceAll(/ mask="url\(#pen-\d+\)"/g, "");
  const maskedPixels = await sharp(Buffer.from(svg)).resize({ width: 906 }).ensureAlpha().raw().toBuffer();
  const fullPixels = await sharp(Buffer.from(full)).resize({ width: 906 }).ensureAlpha().raw().toBuffer();
  let ink = 0, missing = 0, outside = 0;
  for (let index = 3; index < maskedPixels.length; index += 4) {
    if (fullPixels[index] > 127) {
      ink += 1;
      if (maskedPixels[index] < 127) missing += 1;
    } else if (maskedPixels[index] > 127) outside += 1;
  }
  assert.ok(ink > 50_000);
  assert.ok(missing / ink < .005, `missing ${missing} / ${ink} pixels`);
  assert.equal(outside, 0);
});

test("every new Astro template parses and images have a single typed registry", async () => {
  for (const file of (await fs.readdir(path.join(theme, "components"))).filter((name) => name.endsWith(".astro"))) {
    const result = await parse(await read(`components/${file}`));
    assert.deepEqual(result.diagnostics.filter((diagnostic) => diagnostic.severity === 1), [], file);
  }
  const registry = await read("data/mangaArt.ts");
  for (const output of manifest.outputs) {
    const name = output.file.replace(".webp", "");
    assert.ok(registry.includes(`"${name}": [${output.width}, ${output.height}]`), name);
  }
});

test("profile reveal gates fast wheels and stays steady through collapse and reopening", async () => {
  const hero = element(), stage = element(), document = element(), window = element();
  const profileCard = element();
  const classes = new Set(), styles = {};
  hero.classList = {
    add: (...values) => values.forEach((value) => classes.add(value)),
    remove: (...values) => values.forEach((value) => classes.delete(value)),
    toggle: (value, force) => force ? classes.add(value) : classes.delete(value)
  };
  hero.style.setProperty = (key, value) => { styles[key] = value; };
  hero.querySelector = (selector) => selector === ".identity-terminal" ? profileCard : null;
  stage.querySelector = () => hero;
  stage.getBoundingClientRect = () => ({ top: -window.scrollY, bottom: 800 - window.scrollY });
  document.querySelector = (selector) => selector === "[data-hero-stage]" ? stage : null;
  document.documentElement = { classList: { contains: () => false } };
  const timers = new Map(), frames = new Map();
  let id = 0;
  Object.assign(window, {
    scrollY: 0, innerHeight: 800,
    setTimeout: (callback, delay) => { timers.set(++id, { callback, delay }); return id; },
    clearTimeout: (timer) => timers.delete(timer),
    scrollTo({ top }) { this.scrollY = top; }
  });
  const context = vm.createContext({
    window, document, history: {}, location: { hash: "" },
    requestAnimationFrame: (callback) => { frames.set(++id, callback); return id; },
    cancelAnimationFrame: (frame) => frames.delete(frame)
  });
  vm.runInContext((await read("lib/home-hero.mjs")).replace("export function", "function") + "\nvar cleanup = mountHomeHero();", context);
  const wheel = (deltaY) => {
    const event = { deltaY, prevented: false, preventDefault() { this.prevented = true; } };
    window.dispatch("wheel", event);
    return event;
  };
  window.scrollY = 12;
  assert.equal(wheel(200).prevented, true);
  assert.equal(window.scrollY, 12);
  assert.ok(classes.has("is-pulling"));
  const settleTimer = [...timers.values()].find((timer) => timer.delay === 260);
  settleTimer.callback();
  assert.ok(classes.has("is-docked"));
  assert.equal(styles["--profile-opacity"], "1");
  assert.equal(wheel(60).prevented, true);
  assert.equal([...timers.values()].some((timer) => timer.delay === 120), false);
  profileCard.dispatch("transitionend", { target: profileCard, propertyName: "opacity" });
  assert.equal(wheel(60).prevented, true);
  assert.equal(wheel(-2).prevented, true);
  assert.ok(classes.has("is-docked"));
  assert.equal(wheel(60).prevented, true);
  assert.equal(wheel(-3).prevented, true);
  assert.ok(classes.has("is-docked"));
  profileCard.dispatch("transitionend", { target: profileCard, propertyName: "transform" });
  assert.equal(wheel(60).prevented, false);
  window.scrollY = 0;
  assert.equal(wheel(-60).prevented, true);
  assert.equal(styles["--profile-opacity"], "0");
  assert.equal(wheel(200).prevented, true);
  [...timers.values()].find((timer) => timer.delay === 260).callback();
  assert.equal(wheel(60).prevented, true);
  assert.equal(typeof [...timers.values()].find((timer) => timer.delay === 900)?.callback, "function");
  assert.equal(wheel(-60).prevented, true);
  profileCard.dispatch("transitionend", { target: profileCard, propertyName: "transform" });
  assert.equal(wheel(200).prevented, true);
  assert.equal(wheel(60).prevented, true);
  [...timers.values()].find((timer) => timer.delay === 260).callback();
  assert.equal(wheel(60).prevented, true);
  assert.equal(wheel(-2).prevented, true);
  assert.ok(classes.has("is-docked"));
  assert.equal(wheel(60).prevented, true);
  [...timers.values()].find((timer) => timer.delay === 900).callback();
  assert.equal(wheel(60).prevented, false);
  window.scrollY = 1200;
  assert.equal(wheel(60).prevented, false);
  assert.equal(window.scrollY, 1200);
  context.cleanup();
  assert.equal(timers.size, 0);
  assert.ok([...window.events.values()].every((handlers) => handlers.size === 0));
  assert.ok([...profileCard.events.values()].every((handlers) => handlers.size === 0));
});

test("avatar flower has a generous hit area and keeps tracking a captured drag", async () => {
  const markup = await read("pages/HomePage.astro");
  const css = await read("styles/theme.css");
  assert.match(markup, /class="avatar-flower" data-avatar-flower/);
  assert.match(css, /\.avatar-flower \{[^}]*width: 64px;[^}]*height: 64px;[^}]*pointer-events: none;/);
  assert.match(css, /\.hero\.is-docked \.avatar-flower \{[^}]*pointer-events: auto;/);
  assert.match(css, /\.avatar-flower\.is-dragging \{[^}]*transform 0ms;/);
  assert.match(css, /\.avatar-flower::after \{[^}]*left: 25px;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^}]*\.avatar-flower\.is-tracking,[^}]*\.avatar-flower\.is-dragging \{[^}]*transition: none;/);
  assert.match(await read("lib/home-hero.mjs"), /if \(reduceFlowerMotion\) return;/);

  const hero = element(), stage = element(), doc = element(), win = element();
  const flower = element(), avatar = element();
  const classes = new Set(), styles = {}, captures = new Set(), timers = new Map();
  let timerId = 0;
  hero.style.setProperty = () => {};
  hero.classList = { add() {}, remove() {} };
  stage.querySelector = () => hero;
  stage.getBoundingClientRect = () => ({ top: 0 });
  flower.style.setProperty = (key, value) => { styles[key] = value; };
  flower.classList = {
    add: (...values) => values.forEach((value) => classes.add(value)),
    remove: (...values) => values.forEach((value) => classes.delete(value))
  };
  flower.getBoundingClientRect = () => ({ left: 100, width: 64 });
  flower.setPointerCapture = (id) => captures.add(id);
  flower.hasPointerCapture = (id) => captures.has(id);
  flower.releasePointerCapture = (id) => captures.delete(id);
  doc.querySelector = (selector) => ({
    "[data-hero-stage]": stage,
    "[data-avatar-flower]": flower,
    "[data-poke-avatar]": avatar
  })[selector] ?? null;
  doc.documentElement = { classList: { contains: () => false } };
  Object.assign(win, {
    scrollY: 0, innerHeight: 800,
    setTimeout: (callback) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id) => timers.delete(id),
    scrollTo() {}
  });
  const context = vm.createContext({
    window: win, document: doc, history: {}, location: { hash: "#keep-position" },
    requestAnimationFrame: () => 1, cancelAnimationFrame() {}
  });
  vm.runInContext((await read("lib/home-hero.mjs")).replace("export function", "function") + "\nvar cleanup = mountHomeHero();", context);

  flower.dispatch("pointermove", { clientX: 152, pointerType: "mouse" });
  assert.equal(styles["--flower-sway"], "12.5deg");
  let prevented = false;
  flower.dispatch("pointerdown", { pointerId: 7, clientX: 152, button: 0, isPrimary: true, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.ok(captures.has(7));
  flower.dispatch("pointermove", { pointerId: 7, clientX: 212, pointerType: "mouse" });
  assert.equal(styles["--flower-sway"], "32deg");
  flower.dispatch("pointerleave");
  flower.dispatch("pointerup", { pointerId: 8 });
  assert.equal(styles["--flower-sway"], "32deg");
  flower.dispatch("pointerup", { pointerId: 7 });
  assert.equal(styles["--flower-sway"], "0deg");
  assert.equal(captures.size, 0);
  assert.ok(!classes.has("is-dragging"));

  flower.dispatch("pointerdown", { pointerId: 9, clientX: 132, button: 0, preventDefault() {} });
  flower.dispatch("pointermove", { pointerId: 9, clientX: 92 });
  assert.equal(styles["--flower-sway"], "-18deg");
  flower.dispatch("pointercancel", { pointerId: 9 });
  assert.equal(styles["--flower-sway"], "0deg");
  flower.dispatch("pointerdown", { pointerId: 10, clientX: 132, button: 0, preventDefault() {} });
  assert.ok(captures.has(10));
  context.cleanup();
  assert.equal(captures.size, 0);
  assert.equal(styles["--flower-sway"], "0deg");
  assert.ok([...flower.events.values()].every((handlers) => handlers.size === 0));
  assert.ok([...avatar.events.values()].every((handlers) => handlers.size === 0));
});
