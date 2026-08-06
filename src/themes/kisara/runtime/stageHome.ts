type StageMode = "auto" | "still" | "scrub" | "sequence";
type StagePhase = "boot" | "transition" | "playing" | "still" | "scrub" | "sequence" | "final" | "found-self" | "lovebrain";

interface StageSceneConfig {
  id: string;
  order: number;
  mode: StageMode;
  media: "image" | "video";
  src: string;
  poster?: string;
  lastPoster?: string;
  group: "intercept" | "contract" | "intimacy" | "transformation" | "jealousy";
  minWatch: number;
  hold: number;
}

interface StageSceneNode {
  config: StageSceneConfig;
  element: HTMLElement;
  image: HTMLImageElement | null;
  video: HTMLVideoElement | null;
  firstFrame: HTMLImageElement | null;
  holdFrame: HTMLImageElement | null;
}

interface SavedStageState {
  version: 1;
  index: number;
  settled: boolean;
  finalSettled: boolean;
  scrubProgress: number;
}

type KisaraWindow = Window & typeof globalThis & {
  __yuimiKisaraStageHomeCleanup?: (() => void) | null;
  __yuimiKisaraStageHomeSchedule?: (() => void) | null;
  __yuimiKisaraStageHomeInitTimer?: number;
  __yuimiKisaraStageHomeLifecycleBound?: boolean;
  __yuimiKisaraHomeLovebrain?: {
    activate?: () => boolean;
    leaveToOpening?: () => boolean;
  } | null;
  __yuimiKisaraLovebrainProgress?: {
    markSpareKey?: () => boolean;
    markStage?: (id: string) => boolean;
    isEligible?: () => boolean;
  };
  __yuimiKisaraEasterLedger?: {
    mark?: (id: string) => boolean;
  };
  __yuimiKisaraHomeBootController?: {
    markReady?: () => void;
  };
};

const STORAGE_KEY = "yuimi-kisara-stage-home-v1";
const FOUND_SELF_TICKET_KEY = "yuimi-kisara-found-self-ticket-v1";
const SCRUB_INDEX = 5;
const KISS_INDEX = 8;
const TRANSFORMATION_START = 9;
const TRANSFORMATION_END = 12;
const FINAL_INDEX = 13;
const TRANSFORMATION_INDICES = new Set([9, 10, 11]);
const INTERNAL_AUTO_CHAIN = new Map<number, { next: number; delay: number }>([
  [0, { next: 1, delay: 70 }],
  [1, { next: 2, delay: 260 }],
  [3, { next: 4, delay: 90 }],
  [4, { next: 5, delay: 30 }]
]);

const TRANSITION_DURATIONS: Record<string, number> = {
  opening: 0,
  "white-continuity": 260,
  "intercept-settle": 520,
  "chapter-shift": 620,
  "focus-snap": 330,
  "motion-handoff": 210,
  "impact-release": 360,
  "quiet-push": 680,
  "intimacy-push": 720,
  "kiss-to-smoke": 760,
  "smoke-continuity": 540,
  "hair-reveal": 560,
  "form-clear": 720,
  "title-departure": 620,
  "reverse-rest": 520,
  direct: 240
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (stored?.version !== 1 || !Number.isFinite(stored.index)) return null;
    return {
      version: 1,
      index: clamp(Math.round(stored.index), 0, Math.max(0, length - 1)),
      settled: stored.settled === true,
      finalSettled: stored.finalSettled === true,
      scrubProgress: clamp(Number(stored.scrubProgress) || 0, 0, 1)
    };
  } catch {
    return null;
  }
};

const hasFoundSelfTicket = () => {
  let ticket: { source?: string; createdAt?: number } | null = null;
  try {
    ticket = JSON.parse(sessionStorage.getItem(FOUND_SELF_TICKET_KEY) ?? "null");
    sessionStorage.removeItem(FOUND_SELF_TICKET_KEY);
  } catch {}
  return ticket?.source === "me-games"
    && Number.isFinite(ticket.createdAt)
    && Date.now() - Number(ticket.createdAt) < 30_000;
};

const normalizeWheelDelta = (event: WheelEvent) => {
  const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? 18
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
      ? window.innerHeight
      : 1;
  return clamp(event.deltaY * scale, -180, 180);
};

const resolveTransition = (from: number, to: number, direction: number) => {
  if (direction < 0) return "reverse-rest";
  const key = `${from}-${to}`;
  const transitions: Record<string, string> = {
    "0-1": "white-continuity",
    "1-2": "intercept-settle",
    "2-3": "chapter-shift",
    "3-4": "focus-snap",
    "4-5": "motion-handoff",
    "5-6": "impact-release",
    "6-7": "quiet-push",
    "7-8": "intimacy-push",
    "8-9": "kiss-to-smoke",
    "9-10": "smoke-continuity",
    "10-11": "hair-reveal",
    "11-12": "form-clear",
    "12-13": "title-departure"
  };
  return transitions[key] ?? "direct";
};

