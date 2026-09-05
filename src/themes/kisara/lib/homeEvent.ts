export const homeEventDuration = 1.292958;

export function visibleSceneRatio(rect: Pick<DOMRect, "top" | "bottom" | "height">, viewport: number) {
  const height = Math.max(1, viewport);
  const overlap = Math.max(0, Math.min(rect.bottom, height) - Math.max(rect.top, 0));
  return overlap / Math.min(Math.max(1, rect.height), height);
}

export function nextNotebookTab(key: string, current: number, length: number) {
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  if (key === "ArrowRight" || key === "ArrowDown") return (current + 1) % length;
  if (key === "ArrowLeft" || key === "ArrowUp") return (current + length - 1) % length;
  return current;
}

export function bindHomeEvent(root: HTMLElement) {
  const controller = new AbortController();
  const { signal } = controller;
  const video = root.querySelector<HTMLVideoElement>("[data-home-event-video]")!;
  const source = video.querySelector<HTMLSourceElement>("source[data-src]")!;
  const replay = root.querySelector<HTMLButtonElement>("[data-home-event-replay]")!;
  const time = root.querySelector<HTMLOutputElement>("[data-home-event-time]");
  const status = root.querySelector<HTMLElement>("[data-home-event-status]");
  const progress = root.querySelector<HTMLElement>("[data-home-event-progress]");
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-notebook-tab]"));
  const panels = Array.from(root.querySelectorAll<HTMLElement>("[data-notebook-panel]"));
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let visible = false;
  let suspended = document.hidden;
  let completed = false;
  let started = false;
  let pending = false;
  let generation = 0;
  let frame = 0;
  let watchdog = 0;
  let selected = 0;
  let lastTime = "";

  const select = (index: number, focus = false) => {
    selected = index;
    tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    if (focus) tabs[index].focus({ preventScroll: true });
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => select(index), { signal });
    tab.addEventListener("keydown", (event) => {
      if (!["Home", "End", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      select(nextNotebookTab(event.key, selected, tabs.length), true);
    }, { signal });
  });
  select(0);
  root.dataset.notebookReady = "true";

  const state = (value: string, label: string) => {
    if (root.dataset.state !== value) root.dataset.state = value;
    if (status && status.textContent !== label) status.textContent = label;
  };
  const hydrate = () => {
    if (source.hasAttribute("src") || signal.aborted) return;
    source.src = source.dataset.src!;
    video.preload = "auto";
    video.load();
  };
  const sync = () => {
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : homeEventDuration;
    const current = Math.max(0, video.currentTime || 0);
    if (progress) progress.style.transform = `scaleX(${Math.min(1, current / duration).toFixed(4)})`;
    const label = current.toFixed(1).padStart(4, "0");
    if (time && label !== lastTime) {
      lastTime = label;
      time.textContent = label;
    }
  };
  const stopClock = () => {
    if (frame) video.cancelVideoFrameCallback?.(frame);
    frame = 0;
    window.clearTimeout(watchdog);
    watchdog = 0;
  };
  const clock = () => {
    frame = 0;
    if (signal.aborted || suspended || !visible || video.paused || video.ended) return;
    sync();
    if (video.requestVideoFrameCallback) frame = video.requestVideoFrameCallback(clock);
  };
  const pause = () => {
    generation += 1;
    pending = false;
    stopClock();
    video.pause();
  };
  const play = async (restart = false, explicit = false) => {
    if (signal.aborted || suspended || !visible || pending || (!explicit && motion.matches)) return;
    const attempt = ++generation;
    pending = true;
    hydrate();
    if (restart) {
      completed = false;
      if (video.error) video.load();
      try { video.currentTime = 0; } catch {}
      sync();
    }
    state("loading", "LOADING");
    window.clearTimeout(watchdog);
    watchdog = window.setTimeout(() => {
      if (signal.aborted || attempt !== generation || completed) return;
      pause();
      state("ready", "REPLAY");
    }, 6000);
    try {
      await video.play();
      // An older play promise must never pause a newer replay.
      if (signal.aborted || attempt !== generation) return;
      pending = false;
      started = true;
      if (suspended || !visible) pause();
    } catch {
      if (signal.aborted || attempt !== generation) return;
      pending = false;
      stopClock();
      state("ready", "REPLAY");
    }
  };
  const refresh = () => {
    if (signal.aborted) return;
    const next = !suspended && !document.hidden
      && visibleSceneRatio(root.getBoundingClientRect(), window.innerHeight) >= .35;
    root.toggleAttribute("data-scene-visible", next);
    if (next === visible) return;
    visible = next;
    if (!next) pause();
    else if (!completed) void play(!started);
  };
  const reset = () => {
    pause();
    completed = false;
    started = false;
    visible = false;
    try { video.currentTime = 0; } catch {}
    select(0);
    sync();
    state("idle", "AFTER CLASS");
  };
  const suspend = () => {
    suspended = true;
    visible = false;
    root.removeAttribute("data-scene-visible");
    pause();
  };
  const resume = () => {
    suspended = document.hidden;
    refresh();
  };

  replay.addEventListener("click", () => {
    if (document.hidden) return;
    visible = visibleSceneRatio(root.getBoundingClientRect(), window.innerHeight) > 0;
    if (!visible) return;
    pause();
    void play(true, true);
  }, { signal });
  video.addEventListener("playing", () => {
    if (suspended || !visible) { pause(); return; }
    state("playing", "ON RECORD");
    if (frame) video.cancelVideoFrameCallback?.(frame);
    clock();
  }, { signal });
  video.addEventListener("timeupdate", sync, { signal });
  video.addEventListener("loadedmetadata", sync, { signal });
  video.addEventListener("pause", () => {
    stopClock();
    if (!completed && started) state("paused", "HELD");
  }, { signal });
  video.addEventListener("ended", () => {
    completed = true;
    pending = false;
    stopClock();
    sync();
    state("complete", "AFTER CLASS");
  }, { signal });
  video.addEventListener("error", () => {
    pause();
    state("error", "STILL FRAME");
  }, { signal });
  document.addEventListener("visibilitychange", () => document.hidden ? suspend() : resume(), { signal });
  window.addEventListener("pagehide", suspend, { signal });
  window.addEventListener("pageshow", resume, { signal });
  document.addEventListener("freeze", suspend, { signal });
  document.addEventListener("resume", resume, { signal });
  motion.addEventListener("change", () => {
    if (motion.matches) pause();
    else if (visible && !completed) void play();
  }, { signal });

  const preloadObserver = typeof IntersectionObserver === "function" ? new IntersectionObserver((entries) => {
    if (document.hidden || !entries.some(entry => entry.isIntersecting)) return;
    if (!motion.matches) hydrate();
    preloadObserver?.disconnect();
  }, { rootMargin: "45% 0px" }) : null;
  const visibilityObserver = typeof IntersectionObserver === "function"
    ? new IntersectionObserver(refresh, { threshold: [0, .15, .35, .6, 1] }) : null;
  if (!visibilityObserver) window.addEventListener("scroll", refresh, { passive: true, signal });
  window.addEventListener("resize", refresh, { passive: true, signal });
  preloadObserver?.observe(root);
  visibilityObserver?.observe(root);
  refresh();
  return {
    reset,
    refresh,
    destroy() {
      pause();
      controller.abort();
      preloadObserver?.disconnect();
      visibilityObserver?.disconnect();
    },
  };
}
