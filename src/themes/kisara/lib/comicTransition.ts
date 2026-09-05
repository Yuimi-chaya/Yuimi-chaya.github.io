import { createComicMotion, settleWithin } from "./comicMotion.ts";
export { settleWithin } from "./comicMotion.ts";

type TransitionOptions = {
  scene: HTMLElement | null;
  prepare?: () => Promise<unknown> | undefined;
  commit: () => void | Promise<unknown>;
  mode: "enter" | "leave" | "return";
};

export function createComicTransition(signal: AbortSignal, reducedMotion: boolean) {
  const motion = createComicMotion(signal, reducedMotion);
  let flight: HTMLElement | null = null;
  let active = false;
  const clear = () => {
    flight?.remove();
    flight = null;
    motion.cancel();
  };
  signal.addEventListener("abort", clear, { once: true });
  document.addEventListener("keydown", event => {
    if (!active || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Escape") motion.finish();
    if (["Tab", "Enter", " ", "Escape"].includes(event.key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, { capture: true, signal });
  return {
    get active() { return active; },
    async run({ scene, prepare, commit, mode }: TransitionOptions) {
      if (active || signal.aborted) return false;
      active = true;
      try {
        await settleWithin(Promise.resolve().then(prepare), 1200, signal);
        if (signal.aborted) return false;
        if (!scene || reducedMotion || document.hidden) {
          await settleWithin(Promise.resolve(commit()), 2200, signal);
        } else {
          const overlay = document.createElement("div");
          overlay.className = `kisara-comic-flight is-${mode}`;
          overlay.setAttribute("aria-hidden", "true");
          // Clone visual children only: mounting the custom element would create another runtime.
          const visual = document.createElement("div");
          visual.className = "kisara-comic";
          visual.inert = true;
          Array.from(scene.children).forEach(child => visual.append(child.cloneNode(true)));
          visual.querySelectorAll("[id]").forEach(node => node.removeAttribute("id"));
          visual.querySelectorAll<HTMLElement>("[style]").forEach(node => {
            node.style.opacity = ""; node.style.transform = ""; node.style.clipPath = "";
          });
          overlay.append(visual);
          flight = overlay;
          document.body.append(overlay);
          if (mode === "return") {
            await settleWithin(Promise.resolve(commit()), 2200, signal);
            if (!signal.aborted) await motion.play(visual, true);
          } else {
            await motion.play(visual, mode === "leave");
            if (signal.aborted) return false;
            // Enter commits behind the completed paper; leave commits after it dissolves to black.
            await settleWithin(Promise.resolve(commit()), 2200, signal);
            if (!signal.aborted && mode === "leave") {
              await motion.animate(overlay, [{ opacity: 1 }, { opacity: 0 }], 100);
            }
          }
        }
        return !signal.aborted;
      } finally {
        clear();
        active = false;
      }
    },
  };
}
