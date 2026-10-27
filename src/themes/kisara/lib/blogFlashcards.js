export function bindBlogFlashcards(root) {
  if (!root) return { setActive() {}, cleanup() {} };
  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  const cards = Array.from(root.querySelectorAll("[data-blog-flashcard]"));
  const previous = root.querySelector("[data-flashcard-prev]");
  const next = root.querySelector("[data-flashcard-next]");
  const pause = root.querySelector("[data-flashcard-pause]");
  const count = root.querySelector("[data-flashcard-count]");
  const status = root.querySelector("[data-flashcard-status]");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  let index = 0;
  let active = false;
  let hovering = finePointer.matches && root.matches(":hover");
  let focusing = root.contains(document.activeElement);
  let paused = false;
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
      && !hovering && !focusing && !paused && !motion.matches && !cleaned;
    root.toggleAttribute("data-flashcard-running", running);
    if (running) timer = window.setTimeout(() => show(index + 1), 6400);
  };

  const show = (target, manual = false, direction = 1, allowMotion = true) => {
    if (!cards.length || cleaned) return;
    entry?.cancel();
    const generation = ++transition;
    const outgoing = cards[index];
    index = (target + cards.length) % cards.length;
    settle();
    const card = cards[index];
    root.dataset.flashcardTone = card.dataset.flashcardTone;
    if (count) count.textContent = `${String(index + 1).padStart(2, "0")} / ${String(cards.length).padStart(2, "0")}`;
    if (manual && status) status.textContent = `第 ${index + 1} 篇，共 ${cards.length} 篇：${card.dataset.flashcardTitle}`;
    if (outgoing !== card && allowMotion && active && !document.hidden && !motion.matches && card.animate) {
      outgoing.hidden = false;
      entry = card.animate([
        { opacity: 0, transform: `translate3d(${direction * 12}px, 6px, 0) rotate(${direction * 1.2}deg) scale(.97)` },
        { opacity: 1, transform: "none" },
      ], { duration: 240, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
      entry.finished.then(() => {
        if (generation === transition && !cleaned) settle();
      }).catch(() => {});
    }
    schedule();
  };

  previous?.addEventListener("click", event => show(index - 1, true, -1, event.detail !== 0), { signal });
  next?.addEventListener("click", event => show(index + 1, true, 1, event.detail !== 0), { signal });
  pause?.addEventListener("click", () => {
    paused = !paused;
    pause.setAttribute("aria-pressed", String(paused));
    pause.setAttribute("aria-label", paused ? "继续自动轮换" : "暂停自动轮换");
    pause.dataset.paused = String(paused);
    schedule();
  }, { signal });
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
    if (pause) pause.disabled = cards.length < 2 || motion.matches;
    schedule();
  }, { signal });
  if (previous) previous.disabled = cards.length < 2;
  if (next) next.disabled = cards.length < 2;
  if (pause) pause.disabled = cards.length < 2 || motion.matches;
  show(0);
  const controls = root.querySelector("[data-flashcard-controls]");
  if (controls) controls.hidden = cards.length < 2;

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
