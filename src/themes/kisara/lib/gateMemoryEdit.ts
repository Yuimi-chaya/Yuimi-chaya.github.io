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

  const reset = (nextFill: number) => {
    current = intent = shotAt(nextFill);
    transition = null;
    pending = false;
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
    while (intent < memoryTimeline.length - 1 && fill >= memoryTimeline[intent + 1].start + boundaryMargin) intent++;
    while (intent >= 0 && fill <= memoryTimeline[intent].start - boundaryMargin) intent--;

    const canReceive = intent < 0 || ready(intent);
    let started = false;
    if (!transition && intent !== current && canReceive) {
      const edit = reducedMotion ? { duration: 100 } : memoryEdits[Math.max(intent, current)];
      transition = { from: current, to: intent, phase: 0, edit, soften: !reducedMotion };
      started = true;
    }
    if (transition) {
      const retargeting = intent !== transition.from && intent !== transition.to && canReceive;
      // With two image slots, finish toward the nearest endpoint before blending
      // to the latest request. Never replace a partly visible image in place.
      const direction = intent === transition.from ? -1
        : retargeting ? (transition.phase < 0.5 ? -1 : 1) : 1;
      // Never charge an idle or decoding interval to a newly started edit.
      const delta = started || !Number.isFinite(elapsed) ? 0 : Math.max(0, Math.min(50, elapsed));
      transition.phase = unit(transition.phase + direction * delta / transition.edit.duration * (retargeting ? 2 : 1));
      if ((direction > 0 && transition.phase >= 1) || (direction < 0 && transition.phase <= 0)) {
        current = direction > 0 ? transition.to : transition.from;
        transition = null;
      }
    }
    pending = canReceive && intent !== current;
    return snapshot();
  };
  return { update, reset, snapshot, get active() { return transition !== null || pending; } };
}
