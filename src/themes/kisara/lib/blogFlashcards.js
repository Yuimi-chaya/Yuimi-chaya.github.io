export function bindBlogFlashcards(root) {
  if (!root) return { setActive() {}, cleanup() {} };
  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  const cards = Array.from(root.querySelectorAll("[data-blog-flashcard]"));
  const count = root.querySelector("[data-flashcard-count]");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  let index = 0;
  let active = false;
  let hovering = finePointer.matches && root.matches(":hover");
  let focusing = root.contains(document.activeElement);
  let pageHidden = false;
  let timer = 0;
  let entry = null;
  let transition = 0;
  let cleaned = false;

  const settle = () => cards.forEach((card, position) => {
    card.hidden = position !== index;
    card.inert = position !== index;
    card.setAttribute("aria-hidden", String(position !== index));
    card.style.zIndex = position === index ? "1" : "0";
  });

  const schedule = () => {
    window.clearTimeout(timer);
    timer = 0;
    const running = cards.length > 1 && active && !document.hidden && !pageHidden
      && !hovering && !focusing && !motion.matches && !cleaned;
    root.toggleAttribute("data-flashcard-running", running);
    if (running) timer = window.setTimeout(() => show(index + 1), 6400);
  };

  const show = (target) => {
    if (!cards.length || cleaned) return;
    entry?.cancel();
    const generation = ++transition;
    const outgoing = cards[index];
    index = (target + cards.length) % cards.length;
    settle();
    const card = cards[index];
    root.dataset.flashcardTone = card.dataset.flashcardTone;
    if (count) count.textContent = `${String(index + 1).padStart(2, "0")} / ${String(cards.length).padStart(2, "0")}`;
    if (outgoing !== card && active && !document.hidden && !motion.matches && card.animate) {
      outgoing.hidden = false;
      entry = card.animate([
        { opacity: 0, transform: "translate3d(12px, 6px, 0) rotate(1.2deg) scale(.97)" },
        { opacity: 1, transform: "none" },
      ], { duration: 240, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
      entry.finished.then(() => {
        if (generation === transition && !cleaned) settle();
      }).catch(() => {});
    }
    schedule();
  };

  root.addEventListener("pointerenter", event => {
    if (!finePointer.matches || event.pointerType === "touch") return;
    hovering = true;
    schedule();
  }, { signal });
  root.addEventListener("pointerleave", () => { hovering = false; schedule(); }, { signal });
  root.addEventListener("focusin", () => { focusing = true; schedule(); }, { signal });
  root.addEventListener("focusout", event => {
    focusing = root.contains(event.relatedTarget);
    schedule();
  }, { signal });
  document.addEventListener("visibilitychange", schedule, { signal });
  window.addEventListener("pagehide", () => { pageHidden = true; schedule(); }, { signal });
  window.addEventListener("pageshow", () => { pageHidden = false; schedule(); }, { signal });
  motion.addEventListener("change", () => {
    if (motion.matches) {
      transition += 1;
      entry?.cancel();
      settle();
    }
    schedule();
  }, { signal });
  show(0);

  return {
    setActive(value) {
      if (active === value || cleaned) return;
      active = value;
      if (!active) {
        transition += 1;
        entry?.cancel();
        settle();
      }
      schedule();
    },
    cleanup() {
      cleaned = true;
      window.clearTimeout(timer);
      entry?.cancel();
      settle();
      lifecycle.abort();
      root.removeAttribute("data-flashcard-running");
    },
  };
}