const createStageRuntime = (root: HTMLElement) => {
  const runtimeWindow = window as KisaraWindow;
  if (root.dataset.bound === "true") return;
  runtimeWindow.__yuimiKisaraStageHomeCleanup?.();
  root.dataset.bound = "true";

  const manifest = readManifest(root);
  const sceneElements = Array.from(root.querySelectorAll<HTMLElement>("[data-stage-scene]"));
  const scenes: StageSceneNode[] = manifest.map((config) => {
    const element = sceneElements.find((candidate) => candidate.dataset.stageScene === config.id);
    if (!(element instanceof HTMLElement)) throw new Error(`Missing Kisara stage scene ${config.id}`);
    return {
      config,
      element,
      image: element.querySelector<HTMLImageElement>("[data-stage-image]"),
      video: element.querySelector<HTMLVideoElement>("[data-stage-video]"),
      firstFrame: element.querySelector<HTMLImageElement>("[data-stage-first-frame]"),
      holdFrame: element.querySelector<HTMLImageElement>("[data-stage-hold-frame]")
    };
  });

  if (scenes.length !== 14) {
    root.dataset.stageError = "manifest";
    runtimeWindow.__yuimiKisaraHomeBootController?.markReady?.();
    return;
  }

  const copyNodes = Array.from(root.querySelectorAll<HTMLElement>("[data-stage-copy]"));
  const title = root.querySelector<HTMLElement>("[data-stage-title]");
  const seal = root.querySelector<HTMLElement>("[data-stage-seal]");
  const counter = root.querySelector<HTMLElement>("[data-stage-index-label]");
  const autoButton = root.querySelector<HTMLButtonElement>("[data-stage-auto]");
  const skipButton = root.querySelector<HTMLButtonElement>("[data-stage-skip]");
  const replayButton = root.querySelector<HTMLButtonElement>("[data-stage-replay]");
  const status = root.querySelector<HTMLElement>("[data-stage-status]");
  const scrubRail = root.querySelector<HTMLElement>("[data-stage-scrub]");
  const foundSelfOverlay = root.querySelector<HTMLElement>("[data-kisara-found-self]");
  const foundSelfVideo = root.querySelector<HTMLVideoElement>("[data-kisara-found-self-video]");
  const foundSelfStatus = root.querySelector<HTMLElement>("[data-kisara-found-self-status]");
  const foundSelfSkip = root.querySelector<HTMLButtonElement>("[data-kisara-found-self-skip]");
  const foundSelfAnnouncer = root.querySelector<HTMLElement>("[data-kisara-found-self-announcer]");
  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

  let disposed = false;
  let activeIndex = 0;
  let phase: StagePhase = "boot";
  let transitionTimer = 0;
  let transitionDeadline = 0;
  let transitionRemaining = 0;
  let transitionFinalize: (() => void) | null = null;
  let sequenceTimer = 0;
  let sequenceDeadline = 0;
  let sequenceRemaining = 0;
  let sequenceResume: (() => void) | null = null;
  let scrubCompletionTimer = 0;
  let autoTimer = 0;
  let mediaRevealTimer = 0;
  let lovebrainTimer = 0;
  let foundSelfTimer = 0;
  let foundSelfReadyTimer = 0;
  let gestureTimer = 0;
  let scrubFrame = 0;
  let scrubSeekBusy = false;
  let scrubTarget = 0;
  let scrubVisual = 0;
  let scrubLastTimestamp = 0;
  let wheelAccumulator = 0;
  let lastWheelTimestamp = 0;
  let gestureConsumed = false;
  let wheelNeedsFreshGesture = false;
  let inputGuardUntil = 0;
  let touchStartY: number | null = null;
  let touchLastY: number | null = null;
  let touchId: number | null = null;
  let touchScrubbing = false;
  let autoEnabled = false;
  let currentVideoCleanup: (() => void) | null = null;
  let currentVideoStartedAt = 0;
  let minWatchUntil = 0;
  let finalQualified = false;
  let foundSelfActive = false;
  let foundSelfPlaying = false;
  let foundSelfSuspended = false;
  let lovebrainActive = false;
  let resumeVideoAfterVisibility = false;

  const clearTimer = (timer: number) => {
    if (timer) window.clearTimeout(timer);
  };

  const scheduleSequence = (callback: () => void, delay: number) => {
    clearTimer(sequenceTimer);
    sequenceResume = callback;
    sequenceRemaining = Math.max(20, delay);
    sequenceDeadline = performance.now() + sequenceRemaining;
    sequenceTimer = window.setTimeout(() => {
      const run = sequenceResume;
      sequenceTimer = 0;
      sequenceDeadline = 0;
      sequenceRemaining = 0;
      sequenceResume = null;
      run?.();
    }, sequenceRemaining);
  };

  const setStatus = (value: string) => {
    if (status) status.textContent = value;
  };

  const persistState = (settled: boolean) => {
    const state: SavedStageState = {
      version: 1,
      index: activeIndex,
      settled,
      finalSettled: activeIndex === FINAL_INDEX && root.dataset.kisaraStageSettled === "true",
      scrubProgress: activeIndex === SCRUB_INDEX ? scrubTarget : 0
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  };

  const publishProgress = (overrides: Partial<{
    active: boolean;
    progress: number;
    stage: string;
    guided: boolean;
    transitioning: boolean;
  }> = {}) => {
    const sceneProgress = activeIndex === SCRUB_INDEX ? scrubVisual : 0;
    const progress = clamp((activeIndex + sceneProgress) / Math.max(1, scenes.length - 1), 0, 1);
    const detail = {
      active: !lovebrainActive,
      progress,
      stage: phase,
      guided: autoEnabled,
      transitioning: phase === "transition" || phase === "sequence",
      ...overrides
    };
    root.dataset.kisaraScrollActive = String(detail.active);
    root.dataset.kisaraScrollProgress = detail.progress.toFixed(5);
    root.dataset.kisaraScrollStage = detail.stage;
    root.dataset.kisaraScrollGuided = String(detail.guided);
    root.dataset.kisaraScrollTransitioning = String(detail.transitioning);
    root.style.setProperty("--stage-progress", String(detail.progress));
    window.dispatchEvent(new CustomEvent("kisara:gate-progress", { detail }));
  };

  const hydrateScene = (index: number, eager = false) => {
    const node = scenes[index];
    if (!node) return;
    if (node.image instanceof HTMLImageElement && !node.image.src) {
      const source = node.image.dataset.src || node.config.src;
      node.image.loading = eager ? "eager" : "lazy";
      node.image.fetchPriority = eager ? "high" : "low";
      node.image.src = source;
      delete node.image.dataset.src;
    }
    for (const frame of [node.firstFrame, node.holdFrame]) {
      if (!(frame instanceof HTMLImageElement) || frame.src) continue;
      const source = frame.dataset.src;
      if (!source) continue;
      frame.loading = eager ? "eager" : "lazy";
      frame.fetchPriority = eager ? "high" : "low";
      frame.src = source;
      delete frame.dataset.src;
    }
    if (node.video instanceof HTMLVideoElement && !node.video.src) {
      const source = node.video.dataset.src || node.config.src;
      node.video.preload = eager ? "auto" : "metadata";
      node.video.src = source;
      node.video.load();
      delete node.video.dataset.src;
    }
  };

  const setFrameState = (index: number, state: "first" | "video" | "hold" | "still") => {
    const node = scenes[index];
    if (!node) return;
    node.element.dataset.frameState = state;
  };

  const prepareSceneSurface = (index: number, direction: number) => {
    const node = scenes[index];
    if (!node) return;
    hydrateScene(index, true);
    if (!(node.video instanceof HTMLVideoElement)) {
      setFrameState(index, "still");
      return;
    }
    node.video.pause();
    setFrameState(index, direction < 0 ? "hold" : "first");
    if (direction >= 0) {
      try { node.video.currentTime = 0; } catch {}
    }
  };

  const hydrateWindow = (index: number) => {
    hydrateScene(index, true);
    hydrateScene(index + 1, true);
    hydrateScene(index + 2, false);
    if (index >= TRANSFORMATION_START - 1 && index <= TRANSFORMATION_END) {
      for (let candidate = TRANSFORMATION_START; candidate <= TRANSFORMATION_END; candidate += 1) {
        hydrateScene(candidate, true);
      }
    }
  };

  const cancelCurrentVideo = () => {
    currentVideoCleanup?.();
    currentVideoCleanup = null;
    const video = scenes[activeIndex]?.video;
    if (video instanceof HTMLVideoElement) video.pause();
    root.classList.remove("is-media-playing");
    currentVideoStartedAt = 0;
    minWatchUntil = 0;
  };

  const cancelTransientWork = () => {
    clearTimer(transitionTimer);
    clearTimer(sequenceTimer);
    clearTimer(scrubCompletionTimer);
    clearTimer(autoTimer);
    clearTimer(mediaRevealTimer);
    transitionTimer = 0;
    transitionDeadline = 0;
    transitionRemaining = 0;
    transitionFinalize = null;
    sequenceTimer = 0;
    sequenceDeadline = 0;
    sequenceRemaining = 0;
    sequenceResume = null;
    scrubCompletionTimer = 0;
    autoTimer = 0;
    mediaRevealTimer = 0;
    if (scrubFrame) window.cancelAnimationFrame(scrubFrame);
    scrubFrame = 0;
    scrubSeekBusy = false;
    cancelCurrentVideo();
  };

  const updatePresentation = () => {
    const sceneId = scenes[activeIndex]?.config.id ?? "01";
    root.dataset.stageIndex = String(activeIndex + 1);
    root.dataset.stageScene = sceneId;
    root.dataset.stageMode = scenes[activeIndex]?.config.mode ?? "still";
    root.dataset.stageGroup = scenes[activeIndex]?.config.group ?? "intercept";
    if (counter) counter.textContent = String(activeIndex + 1).padStart(2, "0");

    copyNodes.forEach((copy) => {
      copy.classList.toggle("is-active", copy.dataset.stageCopy === sceneId);
    });

    if (title) title.dataset.scene = sceneId;
    if (activeIndex < TRANSFORMATION_START) root.dataset.titlePhase = "dormant";
    else if (activeIndex === 9) root.dataset.titlePhase = "awakening";
    else if (activeIndex === 10) root.dataset.titlePhase = "contract";
    else if (activeIndex === 11) root.dataset.titlePhase = "enchant";
    else if (activeIndex === 12) root.dataset.titlePhase = "complete";
    else if (activeIndex === FINAL_INDEX && root.dataset.kisaraStageSettled !== "true") root.dataset.titlePhase = "departing";
    else root.dataset.titlePhase = "dormant";

    if (seal) seal.classList.toggle("is-active", activeIndex === FINAL_INDEX && root.dataset.kisaraStageSettled === "true");
    if (replayButton) replayButton.hidden = !(activeIndex === FINAL_INDEX && root.dataset.kisaraStageSettled === "true");
    if (scrubRail) scrubRail.setAttribute("aria-hidden", String(activeIndex !== SCRUB_INDEX));
  };

  const resetGesture = () => {
    wheelAccumulator = 0;
    gestureConsumed = false;
    wheelNeedsFreshGesture = false;
    gestureTimer = 0;
  };

  const queueGestureReset = () => {
    clearTimer(gestureTimer);
    gestureTimer = window.setTimeout(resetGesture, 240);
  };

  const queueAutoAdvance = (delaySeconds?: number) => {
    clearTimer(autoTimer);
    autoTimer = 0;
    if (!autoEnabled || disposed || lovebrainActive || foundSelfActive || activeIndex >= FINAL_INDEX) return;
    const delay = Math.max(260, (delaySeconds ?? scenes[activeIndex].config.hold) * 1000);
    autoTimer = window.setTimeout(() => {
      autoTimer = 0;
      advance(1, "auto");
    }, delay);
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

  const setFinalSettled = (qualified: boolean) => {
    phase = "final";
    root.dataset.kisaraStageSettled = "true";
    root.dataset.titlePhase = "dormant";
    root.classList.add("is-scene-settled", "is-final-settled");
    if (qualified) markFinalStage();
    updatePresentation();
    persistState(true);
    publishProgress({ progress: 1, stage: "final", transitioning: false });
    setStatus("演出结束");
  };

  const settleStill = () => {
    phase = activeIndex === FINAL_INDEX ? "final" : "still";
    root.classList.add("is-scene-settled");
    root.classList.toggle("is-final-settled", activeIndex === FINAL_INDEX);
    if (activeIndex === FINAL_INDEX) root.dataset.kisaraStageSettled = "true";
    persistState(true);
    publishProgress();
    setStatus(`第 ${activeIndex + 1} 幕`);
    if (activeIndex !== FINAL_INDEX) queueAutoAdvance();
  };

  const finishAutoVideo = (qualified = false) => {
    const node = scenes[activeIndex];
    const finishedIndex = activeIndex;
    if (node?.video instanceof HTMLVideoElement) setFrameState(finishedIndex, "hold");
    cancelCurrentVideo();
    if (activeIndex === FINAL_INDEX) {
      setFinalSettled(qualified);
      return;
    }
    const chain = INTERNAL_AUTO_CHAIN.get(finishedIndex);
    if (chain) {
      phase = "sequence";
      root.classList.remove("is-scene-settled");
      publishProgress({ stage: scenes[finishedIndex].config.group, transitioning: true });
      scheduleSequence(() => {
        if (disposed || activeIndex !== finishedIndex) return;
        beginScene(chain.next, 1, true);
      }, reducedMotion ? 20 : chain.delay);
      return;
    }
    settleStill();
  };

  const startAutoVideo = (direction: number) => {
    const node = scenes[activeIndex];
    const video = node?.video;
    if (!(video instanceof HTMLVideoElement)) {
      settleStill();
      return;
    }
    hydrateScene(activeIndex, true);
    cancelCurrentVideo();

    if (direction < 0) {
      setFrameState(activeIndex, "hold");
      settleStill();
      return;
    }

    setFrameState(activeIndex, "first");
    video.pause();
    try { video.currentTime = 0; } catch {}
    phase = "playing";
    root.classList.remove("is-scene-settled", "is-final-settled");
    root.classList.add("is-media-playing");
    root.dataset.kisaraStageSettled = "false";
    publishProgress();
    persistState(false);
    setStatus(`第 ${activeIndex + 1} 幕播放中`);

    const localIndex = activeIndex;
    let frameCallback = 0;
    const revealVideo = () => {
      if (disposed || activeIndex !== localIndex || phase !== "playing") return;
      mediaRevealTimer = 0;
      setFrameState(localIndex, "video");
    };
    const onPlaying = () => {
      if (disposed || activeIndex !== localIndex) return;
      currentVideoStartedAt = performance.now();
      minWatchUntil = currentVideoStartedAt + node.config.minWatch * 1000;
      const frameVideo = video as HTMLVideoElement & {
        requestVideoFrameCallback?: (callback: () => void) => number;
        cancelVideoFrameCallback?: (id: number) => void;
      };
      if (typeof frameVideo.requestVideoFrameCallback === "function") {
        frameCallback = frameVideo.requestVideoFrameCallback(revealVideo);
      } else {
        mediaRevealTimer = window.setTimeout(revealVideo, 42);
      }
    };
    const onEnded = () => {
      if (disposed || activeIndex !== localIndex) return;
      finishAutoVideo(activeIndex === FINAL_INDEX);
    };
    const onError = () => {
      if (disposed || activeIndex !== localIndex) return;
      setFrameState(localIndex, "hold");
      finishAutoVideo(false);
    };
    video.addEventListener("playing", onPlaying);
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onError);
    currentVideoCleanup = () => {
      const frameVideo = video as HTMLVideoElement & { cancelVideoFrameCallback?: (id: number) => void };
      if (frameCallback && typeof frameVideo.cancelVideoFrameCallback === "function") {
        frameVideo.cancelVideoFrameCallback(frameCallback);
      }
      clearTimer(mediaRevealTimer);
      mediaRevealTimer = 0;
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
    };

    const play = () => {
      if (disposed || activeIndex !== localIndex || phase !== "playing") return;
      const promise = video.play();
      if (promise?.catch) promise.catch(() => {
        if (disposed || activeIndex !== localIndex) return;
        setStatus("点击或滚动以继续播放");
      });
    };
    const onCanPlay = () => play();
    const previousCleanup = currentVideoCleanup;
    currentVideoCleanup = () => {
      video.removeEventListener("canplay", onCanPlay);
      previousCleanup?.();
    };
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) play();
    else video.addEventListener("canplay", onCanPlay, { once: true, signal });
  };

  const renderScrub = () => {
    if (disposed || activeIndex !== SCRUB_INDEX || phase !== "scrub") {
      scrubFrame = 0;
      return;
    }
    const video = scenes[SCRUB_INDEX].video;
    if (!(video instanceof HTMLVideoElement)) {
      scrubFrame = 0;
      return;
    }
    const timestamp = performance.now();
    const elapsed = scrubLastTimestamp ? Math.min(48, timestamp - scrubLastTimestamp) : 16;
    scrubLastTimestamp = timestamp;
    const easing = 1 - Math.exp(-elapsed / 72);
    scrubVisual += (scrubTarget - scrubVisual) * easing;
    if (Math.abs(scrubVisual - scrubTarget) < 0.0008) scrubVisual = scrubTarget;
    root.style.setProperty("--stage-scrub-progress", scrubVisual.toFixed(5));
    publishProgress();

    if (
      video.readyState >= HTMLMediaElement.HAVE_METADATA
      && Number.isFinite(video.duration)
      && video.duration > 0
      && !scrubSeekBusy
    ) {
      const targetTime = scrubVisual * Math.max(0, video.duration - 1 / 30);
      if (Math.abs(video.currentTime - targetTime) > 1 / 70) {
        scrubSeekBusy = true;
        try {
          video.currentTime = targetTime;
        } catch {
          scrubSeekBusy = false;
        }
      }
    }

    if (Math.abs(scrubVisual - scrubTarget) > 0.0008 || scrubSeekBusy) {
      scrubFrame = window.requestAnimationFrame(renderScrub);
    } else {
      scrubFrame = 0;
      persistState(true);
      if (scrubTarget >= 0.999 && !scrubCompletionTimer) {
        scrubCompletionTimer = window.setTimeout(() => {
          scrubCompletionTimer = 0;
          if (disposed || activeIndex !== SCRUB_INDEX || phase !== "scrub") return;
          beginScene(SCRUB_INDEX + 1, 1, true);
        }, reducedMotion ? 20 : 180);
      }
    }
  };

  const scheduleScrub = () => {
    if (!scrubFrame) scrubFrame = window.requestAnimationFrame(renderScrub);
  };

  const setupScrub = (direction: number, restoredProgress?: number) => {
    const node = scenes[SCRUB_INDEX];
    const video = node.video;
    hydrateScene(SCRUB_INDEX, true);
    phase = "scrub";
    scrubTarget = restoredProgress ?? (direction < 0 ? 1 : 0);
    scrubVisual = scrubTarget;
    scrubLastTimestamp = 0;
    root.style.setProperty("--stage-scrub-progress", scrubVisual.toFixed(5));
    root.classList.add("is-scene-settled");
    root.classList.remove("has-scrub-input");
    if (video instanceof HTMLVideoElement) {
      video.pause();
      setFrameState(SCRUB_INDEX, scrubVisual <= 0.001 ? "first" : "video");
      const seek = () => {
        if (!Number.isFinite(video.duration) || video.duration <= 0) return;
        try { video.currentTime = scrubVisual * Math.max(0, video.duration - 1 / 30); } catch {}
      };
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) seek();
      else video.addEventListener("loadedmetadata", seek, { once: true, signal });
      video.addEventListener("seeked", () => {
        scrubSeekBusy = false;
        if (activeIndex === SCRUB_INDEX && phase === "scrub" && scrubVisual > 0.001) {
          setFrameState(SCRUB_INDEX, "video");
        }
        scheduleScrub();
      }, { signal });
    }
    persistState(true);
    publishProgress();
    setStatus("第 6 幕");

    if (autoEnabled && video instanceof HTMLVideoElement) {
      phase = "playing";
      video.playbackRate = 1;
      const revealAutoScrub = () => {
        if (disposed || activeIndex !== SCRUB_INDEX || phase !== "playing") return;
        setFrameState(SCRUB_INDEX, "video");
      };
      video.addEventListener("playing", () => {
        const frameVideo = video as HTMLVideoElement & {
          requestVideoFrameCallback?: (callback: () => void) => number;
        };
        if (typeof frameVideo.requestVideoFrameCallback === "function") {
          frameVideo.requestVideoFrameCallback(revealAutoScrub);
        } else {
          window.setTimeout(revealAutoScrub, 42);
        }
      }, { once: true, signal });
      const onEnded = () => {
        if (activeIndex !== SCRUB_INDEX || disposed) return;
        scrubTarget = 1;
        scrubVisual = 1;
        root.style.setProperty("--stage-scrub-progress", "1");
        phase = "scrub";
        setFrameState(SCRUB_INDEX, "hold");
        scrubCompletionTimer = window.setTimeout(() => {
          scrubCompletionTimer = 0;
          if (activeIndex === SCRUB_INDEX && phase === "scrub") beginScene(SCRUB_INDEX + 1, 1, true);
        }, 180);
      };
      video.addEventListener("ended", onEnded, { once: true, signal });
      const promise = video.play();
      if (promise?.catch) promise.catch(() => {
        phase = "scrub";
      });
    }
  };

  const startTransformationSequence = () => {
    phase = "sequence";
    root.classList.remove("is-scene-settled");
    publishProgress({ stage: "transformation", transitioning: true });
    const delay = Math.max(460, scenes[activeIndex].config.hold * 1000);
    scheduleSequence(() => {
      if (disposed || activeIndex >= TRANSFORMATION_END) return;
      beginScene(activeIndex + 1, 1, true);
    }, delay);
  };

  const finalizeTransition = (nextIndex: number, direction: number, automatic: boolean, restoredProgress?: number) => {
    if (disposed) return;
    transitionTimer = 0;
    scenes.forEach((node, index) => {
      node.element.classList.toggle("is-active", index === nextIndex);
      node.element.classList.remove("is-entering", "is-outgoing");
    });
    root.classList.remove("is-transitioning", "is-transition-running", "is-reversing", "is-scene-settled", "is-final-settled");
    root.removeAttribute("data-transition");
    activeIndex = nextIndex;
    inputGuardUntil = performance.now() + 220;
    hydrateWindow(activeIndex);
    updatePresentation();
    publishProgress({ transitioning: false });

    const node = scenes[activeIndex];
    if (node.config.mode === "auto") {
      startAutoVideo(direction);
      return;
    }
    if (node.config.mode === "scrub") {
      setupScrub(direction, restoredProgress);
      return;
    }
    if (node.config.mode === "sequence") {
      persistState(false);
      startTransformationSequence();
      return;
    }
    settleStill();
  };

  const beginScene = (nextIndex: number, direction = 1, automatic = false, restoredProgress?: number) => {
    if (disposed || nextIndex < 0 || nextIndex >= scenes.length) return false;
    if (phase === "transition") return false;
    cancelTransientWork();
    wheelAccumulator = 0;
    gestureConsumed = true;
    wheelNeedsFreshGesture = true;
    queueGestureReset();
    const previousIndex = activeIndex;
    const previous = scenes[previousIndex];
    const next = scenes[nextIndex];
    hydrateWindow(nextIndex);
    prepareSceneSurface(nextIndex, direction);
    root.dataset.kisaraStageSettled = "false";
    root.classList.remove("is-final-settled");
    seal?.classList.remove("is-active");

    if (nextIndex === previousIndex && phase === "boot") {
      next.element.classList.add("is-active");
      finalizeTransition(nextIndex, direction, automatic, restoredProgress);
      return true;
    }

    phase = "transition";
    previous?.element.classList.remove("is-active");
    previous?.element.classList.add("is-outgoing");
    next.element.classList.add("is-active", "is-entering");
    root.classList.add("is-transitioning");
    root.classList.toggle("is-reversing", direction < 0);
    const transition = resolveTransition(previousIndex, nextIndex, direction);
    root.dataset.transition = transition;
    if (nextIndex === FINAL_INDEX && direction > 0) root.dataset.titlePhase = "departing";
    persistState(false);
    publishProgress({ stage: transition, transitioning: true });

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!disposed && phase === "transition") root.classList.add("is-transition-running");
      });
    });
    const duration = reducedMotion ? 20 : Math.max(120, TRANSITION_DURATIONS[transition] ?? TRANSITION_DURATIONS.direct);
    root.style.setProperty("--stage-transition-duration", `${duration}ms`);
    transitionRemaining = duration;
    transitionDeadline = performance.now() + duration;
    transitionFinalize = () => {
      transitionTimer = 0;
      transitionDeadline = 0;
      transitionRemaining = 0;
      transitionFinalize = null;
      finalizeTransition(nextIndex, direction, automatic, restoredProgress);
    };
    transitionTimer = window.setTimeout(transitionFinalize, duration);
    return true;
  };

  const previousSceneIndex = () => {
    if (activeIndex >= TRANSFORMATION_START && activeIndex <= TRANSFORMATION_END) return KISS_INDEX;
    if (activeIndex >= 3 && activeIndex <= 6) return 2;
    if (activeIndex === 7) return 6;
    if (activeIndex === 8) return 7;
    if (activeIndex === FINAL_INDEX) return TRANSFORMATION_END;
    return Math.max(0, activeIndex - 1);
  };

  const advanceScrub = (direction: number, amount = 0.28) => {
    if (phase !== "scrub" || activeIndex !== SCRUB_INDEX) return false;
    if (direction > 0 && scrubTarget >= 0.995) return true;
    if (direction < 0 && scrubTarget <= 0.005) return beginScene(2, -1);
    root.classList.add("has-scrub-input");
    scrubTarget = clamp(scrubTarget + direction * amount, 0, 1);
    scheduleScrub();
    return true;
  };

  function advance(direction: number, source: "wheel" | "touch" | "keyboard" | "auto") {
    if (
      disposed
      || foundSelfActive
      || lovebrainActive
      || phase === "transition"
      || phase === "sequence"
      || performance.now() < inputGuardUntil
    ) return false;

    if (activeIndex === SCRUB_INDEX && (phase === "scrub" || phase === "playing")) {
      if (phase === "playing" && source !== "auto") {
        const video = scenes[SCRUB_INDEX].video;
        if (video instanceof HTMLVideoElement) {
          video.pause();
          scrubTarget = Number.isFinite(video.duration) && video.duration > 0 ? video.currentTime / video.duration : scrubTarget;
          scrubVisual = scrubTarget;
        }
        phase = "scrub";
      }
      return advanceScrub(direction, source === "touch" ? 0.38 : 0.3);
    }

    if (phase === "playing") {
      if (direction < 0) {
        cancelCurrentVideo();
        return beginScene(previousSceneIndex(), -1);
      }
      if (performance.now() < minWatchUntil) return false;
      const video = scenes[activeIndex].video;
      if (activeIndex === FINAL_INDEX && video instanceof HTMLVideoElement) {
        if (video.currentTime < 6.15) {
          try { video.currentTime = Math.min(6.2, Math.max(0, video.duration - 0.1)); } catch {}
          minWatchUntil = performance.now() + 820;
          return true;
        }
        finishAutoVideo(true);
        return true;
      }
      if (activeIndex === 0 || activeIndex === 1) {
        cancelCurrentVideo();
        return beginScene(activeIndex + 1, 1, source === "auto");
      }
      if (activeIndex === 3 || activeIndex === 4) {
        cancelCurrentVideo();
        return beginScene(activeIndex + 1, 1, source === "auto");
      }
      finishAutoVideo(false);
      return true;
    }

    if (direction < 0) {
      if (activeIndex <= 0) return false;
      return beginScene(previousSceneIndex(), -1);
    }
    if (activeIndex >= FINAL_INDEX) return false;
    if (activeIndex === KISS_INDEX) grantSpareKey();
    return beginScene(activeIndex + 1, 1, source === "auto");
  }

  const handleWheel = (event: WheelEvent) => {
    if (disposed || lovebrainActive || document.body.classList.contains("is-lovebrain-scene-visible")) return;
    event.preventDefault();
    if (foundSelfActive) {
      requestFoundSelfPlayback();
      return;
    }
    const delta = normalizeWheelDelta(event);
    if (Math.abs(delta) < 0.5) return;
    const timestamp = performance.now();
    const freshGesture = timestamp - lastWheelTimestamp > 210;
    lastWheelTimestamp = timestamp;
    queueGestureReset();

    if (activeIndex === SCRUB_INDEX && phase === "scrub") {
      if (wheelNeedsFreshGesture) {
        if (!freshGesture) return;
        wheelNeedsFreshGesture = false;
        gestureConsumed = false;
      }
      if (freshGesture && delta < 0 && scrubTarget <= 0.005) {
        beginScene(2, -1);
        return;
      }
      root.classList.add("has-scrub-input");
      clearTimer(scrubCompletionTimer);
      scrubCompletionTimer = 0;
      scrubTarget = clamp(scrubTarget + delta / (coarsePointer ? 690 : 980), 0, 1);
      scheduleScrub();
      return;
    }

    if (wheelNeedsFreshGesture) return;

    if (gestureConsumed) return;
    if (wheelAccumulator !== 0 && Math.sign(wheelAccumulator) !== Math.sign(delta)) wheelAccumulator = 0;
    wheelAccumulator += delta;
    const threshold = clamp(window.innerHeight * 0.082, 62, 86);
    if (Math.abs(wheelAccumulator) < threshold) return;
    gestureConsumed = true;
    const direction = Math.sign(wheelAccumulator);
    wheelAccumulator = 0;
    advance(direction, "wheel");
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (disposed || lovebrainActive || foundSelfActive || event.defaultPrevented) return;
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return;
    const forward = event.key === "ArrowDown" || event.key === "PageDown" || event.key === " " || event.key === "Enter";
    const backward = event.key === "ArrowUp" || event.key === "PageUp";
    if (!forward && !backward) return;
    event.preventDefault();
    if (performance.now() < inputGuardUntil) return;
    inputGuardUntil = performance.now() + 260;
    advance(forward ? 1 : -1, "keyboard");
  };

  const handleTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1 || lovebrainActive) return;
    const touch = event.touches[0];
    touchStartY = touch.clientY;
    touchLastY = touch.clientY;
    touchId = touch.identifier;
    touchScrubbing = false;
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (touchStartY === null || touchId === null || lovebrainActive) return;
    const touch = Array.from(event.touches).find((candidate) => candidate.identifier === touchId);
    if (!touch) return;
    event.preventDefault();
    if (foundSelfActive) {
      requestFoundSelfPlayback();
      return;
    }
    if (activeIndex === SCRUB_INDEX && phase === "scrub" && touchLastY !== null) {
      const delta = touchLastY - touch.clientY;
      touchLastY = touch.clientY;
      if (Math.abs(delta) < 0.2) return;
      touchScrubbing = true;
      root.classList.add("has-scrub-input");
      clearTimer(scrubCompletionTimer);
      scrubCompletionTimer = 0;
      scrubTarget = clamp(scrubTarget + delta / Math.max(360, window.innerHeight * 0.72), 0, 1);
      scheduleScrub();
    }
  };

  const handleTouchEnd = (event: TouchEvent) => {
    if (touchStartY === null || touchId === null || lovebrainActive) return;
    const touch = Array.from(event.changedTouches).find((candidate) => candidate.identifier === touchId);
    const startY = touchStartY;
    touchStartY = null;
    touchLastY = null;
    touchId = null;
    if (!touch || foundSelfActive) return;
    if (touchScrubbing) {
      touchScrubbing = false;
      return;
    }
    const delta = startY - touch.clientY;
    if (Math.abs(delta) < 42) return;
    advance(Math.sign(delta), "touch");
  };

  const setFoundSelfSuspension = (active: boolean) => {
    if (foundSelfSuspended === active) return;
    foundSelfSuspended = active;
    window.dispatchEvent(new CustomEvent("yuimi:kisara-audio-suspension", {
      detail: { id: "found-self", active }
    }));
  };

  const finishFoundSelf = () => {
    if (!foundSelfActive) return;
    clearTimer(foundSelfTimer);
    clearTimer(foundSelfReadyTimer);
    foundSelfTimer = 0;
    foundSelfReadyTimer = 0;
    foundSelfActive = false;
    foundSelfPlaying = false;
    foundSelfVideo?.pause();
    setFoundSelfSuspension(false);
    root.classList.remove("is-found-self-active", "is-found-self-leaving");
    foundSelfOverlay?.classList.remove("is-running", "is-media-ready", "is-holding", "is-settled", "is-leaving");
    foundSelfOverlay?.setAttribute("aria-hidden", "true");
    if (foundSelfOverlay) foundSelfOverlay.dataset.state = "inactive";
    delete document.documentElement.dataset.kisaraFoundSelfEntry;
    window.dispatchEvent(new CustomEvent("yuimi:kisara-found-self-state", {
      detail: { active: false, state: "inactive" }
    }));
    phase = "boot";
    activeIndex = 0;
    scenes.forEach((scene) => scene.element.classList.remove("is-active", "is-outgoing", "is-entering"));
    beginScene(0, 1);
  };

  const leaveFoundSelf = () => {
    if (!foundSelfActive || root.classList.contains("is-found-self-leaving")) return;
    foundSelfVideo?.pause();
    root.classList.add("is-found-self-leaving");
    foundSelfOverlay?.classList.add("is-leaving");
    setFoundSelfSuspension(false);
    foundSelfTimer = window.setTimeout(finishFoundSelf, reducedMotion ? 30 : 620);
  };

  function requestFoundSelfPlayback() {
    if (!foundSelfActive || foundSelfPlaying || !(foundSelfVideo instanceof HTMLVideoElement)) return;
    const promise = foundSelfVideo.play();
    if (promise?.then) {
      promise.then(() => {
        if (!foundSelfActive) return;
        foundSelfPlaying = true;
        foundSelfOverlay?.classList.add("is-running", "is-media-ready");
        if (foundSelfOverlay) foundSelfOverlay.dataset.state = "playing";
        if (foundSelfStatus) foundSelfStatus.textContent = "MEMORY PLAYBACK";
        if (foundSelfAnnouncer) foundSelfAnnouncer.textContent = "记忆正在自动回放。";
        runtimeWindow.__yuimiKisaraEasterLedger?.mark?.("found-self");
      }).catch(() => {
        if (foundSelfStatus) foundSelfStatus.textContent = "MEMORY SIGNAL";
      });
    }
  }

  const startFoundSelf = () => {
    if (!(foundSelfOverlay instanceof HTMLElement)) {
      beginScene(0, 1);
      return;
    }
    foundSelfActive = true;
    phase = "found-self";
    root.classList.add("is-found-self-active");
    foundSelfOverlay.setAttribute("aria-hidden", "false");
    foundSelfOverlay.dataset.state = "loading";
    if (foundSelfStatus) foundSelfStatus.textContent = "MEMORY SEARCH";
    setFoundSelfSuspension(true);
    window.dispatchEvent(new CustomEvent("yuimi:kisara-found-self-state", {
      detail: { active: true, state: "loading" }
    }));
    if (foundSelfVideo instanceof HTMLVideoElement) {
      if (foundSelfVideo.dataset.poster) foundSelfVideo.poster = foundSelfVideo.dataset.poster;
      if (foundSelfVideo.dataset.src && !foundSelfVideo.src) foundSelfVideo.src = foundSelfVideo.dataset.src;
      foundSelfVideo.preload = "auto";
      foundSelfVideo.muted = false;
      foundSelfVideo.volume = 0.82;
      try { foundSelfVideo.currentTime = 0; } catch {}
      foundSelfVideo.load();
      foundSelfVideo.addEventListener("canplay", requestFoundSelfPlayback, { signal });
      foundSelfVideo.addEventListener("playing", () => {
        foundSelfPlaying = true;
        foundSelfOverlay.classList.add("is-running", "is-media-ready");
        foundSelfOverlay.dataset.state = "playing";
      }, { signal });
      foundSelfVideo.addEventListener("ended", () => {
        if (!foundSelfActive) return;
        foundSelfOverlay.classList.add("is-holding", "is-settled");
        foundSelfOverlay.dataset.state = "settled";
        if (foundSelfStatus) foundSelfStatus.textContent = "MEMORY FOUND";
        foundSelfTimer = window.setTimeout(leaveFoundSelf, reducedMotion ? 80 : 900);
      }, { signal });
      foundSelfReadyTimer = window.setTimeout(requestFoundSelfPlayback, 850);
    } else {
      foundSelfTimer = window.setTimeout(leaveFoundSelf, 1200);
    }
    publishProgress({ active: false, progress: 0, stage: "found-self", guided: true, transitioning: false });
  };

  const activateLovebrain = () => {
    if (
      disposed
      || lovebrainActive
      || foundSelfActive
      || activeIndex !== FINAL_INDEX
      || root.dataset.kisaraStageSettled !== "true"
    ) return false;
    cancelTransientWork();
    lovebrainActive = true;
    phase = "lovebrain";
    root.classList.add("is-lovebrain-active");
    document.body.classList.add("is-lovebrain-home-active");
    publishProgress({ active: false, progress: 1, stage: "lovebrain", transitioning: false });
    return true;
  };

  const leaveLovebrain = () => {
    if (!lovebrainActive) return false;
    clearTimer(lovebrainTimer);
    root.classList.add("is-lovebrain-returning");
    lovebrainTimer = window.setTimeout(() => {
      lovebrainTimer = 0;
      lovebrainActive = false;
      phase = "final";
      root.classList.remove("is-lovebrain-active", "is-lovebrain-returning");
      document.body.classList.remove("is-lovebrain-home-active");
      setFinalSettled(finalQualified);
      window.dispatchEvent(new CustomEvent("yuimi:kisara-lovebrain-opening-covered"));
    }, reducedMotion ? 30 : 620);
    return true;
  };

  runtimeWindow.__yuimiKisaraHomeLovebrain = {
    activate: activateLovebrain,
    leaveToOpening: leaveLovebrain
  };

  const skipToEnd = () => {
    if (foundSelfActive) {
      leaveFoundSelf();
      return;
    }
    if (lovebrainActive) return;
    cancelTransientWork();
    scenes.forEach((node) => node.element.classList.remove("is-active", "is-outgoing", "is-entering"));
    activeIndex = FINAL_INDEX;
    hydrateScene(FINAL_INDEX, true);
    const finalNode = scenes[FINAL_INDEX];
    finalNode.element.classList.add("is-active");
    finalNode.video?.pause();
    setFrameState(FINAL_INDEX, "hold");
    root.classList.remove("is-transitioning", "is-transition-running", "is-reversing");
    root.removeAttribute("data-transition");
    updatePresentation();
    setFinalSettled(false);
  };

  const replay = () => {
    if (lovebrainActive || foundSelfActive) return;
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
    finalQualified = false;
    autoEnabled = false;
    if (autoButton) {
      autoButton.setAttribute("aria-pressed", "false");
      autoButton.querySelector("span")!.textContent = "AUTO";
    }
    cancelTransientWork();
    scenes.forEach((node) => {
      node.element.classList.remove("is-active", "is-outgoing", "is-entering");
      if (node.video instanceof HTMLVideoElement) {
        node.video.pause();
        try { node.video.currentTime = 0; } catch {}
        node.element.dataset.frameState = "first";
      } else {
        node.element.dataset.frameState = "still";
      }
    });
    root.dataset.kisaraStageSettled = "false";
    root.classList.remove("is-final-settled", "is-scene-settled");
    root.classList.remove("has-scrub-input");
    root.dataset.titlePhase = "dormant";
    seal?.classList.remove("is-active");
    activeIndex = 0;
    phase = "boot";
    beginScene(0, 1);
  };

  const toggleAuto = () => {
    autoEnabled = !autoEnabled;
    autoButton?.setAttribute("aria-pressed", String(autoEnabled));
    const label = autoButton?.querySelector("span");
    if (label) label.textContent = autoEnabled ? "AUTO ON" : "AUTO";
    publishProgress();
    if (!autoEnabled) {
      clearTimer(autoTimer);
      autoTimer = 0;
      if (activeIndex === SCRUB_INDEX && phase === "playing") {
        const video = scenes[SCRUB_INDEX].video;
        if (video instanceof HTMLVideoElement) {
          video.pause();
          scrubTarget = Number.isFinite(video.duration) && video.duration > 0 ? video.currentTime / video.duration : scrubTarget;
          scrubVisual = scrubTarget;
          phase = "scrub";
          scheduleScrub();
        }
      }
      return;
    }
    if (phase === "still") queueAutoAdvance(0.2);
    else if (phase === "scrub") setupScrub(1, scrubTarget);
  };

  const handleVisibility = () => {
    if (document.visibilityState === "hidden") {
      const video = scenes[activeIndex]?.video;
      resumeVideoAfterVisibility = phase === "playing" && video instanceof HTMLVideoElement && !video.paused;
      video?.pause();
      if (foundSelfActive && foundSelfVideo instanceof HTMLVideoElement) {
        foundSelfVideo.pause();
        foundSelfPlaying = false;
      }
      clearTimer(autoTimer);
      autoTimer = 0;
      if (sequenceTimer && sequenceResume) {
        sequenceRemaining = Math.max(30, sequenceDeadline - performance.now());
        clearTimer(sequenceTimer);
        sequenceTimer = 0;
      }
      if (phase === "transition" && transitionTimer && transitionFinalize) {
        transitionRemaining = Math.max(30, transitionDeadline - performance.now());
        clearTimer(transitionTimer);
        transitionTimer = 0;
      }
      return;
    }
    hydrateWindow(activeIndex);
    if (foundSelfActive) requestFoundSelfPlayback();
    if (phase === "transition" && transitionFinalize && !transitionTimer) {
      transitionDeadline = performance.now() + Math.max(30, transitionRemaining);
      transitionTimer = window.setTimeout(transitionFinalize, Math.max(30, transitionRemaining));
    }
    const activeVideo = scenes[activeIndex]?.video;
    if (
      phase === "playing"
      && activeVideo instanceof HTMLVideoElement
      && activeVideo.paused
      && !activeVideo.ended
    ) {
      resumeVideoAfterVisibility = false;
      const promise = activeVideo.play();
      if (promise?.catch) promise.catch(() => undefined);
    } else if (autoEnabled && phase === "still") {
      queueAutoAdvance();
    } else if (phase === "sequence" && sequenceResume && !sequenceTimer) {
      scheduleSequence(sequenceResume, Math.max(30, sequenceRemaining));
    } else if (phase === "sequence" && activeIndex >= TRANSFORMATION_START && activeIndex < TRANSFORMATION_END) {
      startTransformationSequence();
    }
    publishProgress();
  };

  window.addEventListener("wheel", handleWheel, { passive: false, signal });
  window.addEventListener("keydown", handleKeydown, { signal });
  root.addEventListener("touchstart", handleTouchStart, { passive: true, signal });
  root.addEventListener("touchmove", handleTouchMove, { passive: false, signal });
  root.addEventListener("touchend", handleTouchEnd, { passive: true, signal });
  document.addEventListener("visibilitychange", handleVisibility, { signal });
  autoButton?.addEventListener("click", toggleAuto, { signal });
  skipButton?.addEventListener("click", skipToEnd, { signal });
  replayButton?.addEventListener("click", replay, { signal });
  foundSelfSkip?.addEventListener("click", leaveFoundSelf, { signal });

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    lifecycle.abort();
    cancelTransientWork();
    clearTimer(lovebrainTimer);
    clearTimer(foundSelfTimer);
    clearTimer(foundSelfReadyTimer);
    clearTimer(gestureTimer);
    if (scrubFrame) window.cancelAnimationFrame(scrubFrame);
    scenes.forEach((node) => node.video?.pause());
    foundSelfVideo?.pause();
    setFoundSelfSuspension(false);
    document.body.classList.remove("is-lovebrain-home-active");
    delete document.documentElement.dataset.kisaraFoundSelfEntry;
    if (runtimeWindow.__yuimiKisaraHomeLovebrain) runtimeWindow.__yuimiKisaraHomeLovebrain = null;
    root.removeAttribute("data-bound");
    runtimeWindow.__yuimiKisaraHomeBootController?.markReady?.();
    if (runtimeWindow.__yuimiKisaraStageHomeCleanup === cleanup) {
      runtimeWindow.__yuimiKisaraStageHomeCleanup = null;
    }
  };
  runtimeWindow.__yuimiKisaraStageHomeCleanup = cleanup;

  const saved = readSavedState(scenes.length);
  const foundSelfRequested = hasFoundSelfTicket();
  if (foundSelfRequested) document.documentElement.dataset.kisaraFoundSelfEntry = "pending";
  hydrateWindow(foundSelfRequested ? 0 : saved?.index ?? 0);

  window.requestAnimationFrame(() => {
    runtimeWindow.__yuimiKisaraHomeBootController?.markReady?.();
  });

  if (foundSelfRequested) {
    scenes[0].element.classList.add("is-active");
    updatePresentation();
    startFoundSelf();
  } else if (reducedMotion) {
    activeIndex = FINAL_INDEX;
    scenes[FINAL_INDEX].element.classList.add("is-active");
    prepareSceneSurface(FINAL_INDEX, -1);
    updatePresentation();
    setFinalSettled(false);
  } else if (saved) {
    activeIndex = saved.index;
    scenes[activeIndex].element.classList.add("is-active");
    prepareSceneSurface(activeIndex, activeIndex === SCRUB_INDEX ? 1 : -1);
    updatePresentation();
    if (activeIndex === SCRUB_INDEX) setupScrub(1, saved.scrubProgress);
    else if (activeIndex === FINAL_INDEX) setFinalSettled(false);
    else if (activeIndex >= TRANSFORMATION_START && activeIndex < TRANSFORMATION_END) {
      updatePresentation();
      startTransformationSequence();
    }
    else settleStill();
  } else {
    activeIndex = 0;
    phase = "boot";
    beginScene(0, 1);
  }
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
