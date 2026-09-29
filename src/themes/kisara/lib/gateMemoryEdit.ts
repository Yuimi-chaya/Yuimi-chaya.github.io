import { memoryTimeline } from "./gateStory.ts";

type Edit = { duration: number };

// One edit per incoming shot. Times are wall-clock milliseconds, not scroll spans.
export const memoryEdits: readonly Edit[] = [
  { duration: 220 },
  { duration: 180 },
  { duration: 160 },
  { duration: 150 },
  { duration: 150 },
  { duration: 160 },
  { duration: 180 },
  { duration: 180 },
  { duration: 180 }
];

const unit = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => value * value * (3 - 2 * value);
const shotAt = (fill: number) => memoryTimeline.findLastIndex(shot => fill >= shot.start);
// 0.42/0.58 of a narrow boundary band, about eight wheel pixels end to end.
const boundaryMargin = (0.58 - 0.5) * 0.025;
type Transition = { from: number; to: number; phase: number; edit: Edit; soften: boolean };

export function createMemoryEditor(fill = 0) {
  let current = shotAt(fill);
  let intent = current;
  let transition: Transition | null = null;
  let pending = false;
  let previousFill = fill;
  let travelRate = 0;
  let waitingForImage = false;

  const reset = (nextFill: number) => {
    current = intent = shotAt(nextFill);
    transition = null;
    pending = false;
    previousFill = nextFill;
    travelRate = 0;
    waitingForImage = false;
  };
  const snapshot = () => {
    const weights = memoryTimeline.map(() => 0);
    const softness = memoryTimeline.map(() => 0);
    let baseOpacity = 0;
    const weight = (index: number, opacity: number) => {
      // The blue plate is the opaque lower layer of its single-slot dissolve.
      if (index < 0) baseOpacity = opacity > 0 ? 1 : 0;
      else weights[index] = opacity;
    };
    if (!transition) weight(current, 1);
    else {
      const { from, to, phase, soften } = transition;
      const blend = smooth(phase);
      weight(from, 1 - blend);
      weight(to, blend);
      if (soften) {
        // Retire outgoing detail before the two compositions overlap most.
        if (from >= 0) softness[from] = smooth(unit(phase / 0.35));
        if (to >= 0) softness[to] = 1 - smooth(unit((phase - 0.55) / 0.45));
      }
    }
    return { weights, softness, baseOpacity };
  };

  const update = (nextFill: number, elapsed: number, ready: (index: number) => boolean, reducedMotion = false) => {
    const fill = unit(nextFill);
    const delta = Number.isFinite(elapsed) ? Math.max(0, Math.min(50, elapsed)) : 0;
    const continuous = elapsed > 0 && elapsed <= 50 && !waitingForImage;
    const movement = fill - previousFill;
    // Filter measured travel, not wheel-event count, so uneven input does not
    // restart the dissolve or give a high-frequency trackpad extra acceleration.
    const measuredRate = continuous ? Math.abs(movement) / elapsed : 0;
    travelRate += (measuredRate - travelRate) * (1 - Math.exp(-delta / 100));
    while (intent < memoryTimeline.length - 1 && fill >= memoryTimeline[intent + 1].start + boundaryMargin) intent++;
    while (intent >= 0 && fill <= memoryTimeline[intent].start - boundaryMargin) intent--;

    const canReceive = intent < 0 || ready(intent);
    const begin = (catchingUp = false) => {
      const edit = reducedMotion || catchingUp ? { duration: 100 } : memoryEdits[Math.max(intent, current)];
      transition = { from: current, to: intent, phase: 0, edit, soften: !reducedMotion };
    };
    let remaining = delta;
    if (!transition && intent !== current && canReceive) {
      // Use only time after a boundary was actually crossed. An idle or decode
      // interval still starts at zero, but continuous scrolling loses no frame.
      const boundary = intent > current
        ? memoryTimeline[intent].start + boundaryMargin
        : memoryTimeline[intent + 1].start - boundaryMargin;
      remaining = continuous && movement !== 0
        ? delta * unit((fill - boundary) / movement) : 0;
      begin();
    }
    while (transition) {
      const retargeting = intent !== transition.from && intent !== transition.to && canReceive;
      // Free a slot in the requested story direction, never back toward an old
      // plate just because it is more opaque. Keep only the latest destination.
      const direction = intent === transition.from ? -1
        : retargeting && Math.abs(intent - transition.from) < Math.abs(intent - transition.to) ? -1 : 1;
      const span = Math.min(...[transition.from, transition.to].map(index => {
        const shot = memoryTimeline[Math.max(0, index)];
        return shot.leaveStart - shot.start;
      }));
      const duration = Math.max(100, Math.min(transition.edit.duration,
        retargeting ? 100 : travelRate > 0 ? span / travelRate : transition.edit.duration));
      const timeToEnd = (direction > 0 ? 1 - transition.phase : transition.phase) * duration;
      const used = Math.min(remaining, timeToEnd);
      transition.phase = timeToEnd <= remaining || (remaining > 0 && timeToEnd - remaining < 1e-7) ? (direction > 0 ? 1 : 0)
        : unit(transition.phase + direction * used / duration);
      remaining = Math.max(0, remaining - used);
      if ((direction > 0 && transition.phase >= 1) || (direction < 0 && transition.phase <= 0)) {
        current = direction > 0 ? transition.to : transition.from;
        transition = null;
        if (canReceive && intent !== current) begin(true);
      }
      if (remaining <= 0) break;
    }
    previousFill = fill;
    waitingForImage = !canReceive;
    pending = canReceive && intent !== current;
    return snapshot();
  };
  return { update, reset, snapshot, get active() { return transition !== null || pending; } };
}
