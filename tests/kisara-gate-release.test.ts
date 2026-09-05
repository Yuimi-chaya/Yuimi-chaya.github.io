import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { gateRelease, gateReleaseKeyframes, mapReleaseAutoplayProgress } from "../src/themes/kisara/lib/gateRelease.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const home = read("src/themes/kisara/pages/HomePage.astro");
const sourceBetween = (name: string, next: string) => {
  const start = home.indexOf(`const ${name} =`);
  const end = home.indexOf(`const ${next} =`, start);
  assert.ok(start >= 0 && end > start, `production functions ${name}/${next}`);
  return home.slice(start, end);
};

test("release clock compresses the black hole while preserving the final reconstruction", () => {
  assert.equal(gateRelease.duration, 1520);
  assert.equal(gateRelease.duration - gateRelease.beats.detonationEnd, 610);
  const oldHoleDuration = (0.67 - 0.076) * 1850;
  const newHoleDuration = gateRelease.beats.detonationEnd - gateRelease.beats.crossEnd;
  assert.ok(newHoleDuration / oldHoleDuration < 0.71);
  assert.ok(newHoleDuration / oldHoleDuration > 0.68);
  for (const [time, progress] of gateReleaseKeyframes) {
    assert.ok(Math.abs(mapReleaseAutoplayProgress(time / gateRelease.duration) - progress) < 1e-10);
  }
});

test("release mapping has no missing interval, jump, or reverse step", () => {
  let previous = gateRelease.phases.start;
  for (let i = 0; i <= 15200; i++) {
    const value = mapReleaseAutoplayProgress(i / 15200);
    assert.ok(Number.isFinite(value));
    assert.ok(value >= previous - 1e-12 && value <= 1);
    assert.ok(value - previous < 0.003);
    previous = value;
  }
  assert.equal(mapReleaseAutoplayProgress(-1), gateRelease.phases.start);
  assert.equal(mapReleaseAutoplayProgress(NaN), gateRelease.phases.start);
  assert.equal(mapReleaseAutoplayProgress(2), 1);
});

function fixture(overrides: Record<string, unknown> = {}) {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const state: Record<string, any> = {
    disposed: false, lovebrainActive: false, pageMode: "gate", gate: { isConnected: true },
    mobileFrameInterval: 0, lastAnimationPaintTimestamp: 0, animationFrame: 0, lastFrameTime: 0,
    progress: 1, targetProgress: 1, velocity: 0, springStrength: 0.06, damping: 0.76, settleDistance: 0.00035,
    chargeIntroProgress: 0, chargeIntroActive: false, chargeIntroComplete: false, chargeIntroReversing: false,
    chargeIntroStartedAt: 0, chargeIntroTransitionDuration: 0, chargeIntroFrom: 0, chargeIntroTarget: 1,
    chargeIntroDuration: 2150, energyProgress: 1, fillDistance: 2100,
    releaseMode: "manual", releaseTimeline: 0, releaseDuration: gateRelease.duration,
    releaseAutoplayDuration: gateRelease.duration, releaseLastTimestamp: 0,
    releasePlaybackRate: 1, releaseBoost: 0, releaseVisualPressure: 0,
    releaseRewindVeil: 0, releaseRewindStartedAt: 0, releaseRewindDuration: 0, releaseRewindFromTimeline: 0,
    releaseDetonationStartAt: gateRelease.beats.detonationStart / gateRelease.duration,
    burstProgress: 0, targetBurstProgress: 0, burstVelocity: 0,
    heroAutoplayActive: false, heroAutoplayLastTimestamp: 0, heroAutoplayFillDuration: 4600,
    blackHoleIngressStart: 0.728,
    collapseStart: gateRelease.phases.collapseStart, shockwaveStart: gateRelease.phases.shockwaveStart,
    detonationEnd: gateRelease.phases.detonationEnd,
    clamp, mapReleaseAutoplayProgress,
    smootherstep: (value: number) => {
      const p = clamp(value, 0, 1);
      return p ** 3 * (p * (p * 6 - 15) + 10);
    },
    now: 1000, requested: 0, cleared: 0, rendered: 0, rail: null,
    ...overrides
  };
  state.window = { requestAnimationFrame: () => ++state.requested };
  state.performance = { now: () => state.now };
  state.startAnimation = () => { state.requested++; };
  state.scheduleWarningWarmup = () => {};
  state.clearReleaseTransientEffects = () => { state.cleared++; };
  state.stopHeroAutoplay = () => { state.heroAutoplayActive = false; state.heroAutoplayLastTimestamp = 0; };
  state.publishGateRailState = (rail: unknown) => { state.rail = rail; };
  state.render = () => {
    state.rendered++;
    api.syncGateProgressRail(state.progress, state.releaseMode === "complete", "inner-bind");
  };
  const functions = [
    ["transitionChargeIntro", "startChargeIntro"],
    ["startChargeIntro", "clearReleaseTransientEffects"],
    ["startReleaseAutoplay", "startReleaseRewind"],
    ["startReleaseRewind", "handleReleaseInput"],
    ["handleReleaseInput", "syncHeroAutoplayControl"],
    ["advanceHeroAutoplay", "startHeroAutoplay"],
    ["animate", "startAnimation"],
    ["addProgress", "isFillComplete"],
    ["syncGateProgressRail", "render"]
  ];
  const api = vm.runInNewContext(
    functions.map(([name, next]) => sourceBetween(name, next)).join("\n")
      + `\n({ ${functions.map(([name]) => name).join(", ")} });`,
    state
  );
  return {
    state, api,
    step(timestamp: number) { state.now = timestamp; api.animate(timestamp); }
  };
}

