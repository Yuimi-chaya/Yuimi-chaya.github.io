import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import {
  gateRelease, mapChargeIntroProgress, getChargeIntroClock,
  mapReleaseAutoplayProgress, getReconstructionProgress, getTitleReconstructionFrame, getTitleContractFrame,
  getTransformationFrame, getGateSceneHandoff, getReconstructionRadii, transformationTimeline
} from "../src/themes/kisara/lib/gateRelease.ts";
import { memoryScenes, transformationScenes, memoryFillDuration, getMemoryFrame, getMemoryBlackout, advanceMemoryProgress, advanceMemoryBlackout } from "../src/themes/kisara/lib/gateStory.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const home = read("src/themes/kisara/pages/HomePage.astro");
const sourceBetween = (name: string, next: string) => {
  const start = home.indexOf(`const ${name} =`);
  const end = home.indexOf(`const ${next} =`, start);
  assert.ok(start >= 0 && end > start, `production functions ${name}/${next}`);
  return home.slice(start, end);
};

test("the release is reconstruction only, with no empty lead-in or accelerated shot clock", () => {
  assert.equal(gateRelease.introDuration, 1280);
  assert.equal(gateRelease.duration, 800);
  assert.equal(gateRelease.introHandoff, 0.86);
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

test("seeking an intro recovers the original shot clock without re-easing its remaining range", () => {
  for (let index = 0; index <= 1000; index++) {
    const progress = index / 1000;
    assert.ok(Math.abs(mapChargeIntroProgress(getChargeIntroClock(progress)) - progress) < 3e-10);
  }
  assert.equal(getChargeIntroClock(0), 0);
  assert.equal(getChargeIntroClock(1), 1);
  assert.equal(getChargeIntroClock(NaN), 0);
  assert.equal(getChargeIntroClock(-1), 0);
  assert.equal(getChargeIntroClock(2), 1);
  const handoffMs = getChargeIntroClock(gateRelease.introHandoff) * gateRelease.introDuration;
  assert.ok(handoffMs > 900 && handoffMs < 950);
});

function fixture(overrides: Record<string, unknown> = {}) {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const classes = new Set<string>();
  const state: Record<string, any> = {
    disposed: false, lovebrainActive: false, pageMode: "gate",
    gate: { isConnected: true, classList: { add: (name: string) => classes.add(name), remove: (name: string) => classes.delete(name) } },
    classes, comicTransition: { active: false }, chapterTransition: { active: false }, foundSelfActive: false,
    scrollFrame: 0, scrollTransitionDirection: "idle", gateReturnGuardUntil: 0, reducedMotion: false,
    postReleaseActive: false, postReleaseDataPhase: 2.3, postReleaseDataPressure: .4, postReleaseFlowWhip: .2,
    postReleaseDirection: -1, postReleaseDataPosition: 68, postReleaseMaxX: 14,
    postReleaseX: 9, postReleaseY: -2, postReleaseStartedAt: 100,
    releaseReturnPose: null, postReleaseParticles: [],
    mobileFrameInterval: 0, lastAnimationPaintTimestamp: 0, animationFrame: 0, lastFrameTime: 0,
    progress: 1, targetProgress: 1, velocity: 0, springStrength: 0.06, damping: 0.76, settleDistance: 0.00035,
    memoryBlackoutOpacity: 0, memoryBlackoutTimestamp: 0, advanceMemoryProgress, advanceMemoryBlackout,
    chargeIntroProgress: 0, chargeIntroActive: false, chargeIntroComplete: false, chargeIntroReversing: false,
    chargeIntroLastTimestamp: 0, chargeIntroClock: 0, chargeIntroTargetClock: 1, chargeIntroTarget: 1,
    chargeIntroDuration: gateRelease.introDuration, energyProgress: 1, fillDistance: 2100,
    releaseMode: "manual", releaseTimeline: 0, releaseDuration: gateRelease.duration,
    releaseAutoplayDuration: gateRelease.duration, releaseLastTimestamp: 0,
    releasePlaybackRate: 1, releaseBoost: 0, releaseVisualPressure: 0,
    releaseRewindVeil: 0, releaseRewindDuration: 0, releaseRewindFromTimeline: 0, releaseRewindElapsed: 0,
    spaceLensRenderer: null, releaseUsesReconstruction: false, releaseUsesSmokeCarrier: true, title: null,
    sceneImageWarmers: new Map([["transformation-2", { status: "ready" }]]),
    releaseWarmupState: { spaceLens: true }, releaseWarmupPending: { spaceLens: false },
    burstProgress: 0, targetBurstProgress: 0, burstVelocity: 0,
    heroAutoplayActive: false, heroAutoplayLastTimestamp: 0, heroAutoplayFillDuration: memoryFillDuration,
    clamp, mapChargeIntroProgress, getChargeIntroClock,
    mapReleaseAutoplayProgress, gateRelease, getTransformationFrame, getGateSceneHandoff,
    getReconstructionProgress, getMemoryFrame, getMemoryBlackout, isStoryFrameReady: () => true, areIntroImagesReady: () => true,
    memorySceneRecords: memoryScenes.map((scene, index) => ({
      ...scene, id: `memory-${scene.id}`, kind: "memory", order: index
    })),
    transformationSceneRecords: transformationScenes.map((_, index) => ({
      id: `transformation-${index}`, kind: "transformation", order: index + memoryScenes.length, image: `transformation-${index}.webp`
    })),
    smoothstep: (value: number) => value * value * (3 - 2 * value),
    smootherstep: (value: number) => {
      const p = clamp(value, 0, 1);
      return p ** 3 * (p * (p * 6 - 15) + 10);
    },
    now: 1000, requested: 0, cleared: 0, rendered: 0, rail: null, effects: [], nextPageEntries: 0,
    ...overrides
  };
  state.window = { requestAnimationFrame: () => ++state.requested, scrollY: 0 };
  state.performance = { now: () => state.now };
  state.phaseProgress = (value: number, start: number, end: number) =>
    state.smoothstep(clamp((value - start) / (end - start), 0, 1));
  state.setRuntimeStyle = () => {};
  state.syncSceneSlots = (presentations: unknown) => { state.presentations = presentations; return true; };
  state.startAnimation = () => { state.requested++; };
  state.scheduleReleaseWarmup = () => {};
  state.clearReleaseTransientEffects = () => { state.cleared++; state.effects.push("clear"); };
  state.setPostReleaseActive = (active: boolean, preserve: boolean) => {
    state.postReleaseActive = active;
    state.effects.push(`post:${active}:${Boolean(preserve)}`);
  };
  state.stopPostReleaseAnimation = (reset: boolean) => {
    if (reset) { state.releaseReturnPose = null; classes.delete("is-release-return"); }
    state.effects.push(`stop:${reset}`);
  };
  state.updateGatePresentation = () => state.effects.push("present");
  state.shapeGateWheelDelta = (delta: number) => delta;
  state.enterNextPage = () => { state.nextPageEntries++; state.pageMode = "next"; };
  state.stopHeroAutoplay = () => { state.heroAutoplayActive = false; state.heroAutoplayLastTimestamp = 0; };
  state.publishGateRailState = (rail: unknown) => { state.rail = rail; };
  state.render = () => {
    state.rendered++;
    state.effects.push("render");
    api.syncMemorySequence(state.progress);
    api.syncGateProgressRail(state.progress, state.releaseMode === "complete", "inner-bind");
  };
  const functions = [
    ["computeSceneHandoff", "syncMemorySequence"],
    ["syncMemorySequence", "pointOnQuinticCurve"],
    ["transitionChargeIntro", "startChargeIntro"],
    ["startChargeIntro", "clearReleaseTransientEffects"],
    ["startReleaseAutoplay", "startReleaseRewind"],
    ["startReleaseRewind", "handleReleaseInput"],
    ["handleReleaseInput", "syncHeroAutoplayControl"],
    ["advanceHeroAutoplay", "startHeroAutoplay"],
    ["animate", "startAnimation"],
    ["addProgress", "isFillComplete"],
    ["syncGateProgressRail", "render"],
    ["readPostReleaseTitlePose", "drawPostReleaseTitleLens"],
    ["isFillComplete", "isComplete"],
    ["isComplete", "shouldCaptureGate"],
    ["shouldCaptureGate", "normalizeWheel"]
  ];
  const inputStart = home.indexOf("const handleDirectionalInput =");
  const inputEnd = home.indexOf('window.addEventListener("wheel"', inputStart);
  assert.ok(inputStart > 0 && inputEnd > inputStart);
  const api = vm.runInNewContext(
    functions.map(([name, next]) => sourceBetween(name, next)).join("\n")
      + "\n" + home.slice(inputStart, inputEnd)
      + `\n({ ${functions.map(([name]) => name).join(", ")}, handleDirectionalInput });`,
    state
  );
  return {
    state, api,
    step(timestamp: number) { state.now = timestamp; api.animate(timestamp); },
    advance(duration: number, interval = 1000 / 60) {
      const end = state.now + duration;
      while (state.now < end) {
        state.now = Math.min(end, state.now + interval);
        api.animate(state.now);
      }
    },
    until(mode: string, interval = 1000 / 60) {
      let attempts = 0;
      while (state.releaseMode !== mode && attempts++ < 250) {
        state.now += interval;
        api.animate(state.now);
      }
      assert.equal(state.releaseMode, mode, `Timed out waiting for ${mode}`);
    },
    input(delta: number, inputType = "wheel") {
      let prevented = 0;
      api.handleDirectionalInput(delta, { preventDefault() { prevented++; } }, inputType);
      return prevented;
    }
  };
}

function attachSceneCompositor(f: ReturnType<typeof fixture>) {
  class SceneElement {
    dataset: Record<string, string> = {};
    style: Record<string, any> = {
      setProperty(name: string, value: string) { this[name] = value; }
    };
  }
  const slots = Array.from({ length: 2 }, (_, index) => ({
    element: new SceneElement(), index, sceneId: "", rendered: Object.create(null)
  }));
  const context = {
    HTMLElement: SceneElement, sceneSlotRecords: slots, sceneSlotOverflowWarned: false,
    mobilePerformance: false, litePerformance: false, sceneImageWarmers: new Map(),
    isSceneImageReady: () => true, quantizeRuntimeValue: (value: number) => value,
    console: { warn() { assert.fail("Shot sequence exceeded the two-slot compositor capacity"); } }
  };
  const sync = vm.runInNewContext(
    sourceBetween("setSceneSlotStyle", "bindSceneSlot")
      + sourceBetween("bindSceneSlot", "syncSceneSlots")
      + sourceBetween("syncSceneSlots", "computeSceneHandoff")
      + "\nsyncSceneSlots;",
    context
  );
  f.state.syncSceneSlots = (presentations: unknown) => {
    f.state.presentations = presentations;
    return sync(presentations);
  };
  return {
    contribution(id: string) {
      const ordered = slots.filter(slot => Number(slot.element.style.opacity) > .00005)
        .sort((a, b) => Number(b.element.style["z-index"]) - Number(a.element.style["z-index"]));
      let uncovered = 1;
      for (const slot of ordered) {
        const opacity = Number(slot.element.style.opacity);
        if (slot.sceneId === id) return opacity * uncovered;
        uncovered *= 1 - opacity;
      }
      return 0;
    },
    opacity(id: string) {
      const slot = slots.find((candidate) => candidate.sceneId === id);
      return Number(slot?.element.style.opacity || 0);
    },
    snapshot() {
      return slots.filter((slot) => Number(slot.element.style.opacity) > .00005)
        .map((slot) => ({ id: slot.sceneId, opacity: Number(slot.element.style.opacity) }));
    }
  };
}

test("finishing the heart automatically starts release in the same frame without wheel input", () => {
  const f = fixture();
  f.api.startChargeIntro(1000);
  f.until("forward");
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

test("release rewind continues into the shots without a paused checkpoint or another gesture", () => {
  const f = fixture({ chargeIntroComplete: true, chargeIntroProgress: gateRelease.introHandoff });
  f.api.startReleaseAutoplay(1000);
  f.state.releaseTimeline = 0.2;
  f.state.burstProgress = mapReleaseAutoplayProgress(0.2);
  assert.equal(f.api.handleReleaseInput(-120, 1200), true);
  assert.equal(f.state.releaseMode, "rewinding");
  f.state.now = 1200;
  f.until("manual");
  assert.equal(f.state.burstProgress, 0);
  assert.equal(f.state.targetBurstProgress, 0);
  assert.equal(f.state.chargeIntroTarget, 0);
  assert.equal(f.state.chargeIntroReversing, true);
  f.advance(gateRelease.introDuration);
  assert.equal(f.state.chargeIntroComplete, false);
  assert.equal(f.state.releaseMode, "manual");
  assert.equal(f.state.burstProgress, 0);
});

test("paused release resumes, and late reverse input now rewinds rather than fast-finishing", () => {
  const f = fixture({ chargeIntroComplete: true, chargeIntroProgress: 1, releaseMode: "paused",
    burstProgress: gateRelease.phases.start, targetBurstProgress: gateRelease.phases.start });
  assert.equal(f.api.handleReleaseInput(120, 1000), true);
  assert.equal(f.state.releaseMode, "forward");
  assert.equal(f.state.burstProgress, gateRelease.phases.start);
  f.state.releaseTimeline = 0.8;
  f.state.burstProgress = mapReleaseAutoplayProgress(.8);
  assert.equal(f.api.handleReleaseInput(-120, 1100), true);
  assert.equal(f.state.releaseMode, "rewinding");
  assert.equal(f.state.releasePlaybackRate, 1);
  assert.equal(f.state.releaseBoost, 0);
  assert.equal(f.state.releaseRewindFromTimeline, .8);
});

test("one upward gesture retraces the reconstruction carrier, both close-ups and settles on kiss", () => {
  for (const fps of [30, 60, 120]) {
    const f = fixture({ chargeIntroComplete: true, chargeIntroProgress: 1, releaseMode: "complete",
      releaseTimeline: 1, burstProgress: 1, targetBurstProgress: 1, postReleaseActive: true });
    assert.equal(f.input(-120), 1);
    assert.equal(f.state.releaseMode, "rewinding");
    assert.equal(f.state.burstProgress, 1, "The first frame keeps the final composition");
    assert.equal(f.state.chargeIntroProgress, gateRelease.introHandoff, "Reverse begins on the fully received smoke carrier");
    assert.equal(f.state.postReleaseActive, false);
    assert.equal(f.state.releaseReturnPose.liquidPhase, 2.3);
    assert.equal(f.state.releaseReturnPose.x, 9);
    assert.equal(f.state.classes.has("is-release-return"), true);
    assert.deepEqual(f.state.effects, ["post:false:true", "clear", "render", "present"]);
    let previous = 1;
    const visibleShots: number[] = [];
    for (let i = 0; i < fps * 3; i++) {
      f.step(f.state.now + 1000 / fps);
      assert.ok(f.state.burstProgress <= previous);
      previous = f.state.burstProgress;
      assert.notEqual(f.state.releaseMode, "paused");
      f.state.presentations.slice(9).forEach((scene: { opacity: number }, index: number) => {
        if (scene.opacity > .7 && !visibleShots.includes(index)) visibleShots.push(index);
      });
    }
    assert.deepEqual(visibleShots, [2, 1, 0], "The carrier belongs to reverse reconstruction, followed by both original shots");
    assert.equal(f.state.burstProgress, 0);
    assert.equal(f.state.releaseReturnPose, null);
    assert.equal(f.state.classes.has("is-release-return"), false);
    assert.equal(f.state.chargeIntroProgress, 0);
    assert.equal(f.state.chargeIntroActive, false);
    assert.equal(f.state.chargeIntroComplete, false);
    assert.equal(f.state.progress, .988);
    assert.equal(f.state.targetProgress, .988, "Kiss stays below the automatic replay threshold");
    assert.equal(f.state.presentations[8].opacity, 1);
    assert.ok(f.state.presentations.every((scene: { opacity: number }, index: number) => index === 8 || scene.opacity === 0));
    assert.equal(f.state.releaseMode, "manual");
    assert.equal(f.state.nextPageEntries, 0);
    f.step(f.state.now + 3000);
    assert.equal(f.state.chargeIntroActive, false, "Waiting on kiss must not restart the intro");
    assert.equal(f.state.presentations[8].opacity, 1);
    f.input(120);
    f.until("complete");
    assert.equal(f.input(120), 1);
    assert.equal(f.state.nextPageEntries, 1, "Kiss can replay forward, then enter 001");
  }
});

test("reversing direction during the close-up rewind resumes from that shot", () => {
  const f = fixture({ chargeIntroComplete: true, chargeIntroProgress: 1, releaseMode: "complete",
    releaseTimeline: 1, burstProgress: 1, targetBurstProgress: 1 });
  f.input(-120);
  f.until("manual");
  assert.equal(f.state.chargeIntroReversing, true);
  f.advance(160);
  const intro = f.state.chargeIntroProgress;
  assert.ok(intro > 0 && intro < gateRelease.introHandoff);
  const clock = f.state.chargeIntroClock;
  const lastTimestamp = f.state.chargeIntroLastTimestamp;
  f.state.now += 5;
  f.input(-120);
  assert.equal(f.state.chargeIntroLastTimestamp, lastTimestamp, "Repeated upward input cannot restart the shot clock");
  f.input(120);
  assert.ok(Math.abs(f.state.chargeIntroClock - clock) < 1e-9);
  assert.equal(f.state.chargeIntroProgress, intro, "Direction changes do not jump to a shot boundary");
  assert.equal(f.state.chargeIntroReversing, false);
  assert.equal(f.state.chargeIntroTarget, 1);
  f.until("complete");
  assert.equal(f.state.burstProgress, 1);
});

test("the actual two-slot compositor plays all three rapid shots on the same reversible clock", () => {
  for (const fps of [30, 60, 120]) {
    const interval = 1000 / fps;
    const forward = fixture();
    const forwardSlots = attachSceneCompositor(forward);
    forward.api.startChargeIntro(forward.state.now);
    const reverse = fixture({ chargeIntroComplete: true, chargeIntroProgress: 1, releaseMode: "complete",
      releaseTimeline: 1, burstProgress: 1, targetBurstProgress: 1 });
    const reverseSlots = attachSceneCompositor(reverse);
    reverse.input(-120);
    reverse.until("manual", interval);
    const handoffClock = getChargeIntroClock(gateRelease.introHandoff);
    const trace = (f: ReturnType<typeof fixture>, slots: ReturnType<typeof attachSceneCompositor>, backward: boolean) => {
      const visible = [0, 0, 0];
      const alphaIntegral = [0, 0, 0];
      const startedAt = f.state.now;
      while (f.state.chargeIntroActive && f.state.now - startedAt < 2600) {
        f.step(f.state.now + interval);
        const elapsed = f.state.now - startedAt;
        if (backward) {
          const mirrored = mapChargeIntroProgress(handoffClock - elapsed / gateRelease.introDuration);
          assert.ok(Math.abs(f.state.chargeIntroProgress - mirrored) < 1e-9);
        }
        for (let index = 0; index < 3; index++) {
          const opacity = slots.contribution(`transformation-${index}`);
          if (opacity > .7) visible[index] += interval;
          alphaIntegral[index] += opacity * interval;
          const active = f.state.presentations.filter((scene: { opacity: number }) => scene.opacity > .00005);
          const expected = f.state.presentations[index + 9].opacity / (active.length === 2
            ? active.reduce((sum: number, scene: { opacity: number }) => sum + scene.opacity, 0) : 1);
          assert.ok(Math.abs(opacity - expected) < .0002, "The visible contribution must follow the normalized dissolve");
        }
      }
      assert.equal(f.state.chargeIntroActive, false);
      return { visible, alphaIntegral };
    };
    const original = trace(forward, forwardSlots, false);
    const reversed = trace(reverse, reverseSlots, true);
    for (let index = 0; index < 3; index++) {
      assert.ok(Math.abs(original.visible[index] - reversed.visible[index]) <= interval * 2 + .001,
        `Shot ${index} must retain its original dwell at ${fps}Hz`);
      assert.ok(Math.abs(original.alphaIntegral[index] - reversed.alphaIntegral[index]) <= interval * 2,
        `Shot ${index} must retain its fade envelope at ${fps}Hz`);
    }
    assert.ok(reversed.visible[0] > 200 && reversed.visible[0] < 300, "Shot 10 is a quick, readable insert");
    assert.ok(reversed.visible[1] > 100 && reversed.visible[1] < 230, "Shot 11 follows promptly");
    assert.ok(reversed.visible[2] >= 100 && reversed.visible[2] < 220, "Shot 12 is visible before diffusion");
    assert.deepEqual(reverseSlots.snapshot(), [{ id: "memory-kiss", opacity: 1 }]);
  }
});

test("delayed intro frames cannot skip smoke shots in forward or reverse playback", () => {
  const f = fixture();
  f.api.startChargeIntro(f.state.now);
  f.step(f.state.now + 4000);
  assert.ok(Math.abs(f.state.chargeIntroClock - 50 / gateRelease.introDuration) < 1e-10);
  f.until("forward");
  f.input(-120);
  f.until("manual");
  const before = f.state.chargeIntroClock;
  f.step(f.state.now + 60000);
  assert.ok(Math.abs(f.state.chargeIntroClock - (before - 50 / gateRelease.introDuration)) < 1e-10);
  assert.equal(f.state.chargeIntroReversing, true);
  assert.ok(f.state.chargeIntroProgress > .5, "A delayed frame must not jump from detail straight to kiss");
  f.advance(2200);
  assert.equal(f.state.chargeIntroProgress, 0);
});

test("fast scrolling to the end waits for the kiss to brighten before starting the smoke clock", () => {
  for (const fps of [30, 60, 120]) {
    const f = fixture({ memoryBlackoutOpacity: 1, memoryBlackoutTimestamp: 1000 });
    attachSceneCompositor(f);
    f.api.startChargeIntro(f.state.now);
    assert.equal(f.state.chargeIntroActive, false);
    const start = f.state.now;
    while (!f.state.chargeIntroActive && f.state.now - start < 1000) {
      f.step(f.state.now + 1000 / fps);
      if (f.state.memoryBlackoutOpacity > .001) {
        assert.equal(f.state.chargeIntroProgress, 0);
        assert.equal(f.state.presentations[8].opacity, 1);
      }
    }
    assert.equal(f.state.chargeIntroActive, true);
    assert.ok(f.state.now - start >= 650 - .01);
    assert.equal(f.state.chargeIntroClock, 0);
  }
});

test("opposite input resumes exactly where the reverse stopped; repeated gestures do not restart clocks", () => {
  const f = fixture({ chargeIntroComplete: true, chargeIntroProgress: 1, releaseMode: "complete",
    releaseTimeline: 1, burstProgress: 1, targetBurstProgress: 1 });
  f.input(-120);
  f.step(1050);
  f.step(1100);
  const current = f.state.releaseTimeline;
  const burst = f.state.burstProgress;
  const elapsed = f.state.releaseRewindElapsed;
  f.input(-120);
  assert.equal(f.state.releaseRewindElapsed, elapsed);
  f.input(120);
  assert.equal(f.state.releaseMode, "forward");
  assert.equal(f.state.releaseTimeline, current);
  assert.equal(f.state.burstProgress, burst);
  f.step(1120);
  assert.ok(f.state.releaseTimeline > current);
  f.input(-120);
  assert.equal(f.state.releaseMode, "rewinding");
  f.input(120);
  f.until("complete");
  assert.equal(f.state.burstProgress, 1);
  assert.equal(f.input(120), 1);
  assert.equal(f.state.nextPageEntries, 1, "Forward input still enters 001 only after final completion");
});

test("small wheel input, normalized touch/keyboard, reduced motion and long reverse frames remain usable", () => {
  for (const inputType of ["wheel", "touch", "keyboard"]) {
    const f = fixture({ chargeIntroComplete: true, chargeIntroProgress: 1, releaseMode: "complete",
      releaseTimeline: 1, burstProgress: 1, targetBurstProgress: 1, reducedMotion: true });
    assert.equal(f.input(-.5, inputType), 1);
    assert.equal(f.state.releaseRewindDuration, 180);
    f.step(61000);
    assert.equal(f.state.releaseRewindElapsed, 50, "A delayed frame cannot skip the whole reverse");
    assert.equal(f.state.releaseMode, "rewinding");
    f.until("manual");
    assert.equal(f.state.chargeIntroReversing, true);
    f.advance(180);
    assert.equal(f.state.chargeIntroProgress, 0);
    assert.equal(f.state.chargeIntroActive, false);
    assert.equal(f.state.presentations[8].opacity, 1);
  }
  const blocked = fixture({ chargeIntroComplete: true, chargeIntroProgress: 1, releaseMode: "complete",
    releaseTimeline: 1, burstProgress: 1, targetBurstProgress: 1, comicTransition: { active: true } });
  assert.equal(blocked.input(-120), 1);
  assert.equal(blocked.state.releaseMode, "complete", "Comic transition keeps input ownership");
});

test("AUTO waits for media but the prepared 10 to 11 pair never pauses its running clock", () => {
  const f = fixture({ progress: .33, targetProgress: .33, heroAutoplayActive: true, isStoryFrameReady: () => false });
  f.api.advanceHeroAutoplay(1100);
  f.api.advanceHeroAutoplay(2100);
  assert.equal(f.state.targetProgress, .33);
  f.state.isStoryFrameReady = () => true;
  f.api.advanceHeroAutoplay(2116);
  assert.ok(Math.abs(f.state.targetProgress - (.33 + 16 / memoryFillDuration)) < 1e-10);
  const intro = fixture({ areIntroImagesReady: () => false, isStoryFrameReady: () => false });
  intro.api.startChargeIntro(intro.state.now);
  assert.equal(intro.state.chargeIntroActive, false);
  intro.advance(900);
  assert.equal(intro.state.chargeIntroClock, 0);
  intro.state.areIntroImagesReady = () => true;
  intro.step(intro.state.now + 16);
  assert.equal(intro.state.chargeIntroActive, true);
  assert.equal(intro.state.chargeIntroClock, 0);
  intro.state.areIntroImagesReady = () => false;
  intro.step(intro.state.now + 16);
  assert.ok(Math.abs(intro.state.chargeIntroClock - 16 / gateRelease.introDuration) < 1e-10);
});

test("the carrier choice is frozen before the three-shot playback and stays fixed through reconstruction", () => {
  const f = fixture();
  const media = f.state.sceneImageWarmers.get("transformation-2");
  media.status = "timed-out";
  f.api.startChargeIntro(f.state.now);
  assert.equal(f.state.releaseUsesSmokeCarrier, false);
  media.status = "ready";
  f.until("forward");
  f.state.burstProgress = mapReleaseAutoplayProgress(.2);
  f.state.render();
  assert.equal(f.state.presentations[11].opacity, 0);
  assert.ok(f.state.presentations[10].opacity > 0);
  f.state.releaseMode = "manual";
  f.state.chargeIntroComplete = false;
  f.state.chargeIntroActive = false;
  f.state.chargeIntroProgress = 0;
  f.api.startChargeIntro(f.state.now);
  assert.equal(f.state.releaseUsesSmokeCarrier, true);
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
  const f = fixture({ chargeIntroActive: true, chargeIntroProgress: 0.6,
    chargeIntroTarget: 1, chargeIntroLastTimestamp: 500 });
  f.api.addProgress(-120);
  assert.equal(f.state.chargeIntroTarget, 0);
  f.advance(gateRelease.introDuration);
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

test("restoring the smoke silhouette does not restore the retired blade state machine", () => {
  assert.doesNotMatch(home, /glossFadeEnd|kisara-title-gloss|bladeWheelGain|heroAutoplayBladeDuration|burstSpringStrength|silhouette/);
  assert.doesNotMatch(read("src/themes/kisara/styles/home.css"), /kisara-title-gloss|kisara-gloss-/);
  assert.doesNotMatch(read("src/themes/kisara/lib/layoutRuntime.js"), /刀光蓄势|blade:/);
  assert.doesNotMatch(read("src/themes/kisara/styles/theme.css"), /data-stage="blade"/);
  assert.equal(existsSync(new URL("../public/themes/kisara/assets/transformation-silhouette.webp", import.meta.url)), true);
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

test("both original smoke cues stay fast and the silhouette receives the edit before reconstruction", () => {
  assert.deepEqual(transformationTimeline, [
    { start: 0.025, enterEnd: 0.18, leaveStart: 0.34, end: 0.52, drift: -15, lift: -3 },
    { start: 0.35, enterEnd: 0.51, leaveStart: 0.63, end: 0.79, drift: 18, lift: -2 },
    { start: 0.63, enterEnd: 0.79, leaveStart: 1, end: 1, drift: 0, lift: 0 }
  ]);
  assert.equal(getTransformationFrame(1, 0.35)!.opacity, 0);
  assert.equal(getTransformationFrame(1, 0.51)!.opacity, 1);
  assert.equal(getTransformationFrame(0, 0.52)!.opacity, 0);
  assert.equal(getTransformationFrame(2, 0.63)!.opacity, 0);
  assert.equal(getTransformationFrame(2, 0.79)!.opacity, 1);
  assert.deepEqual(getTransformationFrame(2, 0.86), getTransformationFrame(2, 0.99));
  assert.equal(getTransformationFrame(1, 0.79)!.opacity, 0);
  assert.equal(getTransformationFrame(2, 0.86, 0, 0, false, false)!.opacity, 0);
  assert.equal(getTransformationFrame(1, 0.86, 0, 0, false, false)!.opacity, 1);
  const middle = getTransformationFrame(1, 0.4, 0, 0, true)!;
  assert.equal(middle.blur, 0);
  assert.equal(middle.scale, 1.02);
  assert.equal(middle.shiftX, 0);
  assert.equal(middle.shiftY, 0);
  assert.match(sourceBetween("animate", "startAnimation"), /chargeIntroProgress = mapChargeIntroProgress\(chargeIntroClock\)/);
  assert.doesNotMatch(sourceBetween("transitionChargeIntro", "startChargeIntro"), /820|smootherstep/);
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

test("shots 10 to 12 autoplay completely before center-out reconstruction", () => {
  const f = fixture();
  f.api.startChargeIntro(1000);
  for (const elapsed of [200, 400, 600, 700]) {
    f.advance(1000 + elapsed - f.state.now);
    assert.ok(Math.abs(f.state.chargeIntroProgress - f.state.smootherstep(elapsed / gateRelease.introDuration)) < 1e-10);
    assert.equal(f.state.releaseMode, "manual");
  }
  let time = 1700;
  while (f.state.releaseMode === "manual") f.step(time += 1000 / 60);
  assert.ok(time - 1000 > 900 && time - 1000 < 970);
  assert.equal(f.state.chargeIntroProgress, 0.86);
  assert.equal(f.state.chargeIntroComplete, true);
  assert.equal(f.state.releaseMode, "forward");
  assert.equal(f.state.rail.progress, 0.7);
  assert.equal(f.state.presentations[11].opacity, 1);
  assert.deepEqual({ ...f.state.reconstructionCenter }, { x: .5, y: .5 });
  for (const p of [.1, .4, .8, .99]) {
    assert.equal(getGateSceneHandoff(p).transformationReleaseOpacity, 1, "The smoke outside the diffusion front must not globally fade");
    assert.equal(getGateSceneHandoff(p).fightVisible, 0, "The final scene must only enter through the expanding wash");
  }
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

function presentationFixture() {
  const styles = new Map<string, string>();
  const draws: Array<Record<string, number>> = [];
  const effects: string[] = [];
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const context: Record<string, any> = {
    energyProgress: 1, chargeIntroProgress: 0.66, burstProgress: 0,
    gate: { clientWidth: 1600, clientHeight: 900 }, meterShell: {},
    clamp, gateRelease, getReconstructionProgress, getReconstructionRadii, getTitleReconstructionFrame, getTitleContractFrame,
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
    postReleaseActive: false, titleLensRenderer: {}, postReleaseDataPhase: 0, releaseReturnPose: null,
    drawTitleAbyss() { effects.push("abyss"); }, postReleaseParticles: [{ age: .1 }],
    clearPostReleaseCanvas() { effects.push("clear-post"); },
    titleLensCanvas: { clientWidth: 1200, clientHeight: 320 },
    setRuntimeStyle: (_element: unknown, key: string, value: string) => styles.set(key, value),
    drawSpaceLens: (_time: number, parameters: Record<string, number>) => draws.push(parameters),
    drawTitleLens: (_time: number, parameters: Record<string, number>) => { effects.push("lens"); draws.push(parameters); }
  };
  const update = vm.runInNewContext(sourceBetween("updateGatePresentation", "updateGlitchState")
    + "\nupdateGatePresentation;", context);
  return { context, styles, draws, update, effects };
}

test("the production presentation resets diffusion, settles the final frame, and supplies finite shader inputs", () => {
  const { context, styles, draws, update } = presentationFixture();
  for (const progress of [0, 0.01, 0.2, 0.5, 0.9, 1]) {
    context.burstProgress = mapReleaseAutoplayProgress(progress);
    update(1000 + progress * gateRelease.duration, false);
    const titleFrame = getTitleReconstructionFrame(getReconstructionProgress(context.burstProgress));
    for (const key of Object.keys(titleFrame) as (keyof typeof titleFrame)[]) {
      assert.equal(draws.at(-1)![key], titleFrame[key], `Production title handoff must use ${key}`);
    }
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
  context.burstProgress = gateRelease.phases.start + .3 * (1 - gateRelease.phases.start);
  context.releaseUsesReconstruction = true;
  update(3200, false);
  const gpuRadius = Number.parseFloat(styles.get("--kisara-reconstruction-outer-radius")!);
  context.releaseUsesReconstruction = false;
  update(3300, false);
  const fallbackRadius = Number.parseFloat(styles.get("--kisara-reconstruction-outer-radius")!);
  assert.equal(gpuRadius, fallbackRadius, "The clean wash follows the historical radial clock without the later packet delay");
  const expected = getReconstructionRadii(.3, 1600, 900, 800, 900 * .48);
  assert.ok(Math.abs(fallbackRadius - expected.outer) < .001, "No GPU keeps the original bright diffusion fallback");
});

test("production title presentation follows the heart clock and crosses both handoffs without reappearing", () => {
  const { context, draws, update } = presentationFixture();
  for (const intro of [0, .14, .2, .25, .34, .39, .47, .56, .66, .78, .86, .78, .66, .56, .25, .14, 0]) {
    context.burstProgress = 0;
    context.chargeIntroProgress = intro;
    update(1000 + intro * 1280, false);
    const expected = getTitleContractFrame(intro);
    for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
      assert.equal(draws.at(-1)![key], expected[key], `${intro}: ${key}`);
    }
  }
  context.chargeIntroProgress = gateRelease.introHandoff;
  context.burstProgress = 0;
  update(2000, false);
  const before = draws.at(-1)!;
  context.burstProgress = gateRelease.phases.start;
  update(2017, false);
  const after = draws.at(-1)!;
  for (const key of ["opacity", "sourceOpacity", "fallbackOpacity", "dissolve", "finalFlow", "contractCharge", "contractSweep"]) {
    assert.equal(before[key], after[key], `Intro/reconstruction must agree on ${key}`);
  }
  assert.equal(after.dissolve, 1);
  assert.equal(after.sourceOpacity, 0);
});

test("reverse rendering takes over the exact liquid pose, eases parallax and never resurrects frozen particles", () => {
  const { context, styles, draws, update, effects } = presentationFixture();
  context.releaseReturnPose = {
    liquidPhase: 7.4, liquidPressure: 1.1, flowFront: .85, flowDirection: 1, parallax: -.6,
    x: -8.4, y: 3, opacity: .8
  };
  context.burstProgress = 1;
  update(1000, false);
  const first = draws.at(-1)!;
  for (const key of ["liquidPhase", "liquidPressure", "flowFront", "flowDirection", "parallax"]) {
    assert.equal(first[key], context.releaseReturnPose[key], `Incoming liquid must preserve ${key}`);
  }
  assert.equal(first.sourceOpacity, 0);
  assert.equal(first.dissolve, 0);
  assert.equal(styles.get("--kisara-post-parallax-x"), "-8.400px");
  assert.equal(styles.get("--kisara-post-release-opacity"), "0.800");
  let previousX = 8.4;
  for (const p of [.98, .9, .85, .78, .68, .5, .2, 0]) {
    context.burstProgress = gateRelease.phases.start + p * (1 - gateRelease.phases.start);
    update(1000 + (1 - p) * 560, false);
    const x = Math.abs(Number.parseFloat(styles.get("--kisara-post-parallax-x")!));
    assert.ok(x <= previousX);
    previousX = x;
  }
  assert.equal(previousX, 0);
  assert.equal(context.postReleaseParticles.length, 0);
  assert.equal(effects.filter(effect => effect === "clear-post").length, 1);
  assert.equal(effects.at(-1), "lens", "The erased title remains under the same GPU owner at the reverse handoff");
  context.burstProgress = .95;
  update(1800, false);
  assert.equal(styles.get("--kisara-post-release-opacity"), "0.000", "Reversing again cannot flash old particles");
  assert.equal(effects.filter(effect => effect === "clear-post").length, 1);
  const abyss = sourceBetween("drawTitleAbyss", "updateGatePresentation");
  assert.match(abyss, /getTitleReconstructionFrame\(getReconstructionProgress\(burstProgress\)\)\.sourceOpacity <= \.001/);
});

test("post-release suspension preserves buffers and phase, while ordinary exits and reset still clear them", () => {
  const styles = new Map<string, string>();
  const effects: string[] = [];
  const classes = new Set(["is-post-release", "is-release-return"]);
  const state: Record<string, any> = {
    postReleaseActive: true, postReleaseFrame: 7, postReleaseLastTimestamp: 1000,
    postReleaseX: 9, postReleaseY: -2, postReleaseDataPhase: 3.2, postReleaseDataPressure: .7,
    postReleaseDataPosition: 71, postReleaseStartedAt: 400, postReleasePointerX: 750,
    postReleaseFlowWhip: .2, postReleaseDirection: -1, postReleaseJourney: {},
    postReleaseParticles: [{ x: 10 }], postReleaseFlowAngles: [1, 2], postReleaseFlowAngularVelocities: [1, 1],
    postReleaseInitialFlowAngle: 0, releaseReturnPose: { liquidPhase: 3.2 },
    orientationSupported: false, orientationPermissionRequired: false, orientationUserDisabled: false,
    gate: {
      style: { setProperty: (key: string, value: string) => styles.set(key, value) },
      classList: {
        toggle(name: string, active: boolean) { if (active) classes.add(name); else classes.delete(name); },
        remove(name: string) { classes.delete(name); }
      }
    },
    window: { cancelAnimationFrame: (id: number) => effects.push(`cancel:${id}`) },
    performance: { now: () => 1500 },
    titleLensRenderer: { clear: () => effects.push("clear-lens") },
    clearTitleDataCanvas: () => effects.push("clear-data"),
    clearPostReleaseCanvas: () => effects.push("clear-post"),
    resizePostReleaseCanvas: (force: boolean) => effects.push(`resize:${force}`),
    setOrientationEnabled() {}, updateMotionToggle() {},
    startPostReleaseAnimation: () => { effects.push("start-post"); state.postReleaseFrame = 8; }
  };
  const api = vm.runInNewContext(sourceBetween("stopPostReleaseAnimation", "beginPostReleaseJourney")
    + "; ({ setPostReleaseActive, stopPostReleaseAnimation });", state);
  api.setPostReleaseActive(false, true);
  assert.deepEqual(effects, ["cancel:7"]);
  assert.equal(styles.has("--kisara-title-source-opacity"), false, "Suspending cannot expose source lettering");
  assert.equal(state.postReleaseDataPhase, 3.2);
  assert.equal(state.postReleaseX, 9);
  assert.equal(state.postReleaseParticles.length, 1);
  api.setPostReleaseActive(true);
  assert.ok(effects.includes("resize:false"), "Resuming cannot resize-clear the existing frozen frame");
  assert.equal(state.postReleaseDataPhase, 3.2);
  assert.equal(state.postReleaseDataPressure, .7);
  assert.equal(state.postReleaseDataPosition, 71);
  assert.equal(state.postReleaseStartedAt, 400);
  assert.equal(state.postReleaseTargetX, 9);
  assert.equal(state.releaseReturnPose, null);
  assert.equal(classes.has("is-release-return"), false);
  api.setPostReleaseActive(false);
  assert.equal(state.postReleaseFrame, 0);
  assert.equal(state.postReleaseParticles.length, 0);
  assert.equal(state.postReleaseDataPhase, 0);
  assert.equal(state.postReleaseX, 0);
  assert.equal(styles.get("--kisara-title-source-opacity"), "1");
  assert.equal(styles.get("--kisara-post-release-opacity"), "0");
  assert.ok(effects.includes("clear-lens") && effects.includes("clear-post"));
  const reset = sourceBetween("resetGateState", "hasGateTitleVisualState");
  assert.match(reset, /if \(releaseReturnPose\) stopPostReleaseAnimation\(true\)/);
  const css = read("src/themes/kisara/styles/home.css");
  assert.match(css, /:is\(\.is-post-release, \.is-release-return\) \.kisara-title-lens-canvas/);
});

test("returning to a cached procedural title restores its layer even when reduced motion suppresses repaint", () => {
  const classes = new Set<string>();
  const state: Record<string, any> = {
    titleAbyssCanvas: {}, titleAbyssContext: {}, titleDataMaskContext: {},
    titleAbyssRimContext: {}, titleAbyssFluidContext: {}, titleAbyssFluidImageData: {},
    titleAbyssTideContext: {}, titleAbyssTideImageData: {},
    titleDataCanvasWidth: 1200, titleDataCanvasHeight: 300,
    pageMode: "gate", document: { visibilityState: "visible" },
    chargeIntroProgress: .1, titleAbyssDomHandoffStart: .72,
    burstProgress: 0, releaseStart: gateRelease.phases.start,
    getTitleReconstructionFrame, getReconstructionProgress,
    progress: 1, energyProgress: 1, velocity: 0,
    titleAbyssLastPaintTimestamp: 950, titleAbyssLastFill: 1,
    titleAbyssLastIntro: .1,
    titleAbyssPointerTargetX: 0, titleAbyssPointerX: 0,
    titleAbyssPointerTargetY: 0, titleAbyssPointerY: 0,
    reducedMotion: true, litePerformance: false, mobilePerformance: false,
    clamp: (value: number, a: number, b: number) => Math.max(a, Math.min(b, value)),
    gate: { classList: { add: (name: string) => classes.add(name), remove: (name: string) => classes.delete(name) } }
  };
  const draw = vm.runInNewContext(sourceBetween("drawTitleAbyss", "updateGatePresentation")
    + "; drawTitleAbyss;", state);
  draw(1000);
  assert.equal(classes.has("is-title-abyss-ready"), true);
  state.burstProgress = .5;
  draw(1050);
  assert.equal(classes.has("is-title-abyss-ready"), false);
  state.burstProgress = gateRelease.phases.start;
  draw(1080);
  assert.equal(classes.has("is-title-abyss-ready"), false, "The smoke handoff must retain the erased glyph");
  state.burstProgress = 0;
  draw(1100);
  assert.equal(classes.has("is-title-abyss-ready"), true);
  assert.equal(state.titleAbyssLastPaintTimestamp, 950, "The cached surface is reused without painting it again");
});
