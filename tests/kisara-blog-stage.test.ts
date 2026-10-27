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

// Approximate only the M/L/Q/C centerlines in this fixed lettering fixture.
const penLength = (d: string) => {
  const tokens = d.match(/[MLQC]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  let index = 0, x = 0, y = 0, length = 0;
  const number = () => Number(tokens[index++]);
  while (index < tokens.length) {
    const command = tokens[index++];
    if (command === "M") { x = number(); y = number(); continue; }
    if (command === "L") {
      const nx = number(), ny = number();
      length += Math.hypot(nx - x, ny - y);
      x = nx; y = ny;
      continue;
    }
    assert.ok(command === "Q" || command === "C", `unsupported fixture command: ${command}`);
    const startX = x, startY = y, cx = number(), cy = number();
    const dx = command === "C" ? number() : 0, dy = command === "C" ? number() : 0;
    const nx = number(), ny = number();
    for (let step = 1; step <= 64; step++) {
      const t = step / 64, u = 1 - t;
      const px = command === "Q" ? u * u * startX + 2 * u * t * cx + t * t * nx
        : u ** 3 * startX + 3 * u * u * t * cx + 3 * u * t * t * dx + t ** 3 * nx;
      const py = command === "Q" ? u * u * startY + 2 * u * t * cy + t * t * ny
        : u ** 3 * startY + 3 * u * u * t * cy + 3 * u * t * t * dy + t ** 3 * ny;
      length += Math.hypot(px - x, py - y);
      x = px; y = py;
    }
  }
  return length;
};

const preparePenMotions = () => {
  const motions: any[] = [];
  const pens = blogLettering.flatMap(letter => letter.strokes.map(stroke => ({
    dataset: { penOrder: String(stroke.order) },
    getTotalLength: () => penLength(stroke.d),
    animate(frames: unknown, timing: unknown) {
      return { frames, timing, currentTime: 0, pause() {} };
    },
  })));
  const prepare = vm.runInNewContext(
    `${extract("  const addMotion =", "  const playIntro =")}; prepareMotion`,
    {
      reducedMotion: false, introAnimations: motions, archiveAnimations: [], archive: null,
      hero: { querySelectorAll: (selector: string) => selector === "[data-blog-pen]" ? pens : [], querySelector: () => null },
      parseCssTimeMs,
    },
  );
  prepare();
  return motions;
};

test("Blog's server-rendered idle frame cannot reveal the completed cast or lettering", () => {
  const page = read("src/themes/kisara/pages/BlogIndexPage.astro");
  assert.match(page, /data-intro-state="idle"/);
  assert.match(page, /<noscript><style>/);
  const css = postcss.parse(read("src/themes/kisara/styles/blog.css"));
  const selector = '.kisara-blog-hero[data-intro-state="idle"]';
  const hidden = new Set<string>();
  let reduced = false;
  css.walkRules(rule => {
    if (!rule.selector.includes(selector)) return;
    const isReduced = rule.parent?.type === "atrule" && rule.parent.params === "(prefers-reduced-motion: reduce)";
    rule.walkDecls("opacity", decl => {
      if (isReduced) {
        assert.equal(decl.value, "1");
        reduced = true;
      } else {
        assert.equal(decl.value, "0");
        for (const item of rule.selector.split(",")) hidden.add(item.trim());
      }
    });
  });
  for (const part of [".kisara-blog-cast-slot", ".kisara-blog-poster-logo", ".kisara-blog-trace-signal", ".kisara-blog-trace-script", ".kisara-blog-hero-meta", ".kisara-blog-description", ".kisara-blog-enter", ".kisara-blog-pickup"]) {
    assert.ok(hidden.has(`${selector} ${part}`), `${part} must not flash its final frame`);
  }
  assert.equal(reduced, true);
  assert.match(page, /root\.dataset\.introState = "complete"/);
});

test("The phrase paints real pen paths clipped to one silhouette per letter, without a cloned text layer", () => {
  const page = read("src/themes/kisara/pages/BlogIndexPage.astro");
  assert.equal(blogLettering.map(letter => letter.character).join(""), "leavesatrace.");
  assert.equal((page.match(/class="kisara-blog-trace-glyph"/g) || []).length, 1);
  const start = page.indexOf('<svg class="kisara-blog-trace-script"');
  const svg = page.slice(start, page.indexOf("</svg>", start));
  assert.equal(svg.includes("<text"), false);
  assert.ok(svg.includes("clip-path={`url(#blog-g-"));
  assert.ok(svg.includes("data-blog-pen"));
  assert.doesNotMatch(svg, /<use\b|id=\{`blog-pen-/);
  assert.ok(svg.indexOf("data-blog-pen") > svg.indexOf('id="blog-script-ink"'));
  assert.equal(page.includes("kisara-blog-intro-controls"), false);
  assert.equal(page.includes("kisara-blog-cast-index"), false);
  const sprite = read("public/themes/kisara/assets/blog/trace-glyphs.svg");
  for (const letter of blogLettering) {
    assert.ok(sprite.includes(`d="${letter.outline}"`));
  }
});

test("Handwritten glyph definitions ship with the page and never depend on an external SVG request", () => {
  const page = read("src/themes/kisara/pages/BlogIndexPage.astro");
  const start = page.indexOf('<svg class="kisara-blog-trace-script"');
  const svg = page.slice(start, page.indexOf("</svg>", start));
  assert.doesNotMatch(svg, /trace-glyphs\.svg|href=["'](?:\/|https?:)/);
  assert.match(svg, /clip-path=\{`url\(#blog-g-/);
  assert.doesNotMatch(svg, /<use\b|pathLength=/);
  assert.match(svg, /id=\{`blog-g-/);
  assert.match(svg, /d=\{outline\}/);
  assert.ok(svg.indexOf("d={outline}") < svg.indexOf('id="blog-script-ink"'));
  assert.match(svg, /id="blog-script-ink"[^>]*fill="white"/);
});

test("Blog cast entry keeps production-compressed seconds as milliseconds", () => {
  assert.equal(parseCssTimeMs("780ms"), 780);
  assert.equal(parseCssTimeMs(".78s"), 780);
  assert.equal(parseCssTimeMs("0s"), 0);
  assert.equal(parseCssTimeMs("40"), 40);
  assert.match(source, /parseCssTimeMs\(css\.getPropertyValue\("--cast-delay"\)\)/);
  assert.match(source, /parseCssTimeMs\(css\.getPropertyValue\("--cast-duration"\)\)/);
});

test("Every live pen path gets its own measured dash animation on the shared intro clock", () => {
  const strokes = blogLettering.flatMap(letter => letter.strokes);
  const motions = preparePenMotions();
  assert.equal(motions.length, strokes.length);
  motions.forEach((motion, index) => {
    const length = penLength(strokes[index].d);
    assert.equal(motion.timing.duration, 84);
    assert.equal(motion.timing.delay, 330 + strokes[index].order * 72);
    assert.equal(motion.currentTime, 0);
    assert.equal(motion.frames[0].opacity, 0);
    assert.equal(motion.frames[0].strokeDasharray, `${length} ${length}`);
    assert.equal(Number(motion.frames[0].strokeDashoffset), length);
    assert.equal(motion.frames.at(-1).strokeDashoffset, "0");
    assert.ok(length > 1, "SVG path length cannot collapse to a one-unit dash");
  });
});

test("The real pen keyframes reveal a partial first stroke, then accumulate the phrase instead of showing it at once", async () => {
  const motions = preparePenMotions();
  const definitions = [...new Map(blogLettering.map(letter => [letter.character, letter.outline]))]
    .map(([character, outline]) => `<clipPath id="g-${character === "." ? "dot" : character}" clipPathUnits="userSpaceOnUse"><path d="${outline}"/></clipPath>`).join("");
  const samples: number[] = [];
  for (const time of [0, 330, 370, 414, 700, 1000, 1400, 1700]) {
    const groups = blogLettering.map(letter => {
      const paths = letter.strokes.map(stroke => {
        const { frames, timing } = motions[stroke.order];
        const progress = Math.max(0, Math.min(1, ((time - timing.delay) / timing.duration - .001) / .999));
        const length = Number(frames[0].strokeDashoffset);
        const opacity = time <= timing.delay ? frames[0].opacity : frames.at(-1).opacity;
        return `<path d="${stroke.d}" fill="none" stroke="white" stroke-width="310" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" stroke-dasharray="${frames[0].strokeDasharray}" stroke-dashoffset="${length * (1 - progress)}"/>`;
      }).join("");
      return `<g transform="translate(${letter.x} 94) scale(.046875 -.046875)" clip-path="url(#g-${letter.character === "." ? "dot" : letter.character})">${paths}</g>`;
    }).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1252" height="188" viewBox="0 12 626 94"><defs>${definitions}<mask id="ink" maskUnits="userSpaceOnUse" x="0" y="0" width="626" height="120">${groups}</mask></defs><path d="M0 0H626V120H0Z" fill="#ff6688" mask="url(#ink)"/></svg>`;
    const pixels = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
    let alpha = 0;
    for (let index = 3; index < pixels.length; index += 4) alpha += pixels[index];
    samples.push(alpha);
  }
  assert.equal(samples[0], 0);
  assert.equal(samples[1], 0, "writing waits for the intro's pen cue");
  assert.ok(samples[2] > 0 && samples[2] < samples[3], "the first stroke grows along its centerline");
  assert.ok(samples.at(-1)! > 1_000_000, "the complete phrase remains visible");
  for (let index = 3; index < samples.length; index++) assert.ok(samples[index] > samples[index - 1]);
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
  assert.deepEqual(introAnimations.map(({ timing }) => timing.duration), [820, 900, 980, 1040]);
  assert.deepEqual(introAnimations.map(({ timing }) => timing.delay), [30, 170, 390, 640]);
  for (const animation of introAnimations) {
    assert.equal(animation.currentTime, 0);
    assert.ok(animation.timing.duration + animation.timing.delay <= 1700);
    assert.notEqual(animation.frames[0].transform, animation.frames[1].transform);
    assert.equal(animation.frames[0].opacity, 0);
    assert.equal(animation.frames[1].opacity, 1);
  }
  assert.equal(new Set(introAnimations.map(({ frames }) => frames[0].transform)).size, 4);
  assert.ok(introAnimations.every(({ frames }) => frames[0].transform.includes("rotate(")));
  assert.ok(introAnimations.every(({ frames }) => frames[1].transform.includes("rotate(0deg)")));
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
    castPointerActive: false, setCastFocus() {}, syncAmbient() {}, window: { scrollY: 0 },
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

test("Ambient title motion is independent of the intro and stops before the archive handoff", () => {
  class Element {
    dataset = { introState: "playing" };
    attributes = new Set<string>();
    toggleAttribute(name: string, value: boolean) {
      if (value) this.attributes.add(name);
      else this.attributes.delete(name);
    }
  }
  const activity: boolean[] = [];
  const state: any = {
    HTMLElement: Element, hero: new Element(), signal: { aborted: false },
    heroVisible: true, document: { hidden: false }, scrollProgress: 0,
    motionPreference: { matches: false },
    flashcards: { setActive: (value: boolean) => activity.push(value) },
  };
  const sync = vm.runInNewContext(`${extract("  const syncAmbient =", "  const syncHeroActivity =")}; syncAmbient`, state);
  sync();
  assert.equal(state.hero.attributes.has("data-title-loop"), false);
  state.hero.dataset.introState = "complete";
  sync();
  assert.equal(state.hero.attributes.has("data-title-loop"), true);
  state.scrollProgress = .02;
  sync();
  assert.equal(state.hero.attributes.has("data-title-loop"), false);
  assert.equal(activity.at(-1), false);
  state.scrollProgress = 0;
  state.document.hidden = true;
  sync();
  assert.equal(state.hero.attributes.has("data-title-loop"), false);
  state.document.hidden = false;
  state.heroVisible = false;
  sync();
  assert.equal(state.hero.attributes.has("data-title-loop"), false);
  state.heroVisible = true;
  state.motionPreference.matches = true;
  sync();
  assert.equal(state.hero.attributes.has("data-title-loop"), false);
  assert.equal(activity.at(-1), true, "the reduced-motion controller keeps its first article visible");
  state.motionPreference.matches = false;
  sync();
  assert.equal(state.hero.attributes.has("data-title-loop"), true);
  assert.doesNotMatch(extract("  const prepareMotion =", "  const playIntro ="), /ink-shine|signal-frame/);
});

test("The foil uses the original single ink mask and cannot paint beyond the handwritten phrase", async () => {
  const definitions = [...new Map(blogLettering.map(letter => [letter.character, letter.outline]))]
    .map(([character, outline]) => `<clipPath id="blog-g-${character === "." ? "dot" : character}" clipPathUnits="userSpaceOnUse"><path d="${outline}"/></clipPath>`).join("");
  const glyphs = blogLettering.map((letter) => {
    const strokes = letter.strokes.map(stroke => `<path d="${stroke.d}" fill="none" stroke="white" stroke-width="310" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
    return `<g transform="translate(${letter.x} 94) scale(.046875 -.046875)" clip-path="url(#blog-g-${letter.character === "." ? "dot" : letter.character})">${strokes}</g>`;
  }).join("");
  const fullGlyphs = blogLettering.map(letter =>
    `<g transform="translate(${letter.x} 94) scale(.046875 -.046875)" clip-path="url(#blog-g-${letter.character === "." ? "dot" : letter.character})"><path d="M-200 -300H1500V1800H-200Z" fill="white"/></g>`).join("");
  const start = '<svg xmlns="http://www.w3.org/2000/svg" width="1252" height="188" viewBox="0 12 626 94">';
  const render = (body: string) => sharp(Buffer.from(start + body + "</svg>")).ensureAlpha().raw().toBuffer();
  const full = await render(`<defs>${definitions}</defs>${fullGlyphs}`);
  const ink = `<defs>${definitions}<mask id="ink" maskUnits="userSpaceOnUse" x="0" y="0" width="626" height="120" fill="white">${glyphs}</mask></defs>`;
  const base = await render(`${ink}<g mask="url(#ink)"><path d="M0 0H626V120H0Z" fill="#ff6688"/></g>`);
  const foil = await render(`${ink}<g mask="url(#ink)"><path d="M0 0H626V120H0Z" fill="#ff6688"/><path d="M0 0H70L110 120H40Z" transform="translate(200 0)" fill="white"/></g>`);
  let alpha = 0, loss = 0, gain = 0;
  for (let i = 3; i < full.length; i += 4) {
    alpha += full[i];
    loss += Math.max(0, full[i] - base[i]);
    gain += Math.max(0, base[i] - full[i]);
    assert.equal(foil[i], base[i], "the foil cannot change the ink silhouette at any pixel");
  }
  assert.ok(loss / alpha < .005, "the complete ink mask keeps every letter");
  assert.ok(gain / alpha < .005, "clipped brush overlap changes only subpixel antialiasing");
});

test("White title and its passing pink light share one ink mask with room for descenders", async () => {
  const page = read("src/themes/kisara/pages/BlogIndexPage.astro");
  const start = page.indexOf('<svg class="kisara-blog-trace-signal"');
  const markup = page.slice(start, page.indexOf("</svg>", start) + 6)
    .replace("{signalTitle}", "Every signal").replace(" data-trace-line", "");
  assert.match(markup, /<g mask="url\(#blog-signal-ink\)">[\s\S]*fill="currentColor"[\s\S]*class="kisara-blog-signal-shine"/);
  assert.doesNotMatch(page, /data-signal-text/);
  assert.doesNotMatch(read("src/themes/kisara/styles/blog.css"), /signal-frame::after/);
  const motions: any[] = [];
  const prepare = vm.runInNewContext(`${extract("  const addMotion =", "  const playIntro =")}; prepareMotion`, {
    reducedMotion: false, introAnimations: motions, archiveAnimations: [], archive: null,
    hero: {
      querySelectorAll: () => [],
      querySelector: (selector: string) => selector === ".kisara-blog-trace-signal"
        ? { animate: (frames: unknown, timing: unknown) => ({ frames, timing, pause() {} }) } : null,
    },
  });
  prepare();
  for (const frame of motions[0].frames) assert.match(frame.clipPath, /^inset\(-\.2em .+ -\.2em -\.1em\)$/);
  for (const [fontSize, width] of [[42.4, 320], [49.6, 350], [64, 560], [72, 600], [99.2, 780]]) {
    const height = Math.ceil(fontSize * 1.18);
    const styled = markup.replace("<svg", `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"`)
      .replace(">", `><style>svg,text{font:400 ${fontSize}px Georgia,serif;color:#f7f4ff}</style>`);
    const render = (opacity: number, offset = 0) => sharp(Buffer.from(styled.replace('class="kisara-blog-signal-shine"',
      `opacity="${opacity}" transform="translate(${offset} 0)"`)))
      .ensureAlpha().raw().toBuffer();
    const base = await render(0);
    const foil = await render(1, width * .5);
    let bottom = 0, visible = 0, changed = 0;
    for (let i = 3; i < base.length; i += 4) {
      assert.equal(base[i], foil[i], "foil cannot add pixels outside the actual glyph shape");
      if (base[i]) { bottom = Math.max(bottom, Math.floor(i / 4 / width)); visible++; }
      if (base[i - 3] !== foil[i - 3]) changed++;
    }
    assert.ok(visible > 500);
    assert.ok(changed > 10, "test must sample the light while it actually crosses the glyphs");
    assert.ok(bottom < height - 2, "y/g descenders must have transparent space below them");
    const direct = styled.replace(/<g mask="url\(#blog-signal-ink\)">[\s\S]*?<\/g>/,
      '<text x="0" y=".86em" fill="currentColor">Every signal</text>');
    const reference = await sharp(Buffer.from(direct)).ensureAlpha().raw().toBuffer();
    for (let i = 3; i < base.length; i += 4) assert.equal(base[i], reference[i], "ink mask keeps the complete text");
  }
});

test("Original video wordmark layers share coordinates and enter on the same reversible clock as the cast", async () => {
  const page = read("src/themes/kisara/pages/BlogIndexPage.astro");
  const stage = page.slice(page.indexOf('<div class="kisara-blog-character-stage">'), page.indexOf('<div class="kisara-blog-scene-veil">'));
  assert.equal((stage.match(/data-blog-character=/g) ?? []).length, 4);
  assert.equal((stage.match(/class="kisara-blog-poster-logo /g) ?? []).length, 2);
  assert.ok(stage.indexOf("is-shu") < stage.indexOf('poster-logo is-white'));
  assert.ok(stage.indexOf('poster-logo is-white') < stage.indexOf("is-kisara"));
  assert.ok(stage.indexOf("is-kisara") < stage.indexOf('poster-logo is-script'));
  const properties = new Map<string, string>();
  postcss.parse(read("src/themes/kisara/styles/blog.css")).walkRules(rule => {
    if (rule.selector === ".kisara-blog-poster-logo") rule.walkDecls(decl => { properties.set(decl.prop, decl.value); });
  });
  assert.equal(properties.get("aspect-ratio"), "40 / 17");
  assert.equal(properties.get("pointer-events"), "none");
  const motions: any[] = [];
  const prepare = vm.runInNewContext(`${extract("  const addMotion =", "  const playIntro =")}; prepareMotion`, {
    reducedMotion: false, introAnimations: motions, archiveAnimations: [], archive: null,
    hero: {
      querySelectorAll: () => [],
      querySelector: (selector: string) => selector.startsWith(".kisara-blog-poster-logo.")
        ? { animate: (frames: unknown, timing: unknown) => ({ frames, timing, pause() {} }) } : null,
    },
  });
  prepare();
  assert.equal(motions.length, 2);
  for (const motion of motions) {
    assert.ok(motion.timing.duration + motion.timing.delay <= 1700);
    assert.equal(motion.frames[0].opacity, 0);
    assert.equal(motion.frames.at(-1).opacity, 1);
  }
  for (const name of ["white", "script"]) {
    const image = readFileSync(new URL(`../public/themes/kisara/assets/blog/engage-kiss-wordmark-${name}.webp`, import.meta.url));
    const meta = await sharp(image).metadata();
    assert.equal(meta.width, 1280);
    assert.equal(meta.height, 544);
    assert.equal(meta.hasAlpha, true);
    assert.ok(image.length < 50000);
  }
});

test("Blog uses the gentler baked background and ticket edge softening without manual controls", async () => {
  const page = read("src/themes/kisara/pages/BlogIndexPage.astro");
  assert.match(page, /engage-kiss-poster-ambient-v2\.webp/);
  assert.match(read("scripts/prepare-kisara-blog-ambient.mjs"), /\.blur\(22\)/);
  assert.doesNotMatch(page, /data-flashcard-(?:prev|next|pause|controls|status)/);
  const css = postcss.parse(read("src/themes/kisara/styles/blog.css"));
  let imageMask = false, pearl = false;
  css.walkRules(rule => {
    if (rule.selector === ".kisara-blog-flashcard figure img") {
      rule.walkDecls("mask-image", decl => { imageMask = decl.value.includes("transparent"); });
    }
    if (rule.selector === ".kisara-blog-flashcard") {
      rule.walkDecls("background", decl => { pearl = decl.value.includes("rgba(202, 238, 244, .28)"); });
    }
    if (rule.selector === ".kisara-blog-flashcard-copy") {
      rule.walkDecls(/mask/, () => assert.fail("softening must not mask the article text"));
    }
  });
  assert.ok(imageMask && pearl);
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
