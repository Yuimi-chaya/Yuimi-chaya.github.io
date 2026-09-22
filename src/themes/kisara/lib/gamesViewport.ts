export function getGameViewportFit(width: number, height: number, availableWidth: number, availableHeight: number) {
  if (![width, height, availableWidth, availableHeight].every(value => Number.isFinite(value) && value > 0)) return 1;
  return Math.min(1, Math.max(1, availableWidth - 4) / width, Math.max(1, availableHeight - 4) / height);
}

export function bindGamesViewport(page: HTMLElement) {
  const slots = Array.from(page.querySelectorAll<HTMLElement>("[data-game-viewport]"));
  let frame = 0;
  let disposed = false;
  const update = () => {
    if (disposed) return;
    for (const slot of slots) {
      if (slot.closest<HTMLElement>("[data-game-scene]")?.hidden) continue;
      const content = slot.querySelector<HTMLElement>("[data-game-fit]");
      if (!content || slot.clientWidth <= 0 || slot.clientHeight <= 0) continue;
      // offset/scroll sizes are untransformed local pixels, already excluding theme zoom.
      const width = Math.max(content.offsetWidth, content.scrollWidth);
      const height = Math.max(content.offsetHeight, content.scrollHeight);
      const scale = getGameViewportFit(width, height, slot.clientWidth, slot.clientHeight);
      content.style.setProperty("--game-fit-scale", String(scale));
    }
  };
  const schedule = () => {
    if (!disposed && !frame) frame = window.requestAnimationFrame(() => {
      frame = 0;
      update();
    });
  };
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
  for (const slot of slots) {
    observer?.observe(slot);
    const content = slot.querySelector<HTMLElement>("[data-game-fit]");
    if (content) observer?.observe(content);
  }
  window.addEventListener("resize", schedule, { passive: true });
  window.visualViewport?.addEventListener("resize", schedule, { passive: true });
  return {
    update,
    cleanup() {
      disposed = true;
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("resize", schedule);
      slots.forEach(slot => slot.querySelector<HTMLElement>("[data-game-fit]")?.style.removeProperty("--game-fit-scale"));
    }
  };
}
