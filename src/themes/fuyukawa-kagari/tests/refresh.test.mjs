import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import postcss from "postcss";
import { parse } from "@astrojs/compiler";

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const css = read("styles/refresh.css") + "\n" + read("styles/refresh-pages.css");
const inlineScript = (file) => read(file).match(/<script is:inline data-astro-rerun>([\s\S]*?)<\/script>/)?.[1];

test("refresh selectors cannot style another theme", () => {
  const root = postcss.parse(css);
  root.walkRules((rule) => {
    if (rule.parent.type === "atrule" && rule.parent.name.endsWith("keyframes")) return;
    for (const selector of postcss.list.comma(rule.selector)) {
      assert.ok(selector.startsWith("body[data-fuyukawa]") || selector.startsWith("html:has(body[data-fuyukawa])"), selector);
    }
  });
  assert.match(read("layouts/BaseLayout.astro"), /data-fuyukawa/);
  assert.match(read("layouts/BaseLayout.astro"), /import "@\/themes\/fuyukawa-kagari\/styles\/refresh.css"/);
});

test("refresh uses bounded typography, reduced motion, and compact-screen layouts", () => {
  const root = postcss.parse(css);
  root.walkDecls("font-size", (declaration) => assert.doesNotMatch(declaration.value, /vw|cqw/));
  root.walkDecls("letter-spacing", (declaration) => assert.equal(declaration.value, "0"));
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /max-width: 480px/);
  assert.match(css, /max-width: 760px/);
  assert.match(css, /\.post-cover-frame[^}]*aspect-ratio: 7 \/ 10/);
});

