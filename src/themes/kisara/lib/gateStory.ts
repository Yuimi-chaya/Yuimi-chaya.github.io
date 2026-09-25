const unit = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const p = unit(value);
  return p * p * (3 - 2 * p);
};
const between = (value: number, start: number, end: number) => unit((value - start) / (end - start));

export const memoryFillDuration = 9000;
export const memoryBrightenDuration = 650;

export function advanceMemoryProgress(progress: number, target: number, velocity: number, frameRatio: number, strength: number, damping: number) {
  const speed = (velocity + (target - progress) * strength * frameRatio) * Math.pow(damping, frameRatio);
  const candidate = progress + speed * frameRatio;
  // Scroll edits may reverse on input, never from spring overshoot or recoil.
  const next = Math.max(Math.min(progress, target), Math.min(Math.max(progress, target), candidate));
  return { progress: next, velocity: next === candidate ? speed : 0 };
}

export function advanceMemoryBlackout(current: number, target: number, elapsed: number, reducedMotion = false) {
  return Math.max(target, current - Math.max(0, Math.min(50, elapsed)) / (reducedMotion ? 180 : memoryBrightenDuration));
}

// The scroll clock is also the edit: brief action inserts, longer reaction shots.
export const memoryTimeline = [
  { start: 0.02, enterEnd: 0.065, leaveStart: 0.128, end: 0.175, drift: -12, lift: -3 },
  { start: 0.128, enterEnd: 0.175, leaveStart: 0.278, end: 0.315, drift: 6, lift: 0 },
  { start: 0.278, enterEnd: 0.315, leaveStart: 0.327, end: 0.351, drift: -16, lift: -5 },
  { start: 0.327, enterEnd: 0.351, leaveStart: 0.379, end: 0.407, drift: 10, lift: -16 },
  { start: 0.379, enterEnd: 0.407, leaveStart: 0.441, end: 0.476, drift: -12, lift: 3 },
  { start: 0.441, enterEnd: 0.476, leaveStart: 0.503, end: 0.553, drift: 14, lift: 6 },
  { start: 0.503, enterEnd: 0.553, leaveStart: 0.652, end: 0.702, drift: -5, lift: 0 },
  { start: 0.652, enterEnd: 0.702, leaveStart: 0.83, end: 0.87, drift: 0, lift: 0 },
  { start: 0.83, enterEnd: 0.87, leaveStart: 1, end: 1, drift: 0, lift: 0, persistent: true }
] as const;

export const memoryScenes = [
  { id: "intercept", image: "/themes/kisara/assets/memory-intercept.webp", position: "52% 50%" },
  { id: "rescue", image: "/themes/kisara/assets/memory-rescue.webp", position: "62% 50%" },
  { id: "draw", image: "/themes/kisara/assets/memory-draw.webp", position: "50% 50%" },
  { id: "leap", image: "/themes/kisara/assets/memory-leap.webp", position: "58% 45%" },
  { id: "impact", image: "/themes/kisara/assets/memory-impact.webp", position: "55% 50%" },
  { id: "fallen", image: "/themes/kisara/assets/memory-fallen.webp", position: "50% 55%" },
  { id: "embrace", image: "/themes/kisara/assets/memory-embrace.webp", position: "58% 50%" },
  { id: "approach", image: "/themes/kisara/assets/memory-approach.webp", position: "50% 48%" },
  { id: "kiss", image: "/themes/kisara/assets/memory-kiss.webp", position: "50% 50%" }
] as const;

export const transformationScenes = [
  { id: "smoke-wide", image: "/themes/kisara/assets/transformation-smoke-wide.webp", position: "50% 50%" },
  { id: "detail", image: "/themes/kisara/assets/transformation-detail.webp", position: "55% 48%" },
  { id: "silhouette", image: "/themes/kisara/assets/transformation-silhouette.webp", position: "50% 50%" }
] as const;

export function getMemoryFrame(index: number, fill: number, intro = 0, reducedMotion = false) {
  const scene = memoryTimeline[index];
  if (!scene) return null;
  const persistent = "persistent" in scene;
  const local = between(fill, scene.start, persistent ? 1 : scene.end);
  const leave = persistent
    ? 1 - smooth(between(intro, 0.025, 0.23))
    : 1 - smooth(between(fill, scene.leaveStart, scene.end));
  const opacity = smooth(between(fill, scene.start, scene.enterEnd)) * leave;
  const approach = index === 7;
  const impact = index === 4 ? Math.sin(local * Math.PI * 4) * (1 - local) : 0;
  return {
    opacity,
    scale: reducedMotion ? 1.02 : approach ? 1.035 + local * 0.245 : 1.035 + local * 0.012,
    shiftX: reducedMotion ? 0 : (local - 0.5) * scene.drift + impact * 3,
    shiftY: reducedMotion ? 0 : scene.lift * local + impact * 1.5,
    origin: approach ? "50% 45%" : "center",
    blur: 0,
    saturation: 1,
    brightness: 1
  };
}

export function getMemoryBlackout(fill: number, intro = 0, reducedMotion = false) {
  if (intro > 0 || fill <= 0.735 || fill >= 0.975) return 0;
  // One deliberate eye-close, not a dark dip at every edit.
  const close = smooth(between(fill, 0.735, 0.825));
  const open = 1 - smooth(between(fill, 0.87, 0.975));
  return close * open * (reducedMotion ? 0.3 : 1);
}

export function getMemoryWarmIndices(fill: number) {
  const active = memoryTimeline.findLastIndex(scene => fill >= scene.start);
  const first = Math.max(0, active - 1);
  const last = Math.min(memoryTimeline.length - 1, Math.max(1, active + 2));
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}
