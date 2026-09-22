import { bindVideoStill } from "./videoStill.ts";
import { bindWorksStage } from "./worksStage.ts";

export function bindWorksPage() {
  window.__yuimiKisaraInnerCleanup?.();
  const lifecycle = new AbortController();
  const signal = lifecycle.signal;
  const hero = document.querySelector("[data-kisara-works-hero]");
  const heroVideo = hero?.querySelector("[data-works-hero-video]");
  if (heroVideo) bindVideoStill(heroVideo, hero.querySelector(".kisara-works-intro-last-frame"), signal);
  const sliceField = hero?.querySelector("[data-works-slice-field]");
  const sliceTrails = hero?.querySelector("[data-works-slice-trails]");
  const sliceScore = hero?.querySelector("[data-works-slice-score]");
  const sliceFruits = Array.from(hero?.querySelectorAll("[data-works-slice-fruit]") || []);
  const sliceTimers = new Set();
  const fruitPhysics = new Map();
  let pointerFrame = 0;
  let heroPointerFrame = 0;
  let heroScrollFrame = 0;
  let fruitPhysicsFrame = 0;
  let fruitPhysicsLastTime = 0;
  let fruitPhysicsReady = false;
  let fruitPhysicsVisible = true;
  let heroStageActive = true;
  let worksStage = null;
  let fruitPhysicsObserver = null;
  let heroIntroTimer = 0;
  let heroIntroFrame = 0;
  let heroIntroGeneration = 0;
  let heroVideoWaitTimer = 0;
  let cancelHeroVideoWait = null;
  let heroIntroDeadline = 0;
  let heroIntroRemaining = 1580;
  let resumeHeroVideo = false;
  let heroVideoStarted = false;
  let heroVideoPlayGeneration = 0;
  let heroVideoRetryTimer = 0;
  let heroVideoRetries = 0;
  let heroResizeObserver = null;
  let heroBounds = { left: 0, top: 0, width: 1, height: 1 };
  let sliceFieldBounds = { left: 0, top: 0, width: 360, height: 360 };
  const pendingSliceEvents = [];
  const trailPool = [];
  let trailCursor = 0;
  let dragFrame = 0;
  let blendTimer = 0;
  let chopTimer = 0;
  let statusTimer = 0;
  let dragGhost = null;
  let dragState = null;
  let heroPointerTargetX = 0;
  let heroPointerTargetY = 0;
  let heroPointerRenderedX = 0;
  let heroPointerRenderedY = 0;
  let heroVideoLoadGeneration = 0;
  let lastSlicePoint = null;
  let lastSliceEventTime = 0;
  let sliceCount = 0;
  const settlingGhosts = new Set();

  const cleanup = () => {
    lifecycle.abort();
    heroIntroGeneration += 1;
    heroResizeObserver?.disconnect();
    window.cancelAnimationFrame(heroIntroFrame);
    window.clearTimeout(heroVideoWaitTimer);
    window.clearTimeout(heroVideoRetryTimer);
    pendingSliceEvents.length = 0;
    trailPool.forEach(trail => { trail.sliceAnimation?.cancel(); trail.remove(); });
    if (heroVideo instanceof HTMLVideoElement) heroVideo.pause();
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    if (heroPointerFrame) cancelAnimationFrame(heroPointerFrame);
    if (heroScrollFrame) cancelAnimationFrame(heroScrollFrame);
    if (fruitPhysicsFrame) cancelAnimationFrame(fruitPhysicsFrame);
    fruitPhysicsObserver?.disconnect();
    if (heroIntroTimer) window.clearTimeout(heroIntroTimer);
    sliceTimers.forEach((timer) => window.clearTimeout(timer));
    sliceTimers.clear();
    if (dragFrame) cancelAnimationFrame(dragFrame);
    if (blendTimer) window.clearTimeout(blendTimer);
    if (chopTimer) window.clearTimeout(chopTimer);
    if (statusTimer) window.clearTimeout(statusTimer);
    dragGhost?.remove();
    settlingGhosts.forEach((ghost) => ghost.remove());
    settlingGhosts.clear();
    if (window.__yuimiKisaraInnerCleanup === cleanup) window.__yuimiKisaraInnerCleanup = null;
  };

  window.__yuimiKisaraInnerCleanup = cleanup;
  document.addEventListener("astro:before-swap", cleanup, { once: true, signal });

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const displayScale = Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
  const performanceTier = document.documentElement.dataset.yuimiPerformance;
  const heroReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    || performanceTier === "mobile"
    || performanceTier === "lite";
  const heroFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const fruitPhysicsEnabled = heroFinePointer && !heroReducedMotion && sliceField instanceof HTMLElement;
  const fruitGravity = 1650;
  const fruitDiameter = 76;
  const pigWidth = 104;
  const pigHeight = 89;

  const cacheHeroGeometry = () => {
    if (!(hero instanceof HTMLElement) || !(sliceField instanceof HTMLElement)) return;
    const rect = hero.getBoundingClientRect();
    const field = sliceField.getBoundingClientRect();
    heroBounds = { left: rect.left, top: rect.top + window.scrollY, width: rect.width, height: rect.height };
    sliceFieldBounds = { left: field.left, top: field.top + window.scrollY, width: sliceField.clientWidth, height: sliceField.clientHeight };
  };
  cacheHeroGeometry();
  if (hero instanceof HTMLElement && typeof ResizeObserver === "function") {
    heroResizeObserver = new ResizeObserver(cacheHeroGeometry);
    heroResizeObserver.observe(hero);
  }
  window.addEventListener("resize", cacheHeroGeometry, { passive: true, signal });

  const resetFruitPieces = (state) => {
    state.whole?.style.removeProperty("transform");
    state.left?.style.removeProperty("transform");
    state.right?.style.removeProperty("transform");
  };

  const queueFruit = (state, wait = 0.4) => {
    state.phase = "waiting";
    state.wait = wait;
    state.splitLeft = null;
    state.splitRight = null;
    state.bounceCount = 0;
    state.fadeElapsed = 0;
    state.hitCooldown = 0;
    state.fruit.classList.remove("is-sliced");
    state.fruit.classList.remove("is-hit", "is-fading");
    state.fruit.style.opacity = "0";
    resetFruitPieces(state);
  };

  const launchFruit = (state) => {
    if (!(sliceField instanceof HTMLElement)) return;
    const width = Math.max(360, sliceFieldBounds.width);
    const height = Math.max(360, sliceFieldBounds.height);
    const edge = Math.max(state.width / 2 + 8, Math.min(92, Math.max(54, width * 0.08)));
    state.x = edge + Math.random() * Math.max(1, width - edge * 2);
    state.y = height + 54 + Math.random() * 34;
    state.previousX = state.x;
    state.previousY = state.y;
    const rise = height * (state.isPig ? 0.56 + Math.random() * 0.2 : 0.62 + Math.random() * 0.26);
    state.vy = -Math.sqrt(2 * fruitGravity * rise);
    state.vx = (Math.random() - 0.5) * (state.isPig ? 190 : 250);
    if (state.x < width * 0.28) state.vx = Math.abs(state.vx) + 36;
    if (state.x > width * 0.72) state.vx = -Math.abs(state.vx) - 36;
    state.angle = -22 + Math.random() * 44;
    state.angularVelocity = (Math.random() < 0.5 ? -1 : 1) * (
      state.isPig ? 70 + Math.random() * 90 : 135 + Math.random() * 185
    );
    state.bounceCount = 0;
    state.maxBounces = state.isPig ? 3 + Math.floor(Math.random() * 3) : 0;
    state.fadeElapsed = 0;
    state.hitCooldown = 0;
    state.phase = "whole";
    state.fruit.classList.remove("is-hit", "is-fading");
    renderFruit(state);
    state.fruit.style.opacity = "1";
  };

  const renderFruit = (state) => {
    if (state.phase !== "sliced") {
      state.fruit.style.transform = `translate3d(${(state.x - state.width / 2).toFixed(2)}px, ${(state.y - state.height / 2).toFixed(2)}px, 0) rotate(${state.angle.toFixed(2)}deg)`;
      return;
    }
    [state.splitLeft, state.splitRight].forEach(piece => {
      const x = piece.x - (state.x - state.width / 2) - piece.originX;
      const y = piece.y - (state.y - state.height / 2) - piece.originY;
      piece.element.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${piece.angle.toFixed(2)}deg)`;
    });
  };

  const beginPigFade = (state) => {
    if (!state.isPig || state.phase === "fading" || state.phase === "waiting") return;
    state.phase = "fading";
    state.fadeElapsed = 0;
    state.fruit.classList.add("is-fading");
  };

  const requestFruitPhysicsFrame = () => {
    if (!fruitPhysicsEnabled || !fruitPhysicsReady || !fruitPhysicsVisible || !heroStageActive || document.hidden || fruitPhysicsFrame || signal.aborted) return;
    fruitPhysicsFrame = window.requestAnimationFrame(runFruitPhysics);
  };

  function runFruitPhysics(timestamp) {
    fruitPhysicsFrame = 0;
    if (!fruitPhysicsReady || !fruitPhysicsVisible || !heroStageActive || document.hidden || signal.aborted || !(sliceField instanceof HTMLElement)) return;
    const dt = fruitPhysicsLastTime ? Math.min(0.05, Math.max(0, (timestamp - fruitPhysicsLastTime) / 1000)) : 0;
    fruitPhysicsLastTime = timestamp;
    const width = Math.max(360, sliceFieldBounds.width);
    const height = Math.max(360, sliceFieldBounds.height);

    fruitPhysics.forEach((state) => {
      if (state.phase === "waiting") {
        state.wait -= dt;
        if (state.wait <= 0) launchFruit(state);
        return;
      }

      if (state.phase === "sliced") {
        [state.splitLeft, state.splitRight].forEach(piece => {
          piece.x += piece.vx * dt;
          piece.y += piece.vy * dt + .5 * fruitGravity * dt * dt;
          piece.vy += fruitGravity * dt;
          piece.angle += piece.angularVelocity * dt;
        });
        renderFruit(state);
        if ([state.splitLeft, state.splitRight].every(piece => piece.y - state.height > height + 100)) {
          queueFruit(state, .26 + Math.random() * .78);
        }
        return;
      }

      state.previousX = state.x;
      state.previousY = state.y;
      state.vy += fruitGravity * dt;
      state.x += state.vx * dt;
      state.y += state.vy * dt;
      state.angle += state.angularVelocity * dt;
      state.hitCooldown = Math.max(0, state.hitCooldown - dt);

      if (state.isPig) {
        let bounced = false;
        const halfWidth = state.width / 2;
        const halfHeight = state.height / 2;
        if (state.x - halfWidth < 0 && state.vx < 0) {
          state.x = halfWidth;
          state.vx = Math.abs(state.vx) * 0.72;
          bounced = true;
        } else if (state.x + halfWidth > width && state.vx > 0) {
          state.x = width - halfWidth;
          state.vx = -Math.abs(state.vx) * 0.72;
          bounced = true;
        }
        if (state.y - halfHeight < 0 && state.vy < 0) {
          state.y = halfHeight;
          state.vy = Math.abs(state.vy) * 0.66;
          bounced = true;
        }
        if (bounced) {
          state.angularVelocity = clamp(-state.angularVelocity * 0.78, -720, 720);
          state.bounceCount += 1;
          if (state.bounceCount >= state.maxBounces) beginPigFade(state);
        }
        if (state.phase === "fading") {
          state.fadeElapsed += dt;
          state.fruit.style.opacity = Math.max(0, 1 - state.fadeElapsed / 0.9).toFixed(3);
          if (state.fadeElapsed >= 0.9) {
            queueFruit(state, 5.8 + Math.random() * 7.4);
            return;
          }
        }
      }

      renderFruit(state);
      const splitDepth = state.height / 2;
      if (state.vy > 0 && state.y + splitDepth > height + 130) {
        queueFruit(state, state.isPig ? 5.8 + Math.random() * 7.4 : 0.26 + Math.random() * 0.78);
      }
    });

    requestFruitPhysicsFrame();
  }

  const startFruitPhysics = () => {
    if (!fruitPhysicsEnabled) return;
    if (!fruitPhysicsReady) {
      sliceFruits.forEach((fruit, index) => {
        if (!(fruit instanceof HTMLElement)) return;
        const isPig = fruit.dataset.fruitKind === "pig";
        const state = {
          fruit,
          whole: fruit.querySelector(".is-whole"),
          left: fruit.querySelector(".is-left"),
          right: fruit.querySelector(".is-right"),
          isPig,
          width: isPig ? pigWidth : fruitDiameter,
          height: isPig ? pigHeight : fruitDiameter,
          hitRadiusX: isPig ? pigWidth * 0.46 : fruitDiameter * 0.46,
          hitRadiusY: isPig ? pigHeight * 0.43 : fruitDiameter * 0.46,
          phase: "waiting",
          wait: 0,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          angle: 0,
          angularVelocity: 0,
          bounceCount: 0,
          maxBounces: 0,
          fadeElapsed: 0,
          hitCooldown: 0,
          splitLeft: null,
          splitRight: null
        };
        fruitPhysics.set(fruit, state);
        queueFruit(
          state,
          isPig ? 4.8 + Math.random() * 5.2 : 0.18 + index * 0.3 + Math.random() * 0.18
        );
      });
      fruitPhysicsReady = true;
    }
    fruitPhysicsLastTime = 0;
    requestFruitPhysicsFrame();
  };

  const syncWorksActivity = () => {
    if (signal.aborted || !(hero instanceof HTMLElement)) return;
    const active = fruitPhysicsVisible && heroStageActive && !document.hidden;
    hero.toggleAttribute("data-works-active", active);
    fruitPhysicsLastTime = 0;
    if (!active) {
      window.cancelAnimationFrame(fruitPhysicsFrame);
      window.cancelAnimationFrame(heroPointerFrame);
      fruitPhysicsFrame = heroPointerFrame = 0;
      pendingSliceEvents.length = 0;
      lastSlicePoint = null;
      if (heroIntroTimer) heroIntroRemaining = Math.max(0, heroIntroDeadline - performance.now());
      window.clearTimeout(heroIntroTimer);
      heroIntroTimer = 0;
      if (heroVideo instanceof HTMLVideoElement && !heroVideo.paused && !heroVideo.ended) {
        resumeHeroVideo = true;
        heroVideoPlayGeneration += 1;
        heroVideo.pause();
      }
    } else {
      requestFruitPhysicsFrame();
      if (hero.dataset.introState === "playing" && !heroIntroTimer) {
        heroIntroDeadline = performance.now() + heroIntroRemaining;
        heroIntroTimer = window.setTimeout(finishHeroIntro, heroIntroRemaining);
      }
      if (resumeHeroVideo && heroVideo instanceof HTMLVideoElement
        && !heroVideo.ended && hero.dataset.videoState !== "complete") {
        resumeHeroVideo = false;
        const playGeneration = ++heroVideoPlayGeneration;
        heroVideo.muted = true;
        void heroVideo.play().catch(() => {
          if (!signal.aborted && playGeneration === heroVideoPlayGeneration
            && !heroVideo.ended && hero.dataset.videoState !== "complete") {
            heroVideoStarted = false;
            hero.dataset.videoState = "fallback";
          }
        });
      }
    }
  };

  if (hero instanceof HTMLElement && "IntersectionObserver" in window) {
    fruitPhysicsObserver = new IntersectionObserver(([entry]) => {
      fruitPhysicsVisible = Boolean(entry?.isIntersecting);
      syncWorksActivity();
      recoverHeroVideo();
    }, { threshold: 0.02 });
    fruitPhysicsObserver.observe(hero);
  }

  const finishHeroIntro = () => {
    if (!(hero instanceof HTMLElement)) return;
    if (heroIntroTimer) window.clearTimeout(heroIntroTimer);
    heroIntroTimer = 0;
    hero.dataset.introState = "complete";
  };

  const startPreparedHeroVideo = () => {
    if (signal.aborted || heroReducedMotion || document.hidden || !fruitPhysicsVisible
      || !(hero instanceof HTMLElement) || !(heroVideo instanceof HTMLVideoElement)
      || hero.dataset.introState === "idle" || hero.dataset.videoState === "complete"
      || heroVideoStarted || heroVideo.error) return;
    // Preload is advisory; play() must be allowed to request the first frame.
    heroVideoStarted = true;
    hero.dataset.videoState = "playing";
    resumeHeroVideo = true;
    syncWorksActivity();
  };
  const retryHeroVideo = () => {
    if (signal.aborted || heroReducedMotion || document.hidden || !fruitPhysicsVisible
      || !(heroVideo instanceof HTMLVideoElement) || !heroVideo.error || heroVideoRetries >= 2
      || heroVideoRetryTimer || heroVideo.error.code === 3 || heroVideo.error.code === 4) return;
    heroVideoRetryTimer = window.setTimeout(() => {
      heroVideoRetryTimer = 0;
      if (signal.aborted || document.hidden || !fruitPhysicsVisible || !heroVideo.error) return;
      heroVideoStarted = false;
      heroVideo.preload = "auto";
      heroVideo.load();
    }, 1000 * ++heroVideoRetries);
  };
  heroVideo?.addEventListener("error", () => {
    if (signal.aborted || !(hero instanceof HTMLElement)) return;
    hero.dataset.videoState = "fallback";
    resumeHeroVideo = false;
    heroVideoStarted = false;
    heroVideoPlayGeneration += 1;
    heroVideo.pause();
    retryHeroVideo();
  }, { signal });
  heroVideo?.addEventListener("loadeddata", startPreparedHeroVideo, { signal });
  heroVideo?.addEventListener("canplay", startPreparedHeroVideo, { signal });
  heroVideo?.addEventListener("playing", () => {
    if (document.hidden || !fruitPhysicsVisible) {
      resumeHeroVideo = true;
      heroVideo.pause();
    }
  }, { signal });
  heroVideo?.addEventListener("ended", () => {
    if (!signal.aborted && hero instanceof HTMLElement) {
      hero.dataset.videoState = "complete";
      resumeHeroVideo = false;
      heroVideoPlayGeneration += 1;
    }
  }, { signal });
  const recoverHeroVideo = () => { retryHeroVideo(); startPreparedHeroVideo(); };
  document.addEventListener("visibilitychange", recoverHeroVideo, { signal });
  window.addEventListener("online", recoverHeroVideo, { signal });
  hero?.addEventListener("pointerdown", recoverHeroVideo, { passive: true, signal });

  const prepareHeroVideo = () => new Promise((resolve) => {
    if (!(heroVideo instanceof HTMLVideoElement)) {
      resolve(true);
      return;
    }
    cancelHeroVideoWait?.();
    const loadGeneration = ++heroVideoLoadGeneration;
    let settled = false;
    const settle = (ready) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(heroVideoWaitTimer);
      heroVideo.removeEventListener("loadeddata", loaded);
      heroVideo.removeEventListener("error", failed);
      signal.removeEventListener("abort", failed);
      cancelHeroVideoWait = null;
      ready = ready && !signal.aborted && loadGeneration === heroVideoLoadGeneration;
      if (ready && !heroVideoStarted) {
        try {
          heroVideo.currentTime = 0;
        } catch {
          // The fresh load begins at its first frame regardless.
        }
      }
      resolve(ready);
    };
    const loaded = () => settle(true);
    const failed = () => settle(false);
    cancelHeroVideoWait = () => settle(false);
    heroVideoPlayGeneration += 1;
    resumeHeroVideo = false;
    heroVideo.pause();
    if (heroVideo.error) retryHeroVideo();
    if (heroVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      settle(true);
      return;
    }
    heroVideoWaitTimer = window.setTimeout(() => settle(false), 3500);
    signal.addEventListener("abort", failed, { once: true });
    heroVideo.addEventListener("loadeddata", loaded, { once: true });
    heroVideo.addEventListener("error", failed, { once: true });
    try {
      heroVideo.preload = "auto";
      // Astro adopts media from a parsed document. Initialize its unready pipeline
      // once per entry; networkState alone does not prove that it can make progress.
      heroVideo.load();
    } catch {
      settle(heroVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA);
    }
  });

  const playHeroIntro = async () => {
    if (!(hero instanceof HTMLElement)) return;
    const generation = ++heroIntroGeneration;
    window.cancelAnimationFrame(heroIntroFrame);
    if (heroIntroTimer) window.clearTimeout(heroIntroTimer);
    heroIntroTimer = 0;
    hero.dataset.introState = heroReducedMotion ? "complete" : "idle";
    hero.dataset.videoState = heroReducedMotion ? "complete" : "idle";
    if (heroReducedMotion) return;
    heroVideoStarted = false;
    const preparation = prepareHeroVideo();
    void hero.offsetWidth;
    heroIntroFrame = window.requestAnimationFrame(() => {
      heroIntroFrame = 0;
      if (signal.aborted || generation !== heroIntroGeneration) return;
      hero.dataset.introState = "playing";
      startFruitPhysics();
      heroIntroRemaining = 1580;
      syncWorksActivity();
      startPreparedHeroVideo();
    });
    void preparation.then(() => {
      if (!signal.aborted && generation === heroIntroGeneration) startPreparedHeroVideo();
    });
  };

  const syncHeroScroll = () => {
    heroScrollFrame = 0;
    if (!(hero instanceof HTMLElement)) return;
    const rect = hero.getBoundingClientRect();
    if (!worksStage) {
      const progress = clamp(-rect.top / Math.max(1, rect.height * 0.62), 0, 1);
      hero.style.setProperty("--works-scroll-progress", progress.toFixed(4));
    }
    cacheHeroGeometry();
  };

  const scheduleHeroScroll = () => {
    if (!heroScrollFrame) heroScrollFrame = window.requestAnimationFrame(syncHeroScroll);
  };

  const pointToSegmentDistance = (point, start, end) => {
    const segmentX = end.x - start.x;
    const segmentY = end.y - start.y;
    const lengthSquared = segmentX * segmentX + segmentY * segmentY;
    if (!lengthSquared) return Math.hypot(point.x - start.x, point.y - start.y);
    const projection = clamp(
      ((point.x - start.x) * segmentX + (point.y - start.y) * segmentY) / lengthSquared,
      0,
      1
    );
    return Math.hypot(
      point.x - (start.x + segmentX * projection),
      point.y - (start.y + segmentY * projection)
    );
  };

  const segmentEllipseCollision = (start, end, state) => {
    const deltaX = (end.x - start.x) / state.hitRadiusX;
    const deltaY = (end.y - start.y) / state.hitRadiusY;
    const startX = (start.x - state.x) / state.hitRadiusX;
    const startY = (start.y - state.y) / state.hitRadiusY;
    const c = startX * startX + startY * startY - 1;
    if (c <= 0) return { t: 0, x: start.x, y: start.y };
    const a = deltaX * deltaX + deltaY * deltaY;
    if (a < 0.000001) return null;
    const b = 2 * (startX * deltaX + startY * deltaY);
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return null;
    const root = Math.sqrt(discriminant);
    const candidates = [(-b - root) / (2 * a), (-b + root) / (2 * a)]
      .filter((value) => value >= 0 && value <= 1)
      .sort((left, right) => left - right);
    if (!candidates.length) return null;
    const t = candidates[0];
    return {
      t,
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t
    };
  };

  const appendSliceTrail = (start, end) => {
    if (!(sliceTrails instanceof HTMLElement)) return;
    const length = Math.max(18, Math.hypot(end.x - start.x, end.y - start.y));
    const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
    let trail = trailPool[trailCursor];
    if (!trail) {
      trail = document.createElement("i");
      trail.className = "is-pooled";
      trailPool[trailCursor] = trail;
      sliceTrails.append(trail);
    }
    trailCursor = (trailCursor + 1) % 24;
    trail.sliceAnimation?.cancel();
    trail.style.setProperty("--slice-left", `${start.x.toFixed(2)}px`);
    trail.style.setProperty("--slice-top", `${start.y.toFixed(2)}px`);
    trail.style.setProperty("--slice-length", `${length.toFixed(2)}px`);
    trail.style.setProperty("--slice-angle", `${angle.toFixed(2)}deg`);
    trail.sliceAnimation = trail.animate([{ opacity: .95 }, { opacity: 0 }], { duration: 180, fill: "forwards" });
  };

  const appendPigImpact = (point, angle) => {
    if (!(sliceTrails instanceof HTMLElement)) return;
    const impact = document.createElement("b");
    impact.className = "kisara-works-pig-impact";
    impact.style.setProperty("--pig-impact-left", `${point.x.toFixed(2)}px`);
    impact.style.setProperty("--pig-impact-top", `${point.y.toFixed(2)}px`);
    impact.style.setProperty("--pig-impact-angle", `${angle.toFixed(2)}deg`);
    sliceTrails.append(impact);
    const timer = window.setTimeout(() => {
      sliceTimers.delete(timer);
      impact.remove();
    }, 520);
    sliceTimers.add(timer);
  };

  const hitPig = (state, start, end, collision) => {
    const moveX = end.x - start.x;
    const moveY = end.y - start.y;
    const distance = Math.hypot(moveX, moveY);
    if (distance < 1) return;
    const directionX = moveX / distance;
    const directionY = moveY / distance;
    const elapsed = clamp((end.time - start.time) / 1000, 0.008, 0.08);
    const pointerSpeed = clamp(distance / elapsed, 180, 2800);
    const angle = Math.atan2(moveY, moveX) * 180 / Math.PI;
    if (Math.hypot(collision.x - start.x, collision.y - start.y) > 4) {
      appendSliceTrail(start, collision);
    }
    if (state.hitCooldown > 0) return;
    const impulse = clamp(250 + pointerSpeed * 0.34, 330, 1180);
    state.vx = clamp(state.vx * 0.42 + directionX * impulse, -1350, 1350);
    state.vy = clamp(state.vy * 0.42 + directionY * impulse, -1450, 1150);
    const leverX = collision.x - state.x;
    const leverY = collision.y - state.y;
    const torque = (directionX * leverY - directionY * leverX) * pointerSpeed * 0.11;
    state.angularVelocity = clamp(state.angularVelocity * 0.35 - torque, -720, 720);
    state.hitCooldown = 0.13;
    state.fruit.classList.remove("is-hit");
    void state.fruit.offsetWidth;
    state.fruit.classList.add("is-hit");
    appendPigImpact(collision, angle);
  };

  const getFruitCut = (state, start, end) => {
    const radians = -state.angle * Math.PI / 180;
    const cos = Math.cos(radians), sin = Math.sin(radians);
    const local = point => ({
      x: (point.x - state.x) * cos - (point.y - state.y) * sin + state.width / 2,
      y: (point.x - state.x) * sin + (point.y - state.y) * cos + state.height / 2
    });
    const a = local(start), b = local(end);
    const dx = b.x - a.x, dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length < .001) return null;
    const nx = -dy / length, ny = dx / length;
    const offset = (state.width / 2 - a.x) * nx + (state.height / 2 - a.y) * ny;
    // Keep both visible pieces substantial, including inset and pointed artwork.
    const safeOffset = Math.min(state.width, state.height) * .16;
    const correction = offset - Math.max(-safeOffset, Math.min(safeOffset, offset));
    a.x += nx * correction;
    a.y += ny * correction;
    const signed = point => (point.x - a.x) * nx + (point.y - a.y) * ny;
    const rectangle = [{ x: 0, y: 0 }, { x: state.width, y: 0 }, { x: state.width, y: state.height }, { x: 0, y: state.height }];
    const clip = side => {
      const points = [];
      rectangle.forEach((point, index) => {
        const next = rectangle[(index + 1) % rectangle.length];
        const d = signed(point) * side, nextD = signed(next) * side;
        if (d >= 0) points.push(point);
        if ((d >= 0) !== (nextD >= 0)) {
          const t = d / (d - nextD);
          points.push({ x: point.x + (next.x - point.x) * t, y: point.y + (next.y - point.y) * t });
        }
      });
      return points;
    };
    const left = clip(1), right = clip(-1);
    if (left.length < 3 || right.length < 3) return null;
    const polygon = points => `polygon(${points.map(point => `${(point.x / state.width * 100).toFixed(3)}% ${(point.y / state.height * 100).toFixed(3)}%`).join(",")})`;
    const centroid = points => {
      let area = 0, x = 0, y = 0;
      points.forEach((point, index) => {
        const next = points[(index + 1) % points.length];
        const cross = point.x * next.y - next.x * point.y;
        area += cross;
        x += (point.x + next.x) * cross;
        y += (point.y + next.y) * cross;
      });
      return { x: x / (3 * area), y: y / (3 * area), area: Math.abs(area / 2) };
    };
    return { left: polygon(left), right: polygon(right), leftCenter: centroid(left), rightCenter: centroid(right) };
  };

  const sliceFruit = (fruit, start, end) => {
    const state = fruitPhysics.get(fruit);
    if (!(fruit instanceof HTMLElement) || !state || state.isPig || state.phase !== "whole") return;
    const cut = getFruitCut(state, start, end);
    if (!cut) return;
    const cutX = end.x - start.x;
    const cutY = end.y - start.y;
    const cutLength = Math.max(1, Math.hypot(cutX, cutY));
    const normalX = -cutY / cutLength;
    const normalY = cutX / cutLength;
    const separation = clamp(150 + cutLength * .25, 160, 240);
    state.left.style.clipPath = cut.left;
    state.right.style.clipPath = cut.right;
    const radians = state.angle * Math.PI / 180;
    const cos = Math.cos(radians), sin = Math.sin(radians);
    const makePiece = (center, element, side, otherArea) => {
      const localX = center.x - state.width / 2, localY = center.y - state.height / 2;
      element.style.transformOrigin = `${center.x}px ${center.y}px`;
      const impulse = separation * otherArea / (state.width * state.height);
      return {
        element, originX: center.x, originY: center.y,
        x: state.x + localX * cos - localY * sin,
        y: state.y + localX * sin + localY * cos,
        vx: state.vx + normalX * impulse * side,
        vy: state.vy + normalY * impulse * side - 30,
        angle: state.angle,
        angularVelocity: state.angularVelocity * .25 + side * 110
      };
    };
    state.splitLeft = makePiece(cut.leftCenter, state.left, 1, cut.rightCenter.area);
    state.splitRight = makePiece(cut.rightCenter, state.right, -1, cut.leftCenter.area);
    state.fruit.style.transform = `translate3d(${state.x - state.width / 2}px, ${state.y - state.height / 2}px, 0)`;
    state.phase = "sliced";
    renderFruit(state);
    fruit.classList.add("is-sliced");
    sliceCount += 1;
    if (sliceScore) sliceScore.textContent = String(sliceCount).padStart(2, "0");
  };

  const sliceHeroFruits = (event) => {
    if (!fruitPhysicsEnabled || !fruitPhysicsVisible || !heroStageActive || document.hidden || !(sliceField instanceof HTMLElement)) return;
    const fieldRect = sliceFieldBounds;
    const point = {
      x: (event.clientX - fieldRect.left) / displayScale,
      y: (event.clientY + window.scrollY - fieldRect.top) / displayScale,
      time: event.timeStamp || performance.now()
    };
    if (point.x < 0 || point.y < 0 || point.x > fieldRect.width || point.y > fieldRect.height) {
      lastSlicePoint = null;
      return;
    }
    const start = lastSlicePoint && point.time - lastSliceEventTime < 120 ? lastSlicePoint : point;
    lastSliceEventTime = point.time;
    if (Math.hypot(point.x - start.x, point.y - start.y) < 3) {
      if (start === point) lastSlicePoint = point;
      return;
    }
    let blockedEnd = point;
    let pigCollision = null;
    fruitPhysics.forEach((state) => {
      if (!state.isPig || state.phase !== "whole") return;
      const collision = segmentEllipseCollision(start, point, state);
      if (!collision || (pigCollision && collision.t >= pigCollision.collision.t)) return;
      pigCollision = { state, collision };
    });
    if (pigCollision) {
      blockedEnd = { ...pigCollision.collision, time: point.time };
      hitPig(pigCollision.state, start, point, pigCollision.collision);
    }
    if (!pigCollision) appendSliceTrail(start, blockedEnd);
    fruitPhysics.forEach((state, fruit) => {
      if (state.isPig || state.phase !== "whole") return;
      const center = { x: state.x, y: state.y };
      // Require entry into the body, not a transparent margin or a former position.
      if (pointToSegmentDistance(center, start, blockedEnd) <= state.hitRadiusX * .72) {
        sliceFruit(fruit, start, blockedEnd);
      }
    });
    lastSlicePoint = point;
  };

  if (hero instanceof HTMLElement) {
    window.addEventListener("scroll", scheduleHeroScroll, { passive: true, signal });
    window.addEventListener("resize", scheduleHeroScroll, { passive: true, signal });
    scheduleHeroScroll();

    if (heroFinePointer && !heroReducedMotion) {
      const renderHeroPointer = () => {
        heroPointerFrame = 0;
        if (signal.aborted || document.hidden || !fruitPhysicsVisible || !heroStageActive) return;
        pendingSliceEvents.splice(0).forEach(sliceHeroFruits);
        heroPointerRenderedX += (heroPointerTargetX - heroPointerRenderedX) * 0.15;
        heroPointerRenderedY += (heroPointerTargetY - heroPointerRenderedY) * 0.15;
        hero.style.setProperty("--works-pointer-x", `${heroPointerRenderedX.toFixed(2)}px`);
        hero.style.setProperty("--works-pointer-y", `${heroPointerRenderedY.toFixed(2)}px`);
        if (Math.abs(heroPointerTargetX - heroPointerRenderedX) > 0.04 || Math.abs(heroPointerTargetY - heroPointerRenderedY) > 0.04) {
          heroPointerFrame = window.requestAnimationFrame(renderHeroPointer);
        }
      };
      const scheduleHeroPointer = () => {
        if (!heroPointerFrame && !document.hidden && fruitPhysicsVisible && heroStageActive) heroPointerFrame = window.requestAnimationFrame(renderHeroPointer);
      };
      hero.addEventListener("pointermove", (event) => {
        if (event.pointerType === "touch") return;
        if (event.target instanceof Element && event.target.closest("button, a, input, select, textarea")) {
          lastSlicePoint = null;
          pendingSliceEvents.length = 0;
          return;
        }
        const rect = heroBounds;
        heroPointerTargetX = clamp(((event.clientX - rect.left) / rect.width - 0.5) * 9, -4.5, 4.5);
        heroPointerTargetY = clamp(((event.clientY + window.scrollY - rect.top) / rect.height - 0.5) * 6, -3, 3);
        const samples = event.getCoalescedEvents?.() || [];
        for (const sample of samples.length ? samples : [event]) {
          if (pendingSliceEvents.length >= 24) pendingSliceEvents.shift();
          pendingSliceEvents.push({ clientX: sample.clientX, clientY: sample.clientY, timeStamp: sample.timeStamp });
        }
        scheduleHeroPointer();
      }, { signal });
      hero.addEventListener("pointerleave", () => {
        heroPointerTargetX = 0;
        heroPointerTargetY = 0;
        lastSlicePoint = null;
        pendingSliceEvents.length = 0;
        scheduleHeroPointer();
      }, { signal });
    }

    window.addEventListener("pageshow", (event) => {
      if (!event.persisted) return;
      const bounds = hero.getBoundingClientRect();
      fruitPhysicsVisible = bounds.bottom > 0 && bounds.top < window.innerHeight;
      syncWorksActivity();
      void playHeroIntro();
      scheduleHeroScroll();
    }, { signal });
    document.addEventListener("visibilitychange", syncWorksActivity, { signal });
    window.addEventListener("pagehide", () => {
      fruitPhysicsVisible = false;
      syncWorksActivity();
    }, { signal });
    syncWorksActivity();
    playHeroIntro();
  }

  const root = document.querySelector("[data-kisara-kitchen]");
  if (!(root instanceof HTMLElement)) return;
  const catalogNode = root.querySelector("[data-kitchen-catalog]");
  if (!(catalogNode instanceof HTMLScriptElement)) return;

  let catalog;
  try {
    catalog = JSON.parse(catalogNode.textContent || "{}");
  } catch {
    return;
  }

  const ingredientMap = new Map((catalog.ingredients || []).map((item) => [item.id, item]));
  const maxIngredients = Math.max(2, ingredientMap.size || 6);
  const pantryButtons = new Map(
    Array.from(root.querySelectorAll("[data-kitchen-ingredient]"))
      .filter((button) => button instanceof HTMLButtonElement)
      .map((button) => [button.dataset.kitchenIngredient, button])
  );
  const boardItemsRoot = root.querySelector("[data-board-items]");
  const cuttingBoard = root.querySelector("[data-cutting-board]");
  const boardEmpty = root.querySelector("[data-board-empty]");
  const boardCount = root.querySelector("[data-board-count]");
  const cutLevel = root.querySelector("[data-cut-level]");
  const pantryCount = root.querySelector("[data-pantry-count]");
  const blenderPieces = root.querySelector("[data-blender-pieces]");
  const blenderLiquid = root.querySelector("[data-blender-liquid]");
  const blenderCount = root.querySelector("[data-blender-count]");
  const blenderStation = root.querySelector("[data-blender-station]");
  const chopButton = root.querySelector("[data-chop-all]");
  const loadButton = root.querySelector("[data-load-blender]");
  const blendButton = root.querySelector("[data-blend]");
  const remixButton = root.querySelector("[data-remix]");
  const statusOutput = root.querySelector("[data-kitchen-status]");
  const result = root.querySelector("[data-drink-result]");
  const resultTitle = root.querySelector("[data-result-title]");
  const resultEnglish = root.querySelector("[data-result-english]");
  const resultDescription = root.querySelector("[data-result-description]");
  const resultIngredients = root.querySelector("[data-result-ingredients]");
  const resultEffect = root.querySelector("[data-result-effect]");
  const customPointer = root.querySelector("[data-kitchen-pointer]");

  if (!(boardItemsRoot instanceof HTMLElement) || !(blenderPieces instanceof HTMLElement)) return;

  const boardState = new Map();
  let blenderState = [];
  let isBlending = false;
  let mixNumber = 0;
  let suppressClickUntil = 0;
  let pendingPointer = null;
  const precisePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const announce = (message, sticky = false) => {
    if (statusOutput) statusOutput.textContent = message;
    root.dataset.statusPulse = "true";
    if (statusTimer) window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => {
      delete root.dataset.statusPulse;
      if (!sticky && statusOutput) statusOutput.textContent = "厨房继续运转中，今天也没有严格遵守配方。";
    }, sticky ? 2200 : 1800);
  };

  const setDropActive = (zone) => {
    root.querySelectorAll("[data-drop-zone]").forEach((element) => {
      if (element instanceof HTMLElement) element.dataset.dropActive = String(element === zone);
    });
  };

  const getMeta = (id) => ingredientMap.get(id);
  const ingredientCodes = (ids) => ids.map((id) => getMeta(id)?.code || id.toUpperCase()).join(" + ");

  const createIngredientArt = (meta, className) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 76 76");
    svg.setAttribute("class", className);
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#kisara-fruit-${meta.shape}`);
    svg.append(use);
    return svg;
  };

  const updateBoardItem = (button, id, cuts, index) => {
    const meta = getMeta(id);
    if (!meta) return;
    button.dataset.cut = String(cuts);
    button.dataset.shape = meta.shape || "cube";
    button.style.setProperty("--ingredient", meta.color);
    button.style.setProperty("--ingredient-soft", meta.soft);
    button.style.setProperty("--board-order", String(index));
    button.setAttribute("aria-label", `${meta.name}，切配等级 ${cuts}，点击继续切`);
    const strong = button.querySelector("strong");
    const small = button.querySelector("small");
    if (strong) strong.textContent = meta.code;
    if (small) small.textContent = cuts >= 2 ? "PREPPED" : cuts === 1 ? "HALF CUT" : "RAW";
  };

  const createBoardItem = (id, cuts, index) => {
    const meta = getMeta(id);
    if (!meta) return null;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "kisara-board-item";
    button.dataset.boardItem = id;

    const food = document.createElement("span");
    food.className = "kisara-board-food";
    for (let index = 0; index < 4; index += 1) {
      const piece = document.createElement("span");
      piece.className = "kisara-board-art-piece";
      piece.append(createIngredientArt(meta, "kisara-board-art"));
      food.append(piece);
    }
    const cutMarks = document.createElement("span");
    cutMarks.className = "kisara-board-cut-marks";
    cutMarks.setAttribute("aria-hidden", "true");
    for (let mark = 0; mark < 3; mark += 1) cutMarks.append(document.createElement("b"));
    food.append(cutMarks);

    const copy = document.createElement("span");
    copy.className = "kisara-board-item-copy";
    const strong = document.createElement("strong");
    const small = document.createElement("small");
    copy.append(strong, small);
    button.append(food, copy);
    updateBoardItem(button, id, cuts, index);
    return button;
  };

  const renderBoard = () => {
    const existing = new Map(
      Array.from(boardItemsRoot.querySelectorAll("[data-board-item]"))
        .filter((element) => element instanceof HTMLButtonElement)
        .map((element) => [element.dataset.boardItem, element])
    );
    const liveIds = new Set();
    Array.from(boardState.entries()).forEach(([id, item], index) => {
      let element = existing.get(id);
      if (!element) {
        element = createBoardItem(id, item.cuts, index);
        if (element) boardItemsRoot.append(element);
      } else {
        updateBoardItem(element, id, item.cuts, index);
      }
      liveIds.add(id);
    });
    existing.forEach((element, id) => {
      if (!liveIds.has(id)) element.remove();
    });
    const total = boardState.size;
    const prepared = Array.from(boardState.values()).filter((item) => item.cuts >= 2).length;
    if (boardEmpty instanceof HTMLElement) boardEmpty.hidden = total > 0;
    if (boardCount) boardCount.textContent = `${String(total).padStart(2, "0")} / ${String(maxIngredients).padStart(2, "0")}`;
    if (cutLevel) {
      cutLevel.textContent = total === 0 ? "RAW" : prepared === total ? "READY" : `${prepared}/${total} PREPPED`;
    }
    if (chopButton instanceof HTMLButtonElement) chopButton.disabled = total === 0 || prepared === total || isBlending;
    if (loadButton instanceof HTMLButtonElement) loadButton.disabled = prepared === 0 || isBlending;
  };

  const renderBlender = () => {
    blenderPieces.replaceChildren();
    blenderState.forEach((id, index) => {
      const meta = getMeta(id);
      if (!meta) return;
      const piece = document.createElement("span");
      piece.style.setProperty("--piece-color", meta.color);
      piece.style.setProperty("--piece-index", String(index));
      piece.className = "kisara-blender-ingredient-art";
      piece.append(createIngredientArt(meta, "kisara-blender-art"));
      blenderPieces.append(piece);
    });
    const first = getMeta(blenderState[0]);
    const second = getMeta(blenderState[1] || blenderState[0]);
    if (blenderLiquid instanceof HTMLElement) {
      blenderLiquid.style.setProperty("--blend-a", first?.color || "#d996b5");
      blenderLiquid.style.setProperty("--blend-b", second?.color || "#f1c56f");
    }
    if (blenderCount) blenderCount.textContent = `${String(blenderState.length).padStart(2, "0")} / ${String(maxIngredients).padStart(2, "0")}`;
    if (blendButton instanceof HTMLButtonElement) blendButton.disabled = blenderState.length < 2 || isBlending;
    if (blenderStation instanceof HTMLElement) blenderStation.dataset.loaded = String(blenderState.length > 0);
  };

  const syncPantry = () => {
    const used = new Set([...boardState.keys(), ...blenderState]);
    pantryButtons.forEach((button, id) => {
      const unavailable = used.has(id);
      button.dataset.used = String(unavailable);
      button.setAttribute("aria-disabled", String(unavailable));
    });
    if (pantryCount) pantryCount.textContent = String(Math.max(0, pantryButtons.size - used.size)).padStart(2, "0");
  };

  const renderAll = () => {
    renderBoard();
    renderBlender();
    syncPantry();
  };

  const addToBoard = (id) => {
    const meta = getMeta(id);
    if (!meta || boardState.has(id) || blenderState.includes(id)) {
      announce("这份食材已经在料理台上了，再放会变成依赖重复。", true);
      return false;
    }
    if (boardState.size >= maxIngredients) {
      announce("整套技术栈都在砧板上了，再堆就只能把依赖文件也切进去。", true);
      return false;
    }
    boardState.set(id, { cuts: 0 });
    renderAll();
    announce(`${meta.name} 已经上砧板。`);
    return true;
  };

  const chopItem = (id) => {
    const item = boardState.get(id);
    const meta = getMeta(id);
    if (!item || !meta || isBlending) return;
    if (item.cuts >= 2) {
      announce(`${meta.name} 已经切得足够细，再切就只剩技术债了。`, true);
      return;
    }
    item.cuts += 1;
    renderBoard();
    announce(item.cuts >= 2 ? `${meta.name} 处理完成，可以倒进榨汁机。` : `${meta.name} 被认真地切了一刀。`);
  };

  const chopAll = () => {
    let changed = 0;
    boardState.forEach((item) => {
      if (item.cuts < 2) {
        item.cuts += 1;
        changed += 1;
      }
    });
    if (!changed) return;
    root.dataset.chopping = "true";
    if (chopTimer) window.clearTimeout(chopTimer);
    chopTimer = window.setTimeout(() => {
      chopTimer = 0;
      delete root.dataset.chopping;
    }, 240);
    renderBoard();
    announce("咚。整张砧板都获得了一次非常公平的处理。", true);
  };

  const transferItem = (id) => {
    const item = boardState.get(id);
    const meta = getMeta(id);
    if (!item || !meta) return false;
    if (item.cuts < 2) {
      announce(`${meta.name} 还没处理好，榨汁机会拒绝编译。`, true);
      return false;
    }
    if (blenderState.length >= maxIngredients) {
      announce("杯体已经达到安全上限，再塞就会从盖子里喷出来。", true);
      return false;
    }
    boardState.delete(id);
    blenderState.push(id);
    renderAll();
    announce(`${meta.name} 已进入榨汁机。`);
    return true;
  };

  const loadPreparedItems = () => {
    const ready = Array.from(boardState.entries())
      .filter(([, item]) => item.cuts >= 2)
      .map(([id]) => id)
      .slice(0, Math.max(0, maxIngredients - blenderState.length));
    if (!ready.length) {
      announce("目前没有处理完成的食材。", true);
      return;
    }
    ready.forEach((id) => {
      boardState.delete(id);
      blenderState.push(id);
    });
    renderAll();
    announce(`${ready.length} 份食材沿着砧板滑进了榨汁机。`, true);
  };

  const removeBoardItem = (id) => {
    const meta = getMeta(id);
    if (!boardState.delete(id)) return false;
    renderAll();
    announce(`${meta?.name || "这份食材"} 被丢进了回收站。`);
    return true;
  };

  const resetKitchen = (announceReset = true) => {
    if (blendTimer) {
      window.clearTimeout(blendTimer);
      blendTimer = 0;
    }
    if (chopTimer) {
      window.clearTimeout(chopTimer);
      chopTimer = 0;
    }
    boardState.clear();
    blenderState = [];
    isBlending = false;
    root.dataset.blending = "false";
    root.dataset.hasResult = "false";
    const badge = root.querySelector("[data-kitchen-result-badge]");
    if (badge) badge.hidden = true;
    if (result instanceof HTMLElement) result.dataset.state = "idle";
    if (resultTitle) resultTitle.textContent = "今晚还没有出杯。";
    if (resultEnglish) resultEnglish.textContent = "NO ORDER YET";
    if (resultDescription) resultDescription.textContent = "砧板、榨汁机和垃圾桶都已经就位，只差一份稍微离谱一点的技术配方。";
    if (resultIngredients) resultIngredients.textContent = "WAITING";
    if (resultEffect) resultEffect.textContent = "尚未检测到副作用。";
    if (remixButton instanceof HTMLButtonElement) remixButton.disabled = true;
    renderAll();
    if (announceReset) announce("台面已经收拾干净，上一杯的事故记录也一并删除。", true);
  };

  const sortedKey = (ids) => [...ids].sort().join("|");
  const resolveRecipe = (ids) => {
    const exact = (catalog.recipes || []).find((recipe) => sortedKey(recipe.ingredients) === sortedKey(ids));
    if (exact) return exact;
    const allMeta = ids.map((id) => getMeta(id)).filter(Boolean);
    if (ids.length >= 4) {
      return {
        title: "技术栈乱炖",
        english: "STACK OVERFLOW PUNCH",
        description: "配方已经越过可维护边界，但杯顶的粉色泡沫坚持声称这叫模块化设计。",
        effect: "副作用：每喝一口，待办列表就会多一项。"
      };
    }
    return {
      title: `${allMeta.map((item) => item.code).join(" × ")} 非法联名`,
      english: "UNREGISTERED LAB SPECIAL",
      description: "配方簿里没有这杯，但榨汁机认为能跑就是成功。味道介于灵感闪现和忘记保存之间。",
      effect: "副作用：无法复现，也暂时没有测试覆盖。"
    };
  };

  const showResult = () => {
    const ids = [...blenderState];
    const recipe = resolveRecipe(ids);
    const first = getMeta(ids[0]);
    const second = getMeta(ids[1] || ids[0]);
    mixNumber += 1;
    if (result instanceof HTMLElement) {
      result.dataset.state = "ready";
      result.style.setProperty("--drink-a", first?.color || "#d95e9b");
      result.style.setProperty("--drink-b", second?.color || "#f1c56f");
    }
    if (resultTitle) resultTitle.textContent = recipe.title;
    if (resultEnglish) resultEnglish.textContent = recipe.english;
    if (resultDescription) resultDescription.textContent = recipe.description;
    if (resultIngredients) resultIngredients.textContent = ingredientCodes(ids);
    if (resultEffect) resultEffect.textContent = recipe.effect;
    const index = result?.querySelector(".kisara-drink-copy > p span");
    if (index) index.textContent = `RESULT / ${String(mixNumber).padStart(2, "0")}`;
    if (remixButton instanceof HTMLButtonElement) remixButton.disabled = false;
    if (blendButton instanceof HTMLButtonElement) blendButton.disabled = true;
    root.dataset.hasResult = "true";
    announce(`${recipe.title} 已经出杯。建议先拍照，再决定要不要喝。`, true);
    const badge = root.querySelector("[data-kitchen-result-badge]");
    if (badge) badge.hidden = false;
    worksStage?.showPanel("result");
  };

  const blend = () => {
    if (isBlending || blenderState.length < 2) {
      announce("至少需要两份处理好的食材，榨汁机才愿意启动。", true);
      return;
    }
    isBlending = true;
    root.dataset.blending = "true";
    renderAll();
    announce("榨汁机正在把技术栈打成一种看不出原型的颜色……", true);
    blendTimer = window.setTimeout(() => {
      blendTimer = 0;
      isBlending = false;
      root.dataset.blending = "false";
      renderAll();
      showResult();
    }, 980);
  };

  const createDragGhost = (source, width) => {
    const ghost = source.cloneNode(true);
    ghost.removeAttribute("id");
    ghost.removeAttribute("data-kitchen-ingredient");
    ghost.removeAttribute("data-board-item");
    ghost.classList.add("kisara-kitchen-drag-ghost");
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.setProperty("--drag-width", `${width}px`);
    ghost.style.right = "auto";
    ghost.style.bottom = "auto";
    ghost.style.margin = "0";
    ghost.style.translate = "none";
    ghost.style.scale = "1";
    ghost.style.transform = "none";
    document.body.append(ghost);
    return ghost;
  };

  const updateDragPosition = (timestamp) => {
    if (!dragState || !dragGhost) return;
    const elapsed = dragState.lastFrame ? timestamp - dragState.lastFrame : 16.67;
    const frameScale = Math.min(2.1, Math.max(0.45, elapsed / 16.67));
    dragState.lastFrame = timestamp;
    const spring = dragState.pointerType === "touch" ? 0.36 : 0.3;
    const damping = Math.pow(dragState.pointerType === "touch" ? 0.58 : 0.62, frameScale);
    dragState.velocityX = (dragState.velocityX + (dragState.targetX - dragState.renderX) * spring * frameScale) * damping;
    dragState.velocityY = (dragState.velocityY + (dragState.targetY - dragState.renderY) * spring * frameScale) * damping;
    dragState.renderX += dragState.velocityX * frameScale;
    dragState.renderY += dragState.velocityY * frameScale;
    const rotationEase = 1 - Math.pow(0.68, frameScale);
    dragState.rotation += (dragState.targetRotation - dragState.rotation) * rotationEase;
    const lift = Math.min(1.055, 1.018 + Math.hypot(dragState.pointerVelocityX, dragState.pointerVelocityY) * 0.0022);
    dragGhost.style.transform = `translate3d(${dragState.renderX / displayScale}px, ${dragState.renderY / displayScale}px, 0) rotate(${dragState.rotation}deg) scale(${lift})`;
    dragGhost.style.setProperty("--drag-speed", String(Math.min(1, Math.hypot(dragState.pointerVelocityX, dragState.pointerVelocityY) / 32)));
    dragFrame = requestAnimationFrame(updateDragPosition);
  };

  const queueDragPosition = () => {
    if (!dragFrame) dragFrame = requestAnimationFrame(updateDragPosition);
  };

  const settleDragGhost = (state, accepted) => {
    const ghost = dragGhost;
    dragGhost = null;
    if (!(ghost instanceof HTMLElement)) return;
    settlingGhosts.add(ghost);
    const startTransform = `translate3d(${state.renderX / displayScale}px, ${state.renderY / displayScale}px, 0) rotate(${state.rotation}deg) scale(1.03)`;
    const endTransform = accepted
      ? `translate3d(${(state.renderX + state.velocityX * 0.7) / displayScale}px, ${(state.renderY + state.velocityY * 0.7 + 7) / displayScale}px, 0) rotate(${state.rotation * 0.55}deg) scale(0.76)`
      : `translate3d(${state.originGhostX / displayScale}px, ${state.originGhostY / displayScale}px, 0) rotate(${state.baseRotation}deg) scale(0.94)`;
    const animation = ghost.animate(
      [
        { transform: startTransform, opacity: 0.94, filter: "saturate(1.08) blur(0px)" },
        { transform: endTransform, opacity: accepted ? 0 : 0.2, filter: accepted ? "saturate(1.12) blur(1.4px)" : "saturate(0.8) blur(0.4px)" }
      ],
      { duration: accepted ? 190 : 280, easing: accepted ? "cubic-bezier(0.2, 0.8, 0.2, 1)" : "cubic-bezier(0.18, 0.78, 0.2, 1)", fill: "forwards" }
    );
    animation.finished.catch(() => {}).finally(() => {
      settlingGhosts.delete(ghost);
      ghost.remove();
    });
  };

  const finishDrag = (event, cancelled = false) => {
    if (!dragState) return;
    const state = dragState;
    const moved = state.moved;
    const target = !cancelled && moved ? document.elementFromPoint(event.clientX, event.clientY) : null;
    const zone = target instanceof Element ? target.closest("[data-drop-zone]") : null;

    let accepted = false;
    if (moved) {
      suppressClickUntil = performance.now() + 360;
      if (zone instanceof HTMLElement) {
        const kind = zone.dataset.dropZone;
        if (kind === "board" && state.source === "pantry") accepted = addToBoard(state.id);
        else if (kind === "blender" && state.source === "board") accepted = transferItem(state.id);
        else if (kind === "trash" && state.source === "board") accepted = removeBoardItem(state.id);
        else if (kind === "blender") announce("未经切配的食材被榨汁机礼貌退回。", true);
        else if (kind === "trash") announce("还没开封就丢掉有点浪费，先做点东西吧。", true);
      } else {
        announce("食材滚回了原位，台面假装什么都没发生。", true);
      }
    }

    state.element.classList.remove("is-drag-source");
    if (dragFrame) cancelAnimationFrame(dragFrame);
    dragFrame = 0;
    if (moved) settleDragGhost(state, accepted);
    else {
      dragGhost?.remove();
      dragGhost = null;
    }
    dragState = null;
    delete root.dataset.dragging;
    setDropActive(null);
    if (customPointer instanceof HTMLElement) customPointer.dataset.mode = "hand";
  };

  const cancelPrepInteraction = () => {
    if (dragState) {
      const state = dragState;
      dragState = null;
      state.element.classList.remove("is-drag-source");
      if (state.element.hasPointerCapture?.(state.pointerId)) state.element.releasePointerCapture(state.pointerId);
    }
    window.cancelAnimationFrame(dragFrame);
    window.cancelAnimationFrame(pointerFrame);
    dragFrame = pointerFrame = 0;
    pendingPointer = null;
    dragGhost?.remove();
    dragGhost = null;
    settlingGhosts.forEach(ghost => ghost.remove());
    settlingGhosts.clear();
    delete root.dataset.dragging;
    setDropActive(null);
    if (customPointer) customPointer.dataset.visible = "false";
  };

  const beginDrag = (event, element, id, source) => {
    if (event.button !== 0 || isBlending || root.inert || root.dataset.activePanel === "result") return;
    if (source === "pantry" && element.getAttribute("aria-disabled") === "true") return;
    const rect = element.getBoundingClientRect();
    dragState = {
      id,
      source,
      element,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      anchorX: Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width))),
      anchorY: Math.min(1, Math.max(0, (event.clientY - rect.top) / Math.max(1, rect.height))),
      originRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      originGhostX: rect.left,
      originGhostY: rect.top,
      targetX: rect.left,
      targetY: rect.top,
      renderX: rect.left,
      renderY: rect.top,
      velocityX: 0,
      velocityY: 0,
      pointerVelocityX: 0,
      pointerVelocityY: 0,
      lastPointerX: event.clientX,
      lastPointerY: event.clientY,
      lastPointerTime: event.timeStamp,
      lastFrame: 0,
      baseRotation: source === "pantry" ? -2.5 : 1.5,
      rotation: source === "pantry" ? -2.5 : 1.5,
      targetRotation: source === "pantry" ? -2.5 : 1.5,
      pointerType: event.pointerType,
      moved: false
    };
    element.setPointerCapture?.(event.pointerId);
  };

  root.addEventListener("pointerdown", (event) => {
    const element = event.target instanceof Element
      ? event.target.closest("[data-kitchen-ingredient], [data-board-item]")
      : null;
    if (!(element instanceof HTMLElement)) return;
    const id = element.dataset.kitchenIngredient || element.dataset.boardItem;
    if (!id) return;
    beginDrag(event, element, id, element.dataset.boardItem ? "board" : "pantry");
  }, { signal });

  root.addEventListener("pointermove", (event) => {
    if (root.inert || root.dataset.activePanel === "result") return;
    if (precisePointer) {
      pendingPointer = { x: event.clientX, y: event.clientY, target: event.target };
    }
    if (precisePointer && !pointerFrame) {
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        if (!(customPointer instanceof HTMLElement) || !pendingPointer) return;
        const target = pendingPointer.target instanceof Element ? pendingPointer.target : null;
        const inPantry = target?.closest(".kisara-kitchen-pantry");
        const inBoard = target?.closest(".kisara-cutting-board");
        const inBoardAction = target?.closest(".kisara-board-actions");
        const shouldShow = Boolean(dragState || inPantry || (inBoard && !inBoardAction));
        customPointer.dataset.visible = String(shouldShow);
        customPointer.dataset.mode = dragState?.moved ? "grab" : inBoard ? "blade" : "hand";
        customPointer.style.transform = `translate3d(${pendingPointer.x / displayScale}px, ${pendingPointer.y / displayScale}px, 0)`;
      });
    }

    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY);
    if (!dragState.moved && distance >= 7) {
      dragState.moved = true;
      const ghostWidth = dragState.source === "pantry"
        ? Math.min(184, Math.max(118, dragState.originRect.width))
        : Math.min(178, Math.max(142, dragState.originRect.width));
      dragGhost = createDragGhost(dragState.element, ghostWidth / displayScale);
      const ghostRect = dragGhost.getBoundingClientRect();
      dragState.ghostWidth = ghostRect.width;
      dragState.ghostHeight = ghostRect.height;
      dragState.originGhostX = dragState.startX - ghostRect.width * dragState.anchorX;
      dragState.originGhostY = dragState.startY - ghostRect.height * dragState.anchorY;
      dragState.renderX = dragState.originGhostX;
      dragState.renderY = dragState.originGhostY;
      dragState.targetX = event.clientX - ghostRect.width * dragState.anchorX;
      dragState.targetY = event.clientY - ghostRect.height * dragState.anchorY;
      dragGhost.style.transform = `translate3d(${dragState.originGhostX / displayScale}px, ${dragState.originGhostY / displayScale}px, 0) rotate(${dragState.baseRotation}deg) scale(1.018)`;
      dragState.element.classList.add("is-drag-source");
      root.dataset.dragging = "true";
      queueDragPosition();
    }
    if (!dragState.moved) return;
    event.preventDefault();
    const pointerElapsed = Math.max(8, event.timeStamp - dragState.lastPointerTime);
    dragState.pointerVelocityX = (event.clientX - dragState.lastPointerX) / pointerElapsed * 16.67;
    dragState.pointerVelocityY = (event.clientY - dragState.lastPointerY) / pointerElapsed * 16.67;
    dragState.lastPointerX = event.clientX;
    dragState.lastPointerY = event.clientY;
    dragState.lastPointerTime = event.timeStamp;
    dragState.targetX = event.clientX - (dragState.ghostWidth || 82) * dragState.anchorX;
    dragState.targetY = event.clientY - (dragState.ghostHeight || 82) * dragState.anchorY;
    dragState.targetRotation = dragState.baseRotation + Math.max(-8, Math.min(8, dragState.pointerVelocityX * 0.22));
    const underPointer = document.elementFromPoint(event.clientX, event.clientY);
    const zone = underPointer instanceof Element ? underPointer.closest("[data-drop-zone]") : null;
    setDropActive(zone instanceof HTMLElement ? zone : null);
  }, { signal });

  root.addEventListener("pointerup", (event) => finishDrag(event), { signal });
  root.addEventListener("pointercancel", (event) => finishDrag(event, true), { signal });
  root.addEventListener("lostpointercapture", (event) => {
    if (dragState && dragState.pointerId === event.pointerId) finishDrag(event, true);
  }, { signal });
  root.addEventListener("pointerleave", () => {
    if (customPointer instanceof HTMLElement && !dragState) customPointer.dataset.visible = "false";
  }, { signal });

  root.addEventListener("click", (event) => {
    if (root.inert) return;
    if (performance.now() < suppressClickUntil) {
      event.preventDefault();
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("[data-return-prep]")) {
      worksStage?.showPanel("prep", true);
      return;
    }
    if (target?.closest("[data-remix]")) {
      resetKitchen();
      worksStage?.showPanel("prep", true);
      return;
    }
    if (root.dataset.activePanel === "result") return;
    const ingredient = target?.closest("[data-kitchen-ingredient]");
    const boardItem = target?.closest("[data-board-item]");
    if (ingredient instanceof HTMLElement) {
      const id = ingredient.dataset.kitchenIngredient;
      if (id) addToBoard(id);
      return;
    }
    if (boardItem instanceof HTMLElement) {
      const id = boardItem.dataset.boardItem;
      if (id) chopItem(id);
      return;
    }
    if (target?.closest("[data-chop-all]")) chopAll();
    else if (target?.closest("[data-load-blender]")) loadPreparedItems();
    else if (target?.closest("[data-blend]")) blend();
    else if (target?.closest("[data-trash-button]")) resetKitchen();
  }, { signal });

  const track = document.querySelector("[data-works-stage-track]");
  if (track instanceof HTMLElement) {
    worksStage = bindWorksStage(track, {
      signal,
      onHeroActive(active) { heroStageActive = active; syncWorksActivity(); cacheHeroGeometry(); },
      onLeavePrep: cancelPrepInteraction
    });
  }
  root.dataset.kitchenReady = "true";
  renderAll();
}