test("finishing the heart automatically starts release in the same frame without wheel input", () => {
  const f = fixture();
  f.api.startChargeIntro(1000);
  f.step(3150);
  assert.equal(f.state.chargeIntroComplete, true);
  assert.equal(f.state.chargeIntroActive, false);
  assert.equal(f.state.releaseMode, "forward");
  assert.equal(f.state.burstProgress, gateRelease.phases.start);
  assert.equal(f.state.targetBurstProgress, 1);
  assert.equal(f.state.releaseTimeline, 0);
  assert.equal(f.state.rail.progress, 0.7);
  assert.equal(f.state.rail.stage, "warning");
});

test("new release reaches the original final state across refresh rates", () => {
  for (const fps of [30, 60, 120]) {
    const f = fixture({ chargeIntroComplete: true, chargeIntroProgress: 1 });
    f.api.startReleaseAutoplay(1000);
    const frame = 1000 / fps;
    let time = 1000;
    let previousRail = 0.7;
    while (f.state.releaseMode !== "complete" && time < 2700) {
      time += frame;
      f.step(time);
      assert.ok(f.state.rail.progress >= previousRail - 1e-12);
      assert.notEqual(f.state.rail.stage, "blade");
      previousRail = f.state.rail.progress;
    }
    assert.equal(f.state.releaseMode, "complete");
    assert.equal(f.state.burstProgress, 1);
    assert.equal(f.state.targetBurstProgress, 1);
    assert.equal(f.state.rail.progress, 1);
    assert.ok(time - 1000 >= gateRelease.duration - 1e-6);
    assert.ok(time - 1000 <= gateRelease.duration + frame + 1e-6);
  }
});

test("early rewind pauses at the new start, then moves straight back into the heart", () => {
  const f = fixture({ chargeIntroComplete: true, chargeIntroProgress: 1 });
  f.api.startReleaseAutoplay(1000);
  f.state.releaseTimeline = 0.2;
  f.state.burstProgress = mapReleaseAutoplayProgress(0.2);
  assert.equal(f.api.handleReleaseInput(-120, 1200), true);
  assert.equal(f.state.releaseMode, "rewinding");
  f.step(1200 + f.state.releaseRewindDuration);
  assert.equal(f.state.releaseMode, "paused");
  assert.equal(f.state.burstProgress, gateRelease.phases.start);
  f.step(f.state.now + 16);
  assert.equal(f.state.releaseMode, "paused");
  assert.equal(f.api.handleReleaseInput(-120, f.state.now), false);
  assert.equal(f.state.burstProgress, 0);
  assert.equal(f.state.targetBurstProgress, 0);
  f.api.addProgress(-120);
  assert.equal(f.state.chargeIntroTarget, 0);
  assert.equal(f.state.chargeIntroReversing, true);
  f.step(f.state.now + f.state.chargeIntroTransitionDuration);
  assert.equal(f.state.chargeIntroComplete, false);
  assert.equal(f.state.releaseMode, "manual");
  assert.equal(f.state.burstProgress, 0);
});

test("paused release resumes, and late reverse input keeps the existing fast-finish behavior", () => {
  const f = fixture({ chargeIntroComplete: true, chargeIntroProgress: 1, releaseMode: "paused",
    burstProgress: gateRelease.phases.start, targetBurstProgress: gateRelease.phases.start });
  assert.equal(f.api.handleReleaseInput(120, 1000), true);
  assert.equal(f.state.releaseMode, "forward");
  assert.equal(f.state.burstProgress, gateRelease.phases.start);
  f.state.releaseTimeline = 0.6;
  assert.equal(f.api.handleReleaseInput(-120, 1100), true);
  assert.equal(f.state.releaseMode, "forward");
  assert.ok(f.state.releasePlaybackRate >= 1.5);
  assert.ok(f.state.releaseBoost >= 0.72);
});

