import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import sharp from "sharp";
import postcss from "postcss";
import { transform } from "esbuild";
import { blogLettering } from "../src/themes/kisara/data/blogLettering.ts";
import { parseCssTimeMs } from "../src/themes/kisara/lib/blogPage.js";

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const source = read("src/themes/kisara/lib/blogPage.js");
const extract = (start: string, end: string) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));

test("The phrase has one filled glyph per letter, separate pen paths, and no competing text layer", () => {
  const page = read("src/themes/kisara/pages/BlogIndexPage.astro");
  assert.equal(blogLettering.map(letter => letter.character).join(""), "leavesatrace.");
  assert.equal((page.match(/class="kisara-blog-trace-glyph"/g) || []).length, 1);
  const svg = page.slice(page.indexOf('<svg class="kisara-blog-trace-script"'), page.indexOf("</svg>"));
  assert.equal(svg.includes("<text"), false);
  assert.ok(svg.includes("mask={`url(#blog-pen-"));
  assert.ok(svg.includes("data-blog-pen"));
  assert.equal(page.includes("kisara-blog-intro-controls"), false);
  assert.equal(page.includes("kisara-blog-cast-index"), false);
  const sprite = read("public/themes/kisara/assets/blog/trace-glyphs.svg");
  for (const letter of blogLettering) {
    assert.ok(sprite.includes(`d="${letter.outline}"`));
  }
});

test("Blog cast entry keeps production-compressed seconds as milliseconds", () => {
  assert.equal(parseCssTimeMs("780ms"), 780);
  assert.equal(parseCssTimeMs(".78s"), 780);
  assert.equal(parseCssTimeMs("0s"), 0);
  assert.equal(parseCssTimeMs("40"), 40);
  assert.match(source, /parseCssTimeMs\(css\.getPropertyValue\("--cast-delay"\)\)/);
  assert.match(source, /parseCssTimeMs\(css\.getPropertyValue\("--cast-duration"\)\)/);
});

test("Minified production CSS creates four staggered cast animations on the full intro timeline", async () => {
  const compressed = await transform(read("src/themes/kisara/styles/blog.css"), { loader: "css", minify: true });
  const css = postcss.parse(compressed.code);
  const slots = ["sharon", "ayano", "shu", "kisara"].map(id => {
    const properties = new Map<string, string>();
    css.walkRules(rule => {
      if (rule.selector === ".kisara-blog-cast-slot" || rule.selector === `.kisara-blog-cast-slot.is-${id}`) {
        rule.walkDecls(decl => { properties.set(decl.prop, decl.value); });
      }
    });
    return {
      properties,
      animate(frames: unknown, timing: { duration: number; delay: number }) {
        return { frames, timing, currentTime: 0, pause() {} };
      }
    };
  });
  const introAnimations: any[] = [];
  const prepare = vm.runInNewContext(
    `${extract("  const addMotion =", "  const playIntro =")}; prepareMotion`,
    {
      reducedMotion: false, introAnimations, archiveAnimations: [], archive: null,
      hero: { querySelectorAll: (selector: string) => selector === ".kisara-blog-cast-slot" ? slots : [], querySelector: () => null },
      getComputedStyle: (slot: typeof slots[number]) => ({ getPropertyValue: (key: string) => slot.properties.get(key) ?? "" }),
      parseCssTimeMs
    }
  );
  prepare();
  assert.equal(introAnimations.length, 4);
  assert.deepEqual(introAnimations.map(({ timing }) => timing.duration), [780, 880, 940, 980]);
  assert.deepEqual(introAnimations.map(({ timing }) => timing.delay), [40, 180, 420, 690]);
  for (const animation of introAnimations) {
    assert.equal(animation.currentTime, 0);
    assert.ok(animation.timing.duration + animation.timing.delay <= 1700);
    assert.notEqual(animation.frames[0].transform, animation.frames[1].transform);
    assert.equal(animation.frames[0].opacity, 0);
    assert.equal(animation.frames[1].opacity, 1);
  }
});

