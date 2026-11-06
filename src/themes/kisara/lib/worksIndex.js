const filterButtonState = (buttons, active) => {
  buttons.forEach((button) => {
    const selected = button === active;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
};

export function bindWorksIndex(root = document.querySelector("[data-kisara-works-index]")) {
  if (!(root instanceof HTMLElement)) return () => {};

  const buttons = Array.from(root.querySelectorAll("[data-works-filter]"));
  const cards = Array.from(root.querySelectorAll("[data-project-line]"));
  const count = root.querySelector("[data-works-count]");
  const empty = root.querySelector("[data-works-empty]");
  const pager = root.querySelector("[data-works-pagination]");
  const range = root.querySelector("[data-works-range]");
  const previous = root.querySelector('[data-works-page="prev"]');
  const next = root.querySelector('[data-works-page="next"]');
  const margin = root.querySelector("[data-works-margin]");
  const marginQuote = root.querySelector("[data-works-margin-quote]");
  const marginTitle = root.querySelector("[data-works-margin-title]");
  const compact = window.matchMedia("(max-width: 640px)");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const animations = new Set();
  let marginAnimation = null;
  let selectedCard = null;
  let activeLine = "all";
  let page = 0;
  let pageSize = compact.matches ? 2 : 4;
  const visibleCards = () => cards.filter((card) => !card.hidden);
  const focusFirst = () => visibleCards()[0]?.querySelector("a, summary")?.focus();

  const cancelAnimations = () => {
    animations.forEach((animation) => animation.cancel());
    animations.clear();
    marginAnimation = null;
  };

  const enter = (node, index = 0) => {
    if (motion.matches || document.hidden || typeof node?.animate !== "function") return null;
    const animation = node.animate([
      { opacity: .45, transform: "translateY(6px)" },
      { opacity: 1, transform: "translateY(0)" }
    ], { duration: 200, delay: index * 30, easing: "cubic-bezier(.23, 1, .32, 1)", fill: "backwards" });
    animations.add(animation);
    const release = () => {
      animations.delete(animation);
      if (marginAnimation === animation) marginAnimation = null;
    };
    animation.finished.then(release, release);
    return animation;
  };

  const selectCard = (card, animate = false) => {
    if (!(card instanceof HTMLElement) || card.hidden) return;
    if (!animate && marginAnimation) {
      animations.delete(marginAnimation);
      marginAnimation.cancel();
      marginAnimation = null;
    }
    if (card === selectedCard) return;
    selectedCard = card;
    cards.forEach((item) => {
      const selected = item === card;
      item.classList.toggle("is-selected", selected);
    });
    root.dataset.selectedProject = card.dataset.projectId ?? "";
    if (marginAnimation) {
      animations.delete(marginAnimation);
      marginAnimation.cancel();
      marginAnimation = null;
    }
    if (marginQuote) marginQuote.textContent = card.dataset.projectNote ?? "";
    if (marginTitle) marginTitle.textContent = card.dataset.projectTitle ?? "";
    if (animate) marginAnimation = enter(margin);
  };

  const applyFilter = (line, targetPage = 0, animate = false) => {
    cancelAnimations();
    activeLine = line;
    const active = buttons.find((button) => button.dataset.worksFilter === line) ?? buttons[0];
    filterButtonState(buttons, active);
    const matching = cards.filter((card) => line === "all" || card.dataset.projectLine === line);
    const shown = matching.length;
    page = Math.max(0, Math.min(targetPage, Math.ceil(shown / pageSize) - 1));
    const start = page * pageSize;
    const visible = matching.slice(start, start + pageSize);
    cards.forEach((card) => {
      const matches = visible.includes(card);
      card.hidden = !matches;
      if (!matches) card.querySelector("details")?.removeAttribute("open");
    });
    if (count) count.textContent = String(shown).padStart(2, "0");
    if (empty) empty.hidden = shown !== 0;
    const [first] = visibleCards();
    if (first) selectCard(first);
    else {
      cards.forEach((card) => card.classList.remove("is-selected"));
      selectedCard = null;
      root.dataset.selectedProject = "";
      if (marginQuote) marginQuote.textContent = "";
      if (marginTitle) marginTitle.textContent = "";
    }
    root.dataset.filter = line;
    if (pager) pager.hidden = shown <= pageSize;
    if (previous) previous.disabled = page === 0;
    if (next) next.disabled = start + pageSize >= shown;
    if (range) range.textContent = shown ? `${start + 1}–${Math.min(start + pageSize, shown)} / ${shown}` : "0 / 0";
    root.dataset.worksReady = "true";
    if (animate) visible.forEach((card, index) => enter(card, index));
  };

  const onFilters = (event) => {
    const pageButton = event.target instanceof Element ? event.target.closest("[data-works-page]") : null;
    if (pageButton instanceof HTMLElement && root.contains(pageButton) && !pageButton.disabled) {
      applyFilter(activeLine, page + (pageButton.dataset.worksPage === "next" ? 1 : -1), event.detail !== 0);
      if (event.detail === 0) focusFirst();
      return;
    }
    const button = event.target instanceof Element ? event.target.closest("[data-works-filter]") : null;
    if (!(button instanceof HTMLElement) || !root.contains(button)) return;
    applyFilter(button.dataset.worksFilter ?? "all", 0, event.detail !== 0);
  };

  const onCardPointer = (event) => {
    const card = event.target instanceof Element ? event.target.closest("[data-project-id]") : null;
    if (!(card instanceof HTMLElement) || !root.contains(card)) return;
    if (event.type === "focusin") cancelAnimations();
    selectCard(card, event.type === "pointerenter");
  };

  root.addEventListener("click", onFilters);
  root.addEventListener("pointerenter", onCardPointer, true);
  root.addEventListener("focusin", onCardPointer);
  const onResize = () => {
    const focusedCard = document.activeElement ? cards.find((card) => card.contains(document.activeElement)) : null;
    const first = page * pageSize;
    pageSize = compact.matches ? 2 : 4;
    applyFilter(activeLine, Math.floor(first / pageSize));
    if (focusedCard?.hidden) focusFirst();
  };
  compact.addEventListener("change", onResize);
  const onMotion = () => { if (motion.matches) cancelAnimations(); };
  const onVisibility = () => { if (document.hidden) cancelAnimations(); };
  motion.addEventListener("change", onMotion);
  document.addEventListener("visibilitychange", onVisibility);
  applyFilter("all");

  const preset = new URLSearchParams(window.location.search).get("line");
  if (preset && buttons.some((button) => button.dataset.worksFilter === preset)) applyFilter(preset);

  const cleanup = () => {
    cancelAnimations();
    root.removeEventListener("click", onFilters);
    root.removeEventListener("pointerenter", onCardPointer, true);
    root.removeEventListener("focusin", onCardPointer);
    compact.removeEventListener("change", onResize);
    motion.removeEventListener("change", onMotion);
    document.removeEventListener("visibilitychange", onVisibility);
    document.removeEventListener("astro:before-swap", cleanup);
    if (window.__yuimiKisaraInnerCleanup === cleanup) window.__yuimiKisaraInnerCleanup = null;
  };
  document.addEventListener("astro:before-swap", cleanup, { once: true });
  return cleanup;
}
