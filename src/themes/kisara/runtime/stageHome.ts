type ChapterId = "rescue" | "request" | "counterattack" | "contract" | "transformation" | "jealousy";
type FrameState = "first" | "video" | "hold";
type StableState = "opening" | "settled" | "final";

interface ChapterConfig {
  id: ChapterId;
  label: string;
  title: string;
  index: number;
}

interface LayerNode {
  name: string;
  element: HTMLElement;
  first: HTMLImageElement | null;
  video: HTMLVideoElement | null;
  hold: HTMLImageElement | null;
}

interface SavedStageState {
  version: 2;
  scene: ChapterId;
  stable: StableState;
}

type HomeLovebrainApi = {
  activate?: () => boolean;
  leaveToOpening?: () => boolean;
};

type KisaraWindow = Window & typeof globalThis & {
  __yuimiKisaraStageHomeController?: HomeChapterController | null;
  __yuimiKisaraStageHomeSchedule?: (() => void) | null;
  __yuimiKisaraStageHomeInitTimer?: number;
  __yuimiKisaraStageHomeLifecycleBound?: boolean;
  __yuimiKisaraHomeLovebrain?: HomeLovebrainApi | null;
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

const CHAPTER_IDS: ChapterId[] = [
  "rescue",
  "request",
  "counterattack",
  "contract",
  "transformation",
  "jealousy"
];

const STORAGE_KEY = "yuimi-kisara-home-keyframe-v2";
const LEGACY_STORAGE_KEY = "yuimi-kisara-home-chapters-v1";
const WHEEL_THRESHOLD = 42;
const GESTURE_GAP = 180;
const INPUT_LOCK_MS = 720;
const SCENE_HANDOFF_MS = 520;
const SCENE_ACTION_MS: Record<ChapterId, number> = {
  rescue: 320,
  request: 620,
  counterattack: 500,
  contract: 620,
  transformation: 660,
  jealousy: 560
};

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const nextFrame = () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

const normalizeWheel = (event: WheelEvent) => {
  const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE
    ? 18
    : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
      ? window.innerHeight
      : 1;
  return clamp(event.deltaY * scale, -180, 180);
};

const readManifest = (root: HTMLElement): ChapterConfig[] => {
  const source = root.querySelector("[data-kisara-stage-manifest]")?.textContent ?? "[]";
  try {
    const parsed = JSON.parse(source);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const readSavedState = (): SavedStageState | null => {
  try {
    const current = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (current?.version === 2 && CHAPTER_IDS.includes(current.scene)) {
      return {
        version: 2,
        scene: current.scene,
        stable: current.stable === "final" ? "final" : "settled"
      };
    }

    const legacy = JSON.parse(sessionStorage.getItem(LEGACY_STORAGE_KEY) ?? "null");
    if (legacy?.version === 1 && CHAPTER_IDS.includes(legacy.chapter)) {
      return {
        version: 2,
        scene: legacy.chapter,
        stable: legacy.beat === "blackface-hold" ? "final" : "settled"
      };
    }
  } catch {}
  return null;
};

class HomeChapterController {
  private readonly root: HTMLElement;
  private readonly host: HTMLElement;
  private readonly runtimeWindow: KisaraWindow;
  private readonly manifest: ChapterConfig[];
  private readonly chapters: HTMLElement[];
  private readonly chapterIndex = new Map<ChapterId, number>();
  private readonly layers = new Map<string, LayerNode>();
  private readonly markers: HTMLButtonElement[];
  private readonly replayButton: HTMLButtonElement | null;
  private readonly status: HTMLElement | null;
  private readonly foundSelfOverlay: HTMLElement | null;
  private readonly foundSelfVideo: HTMLVideoElement | null;
  private readonly foundSelfSkip: HTMLButtonElement | null;
  private readonly foundSelfStatus: HTMLElement | null;
  private readonly lifecycle = new AbortController();
  private readonly reducedMotion: boolean;

  private disposed = false;
  private activeIndex = 0;
  private stableState: StableState = "opening";
  private actionState: "idle" | "running" | "settled" = "idle";
  private epoch = 0;
  private transitionSerial = 0;
  private playbackToken = 0;
  private playbackCleanup: (() => void) | null = null;
  private inputLockUntil = 0;
  private wheelAccumulator = 0;
  private lastWheelAt = 0;
  private touchStartY: number | null = null;
  private touchLastY: number | null = null;
  private suspended = false;
  private readonly visibilityWaiters = new Set<() => void>();
  private readonly resumeVideos = new Set<HTMLVideoElement>();
  private spareKeyGranted = false;
  private finalQualified = false;
  private foundSelfActive = false;
  private foundSelfFinishing = false;
  private foundSelfTimer = 0;
  private lovebrainActive = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.host = root.closest<HTMLElement>("[data-kisara-gate]") ?? root;
    this.runtimeWindow = window as KisaraWindow;
    this.manifest = readManifest(root);
    this.manifest.forEach((chapter, index) => this.chapterIndex.set(chapter.id, index));
    this.chapters = CHAPTER_IDS
      .map((id) => root.querySelector<HTMLElement>(`[data-home-chapter="${id}"]`))
      .filter(Boolean) as HTMLElement[];
    root.querySelectorAll<HTMLElement>("[data-stage-layer]").forEach((element) => {
      const name = element.dataset.stageLayer ?? "";
      if (!name) return;
      this.layers.set(name, {
        name,
        element,
        first: element.querySelector<HTMLImageElement>("[data-layer-first]"),
        video: element.querySelector<HTMLVideoElement>("[data-layer-video]"),
        hold: element.querySelector<HTMLImageElement>("[data-layer-hold]")
      });
    });
    this.markers = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-home-chapter-target]"));
    this.replayButton = root.querySelector<HTMLButtonElement>("[data-home-replay]");
    this.status = root.querySelector<HTMLElement>("[data-stage-status]");
    this.foundSelfOverlay = this.host.querySelector<HTMLElement>("[data-kisara-found-self]");
    this.foundSelfVideo = this.host.querySelector<HTMLVideoElement>("[data-kisara-found-self-video]");
    this.foundSelfSkip = this.host.querySelector<HTMLButtonElement>("[data-kisara-found-self-skip]");
    this.foundSelfStatus = this.host.querySelector<HTMLElement>("[data-kisara-found-self-status]");
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  start() {
    if (this.root.dataset.bound === "true") return;
    const ids = this.manifest.map((chapter) => chapter.id);
    if (ids.length !== CHAPTER_IDS.length || CHAPTER_IDS.some((id, index) => id !== ids[index])) {
      this.root.dataset.stageError = "manifest";
      this.runtimeWindow.__yuimiKisaraHomeBootController?.markReady?.();
      return;
    }
    this.root.dataset.bound = "true";
    this.bindEvents();
    this.installLovebrainApi();
    this.runtimeWindow.__yuimiKisaraHomeBootController?.markReady?.();
    if (document.documentElement.dataset.kisaraFoundSelfEntry === "pending") {
      void this.startFoundSelf();
      return;
    }
    void this.restore();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.epoch += 1;
    this.transitionSerial += 1;
    this.stopPlayback();
    this.pauseAllVideos();
    if (this.foundSelfTimer) window.clearTimeout(this.foundSelfTimer);
    this.foundSelfTimer = 0;
    this.visibilityWaiters.forEach((wake) => wake());
    this.visibilityWaiters.clear();
    this.lifecycle.abort();
    if (this.runtimeWindow.__yuimiKisaraHomeLovebrain?.activate === this.activateLovebrain) {
      this.runtimeWindow.__yuimiKisaraHomeLovebrain = null;
    }
    this.root.removeAttribute("data-bound");
  }

  private currentId() {
    return CHAPTER_IDS[this.activeIndex] ?? "rescue";
  }

  private setStatus(value: string) {
    if (this.status) this.status.textContent = value;
  }

  private isCurrent(epoch: number) {
    return !this.disposed && epoch === this.epoch;
  }

  private beginOperation() {
    this.epoch += 1;
    this.transitionSerial += 1;
    this.stopPlayback();
    this.actionState = "idle";
    this.chapters.forEach((chapter) => { chapter.dataset.sceneAction = "idle"; });
    return this.epoch;
  }

  private async waitUntilVisible(epoch: number) {
    if (!this.isCurrent(epoch)) return false;
    if (!this.suspended) return true;
    return await new Promise<boolean>((resolve) => {
      const wake = () => resolve(this.isCurrent(epoch) && !this.suspended);
      this.visibilityWaiters.add(wake);
    });
  }

  private async wait(ms: number, epoch: number) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, ms));
    return await this.waitUntilVisible(epoch);
  }

  private async loadImage(image: HTMLImageElement | null, eager = false) {
    if (!(image instanceof HTMLImageElement)) return false;
    if (!image.src) {
      const source = image.dataset.src;
      if (!source) return false;
      image.loading = eager ? "eager" : "lazy";
      image.fetchPriority = eager ? "high" : "low";
      image.src = source;
      delete image.dataset.src;
    }
    if (!image.complete) {
      await new Promise<void>((resolve) => {
        const finish = () => resolve();
        image.addEventListener("load", finish, { once: true });
        image.addEventListener("error", finish, { once: true });
      });
    }
    if (image.naturalWidth <= 0) return false;
    try { await image.decode?.(); } catch {}
    return image.naturalWidth > 0;
  }

  private async hydrateVideo(video: HTMLVideoElement | null, eager = false) {
    if (!(video instanceof HTMLVideoElement)) return false;
    if (!video.src) {
      const source = video.dataset.src;
      if (!source) return false;
      video.preload = eager ? "auto" : "metadata";
      video.src = source;
      delete video.dataset.src;
      video.load();
    } else if (eager) {
      video.preload = "auto";
    }
    if (!eager || video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return true;
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, 2400);
      const finish = () => {
        window.clearTimeout(timer);
        resolve();
      };
      video.addEventListener("loadeddata", finish, { once: true });
      video.addEventListener("canplay", finish, { once: true });
      video.addEventListener("error", finish, { once: true });
    });
    return video.readyState >= HTMLMediaElement.HAVE_METADATA;
  }

  private async hydrateLayer(name: string, eager = false) {
    const layer = this.layers.get(name);
    if (!layer) return false;
    const [first, hold, video] = await Promise.all([
      this.loadImage(layer.first, eager),
      this.loadImage(layer.hold, eager),
      this.hydrateVideo(layer.video, eager)
    ]);
    return first || hold || video;
  }

  private async hydrateChapter(index: number, eager = false) {
    const chapter = this.chapters[index];
    if (!chapter) return false;
    const names = Array.from(chapter.querySelectorAll<HTMLElement>("[data-stage-layer]"))
      .map((element) => element.dataset.stageLayer ?? "")
      .filter(Boolean);
    const results = await Promise.all(names.map((name) => this.hydrateLayer(name, eager)));
    return results.some(Boolean);
  }

  private setLayerFrame(name: string, state: FrameState) {
    const layer = this.layers.get(name);
    if (layer) layer.element.dataset.frameState = state;
  }

  private stopPlayback() {
    this.playbackToken += 1;
    this.playbackCleanup?.();
    this.playbackCleanup = null;
  }

  private async seekVideo(video: HTMLVideoElement, time: number, epoch: number, token: number) {
    const target = Math.max(0, time);
    if (Math.abs(video.currentTime - target) < 0.025 && video.readyState >= 2) return true;
    return await new Promise<boolean>((resolve) => {
      let settled = false;
      const finish = (success: boolean) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        video.removeEventListener("seeked", onSeeked);
        video.removeEventListener("error", onError);
        resolve(success && !this.disposed && this.epoch === epoch && this.playbackToken === token);
      };
      const onSeeked = () => finish(true);
      const onError = () => finish(false);
      const timeout = window.setTimeout(() => finish(video.readyState >= 2), 520);
      video.addEventListener("seeked", onSeeked, { once: true });
      video.addEventListener("error", onError, { once: true });
      try { video.currentTime = target; } catch { finish(false); }
    });
  }

  private async playLayer(name: string) {
    const layer = this.layers.get(name);
    if (!layer?.video) return false;
    const epoch = this.epoch;
    const ready = await this.hydrateLayer(name, true);
    if (!ready || !this.isCurrent(epoch) || !(await this.waitUntilVisible(epoch))) return false;

    this.stopPlayback();
    const token = ++this.playbackToken;
    const video = layer.video;
    video.pause();
    video.playbackRate = 1;
    this.setLayerFrame(name, "first");
    if (!(await this.seekVideo(video, 0, epoch, token))) return false;

    return await new Promise<boolean>((resolve) => {
      let finished = false;
      let frameCallback = 0;
      const current = () => !this.disposed
        && this.epoch === epoch
        && this.playbackToken === token
        && !finished;
      const cleanup = () => {
        video.removeEventListener("playing", onPlaying);
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("error", onError);
        if (frameCallback && typeof video.cancelVideoFrameCallback === "function") {
          video.cancelVideoFrameCallback(frameCallback);
        }
        frameCallback = 0;
      };
      const finish = (success: boolean) => {
        if (finished) return;
        finished = true;
        cleanup();
        if (success && this.epoch === epoch) {
          this.setLayerFrame(name, "hold");
        }
        if (this.playbackCleanup === cancel) this.playbackCleanup = null;
        resolve(success && this.epoch === epoch);
      };
      const cancel = () => {
        video.pause();
        finish(false);
      };
      const onPlaying = () => {
        if (!current()) return;
        if (typeof video.requestVideoFrameCallback === "function") {
          frameCallback = video.requestVideoFrameCallback(() => {
            if (current()) this.setLayerFrame(name, "video");
          });
        } else {
          window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
            if (current()) this.setLayerFrame(name, "video");
          }));
        }
      };
      const onEnded = () => finish(true);
      const onError = () => finish(false);
      video.addEventListener("playing", onPlaying);
      video.addEventListener("ended", onEnded);
      video.addEventListener("error", onError);
      this.playbackCleanup = cancel;
      video.play()?.catch(() => finish(false));
    });
  }

  private pauseAllVideos() {
    this.root.querySelectorAll("video").forEach((video) => video.pause());
    this.foundSelfVideo?.pause();
  }

  private setChapterPositions(index: number) {
    this.chapters.forEach((chapter, chapterIndex) => {
      const active = chapterIndex === index;
      chapter.dataset.chapterPosition = active ? "active" : chapterIndex < index ? "before" : "after";
      chapter.setAttribute("aria-hidden", String(!active));
      chapter.inert = !active;
      if (!active) chapter.dataset.sceneAction = "idle";
    });
    this.markers.forEach((marker) => {
      const active = marker.dataset.homeChapterTarget === CHAPTER_IDS[index];
      if (active) marker.setAttribute("aria-current", "step");
      else marker.removeAttribute("aria-current");
    });
    this.root.dataset.activeChapter = CHAPTER_IDS[index];
  }

  private transitionName(from: ChapterId, to: ChapterId) {
    if (from === to) return "reset";
    if (from === "rescue" && to === "request") return "rescue-request";
    if (from === "request" && to === "counterattack") return "request-counter";
    if (from === "counterattack" && to === "contract") return "counter-contract";
    if (from === "contract" && to === "transformation") return "contract-transform";
    if (from === "transformation" && to === "jealousy") return "transform-jealousy";
    return this.chapterIndex.get(to)! < this.chapterIndex.get(from)! ? "backward" : "chapter-cut";
  }

  private async switchChapter(
    index: number,
    options: { instant?: boolean; restoreStable?: boolean; runAction?: boolean } = {}
  ) {
    const bounded = Math.max(0, Math.min(CHAPTER_IDS.length - 1, index));
    const from = this.currentId();
    const to = CHAPTER_IDS[bounded];
    const epoch = this.beginOperation();
    const serial = this.transitionSerial;
    await this.hydrateChapter(bounded, true);
    if (!this.isCurrent(epoch) || serial !== this.transitionSerial || !(await this.waitUntilVisible(epoch))) return false;

    this.activeIndex = bounded;
    this.stableState = options.restoreStable ? (to === "jealousy" ? "final" : "settled") : "opening";
    this.actionState = options.restoreStable ? "settled" : "idle";
    this.root.dataset.sceneTransition = this.transitionName(from, to);
    this.root.dataset.stageState = options.restoreStable || options.instant ? "settled" : "switching";
    this.root.classList.toggle("is-switching", !options.instant && !this.reducedMotion);
    this.host.dataset.kisaraStageSettled = "false";
    this.setChapterPositions(bounded);
    this.publishProgress(!options.restoreStable && !options.instant);
    await nextFrame();
    if (!this.isCurrent(epoch) || serial !== this.transitionSerial) return false;

    if (options.restoreStable) {
      this.restoreStableScene(to);
    } else if (options.runAction !== false) {
      void this.runSceneAction(to, epoch);
    } else {
      this.finishScene(to, false);
    }

    window.setTimeout(() => {
      if (!this.isCurrent(epoch)) return;
      this.root.classList.remove("is-switching");
      delete this.root.dataset.sceneTransition;
    }, options.instant || this.reducedMotion ? 1 : SCENE_HANDOFF_MS);
    this.prewarmAdjacent(bounded);
    return true;
  }

  private prewarmAdjacent(index: number) {
    window.setTimeout(() => {
      if (this.disposed) return;
      void this.hydrateChapter(index + 1, false);
      void this.hydrateChapter(index - 1, false);
    }, 120);
  }

  private async runSceneAction(id: ChapterId, epoch: number) {
    if (!this.isCurrent(epoch)) return false;
    if (this.reducedMotion) {
      this.finishScene(id, false);
      return true;
    }

    this.actionState = "running";
    const chapter = this.chapters[this.activeIndex];
    if (chapter) chapter.dataset.sceneAction = "running";
    this.root.dataset.stageState = "playing";
    this.publishProgress(true);

    let ended = true;
    const videoLayer = id === "rescue"
      ? "rescue-action"
      : id === "counterattack"
        ? "counter-action"
        : id === "jealousy"
          ? "jealousy-action"
          : null;
    if (videoLayer) {
      ended = await this.playLayer(videoLayer);
    } else {
      ended = await this.wait(SCENE_ACTION_MS[id], epoch);
    }
    if (!ended || !this.isCurrent(epoch)) return false;
    this.finishScene(id, true);
    return true;
  }

  private finishScene(id: ChapterId, actionCompleted: boolean) {
    if (this.currentId() !== id || this.disposed) return;
    this.actionState = "settled";
    this.stableState = id === "jealousy" ? "final" : "settled";
    const chapter = this.chapters[this.activeIndex];
    if (chapter) chapter.dataset.sceneAction = "settled";
    this.root.dataset.stageState = "settled";
    this.host.dataset.kisaraStageSettled = id === "jealousy" ? "true" : "false";
    if (id === "contract") this.grantSpareKey();
    if (id === "jealousy") this.qualifyFinalScene();
    this.setStatus(actionCompleted ? `${id} 场景定格` : `${id} 场景已恢复`);
    this.persist();
    this.publishProgress(false);
  }

  private qualifyFinalScene() {
    if (this.finalQualified) return;
    this.finalQualified = true;
    this.runtimeWindow.__yuimiKisaraLovebrainProgress?.markStage?.("home-jealousy");
  }

  private grantSpareKey() {
    if (this.spareKeyGranted) return;
    this.spareKeyGranted = true;
    const granted = this.runtimeWindow.__yuimiKisaraLovebrainProgress?.markSpareKey?.() === true;
    this.runtimeWindow.__yuimiKisaraEasterLedger?.mark?.("photo-archive");
    if (!granted) return;
    window.dispatchEvent(new CustomEvent("yuimi:kisara-secret-audio", {
      detail: {
        trackId: "kokoro-spare-key",
        autoplay: false,
        grantId: `home-contract-${Date.now()}-${Math.round(performance.now())}`
      }
    }));
  }

  private restoreStableScene(id: ChapterId) {
    this.actionState = "settled";
    this.stableState = id === "jealousy" ? "final" : "settled";
    this.chapters[this.activeIndex]?.setAttribute("data-scene-action", "settled");
    this.root.dataset.stageState = "settled";
    this.host.dataset.kisaraStageSettled = id === "jealousy" ? "true" : "false";
    if (id === "contract") this.grantSpareKey();
    if (id === "jealousy") this.qualifyFinalScene();
    this.setStatus(`${id} 场景定格`);
    this.persist();
    this.publishProgress(false);
  }

  private persist() {
    if (this.foundSelfActive || this.lovebrainActive || this.disposed) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 2,
        scene: this.currentId(),
        stable: this.stableState
      } satisfies SavedStageState));
    } catch {}
  }

  private localProgress() {
    if (this.actionState === "running") return 0.42;
    if (this.actionState === "settled") return 1;
    return 0.12;
  }

  private publishProgress(transitioning: boolean) {
    const progress = clamp((this.activeIndex + this.localProgress()) / CHAPTER_IDS.length);
    const stage = this.currentId();
    this.host.dataset.kisaraScrollActive = "true";
    this.host.dataset.kisaraScrollProgress = progress.toFixed(5);
    this.host.dataset.kisaraScrollStage = stage;
    this.host.dataset.kisaraScrollGuided = "false";
    this.host.dataset.kisaraScrollTransitioning = String(transitioning);
    window.dispatchEvent(new CustomEvent("kisara:gate-progress", {
      detail: {
        active: true,
        progress,
        stage,
        guided: false,
        transitioning,
        releaseMode: "chapter",
        playbackRate: 1,
        pressure: 0
      }
    }));
  }

  private async stepForward() {
    if (this.activeIndex >= CHAPTER_IDS.length - 1) {
      this.root.dataset.edge = "end";
      this.nudgeEdge("end");
      return false;
    }
    return await this.switchChapter(this.activeIndex + 1, { runAction: true });
  }

  private async stepBackward() {
    if (this.activeIndex <= 0) {
      this.nudgeEdge("start");
      return false;
    }
    return await this.switchChapter(this.activeIndex - 1, { restoreStable: true, runAction: false });
  }

  private nudgeEdge(edge: "start" | "end") {
    this.root.dataset.edge = edge;
    window.setTimeout(() => {
      if (this.root.dataset.edge === edge) delete this.root.dataset.edge;
    }, 420);
  }

  private isIgnoredTarget(target: EventTarget | null) {
    return target instanceof Element && Boolean(target.closest(
      "a, button, input, textarea, select, [contenteditable='true'], [data-kisara-context-menu], [data-kisara-theme-panel], .kisara-audio-player"
    ));
  }

  private handleWheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey || this.isIgnoredTarget(event.target) || this.lovebrainActive) return;
    event.preventDefault();
    if (this.foundSelfActive || this.suspended) return;
    const delta = normalizeWheel(event);
    if (!delta) return;
    const now = performance.now();
    if (now - this.lastWheelAt > GESTURE_GAP) this.wheelAccumulator = 0;
    this.lastWheelAt = now;
    if (this.wheelAccumulator && Math.sign(this.wheelAccumulator) !== Math.sign(delta)) this.wheelAccumulator = 0;
    this.wheelAccumulator += delta;
    if (Math.abs(this.wheelAccumulator) < WHEEL_THRESHOLD || now < this.inputLockUntil) return;
    const direction = this.wheelAccumulator > 0 ? 1 : -1;
    this.wheelAccumulator = 0;
    this.inputLockUntil = now + INPUT_LOCK_MS;
    void (direction > 0 ? this.stepForward() : this.stepBackward());
  };

  private handleKeydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || this.isIgnoredTarget(event.target) || this.lovebrainActive) return;
    if (this.foundSelfActive) return;
    if (performance.now() < this.inputLockUntil) return;
    if (event.key === "Home") {
      event.preventDefault();
      void this.switchChapter(0, { runAction: true });
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      void this.switchChapter(5, { runAction: true });
      return;
    }
    const direction = ["ArrowDown", "PageDown", " "].includes(event.key)
      ? 1
      : ["ArrowUp", "PageUp"].includes(event.key)
        ? -1
        : 0;
    if (!direction) return;
    event.preventDefault();
    void (direction > 0 ? this.stepForward() : this.stepBackward());
  };

  private handleTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1 || this.isIgnoredTarget(event.target) || this.lovebrainActive) return;
    this.touchStartY = event.touches[0]?.clientY ?? null;
    this.touchLastY = this.touchStartY;
  };

  private handleTouchMove = (event: TouchEvent) => {
    if (event.touches.length !== 1 || this.touchLastY === null || this.foundSelfActive || this.lovebrainActive) return;
    this.touchLastY = event.touches[0]?.clientY ?? this.touchLastY;
  };

  private handleTouchEnd = (event: TouchEvent) => {
    if (this.touchStartY === null || this.touchLastY === null || this.lovebrainActive) return;
    const delta = this.touchStartY - this.touchLastY;
    this.touchStartY = null;
    this.touchLastY = null;
    if (Math.abs(delta) < 44) return;
    event.preventDefault();
    if (performance.now() < this.inputLockUntil) return;
    this.inputLockUntil = performance.now() + INPUT_LOCK_MS;
    void (delta > 0 ? this.stepForward() : this.stepBackward());
  };

  private async startFoundSelf() {
    if (this.foundSelfActive || !(this.foundSelfOverlay instanceof HTMLElement)) return false;
    this.foundSelfActive = true;
    this.foundSelfFinishing = false;
    this.beginOperation();
    this.pauseAllVideos();
    this.host.classList.add("is-found-self-active");
    this.root.setAttribute("aria-hidden", "true");
    this.foundSelfOverlay.setAttribute("aria-hidden", "false");
    this.foundSelfOverlay.dataset.state = "playing";
    this.foundSelfOverlay.classList.add("is-running");
    if (this.foundSelfStatus) this.foundSelfStatus.textContent = "MEMORY PLAYBACK";
    window.dispatchEvent(new CustomEvent("yuimi:kisara-audio-suspension", {
      detail: { id: "found-self", active: true }
    }));
    window.dispatchEvent(new CustomEvent("yuimi:kisara-found-self-state", {
      detail: { active: true, state: "playing" }
    }));
    this.runtimeWindow.__yuimiKisaraEasterLedger?.mark?.("found-self");

    const video = this.foundSelfVideo;
    if (!(video instanceof HTMLVideoElement)) {
      this.finishFoundSelf();
      return false;
    }
    if (!video.src) {
      const source = video.dataset.src;
      if (source) {
        video.preload = "auto";
        video.src = source;
        delete video.dataset.src;
        video.load();
      }
    }
    const reveal = () => this.foundSelfOverlay?.classList.add("is-media-ready");
    video.addEventListener("playing", reveal, { once: true, signal: this.lifecycle.signal });
    video.addEventListener("ended", () => this.finishFoundSelf(), { once: true, signal: this.lifecycle.signal });
    video.addEventListener("error", () => this.finishFoundSelf(), { once: true, signal: this.lifecycle.signal });
    video.play()?.catch(() => {
      const retry = () => {
        if (!this.foundSelfActive || this.foundSelfFinishing) return;
        video.play()?.catch(() => undefined);
      };
      window.addEventListener("pointerdown", retry, { once: true, signal: this.lifecycle.signal });
      window.addEventListener("keydown", retry, { once: true, signal: this.lifecycle.signal });
    });
    return true;
  }

  private finishFoundSelf() {
    if (!this.foundSelfActive || this.foundSelfFinishing) return;
    this.foundSelfFinishing = true;
    this.foundSelfVideo?.pause();
    this.foundSelfOverlay?.classList.add("is-leaving");
    if (this.foundSelfOverlay) this.foundSelfOverlay.dataset.state = "leaving";
    if (this.foundSelfTimer) window.clearTimeout(this.foundSelfTimer);
    this.foundSelfTimer = window.setTimeout(() => {
      this.foundSelfTimer = 0;
      this.foundSelfActive = false;
      this.foundSelfFinishing = false;
      this.host.classList.remove("is-found-self-active");
      this.root.removeAttribute("aria-hidden");
      this.foundSelfOverlay?.setAttribute("aria-hidden", "true");
      this.foundSelfOverlay?.classList.remove("is-running", "is-media-ready", "is-leaving");
      if (this.foundSelfOverlay) this.foundSelfOverlay.dataset.state = "inactive";
      delete document.documentElement.dataset.kisaraFoundSelfEntry;
      window.dispatchEvent(new CustomEvent("yuimi:kisara-audio-suspension", {
        detail: { id: "found-self", active: false }
      }));
      window.dispatchEvent(new CustomEvent("yuimi:kisara-found-self-state", {
        detail: { active: false, state: "inactive" }
      }));
      window.dispatchEvent(new CustomEvent("yuimi:kisara-legacy-found-self-finished"));
      void this.switchChapter(0, { runAction: true });
    }, this.reducedMotion ? 1 : 720);
  }

  private installLovebrainApi() {
    this.runtimeWindow.__yuimiKisaraHomeLovebrain = {
      activate: this.activateLovebrain,
      leaveToOpening: this.leaveLovebrain
    };
  }

  private activateLovebrain = () => {
    if (this.disposed || this.foundSelfActive || this.lovebrainActive || this.host.dataset.kisaraStageSettled !== "true") return false;
    this.lovebrainActive = true;
    this.beginOperation();
    this.pauseAllVideos();
    this.host.classList.add("is-lovebrain-active");
    this.root.setAttribute("aria-hidden", "true");
    return true;
  };

  private leaveLovebrain = () => {
    if (!this.lovebrainActive || this.disposed) return false;
    this.host.classList.add("is-lovebrain-leaving");
    window.setTimeout(() => {
      if (this.disposed) return;
      this.lovebrainActive = false;
      this.host.classList.remove("is-lovebrain-active", "is-lovebrain-leaving");
      this.root.removeAttribute("aria-hidden");
      window.dispatchEvent(new CustomEvent("yuimi:kisara-lovebrain-opening-covered"));
      void this.switchChapter(0, { instant: true, restoreStable: true, runAction: false });
    }, this.reducedMotion ? 1 : 720);
    return true;
  };

  private suspend = () => {
    if (this.suspended) return;
    this.suspended = true;
    this.resumeVideos.clear();
    this.host.querySelectorAll("video").forEach((video) => {
      if (!video.paused && !video.ended) this.resumeVideos.add(video);
      video.pause();
    });
  };

  private resume = () => {
    if (!this.suspended || document.visibilityState === "hidden") return;
    this.suspended = false;
    const waiters = Array.from(this.visibilityWaiters);
    this.visibilityWaiters.clear();
    waiters.forEach((wake) => wake());
    this.resumeVideos.forEach((video) => {
      if (video.isConnected && !video.ended) video.play()?.catch(() => undefined);
    });
    this.resumeVideos.clear();
  };

  private bindEvents() {
    const { signal } = this.lifecycle;
    window.addEventListener("wheel", this.handleWheel, { passive: false, signal });
    window.addEventListener("keydown", this.handleKeydown, { signal });
    this.root.addEventListener("touchstart", this.handleTouchStart, { passive: true, signal });
    this.root.addEventListener("touchmove", this.handleTouchMove, { passive: false, signal });
    this.root.addEventListener("touchend", this.handleTouchEnd, { passive: false, signal });
    this.markers.forEach((marker) => marker.addEventListener("click", () => {
      const id = marker.dataset.homeChapterTarget as ChapterId | undefined;
      const index = id ? this.chapterIndex.get(id) : undefined;
      if (typeof index === "number") void this.switchChapter(index, { runAction: true });
    }, { signal }));
    this.replayButton?.addEventListener("click", () => {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {}
      this.spareKeyGranted = false;
      this.finalQualified = false;
      this.host.dataset.kisaraStageSettled = "false";
      void this.switchChapter(0, { runAction: true });
    }, { signal });
    this.foundSelfSkip?.addEventListener("click", () => this.finishFoundSelf(), { signal });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") this.suspend();
      else this.resume();
    }, { signal });
    window.addEventListener("pagehide", this.suspend, { signal });
    window.addEventListener("pageshow", this.resume, { signal });
    window.addEventListener("yuimi:kisara-lovebrain-progress", () => this.publishProgress(false), { signal });
  }

  private async restore() {
    if (this.reducedMotion) {
      await this.switchChapter(5, { instant: true, restoreStable: true, runAction: false });
      return;
    }
    const saved = readSavedState();
    if (!saved) {
      await this.switchChapter(0, { instant: true, runAction: true });
      return;
    }
    const index = this.chapterIndex.get(saved.scene) ?? 0;
    await this.switchChapter(index, { instant: true, restoreStable: true, runAction: false });
  }
}

