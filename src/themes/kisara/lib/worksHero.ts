import { waitForVideoFrame } from "./videoFrame.ts";
import { bindVideoStill } from "./videoStill.ts";

export function bindWorksHero(root: HTMLElement) {
  const hero = root.querySelector<HTMLElement>("[data-works-intro]");
  const video = hero?.querySelector<HTMLVideoElement>("[data-works-intro-video]");
  if (!hero || !video) return () => {};

  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const replay = hero.querySelector<HTMLButtonElement>("[data-works-intro-replay]");
  bindVideoStill(video, hero.querySelector<HTMLImageElement>(".kisara-index-film-still"), signal);
  let visible = false;
  let suspended = document.hidden;
  let completed = false;
  let pending = false;
  let generation = 0;
  let frameController: AbortController | null = null;
  const state = (value: string) => { hero.dataset.videoState = value; };

  const pause = () => {
    generation++;
    pending = false;
    frameController?.abort();
    frameController = null;
    video.pause();
  };

  const play = async (restart = false) => {
    if (signal.aborted || motion.matches || suspended || !visible) return;
    if (!restart && video.ended) {
      completed = true;
      pause();
      state("complete");
      return;
    }
    if ((pending || completed) && !restart) return;
    pause();
    const attempt = generation;
    pending = true;
    if (restart) {
      completed = false;
      hero.removeAttribute("data-frame-ready");
      try { video.currentTime = 0; } catch {}
    }
    if (!video.hasAttribute("src") || video.error) {
      video.src = video.dataset.src!;
      video.preload = "auto";
      video.load();
    }
    state("loading");
    frameController = new AbortController();
    void waitForVideoFrame(video, frameController.signal).then(ready => {
      if (signal.aborted || attempt !== generation || completed) return;
      if (ready) {
        hero.setAttribute("data-frame-ready", "");
        state("playing");
      } else {
        pause();
        state("static");
      }
    });
    try {
      await video.play();
      if (signal.aborted || attempt !== generation || completed) return;
      pending = false;
    } catch {
      if (signal.aborted || attempt !== generation || completed) return;
      pause();
      state("static");
    }
  };

  const refresh = () => {
    if (signal.aborted) return;
    if (motion.matches) {
      pause();
      state("static");
      return;
    }
    if (!visible || suspended) pause();
    else if (!completed && video.ended) {
      completed = true;
      pause();
      state("complete");
    } else if (!completed && !pending && video.paused) void play();
  };
  const onMotion = () => {
    if (replay) replay.hidden = motion.matches;
    refresh();
  };
  const onVisibility = () => {
    suspended = document.hidden;
    refresh();
  };
  const onPageHide = () => {
    suspended = true;
    pause();
  };
  const onPageShow = (event: PageTransitionEvent) => {
    suspended = document.hidden;
    if (event.persisted) {
      pause();
      completed = false;
      hero.removeAttribute("data-frame-ready");
      try { video.currentTime = 0; } catch {}
      state(motion.matches ? "static" : "idle");
      refresh();
    }
  };
  const onReplay = () => {
    void play(true);
  };
  const onEnded = () => {
    if (!video.ended) return;
    completed = true;
    pause();
    state("complete");
  };
  const onError = () => {
    pause();
    state("static");
  };
  const onCanPlay = () => {
    if (!completed && video.paused) refresh();
  };
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    refresh();
  }, { threshold: 0 });

  video.muted = true;
  // Keep the first poster visible until a real video frame is decoded.
  state(motion.matches ? "static" : "idle");
  hero.dataset.introReady = "true";
  if (replay) replay.hidden = motion.matches;
  observer.observe(hero);
  motion.addEventListener("change", onMotion);
  document.addEventListener("visibilitychange", onVisibility, { signal });
  window.addEventListener("pagehide", onPageHide, { signal });
  window.addEventListener("pageshow", onPageShow, { signal });
  replay?.addEventListener("click", onReplay, { signal });
  video.addEventListener("ended", onEnded, { signal });
  video.addEventListener("error", onError, { signal });
  video.addEventListener("canplay", onCanPlay, { signal });

  return () => {
    if (signal.aborted) return;
    lifecycle.abort();
    pause();
    observer.disconnect();
    motion.removeEventListener("change", onMotion);
    delete hero.dataset.introReady;
  };
}
