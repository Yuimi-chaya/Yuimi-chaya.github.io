import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";
import { bindGamesViewport, getGameViewportFit } from "../src/themes/kisara/lib/gamesViewport.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("The complete cabinet fits available width and height at 90 and 100 percent zoom", () => {
  for (const [width, height] of [[2306, 1152], [1920, 1080], [1366, 768], [1280, 720], [1024, 600], [844, 390], [390, 844], [375, 667], [320, 568]]) {
    for (const zoom of [.9, 1]) {
      const localWidth = width / zoom;
      const localHeight = height / zoom;
      const top = width <= 600 ? 130 : 142;
      const availableWidth = localWidth - 64;
      const availableHeight = localHeight - top - 24;
      // Use deliberately oversized natural bounds, including the control deck/feet.
      for (const [contentWidth, contentHeight] of [[1880, 1050], [1120, 865], [360, 720]]) {
        const fit = getGameViewportFit(contentWidth, contentHeight, availableWidth, availableHeight);
        assert.ok(fit > 0 && fit <= 1);
        assert.ok(contentWidth * fit * zoom <= availableWidth * zoom);
        assert.ok(contentHeight * fit * zoom + (top + 24) * zoom <= height);
      }
    }
  }
  assert.equal(getGameViewportFit(500, 300, 600, 400), 1);
  assert.equal(getGameViewportFit(0, 300, 600, 400), 1);
  assert.equal(getGameViewportFit(500, 300, 0, 0), 1);
});

test("Viewport adaptation measures local unscaled bounds, observes growth and stops after cleanup", () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldObserver = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
  const frames = new Map<number, () => void>();
  let nextFrame = 0;
  const observed: unknown[] = [];
  let observeCallback = () => {};
  let disconnected = false;
  const win: any = new EventTarget();
  win.visualViewport = new EventTarget();
  win.requestAnimationFrame = (callback: () => void) => { frames.set(++nextFrame, callback); return nextFrame; };
  win.cancelAnimationFrame = (id: number) => frames.delete(id);
  const properties = new Map<string, string>();
  const content: any = {
    offsetWidth: 1120, scrollWidth: 1120, offsetHeight: 865, scrollHeight: 865,
    style: { setProperty: (key: string, value: string) => properties.set(key, value), removeProperty: (key: string) => properties.delete(key) },
    getBoundingClientRect() { throw new Error("Never measure an already scaled DOMRect"); }
  };
  const scene = { hidden: false };
  const slot: any = {
    clientWidth: 1200, clientHeight: 634,
    closest: () => scene, querySelector: () => content,
  };
  const page: any = { querySelectorAll: () => [slot] };
  Object.defineProperty(globalThis, "window", { configurable: true, value: win });
  Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: class {
    constructor(callback: () => void) { observeCallback = callback; }
    observe(target: unknown) { observed.push(target); }
    disconnect() { disconnected = true; }
  } });
  try {
    const binding = bindGamesViewport(page);
    assert.deepEqual(observed, [slot, content]);
    binding.update();
    assert.equal(Number(properties.get("--game-fit-scale")), 630 / 865);
    content.scrollHeight = 1000;
    observeCallback();
    win.dispatchEvent(new Event("resize"));
    win.visualViewport.dispatchEvent(new Event("resize"));
    assert.equal(frames.size, 1);
    const flush = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); };
    flush();
    assert.equal(Number(properties.get("--game-fit-scale")), .63);
    scene.hidden = true;
    content.scrollHeight = 1200;
    binding.update();
    assert.equal(Number(properties.get("--game-fit-scale")), .63);
    scene.hidden = false;
    binding.update();
    assert.equal(Number(properties.get("--game-fit-scale")), .525);
    observeCallback();
    binding.cleanup();
    assert.equal(disconnected, true);
    assert.equal(frames.size, 0);
    assert.equal(properties.size, 0);
    win.dispatchEvent(new Event("resize"));
    observeCallback();
    binding.update();
    assert.equal(frames.size, 0);
    assert.equal(properties.size, 0);
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (oldObserver) Object.defineProperty(globalThis, "ResizeObserver", oldObserver);
    else Reflect.deleteProperty(globalThis, "ResizeObserver");
  }
});

