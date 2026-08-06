type StageMode = "auto" | "still" | "scrub" | "legacy";
type StageRenderer = "stage" | "legacy";
type StagePhase = "boot" | "transition" | "playing" | "still" | "scrub" | "legacy" | "legacy-release" | "final" | "waiting";
type LegacyBeat = "embrace" | "kiss" | "smoke" | "detail" | "silhouette" | "release" | "fight";

interface StageSceneConfig {
  id: string;
  order: number;
  mode: StageMode;
  renderer: StageRenderer;
  media: "image" | "video";
  src: string;
  poster?: string;
  lastPoster?: string;
  legacyBeat?: LegacyBeat;
  group: "intercept" | "contract" | "intimacy" | "transformation" | "jealousy";
  hold: number;
}

interface StageSceneNode {
  config: StageSceneConfig;
  element: HTMLElement | null;
  image: HTMLImageElement | null;
  video: HTMLVideoElement | null;
  firstFrame: HTMLImageElement | null;
  holdFrame: HTMLImageElement | null;
}

interface SavedStageState {
  version: 3;
  index: number;
  settled: boolean;
  scrubProgress: number;
}

interface LegacyStageBridge {
  activate?: () => void;
  setBeat?: (beat: Exclude<LegacyBeat, "release" | "fight">) => void;
  release?: () => void;
  settleFight?: () => void;
  reset?: () => void;
  hide?: () => void;
  setFinalStage?: () => void;
}

type KisaraWindow = Window & typeof globalThis & {
  __yuimiKisaraStageHomeCleanup?: (() => void) | null;
  __yuimiKisaraStageHomeSchedule?: (() => void) | null;
  __yuimiKisaraStageHomeInitTimer?: number;
  __yuimiKisaraStageHomeLifecycleBound?: boolean;
  __yuimiKisaraLegacyStage?: LegacyStageBridge | null;
  __yuimiKisaraLovebrainProgress?: {
    markSpareKey?: () => boolean;
    markStage?: (id: string) => boolean;
    isEligible?: () => boolean;
  };
  __yuimiKisaraHomeLovebrain?: {
    activate?: () => boolean;
  } | null;
  __yuimiKisaraEasterLedger?: {
    mark?: (id: string) => boolean;
  };
  __yuimiKisaraHomeBootController?: {
    markReady?: () => void;
  };
};

const STORAGE_KEY = "yuimi-kisara-stage-home-v3";
const SCRUB_INDEX = 5;
const LEGACY_START_INDEX = 7;
const LEGACY_END_INDEX = 12;
const KISS_INDEX = 8;
const FINAL_INDEX = 13;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const frame = () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

const readManifest = (root: HTMLElement): StageSceneConfig[] => {
  const source = root.querySelector("[data-kisara-stage-manifest]")?.textContent ?? "[]";
  try {
    const parsed = JSON.parse(source);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readSavedState = (length: number): SavedStageState | null => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (parsed?.version !== 3 || !Number.isFinite(parsed.index)) return null;
    return {
      version: 3,
      index: clamp(Math.round(parsed.index), 0, Math.max(0, length - 1)),
      settled: parsed.settled === true,
      scrubProgress: clamp(Number(parsed.scrubProgress) || 0, 0, 1)
    };
  } catch {
    return null;
  }
};

const normalizeWheelDelta = (event: WheelEvent) => {
  const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? 18
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
      ? window.innerHeight
      : 1;
  return clamp(event.deltaY * scale, -180, 180);
};

const transitionProfile = (from: number, to: number) => {
  const key = `${from}-${to}`;
  const profiles: Record<string, string> = {
    "0-1": "ink-clear",
    "1-2": "eye-settle",
    "2-3": "shoulder-cut",
    "3-4": "hand-turn",
    "4-5": "blade-run",
    "5-6": "catch",
    "12-13": "jealous-cut"
  };
  return profiles[key] ?? "cross";
};

const transitionDuration = (profile: string, reducedMotion: boolean) => {
  if (reducedMotion) return 20;
  const durations: Record<string, number> = {
    "ink-clear": 230,
    "eye-settle": 360,
    "shoulder-cut": 220,
    "hand-turn": 280,
    "blade-run": 180,
    catch: 420,
    "legacy-open": 420,
    "legacy-return": 300,
    "jealous-cut": 260,
    cross: 280
  };
  return durations[profile] ?? durations.cross;
};

