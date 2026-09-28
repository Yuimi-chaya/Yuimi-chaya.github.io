import { memoryTimeline } from "./gateStory.ts";

type Edit = { kind: "cut" | "fade" | "cover"; duration: number; color?: string; strength?: number };

// One edit per incoming shot. Times are wall-clock milliseconds, not scroll spans.
export const memoryEdits: readonly Edit[] = [
  { kind: "cover", duration: 90, color: "#e7eafa", strength: 0.92 },
  { kind: "cut", duration: 0 },
  { kind: "cut", duration: 0 },
  { kind: "cut", duration: 0 },
  { kind: "cover", duration: 50, color: "#f4d6ed", strength: 0.3 },
  { kind: "cover", duration: 80, color: "#3b1628", strength: 0.55 },
  { kind: "fade", duration: 110 },
  { kind: "fade", duration: 120 },
  { kind: "fade", duration: 120 }
];

const unit = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => value * value * (3 - 2 * value);
const shotAt = (fill: number) => memoryTimeline.findLastIndex(shot => fill >= shot.start);
// 0.42/0.58 of a narrow boundary band, about eight wheel pixels end to end.
const boundaryMargin = (0.58 - 0.5) * 0.025;
type Transition = { from: number; to: number; phase: number; incoming: boolean; edit: Edit };

export function createMemoryEditor(fill = 0) {
  let current = shotAt(fill);
  let intent = current;
  let transition: Transition | null = null;

  const reset = (nextFill: number) => {
    current = intent = shotAt(nextFill);
    transition = null;
  };
  const snapshot = () => {
    const weights = memoryTimeline.map(() => 0);
    let baseOpacity = 0;
    let bridgeOpacity = 0;
    let bridgeColor = "transparent";
    const weight = (index: number, opacity: number) => {
      // The blue plate is the opaque lower layer of its single-slot dissolve.
      if (index < 0) baseOpacity = opacity > 0 ? 1 : 0;
      else weights[index] = opacity;
    };
    if (!transition) weight(current, 1);
    else {
      const { from, to, phase, incoming, edit } = transition;
      if (edit.kind === "fade") {
        const blend = smooth(phase);
        weight(from, 1 - blend);
        weight(to, blend);
      } else {
        weight(incoming ? to : from, 1);
        bridgeOpacity = smooth(1 - Math.abs(2 * phase - 1)) * (edit.strength ?? 0);
        bridgeColor = edit.color ?? "transparent";
      }
    }
    return { weights, baseOpacity, bridgeOpacity, bridgeColor };
  };

  const update = (nextFill: number, elapsed: number, ready: (index: number) => boolean, reducedMotion = false) => {
    const fill = unit(nextFill);
    while (intent < memoryTimeline.length - 1 && fill >= memoryTimeline[intent + 1].start + boundaryMargin) intent++;
    while (intent >= 0 && fill <= memoryTimeline[intent].start - boundaryMargin) intent--;

    const canReceive = intent < 0 || ready(intent);
    let started = false;
    if (transition && intent !== transition.from && intent !== transition.to && canReceive) {
      // A fast scrub skips to the requested shot instead of queuing stale flashes.
      current = intent;
      transition = null;
    }
    if (!transition && intent !== current && canReceive) {
      const adjacent = Math.abs(intent - current) === 1;
      const edit: Edit = !adjacent ? { kind: "cut", duration: 0 }
        : reducedMotion ? { kind: "fade", duration: 100 }
          : memoryEdits[Math.max(intent, current)];
      if (edit.kind === "cut") current = intent;
      else {
        transition = { from: current, to: intent, phase: 0, incoming: false, edit };
        started = true;
      }
    }
    if (transition) {
      const direction = intent === transition.from ? -1 : 1;
      // Never charge an idle or decoding interval to a newly started edit.
      const delta = started || !Number.isFinite(elapsed) ? 0 : Math.max(0, Math.min(50, elapsed));
      transition.phase = unit(transition.phase + direction * delta / transition.edit.duration);
      if (transition.phase >= 0.58) transition.incoming = true;
      else if (transition.phase <= 0.42) transition.incoming = false;
      if ((direction > 0 && transition.phase >= 1) || (direction < 0 && transition.phase <= 0)) {
        current = direction > 0 ? transition.to : transition.from;
        transition = null;
      }
    }
    return snapshot();
  };
  return { update, reset, snapshot, get active() { return transition !== null; } };
}
