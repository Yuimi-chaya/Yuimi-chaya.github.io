const unit = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smooth = (value: number) => {
  const p = unit(value);
  return p * p * (3 - 2 * p);
};
const smoother = (value: number) => {
  const p = unit(value);
  return p * p * p * (p * (p * 6 - 15) + 10);
};
const between = (value: number, start: number, end: number) => unit((value - start) / (end - start));

export const gateRelease = {
  introDuration: 2150,
  introHandoff: 0.66,
  duration: 610,
  phases: { start: 0.01 },
  rewindCommitAt: 0.72
} as const;

// The small nonzero start distinguishes release from the manual charge state.
export function mapReleaseAutoplayProgress(value: number) {
  return gateRelease.phases.start + smooth(value) * (1 - gateRelease.phases.start);
}

export function getReconstructionProgress(burst: number) {
  return between(burst, gateRelease.phases.start, 1);
}

export const transformationTimeline = [
  { start: 0.025, enterEnd: 0.18, leaveStart: 0.34, end: 0.52, drift: -15, lift: -3 },
  { start: 0.35, enterEnd: 0.51, leaveStart: 0.63, end: 0.79, drift: 18, lift: -2 }
] as const;

export function getTransformationFrame(index: number, intro: number, clock = 0, motionBlur = 0, reducedMotion = false) {
  const scene = transformationTimeline[index];
  if (!scene) return null;
  // Preserve the two original shots; the former third-shot cue now starts reconstruction.
  const position = Math.min(intro, gateRelease.introHandoff);
  const enter = smoother(between(position, scene.start, scene.enterEnd));
  const leave = 1 - smoother(between(position, scene.leaveStart, scene.end));
  const local = between(position, scene.start, scene.end);
  const focus = Math.sin(local * Math.PI);
  const breath = reducedMotion ? 0 : Math.sin(clock * (0.34 + index * 0.08) + index * 1.7);
  return {
    opacity: enter * leave * 0.995,
    scale: 1.072 - focus * 0.034 + local * 0.005 + breath * 0.0015,
    shiftX: (local - 0.5) * scene.drift + breath * 1.2,
    shiftY: scene.lift * focus + breath * 0.45,
    blur: 0.35 + Math.pow(1 - Math.max(0, focus), 1.28) * 7.4 + motionBlur * 0.38
  };
}

export function getGateSceneHandoff(reconstruction: number) {
  const p = unit(reconstruction);
  const settle = smoother(between(p, 0.18, 1));
  return {
    reconstructionProgress: p,
    transformationReleaseOpacity: 1 - smoother(between(p, 0.12, 0.92)),
    fightVisible: smoother(between(p, 0.72, 1)),
    fightSettle: settle,
    fightBlur: 0.3 + 2.8 * Math.pow(1 - settle, 1.35),
    fightSaturation: 0.9 + settle * 0.28,
    fightBrightness: 0.86 + settle * 0.16
  };
}

export function getReconstructionRadii(progress: number, width: number, height: number, x: number, y: number) {
  const p = unit(progress);
  const feather = Math.max(74, Math.min(148, Math.min(width, height) * 0.135));
  const farthest = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
  const seal = smooth(between(p, 0.82, 1)) * feather * 1.08;
  const outer = (1 - Math.pow(1 - p, 2.35)) * farthest + seal;
  return { outer, inner: Math.max(0, outer - feather), opacity: smooth(between(p, 0.015, 0.13)) };
}
