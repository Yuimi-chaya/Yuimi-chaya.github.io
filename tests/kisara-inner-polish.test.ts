import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const works = read("src/themes/kisara/lib/worksPage.js");
const blog = read("src/themes/kisara/lib/blogPage.js");
const between = (source: string, from: string, to: string) => {
  const start = source.indexOf(from), end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `Missing source boundary: ${from}`);
  return source.slice(start, end);
};
const cutSource = between(works, "const getFruitCut =", "const sliceFruit =");
const getFruitCut = new Function(`${cutSource}; return getFruitCut;`)();
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

class Element {
  style: Record<string, any> = {};
  classList = { add() {}, remove() {} };
}

test("Fruit cuts partition the complete image and compute valid mass centers at any rotation", () => {
  for (const angle of [0, 30, 90, 147, 270]) {
    for (const offset of [-25, 0, 25]) {
      const state = { x: 160, y: 140, width: 76, height: 76, angle };
      const cut = getFruitCut(state, { x: 80, y: 140 + offset }, { x: 240, y: 140 + offset });
      assert.ok(cut);
      assert.ok(Math.abs(cut.leftCenter.area + cut.rightCenter.area - 76 * 76) < .001);
      for (const center of [cut.leftCenter, cut.rightCenter]) {
        assert.ok(center.area > 0);
        assert.ok(center.x > 0 && center.x < 76);
        assert.ok(center.y > 0 && center.y < 76);
      }
      assert.ok(!/NaN|Infinity/.test(cut.left + cut.right));
    }
  }
  assert.equal(getFruitCut({ x: 0, y: 0, width: 76, height: 76, angle: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }), null);
});

test("Glancing cuts still produce two substantial pieces instead of a tiny corner", () => {
  for (const angle of [0, 30, 45, 90, 147, 270]) {
    for (const offset of [-42, -30, 30, 42]) {
      const cut = getFruitCut(
        { x: 160, y: 140, width: 76, height: 76, angle },
        { x: 80, y: 140 + offset }, { x: 240, y: 140 + offset }
      );
      assert.ok(cut);
      const fraction = Math.min(cut.leftCenter.area, cut.rightCenter.area) / (76 * 76);
      assert.ok(fraction >= .29, `Small fragment at ${angle} degrees: ${fraction}`);
    }
  }
});

function slicedFruit(angle = 45) {
  const fruit = new Element();
  const state: any = {
    fruit, left: new Element(), right: new Element(), phase: "whole", isPig: false,
    x: 300, y: 200, width: 76, height: 76, vx: 60, vy: -200, angularVelocity: 180, angle
  };
  const map = new Map([[fruit, state]]);
  const renderSource = between(works, "const renderFruit =", "const beginPigFade =");
  const renderFruit = new Function(`${renderSource}; return renderFruit;`)();
  const sliceSource = between(works, "const sliceFruit =", "const sliceHeroFruits =");
  const sliceFruit = new Function("fruitPhysics", "HTMLElement", "getFruitCut", "renderFruit", "clamp",
    `let sliceCount = 0; const sliceScore = null; ${sliceSource}; return sliceFruit;`
  )(map, Element, getFruitCut, renderFruit, clamp);
  sliceFruit(fruit, { x: 220, y: 200 }, { x: 380, y: 200 });
  return { state, map, renderFruit };
}

test("Split halves start at the exact original pose and inherit velocity without parent rotation", () => {
  for (const angle of [0, 37, 90, 190]) {
    const { state } = slicedFruit(angle);
    assert.equal(state.phase, "sliced");
    assert.ok(!state.fruit.style.transform.includes("rotate"));
    for (const piece of [state.splitLeft, state.splitRight]) {
      const x = piece.originX - 38, y = piece.originY - 38;
      const radians = angle * Math.PI / 180;
      assert.ok(Math.abs(piece.x - (300 + x * Math.cos(radians) - y * Math.sin(radians))) < .001);
      assert.ok(Math.abs(piece.y - (200 + x * Math.sin(radians) + y * Math.cos(radians))) < .001);
      assert.equal(piece.angle, angle);
      assert.equal(piece.vx, 60);
    }
    assert.ok(state.splitLeft.vy > state.splitRight.vy);
  }
});

