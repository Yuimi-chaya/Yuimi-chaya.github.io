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
  const visibleCards = () => cards.filter((card) => !card.hidden);

  const selectCard = (card) => {
    if (!(card instanceof HTMLElement) || card.hidden) return;
    cards.forEach((item) => {
      const selected = item === card;
      item.classList.toggle("is-selected", selected);
    });
    root.dataset.selectedProject = card.dataset.projectId ?? "";
  };

  const applyFilter = (line) => {
    const active = buttons.find((button) => button.dataset.worksFilter === line) ?? buttons[0];
    filterButtonState(buttons, active);
    let shown = 0;
    cards.forEach((card) => {
      const matches = line === "all" || card.dataset.projectLine === line;
      card.hidden = !matches;
      if (matches) shown += 1;
    });
    if (count) count.textContent = String(shown).padStart(2, "0");
    if (empty) empty.hidden = shown !== 0;
    const [first] = visibleCards();
    if (first) selectCard(first);
    else {
      cards.forEach((card) => card.classList.remove("is-selected"));
      root.dataset.selectedProject = "";
    }
    root.dataset.filter = line;
  };

  const onFilters = (event) => {
    const button = event.target instanceof Element ? event.target.closest("[data-works-filter]") : null;
    if (!(button instanceof HTMLElement) || !root.contains(button)) return;
    applyFilter(button.dataset.worksFilter ?? "all");
  };

  const onCardPointer = (event) => {
    const card = event.target instanceof Element ? event.target.closest("[data-project-id]") : null;
    if (!(card instanceof HTMLElement) || !root.contains(card)) return;
    selectCard(card);
  };

  root.addEventListener("click", onFilters);
  root.addEventListener("pointerenter", onCardPointer, true);
  root.addEventListener("focusin", onCardPointer);
  applyFilter("all");

  const preset = new URLSearchParams(window.location.search).get("line");
  if (preset && buttons.some((button) => button.dataset.worksFilter === preset)) applyFilter(preset);

  const cleanup = () => {
    root.removeEventListener("click", onFilters);
    root.removeEventListener("pointerenter", onCardPointer, true);
    root.removeEventListener("focusin", onCardPointer);
    document.removeEventListener("astro:before-swap", cleanup);
    if (window.__yuimiKisaraInnerCleanup === cleanup) window.__yuimiKisaraInnerCleanup = null;
  };
  document.addEventListener("astro:before-swap", cleanup, { once: true });
  return cleanup;
}
