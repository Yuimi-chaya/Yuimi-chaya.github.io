// Entry motion belongs to the cover, never to the photograph's size.
export function bindGameEntry(scene: HTMLElement, signal: AbortSignal) {
  const image = scene.querySelector<HTMLImageElement>(".kisara-event-photo > img");
  const photo = scene.querySelector<HTMLElement>(".kisara-event-photo");
  const cover = scene.querySelector<HTMLElement>("[data-game-entry]");
  const status = scene.querySelector<HTMLElement>("[data-game-entry-status]");
  const retry = scene.querySelector<HTMLButtonElement>("[data-game-entry-retry]");
  if (!image || !photo || !cover || !status || !retry || signal.aborted) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const timers = new Set<number>();
  let run = 0;
  let ended = false;
  let decoding = false;
  let minimumElapsed = false;
  let mediaReady = false;
  let fontsReady = false;
  const clearTimers = () => { timers.forEach(id => window.clearTimeout(id)); timers.clear(); };
  const later = (callback: () => void, delay: number) => {
    const id = window.setTimeout(() => { timers.delete(id); if (!signal.aborted) callback(); }, delay);
    timers.add(id);
  };
  const finish = (state: "complete" | "fallback") => {
    if (signal.aborted || ended) return;
    ended = true;
    clearTimers();
    scene.dataset.entryState = state;
    photo.inert = false;
    photo.removeAttribute("aria-busy");
    cover.hidden = true;
    scene.dispatchEvent(new CustomEvent("kisara:game-entry-ready"));
  };
  const open = () => {
    if (signal.aborted || ended || !mediaReady || !fontsReady || !minimumElapsed || scene.dataset.entryState !== "loading") return;
    clearTimers();
    status.textContent = "取景器已就绪";
    scene.dataset.entryState = "opening";
    later(() => finish("complete"), reduced.matches ? 0 : 280);
  };
  const fail = () => {
    if (signal.aborted || ended) return;
    run += 1;
    decoding = false;
    clearTimers();
    scene.dataset.entryState = "error";
    status.textContent = "底片暂未载入";
    retry.hidden = false;
    photo.inert = false;
    photo.removeAttribute("aria-busy");
  };
  const decode = async () => {
    if (signal.aborted || ended || decoding || scene.dataset.entryState !== "loading") return;
    decoding = true;
    const current = run;
    try { await image.decode?.(); } catch { /* A loaded image can survive an interrupted decode. */ }
    if (signal.aborted || ended || current !== run) return;
    decoding = false;
    if (!image.complete || image.naturalWidth <= 0) { fail(); return; }
    mediaReady = true;
    open();
  };
  const begin = () => {
    clearTimers();
    run += 1;
    const current = run;
    ended = false;
    decoding = false;
    minimumElapsed = reduced.matches;
    mediaReady = false;
    fontsReady = false;
    cover.hidden = false;
    retry.hidden = true;
    scene.dataset.entryState = "loading";
    status.textContent = "正在调取底片";
    photo.inert = true;
    photo.setAttribute("aria-busy", "true");
    later(() => { minimumElapsed = true; open(); }, reduced.matches ? 0 : 240);
    later(() => { if (image.complete && image.naturalWidth === 0) fail(); else finish("fallback"); }, 6000);
    const fontsSettled = () => {
      if (signal.aborted || ended || current !== run) return;
      fontsReady = true;
      open();
    };
    Promise.resolve(document.fonts?.ready).then(fontsSettled, fontsSettled);
    if (image.complete) void decode();
  };
  image.addEventListener("load", () => void decode(), { signal });
  image.addEventListener("error", fail, { signal });
  retry.addEventListener("click", () => {
    // Move focus out of the cover before it becomes hidden.
    scene.closest<HTMLElement>("[data-game-scene]")?.focus({ preventScroll: true });
    image.src = image.currentSrc || image.src;
    begin();
  }, { signal });
  signal.addEventListener("abort", () => {
    run += 1;
    ended = true;
    clearTimers();
    photo.inert = false;
    photo.removeAttribute("aria-busy");
  }, { once: true });
  begin();
}
