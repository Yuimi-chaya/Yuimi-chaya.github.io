export function settleWithin(task: Promise<unknown>, timeout: number, signal: AbortSignal) {
  return new Promise<void>(resolve => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, timeout);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
    void task.then(finish, finish);
  });
}

// A fixed contour expands from the portrait; no filters or per-frame geometry work.
export function comicSpreadPoints(width: number, height: number, x: number, y: number, progress: number) {
  const radius = Math.hypot(Math.max(x, width - x), Math.max(y, height - y)) * 1.4;
  return Array.from({ length: 40 }, (_, index) => {
    const angle = index * Math.PI / 20;
    const edge = .92 + .045 * Math.sin(angle * 5 + .8) + .035 * Math.sin(angle * 11);
    return [
      x + Math.cos(angle) * radius * edge * (.009 + progress * .991),
      y + Math.sin(angle) * radius * edge * (.027 + progress * .973),
    ];
  });
}

export function createComicMotion(signal: AbortSignal, reducedMotion: boolean) {
  const animations = new Set<Animation>();
  const restore: Array<() => void> = [];
  let generation = 0;
  const cancel = () => {
    generation++;
    animations.forEach(animation => animation.cancel());
    animations.clear();
    restore.splice(0).forEach(reset => reset());
  };
  const finish = () => animations.forEach(animation => {
    try { animation.finish(); } catch { /* A cancelled animation is already settled. */ }
  });
  const animate = async (node: HTMLElement | null, frames: Keyframe[], duration: number, delay = 0, easing = "cubic-bezier(.23,1,.32,1)") => {
    if (!node || signal.aborted) return;
    const serial = generation;
    const properties = ["opacity", "transform", "clipPath"] as const;
    const original = Object.fromEntries(properties.map(key => [key, node.style[key]]));
    restore.push(() => { Object.assign(node.style, original); });
    const finalFrame = frames[frames.length - 1];
    const settle = () => properties.forEach(key => {
      if (finalFrame[key] !== undefined) node.style[key] = String(finalFrame[key]);
    });
    if (reducedMotion || document.hidden || !node.animate) { settle(); return; }
    const animation = node.animate(frames, { duration, delay, easing, fill: "both" });
    animations.add(animation);
    await settleWithin(animation.finished, duration + delay + 160, signal);
    if (signal.aborted || serial !== generation) return;
    settle();
    animation.cancel();
    animations.delete(animation);
  };
  signal.addEventListener("abort", cancel, { once: true });
  document.addEventListener("visibilitychange", () => { if (document.hidden) finish(); }, { signal });
  window.addEventListener("resize", finish, { signal });
  return {
    cancel, finish, animate,
    async play(scene: HTMLElement, reverse = false) {
      cancel();
      const serial = generation;
      const bounds = scene.getBoundingClientRect();
      const paper = scene.querySelector<HTMLElement>(".kisara-comic-paper");
      const portrait = scene.querySelector<HTMLElement>(".kisara-comic-portrait");
      const subject = portrait?.getBoundingClientRect();
      const x = Math.max(0, Math.min(bounds.width, subject ? subject.left - bounds.left + subject.width * .47 : bounds.width * .65));
      const y = Math.max(0, Math.min(bounds.height, subject ? subject.top - bounds.top + subject.height * .28 : bounds.height * .35));
      const spread = [0, .23, .62, 1].map((progress, index) => ({
        clipPath: `polygon(${comicSpreadPoints(bounds.width, bounds.height, x, y, progress).map(([px, py]) => `${px.toFixed(1)}px ${py.toFixed(1)}px`).join(",")})`,
        opacity: index === 0 ? 0 : 1,
      }));
      const reveal = [
        { opacity: 0, transform: "translate3d(0,12px,0)", clipPath: "inset(0 0 90% 0)" },
        { opacity: 1, transform: "translate3d(0,0,0)", clipPath: "inset(0)" },
      ];
      const fade = [{ opacity: 0 }, { opacity: 1 }];
      const ordered = (frames: Keyframe[]) => reverse ? [...frames].reverse() : frames;
      const jobs = [
        animate(portrait, ordered(reveal), reverse ? 460 : 600, reverse ? 780 : 0),
        animate(paper, ordered(spread), reverse ? 920 : 1020, reverse ? 160 : 260, "cubic-bezier(.77,0,.175,1)"),
      ];
      scene.querySelectorAll<HTMLElement>(".kisara-comic-panel").forEach((panel, index) => {
        jobs.push(animate(panel, ordered(fade), reverse ? 320 : 540, reverse ? index * 40 : 400 + index * 65));
      });
      scene.querySelectorAll<HTMLElement>("[data-comic-caption]").forEach((caption, index) => {
        jobs.push(animate(caption, ordered(fade), reverse ? 240 : 420, reverse ? 0 : 640 + index * 40));
      });
      await Promise.all(jobs);
      if (!reverse && paper && serial === generation && !signal.aborted) paper.style.clipPath = "none";
    },
  };
}
