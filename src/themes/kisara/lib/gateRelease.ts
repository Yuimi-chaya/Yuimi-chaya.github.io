export const gateRelease = {
  duration: 1520,
  phases: {
    start: 0.37,
    crossStart: 0.46,
    crossBuildEnd: 0.58,
    crossFlashEnd: 0.72,
    crossEnd: 0.82,
    collapseStart: 0.842,
    collapseEnd: 0.884,
    shockwaveStart: 0.904,
    detonationStart: 0.928,
    detonationEnd: 0.972
  },
  beats: {
    crossStart: 22,
    crossBuildEnd: 61,
    crossFlashEnd: 93,
    crossEnd: 141,
    crossSpinEnd: 67,
    crossHoldEnd: 81,
    crossRetractEnd: 124,
    collapseStart: 190,
    collapseEnd: 430,
    shockwaveStart: 530,
    detonationStart: 620,
    detonationEnd: 910
  }
} as const;

const stages = [
  "crossStart", "crossBuildEnd", "crossFlashEnd", "crossEnd",
  "collapseStart", "collapseEnd", "shockwaveStart", "detonationStart", "detonationEnd"
] as const;

// Keep the shader's phase coordinates; shorten physical time, not the recovery.
export const gateReleaseKeyframes: ReadonlyArray<readonly [number, number]> = [
  [0, gateRelease.phases.start],
  ...stages.map((stage) => [gateRelease.beats[stage], gateRelease.phases[stage]] as const),
  [gateRelease.duration, 1]
];

export function mapReleaseAutoplayProgress(value: number) {
  const elapsed = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)) * gateRelease.duration;
  for (let index = 0; index < gateReleaseKeyframes.length - 1; index++) {
    const [timeStart, progressStart] = gateReleaseKeyframes[index];
    const [timeEnd, progressEnd] = gateReleaseKeyframes[index + 1];
    if (elapsed > timeEnd && index < gateReleaseKeyframes.length - 2) continue;
    const local = Math.max(0, Math.min(1, (elapsed - timeStart) / (timeEnd - timeStart)));
    const smooth = local * local * (3 - 2 * local);
    const eased = index === 8
      ? 1 - (1 - local) ** 2.45
      : index === 6 ? smooth ** 1.35 : smooth;
    return progressStart + (progressEnd - progressStart) * eased;
  }
  return 1;
}