const createStageRuntime = (root: HTMLElement) => {
  const runtimeWindow = window as KisaraWindow;
  if (root.dataset.bound === "true") return;
  runtimeWindow.__yuimiKisaraStageHomeCleanup?.();
  root.dataset.bound = "true";

  const manifest = readManifest(root);
  if (manifest.length !== 14) {
    root.dataset.stageError = "manifest";
    runtimeWindow.__yuimiKisaraHomeBootController?.markReady?.();
    return;
  }

  const elements = new Map(
    Array.from(root.querySelectorAll<HTMLElement>("[data-stage-scene]")).map((element) => [element.dataset.stageScene ?? "", element])
  );
  const scenes: StageSceneNode[] = manifest.map((config) => {
    const element = elements.get(config.id) ?? null;
    return {
      config,
      element,
      image: element?.querySelector<HTMLImageElement>("[data-stage-image]") ?? null,
      video: element?.querySelector<HTMLVideoElement>("[data-stage-video]") ?? null,
      firstFrame: element?.querySelector<HTMLImageElement>("[data-stage-first-frame]") ?? null,
      holdFrame: element?.querySelector<HTMLImageElement>("[data-stage-hold-frame]") ?? null
    };
  });
  const copyNodes = Array.from(root.querySelectorAll<HTMLElement>("[data-stage-copy]"));
  const autoButton = root.querySelector<HTMLButtonElement>("[data-stage-auto]");
  const skipButton = root.querySelector<HTMLButtonElement>("[data-stage-skip]");
  const replayButton = root.querySelector<HTMLButtonElement>("[data-stage-replay]");
  const lovebrainButton = root.querySelector<HTMLButtonElement>("[data-stage-lovebrain-entry]");
  const scrub = root.querySelector<HTMLElement>("[data-stage-scrub]");
  const status = root.querySelector<HTMLElement>("[data-stage-status]");
  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  let disposed = false;
  let activeIndex = 0;
  let visibleStageIndex = -1;
  let phase: StagePhase = "boot";
  let transitionSerial = 0;
  let currentVideoCleanup: (() => void) | null = null;
  let minimumWatchUntil = 0;
  let autoEnabled = false;
  let autoTimer = 0;
  let legacySequenceTimer = 0;
  let legacySequenceDeadline = 0;
  let legacySequenceStep: (() => void) | null = null;
  let legacySequenceToken = 0;
  let legacySequenceActive = false;
  let wheelAccumulator = 0;
  let wheelResetTimer = 0;
  let lastWheelAt = 0;
  let inputLockUntil = 0;
  let scrubTarget = 0;
  let scrubVisual = 0;
  let scrubFrame = 0;
  let scrubSeekPending = false;
  let scrubLastTimestamp = 0;
  let scrubCompleteTimer = 0;
  let touchId: number | null = null;
  let touchStartY: number | null = null;
  let touchLastY: number | null = null;
  let touchScrubbing = false;
  let resumeVideoAfterVisibility = false;
  let finalQualified = false;
  let legacyReleaseComplete = false;

  const setStatus = (value: string) => {
    if (status) status.textContent = value;
  };

  const isLegacyIndex = (index: number) => index >= LEGACY_START_INDEX && index <= LEGACY_END_INDEX;

  const persist = (settled: boolean) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 3,
        index: activeIndex,
        settled,
        scrubProgress: activeIndex === SCRUB_INDEX ? scrubTarget : 0
      } satisfies SavedStageState));
    } catch {}
  };

  const publishProgress = (overrides: Partial<{
    active: boolean;
    progress: number;
    stage: string;
    guided: boolean;
    transitioning: boolean;
  }> = {}) => {
    const local = activeIndex === SCRUB_INDEX ? scrubVisual : 0;
    const progress = clamp((activeIndex + local) / FINAL_INDEX, 0, 1);
    const detail = {
      active: true,
      progress,
      stage: phase,
      guided: autoEnabled,
      transitioning: phase === "transition" || phase === "legacy-release",
      ...overrides
    };
    root.dataset.kisaraScrollActive = String(detail.active);
    root.dataset.kisaraScrollProgress = detail.progress.toFixed(5);
    root.dataset.kisaraScrollStage = detail.stage;
    root.dataset.kisaraScrollGuided = String(detail.guided);
    root.dataset.kisaraScrollTransitioning = String(detail.transitioning);
    root.style.setProperty("--stage-progress", detail.progress.toFixed(5));
    window.dispatchEvent(new CustomEvent("kisara:gate-progress", { detail }));
  };

  const updatePresentation = () => {
    const scene = scenes[activeIndex]?.config;
    const id = scene?.id ?? "01";
    root.dataset.stageScene = id;
    root.dataset.stageMode = scene?.mode ?? "still";
    root.dataset.stageState = phase;
    root.dataset.stageSettled = String(phase === "still" || phase === "legacy" || phase === "final");
    root.dataset.kisaraStageSettled = String(activeIndex === FINAL_INDEX && phase === "final");
    copyNodes.forEach((copy) => copy.classList.toggle("is-active", copy.dataset.stageCopy === id));
    if (scrub) scrub.setAttribute("aria-hidden", String(activeIndex !== SCRUB_INDEX));
    if (replayButton) replayButton.hidden = !(activeIndex === FINAL_INDEX && phase === "final");
    if (lovebrainButton) {
      lovebrainButton.hidden = !(
        activeIndex === FINAL_INDEX
        && phase === "final"
        && runtimeWindow.__yuimiKisaraLovebrainProgress?.isEligible?.() === true
      );
    }
    root.classList.toggle("is-scrub-active", activeIndex === SCRUB_INDEX && phase === "scrub");
    root.classList.toggle("is-legacy-active", isLegacyIndex(activeIndex));
  };

  const setFrameState = (index: number, state: "first" | "video" | "hold" | "still") => {
    scenes[index]?.element?.setAttribute("data-frame-state", state);
  };

  const loadImage = async (image: HTMLImageElement | null, eager = false) => {
    if (!(image instanceof HTMLImageElement)) return;
    if (!image.src) {
      const source = image.dataset.src;
      if (!source) return;
      image.loading = eager ? "eager" : "lazy";
      image.fetchPriority = eager ? "high" : "low";
      image.src = source;
      delete image.dataset.src;
    }
    if (image.complete && image.naturalWidth > 0) {
      try { await image.decode?.(); } catch {}
      return;
    }
    await new Promise<void>((resolve) => {
      const finish = () => resolve();
      image.addEventListener("load", finish, { once: true });
      image.addEventListener("error", finish, { once: true });
    });
    try { await image.decode?.(); } catch {}
  };

  const hydrateVideo = (video: HTMLVideoElement | null, source: string, eager = false) => {
    if (!(video instanceof HTMLVideoElement)) return;
    if (!video.src) {
      video.preload = eager ? "auto" : "metadata";
      video.src = video.dataset.src || source;
      delete video.dataset.src;
      video.load();
    }
  };

  const hydrateScene = async (index: number, eager = false) => {
    const node = scenes[index];
    if (!node || node.config.renderer !== "stage") return;
    if (node.config.media === "image") {
      await loadImage(node.image, eager);
      return;
    }
    await Promise.all([
      loadImage(node.firstFrame, eager),
      loadImage(node.holdFrame, eager)
    ]);
    hydrateVideo(node.video, node.config.src, eager);
  };

  const prewarmAround = (index: number) => {
    for (const candidate of [index + 1, index + 2]) {
      const scene = scenes[candidate];
      if (!scene || scene.config.renderer !== "stage") continue;
      void hydrateScene(candidate, candidate === index + 1);
    }
  };

  const stopCurrentVideo = () => {
    currentVideoCleanup?.();
    currentVideoCleanup = null;
    const video = scenes[activeIndex]?.video;
    video?.pause();
    minimumWatchUntil = 0;
  };

  const clearTimers = () => {
    if (autoTimer) window.clearTimeout(autoTimer);
    if (wheelResetTimer) window.clearTimeout(wheelResetTimer);
    if (scrubCompleteTimer) window.clearTimeout(scrubCompleteTimer);
    if (legacySequenceTimer) window.clearTimeout(legacySequenceTimer);
    autoTimer = 0;
    wheelResetTimer = 0;
    scrubCompleteTimer = 0;
    legacySequenceTimer = 0;
    legacySequenceDeadline = 0;
    legacySequenceStep = null;
    legacySequenceToken += 1;
    legacySequenceActive = false;
  };

  const scheduleLegacySequenceStep = (delay: number, callback: () => void) => {
    if (disposed || !legacySequenceActive) return;
    if (legacySequenceTimer) window.clearTimeout(legacySequenceTimer);
    const token = legacySequenceToken;
    legacySequenceStep = callback;
    legacySequenceDeadline = performance.now() + Math.max(0, delay);
    const run = () => {
      legacySequenceTimer = 0;
      if (disposed || token !== legacySequenceToken || !legacySequenceActive) return;
      if (document.visibilityState !== "visible") {
        legacySequenceTimer = window.setTimeout(run, 300);
        return;
      }
      legacySequenceStep = null;
      legacySequenceDeadline = 0;
      callback();
    };
    legacySequenceTimer = window.setTimeout(run, Math.max(0, delay));
  };

  const clearScrub = () => {
    if (scrubFrame) window.cancelAnimationFrame(scrubFrame);
    scrubFrame = 0;
    scrubSeekPending = false;
    scrubLastTimestamp = 0;
  };

  const settleStage = (final = false) => {
    phase = final ? "final" : "still";
    root.dataset.stageRenderer = "stage";
    updatePresentation();
    persist(true);
    publishProgress({ stage: final ? "final" : scenes[activeIndex].config.group, transitioning: false });
    setStatus(final ? "演出结束" : `第 ${activeIndex + 1} 幕`);
    if (final) {
      markFinalStage();
      runtimeWindow.__yuimiKisaraLegacyStage?.setFinalStage?.();
      return;
    }
    queueAutoAdvance();
  };

  const markFinalStage = () => {
    if (finalQualified) return;
    finalQualified = true;
    runtimeWindow.__yuimiKisaraLovebrainProgress?.markStage?.("home-jealousy");
  };

  const grantSpareKey = () => {
    const granted = runtimeWindow.__yuimiKisaraLovebrainProgress?.markSpareKey?.() === true;
    runtimeWindow.__yuimiKisaraEasterLedger?.mark?.("photo-archive");
    if (!granted) return;
    window.dispatchEvent(new CustomEvent("yuimi:kisara-secret-audio", {
      detail: {
        trackId: "kokoro-spare-key",
        autoplay: false,
        grantId: `home-contract-${Date.now()}-${Math.round(performance.now())}`
      }
    }));
  };

  const queueAutoAdvance = (seconds?: number) => {
    if (!autoEnabled || disposed || activeIndex >= FINAL_INDEX || phase === "legacy-release") return;
    if (autoTimer) window.clearTimeout(autoTimer);
    const delay = Math.max(180, (seconds ?? scenes[activeIndex].config.hold ?? 0.6) * 1000);
    autoTimer = window.setTimeout(() => {
      autoTimer = 0;
      void advance(1, "auto");
    }, delay);
  };

  const showStageSurface = async (
    index: number,
    profile: string,
    { immediate = false, hold = false }: { immediate?: boolean; hold?: boolean } = {}
  ) => {
    const node = scenes[index];
    if (!node?.element || node.config.renderer !== "stage") return false;
    const serial = ++transitionSerial;
    await hydrateScene(index, true);
    if (disposed || serial !== transitionSerial) return false;
    prewarmAround(index);
    if (hold && node.config.media === "video") setFrameState(index, "hold");
    else if (node.config.media === "video") setFrameState(index, "first");
    else setFrameState(index, "still");

    const previous = visibleStageIndex >= 0 ? scenes[visibleStageIndex]?.element : null;
    if (visibleStageIndex === index) {
      node.element.classList.add("is-active", "is-visible");
      return true;
    }
    node.element.classList.add("is-active", "is-entering");
    root.dataset.stageTransition = profile;
    root.classList.add("is-transitioning");
    if (immediate || !previous) {
      node.element.classList.add("is-visible");
      previous?.classList.remove("is-active", "is-visible", "is-entering", "is-outgoing");
      node.element.classList.remove("is-entering");
      visibleStageIndex = index;
      root.classList.remove("is-transitioning");
      root.removeAttribute("data-stage-transition");
      return true;
    }

    previous.classList.add("is-outgoing");
    await frame();
    if (disposed || serial !== transitionSerial) return false;
    node.element.classList.add("is-visible");
    await frame();
    previous.classList.add("is-fading");
    await new Promise<void>((resolve) => window.setTimeout(resolve, transitionDuration(profile, reducedMotion)));
    if (disposed || serial !== transitionSerial) return false;
    previous.classList.remove("is-active", "is-entering", "is-outgoing", "is-visible", "is-fading");
    node.element.classList.remove("is-entering");
    visibleStageIndex = index;
    root.classList.remove("is-transitioning");
    root.removeAttribute("data-stage-transition");
    return true;
  };

  const startAutoVideo = async (index: number) => {
    const node = scenes[index];
    const video = node?.video;
    if (!node || !(video instanceof HTMLVideoElement)) {
      settleStage(index === FINAL_INDEX);
      return;
    }
    stopCurrentVideo();
    await hydrateScene(index, true);
    if (disposed || activeIndex !== index) return;

    phase = "playing";
    updatePresentation();
    persist(false);
    publishProgress({ transitioning: false });
    setStatus(`第 ${index + 1} 幕播放中`);
    setFrameState(index, "first");
    video.pause();
    try { video.currentTime = 0; } catch {}

    let frameCallback = 0;
    let released = false;
    const revealVideo = () => {
      if (disposed || activeIndex !== index || phase !== "playing") return;
      setFrameState(index, "video");
    };
    const finish = async () => {
      if (released || disposed || activeIndex !== index) return;
      released = true;
      // Keep the decoded last video frame on screen until the independent hold image is ready.
      await loadImage(node.holdFrame, true);
      if (disposed || activeIndex !== index) return;
      setFrameState(index, "hold");
      stopCurrentVideo();
      settleStage(index === FINAL_INDEX);
    };
    const onPlaying = () => {
      minimumWatchUntil = performance.now() + 420;
      const frameVideo = video as HTMLVideoElement & {
        requestVideoFrameCallback?: (callback: () => void) => number;
      };
      if (typeof frameVideo.requestVideoFrameCallback === "function") {
        frameCallback = frameVideo.requestVideoFrameCallback(revealVideo);
      } else {
        window.setTimeout(revealVideo, 48);
      }
    };
    const onEnded = () => { void finish(); };
    const onError = () => { void finish(); };
    const onCanPlay = () => {
      if (disposed || activeIndex !== index || phase !== "playing") return;
      const result = video.play();
      if (result?.catch) result.catch(() => setStatus("等待播放权限"));
    };
    currentVideoCleanup = () => {
      const frameVideo = video as HTMLVideoElement & { cancelVideoFrameCallback?: (id: number) => void };
      if (frameCallback && typeof frameVideo.cancelVideoFrameCallback === "function") {
        frameVideo.cancelVideoFrameCallback(frameCallback);
      }
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
      video.removeEventListener("canplay", onCanPlay);
    };
    video.addEventListener("playing", onPlaying);
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onError);
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) onCanPlay();
    else video.addEventListener("canplay", onCanPlay, { once: true });
  };

  const renderScrub = () => {
    if (disposed || phase !== "scrub" || activeIndex !== SCRUB_INDEX) {
      scrubFrame = 0;
      return;
    }
    const video = scenes[SCRUB_INDEX]?.video;
    if (!(video instanceof HTMLVideoElement)) {
      scrubFrame = 0;
      return;
    }
    const timestamp = performance.now();
    const elapsed = scrubLastTimestamp ? Math.min(42, timestamp - scrubLastTimestamp) : 16;
    scrubLastTimestamp = timestamp;
    scrubVisual += (scrubTarget - scrubVisual) * (1 - Math.exp(-elapsed / 54));
    if (Math.abs(scrubVisual - scrubTarget) < 0.0006) scrubVisual = scrubTarget;
    root.style.setProperty("--stage-scrub-progress", scrubVisual.toFixed(5));
    publishProgress();
    if (
      video.readyState >= HTMLMediaElement.HAVE_METADATA
      && Number.isFinite(video.duration)
      && video.duration > 0
      && !scrubSeekPending
    ) {
      const targetTime = scrubVisual * Math.max(0, video.duration - 1 / 30);
      if (Math.abs(video.currentTime - targetTime) > 1 / 90) {
        scrubSeekPending = true;
        try { video.currentTime = targetTime; } catch { scrubSeekPending = false; }
      }
    }
    if (Math.abs(scrubVisual - scrubTarget) > 0.0006 || scrubSeekPending) {
      scrubFrame = window.requestAnimationFrame(renderScrub);
      return;
    }
    scrubFrame = 0;
    persist(true);
    if (scrubTarget >= 0.998 && !scrubCompleteTimer) {
      scrubCompleteTimer = window.setTimeout(() => {
        scrubCompleteTimer = 0;
        if (!disposed && activeIndex === SCRUB_INDEX && phase === "scrub") void activateStageScene(SCRUB_INDEX + 1, 1, true);
      }, reducedMotion ? 20 : 160);
    }
  };

  const queueScrubFrame = () => {
    if (!scrubFrame) scrubFrame = window.requestAnimationFrame(renderScrub);
  };

  const setupScrub = async (restoredProgress = 0) => {
    const node = scenes[SCRUB_INDEX];
    const video = node?.video;
    if (!node || !(video instanceof HTMLVideoElement)) return;
    await hydrateScene(SCRUB_INDEX, true);
    if (disposed || activeIndex !== SCRUB_INDEX) return;
    phase = "scrub";
    scrubTarget = clamp(restoredProgress, 0, 1);
    scrubVisual = scrubTarget;
    scrubLastTimestamp = 0;
    setFrameState(SCRUB_INDEX, scrubVisual <= 0.001 ? "first" : "video");
    video.pause();
    const seek = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      try { video.currentTime = scrubVisual * Math.max(0, video.duration - 1 / 30); } catch {}
    };
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) seek();
    else video.addEventListener("loadedmetadata", seek, { once: true, signal });
    video.addEventListener("seeked", () => {
      scrubSeekPending = false;
      if (activeIndex === SCRUB_INDEX && phase === "scrub" && scrubVisual > 0.001) setFrameState(SCRUB_INDEX, "video");
      queueScrubFrame();
    }, { signal });
    updatePresentation();
    persist(true);
    publishProgress();
    setStatus("第 6 幕");
    if (autoEnabled) void runAutoScrub();
  };

  const runAutoScrub = async () => {
    const video = scenes[SCRUB_INDEX]?.video;
    if (!(video instanceof HTMLVideoElement) || activeIndex !== SCRUB_INDEX || phase !== "scrub") return;
    await hydrateScene(SCRUB_INDEX, true);
    if (disposed || activeIndex !== SCRUB_INDEX || phase !== "scrub") return;
    phase = "playing";
    updatePresentation();
    setFrameState(SCRUB_INDEX, "first");
    try { video.currentTime = scrubVisual * Math.max(0, video.duration || 0); } catch {}
    const reveal = () => setFrameState(SCRUB_INDEX, "video");
    const onEnded = () => {
      video.removeEventListener("ended", onEnded);
      if (disposed || activeIndex !== SCRUB_INDEX) return;
      scrubTarget = 1;
      scrubVisual = 1;
      setFrameState(SCRUB_INDEX, "hold");
      phase = "scrub";
      void activateStageScene(SCRUB_INDEX + 1, 1, true);
    };
    video.addEventListener("playing", reveal, { once: true });
    video.addEventListener("ended", onEnded, { once: true });
    const result = video.play();
    if (result?.catch) result.catch(() => {
      phase = "scrub";
      updatePresentation();
    });
  };

  const waitForLegacy = async () => {
    const existing = runtimeWindow.__yuimiKisaraLegacyStage;
    if (existing) return existing;
    return await new Promise<LegacyStageBridge | null>((resolve) => {
      const timer = window.setTimeout(() => resolve(runtimeWindow.__yuimiKisaraLegacyStage ?? null), 1200);
      window.addEventListener("yuimi:kisara-legacy-stage-ready", () => {
        window.clearTimeout(timer);
        resolve(runtimeWindow.__yuimiKisaraLegacyStage ?? null);
      }, { once: true, signal });
    });
  };

  const legacyBeatForIndex = (index: number) => scenes[index]?.config.legacyBeat;

  const startLegacySequence = (legacy: LegacyStageBridge, currentIndex: number) => {
    legacySequenceActive = true;
    const steps = [
      { index: 8, beat: "kiss" as const },
      { index: 9, beat: "smoke" as const },
      { index: 10, beat: "detail" as const },
      { index: 11, beat: "silhouette" as const },
      { index: 12, beat: "release" as const }
    ].filter((step) => step.index > currentIndex);
    let stepCursor = 0;

    const runStep = () => {
      if (disposed || !legacySequenceActive || !steps[stepCursor]) return;
      const step = steps[stepCursor++];
      activeIndex = step.index;
      if (step.index === 9) grantSpareKey();
      if (step.beat === "release") {
        legacySequenceActive = false;
        legacyReleaseComplete = false;
        phase = "legacy-release";
        legacy.release?.();
        updatePresentation();
        persist(false);
        publishProgress({ transitioning: true, stage: "legacy-release" });
        setStatus("正在释放");
        return;
      }
      legacy.setBeat?.(step.beat);
      phase = "legacy";
      updatePresentation();
      persist(true);
      publishProgress({ transitioning: false, stage: "legacy" });
      setStatus(`第 ${step.index + 1} 幕`);
      scheduleLegacySequenceStep(
        (scenes[step.index]?.config.hold ?? 0.7) * 1000,
        runStep
      );
    };

    scheduleLegacySequenceStep(
      (scenes[currentIndex]?.config.hold ?? 0.8) * 1000,
      runStep
    );
  };

  const enterLegacy = async (index: number, { restoring = false }: { restoring?: boolean } = {}) => {
    const beat = legacyBeatForIndex(index);
    if (!beat || !isLegacyIndex(index)) return false;
    stopCurrentVideo();
    clearScrub();
    clearTimers();
    phase = "transition";
    updatePresentation();
    publishProgress({ transitioning: true, stage: "legacy" });
    setStatus("主演出接续中");
    const legacy = await waitForLegacy();
    if (disposed || !legacy) {
      phase = "still";
      updatePresentation();
      return false;
    }
    legacy.activate?.();
    if (beat === "release") {
      if (restoring) {
        legacy.settleFight?.();
        legacyReleaseComplete = true;
        phase = "legacy";
      } else {
        legacy.release?.();
        legacyReleaseComplete = false;
        phase = "legacy-release";
      }
    } else {
      legacy.setBeat?.(beat);
      phase = "legacy";
    }
    activeIndex = index;
    root.dataset.stageRenderer = "legacy-transition";
    await frame();
    if (disposed) return false;
    root.dataset.stageRenderer = "legacy";
    inputLockUntil = performance.now() + (restoring ? 100 : transitionDuration("legacy-open", reducedMotion));
    updatePresentation();
    persist(phase === "legacy");
    publishProgress({ transitioning: phase === "legacy-release" });
    setStatus(phase === "legacy-release" ? "正在释放" : `第 ${index + 1} 幕`);
    if (phase === "legacy" && index < LEGACY_END_INDEX) {
      startLegacySequence(legacy, index);
    }
    return true;
  };

  const returnFromLegacy = async () => {
    const target = LEGACY_START_INDEX - 1;
    const legacy = runtimeWindow.__yuimiKisaraLegacyStage;
    clearTimers();
    root.dataset.stageRenderer = "legacy-return";
    const shown = await showStageSurface(target, "legacy-return", { hold: true });
    if (!shown || disposed) return false;
    await frame();
    root.dataset.stageRenderer = "stage";
    legacy?.reset?.();
    legacy?.hide?.();
    activeIndex = target;
    phase = "still";
    inputLockUntil = performance.now() + 180;
    updatePresentation();
    persist(true);
    publishProgress();
    setStatus(`第 ${target + 1} 幕`);
    return true;
  };

  const enterFinal = async ({ hold = false }: { hold?: boolean } = {}) => {
    stopCurrentVideo();
    clearScrub();
    phase = "transition";
    updatePresentation();
    const legacy = runtimeWindow.__yuimiKisaraLegacyStage;
    scenes.forEach((scene, index) => {
      if (index !== FINAL_INDEX) scene.element?.classList.remove("is-active", "is-visible", "is-entering", "is-outgoing");
    });
    visibleStageIndex = -1;
    root.dataset.stageRenderer = "final-transition";
    const shown = await showStageSurface(FINAL_INDEX, "jealous-cut", { hold, immediate: reducedMotion });
    if (!shown || disposed) return false;
    await frame();
    legacy?.hide?.();
    root.dataset.stageRenderer = "stage";
    activeIndex = FINAL_INDEX;
    if (hold) {
      phase = "final";
      updatePresentation();
      persist(true);
      publishProgress({ progress: 1, stage: "final", transitioning: false });
      markFinalStage();
      legacy?.setFinalStage?.();
      return true;
    }
    await startAutoVideo(FINAL_INDEX);
    return true;
  };

  const activateStageScene = async (index: number, direction = 1, automatic = false, restoredProgress?: number) => {
    const config = scenes[index]?.config;
    if (!config || config.renderer !== "stage") return false;
    stopCurrentVideo();
    clearScrub();
    if (root.dataset.stageRenderer !== "stage") {
      root.dataset.stageRenderer = "legacy-return";
    }
    phase = "transition";
    updatePresentation();
    publishProgress({ transitioning: true, stage: "transition" });
    const profile = transitionProfile(activeIndex, index);
    const shown = await showStageSurface(index, profile, { hold: direction < 0 || Boolean(restoredProgress) });
    if (!shown || disposed) return false;
    root.dataset.stageRenderer = "stage";
    activeIndex = index;
    inputLockUntil = performance.now() + (automatic ? 90 : 160);
    if (config.mode === "auto") {
      if (direction < 0 || restoredProgress !== undefined) {
        setFrameState(index, "hold");
        settleStage(index === FINAL_INDEX);
      } else {
        await startAutoVideo(index);
      }
      return true;
    }
    if (config.mode === "scrub") {
      await setupScrub(restoredProgress ?? 0);
      return true;
    }
    settleStage(false);
    return true;
  };

  const moveForward = async (source: "wheel" | "touch" | "keyboard" | "auto") => {
    if (activeIndex === FINAL_INDEX) return false;
    if (activeIndex === SCRUB_INDEX && phase === "scrub") {
      scrubTarget = clamp(scrubTarget + 0.32, 0, 1);
      queueScrubFrame();
      return true;
    }
    if (phase === "playing") {
      if (performance.now() < minimumWatchUntil) return false;
      setFrameState(activeIndex, "hold");
      stopCurrentVideo();
      settleStage(activeIndex === FINAL_INDEX);
      return true;
    }
    if (phase === "legacy-release") return false;
    if (isLegacyIndex(activeIndex)) {
      if (activeIndex === LEGACY_END_INDEX) {
        if (!legacyReleaseComplete) return false;
        return enterFinal();
      }
      // 08-13 is one automatic legacy performance, not a row of scroll stops.
      return false;
    }
    if (activeIndex === LEGACY_START_INDEX - 1) return enterLegacy(LEGACY_START_INDEX);
    return activateStageScene(activeIndex + 1, 1, source === "auto");
  };

  const moveBackward = async () => {
    if (legacySequenceActive && isLegacyIndex(activeIndex)) return returnFromLegacy();
    if (phase === "legacy-release") return enterLegacy(LEGACY_END_INDEX - 1, { restoring: true });
    if (activeIndex === FINAL_INDEX) return enterLegacy(LEGACY_END_INDEX, { restoring: true });
    if (isLegacyIndex(activeIndex)) {
      if (activeIndex === LEGACY_START_INDEX) return returnFromLegacy();
      return enterLegacy(activeIndex - 1, { restoring: true });
    }
    if (activeIndex === SCRUB_INDEX && phase === "scrub") {
      if (scrubTarget <= 0.006) return activateStageScene(SCRUB_INDEX - 1, -1, false);
      scrubTarget = clamp(scrubTarget - 0.32, 0, 1);
      queueScrubFrame();
      return true;
    }
    if (phase === "playing") {
      stopCurrentVideo();
      setFrameState(activeIndex, "hold");
    }
    if (activeIndex <= 0) return false;
    return activateStageScene(activeIndex - 1, -1, false);
  };

  const advance = async (direction: number, source: "wheel" | "touch" | "keyboard" | "auto") => {
    if (disposed || phase === "transition" || performance.now() < inputLockUntil) return false;
    if (direction > 0) return moveForward(source);
    return moveBackward();
  };

  const resetGesture = () => {
    wheelAccumulator = 0;
    wheelResetTimer = 0;
  };

  const handleWheel = (event: WheelEvent) => {
    if (disposed || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const delta = normalizeWheelDelta(event);
    if (Math.abs(delta) < 0.5) return;
    const timestamp = performance.now();
    const fresh = timestamp - lastWheelAt > 180;
    lastWheelAt = timestamp;
    if (wheelResetTimer) window.clearTimeout(wheelResetTimer);
    wheelResetTimer = window.setTimeout(resetGesture, 185);

    if (activeIndex === SCRUB_INDEX && phase === "scrub") {
      if (delta < 0 && scrubTarget <= 0.006 && fresh) {
        void moveBackward();
        return;
      }
      if (scrubCompleteTimer) window.clearTimeout(scrubCompleteTimer);
      scrubCompleteTimer = 0;
      root.classList.add("has-scrub-input");
      scrubTarget = clamp(scrubTarget + delta / (coarsePointer ? 560 : 820), 0, 1);
      queueScrubFrame();
      return;
    }

    if (phase === "playing" && delta > 0) {
      void advance(1, "wheel");
      return;
    }
    if (phase === "playing" && delta < 0) {
      void advance(-1, "wheel");
      return;
    }
    if (wheelAccumulator !== 0 && Math.sign(wheelAccumulator) !== Math.sign(delta)) wheelAccumulator = 0;
    wheelAccumulator += delta;
    const threshold = coarsePointer ? 74 : 62;
    if (Math.abs(wheelAccumulator) < threshold) return;
    const direction = Math.sign(wheelAccumulator);
    wheelAccumulator = 0;
    void advance(direction, "wheel");
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (disposed || event.defaultPrevented) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
    const forward = ["ArrowDown", "PageDown", " ", "Enter"].includes(event.key);
    const backward = ["ArrowUp", "PageUp"].includes(event.key);
    if (!forward && !backward) return;
    event.preventDefault();
    void advance(forward ? 1 : -1, "keyboard");
  };

  const handleTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchId = touch.identifier;
    touchStartY = touch.clientY;
    touchLastY = touch.clientY;
    touchScrubbing = false;
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (touchId === null || touchLastY === null) return;
    const touch = Array.from(event.touches).find((candidate) => candidate.identifier === touchId);
    if (!touch) return;
    event.preventDefault();
    if (activeIndex !== SCRUB_INDEX || phase !== "scrub") return;
    const delta = touchLastY - touch.clientY;
    touchLastY = touch.clientY;
    if (Math.abs(delta) < 0.2) return;
    touchScrubbing = true;
    root.classList.add("has-scrub-input");
    scrubTarget = clamp(scrubTarget + delta / Math.max(320, window.innerHeight * 0.62), 0, 1);
    queueScrubFrame();
  };

  const handleTouchEnd = (event: TouchEvent) => {
    if (touchId === null || touchStartY === null) return;
    const touch = Array.from(event.changedTouches).find((candidate) => candidate.identifier === touchId);
    const start = touchStartY;
    touchId = null;
    touchStartY = null;
    touchLastY = null;
    if (!touch || touchScrubbing) {
      touchScrubbing = false;
      return;
    }
    const delta = start - touch.clientY;
    if (Math.abs(delta) < 42) return;
    void advance(Math.sign(delta), "touch");
  };

  const toggleAuto = () => {
    autoEnabled = !autoEnabled;
    root.dataset.stageAuto = String(autoEnabled);
    autoButton?.setAttribute("aria-pressed", String(autoEnabled));
    if (!autoEnabled) {
      if (autoTimer) window.clearTimeout(autoTimer);
      autoTimer = 0;
      if (activeIndex === SCRUB_INDEX && phase === "playing") {
        const video = scenes[SCRUB_INDEX]?.video;
        if (video instanceof HTMLVideoElement) {
          video.pause();
          scrubTarget = Number.isFinite(video.duration) && video.duration > 0 ? video.currentTime / video.duration : scrubTarget;
          scrubVisual = scrubTarget;
          phase = "scrub";
          updatePresentation();
          queueScrubFrame();
        }
      }
      return;
    }
    if (activeIndex === SCRUB_INDEX && phase === "scrub") {
      void runAutoScrub();
      return;
    }
    if (phase === "still" || phase === "legacy") queueAutoAdvance(0.24);
  };

  const skipToEnd = async () => {
    stopCurrentVideo();
    clearScrub();
    clearTimers();
    runtimeWindow.__yuimiKisaraLegacyStage?.reset?.();
    runtimeWindow.__yuimiKisaraLegacyStage?.hide?.();
    activeIndex = FINAL_INDEX;
    root.dataset.stageRenderer = "final-transition";
    await enterFinal({ hold: true });
  };

  const replay = async () => {
    stopCurrentVideo();
    clearScrub();
    clearTimers();
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
    finalQualified = false;
    legacyReleaseComplete = false;
    autoEnabled = false;
    root.dataset.stageAuto = "false";
    autoButton?.setAttribute("aria-pressed", "false");
    runtimeWindow.__yuimiKisaraLegacyStage?.reset?.();
    runtimeWindow.__yuimiKisaraLegacyStage?.hide?.();
    scenes.forEach((scene) => scene.element?.classList.remove("is-active", "is-visible", "is-entering", "is-outgoing"));
    visibleStageIndex = -1;
    activeIndex = 0;
    root.dataset.stageRenderer = "stage";
    await activateStageScene(0, 1, false);
  };

  const handleLegacyReleaseComplete = () => {
    if (disposed || activeIndex !== LEGACY_END_INDEX || phase !== "legacy-release") return;
    legacyReleaseComplete = true;
    legacySequenceActive = false;
    phase = "legacy";
    inputLockUntil = performance.now() + 200;
    updatePresentation();
    persist(true);
    publishProgress({ transitioning: false, stage: "legacy-final" });
    setStatus("第 13 幕");
    // The restored finale owns its own timing; once it releases, continue into scene 14 automatically.
    window.setTimeout(() => {
      if (!disposed && activeIndex === LEGACY_END_INDEX && phase === "legacy") void enterFinal();
    }, reducedMotion ? 20 : 280);
  };

  const handleVisibility = () => {
    if (document.visibilityState === "hidden") {
      const video = scenes[activeIndex]?.video;
      resumeVideoAfterVisibility = phase === "playing" && video instanceof HTMLVideoElement && !video.paused;
      video?.pause();
      return;
    }
    const video = scenes[activeIndex]?.video;
    if (resumeVideoAfterVisibility && phase === "playing" && video instanceof HTMLVideoElement && video.paused) {
      resumeVideoAfterVisibility = false;
      const play = video.play();
      if (play?.catch) play.catch(() => undefined);
      return;
    }
    if (phase === "scrub") queueScrubFrame();
    if (legacySequenceActive && legacySequenceStep) {
      const step = legacySequenceStep;
      scheduleLegacySequenceStep(Math.max(0, legacySequenceDeadline - performance.now()), step);
    }
    if (autoEnabled && (phase === "still" || phase === "legacy")) queueAutoAdvance();
  };

  window.addEventListener("wheel", handleWheel, { passive: false, signal });
  window.addEventListener("keydown", handleKeydown, { signal });
  root.addEventListener("touchstart", handleTouchStart, { passive: true, signal });
  root.addEventListener("touchmove", handleTouchMove, { passive: false, signal });
  root.addEventListener("touchend", handleTouchEnd, { passive: true, signal });
  document.addEventListener("visibilitychange", handleVisibility, { signal });
  window.addEventListener("yuimi:kisara-legacy-release-complete", handleLegacyReleaseComplete, { signal });
  window.addEventListener("yuimi:kisara-lovebrain-progress", updatePresentation, { signal });
  autoButton?.addEventListener("click", toggleAuto, { signal });
  skipButton?.addEventListener("click", () => { void skipToEnd(); }, { signal });
  replayButton?.addEventListener("click", () => { void replay(); }, { signal });
  lovebrainButton?.addEventListener("click", () => {
    if (runtimeWindow.__yuimiKisaraHomeLovebrain?.activate?.()) return;
    setStatus("隐藏舞台尚未解锁");
  }, { signal });

  const start = async () => {
    if (document.documentElement.dataset.kisaraFoundSelfEntry === "pending") {
      phase = "waiting";
      root.classList.add("is-found-self-waiting");
      updatePresentation();
      publishProgress({ active: false, stage: "found-self", guided: true, transitioning: false });
      window.addEventListener("yuimi:kisara-legacy-found-self-finished", () => {
        if (disposed) return;
        root.classList.remove("is-found-self-waiting");
        activeIndex = 0;
        void activateStageScene(0, 1, false);
      }, { once: true, signal });
      return;
    }

    const saved = readSavedState(scenes.length);
    if (reducedMotion) {
      await skipToEnd();
      return;
    }
    if (saved) {
      activeIndex = saved.index;
      if (isLegacyIndex(activeIndex)) {
        await enterLegacy(activeIndex, { restoring: true });
        if (activeIndex === LEGACY_END_INDEX) {
          runtimeWindow.__yuimiKisaraLegacyStage?.settleFight?.();
          legacyReleaseComplete = true;
          phase = "legacy";
          updatePresentation();
        }
        return;
      }
      if (activeIndex === FINAL_INDEX) {
        await enterFinal({ hold: true });
        return;
      }
      await activateStageScene(activeIndex, -1, false, activeIndex === SCRUB_INDEX ? saved.scrubProgress : 0);
      return;
    }
    await activateStageScene(0, 1, false);
  };

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    lifecycle.abort();
    transitionSerial += 1;
    stopCurrentVideo();
    clearScrub();
    clearTimers();
    scenes.forEach((scene) => scene.video?.pause());
    root.removeAttribute("data-bound");
    if (runtimeWindow.__yuimiKisaraStageHomeCleanup === cleanup) {
      runtimeWindow.__yuimiKisaraStageHomeCleanup = null;
    }
  };
  runtimeWindow.__yuimiKisaraStageHomeCleanup = cleanup;

  runtimeWindow.__yuimiKisaraHomeBootController?.markReady?.();
  void start();
};

