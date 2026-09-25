const unit = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => {
  const p = unit(value);
  return p * p * (3 - 2 * p);
};
const between = (value: number, start: number, end: number) => unit((value - start) / (end - start));

export const memoryFillDuration = 9000;
export const memoryBlendDuration = 300;
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
// Blend windows stay in real milliseconds so a shot's dwell does not stretch its
// dissolve. The authored start/leaveStart values continue to control the edit.
const memoryBlend = memoryBlendDuration / memoryFillDuration;
export const memoryTimeline = [
  { start: 0.02, enterEnd: 0.02 + memoryBlend, leaveStart: 0.128, end: 0.128 + memoryBlend, drift: -12, lift: -3 },
  { start: 0.128, enterEnd: 0.128 + memoryBlend, leaveStart: 0.278, end: 0.278 + memoryBlend, drift: 6, lift: 0 },
  { start: 0.278, enterEnd: 0.278 + memoryBlend, leaveStart: 0.327, end: 0.327 + memoryBlend, drift: -16, lift: -5 },
  { start: 0.327, enterEnd: 0.327 + memoryBlend, leaveStart: 0.379, end: 0.379 + memoryBlend, drift: 10, lift: -16 },
  { start: 0.379, enterEnd: 0.379 + memoryBlend, leaveStart: 0.441, end: 0.441 + memoryBlend, drift: -12, lift: 3 },
  { start: 0.441, enterEnd: 0.441 + memoryBlend, leaveStart: 0.503, end: 0.503 + memoryBlend, drift: 14, lift: 6 },
  { start: 0.503, enterEnd: 0.503 + memoryBlend, leaveStart: 0.652, end: 0.652 + memoryBlend, drift: -5, lift: 0 },
  { start: 0.652, enterEnd: 0.652 + memoryBlend, leaveStart: 0.83, end: 0.83 + memoryBlend, drift: 0, lift: 0 },
  { start: 0.83, enterEnd: 0.83 + memoryBlend, leaveStart: 1, end: 1, drift: 0, lift: 0, persistent: true }
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

const memoryTonePalette = [
  { r: 70, g: 89, b: 122 },
  { r: 197, g: 187, b: 196 },
  { r: 196, g: 144, b: 122 },
  { r: 173, g: 120, b: 121 },
  { r: 222, g: 192, b: 121 },
  { r: 134, g: 73, b: 98 },
  { r: 187, g: 118, b: 102 },
  { r: 176, g: 155, b: 142 },
  { r: 226, g: 169, b: 168 },
  { r: 235, g: 193, b: 178 }
] as const;

const toneDistance = (from: typeof memoryTonePalette[number], to: typeof memoryTonePalette[number]) =>
  Math.hypot(to.r - from.r, to.g - from.g, to.b - from.b);

const toneColor = (
  from: typeof memoryTonePalette[number],
  to: typeof memoryTonePalette[number],
  progress: number
) => `rgb(${
  Math.round(from.r + (to.r - from.r) * progress)
}, ${
  Math.round(from.g + (to.g - from.g) * progress)
}, ${
  Math.round(from.b + (to.b - from.b) * progress)
})`;

export function getMemoryBaseOpacity(fill: number) {
  const first = memoryTimeline[0];
  return 1 - smooth(between(fill, first.start, first.enterEnd));
}

export function getMemoryToneBridge(fill: number, intro = 0, reducedMotion = false) {
  if (intro > 0 || reducedMotion) return { opacity: 0, color: "transparent" };
  const active = memoryTimeline.findLastIndex(scene => fill >= scene.start);
  if (active < 0 || active >= memoryScenes.length) {
    return { opacity: 0, color: "transparent" };
  }
  const scene = memoryTimeline[active];
  const progress = smooth(between(fill, scene.start, scene.enterEnd));
  if (progress <= 0 || progress >= 1) return { opacity: 0, color: "transparent" };

  const from = memoryTonePalette[active];
  const to = memoryTonePalette[active + 1];
  const strength = unit((toneDistance(from, to) - 96) / 100);
  if (strength <= 0) return { opacity: 0, color: "transparent" };

  return {
    opacity: Math.sin(progress * Math.PI) * (0.045 + strength * 0.115),
    color: toneColor(from, to, progress)
  };
}

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