test("AUTO no longer inserts a timed blade stage or bypasses an active heart", () => {
  const f = fixture({ heroAutoplayActive: true, chargeIntroComplete: true, chargeIntroProgress: 1 });
  f.api.advanceHeroAutoplay(1000);
  assert.equal(f.state.releaseMode, "forward");
  assert.equal(f.state.burstProgress, gateRelease.phases.start);
  const active = fixture({ heroAutoplayActive: true, chargeIntroActive: true, chargeIntroProgress: 0.5 });
  active.api.advanceHeroAutoplay(1000);
  assert.equal(active.state.releaseMode, "manual");
  assert.equal(active.state.burstProgress, 0);
});

test("reversing an unfinished heart never starts the black hole", () => {
  const f = fixture({ chargeIntroActive: true, chargeIntroProgress: 0.6, chargeIntroFrom: 0,
    chargeIntroTarget: 1, chargeIntroStartedAt: 500, chargeIntroTransitionDuration: 2150 });
  f.api.addProgress(-120);
  assert.equal(f.state.chargeIntroTarget, 0);
  f.step(1000 + f.state.chargeIntroTransitionDuration);
  assert.equal(f.state.chargeIntroComplete, false);
  assert.equal(f.state.releaseMode, "manual");
  assert.equal(f.state.burstProgress, 0);
});

test("release rail stays continuous at both automatic boundaries", () => {
  const f = fixture();
  f.api.syncGateProgressRail(1, false, "maximum-tension");
  assert.equal(f.state.rail.progress, 0.55);
  f.state.chargeIntroActive = true;
  f.state.chargeIntroProgress = 0;
  f.api.syncGateProgressRail(1, false, "maximum-tension");
  assert.equal(f.state.rail.progress, 0.55);
  f.state.chargeIntroProgress = 1;
  f.api.syncGateProgressRail(1, false, "maximum-tension");
  assert.ok(Math.abs(f.state.rail.progress - 0.7) < 1e-12);
  f.state.chargeIntroActive = false;
  f.state.chargeIntroComplete = true;
  f.api.startReleaseAutoplay(1000);
  f.api.syncGateProgressRail(1, false, "maximum-tension");
  assert.equal(f.state.rail.progress, 0.7);
});

test("long frame gaps are bounded and disposed scenes cannot advance", () => {
  const f = fixture({ chargeIntroComplete: true, chargeIntroProgress: 1 });
  f.api.startReleaseAutoplay(1000);
  f.step(61000);
  assert.ok(f.state.releaseTimeline <= 50 / gateRelease.duration);
  f.state.disposed = true;
  const before = f.state.releaseTimeline;
  f.step(62000);
  assert.equal(f.state.releaseTimeline, before);
});

test("retired blade resources are absent while final-stage and pre-release sources remain valid", () => {
  assert.doesNotMatch(home, /glossFadeEnd|kisara-title-gloss|bladeWheelGain|heroAutoplayBladeDuration|burstSpringStrength|silhouette/);
  assert.doesNotMatch(read("src/themes/kisara/styles/home.css"), /kisara-title-gloss|kisara-gloss-/);
  assert.doesNotMatch(read("src/themes/kisara/lib/layoutRuntime.js"), /刀光蓄势|blade:/);
  assert.doesNotMatch(read("src/themes/kisara/styles/theme.css"), /data-stage="blade"/);
  assert.equal(existsSync(new URL("../public/themes/kisara/assets/transformation-silhouette.webp", import.meta.url)), false);
  assert.match(home, /const activeTransformationUrl = findThemeAsset\("transformation-detail"\)/);
  assert.match(home, /data-pre-release-src=\{activeTransformationUrl \?\? activeBackgroundUrl/);
  assert.match(home, /enterEnd: 0\.51, leaveStart: 1, end: 1,[^\n]*persistent: true/);
  for (const name of ["transformation-detail.webp", "transformation-smoke-wide.webp", "fight.webp", "fight-distortion-protect.svg"]) {
    assert.ok(existsSync(new URL(`../public/themes/kisara/assets/${name}`, import.meta.url)));
  }
  assert.match(home, /introEnchant \* \(1 - phaseProgress\(intro, 0\.86, 1\)\)/);
  assert.match(home, /reducedMotion[^]*releaseMode = "complete"/);
  const reset = sourceBetween("resetGateState", "hasGateTitleVisualState");
  assert.match(reset, /burstProgress = 0/);
  assert.match(reset, /releaseMode = "manual"/);
});
