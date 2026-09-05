type TransitionOptions = {
  prepare?: () => Promise<unknown> | undefined;
  commit: () => void | Promise<unknown>;
  reveal?: "split" | "fade";
};

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

export function createComicTransition(signal: AbortSignal, reducedMotion: boolean) {
  const animations = new Set<Animation>();
  let curtain: HTMLElement | null = null;
  let active = false;
  const animate = async (node: HTMLElement, frames: Keyframe[], duration: number, delay = 0) => {
    if (signal.aborted) return;
    if (reducedMotion || document.hidden || !node.animate) {
      Object.assign(node.style, frames[frames.length - 1]);
      return;
    }
    const animation = node.animate(frames, {
      duration, delay, easing: "cubic-bezier(.77,0,.175,1)", fill: "forwards",
    });
    animations.add(animation);
    await settleWithin(animation.finished, duration + delay + 120, signal);
    if (!signal.aborted) {
      Object.assign(node.style, frames[frames.length - 1]);
      animation.cancel();
      animations.delete(animation);
    }
  };
  const clear = () => {
    animations.forEach(animation => animation.cancel());
    animations.clear();
    curtain?.remove();
    curtain = null;
  };
  signal.addEventListener("abort", clear, { once: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) animations.forEach(animation => {
      try { animation.finish(); } catch { /* An already cancelled animation is settled. */ }
    });
  }, { signal });
  return {
    get active() { return active; },
    async run({ prepare, commit, reveal = "split" }: TransitionOptions) {
      if (active || signal.aborted) return false;
      active = true;
      const overlay = document.createElement("div");
      overlay.className = "kisara-comic-curtain";
      overlay.setAttribute("aria-hidden", "true");
      const slabs = [document.createElement("i"), document.createElement("i")];
      slabs.forEach((slab, index) => {
        slab.style.transform = `translate3d(${index ? 105 : -105}%,0,0)`;
        overlay.append(slab);
      });
      curtain = overlay;
      document.body.append(overlay);
      try {
        const readiness = settleWithin(Promise.resolve().then(prepare), 1200, signal);
        await Promise.all([
          readiness,
          ...slabs.map((slab, index) => animate(slab, [
            { transform: slab.style.transform }, { transform: "translate3d(0,0,0)" },
          ], 520, index * 70)),
        ]);
        if (signal.aborted) return false;
        // The real scroll position and scene reset change only behind full coverage.
        await settleWithin(Promise.resolve(commit()), 2200, signal);
        if (signal.aborted) return false;
        if (reveal === "fade") {
          await animate(overlay, [{ opacity: 1 }, { opacity: 0 }], 160);
        } else {
          await Promise.all(slabs.map((slab, index) => animate(slab, [
            { transform: "translate3d(0,0,0)" },
            { transform: `translate3d(${index ? 105 : -105}%,0,0)` },
          ], 620, index * 50)));
        }
        return true;
      } finally {
        clear();
        active = false;
      }
    },
  };
}
