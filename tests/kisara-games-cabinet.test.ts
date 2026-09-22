import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import postcss from "postcss";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const runtime = read("src/themes/kisara/lib/gamesPage.js");

function fixture({ reduced = false, hash = "" } = {}) {
  const timers = new Map<number, Function>();
  let timer = 0;
  const animations: any[] = [];
  class Element extends EventTarget {
    dataset: Record<string, string> = {};
    attributes = new Map<string, string>();
    queries = new Map<string, any>();
    hidden = false;
    inert = false;
    disabled = false;
    tabIndex = 0;
    textContent = "";
    title = "";
    href = "";
    focused = false;
    replacement: any = null;
    setAttribute(key: string, value: string) { this.attributes.set(key, value); }
    getAttribute(key: string) { return this.attributes.get(key) ?? null; }
    removeAttribute(key: string) { this.attributes.delete(key); }
    hasAttribute(key: string) { return this.attributes.has(key); }
    set src(value: string) { this.setAttribute("src", value); }
    get src() { return this.getAttribute("src") ?? ""; }
    querySelector(key: string) { const value = this.queries.get(key); return Array.isArray(value) ? value[0] : value ?? null; }
    querySelectorAll(key: string) { const value = this.queries.get(key); return value ? Array.isArray(value) ? value : [value] : []; }
    focus() { this.focused = true; }
    cloneNode() { return new Element(); }
    replaceWith(next: any) { this.replacement = next; }
    animate(keyframes: any, options: any) {
      let finish: any, reject: any;
      const finished = new Promise((resolve, fail) => { finish = resolve; reject = fail; });
      const animation = { keyframes, options, finished, finish, canceled: false, cancel() { this.canceled = true; reject(new Error("canceled")); } };
      animations.push(animation);
      return animation;
    }
  }
  const page = new Element(), arcade = new Element(), investigation = new Element();
  const sceneLinks = [0, 1].map(index => { const link = new Element(); link.dataset.gameSceneJump = String(index); return link; });
  const next = new Element();
  page.queries.set("[data-game-scene]", [investigation, arcade]);
  page.queries.set("[data-kisara-arcade]", arcade);
  page.queries.set("[data-game-scene-jump]", sceneLinks);
  page.queries.set("[data-game-scene-next]", [next]);
  investigation.queries.set("[data-game-scene-next]", next);
  const selectors = ["2048", "hextris", "clumsy-bird"].map(id => {
    const item = new Element();
    item.dataset = { gameSelect: id, gameSrc: `/${id}/`, gameName: id, gameExternalSrc: `https://example.com/${id}` };
    return item;
  });
  const panels = selectors.map(item => { const panel = new Element(); panel.dataset.gamePanel = item.dataset.gameSelect; return panel; });
  arcade.queries.set("[data-game-select]", selectors);
  arcade.queries.set("[data-game-panel]", panels);
  for (const name of ["frame", "menu", "session", "screen", "loader", "status", "restart", "machine-title", "load-message", "counter", "external", "previous", "next"]) {
    arcade.queries.set(`[data-game-${name}]`, new Element());
  }
  arcade.queries.set("[data-game-launch]", [new Element(), new Element()]);
  arcade.queries.set("[data-game-eject]", [new Element(), new Element()]);
  const backdrop = new Element();
  backdrop.dataset.arcadeBackdropSrc = "/room.webp";
  arcade.queries.set("[data-arcade-backdrop-src]", backdrop);
  const window: any = new EventTarget();
  window.matchMedia = () => ({ matches: reduced });
  window.setTimeout = (fn: Function) => { timers.set(++timer, fn); return timer; };
  window.clearTimeout = (id: number) => timers.delete(id);
  window.scrollTo = () => {};
  const document = new EventTarget();
  const location = { hash };
  const history = { state: {}, replaceState(_state: any, _title: string, nextHash: string) { location.hash = nextHash; } };
  const bind = vm.runInNewContext(`${runtime.replace(/^import .*;\r?\n/m, "").replace("export function", "function")}; bindGamesPage`, {
    window, document, location, history, HTMLElement: Element, AbortController, CustomEvent, Promise,
    bindGamesViewport: (page: any) => {
      assert.equal(page.querySelectorAll("[data-game-viewport]").length, 0);
      return { update() {}, cleanup() {} };
    },
  });
  bind(page);
  const click = (target: Element, detail = 1) => {
    const event = new Event("click", { cancelable: true });
    Object.assign(event, { detail });
    target.dispatchEvent(event);
  };
  const get = (name: string) => arcade.querySelector(`[data-game-${name}]`) as Element;
  return { page, arcade, investigation, next, sceneLinks, selectors, panels, get, click, animations, timers, window, backdrop, document };
}