export const initKisaraStageHomeLifecycle = () => {
  const runtimeWindow = window as KisaraWindow;
  const schedule = () => {
    window.clearTimeout(runtimeWindow.__yuimiKisaraStageHomeInitTimer ?? 0);
    runtimeWindow.__yuimiKisaraStageHomeInitTimer = window.setTimeout(() => {
      runtimeWindow.__yuimiKisaraStageHomeInitTimer = 0;
      const root = document.querySelector<HTMLElement>("[data-kisara-stage-home]");
      if (root) createStageRuntime(root);
    }, 0);
  };
  runtimeWindow.__yuimiKisaraStageHomeSchedule = schedule;
  if (!runtimeWindow.__yuimiKisaraStageHomeLifecycleBound) {
    document.addEventListener("astro:before-swap", () => {
      window.clearTimeout(runtimeWindow.__yuimiKisaraStageHomeInitTimer ?? 0);
      runtimeWindow.__yuimiKisaraStageHomeInitTimer = 0;
      runtimeWindow.__yuimiKisaraStageHomeCleanup?.();
    });
    document.addEventListener("astro:page-load", schedule);
    window.addEventListener("pageshow", schedule);
    runtimeWindow.__yuimiKisaraStageHomeLifecycleBound = true;
  }
  schedule();
};
