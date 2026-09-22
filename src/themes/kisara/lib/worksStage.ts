type StageOptions = {
  signal: AbortSignal;
  onHeroActive: (active: boolean) => void;
  onLeavePrep: () => void;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function getWorksPanelFit(width: number, height: number, availableWidth: number, availableHeight: number) {
  if (![width, height, availableWidth, availableHeight].every(value => Number.isFinite(value) && value > 0)) return 1;
  return Math.min(1, Math.max(1, availableWidth - 32) / width, Math.max(1, availableHeight - 32) / height);
}

export function bindWorksStage(track: HTMLElement, options: StageOptions) {
  const stage = track.querySelector<HTMLElement>("[data-works-stage]")!;
  const hero = track.querySelector<HTMLElement>("[data-kisara-works-hero]")!;
  const kitchen = track.querySelector<HTMLElement>("[data-kisara-kitchen]")!;
  const scrim = track.querySelector<HTMLElement>("[data-works-stage-scrim]")!;
  const editorial = track.querySelector<HTMLElement>("[data-works-editorial-exit]");
  const fruits = track.querySelector<HTMLElement>("[data-works-slice-field]");
  const enter = track.querySelector<HTMLElement>("[data-works-enter]");
  const header = document.querySelector<HTMLElement>(".kisara-header");
  const tabs = [...track.querySelectorAll<HTMLButtonElement>("[data-kitchen-tab]")];
  const panels = [...track.querySelectorAll<HTMLElement>("[data-kitchen-panel]")];
  const panelContents = panels.map(panel => ({
    panel, content: panel.querySelector<HTMLElement>(".kisara-kitchen-counter, .kisara-drink-result")
  }));
  const fitPanels = () => {
    for (const { panel, content } of panelContents) {
      if (!content || panel.hidden || !panel.clientWidth || !panel.clientHeight) continue;
      // Untransformed local sizes exclude theme zoom and do not compound the last fit.
      const fit = getWorksPanelFit(
        Math.max(content.offsetWidth, content.scrollWidth),
        Math.max(content.offsetHeight, content.scrollHeight),
        panel.clientWidth, panel.clientHeight
      );
      content.style.setProperty("--works-panel-fit", String(fit));
    }
  };
  const parts = [...kitchen.querySelectorAll<HTMLElement>(
    ".kisara-kitchen-toolbar, .kisara-kitchen-pantry, .kisara-kitchen-prep, .kisara-appliance-deck"
  )];
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let top = 0;
  let distance = 1;
  let frame = 0;
  let disposed = false;
  let heroActive = true;
  let prepActive = false;
  let focusOnEntry = false;
  let selected = "prep";
  const { signal } = options;
  const motions: { animation: Animation; start: number; end: number }[] = [];
  parts.forEach((part, index) => {
    if (!part.animate || reduced) return;
    const animation = part.animate([
      { opacity: 0, transform: `translateY(${index === 0 ? 16 : 64 + index * 12}px)` },
      { opacity: 1, transform: "translateY(0)" }
    ], { duration: 1000, fill: "both", easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
    animation.pause();
    animation.currentTime = 0;
    motions.push({ animation, start: .22 + index * .055, end: .75 + index * .07 });
  });

  const sync = () => {
    frame = 0;
    if (disposed) return;
    const progress = clamp((window.scrollY - top) / distance);
    const exit = clamp(progress / .52);
    if (editorial) {
      editorial.style.opacity = String(1 - exit);
      editorial.style.transform = reduced ? "none" : `translateY(${exit * -42}px)`;
    }
    if (fruits) fruits.style.opacity = String(1 - exit);
    if (enter) enter.style.opacity = String(1 - exit);
    scrim.style.opacity = String(clamp((progress - .14) / .7));
    kitchen.style.visibility = progress > .2 ? "visible" : "hidden";
    // The toolbar becomes usable as soon as the worktop is visible. Keeping
    // the whole kitchen inert until the final scroll position made visible tabs
    // look clickable while silently rejecting every pointer and key event.
    kitchen.inert = progress <= .2;
    hero.inert = progress >= .2;
    motions.forEach(({ animation, start, end }) => {
      animation.currentTime = clamp((progress - start) / (end - start)) * 1000;
    });
    // Translated entry artwork contributes to scrollHeight; measure this frame,
    // not the previous scroll position's animation offsets.
    fitPanels();
    const nextHeroActive = progress < .2;
    if (heroActive !== nextHeroActive) {
      heroActive = nextHeroActive;
      options.onHeroActive(heroActive);
    }
    const nextPrepActive = !kitchen.inert && selected === "prep";
    if (prepActive && !nextPrepActive) options.onLeavePrep();
    prepActive = nextPrepActive;
    if (focusOnEntry && progress >= .995) {
      focusOnEntry = false;
      tabs.find(tab => tab.dataset.kitchenTab === selected)?.focus({ preventScroll: true });
    }
  };
  const schedule = () => {
    if (!disposed && !frame) frame = window.requestAnimationFrame(sync);
  };
  const measure = () => {
    if (disposed) return;
    const bounds = stage.getBoundingClientRect();
    const scale = bounds.height / Math.max(1, stage.clientHeight);
    const headerBottom = header?.getBoundingClientRect().bottom ?? 0;
    stage.style.setProperty("--works-header-space", `${Math.max(0, headerBottom) / Math.max(.1, scale) + 12}px`);
    top = track.getBoundingClientRect().top + window.scrollY;
    distance = Math.max(240, bounds.height * .65);
    track.style.height = `${(bounds.height + distance) / Math.max(.1, scale)}px`;
    schedule();
  };
  const showPanel = (name: string, focus = false) => {
    if (disposed || !panels.some(panel => panel.dataset.kitchenPanel === name)) return;
    if (selected === "prep" && name !== selected) options.onLeavePrep();
    selected = name;
    kitchen.dataset.activePanel = name;
    tabs.forEach(tab => {
      const active = tab.dataset.kitchenTab === name;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      if (focus && active) tab.focus({ preventScroll: true });
    });
    panels.forEach(panel => {
      panel.hidden = panel.dataset.kitchenPanel !== name;
      panel.inert = panel.hidden;
    });
    fitPanels();
    prepActive = !kitchen.inert && name === "prep";
    // A timer may finish while the user has scrolled back to the opening.
    // Keep the new result selected, but never pull focus out of that opening.
    if (!kitchen.inert && panels.some(panel => panel.hidden && panel.contains(document.activeElement))) {
      tabs.find(tab => tab.dataset.kitchenTab === name)?.focus({ preventScroll: true });
    }
  };
  const enterKitchen = (focus = false) => {
    focusOnEntry = focus;
    window.scrollTo({ top: top + distance, behavior: reduced ? "instant" : "smooth" });
    schedule();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => showPanel(tab.dataset.kitchenTab!, true), { signal });
    tab.addEventListener("keydown", event => {
      const key = event.key;
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return;
      event.preventDefault();
      const next = key === "Home" ? 0 : key === "End" ? tabs.length - 1
        : (index + (key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      showPanel(tabs[next].dataset.kitchenTab!, true);
    }, { signal });
  });
  enter?.addEventListener("click", event => {
    event.preventDefault();
    enterKitchen(true);
  }, { signal });
  kitchen.querySelector("[data-works-return]")?.addEventListener("click", () => {
    options.onLeavePrep();
    focusOnEntry = false;
    window.scrollTo({ top, behavior: "instant" });
    sync();
    enter?.focus({ preventScroll: true });
  }, { signal });
  const followHash = () => {
    if (location.hash === "#kisara-kitchen-lab") enterKitchen();
    if (location.hash === "#kisara-result-panel") { showPanel("result"); enterKitchen(); }
  };
  track.setAttribute("data-stage-ready", "");
  showPanel("prep");
  measure();
  sync();
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
  observer?.observe(stage);
  if (header) observer?.observe(header);
  panelContents.forEach(({ panel, content }) => {
    observer?.observe(panel);
    if (content) observer?.observe(content);
  });
  window.addEventListener("scroll", schedule, { passive: true, signal });
  window.addEventListener("resize", measure, { passive: true, signal });
  window.visualViewport?.addEventListener("resize", measure, { passive: true, signal });
  window.addEventListener("hashchange", followHash, { signal });
  window.addEventListener("pageshow", measure, { signal });
  followHash();
  const cleanup = () => {
    disposed = true;
    observer?.disconnect();
    window.cancelAnimationFrame(frame);
    motions.forEach(({ animation }) => animation.cancel());
    track.removeAttribute("data-stage-ready");
    track.style.removeProperty("height");
    stage.style.removeProperty("--works-header-space");
    panelContents.forEach(({ content }) => content?.style.removeProperty("--works-panel-fit"));
    kitchen.style.removeProperty("visibility");
    delete kitchen.dataset.activePanel;
    hero.inert = kitchen.inert = false;
    panels.forEach(panel => { panel.hidden = panel.inert = false; });
    [editorial, fruits, enter, scrim].forEach(node => {
      node?.style.removeProperty("opacity");
      node?.style.removeProperty("transform");
    });
  };
  signal.addEventListener("abort", cleanup, { once: true });
  return { showPanel, enterKitchen };
}
