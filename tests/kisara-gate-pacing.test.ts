import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { advanceGateAutoplay, gateAutoplayDuration, gateAutoplayShotDurations } from "../src/themes/kisara/lib/gateAutoplay.ts";
import { memoryTimeline } from "../src/themes/kisara/lib/gateStory.ts";

const home = readFileSync(new URL("../src/themes/kisara/pages/HomePage.astro", import.meta.url), "utf8");
const between = (name: string, next: string) => home.slice(home.indexOf("const " + name + " ="), home.indexOf("const " + next + " ="));

test("AUTO follows the authored shot boundaries at 30, 60 and 120Hz without a spring tail", () => {
  assert.equal(gateAutoplayDuration, 8200);
  for (const fps of [30, 60, 120]) {
    let progress = 0;
    let elapsed = 0;
    let shot = 0;
    let boundaryTime = gateAutoplayShotDurations[0];
    while (progress < 1 && elapsed < 10000) {
      const next = advanceGateAutoplay(progress, 1000 / fps);
      assert.ok(next >= progress && next <= 1);
      progress = next;
      elapsed += 1000 / fps;
      if (progress >= memoryTimeline[shot].leaveStart - 1e-12) {
        assert.ok(Math.abs(elapsed - boundaryTime) <= 1000 / fps + .001);
        shot++;
        if (shot === memoryTimeline.length) break;
        boundaryTime += gateAutoplayShotDurations[shot];
      }
    }
    assert.equal(shot, 9);
    assert.ok(Math.abs(elapsed - gateAutoplayDuration) <= 1000 / fps + .001);
  }
  for (const start of [.13, .328, .7, .94]) {
    assert.equal(advanceGateAutoplay(start, 0), start);
    assert.ok(Math.abs(advanceGateAutoplay(advanceGateAutoplay(start, 20), 20) - advanceGateAutoplay(start, 40)) < 1e-12);
    assert.equal(advanceGateAutoplay(start, 10000), advanceGateAutoplay(start, 50));
  }
});

test("rapid forward and reverse progress cannot bypass the procedural texture budget", () => {
  const state: Record<string, any> = {
    titleAbyssFluidContext: {}, titleAbyssFluidImageData: {}, titleAbyssTideContext: {}, titleAbyssTideImageData: {},
    reducedMotion: false, litePerformance: false, mobilePerformance: false,
    titleAbyssFluidLastPaintTimestamp: 1000, titleAbyssFluidLastPalette: .5,
  };
  state.titleAbyssFluidCanvas = { get width() { throw new Error("expensive pixel path reached"); } };
  const paint = vm.runInNewContext(between("paintTitleAbyssFluid", "resizeTitleDataCanvas") + "; paintTitleAbyssFluid;", state);
  for (const fill of [0, .3, 1, .6, 0]) paint(1016, fill);
  assert.throws(() => paint(1067, .7), /expensive pixel path reached/);
  assert.throws(() => paint(1016, .7, true), /expensive pixel path reached/, "forced resize paint is still allowed");
});

test("moving chains do not skip a small frame, while an unchanged frame stays throttled", () => {
  const source = between("drawTitleChains", "drawEnergy");
  const state: Record<string, any> = {
    chainBackCanvas: { style: {} }, chainFrontCanvas: { style: {} },
    chainBackContext: { setTransform() { throw new Error("paint"); } }, chainFrontContext: {},
    chainCanvasWidth: 1200, chainCanvasHeight: 300, chainTitleBox: { width: 900 },
    chargeIntroProgress: 0, burstProgress: 0,
    clamp: (x: number, a: number, b: number) => Math.max(a, Math.min(b, x)),
    phaseProgress: () => 1, chainMaterial: null, chainMaterialVisibility: 0,
    chainLastPaintTimestamp: 1000, chainLastPaintFill: .5, chainLastPaintIntro: 0,
  };
  state.phaseProgress = (x: number, a: number, b: number) => Math.max(0, Math.min(1, (x - a) / (b - a)));
  const draw = vm.runInNewContext(source + "; drawTitleChains;", state);
  draw(1016, .5);
  assert.throws(() => draw(1016, .501), /paint/);
  assert.throws(() => draw(1016, .499), /paint/);
});