function physicsFixture() {
  const fruit = slicedFruit();
  const queues: any[] = [];
  const tickSource = between(works, "function runFruitPhysics(", "const startFruitPhysics =");
  const run = new Function("fruitPhysics", "renderFruit", "queueFruit", "HTMLElement", "clamp", `
    let fruitPhysicsFrame = 0, fruitPhysicsLastTime = 0;
    const fruitPhysicsReady = true, fruitPhysicsVisible = true, heroStageActive = true;
    const document = { hidden: false }, signal = { aborted: false };
    const sliceField = new HTMLElement(), sliceFieldBounds = { width: 1200, height: 900 };
    const fruitGravity = 1650;
    const requestFruitPhysicsFrame = () => {}, launchFruit = () => {}, beginPigFade = () => {};
    ${tickSource}
    return runFruitPhysics;
  `)(fruit.map, fruit.renderFruit, (state: any) => queues.push(state), Element, clamp);
  return { ...fruit, run, queues };
}

test("Each half follows the same gravity trajectory at 30, 60 and 120 Hz", () => {
  const results = [30, 60, 120].map(rate => {
    const f = physicsFixture();
    f.run(1000);
    for (let frame = 1; frame <= rate; frame++) f.run(1000 + frame * 1000 / rate);
    assert.equal(f.queues.length, 0);
    return [f.state.splitLeft.x, f.state.splitLeft.y, f.state.splitRight.x, f.state.splitRight.y];
  });
  for (const result of results) result.forEach((value, index) => assert.ok(Math.abs(value - results[0][index]) < .001));
});

test("A visible half cannot be recycled because the other half has already fallen away", () => {
  const f = physicsFixture();
  f.state.splitLeft.y = 2000;
  f.state.splitRight.y = 300;
  f.run(1000);
  assert.equal(f.queues.length, 0);
  f.state.splitRight.y = 2000;
  f.run(1016);
  assert.equal(f.queues.length, 1);
});

function pointerFixture(scale = 1) {
  const cuts: any[] = [], trails: any[] = [];
  const fruit = new Element();
  const states = new Map<any, any>([[fruit, { x: 100, y: 100, hitRadiusX: 35, phase: "whole", isPig: false }]]);
  const geometry = between(works, "const pointToSegmentDistance =", "const appendSliceTrail =");
  const pointerSource = between(works, "const sliceHeroFruits =", "if (hero instanceof HTMLElement)");
  const move = new Function("fruitPhysics", "cuts", "trails", "HTMLElement", "clamp", "displayScale", `
    const sliceField = new HTMLElement(), sliceFieldBounds = { left: 0, top: 0, width: 600, height: 600 };
    const fruitPhysicsEnabled = true, fruitPhysicsVisible = true, heroStageActive = true, document = { hidden: false }, window = { scrollY: 0 };
    let lastSlicePoint = null, lastSliceEventTime = 0;
    const sliceFruit = (...args) => cuts.push(args);
    const appendSliceTrail = (...args) => trails.push(args);
    const hitPig = () => {};
    ${geometry}
    ${pointerSource}
    return sliceHeroFruits;
  `)(states, cuts, trails, Element, clamp, scale);
  return { cuts, trails, states, move: (x: number, y: number, time: number) => move({ clientX: x, clientY: y, timeStamp: time }) };
}

test("Slow one-pixel pointer samples accumulate into a cut instead of resetting forever", () => {
  const f = pointerFixture();
  for (let i = 0; i < 10; i++) f.move(80 + i, 100, 1000 + i * 8);
  assert.ok(f.cuts.length >= 1);
  const gentle = pointerFixture();
  for (let i = 0; i < 10; i++) gentle.move(80 + i, 100, 1000 + i * 50);
  assert.ok(gentle.cuts.length >= 1);
  const still = pointerFixture();
  for (let i = 0; i < 10; i++) still.move(100, 100, 1000 + i * 8);
  assert.equal(still.cuts.length, 0);
});

