import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import {
  gateRelease, mapReleaseAutoplayProgress, getReconstructionProgress,
  getTransformationFrame, getGateSceneHandoff, getReconstructionRadii, transformationTimeline
} from "../src/themes/kisara/lib/gateRelease.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const home = read("src/themes/kisara/pages/HomePage.astro");
const sourceBetween = (name: string, next: string) => {
  const start = home.indexOf(`const ${name} =`);
  const end = home.indexOf(`const ${next} =`, start);
  assert.ok(start >= 0 && end > start, `production functions ${name}/${next}`);
  return home.slice(start, end);
};

test("the release is reconstruction only, with no empty lead-in or accelerated shot clock", () => {
  assert.equal(gateRelease.introDuration, 2150);
  assert.equal(gateRelease.duration, 610);
  assert.equal(gateRelease.introHandoff, 0.66);
  for (const p of [0, 0.01, 0.1, 0.5, 0.99, 1]) {
    const oldRecoveryEase = p * p * (3 - 2 * p);
    assert.ok(Math.abs(getReconstructionProgress(mapReleaseAutoplayProgress(p)) - oldRecoveryEase) < 1e-10);
  }
  assert.deepEqual(Object.keys(gateRelease.phases), ["start"]);
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
    releaseRewindCommitAt: gateRelease.rewindCommitAt,
    spaceLensRenderer: null, releaseUsesReconstruction: false, title: null,
    releaseWarmupState: { spaceLens: true }, releaseWarmupPending: { spaceLens: false },
    burstProgress: 0, targetBurstProgress: 0, burstVelocity: 0,
    heroAutoplayActive: false, heroAutoplayLastTimestamp: 0, heroAutoplayFillDuration: 4600,
    clamp, mapReleaseAutoplayProgress, gateRelease,
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
  state.scheduleReleaseWarmup = () => {};
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
  assert.equal(f.state.rail.stage, "reconstruction");
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
  f.state.releaseTimeline = 0.8;
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

test("reversing an unfinished heart never starts reconstruction", () => {
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
  assert.doesNotMatch(home, /data-pre-release-src|data-base-src|activeTransformationUrl/);
  for (const name of ["transformation-detail.webp", "transformation-smoke-wide.webp", "fight.webp", "fight-distortion-protect.svg"]) {
    assert.ok(existsSync(new URL(`../public/themes/kisara/assets/${name}`, import.meta.url)));
  }
  assert.match(home, /introEnchant \* \(1 - phaseProgress\(intro, 0\.86, 1\)\)/);
  assert.match(home, /reducedMotion[^]*releaseMode = "complete"/);
  const reset = sourceBetween("resetGateState", "hasGateTitleVisualState");
  assert.match(reset, /burstProgress = 0/);
  assert.match(reset, /releaseMode = "manual"/);
  assert.match(reset, /releaseUsesReconstruction = false/);
});

test("both close-ups retain c4fd2f4 shot cues and focus instead of extending the detail shot", () => {
  assert.deepEqual(transformationTimeline, [
    { start: 0.025, enterEnd: 0.18, leaveStart: 0.34, end: 0.52, drift: -15, lift: -3 },
    { start: 0.35, enterEnd: 0.51, leaveStart: 0.63, end: 0.79, drift: 18, lift: -2 }
  ]);
  assert.equal(getTransformationFrame(1, 0.35)!.opacity, 0);
  assert.equal(getTransformationFrame(1, 0.51)!.opacity, 0.995);
  assert.equal(getTransformationFrame(0, 0.52)!.opacity, 0);
  assert.deepEqual(getTransformationFrame(1, 0.66), getTransformationFrame(1, 0.99));
  const middle = getTransformationFrame(1, (0.35 + 0.79) / 2, 0, 0, true)!;
  assert.ok(Math.abs(middle.blur - 0.35) < 1e-10);
  assert.ok(Math.abs(middle.scale - (1.072 - 0.034 + 0.5 * 0.005)) < 1e-10);
  assert.match(home, /const transitionEase = smootherstep\(transitionProgress\)/);
});

test("the original diffusion wash reaches every corner and retains full source brightness", () => {
  for (const [width, height] of [[1920, 1080], [390, 844], [2560, 1080]]) {
    const x = width * 0.5;
    const y = height * 0.48;
    let previous = 0;
    for (let i = 0; i <= 100; i++) {
      const wash = getReconstructionRadii(i / 100, width, height, x, y);
      assert.ok(wash.outer >= previous);
      previous = wash.outer;
    }
    const wash = getReconstructionRadii(1, width, height, x, y);
    assert.equal(wash.opacity, 1);
    for (const [cornerX, cornerY] of [[0, 0], [width, 0], [0, height], [width, height]]) {
      assert.ok(wash.inner > Math.hypot(cornerX - x, cornerY - y));
    }
  }
  const css = read("src/themes/kisara/styles/home.css");
  assert.match(css, /\.kisara-gate-background-fight-wash \{[^}]*z-index: 40;[^}]*filter: none;/);
  assert.match(css, /is-burst-complete \.kisara-gate-background-fight-wash \{[^}]*mask-image: none/);
  const shader = read("src/themes/kisara/lib/gateReconstruction.ts");
  assert.match(shader, /vec3\(0\.26, 0\.035, 0\.12\)/);
  assert.match(shader, /vec3\(0\.075, 0\.13, 0\.28\)/);
  assert.doesNotMatch(shader, /luminance|mix\(0\.58, 0\.34/);
});

test("the release takes over at the original third-shot cue, not after a stretched intro tail", () => {
  const f = fixture();
  f.api.startChargeIntro(1000);
  for (const elapsed of [300, 600, 900, 1100]) {
    f.step(1000 + elapsed);
    assert.ok(Math.abs(f.state.chargeIntroProgress - f.state.smootherstep(elapsed / 2150)) < 1e-10);
    assert.equal(f.state.releaseMode, "manual");
  }
  let time = 2100;
  while (f.state.releaseMode === "manual") f.step(time += 1000 / 60);
  assert.ok(time - 1000 < 1300);
  assert.equal(f.state.chargeIntroProgress, 0.66);
  assert.equal(f.state.chargeIntroComplete, true);
  assert.equal(f.state.releaseMode, "forward");
  assert.equal(f.state.rail.progress, 0.7);
  const end = getGateSceneHandoff(1);
  assert.equal(end.transformationReleaseOpacity, 0);
  assert.equal(end.fightVisible, 1);
  assert.ok(Math.abs(end.fightBrightness - 1.02) < 1e-10);
  assert.match(home, /!energyLoopActive \|\| reducedMotion \|\| burstComplete/);
});

test("renderer readiness is frozen for each run so late loads do not change the transition mid-shot", () => {
  const cold = fixture({ chargeIntroComplete: true, chargeIntroProgress: 1,
    spaceLensRenderer: {}, releaseWarmupState: { spaceLens: false } });
  cold.api.startReleaseAutoplay(1000);
  assert.equal(cold.state.releaseUsesReconstruction, false);
  cold.state.releaseWarmupState.spaceLens = true;
  cold.step(1100);
  assert.equal(cold.state.releaseUsesReconstruction, false);
  const ready = fixture({ chargeIntroComplete: true, chargeIntroProgress: 1, spaceLensRenderer: {} });
  ready.api.startReleaseAutoplay(1000);
  assert.equal(ready.state.releaseUsesReconstruction, true);
});

test("retired black-hole passes, prewarm work, and warning overlays cannot run", () => {
  assert.doesNotMatch(home, /drawScreenEnergy|paintSingularityField|createSpaceLensRenderer|crossStart|detonationStart|warmFullSizeBurstCanvas|kisara-title-cross|data-kisara-burst-canvas/);
  assert.doesNotMatch(read("src/themes/kisara/styles/home.css"), /--kisara-warning-|--kisara-cross-|\.kisara-title-cross \{/);
  assert.doesNotMatch(read("src/themes/kisara/lib/layoutRuntime.js"), /黑洞成形|引力塌缩|爆发预警/);
});

test("the production presentation resets diffusion, settles the final frame, and supplies finite shader inputs", () => {
  const styles = new Map<string, string>();
  const draws: Array<Record<string, number>> = [];
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const context: Record<string, any> = {
    energyProgress: 1, chargeIntroProgress: 0.66, burstProgress: 0,
    gate: { clientWidth: 1600, clientHeight: 900 }, meterShell: {},
    clamp, gateRelease, getReconstructionProgress, getReconstructionRadii,
    smootherstep: (value: number) => {
      const p = clamp(value, 0, 1);
      return p ** 3 * (p * (p * 6 - 15) + 10);
    },
    phaseProgress: (value: number, start: number, end: number) => {
      const p = clamp((value - start) / (end - start), 0, 1);
      return p * p * (3 - 2 * p);
    },
    quantizeRuntimeValue: (value: number) => value,
    readSceneBreathClock: () => 1,
    titleAbyssDomHandoffStart: 0.72, chargeHandoffStart: 0.015, chargeHandoffEnd: 0.18,
    reconstructionCenter: { x: 0.5, y: 0.48 }, releaseUsesReconstruction: true,
    postReleaseActive: false, titleLensRenderer: {}, postReleaseDataPhase: 0,
    titleLensCanvas: { clientWidth: 1200, clientHeight: 320 },
    setRuntimeStyle: (_element: unknown, key: string, value: string) => styles.set(key, value),
    drawSpaceLens: (_time: number, parameters: Record<string, number>) => draws.push(parameters),
    drawTitleLens: (_time: number, parameters: Record<string, number>) => draws.push(parameters)
  };
  const update = vm.runInNewContext(sourceBetween("updateGatePresentation", "updateGlitchState")
    + "\nupdateGatePresentation;", context);
  for (const progress of [0, 0.01, 0.2, 0.5, 0.9, 1]) {
    context.burstProgress = mapReleaseAutoplayProgress(progress);
    update(1000 + progress * 610, false);
    for (const parameters of draws.splice(0)) {
      for (const value of Object.values(parameters)) assert.ok(Number.isFinite(value));
    }
  }
  assert.equal(styles.get("--kisara-reconstruction-wash-opacity"), "1.000");
  assert.equal(styles.get("--kisara-scene-camera-scale"), "1.00000");
  context.burstProgress = 0;
  context.chargeIntroProgress = 0;
  update(3000, false);
  assert.equal(styles.get("--kisara-reconstruction-wash-opacity"), "0.000");
});
