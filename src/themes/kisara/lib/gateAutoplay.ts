import { memoryTimeline } from "./gateStory.ts";

// Match the existing edit: brief action inserts, longer reaction shots.
export const gateAutoplayShotDurations = [1000, 1250, 440, 460, 540, 540, 1260, 1500, 1210] as const;
export const gateAutoplayDuration = gateAutoplayShotDurations.reduce((total, duration) => total + duration, 0);

export function advanceGateAutoplay(progress: number, elapsed: number) {
  let next = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  let remaining = Math.max(0, Math.min(50, Number.isFinite(elapsed) ? elapsed : 0));
  for (let index = 0; index < memoryTimeline.length && remaining > 0; index++) {
    const start = index === 0 ? 0 : memoryTimeline[index].start;
    const end = memoryTimeline[index].leaveStart;
    if (next >= end) continue;
    const rate = (end - start) / gateAutoplayShotDurations[index];
    const used = Math.min(remaining, (end - next) / rate);
    next = Math.min(end, next + used * rate);
    remaining -= used;
  }
  return next;
}