test("Completed pen masks reveal the whole actual glyph without extra outline pixels", async () => {
  for (const letter of blogLettering) {
    const root = '<svg xmlns="http://www.w3.org/2000/svg" width="170" height="210" viewBox="-200 -300 1700 2100">';
    const glyph = `<path d="${letter.outline}" fill="white"/>`;
    const mask = `<defs><mask id="pen" maskUnits="userSpaceOnUse" x="-200" y="-300" width="1700" height="2100">${letter.strokes.map(({ d }) => `<path d="${d}" fill="none" stroke="white" stroke-width="310" stroke-linecap="round" stroke-linejoin="round"/>`).join("")}</mask></defs>`;
    const image = async (body: string) => sharp(Buffer.from(root + body + "</svg>")).ensureAlpha().raw().toBuffer();
    const full = await image(glyph);
    const drawn = await image(mask + `<g mask="url(#pen)">${glyph}</g>`);
    let fullAlpha = 0, loss = 0;
    for (let i = 3; i < full.length; i += 4) {
      fullAlpha += full[i];
      loss += Math.max(0, full[i] - drawn[i]);
      assert.ok(drawn[i] <= full[i], `${letter.character}: mask must not draw outside glyph`);
    }
    assert.ok(loss / fullAlpha < .005, `${letter.character}: missing ${(100 * loss / fullAlpha).toFixed(2)}%`);
  }
});

test("Native scroll rewinds the same intro clock and reveals separate archive parts in the stationary stage", () => {
  class Element {
    style = { transform: "", visibility: "" };
    inert = false;
  }
  const hero = new Element();
  const archive = new Element();
  const introAnimations = [{ currentTime: 0 }, { currentTime: 0 }];
  const archiveAnimations = [{ currentTime: 0 }];
  const state: any = {
    HTMLElement: Element, hero, archive, introAnimations, archiveAnimations,
    track: { hasAttribute: () => true }, scrim: { style: {} },
    introElapsed: 1700, introDuration: 1700, stageTop: 0, stageScale: .9,
    entryDistance: 500, archiveOverflow: 2000, scrollProgress: 0, scrollFrame: 0,
    reducedMotion: false, focusArchive: false, hoveredCastFocus: "all", lockedCastFocus: "all",
    castPointerActive: false, setCastFocus() {}, window: { scrollY: 0 },
    clamp: (n: number, a: number, b: number) => Math.max(a, Math.min(b, n)),
  };
  const sync = vm.runInNewContext(`${extract("  const syncScroll =", "  const scheduleScrollSync =")}; syncScroll`, state);
  sync();
  assert.equal(introAnimations[0].currentTime, 1700);
  assert.equal(archive.inert, true);
  const samples: number[] = [];
  for (const y of [80, 140, 200, 300, 330]) {
    state.window.scrollY = y;
    sync();
    samples.push(introAnimations[0].currentTime);
    assert.equal(archive.style.transform, "translateY(0px)");
  }
  assert.equal(samples.at(-1), 0);
  for (const y of [300, 200, 140, 80]) {
    state.window.scrollY = y;
    sync();
    assert.equal(introAnimations[0].currentTime, samples[[80, 140, 200, 300].indexOf(y)]);
  }
  state.window.scrollY = 950;
  sync();
  assert.equal(archive.style.transform, "translateY(-500px)");
  assert.equal(archive.inert, false);
  assert.equal(hero.inert, true);
  state.introElapsed = 600;
  state.window.scrollY = 10;
  sync();
  assert.equal(introAnimations[0].currentTime, 600, "scroll cannot advance an unfinished intro");
});

test("Hover settles without another pointermove and alternation at a seam never commits", () => {
  class Element { dataset = { introState: "complete", castHover: "all" }; }
  let now = 0, target = "kisara", scheduled = 0;
  const focused: string[] = [];
  const state: any = {
    HTMLElement: Element, Element, hero: new Element(), castHitFrame: 0,
    castPointerActive: true, scrollProgress: 0, castPointerTarget: null,
    castPointerX: 40, castPointerY: 60, castHoverCandidate: "all",
    castHoverCandidateSince: 0, hoveredCastFocus: "all", lockedCastFocus: "all",
    performance: { now: () => now }, findCharacterAtPoint: () => target,
    scheduleCastHit: () => scheduled++, setCastFocus: (id: string) => focused.push(id),
  };
  const resolve = vm.runInNewContext(`${extract("  const resolveCastHit =", "  const scheduleCastHit =")}; resolveCastHit`, state);
  resolve();
  assert.equal(scheduled, 1);
  now = 35;
  resolve();
  assert.deepEqual(focused, ["kisara"]);
  for (let i = 0; i < 20; i++) {
    now += 16;
    target = i % 2 ? "kisara" : "shu";
    resolve();
  }
  assert.deepEqual(focused, ["kisara"]);
  target = "shu";
  now += 16;
  resolve();
  now += 72;
  resolve();
  assert.deepEqual(focused, ["kisara", "shu"]);
  state.scrollProgress = .3;
  target = "ayano";
  now += 100;
  resolve();
  assert.deepEqual(focused, ["kisara", "shu"]);
});
