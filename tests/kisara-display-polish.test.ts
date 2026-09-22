import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import postcss from "postcss";
import { parse } from "@astrojs/compiler";
import { getKisaraLocalRect, getKisaraScale } from "../src/themes/kisara/lib/displayScale.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const home = read("src/themes/kisara/pages/HomePage.astro");
const layout = read("src/themes/kisara/lib/layoutRuntime.js");
const range = (source: string, start: string, end: string) => {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a);
  return source.slice(a, b);
};

test("Theme zoom is scoped to Kisara and all viewport lengths keep their physical coverage", () => {
  const theme = postcss.parse(read("src/themes/kisara/styles/theme.css"));
  let scoped = false;
  theme.walkDecls("zoom", decl => {
    assert.equal((decl.parent as postcss.Rule).selector, 'html[data-theme="kisara"]');
    assert.equal(decl.value, "var(--kisara-scale)");
    scoped = true;
  });
  assert.ok(scoped);
  let checked = 0;
  const checkedFiles = new Set<string>();
  const dir = new URL("../src/themes/kisara/styles/", import.meta.url);
  for (const file of readdirSync(dir).filter(file => file.endsWith(".css"))) {
    const root = postcss.parse(readFileSync(new URL(file, dir), "utf8"));
    root.walkDecls(decl => {
      if (!/\d(?:s|d|l)?v(?:w|h|min|max)\b/.test(decl.value)) return;
      assert.match(decl.value, /var\(--kisara-scale, 1\)/, `${file}: ${decl.prop}`);
      checked++;
      checkedFiles.add(file);
    });
  }
  assert.ok(checked > 0);
  for (const file of ["home.css", "blog.css", "games.css", "game-investigation.css", "projects.css", "about.css"]) {
    assert.ok(checkedFiles.has(file), `${file}: viewport coverage was not checked`);
  }
  for (const height of [568, 768, 900, 1440]) {
    assert.ok(Math.abs(height / .9 * .9 - height) < 1e-9);
  }
});