export const initKisaraStageHomeLifecycle = () => {
  const runtimeWindow = window as KisaraWindow;
  const schedule = () => {
    window.clearTimeout(runtimeWindow.__yuimiKisaraStageHomeInitTimer ?? 0);
    runtimeWindow.__yuimiKisaraStageHomeInitTimer = window.setTimeout(() => {
      runtimeWindow.__yuimiKisaraStageHomeInitTimer = 0;
      const root = document.querySelector<HTMLElement>("[data-kisara-stage-home]");
      if (!root) return;
      runtimeWindow.__yuimiKisaraStageHomeController?.dispose();
      const controller = new HomeChapterController(root);
      runtimeWindow.__yuimiKisaraStageHomeController = controller;
      controller.start();
    }, 0);
  };
  runtimeWindow.__yuimiKisaraStageHomeSchedule = schedule;
  if (!runtimeWindow.__yuimiKisaraStageHomeLifecycleBound) {
    document.addEventListener("astro:before-swap", () => {
      window.clearTimeout(runtimeWindow.__yuimiKisaraStageHomeInitTimer ?? 0);
      runtimeWindow.__yuimiKisaraStageHomeInitTimer = 0;
      runtimeWindow.__yuimiKisaraStageHomeController?.dispose();
      runtimeWindow.__yuimiKisaraStageHomeController = null;
    });
    document.addEventListener("astro:page-load", schedule);
    window.addEventListener("pageshow", (event) => {
      const root = document.querySelector<HTMLElement>("[data-kisara-stage-home]");
      if (event.persisted && root?.dataset.bound === "true" && runtimeWindow.__yuimiKisaraStageHomeController) return;
      schedule();
    });
    runtimeWindow.__yuimiKisaraStageHomeLifecycleBound = true;
  }
  schedule();
};
