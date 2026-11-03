export function mountHomeJournal(root, win = window) {
  if (!root) return () => {};
  const elements = [...root.querySelectorAll(".journal-heading, .journal-margin-note, .journal-entry")];
  const doc = root.ownerDocument;
  const reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
  if (!elements.length || elements.some(element => typeof element.animate !== "function")) return () => {};
  const animations = [];
  let frame = 0, disposed = false, visible = true;
  const duration = 240, stagger = 50;
  const total = duration + (elements.length - 1) * stagger;
  const clear = () => {
    win.cancelAnimationFrame(frame);
    frame = 0;
    animations.splice(0).forEach(animation => animation.cancel());
  };
  const update = () => {
    frame = 0;
    if (disposed || doc.hidden || reduced.matches) return;
    const distance = Math.min(300, win.innerHeight * .45);
    const progress = Math.max(0, Math.min(1, (win.innerHeight - root.getBoundingClientRect().top) / distance));
    for (const animation of animations) animation.currentTime = progress * total;
  };
  const schedule = () => {
    if (!disposed && visible && !doc.hidden && !reduced.matches && !frame) frame = win.requestAnimationFrame(update);
  };
  const prepare = () => {
    clear();
    if (disposed || reduced.matches) return;
    elements.forEach((element, index) => {
      const animation = element.animate([
        { opacity: 0, transform: "translate3d(0, 18px, 0)" },
        { opacity: 1, transform: "translate3d(0, 0, 0)" },
      ], { duration, delay: index * stagger, easing: "cubic-bezier(.23, 1, .32, 1)", fill: "both" });
      animation.pause();
      animations.push(animation);
    });
    update();
  };
  const navigate = event => {
    // Keep explicit keyboard and focus navigation fully visible.
    if (event.type === "focusin" || ["Tab", "Home", "End", "PageUp", "PageDown", "ArrowUp", "ArrowDown", " "].includes(event.key)) clear();
  };
  const observer = win.IntersectionObserver ? new win.IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    // Update at exit too, so a large scroll never leaves a stale partial frame.
    update();
  }) : null;
  observer?.observe(root);
  win.addEventListener("scroll", schedule, { passive: true });
  win.addEventListener("resize", schedule, { passive: true });
  win.addEventListener("pagehide", clear);
  win.addEventListener("pageshow", prepare);
  doc.addEventListener("visibilitychange", schedule);
  doc.addEventListener("keydown", navigate);
  root.addEventListener("focusin", navigate);
  reduced.addEventListener("change", prepare);
  prepare();
  return () => {
    disposed = true;
    clear();
    observer?.disconnect();
    win.removeEventListener("scroll", schedule);
    win.removeEventListener("resize", schedule);
    win.removeEventListener("pagehide", clear);
    win.removeEventListener("pageshow", prepare);
    doc.removeEventListener("visibilitychange", schedule);
    doc.removeEventListener("keydown", navigate);
    root.removeEventListener("focusin", navigate);
    reduced.removeEventListener("change", prepare);
  };
}