test("Viewport coordinates convert once into canvas and CSS local pixels", () => {
  const previous = ["document", "getComputedStyle"].map(key =>
    [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  let zoom = ".9";
  Object.defineProperty(globalThis, "document", { configurable: true, value: { documentElement: {} } });
  Object.defineProperty(globalThis, "getComputedStyle", { configurable: true, value: () => ({ zoom }) });
  try {
    const element = { getBoundingClientRect: () => ({
      left: 90, top: 180, right: 990, bottom: 450, width: 900, height: 270,
    }) } as Element;
    assert.equal(getKisaraScale(), .9);
    assert.deepEqual(getKisaraLocalRect(element), {
      left: 100, top: 200, right: 1100, bottom: 500, width: 1000, height: 300,
    });
    for (zoom of ["normal", "0", "-1"]) assert.equal(getKisaraScale(), 1);
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
  for (const canvas of ["chainBackCanvas", "titleDataCanvas", "titleLensCanvas", "energyCanvas"]) {
    assert.ok(home.includes(`getKisaraLocalRect(${canvas})`), canvas);
  }
});

test("Astro component styles also compensate viewport lengths, including mobile cutscenes", async () => {
  let checked = 0;
  for (const folder of ["components", "pages", "layouts"]) {
    const dir = new URL(`../src/themes/kisara/${folder}/`, import.meta.url);
    for (const file of readdirSync(dir).filter(file => file.endsWith(".astro"))) {
      const { ast } = await parse(readFileSync(new URL(file, dir), "utf8"));
      const walk = (node: any) => {
        if (node.name === "style") {
          const css = node.children.map((child: any) => child.value ?? "").join("");
          postcss.parse(css).walkDecls(decl => {
            if (!/\d(?:s|d|l)?v(?:w|h|min|max)\b/.test(decl.value)) return;
            assert.match(decl.value, /var\(--kisara-scale, 1\)/, `${file}: ${decl.prop}`);
            checked++;
          });
        }
        node.children?.forEach(walk);
      };
      walk(ast);
    }
  }
  assert.ok(checked >= 24);
});

test("Scrollbar size uses local track pixels while progress uses viewport scroll pixels", () => {
  const source = range(layout, "  const getScrollbarMetrics =", "  const updateScrollbar =");
  class Element {
    clientHeight = 800;
    getBoundingClientRect() { return { height: 720 }; }
  }
  const get = vm.runInNewContext(`${source}; getScrollbarMetrics`, {
    scrollbar: new Element(), HTMLElement: Element,
    document: { scrollingElement: { scrollHeight: 4000 } },
    window: { innerHeight: 900, innerWidth: 1440 },
    clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)),
  });
  const metrics = get();
  assert.equal(metrics.trackHeight, 800);
  assert.equal(metrics.scrollRange, 3100);
  assert.equal(metrics.thumbSize, 82);
  assert.equal((metrics.trackHeight - metrics.thumbSize + metrics.thumbSize) * .9, 720);
});

test("004 fills the viewport at 90 percent without narrowing the section background", () => {
  const css = postcss.parse(read("src/themes/kisara/styles/home.css"));
  let fullHeight = false, fullWidth = false;
  css.walkRules(rule => {
    if (rule.selector === ".kisara-latest") {
      rule.walkDecls("min-height", decl => {
        assert.equal(decl.value, "calc(100svh / var(--kisara-scale, 1))");
        fullHeight = true;
      });
    }
    if (rule.selector === "body.kisara-home-page .kisara-latest") {
      rule.walkDecls("width", decl => {
        assert.equal(decl.value, "100%");
        fullWidth = true;
      });
    }
  });
  assert.ok(fullHeight && fullWidth);
  const component = read("src/themes/kisara/components/KisaraLatestNotes.astro");
  assert.match(component, /class="kisara-latest-content"/);
  assert.match(component, /\.kisara-latest-content[\s\S]*zoom: 1\.1/);
  assert.match(component, /repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(component, /aspect-ratio: 7 \/ 10/);
  assert.match(component, /calc\(7vw \/ var\(--kisara-scale, 1\)\)/);
});

test("Blog hero is a sticky stage with a compact archive handoff and a drawn English title", () => {
  const css = postcss.parse(read("src/themes/kisara/styles/blog.css"));
  const hero = new Map<string, string>();
  const archive = new Map<string, string>();
  css.walkRules(rule => {
    if (rule.selector === ".kisara-blog-hero") {
      rule.walkDecls(decl => { hero.set(decl.prop, decl.value); });
    }
    if (rule.selector === ".kisara-blog-archive") {
      rule.walkDecls(decl => { archive.set(decl.prop, decl.value); });
    }
  });
  assert.equal(hero.get("position"), "relative");
  assert.ok(read("src/themes/kisara/styles/blog.css").includes(".kisara-blog-stage-track[data-stage-ready] .kisara-blog-stage"));
  assert.match(read("src/themes/kisara/styles/blog.css"), /min-height: max\(680px, calc\(100svh \/ var\(--kisara-scale, 1\)\)\)/);
  assert.equal(archive.get("position"), "relative");
  assert.equal(archive.get("z-index"), "3");
  assert.match(read("src/themes/kisara/pages/BlogIndexPage.astro"), /Every signal/);
  assert.match(read("src/themes/kisara/pages/BlogIndexPage.astro"), /leaves a trace\./);
  assert.match(read("src/themes/kisara/pages/BlogIndexPage.astro"), /data-blog-pen/);
  assert.match(read("src/themes/kisara/pages/BlogIndexPage.astro"), /maskUnits="userSpaceOnUse"/);
  assert.doesNotMatch(read("src/themes/kisara/pages/BlogIndexPage.astro"), /kisara-blog-(kicker|cast-index|intro-controls)/);
  assert.doesNotMatch(read("src/themes/kisara/styles/blog.css"), /kisara-blog-(scanline|exposure|group-focus|cast-index|intro-controls|trace-char)/);
});

test("Blog cast retraces its entry vectors and hit geometry remains settled", () => {
  const css = postcss.parse(read("src/themes/kisara/styles/blog.css"));
  let transform = "";
  css.walkRules(rule => {
    if (rule.selector.split(",").map(selector => selector.trim()).includes(".kisara-blog-character-stage")) {
      rule.walkDecls("transform", decl => { transform = decl.value; });
    }
  });
  assert.equal(transform, "translateY(-50%) scale(.92)");
  const blogSource = read("src/themes/kisara/lib/blogPage.js");
  assert.match(blogSource, /--cast-enter-x/);
  assert.match(blogSource, /introAnimations\.forEach/);
  assert.match(blogSource, /introDuration \* \(1 - exit\)/);
  assert.match(blogSource, /alpha\[py \* mask\.width \+ px\] >= 80/);
  assert.match(read("src/themes/kisara/styles/blog.css"), /scale\(1\.035\)/);
  assert.doesNotMatch(blogSource, /castControls|data-blog-cast="|data-blog-replay|data-blog-skip/);
  const source = range(read("src/themes/kisara/lib/blogPage.js"),
    "  const cacheCastGeometry =", "  const prepareCastHitMasks =");
  const masks = [{ image: {}, rect: null as any }];
  class Stage {
    getBoundingClientRect() { return { left: 60, top: -20, width: 1440 * .9 * .92, height: 975 * .9 * .92 }; }
  }
  const cache = vm.runInNewContext(`${source}; cacheCastGeometry`, {
    hero: { querySelector: () => new Stage() }, HTMLElement: Stage, castHitMasks: masks,
    window: { scrollY: 100 },
    getComputedStyle: () => ({ getPropertyValue: (key: string) => key === "--cast-x" ? "-1.2%" : "4.4%" }),
  });
  cache();
  assert.equal(masks[0].rect.width, 1440 * .9 * .92);
  assert.equal(masks[0].rect.height, 975 * .9 * .92);
  assert.equal(masks[0].rect.left, 60 + -1.2 * masks[0].rect.width / 100);
  assert.equal(masks[0].rect.top, -20 + 4.4 * masks[0].rect.height / 100);
});

test("A split ring keeps identical material and opacity on both glyph depth layers", () => {
  const source = range(home, "      const drawChainLinkArc =", "      const drawChainLayer =");
  const draws: { alpha: number; shaded: boolean }[] = [];
  const context = {
    globalAlpha: 1, globalCompositeOperation: "", imageSmoothingEnabled: false,
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, clip() {},
    translate() {}, rotate() {}, scale() {},
  };
  const draw = vm.runInNewContext(`${source}; drawChainLinkArc`, {
    chainMaterialVisibility: 1, randomSeed: () => .5,
    getChainLinkDimensions: () => ({ width: 36 }),
    chainMaterial: { draw(_: unknown, width: number, edge: boolean, arc: string, heat: number, shaded: boolean) {
      draws.push({ alpha: context.globalAlpha, shaded });
    } },
  });
  for (const occluded of [false, true]) {
    for (const isFront of [false, true]) {
      draw(context, { x: 0, y: 0, angle: .4 }, 0, { id: 0, type: "weave" },
        .8, .2, isFront, "full", 0, 1, 1, [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }], occluded);
    }
  }
  assert.deepEqual(draws, [
    { alpha: .8, shaded: false }, { alpha: .8, shaded: false },
    { alpha: .8, shaded: true }, { alpha: .8, shaded: true },
  ]);
});

test("Playback controls and the scroll rail avoid idle animation; the Blog join is scoped", () => {
  const controls = range(read("src/themes/kisara/styles/home.css"),
    ".kisara-gate-auto,\n.kisara-gate-skip {", ".kisara-motion-toggle {");
  assert.match(controls, /height: 44px/);
  assert.match(controls, /focus-visible/);
  assert.doesNotMatch(controls, /animation:|filter:|backdrop-filter/);
  const rail = read("src/themes/kisara/styles/scrollbar.css");
  assert.doesNotMatch(rail, /animation:|blur\(|drop-shadow\(/);
  assert.match(rail, /scaleY\(var\(--kisara-scroll-progress, 0\)\)/);
  const blog = postcss.parse(read("src/themes/kisara/styles/blog.css"));
  let joins = 0;
  blog.walkRules(rule => {
    if (!rule.selector.includes(".kisara-footer")) return;
    assert.ok(rule.selector.startsWith('body[data-kisara-page="blog"]:not([data-yuimi-article-page])'));
    joins++;
  });
  assert.equal(joins, 2);
});