test("The enhanced scenes own a finite viewport and complete content is fitted rather than cut off", () => {
  const css = postcss.parse(read("src/themes/kisara/styles/games.css"));
  const rules = new Map<string, Map<string, string>>();
  css.walkRules(rule => {
    if (rule.parent?.type !== "root") return;
    const declarations = new Map<string, string>();
    rule.walkDecls(decl => { declarations.set(decl.prop, decl.value); });
    rules.set(rule.selector, declarations);
  });
  assert.equal(rules.get(".kisara-games[data-scene-ready]")?.get("height"), "calc(100svh / var(--kisara-scale, 1))");
  const scene = rules.get(".kisara-games[data-scene-ready] > [data-game-scene]");
  assert.equal(scene?.get("min-height"), "0");
  assert.equal(scene?.get("height"), "100%");
  assert.equal(scene?.get("padding"), "0");
  const viewport = rules.get(".kisara-games[data-scene-ready] .kisara-game-viewport");
  assert.equal(viewport?.get("position"), "absolute");
  assert.equal(viewport?.get("width"), "auto", "inset must not be combined with width:100%, which offsets the scene");
  assert.match(viewport?.get("inset") ?? "", /--game-content-top.*--game-content-bottom/);
  assert.match(rules.get(".kisara-games[data-scene-ready] [data-game-fit]")?.get("transform") ?? "", /scale\(var\(--game-fit-scale, 1\)\)/);
  assert.equal(rules.get(".kisara-arcade-machine")?.get("min-width"), "0");
  const page = read("src/themes/kisara/pages/GamesPage.astro");
  const clue = read("src/themes/kisara/components/KisaraGameClueScene.astro");
  assert.match(page, /data-game-machine data-game-fit/);
  assert.doesNotMatch(clue, /data-game-fit/);
  assert.match(clue, /class="kisara-game-camera-slot"/);
  const investigation = read("src/themes/kisara/styles/game-investigation.css");
  assert.match(investigation, /container-type: size/);
  assert.match(investigation, /width: min\(100%, 163cqh\)/);
  assert.match(investigation, /height: min\(100%, calc\(100cqw \/ 1\.63\)\)/);
  assert.match(investigation, /grid-template-rows: minmax\(0, 1fr\);/);
  const runtime = read("src/themes/kisara/lib/gamesPage.js");
  assert.match(runtime, /viewport\.update\(\)/);
  assert.match(runtime, /viewport\.cleanup\(\)/);
});

test("Investigation groups its title and command with the brief, without an empty camera column", () => {
  const clue = read("src/themes/kisara/components/KisaraGameClueScene.astro");
  const brief = clue.slice(clue.indexOf('<aside class="kisara-event-brief"'), clue.indexOf("</aside>"));
  assert.match(brief, /id="kisara-game-investigation-title"/);
  assert.match(brief, /data-event-command/);
  assert.equal((clue.match(/<strong data-event-command>/g) ?? []).length, 1);
  const css = postcss.parse(read("src/themes/kisara/styles/game-investigation.css"));
  const rules = new Map<string, Map<string, string>>();
  css.walkRules(rule => {
    if (rule.parent?.type !== "root") return;
    const declarations = new Map<string, string>();
    rule.walkDecls(decl => { declarations.set(decl.prop, decl.value); });
    rules.set(rule.selector, declarations);
  });
  const prefix = ".kisara-games[data-scene-ready]";
  assert.equal(rules.get(`${prefix} .kisara-game-investigation > .kisara-game-viewport`)?.get("container-type"), "size");
  assert.equal(rules.get(`${prefix} .kisara-game-investigation-shell`)?.get("width"), "min(100%, calc(163cqh + var(--game-brief-width) + 28px))");
  assert.equal(rules.get(`${prefix} .kisara-event-board`)?.get("grid-template-columns"), "minmax(0, 1fr) var(--game-brief-width)");
  assert.equal(rules.get(`${prefix} .kisara-event-photo-panel`)?.get("margin"), "auto 0 auto auto");
  // Model the constrained two-column composition, not a browser layout assertion.
  for (const [width, height] of [[2388, 1276], [1920, 1080], [1366, 768], [1024, 600]]) {
    for (const zoom of [.9, 1]) {
      const available = width / zoom - 64;
      const cameraHeight = height / zoom - 166;
      const briefWidth = width >= 1600 ? 360 : 320;
      const composition = Math.min(available, cameraHeight * 1.63 + briefWidth + 28);
      const cameraWidth = composition - briefWidth - 28;
      assert.ok(cameraWidth / 1.63 <= cameraHeight + .001);
      assert.ok(Math.abs(composition - cameraWidth - briefWidth - 28) < .001);
      const previousPhotoWidth = Math.min((available - 28) * .76, (cameraHeight - 124) * 1.63);
      assert.ok(cameraWidth > previousPhotoWidth, "reclaim title/footer height for the actual photograph");
    }
  }
});

test("Games navigation is transparent and the joystick ball belongs to its shaft", () => {
  const css = postcss.parse(read("src/themes/kisara/styles/games.css"));
  const rules = new Map<string, Map<string, string>>();
  css.walkRules(rule => {
    if (rule.parent?.type !== "root") return;
    const declarations = new Map<string, string>();
    rule.walkDecls(decl => { declarations.set(decl.prop, decl.value); });
    rules.set(rule.selector, declarations);
  });
  const header = rules.get('body[data-kisara-page="games"] .kisara-header.is-inner-header');
  for (const [property, expected] of [["background", "transparent"], ["border-bottom-color", "transparent"], ["box-shadow", "none"], ["backdrop-filter", "none"]]) {
    assert.equal(header?.get(property), expected);
  }
  assert.ok(rules.has('body[data-kisara-page="games"]:has(.kisara-games[data-active-scene="1"])'));
  const page = read("src/themes/kisara/pages/GamesPage.astro");
  assert.match(page, /class="kisara-arcade-joystick"[^>]*><span><\/span><i><b><\/b><\/i><\/div>/);
  assert.equal(rules.get(".kisara-arcade-joystick i")?.get("transform-origin"), "50% 100%");
  assert.equal(rules.get(".kisara-arcade-joystick i > b")?.get("left"), "50%");
  assert.equal(rules.get(".kisara-arcade-joystick::after")?.get("z-index"), "3");
});