test("A 90 percent fruit field retains the same body hit and tip-graze rejection", () => {
  for (const y of [65, 80, 100, 120, 135]) {
    const normal = pointerFixture();
    const scaled = pointerFixture(.9);
    normal.move(20, y, 1000);
    normal.move(180, y, 1016);
    scaled.move(18, y * .9, 1000);
    scaled.move(162, y * .9, 1016);
    assert.equal(scaled.cuts.length, normal.cuts.length);
    assert.equal(scaled.trails.length, normal.trails.length);
  }
});

test("Blade must enter the fruit body; tip grazes and old positions do not trigger cuts", () => {
  for (const y of [65, 70, 130, 135, 140]) {
    const f = pointerFixture();
    f.move(20, y, 1000);
    f.move(180, y, 1016);
    assert.equal(f.cuts.length, 0, `Edge graze at y=${y}`);
  }
  for (const y of [80, 100, 120]) {
    const f = pointerFixture();
    f.move(20, y, 1000);
    f.move(180, y, 1016);
    assert.equal(f.cuts.length, 1, `Body swipe at y=${y}`);
  }
  const f = pointerFixture();
  const state = [...f.states.values()][0];
  state.previousX = 100;
  state.previousY = 150;
  f.move(20, 150, 1000);
  f.move(180, 150, 1016);
  assert.equal(f.cuts.length, 0);
});

test("A stale pointer jump does not cut across the scene, and the pig still stops the blade", () => {
  const stale = pointerFixture();
  stale.move(0, 100, 1000);
  stale.move(200, 100, 1500);
  assert.equal(stale.cuts.length, 0);
  const f = pointerFixture();
  f.states.clear();
  f.states.set(new Element(), { x: 100, y: 100, hitRadiusX: 40, hitRadiusY: 40, phase: "whole", isPig: true });
  f.states.set(new Element(), { x: 200, y: 100, hitRadiusX: 35, phase: "whole", isPig: false });
  f.move(0, 100, 1000);
  f.move(240, 100, 1016);
  assert.equal(f.cuts.length, 0);
});

test("Continuous blade strokes reuse no more than 24 DOM trail nodes", () => {
  const children: any[] = [];
  class Trail extends Element {
    sliceAnimation: any;
    style: any = { setProperty() {} };
    animate() { return { cancel() {} }; }
  }
  const trails = new Element() as any;
  trails.append = (node: any) => children.push(node);
  const append = new Function("sliceTrails", "HTMLElement", "document", `
    const trailPool = []; let trailCursor = 0;
    ${between(works, "const appendSliceTrail =", "const appendPigImpact =")}
    return appendSliceTrail;
  `)(trails, Element, { createElement: () => new Trail() });
  for (let index = 0; index < 200; index++) append({ x: index, y: 0 }, { x: index + 10, y: 10 });
  assert.equal(children.length, 24);
});

test("All six ingredient symbols are shared by the airborne fruit, pantry, cutting board and blender", () => {
  const art = read("src/themes/kisara/components/KisaraIngredientSymbols.astro");
  for (const shape of ["cube", "ice", "orange", "star", "leaf", "cherry"]) {
    assert.equal(art.split(`id="kisara-fruit-${shape}"`).length - 1, 1);
  }
  assert.match(works, /piece\.append\(createIngredientArt\(meta, "kisara-board-art"\)\)/);
  assert.match(works, /piece\.append\(createIngredientArt\(meta, "kisara-blender-art"\)\)/);
  assert.doesNotMatch(works, /piece\.textContent = meta\.code\.slice/);
});

test("The fruit hot loop uses cached dimensions and stops work while hidden", () => {
  const loop = between(works, "function runFruitPhysics(", "const startFruitPhysics =");
  assert.doesNotMatch(loop, /getBoundingClientRect|clientWidth|clientHeight/);
  assert.match(loop, /document\.hidden/);
  assert.match(works, /heroResizeObserver\?\.disconnect/);
  assert.match(works, /cancelHeroVideoWait\?\.\(\)/);
  assert.match(works, /setTimeout\(\(\) => settle\(false\), 3500\)/);
});