test("home and archive preserve complete covers in stable portrait frames", () => {
  const rules = new Map();
  postcss.parse(css).walkRules((rule) => {
    if (rule.parent.type !== "root") return;
    rules.set(rule.selector, Object.fromEntries(rule.nodes.filter((node) => node.type === "decl").map((node) => [node.prop, node.value])));
  });
  const home = rules.get("body[data-fuyukawa] .journal-entry > img");
  const frame = rules.get("body[data-fuyukawa] .post-cover-frame");
  const image = rules.get("body[data-fuyukawa] .post-cover-frame img");
  assert.equal(home["aspect-ratio"], "7 / 10");
  assert.equal(frame["aspect-ratio"], "7 / 10");
  for (const cover of [home, image]) {
    assert.equal(cover["object-fit"], "contain");
    assert.equal(cover["object-position"], "center");
  }
  assert.equal(image.position, "absolute");
  assert.equal(image.height, "100%");
  assert.doesNotMatch(read("pages/BlogIndexPage.astro"), /coverFocus|style={`object-position:/);
  assert.match(read("pages/HomePage.astro"), /width="700" height="1000" loading="lazy"/);
});

test("header stays transparent with symmetric centered navigation", () => {
  const rules = new Map();
  postcss.parse(css).walkRules((rule) => {
    if (rule.parent.type !== "root") return;
    rules.set(rule.selector, Object.fromEntries(rule.nodes.filter((node) => node.type === "decl").map((node) => [node.prop, node.value])));
  });
  const header = rules.get("body[data-fuyukawa] .site-header");
  const nav = rules.get("body[data-fuyukawa] .nav-links");
  assert.equal(header.background, "transparent");
  assert.equal(header["backdrop-filter"], "none");
  assert.equal(header["grid-template-columns"], "minmax(0, 1fr) auto minmax(0, 1fr)");
  assert.equal(nav["grid-column"], "2");
  assert.equal(nav["justify-self"], "center");
  assert.match(css, /max-width: 760px[^]*?\.nav-links \{ grid-column: 1;[^}]*justify-content: center/);
});

test("article index sticks to the viewport while the page can still lock for notices", () => {
  const rules = new Map();
  postcss.parse(css).walkRules((rule) => {
    if (rule.parent.type !== "root") return;
    rules.set(rule.selector, Object.fromEntries(rule.nodes.filter((node) => node.type === "decl").map((node) => [node.prop, node.value])));
  });
  assert.equal(rules.get('body[data-fuyukawa][data-yuimi-article-page="true"]:not(.is-notice-open)')["overflow-x"], "clip");
  assert.equal(rules.get("body[data-fuyukawa] .article-toc").top, "106px");
  assert.match(read("layouts/ArticleLayout.astro"), /<aside class="article-toc"/);
  assert.match(read("layouts/BaseLayout.astro"), /data-yuimi-article-page=\{isArticlePage \? "true"/);
});

test("only the split foreground fades at its lower edge, and notice close has a visible glyph", () => {
  const hero = postcss.parse(read("styles/manga.css"));
  const foreground = [];
  hero.walkRules((rule) => {
    if (rule.selector === "body[data-fuyukawa] .manga-scene-camera .manga-scene-front") {
      foreground.push(Object.fromEntries(rule.nodes.filter((node) => node.type === "decl").map((node) => [node.prop, node.value])));
    }
  });
  const fade = foreground.find((rule) => rule["mask-image"]);
  assert.equal(fade?.["mask-image"], "linear-gradient(to bottom, #000 76%, #000c 84%, transparent 100%)");
  assert.equal(fade["-webkit-mask-image"], fade["mask-image"]);
  assert.doesNotMatch(read("styles/manga.css"), /\.manga-scene-back[^{}]*\{[^}]*mask-image/);

  const rules = new Map();
  postcss.parse(css).walkRules((rule) => {
    if (rule.parent.type !== "root") return;
    rules.set(rule.selector, Object.fromEntries(rule.nodes.filter((node) => node.type === "decl").map((node) => [node.prop, node.value])));
  });
  const close = rules.get("body[data-fuyukawa] .home-notice-close");
  assert.equal(close["font-size"], "1.35rem");
  assert.equal(close["z-index"], "1");
  assert.match(read("pages/HomePage.astro"), /data-notice-close aria-label="关闭公告">×<\/button>/);
});

test("all theme templates parse without errors", async () => {
  for (const path of [
    "layouts/BaseLayout.astro", "layouts/ArticleLayout.astro",
    "pages/HomePage.astro", "pages/BlogIndexPage.astro", "pages/GamesPage.astro",
    "pages/ProjectsPage.astro", "pages/AboutPage.astro", "pages/NotFoundPage.astro",
    "components/GameCover.astro", "components/SakuraRain.astro"
  ]) {
    const result = await parse(read(path));
    assert.deepEqual(result.diagnostics.filter((diagnostic) => diagnostic.severity === 1), [], path);
  }
});

test("navigation, mobile article index and native project controls expose their state", () => {
  assert.match(read("layouts/BaseLayout.astro"), /aria-current=/);
  assert.match(read("layouts/BaseLayout.astro"), /href="#page-content"/);
  assert.match(read("layouts/ArticleLayout.astro"), /<details class="article-mobile-toc"/);
  assert.match(read("pages/ProjectsPage.astro"), /data-card-panel hidden/);
  assert.match(read("pages/ProjectsPage.astro"), /aria-controls=/);
});

test("closed tool drawer hides its whole panel at every width", () => {
  const root = postcss.parse(css);
  const drawer = [];
  root.walkRules((rule) => {
    if (rule.selector === "body[data-fuyukawa] .toy-dock" && rule.parent.type === "root") {
      rule.walkDecls((declaration) => drawer.push([declaration.prop, declaration.value]));
    }
  });
  assert.ok(drawer.some(([property, value]) => property === "transform" && value === "translateX(-100%)"));
  assert.ok(drawer.some(([property, value]) => property === "width" && value.includes("100vw - 52px")));
  assert.match(css, /\.toy-dock:not\(:hover\):not\(:focus-within\):not\(\.is-pinned\) \.toy-dock-panel \{ visibility: hidden/);
  assert.match(css, /\.toy-dock:focus-within/);
});

test("homepage journal and custom game artwork stay in the Fuyukawa boundary", () => {
  const home = read("pages/HomePage.astro");
  assert.match(home, /recentPosts = \(await getPublishedPosts\(\)\)\.slice\(0, 3\)/);
  assert.match(home, /class="journal-entry" href=\{getThemePath\("fuyukawa-kagari"/);
  assert.match(read("pages/GamesPage.astro"), /<GameCover game=\{game.id\}/);
  assert.doesNotMatch(css + read("components/GameCover.astro"), /themes\/kisara|https?:\/\//);
});

function node(dataset = {}) {
  const events = new Map();
  const classes = new Set();
  return {
    dataset, events, value: "", innerHTML: "", isConnected: true, hidden: true,
    attributes: {}, textContent: "",
    classList: {
      toggle(key, force) {
        const add = force ?? !classes.has(key);
        if (add) classes.add(key); else classes.delete(key);
        return add;
      },
      contains: (key) => classes.has(key)
    },
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(key, listener) { events.set(key, listener); },
    removeEventListener(key, listener) { if (events.get(key) === listener) events.delete(key); }
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

function searchFixture(pagefind) {
  const input = node();
  const output = node();
  const prefix = node({ themeRoutePrefix: "/themes/fuyukawa-kagari" });
  const documentEvents = new Map();
  const timers = new Map();
  let timerId = 0;
  const document = {
    querySelector: (selector) => ({
      "[data-blog-search]": input,
      "[data-blog-search-results]": output,
      "[data-theme-route-prefix]": prefix
    })[selector],
    querySelectorAll: () => [],
    addEventListener: (key, value) => documentEvents.set(key, value),
    removeEventListener: (key, value) => { if (documentEvents.get(key) === value) documentEvents.delete(key); }
  };
  const window = {
    location: { origin: "https://example.test" },
    setTimeout: (callback) => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: (id) => timers.delete(id)
  };
  const context = vm.createContext({
    document, window, URL,
    Function: function () { return () => Promise.resolve(pagefind); }
  });
  const run = () => vm.runInContext(inlineScript("pages/BlogIndexPage.astro"), context);
  const type = async (value) => {
    input.value = value;
    input.events.get("input")();
    const callbacks = [...timers.values()];
    timers.clear();
    for (const callback of callbacks) callback();
    await settle();
  };
  run();
  return { input, output, window, timers, type, run, documentEvents };
}

test("search ignores stale asynchronous results and clears pending results", async () => {
  const pending = new Map();
  const fixture = searchFixture({
    options: async () => {},
    search: (query) => new Promise((resolve) => pending.set(query, resolve))
  });
  const result = (title) => ({ results: [{ data: async () => ({
    url: "/blog/note/", meta: { title }, excerpt: "A note"
  }) }] });
  await fixture.type("old");
  await fixture.type("new");
  pending.get("new")(result("New result"));
  await settle();
  assert.match(fixture.output.innerHTML, /New result/);
  assert.match(fixture.output.innerHTML, /\/themes\/fuyukawa-kagari\/blog\/note\//);
  pending.get("old")(result("Old result"));
  await settle();
  assert.doesNotMatch(fixture.output.innerHTML, /Old result/);
  await fixture.type("pending");
  await fixture.type("");
  pending.get("pending")(result("Should not return"));
  await settle();
  assert.equal(fixture.output.innerHTML, "");
});

test("search teardown invalidates old work and script can reinitialize", async () => {
  let resolveSearch;
  const fixture = searchFixture({
    options: async () => {},
    search: () => new Promise((resolve) => { resolveSearch = resolve; })
  });
  await fixture.type("search");
  fixture.documentEvents.get("astro:before-swap")();
  assert.equal(fixture.input.events.has("input"), false);
  const previous = fixture.output.innerHTML;
  resolveSearch({ results: [] });
  await settle();
  assert.equal(fixture.output.innerHTML, previous);
  fixture.run();
  assert.equal(fixture.input.events.has("input"), true);
});

test("search failure renders a usable empty fallback", async () => {
  const fixture = searchFixture({
    options: async () => {},
    search: async () => { throw new Error("Index offline"); }
  });
  await fixture.type("missing");
  assert.match(fixture.output.innerHTML, /没有找到相关笔记/);
  assert.doesNotMatch(fixture.output.innerHTML, /正在翻页/);
});

test("project filters and status disclosure update their accessible state on reentry", () => {
  const filters = [node({ filter: "all" }), node({ filter: "unity" })];
  const cards = [node({ projectLine: "unity" }), node({ projectLine: "astrbot" })];
  const lines = [node({ lineCard: "unity" }), node({ lineCard: "astrbot" })];
  const panel = node();
  const toggle = node();
  toggle.closest = () => cards[0];
  cards[0].querySelector = () => panel;
  const context = vm.createContext({
    document: {
      querySelector: () => ({ querySelectorAll: () => filters }),
      querySelectorAll: (selector) => ({
        "[data-project-line]": cards, "[data-line-card]": lines, "[data-card-toggle]": [toggle]
      })[selector]
    }
  });
  const script = inlineScript("pages/ProjectsPage.astro");
  vm.runInContext(script, context);
  filters[1].events.get("click")();
  assert.equal(filters[1].attributes["aria-pressed"], "true");
  assert.equal(filters[0].attributes["aria-pressed"], "false");
  assert.equal(cards[0].classList.contains("is-dimmed"), false);
  assert.equal(cards[1].classList.contains("is-dimmed"), true);
  toggle.events.get("click")();
  assert.equal(toggle.attributes["aria-expanded"], "true");
  assert.equal(panel.hidden, false);
  toggle.events.get("click")();
  assert.equal(panel.hidden, true);
  assert.doesNotThrow(() => vm.runInContext(script, context));
  filters[0].events.get("click")();
  assert.equal(cards[1].classList.contains("is-dimmed"), false);
});
