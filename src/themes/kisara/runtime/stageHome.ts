type ChapterId = "rescue" | "request" | "counterattack" | "contract" | "transformation" | "jealousy";
type FrameState = "first" | "video" | "hold";

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

interface SavedChapterState {
  version: 1;
  chapter: ChapterId;
  beat: string;
  scrub: number;
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
const STORAGE_KEY = "yuimi-kisara-home-chapters-v1";
const WHEEL_THRESHOLD = 42;
const GESTURE_GAP = 180;

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

const readSavedState = (): SavedChapterState | null => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null");
    if (parsed?.version !== 1 || !CHAPTER_IDS.includes(parsed.chapter)) return null;
    return {
      version: 1,
      chapter: parsed.chapter,
      beat: typeof parsed.beat === "string" ? parsed.beat : "hold",
      scrub: clamp(Number(parsed.scrub) || 0)
    };
  } catch {
    return null;
  }
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
  private readonly requestLoop: HTMLVideoElement | null;
  private readonly scrubVideo: HTMLVideoElement | null;
  private readonly foundSelfOverlay: HTMLElement | null;
  private readonly foundSelfVideo: HTMLVideoElement | null;
  private readonly foundSelfSkip: HTMLButtonElement | null;
  private readonly foundSelfStatus: HTMLElement | null;
  private readonly lifecycle = new AbortController();
  private readonly reducedMotion: boolean;

  private disposed = false;
  private activeIndex = 0;
  private beat = "entry";
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
  private scrubTarget = 0;
  private scrubVisual = 0;
  private scrubFrame = 0;
  private scrubTimestamp = 0;
  private scrubBusy = false;
  private scrubPendingTime: number | null = null;
  private montageStarting = false;
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
    this.chapters = CHAPTER_IDS.map((id) => root.querySelector<HTMLElement>(`[data-home-chapter="${id}"]`)).filter(Boolean) as HTMLElement[];
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
    this.requestLoop = root.querySelector<HTMLVideoElement>('[data-stage-loop="request-shu"]');
    this.scrubVideo = root.querySelector<HTMLVideoElement>('[data-stage-scrub="counter-run"]');
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
    this.stopScrubFrame();
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
    this.stopScrubFrame();
    this.montageStarting = false;
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
      const timer = window.setTimeout(resolve, 4200);
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
    if (chapter.dataset.homeChapter === "request") void this.hydrateVideo(this.requestLoop, false);
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

  private async playLayer(
    name: string,
    options: {
      onTime?: (time: number, duration: number) => void;
      onReveal?: () => void;
    } = {}
  ) {
    const layer = this.layers.get(name);
    if (!layer?.video) return false;
    const epoch = this.epoch;
    const ready = await this.hydrateLayer(name, true);
    if (!ready || !this.isCurrent(epoch) || !(await this.waitUntilVisible(epoch))) return false;

    this.stopPlayback();
    const token = ++this.playbackToken;
    const video = layer.video;
    video.pause();
    try { video.currentTime = 0; } catch {}
    this.setLayerFrame(name, "first");

    return await new Promise<boolean>((resolve) => {
      let finished = false;
      let revealed = false;
      let frameCallback = 0;
      let timeFrame = 0;
      const current = () => !this.disposed
        && this.epoch === epoch
        && this.playbackToken === token
        && !finished;
      const tick = () => {
        timeFrame = 0;
        if (!current()) return;
        options.onTime?.(video.currentTime, Number.isFinite(video.duration) ? video.duration : 0);
        if (!video.paused && !video.ended) timeFrame = window.requestAnimationFrame(tick);
      };
      const reveal = () => {
        if (!current()) return;
        revealed = true;
        this.setLayerFrame(name, "video");
        options.onReveal?.();
      };
      const cleanup = () => {
        video.removeEventListener("playing", onPlaying);
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("error", onError);
        if (frameCallback && typeof video.cancelVideoFrameCallback === "function") {
          video.cancelVideoFrameCallback(frameCallback);
        }
        if (timeFrame) window.cancelAnimationFrame(timeFrame);
        frameCallback = 0;
        timeFrame = 0;
      };
      const finish = (success: boolean) => {
        if (finished) return;
        finished = true;
        cleanup();
        if (success && this.epoch === epoch) {
          this.setLayerFrame(name, "hold");
          if (!revealed) options.onReveal?.();
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
          frameCallback = video.requestVideoFrameCallback(reveal);
        } else {
          window.requestAnimationFrame(() => window.requestAnimationFrame(reveal));
        }
        if (!timeFrame) timeFrame = window.requestAnimationFrame(tick);
      };
      const onEnded = () => finish(true);
      const onError = () => finish(true);
      video.addEventListener("playing", onPlaying);
      video.addEventListener("ended", onEnded);
      video.addEventListener("error", onError);
      this.playbackCleanup = cancel;
      const playback = video.play();
      playback?.catch(onError);
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
    if (from === "request" && to === "counterattack") return "request-counter";
    if (from === "counterattack" && to === "contract") return "counter-contract";
    if (from === "contract" && to === "transformation") return "contract-transform";
    if (from === "transformation" && to === "jealousy") return "transform-jealousy";
    return this.chapterIndex.get(to)! < this.chapterIndex.get(from)! ? "backward" : "chapter-cut";
  }

  private async switchChapter(
    index: number,
    options: { instant?: boolean; restoreBeat?: string; scrub?: number } = {}
  ) {
    const bounded = Math.max(0, Math.min(CHAPTER_IDS.length - 1, index));
    const from = this.currentId();
    const to = CHAPTER_IDS[bounded];
    const epoch = this.beginOperation();
    const serial = this.transitionSerial;
    this.stopRequestLoop();
    await this.hydrateChapter(bounded, true);
    if (!this.isCurrent(epoch) || serial !== this.transitionSerial || !(await this.waitUntilVisible(epoch))) return false;

    this.activeIndex = bounded;
    this.beat = options.restoreBeat ?? "entry";
    this.root.dataset.stageState = options.instant ? "settled" : "switching";
    this.root.dataset.chapterTransition = this.transitionName(from, to);
    this.root.classList.toggle("is-switching", !options.instant && !this.reducedMotion);
    this.host.dataset.kisaraStageSettled = "false";
    this.setChapterPositions(bounded);
    this.publishProgress(true);
    await nextFrame();
    await nextFrame();
    if (!this.isCurrent(epoch) || serial !== this.transitionSerial) return false;

    if (!options.instant && !this.reducedMotion) {
      if (!(await this.wait(720, epoch)) || serial !== this.transitionSerial) return false;
    }
    this.root.classList.remove("is-switching");
    this.root.dataset.stageState = "settled";
    delete this.root.dataset.chapterTransition;

    if (options.restoreBeat) {
      await this.restoreStableBeat(to, options.restoreBeat, options.scrub ?? 0);
    } else {
      void this.runChapterEntry(to, epoch);
    }
    this.prewarmAdjacent(bounded);
    return true;
  }

  private prewarmAdjacent(index: number) {
    window.setTimeout(() => {
      if (this.disposed) return;
      void this.hydrateChapter(index + 1, false);
      void this.hydrateChapter(index - 1, false);
    }, 160);
  }

  private setBeat(value: string) {
    this.beat = value;
    const chapter = this.chapters[this.activeIndex];
    if (!chapter) return;
    const id = this.currentId();
    if (id === "rescue") chapter.dataset.rescueBeat = value;
    if (id === "request") chapter.dataset.requestBeat = value;
    if (id === "counterattack") chapter.dataset.counterBeat = value;
    if (id === "jealousy") chapter.dataset.jealousyBeat = value;
    this.root.dataset.stageState = value.includes("playing") || value.includes("transition") ? "playing" : value.includes("scrub") ? "scrub" : "settled";
    this.publishProgress(false);
  }

  private async runChapterEntry(id: ChapterId, epoch: number) {
    if (!this.isCurrent(epoch)) return;
    if (this.reducedMotion) {
      const stable = id === "rescue" ? "eye-hold"
        : id === "counterattack" ? "roll-hold"
          : id === "jealousy" ? "blackface-hold"
            : "hold";
      await this.restoreStableBeat(id, stable, id === "counterattack" ? 1 : 0);
      return;
    }

    if (id === "rescue") {
      this.setBeat("eye-playing");
      const ended = await this.playLayer("rescue-eye");
      if (ended && this.isCurrent(epoch)) this.settle("eye-hold", "眼神定格");
      return;
    }
    if (id === "request") {
      this.setBeat("request-playing");
      const ended = await this.playLayer("request-background");
      if (ended && this.isCurrent(epoch)) {
        this.settle("request-hold", "请求定格");
        void this.startRequestLoop();
      }
      return;
    }
    if (id === "counterattack") {
      this.setBeat("entry-playing");
      const ended = await this.playLayer("counter-entry");
      if (ended && this.isCurrent(epoch)) await this.prepareCounterScrub(0);
      return;
    }
    if (id === "contract") {
      this.setBeat("contract-playing");
      const ended = await this.playLayer("contract-kiss", {
        onTime: (time) => {
          if (time >= 1.7) this.grantSpareKey();
        }
      });
      if (ended && this.isCurrent(epoch)) {
        this.grantSpareKey();
        this.settle("kiss-hold", "契约定格");
      }
      return;
    }
    if (id === "transformation") {
      this.setBeat("transform-playing");
      const ended = await this.playLayer("transformation");
      if (ended && this.isCurrent(epoch)) this.settle("transform-hold", "变身定格");
      return;
    }
    this.setBeat("slash-playing");
    const ended = await this.playLayer("jealousy-slash");
    if (ended && this.isCurrent(epoch)) this.settle("slash-hold", "刀锋待发");
  }

  private settle(beat: string, status: string) {
    this.setBeat(beat);
    this.setStatus(status);
    this.persist();
  }

  private async startRescueSlash() {
    if (this.currentId() !== "rescue") return false;
    const epoch = this.beginOperation();
    await this.hydrateLayer("rescue-slash", true);
    if (!this.isCurrent(epoch)) return false;
    this.setBeat("slash-transition");
    let revealIncoming = () => undefined;
    const incomingReady = new Promise<void>((resolve) => { revealIncoming = resolve; });
    const playback = this.playLayer("rescue-slash", { onReveal: revealIncoming });
    await incomingReady;
    if (!this.isCurrent(epoch)) return false;
    this.setBeat("slash-playing");
    const ended = await playback;
    if (ended && this.isCurrent(epoch)) this.settle("back-hold", "背影定格");
    return ended;
  }

  private async startJealousyReveal() {
    if (this.currentId() !== "jealousy") return false;
    const epoch = this.beginOperation();
    await this.hydrateLayer("jealousy-blackface", true);
    if (!this.isCurrent(epoch)) return false;
    this.setBeat("diagonal-reveal");
    let revealIncoming = () => undefined;
    const incomingReady = new Promise<void>((resolve) => { revealIncoming = resolve; });
    const playback = this.playLayer("jealousy-blackface", { onReveal: revealIncoming });
    await incomingReady;
    if (!this.isCurrent(epoch)) return false;
    this.setBeat("blackface-playing");
    const ended = await playback;
    if (ended && this.isCurrent(epoch)) this.setFinalHold();
    return ended;
  }

  private setFinalHold() {
    this.setLayerFrame("jealousy-blackface", "hold");
    this.settle("blackface-hold", "演出结束");
    this.host.dataset.kisaraStageSettled = "true";
    if (!this.finalQualified) {
      this.finalQualified = true;
      this.runtimeWindow.__yuimiKisaraLovebrainProgress?.markStage?.("home-jealousy");
    }
    this.publishProgress(false);
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

  private async startRequestLoop() {
    const video = this.requestLoop;
    const shell = video?.closest<HTMLElement>("[data-stage-loop-shell]");
    if (!(video instanceof HTMLVideoElement) || this.currentId() !== "request") return false;
    await this.hydrateVideo(video, true);
    if (this.currentId() !== "request" || this.suspended) return false;
    shell?.setAttribute("aria-hidden", "false");
    shell?.classList.add("is-active");
    return await Promise.resolve(video.play()).then(() => true).catch(() => false);
  }

  private stopRequestLoop() {
    this.requestLoop?.pause();
    this.requestLoop?.closest<HTMLElement>("[data-stage-loop-shell]")?.classList.remove("is-active");
  }

  private async prepareCounterScrub(ratio: number) {
    const video = this.scrubVideo;
    if (!(video instanceof HTMLVideoElement) || this.currentId() !== "counterattack") return false;
    await this.hydrateLayer("counter-run", true);
    if (this.currentId() !== "counterattack") return false;
    video.pause();
    this.scrubTarget = clamp(ratio);
    this.scrubVisual = this.scrubTarget;
    this.root.style.setProperty("--counter-scrub", this.scrubVisual.toFixed(5));
    this.setLayerFrame("counter-run", this.scrubVisual >= 0.999 ? "hold" : "video");
    this.setBeat(this.scrubVisual > 0 ? "run-scrub" : "run-ready");
    this.queueScrubSeek(this.scrubVisual);
    this.persist();
    return true;
  }

  private queueScrubSeek(ratio: number) {
    const video = this.scrubVideo;
    if (!(video instanceof HTMLVideoElement)) return;
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    if (!duration) {
      video.addEventListener("loadedmetadata", () => this.queueScrubSeek(ratio), { once: true, signal: this.lifecycle.signal });
      return;
    }
    this.scrubPendingTime = clamp(ratio) * Math.max(0, duration - 1 / 60);
    this.flushScrubSeek();
  }

  private flushScrubSeek() {
    const video = this.scrubVideo;
    if (!(video instanceof HTMLVideoElement) || this.scrubBusy || this.scrubPendingTime === null || video.seeking) return;
    const target = this.scrubPendingTime;
    this.scrubPendingTime = null;
    if (Math.abs(video.currentTime - target) < 1 / 90) return;
    this.scrubBusy = true;
    try {
      video.currentTime = target;
    } catch {
      this.scrubBusy = false;
    }
  }

  private pushCounterScrub(delta: number) {
    if (this.currentId() !== "counterattack" || !["run-ready", "run-scrub"].includes(this.beat)) return false;
    this.scrubTarget = clamp(this.scrubTarget + delta / 1350);
    if (this.scrubTarget > 0.001) this.setBeat("run-scrub");
    if (!this.scrubFrame) {
      this.scrubTimestamp = 0;
      this.scrubFrame = window.requestAnimationFrame(this.advanceScrub);
    }
    return true;
  }

  private advanceScrub = (timestamp: number) => {
    this.scrubFrame = 0;
    if (this.disposed || this.suspended || this.currentId() !== "counterattack") return;
    const elapsed = this.scrubTimestamp ? clamp(timestamp - this.scrubTimestamp, 8, 40) : 16.667;
    this.scrubTimestamp = timestamp;
    const distance = this.scrubTarget - this.scrubVisual;
    const response = 1 - Math.exp(-elapsed / 78);
    const maxStep = elapsed * 0.00018;
    this.scrubVisual += clamp(distance * response, -maxStep, maxStep);
    if (Math.abs(distance) < 0.0007) this.scrubVisual = this.scrubTarget;
    this.scrubVisual = clamp(this.scrubVisual);
    this.root.style.setProperty("--counter-scrub", this.scrubVisual.toFixed(5));
    this.queueScrubSeek(this.scrubVisual);
    this.publishProgress(false);

    if (this.scrubTarget >= 0.999 && this.scrubVisual >= 0.995 && !this.montageStarting) {
      this.montageStarting = true;
      void this.startCounterMontage();
      return;
    }
    if (Math.abs(this.scrubTarget - this.scrubVisual) > 0.0007) {
      this.scrubFrame = window.requestAnimationFrame(this.advanceScrub);
    } else {
      this.persist();
    }
  };

  private stopScrubFrame() {
    if (this.scrubFrame) window.cancelAnimationFrame(this.scrubFrame);
    this.scrubFrame = 0;
    this.scrubTimestamp = 0;
  }

  private async startCounterMontage() {
    if (this.currentId() !== "counterattack") return false;
    const epoch = this.beginOperation();
    this.scrubTarget = 1;
    this.scrubVisual = 1;
    this.setLayerFrame("counter-run", "hold");
    this.setBeat("montage-playing");
    const ended = await this.playLayer("counter-roll");
    if (ended && this.isCurrent(epoch)) this.settle("roll-hold", "落地定格");
    return ended;
  }

  private async restoreStableBeat(id: ChapterId, beat: string, scrub: number) {
    if (id === "rescue") {
      this.setLayerFrame("rescue-eye", "hold");
      this.setLayerFrame("rescue-slash", beat === "back-hold" ? "hold" : "first");
      this.settle(beat === "back-hold" ? "back-hold" : "eye-hold", "阻断定格");
      return;
    }
    if (id === "request") {
      this.setLayerFrame("request-background", "hold");
      this.settle("request-hold", "请求定格");
      void this.startRequestLoop();
      return;
    }
    if (id === "counterattack") {
      if (beat === "roll-hold") {
        this.scrubTarget = 1;
        this.scrubVisual = 1;
        this.root.style.setProperty("--counter-scrub", "1");
        this.setLayerFrame("counter-entry", "hold");
        this.setLayerFrame("counter-run", "hold");
        this.setLayerFrame("counter-roll", "hold");
        this.settle("roll-hold", "落地定格");
      } else {
        this.setLayerFrame("counter-entry", "hold");
        await this.prepareCounterScrub(scrub);
      }
      return;
    }
    if (id === "contract") {
      this.setLayerFrame("contract-kiss", "hold");
      this.settle("kiss-hold", "契约定格");
      return;
    }
    if (id === "transformation") {
      this.setLayerFrame("transformation", "hold");
      this.settle("transform-hold", "变身定格");
      return;
    }
    this.setLayerFrame("jealousy-slash", "hold");
    this.setLayerFrame("jealousy-blackface", beat === "blackface-hold" ? "hold" : "first");
    if (beat === "blackface-hold") this.setFinalHold();
    else this.settle("slash-hold", "刀锋待发");
  }

  private persist() {
    if (this.foundSelfActive || this.lovebrainActive || this.disposed) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: 1,
        chapter: this.currentId(),
        beat: this.beat,
        scrub: this.scrubVisual
      } satisfies SavedChapterState));
    } catch {}
  }

  private localProgress() {
    if (this.currentId() === "rescue") return this.beat === "back-hold" ? 1 : this.beat.includes("slash") ? 0.65 : 0.2;
    if (this.currentId() === "counterattack") return this.beat === "roll-hold" ? 1 : 0.18 + this.scrubVisual * 0.7;
    if (this.currentId() === "jealousy") return this.beat === "blackface-hold" ? 1 : this.beat.includes("blackface") || this.beat === "diagonal-reveal" ? 0.7 : 0.25;
    return this.beat.includes("playing") ? 0.42 : 1;
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
        pressure: this.currentId() === "counterattack" ? this.scrubVisual : 0
      }
    }));
  }

  private async stepForward() {
    const id = this.currentId();
    if (id === "rescue") {
      if (this.beat === "eye-playing") {
        this.stopPlayback();
        this.setLayerFrame("rescue-eye", "hold");
        this.settle("eye-hold", "眼神定格");
        return true;
      }
      if (this.beat === "eye-hold") return await this.startRescueSlash();
      if (this.beat.includes("slash") && this.beat !== "back-hold") {
        this.stopPlayback();
        this.setLayerFrame("rescue-slash", "hold");
        this.settle("back-hold", "背影定格");
        return true;
      }
      return await this.switchChapter(1);
    }
    if (id === "request") {
      if (this.beat === "request-playing") return await this.switchChapter(2);
      return await this.switchChapter(2);
    }
    if (id === "counterattack") {
      if (this.beat === "entry-playing") {
        this.stopPlayback();
        return await this.prepareCounterScrub(0);
      }
      if (["run-ready", "run-scrub"].includes(this.beat)) return this.pushCounterScrub(118);
      if (this.beat === "montage-playing") {
        this.stopPlayback();
        this.setLayerFrame("counter-roll", "hold");
        this.settle("roll-hold", "落地定格");
        return true;
      }
      return await this.switchChapter(3);
    }
    if (id === "contract") {
      if (this.beat === "contract-playing") return await this.switchChapter(4);
      return await this.switchChapter(4);
    }
    if (id === "transformation") {
      if (this.beat === "transform-playing") return await this.switchChapter(5);
      return await this.switchChapter(5);
    }
    if (this.beat === "slash-playing") {
      this.stopPlayback();
      this.setLayerFrame("jealousy-slash", "hold");
      this.settle("slash-hold", "刀锋待发");
      return true;
    }
    if (this.beat === "slash-hold") return await this.startJealousyReveal();
    if (this.beat.includes("blackface") && this.beat !== "blackface-hold") {
      this.stopPlayback();
      this.setFinalHold();
      return true;
    }
    this.nudgeEdge("end");
    return false;
  }

  private async stepBackward() {
    const id = this.currentId();
    if (id === "rescue") {
      if (this.beat !== "eye-hold") {
        const epoch = this.beginOperation();
        await this.restoreStableBeat("rescue", "eye-hold", 0);
        return this.isCurrent(epoch);
      }
      this.nudgeEdge("start");
      return false;
    }
    if (id === "request") return await this.switchChapter(0, { restoreBeat: "back-hold" });
    if (id === "counterattack") {
      if (this.beat === "roll-hold" || this.beat === "montage-playing") {
        this.beginOperation();
        return await this.prepareCounterScrub(1);
      }
      if (["run-ready", "run-scrub"].includes(this.beat) && this.scrubTarget > 0.001) {
        return this.pushCounterScrub(-118);
      }
      return await this.switchChapter(1, { restoreBeat: "request-hold" });
    }
    if (id === "contract") return await this.switchChapter(2, { restoreBeat: "roll-hold", scrub: 1 });
    if (id === "transformation") return await this.switchChapter(3, { restoreBeat: "kiss-hold" });
    if (this.beat === "blackface-hold" || this.beat.includes("blackface") || this.beat === "diagonal-reveal") {
      const epoch = this.beginOperation();
      await this.restoreStableBeat("jealousy", "slash-hold", 0);
      return this.isCurrent(epoch);
    }
    return await this.switchChapter(4, { restoreBeat: "transform-hold" });
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
    if (this.currentId() === "counterattack" && ["run-ready", "run-scrub"].includes(this.beat)) {
      this.pushCounterScrub(delta);
      return;
    }

    const now = performance.now();
    if (now - this.lastWheelAt > GESTURE_GAP) this.wheelAccumulator = 0;
    this.lastWheelAt = now;
    if (this.wheelAccumulator && Math.sign(this.wheelAccumulator) !== Math.sign(delta)) this.wheelAccumulator = 0;
    this.wheelAccumulator += delta;
    if (Math.abs(this.wheelAccumulator) < WHEEL_THRESHOLD || now < this.inputLockUntil) return;
    const direction = this.wheelAccumulator > 0 ? 1 : -1;
    this.wheelAccumulator = 0;
    this.inputLockUntil = now + 520;
    void (direction > 0 ? this.stepForward() : this.stepBackward());
  };

  private handleKeydown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || this.isIgnoredTarget(event.target) || this.lovebrainActive) return;
    if (this.foundSelfActive) return;
    if (event.key === "Home") {
      event.preventDefault();
      void this.switchChapter(0);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      void this.switchChapter(5);
      return;
    }
    const direction = ["ArrowDown", "PageDown", " "].includes(event.key)
      ? 1
      : ["ArrowUp", "PageUp"].includes(event.key)
        ? -1
        : 0;
    if (!direction) return;
    event.preventDefault();
    if (this.currentId() === "counterattack" && ["run-ready", "run-scrub"].includes(this.beat)) {
      this.pushCounterScrub(direction * 126);
      return;
    }
    void (direction > 0 ? this.stepForward() : this.stepBackward());
  };

  private handleTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1 || this.isIgnoredTarget(event.target) || this.lovebrainActive) return;
    this.touchStartY = event.touches[0]?.clientY ?? null;
    this.touchLastY = this.touchStartY;
  };

  private handleTouchMove = (event: TouchEvent) => {
    if (event.touches.length !== 1 || this.touchLastY === null || this.foundSelfActive || this.lovebrainActive) return;
    const y = event.touches[0]?.clientY ?? this.touchLastY;
    const delta = this.touchLastY - y;
    this.touchLastY = y;
    if (this.currentId() === "counterattack" && ["run-ready", "run-scrub"].includes(this.beat)) {
      event.preventDefault();
      this.pushCounterScrub(delta * 2.4);
    }
  };

  private handleTouchEnd = (event: TouchEvent) => {
    if (this.touchStartY === null || this.touchLastY === null || this.lovebrainActive) return;
    const delta = this.touchStartY - this.touchLastY;
    this.touchStartY = null;
    this.touchLastY = null;
    if (this.currentId() === "counterattack" && ["run-ready", "run-scrub"].includes(this.beat)) return;
    if (Math.abs(delta) < 44) return;
    event.preventDefault();
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
    this.foundSelfStatus && (this.foundSelfStatus.textContent = "MEMORY PLAYBACK");
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
    const playback = video.play();
    playback?.catch(() => {
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
    this.foundSelfOverlay && (this.foundSelfOverlay.dataset.state = "leaving");
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
      void this.switchChapter(0);
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
    void this.switchChapter(0, { instant: true, restoreBeat: "eye-hold" });
    window.setTimeout(() => {
      if (this.disposed) return;
      this.lovebrainActive = false;
      this.host.classList.remove("is-lovebrain-active", "is-lovebrain-leaving");
      this.root.removeAttribute("aria-hidden");
      window.dispatchEvent(new CustomEvent("yuimi:kisara-lovebrain-opening-covered"));
      void this.switchChapter(0);
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
    this.stopScrubFrame();
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
    if (this.currentId() === "counterattack" && ["run-ready", "run-scrub"].includes(this.beat)) {
      this.queueScrubSeek(this.scrubVisual);
    }
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
      if (typeof index === "number") void this.switchChapter(index);
    }, { signal }));
    this.replayButton?.addEventListener("click", () => {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
      this.spareKeyGranted = false;
      this.finalQualified = false;
      this.host.dataset.kisaraStageSettled = "false";
      void this.switchChapter(0);
    }, { signal });
    this.foundSelfSkip?.addEventListener("click", () => this.finishFoundSelf(), { signal });
    this.scrubVideo?.addEventListener("seeked", () => {
      this.scrubBusy = false;
      this.flushScrubSeek();
    }, { signal });
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
      await this.switchChapter(5, { instant: true, restoreBeat: "blackface-hold" });
      return;
    }
    const saved = readSavedState();
    if (!saved) {
      await this.switchChapter(0, { instant: true });
      return;
    }
    const index = this.chapterIndex.get(saved.chapter) ?? 0;
    await this.switchChapter(index, {
      instant: true,
      restoreBeat: saved.beat,
      scrub: saved.scrub
    });
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