test("Game menu lives inside the cabinet and removed effects are absent", () => {
  const page = read("src/themes/kisara/pages/GamesPage.astro");
  assert.ok(page.indexOf("data-game-screen") < page.indexOf('role="tablist"'));
  assert.doesNotMatch(page, /kisara-arcade-heading|kisara-arcade-queue|kisara-arcade-arrival|screen-glass|scene-bridge/);
  assert.match(page, /import\("\.\.\/lib\/gamesPage\.js"\)/);
  const css = read("src/themes/kisara/styles/games.css");
  postcss.parse(css);
  postcss.parse(read("src/themes/kisara/styles/game-investigation.css"));
  assert.doesNotMatch(css, /scroll-snap|scan-in|scanline|arrival|hex-spin/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(read("src/themes/kisara/styles/game-investigation.css"), /aspect-ratio: 1\.63/);
});

test("Scene switching is reversible and interrupted animations cannot expose both scenes", async () => {
  const f = fixture();
  assert.equal(f.investigation.hidden, false);
  assert.equal(f.arcade.hidden, true);
  assert.equal(f.backdrop.hasAttribute("src"), false);
  f.click(f.next);
  assert.equal(f.arcade.inert, false);
  assert.equal(f.investigation.inert, true);
  assert.equal(f.backdrop.src, "/room.webp");
  f.click(f.sceneLinks[0]);
  assert.equal(f.animations[0].canceled, true);
  f.animations.slice(-2).forEach(animation => animation.finish());
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.investigation.hidden, false);
  assert.equal(f.arcade.hidden, true);
  f.window.__yuimiKisaraInnerCleanup();
});

test("Games load only on launch; switching scene unloads and stale loads are ignored", () => {
  const f = fixture({ reduced: true });
  const old = f.get("frame");
  assert.equal(old.hasAttribute("src"), false);
  f.click(f.next);
  f.click(f.get("launch"));
  const loaded = old.replacement;
  assert.equal(loaded.src, "/2048/");
  assert.equal(f.get("menu").hidden, true);
  assert.equal(f.get("eject").hidden, false);
  loaded.dispatchEvent(new Event("load"));
  assert.equal(f.get("screen").dataset.screenState, "loaded");
  assert.equal(f.timers.size, 0);
  f.click(f.sceneLinks[0]);
  assert.equal(loaded.hasAttribute("src"), false);
  loaded.dispatchEvent(new Event("load"));
  assert.equal(f.get("screen").dataset.screenState, "idle");
  f.window.__yuimiKisaraInnerCleanup();
});

test("Keyboard tabs wrap, loading can be canceled, timeout exposes retry, and cleanup restores flow", () => {
  const f = fixture({ reduced: true, hash: "#kisara-arcade-console" });
  const key = new Event("keydown", { cancelable: true });
  Object.assign(key, { key: "ArrowLeft" });
  f.selectors[0].dispatchEvent(key);
  assert.equal(f.selectors[2].getAttribute("aria-selected"), "true");
  assert.equal(f.selectors[2].focused, true);
  f.click(f.get("launch"));
  [...f.timers.values()][0]();
  assert.equal(f.get("restart").hidden, false);
  f.click(f.get("eject"));
  assert.equal(f.get("menu").hidden, false);
  assert.equal(f.get("screen").dataset.screenState, "idle");
  f.document.dispatchEvent(new Event("astro:before-swap"));
  assert.equal(f.page.dataset.sceneReady, undefined);
  assert.equal(f.arcade.hidden, false);
  assert.equal(f.investigation.inert, false);
});

test("Keyboard and reduced-motion scene changes do not animate", () => {
  const f = fixture();
  f.click(f.next, 0);
  assert.equal(f.animations.length, 0);
  f.window.__yuimiKisaraInnerCleanup();
  const g = fixture({ reduced: true });
  g.click(g.next);
  assert.equal(g.animations.length, 0);
  g.window.__yuimiKisaraInnerCleanup();
});

test("The existing home arcade-title deep link still opens the cabinet", () => {
  const f = fixture({ hash: "#kisara-arcade-title" });
  assert.equal(f.arcade.hidden, false);
  assert.equal(f.investigation.hidden, true);
  assert.equal(f.get("frame").hasAttribute("src"), false);
  f.window.__yuimiKisaraInnerCleanup();
});