test("Works visibility suspends video, pointer queues and intro time, then resumes without restarting", async () => {
  class Hero extends Element {
    dataset = { introState: "playing", videoState: "playing" };
    toggleAttribute() {}
  }
  class Video {
    paused = false;
    ended = false;
    currentTime = 1.2;
    plays = 0;
    pause() { this.paused = true; }
    play() { this.paused = false; this.plays++; return Promise.resolve(); }
  }
  const hero = new Hero(), video = new Video(), doc = { hidden: true };
  const delays: number[] = [];
  const window = { cancelAnimationFrame() {}, clearTimeout() {}, setTimeout(_fn: any, delay: number) { delays.push(delay); return 1; } };
  const factory = new Function("hero", "heroVideo", "HTMLElement", "HTMLVideoElement", "document", "window", `
    const signal = { aborted: false }, performance = { now: () => 500 };
    let fruitPhysicsVisible = true, fruitPhysicsLastTime = 100;
    let heroStageActive = true;
    let fruitPhysicsFrame = 1, heroPointerFrame = 2, heroIntroTimer = 3;
    let heroIntroDeadline = 1580, heroIntroRemaining = 1580, resumeHeroVideo = false, lastSlicePoint = {};
    let heroVideoPlayGeneration = 0;
    const pendingSliceEvents = [1, 2], requestFruitPhysicsFrame = () => {}, finishHeroIntro = () => {};
    ${between(works, "const syncWorksActivity =", 'if (hero instanceof HTMLElement && "IntersectionObserver"')}
    return { sync: syncWorksActivity, snapshot: () => ({ fruitPhysicsFrame, heroPointerFrame, heroIntroRemaining, pending: pendingSliceEvents.length }) };
  `);
  const runtime = factory(hero, video, Hero, Video, doc, window);
  runtime.sync();
  assert.equal(video.paused, true);
  assert.deepEqual(runtime.snapshot(), { fruitPhysicsFrame: 0, heroPointerFrame: 0, heroIntroRemaining: 1080, pending: 0 });
  doc.hidden = false;
  runtime.sync();
  await Promise.resolve();
  assert.equal(video.plays, 1);
  assert.equal(video.currentTime, 1.2);
  assert.deepEqual(delays, [1080]);
});

test("Blog uses stable hit geometry, guarded replay and deferred archive covers", () => {
  const hit = between(blog, "const findCharacterAtPoint =", "const resolveCastHit =");
  assert.doesNotMatch(hit, /getBoundingClientRect/);
  assert.match(blog, /generation !== introGeneration/);
  assert.match(blog, /lastIntroTime = performance\.now/);
  assert.match(blog, /window\.cancelAnimationFrame\(introFrame\)/);
  assert.match(blog, /pointerenter", prepareCastHitMasks/);
  assert.match(blog, /event\.key !== "Escape"/);
  const page = read("src/themes/kisara/pages/BlogIndexPage.astro");
  assert.doesNotMatch(page, /loading=\{index === 0/);
});

test("The Game switches two scenes directly without a scrolling bridge", () => {
  const page = read("src/themes/kisara/pages/GamesPage.astro");
  assert.match(page, /<KisaraGameClueScene \/>/);
  assert.doesNotMatch(page, /kisara-game-scene-bridge|scene\.offsetTop/);
  const runtime = read("src/themes/kisara/lib/gamesPage.js");
  assert.match(runtime, /scene\.inert = position !== target/);
  assert.doesNotMatch(runtime, /addEventListener\("wheel"|velocity|smoothScroll/);
  assert.match(page, /data-game-scene-jump="0"/);
  assert.match(page, /data-game-scene-jump="1"/);
});

test("Page runtime loading ignores detached routes and leaves a readable fallback on failure", () => {
  const loader = read("src/themes/kisara/components/KisaraPageRuntime.astro");
  assert.match(loader, /if \(root\.isConnected\) module\[entry\]\(\)/);
  assert.match(loader, /root\.dataset\.introState = "complete"/);
  assert.match(loader, /data-astro-rerun/);
});
