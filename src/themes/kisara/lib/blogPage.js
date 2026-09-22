export const parseCssTimeMs = (raw) => {
  const value = String(raw ?? "").trim().toLowerCase();
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number)) return 0;
  return value.endsWith("ms") ? number : value.endsWith("s") ? number * 1000 : number;
};

export function bindBlogPage() {
  window.__yuimiKisaraInnerCleanup?.();
  const lifecycle = new AbortController();
  const signal = lifecycle.signal;
  const hero = document.querySelector("[data-kisara-blog-hero]");
  const archive = document.querySelector("[data-kisara-archive]");
  const track = document.querySelector("[data-blog-stage-track]");
  const stage = document.querySelector("[data-blog-stage]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const introDuration = 1700;
  let introElapsed = 0;
  let lastIntroTime = 0;
  let scrollProgress = 0;
  let entryDistance = 1;
  let stageScale = 1;
  let stageTop = 0;
  let archiveOverflow = 0;
  let stageResizeObserver = null;
  const introAnimations = [];
  const archiveAnimations = [];
  let scrim = null;
  let focusArchive = false;
  let introGeneration = 0;
  let introFrame = 0;
  let decodeTimer = 0;
  let heroVisible = true;
  let heroObserver = null;
  let castResizeObserver = null;
  let scrollFrame = 0;
  let lockedCastFocus = "all";
  let hoveredCastFocus = "all";
  let castHoverCandidate = "all";
  let castHoverCandidateSince = 0;
  let castHitFrame = 0;
  let castPointerX = 0;
  let castPointerY = 0;
  let castPointerTarget = null;
  let castPointerActive = false;
  let castHitMasks = [];
  let castMaskPromise = null;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const fineCastPointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  const cleanup = () => {
    lifecycle.abort();
    introGeneration += 1;
    window.clearTimeout(decodeTimer);
    window.cancelAnimationFrame(introFrame);
    heroObserver?.disconnect();
    castResizeObserver?.disconnect();
    stageResizeObserver?.disconnect();
    introAnimations.forEach(animation => animation.cancel());
    archiveAnimations.forEach(animation => animation.cancel());
    scrim?.remove();
    hero?.removeAttribute("inert");
    hero?.style.removeProperty("visibility");
    track?.removeAttribute("data-stage-ready");
    track?.style.removeProperty("height");
    if (archive instanceof HTMLElement) {
      archive.inert = false;
      archive.style.removeProperty("transform");
      archive.style.removeProperty("visibility");
    }
    if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
    if (castHitFrame) window.cancelAnimationFrame(castHitFrame);
    castHitMasks = [];
    if (window.__yuimiKisaraInnerCleanup === cleanup) window.__yuimiKisaraInnerCleanup = null;
  };
  window.__yuimiKisaraInnerCleanup = cleanup;
  document.addEventListener("astro:before-swap", cleanup, { once: true, signal });

  const finishIntro = () => {
    if (!(hero instanceof HTMLElement)) return;
    introGeneration += 1;
    window.clearTimeout(decodeTimer);
    window.cancelAnimationFrame(introFrame);
    introFrame = 0;
    hero.dataset.introState = "complete";
    introElapsed = introDuration;
    syncScroll();
    if (castPointerActive) scheduleCastHit();
  };

  const syncHeroActivity = () => {
    if (!(hero instanceof HTMLElement) || signal.aborted) return;
    const active = heroVisible && !document.hidden;
    hero.toggleAttribute("data-hero-active", active);
    if (!active) {
      window.cancelAnimationFrame(introFrame);
      introFrame = 0;
      window.cancelAnimationFrame(castHitFrame);
      castHitFrame = 0;
      castPointerActive = false;
    } else if (hero.dataset.introState === "playing" && !introFrame) {
      lastIntroTime = performance.now();
      introFrame = window.requestAnimationFrame(tickIntro);
    }
  };

  const tickIntro = (now) => {
    introFrame = 0;
    if (signal.aborted || document.hidden || !heroVisible) return;
    introElapsed = Math.min(introDuration, introElapsed + Math.max(0, now - lastIntroTime));
    lastIntroTime = now;
    syncScroll();
    if (introElapsed === introDuration) finishIntro();
    else introFrame = window.requestAnimationFrame(tickIntro);
  };

  const addMotion = (collection, element, frames, duration, delay = 0, easing = "linear") => {
    if (!element?.animate || reducedMotion) return;
    const animation = element.animate(frames, { duration, delay, easing, fill: "both" });
    animation.pause();
    animation.currentTime = 0;
    collection.push(animation);
  };

  const prepareMotion = () => {
    hero?.querySelectorAll(".kisara-blog-cast-slot").forEach(slot => {
      const css = getComputedStyle(slot);
      const value = key => parseFloat(css.getPropertyValue(key)) || 0;
      const x = value("--cast-x"), y = value("--cast-y");
      const delay = parseCssTimeMs(css.getPropertyValue("--cast-delay"));
      const duration = parseCssTimeMs(css.getPropertyValue("--cast-duration"));
      addMotion(introAnimations, slot, [
        { opacity: 0, transform: `translate3d(${x + value("--cast-enter-x")}%, ${y + value("--cast-enter-y")}%, 0) scale(${value("--cast-enter-scale")})` },
        { opacity: 1, transform: `translate3d(${x}%, ${y}%, 0) scale(1)` },
      ], duration, delay, "cubic-bezier(0.23, 1, 0.32, 1)");
    });
    addMotion(introAnimations, hero?.querySelector(".kisara-blog-trace-signal"), [
      { opacity: 0, transform: "translateY(20px)" },
      { opacity: 1, transform: "translateY(0)" },
    ], 520, 100, "cubic-bezier(0.23, 1, 0.32, 1)");
    // Each pen stroke reveals the one filled glyph; no second text/outline layer.
    hero?.querySelectorAll("[data-blog-pen]").forEach(pen => {
      addMotion(introAnimations, pen, [
        { opacity: 0, strokeDasharray: "1 1", strokeDashoffset: "1", offset: 0 },
        { opacity: 1, strokeDasharray: "1 1", strokeDashoffset: "1", offset: .001 },
        { opacity: 1, strokeDasharray: "1 1", strokeDashoffset: "0", offset: 1 },
      ], 84, 330 + Number(pen.dataset.penOrder) * 72);
    });
    addMotion(introAnimations, hero?.querySelector(".kisara-blog-enter"), [
      { opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" },
    ], 240, 1400);
    const parts = archive?.querySelectorAll(":scope > .kisara-blog-archive-heading, :scope > .kisara-blog-view-switch, :scope > .kisara-blog-toolbar, :scope > .kisara-blog-view-panel, :scope > .kisara-blog-empty") || [];
    parts.forEach((part, index) => addMotion(archiveAnimations, part, [
      { opacity: 0, transform: `translateY(${index < 3 ? 28 : 64}px)` },
      { opacity: 1, transform: "translateY(0)" },
    ], .32, .38 + Math.min(index, 3) * .08, "cubic-bezier(0.23, 1, 0.32, 1)"));
  };

  const playIntro = async () => {
    if (!(hero instanceof HTMLElement)) return;
    const generation = ++introGeneration;
    window.clearTimeout(decodeTimer);
    window.cancelAnimationFrame(introFrame);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finishIntro();
      return;
    }

    hero.dataset.introState = "idle";
    setCastFocus("all");
    lockedCastFocus = "all";
    hoveredCastFocus = "all";
    const images = Array.from(hero.querySelectorAll(".kisara-blog-scene-bg, .kisara-blog-character"));
    await Promise.race([
      Promise.all(images.map((image) => {
        if (!(image instanceof HTMLImageElement) || image.complete) return Promise.resolve();
        return image.decode().catch(() => undefined);
      })),
      new Promise((resolve) => { decodeTimer = window.setTimeout(resolve, 420); })
    ]);
    window.clearTimeout(decodeTimer);
    if (signal.aborted || generation !== introGeneration) return;
    hero.dataset.introState = "playing";
    introElapsed = 0;
    syncHeroActivity();
  };

  const measureStage = () => {
    if (!(track instanceof HTMLElement) || !(stage instanceof HTMLElement) || !(archive instanceof HTMLElement)) return;
    const bounds = stage.getBoundingClientRect();
    stageScale = bounds.height / Math.max(1, stage.clientHeight);
    stageTop = track.getBoundingClientRect().top + window.scrollY;
    entryDistance = Math.max(240, bounds.height * .55);
    const top = archive.offsetTop * stageScale;
    archiveOverflow = Math.max(0, archive.offsetHeight * stageScale - (bounds.height - top));
    track.style.height = `${(bounds.height + entryDistance + archiveOverflow) / stageScale}px`;
    scheduleScrollSync();
  };

  const syncScroll = () => {
    scrollFrame = 0;
    if (!(hero instanceof HTMLElement)) return;
    const distance = Math.max(0, window.scrollY - stageTop);
    scrollProgress = clamp(distance / entryDistance, 0, 1);
    const exit = clamp(scrollProgress / .66, 0, 1);
    const time = Math.min(introElapsed, introDuration * (1 - exit));
    introAnimations.forEach(animation => { animation.currentTime = time; });
    archiveAnimations.forEach(animation => { animation.currentTime = scrollProgress; });
    if (scrim) scrim.style.opacity = String(clamp((scrollProgress - .3) / .5, 0, 1));
    if (archive instanceof HTMLElement && track?.hasAttribute("data-stage-ready")) {
      archive.inert = scrollProgress < .46;
      archive.style.visibility = scrollProgress <= .36 ? "hidden" : "visible";
      archive.style.transform = `translateY(${-clamp(distance - entryDistance, 0, archiveOverflow) / stageScale}px)`;
      if (focusArchive && scrollProgress >= .995) {
        focusArchive = false;
        archive.querySelector("input")?.focus({ preventScroll: true });
      }
    }
    hero.inert = exit === 1;
    if (reducedMotion) hero.style.visibility = scrollProgress > .36 ? "hidden" : "visible";
    if (scrollProgress > .015) {
      hoveredCastFocus = lockedCastFocus = "all";
      setCastFocus("all");
      castPointerActive = false;
    }
  };

  const scheduleScrollSync = () => {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(syncScroll);
  };

  window.addEventListener("scroll", scheduleScrollSync, { passive: true, signal });
  window.addEventListener("resize", measureStage, { passive: true, signal });

  const castVoices = {
    all: ["", ""],
    kisara: ["木更 / KISARA", "记得太多，反而最像被留下的人。"],
    shu: ["修 / SHU", "靠遗忘继续前进，却总在别人的记忆里出现。"],
    ayano: ["绫乃 / AYANO", "想把过去说清楚的人，往往最晚收到回复。"],
    sharon: ["莎朗 / SHARON", "从旧契约里追来，也把局面重新写了一遍。"]
  };
  const castNote = hero?.querySelector("[data-blog-cast-note]");
  const castLabel = hero?.querySelector("[data-blog-cast-label]");
  const castCopy = hero?.querySelector("[data-blog-cast-copy]");
  const characterImages = Array.from(hero?.querySelectorAll("[data-blog-character]") || []);
  const setCastFocus = (id) => {
    if (!(hero instanceof HTMLElement) || !castVoices[id]) return;
    if (hero.dataset.castFocus === id) return;
    if (id !== "all" && hero.dataset.introState !== "complete") finishIntro();
    hero.dataset.castFocus = id;
    if (castNote instanceof HTMLElement) castNote.dataset.castNoteFor = id;
    const [label, copy] = castVoices[id];
    if (castLabel) castLabel.textContent = label;
    if (castCopy) castCopy.textContent = copy;
  };

  // Hit geometry stays at the settled pose; focus magnification must not move its own hit target.
  const cacheCastGeometry = () => {
    const stage = hero?.querySelector(".kisara-blog-character-stage");
    if (!(stage instanceof HTMLElement)) return;
    const bounds = stage.getBoundingClientRect();
    castHitMasks.forEach(mask => {
      const style = getComputedStyle(mask.image);
      mask.rect = {
        left: bounds.left + (parseFloat(style.getPropertyValue("--cast-x")) || 0) * bounds.width / 100,
        top: bounds.top + (parseFloat(style.getPropertyValue("--cast-y")) || 0) * bounds.height / 100,
        width: bounds.width, height: bounds.height
      };
    });
  };

  const prepareCastHitMasks = () => {
    if (!fineCastPointer || castMaskPromise || !characterImages.length) return castMaskPromise;
    castMaskPromise = (async () => {
      const masks = [];
      for (const image of characterImages) {
        if (!(image instanceof HTMLImageElement) || !image.dataset.blogCharacter) continue;
        if (!image.complete) await image.decode().catch(() => undefined);
        if (signal.aborted || !image.naturalWidth || !image.naturalHeight) return [];

        const width = Math.min(720, image.naturalWidth);
        const height = Math.max(1, Math.round(width * image.naturalHeight / image.naturalWidth));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) continue;

        context.drawImage(image, 0, 0, width, height);
        const source = context.getImageData(0, 0, width, height).data;
        const alpha = new Uint8Array(width * height);
        for (let sourceIndex = 3, alphaIndex = 0; sourceIndex < source.length; sourceIndex += 4, alphaIndex += 1) {
          alpha[alphaIndex] = source[sourceIndex];
        }
        canvas.width = 0;
        canvas.height = 0;
        masks.push({ id: image.dataset.blogCharacter, image, width, height, alpha });
      }
      if (!signal.aborted) {
        castHitMasks = masks;
        cacheCastGeometry();
      }
      if (castPointerActive) scheduleCastHit();
      return masks;
    })().catch(() => []);
    return castMaskPromise;
  };

  const maskHit = (mask, clientX, clientY, radius = 0) => {
    const rect = mask.rect;
    if (!rect) return false;
    const x = Math.floor((clientX - rect.left) / rect.width * mask.width);
    const y = Math.floor((clientY - rect.top) / rect.height * mask.height);
    const pad = Math.ceil(radius * mask.width / rect.width);
    for (let dy = -pad; dy <= pad; dy++) {
      for (let dx = -pad; dx <= pad; dx++) {
        const px = x + dx, py = y + dy;
        if (px >= 0 && py >= 0 && px < mask.width && py < mask.height && mask.alpha[py * mask.width + px] >= 80) return true;
      }
    }
    return false;
  };

  const findCharacterAtPoint = (clientX, clientY) => {
    // A small exit margin absorbs hair/alpha seams without moving the hit geometry.
    const current = castHitMasks.find(mask => mask.id === hoveredCastFocus);
    if (current && maskHit(current, clientX, clientY, 4)) return current.id;
    for (let index = castHitMasks.length - 1; index >= 0; index -= 1) {
      const mask = castHitMasks[index];
      if (maskHit(mask, clientX, clientY)) return mask.id;
    }
    return "all";
  };

  const resolveCastHit = () => {
    castHitFrame = 0;
    if (!(hero instanceof HTMLElement) || hero.dataset.introState !== "complete" || !castPointerActive || scrollProgress > .015) return;
    if (castPointerTarget instanceof Element && castPointerTarget.closest("a, button, input, select, textarea")) {
      hero.dataset.castHover = "all";
      hoveredCastFocus = "all";
      castHoverCandidate = "all";
      castHoverCandidateSince = 0;
      setCastFocus(lockedCastFocus);
      return;
    }
    const nextFocus = findCharacterAtPoint(castPointerX, castPointerY);
    if (nextFocus === hoveredCastFocus) {
      castHoverCandidate = nextFocus;
      return;
    }
    if (nextFocus !== castHoverCandidate) {
      castHoverCandidate = nextFocus;
      castHoverCandidateSince = performance.now();
    }
    if (performance.now() - castHoverCandidateSince < (hoveredCastFocus === "all" ? 32 : 70)) {
      scheduleCastHit();
      return;
    }
    hero.dataset.castHover = nextFocus;
    if (hoveredCastFocus === nextFocus) return;
    hoveredCastFocus = nextFocus;
    setCastFocus(nextFocus === "all" ? lockedCastFocus : nextFocus);
  };

  const scheduleCastHit = () => {
    if (!fineCastPointer || castHitFrame || document.hidden || !heroVisible || signal.aborted) return;
    castHitFrame = window.requestAnimationFrame(resolveCastHit);
  };

  if (fineCastPointer && hero instanceof HTMLElement) {
    hero.addEventListener("pointerenter", prepareCastHitMasks, { once: true, signal });
    hero.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      castPointerActive = true;
      castPointerX = event.clientX;
      castPointerY = event.clientY;
      castPointerTarget = event.target;
      scheduleCastHit();
    }, { passive: true, signal });
    hero.addEventListener("pointerleave", () => {
      castPointerActive = false;
      hoveredCastFocus = "all";
      castHoverCandidate = "all";
      castHoverCandidateSince = 0;
      window.cancelAnimationFrame(castHitFrame);
      castHitFrame = 0;
      hero.dataset.castHover = "all";
      setCastFocus(lockedCastFocus);
    }, { signal });
    hero.addEventListener("click", (event) => {
      if (hoveredCastFocus === "all") return;
      if (event.target instanceof Element && event.target.closest("a, button, input, select, textarea")) return;
      lockedCastFocus = lockedCastFocus === hoveredCastFocus ? "all" : hoveredCastFocus;
      setCastFocus(lockedCastFocus === "all" ? hoveredCastFocus : lockedCastFocus);
    }, { signal });
  }
  hero?.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    lockedCastFocus = hoveredCastFocus = "all";
    setCastFocus("all");
  }, { signal });

  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) return;
    finishIntro();
    scheduleScrollSync();
  }, { signal });
  if (hero instanceof HTMLElement && typeof IntersectionObserver === "function") {
    heroObserver = new IntersectionObserver(([entry]) => {
      heroVisible = Boolean(entry?.isIntersecting);
      syncHeroActivity();
    }, { threshold: 0 });
    heroObserver.observe(hero);
  }
  if (hero instanceof HTMLElement && typeof ResizeObserver === "function") {
    castResizeObserver = new ResizeObserver(cacheCastGeometry);
    castResizeObserver.observe(hero);
  }
  window.addEventListener("resize", cacheCastGeometry, { passive: true, signal });
  document.addEventListener("visibilitychange", syncHeroActivity, { signal });
  if (track instanceof HTMLElement && stage instanceof HTMLElement && archive instanceof HTMLElement) {
    track.setAttribute("data-stage-ready", "");
    scrim = document.createElement("div");
    scrim.className = "kisara-blog-stage-scrim";
    scrim.setAttribute("aria-hidden", "true");
    stage.insertBefore(scrim, archive);
    measureStage();
    prepareMotion();
    syncScroll();
    if (typeof ResizeObserver === "function") {
      stageResizeObserver = new ResizeObserver(() => {
        measureStage();
        cacheCastGeometry();
      });
      stageResizeObserver.observe(stage);
      stageResizeObserver.observe(archive);
    }
    const enterArchive = () => {
      if (signal.aborted) return;
      window.scrollTo({ top: stageTop + entryDistance, behavior: reducedMotion ? "instant" : "smooth" });
    };
    hero?.querySelector(".kisara-blog-enter")?.addEventListener("click", event => {
      event.preventDefault();
      focusArchive = true;
      history.replaceState(history.state, "", "#kisara-blog-archive");
      enterArchive();
    }, { signal });
    archive.addEventListener("focusin", event => {
      if (!(event.target instanceof HTMLElement) || focusArchive) return;
      const rect = event.target.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const delta = rect.bottom > stageRect.bottom - 24 ? rect.bottom - stageRect.bottom + 24
        : rect.top < stageRect.top + 86 ? rect.top - stageRect.top - 86 : 0;
      if (delta) window.scrollTo({
        top: clamp(window.scrollY + delta, stageTop + entryDistance, stageTop + entryDistance + archiveOverflow),
        behavior: "instant",
      });
    }, { signal });
    window.addEventListener("hashchange", () => {
      if (location.hash === "#kisara-blog-archive") enterArchive();
    }, { signal });
    if (location.hash === "#kisara-blog-archive") enterArchive();
  }
  syncHeroActivity();
  playIntro();

  if (!archive) return;
  const input = archive.querySelector("[data-kisara-archive-search]");
  const buttons = Array.from(archive.querySelectorAll("[data-kisara-filter]"));
  const records = Array.from(archive.querySelectorAll("[data-kisara-record]"));
  const count = archive.querySelector("[data-kisara-result-count]");
  const empty = archive.querySelector("[data-kisara-empty]");
  const viewButtons = Array.from(archive.querySelectorAll("[data-kisara-view]"));
  const viewPanels = Array.from(archive.querySelectorAll("[data-kisara-view-panel]"));
  const timelineYears = Array.from(archive.querySelectorAll("[data-kisara-timeline-year]"));
  let activeFilter = "all";

  const setActiveView = (nextView, persist = true) => {
    if (nextView !== "stream" && nextView !== "timeline") return;
    archive.dataset.activeView = nextView;
    viewButtons.forEach((button) => {
      const selected = button instanceof HTMLElement && button.dataset.kisaraView === nextView;
      button.setAttribute("aria-selected", String(selected));
      if (button instanceof HTMLElement) button.tabIndex = selected ? 0 : -1;
    });
    viewPanels.forEach((panel) => {
      if (!(panel instanceof HTMLElement)) return;
      panel.hidden = panel.dataset.kisaraViewPanel !== nextView;
    });
    if (persist) {
      try { window.sessionStorage.setItem("yuimi:kisara:blog-view", nextView); } catch {}
    }
  };

  const refresh = () => {
    const query = input instanceof HTMLInputElement ? input.value.trim().toLowerCase() : "";
    const visiblePosts = new Set();
    records.forEach((record) => {
      if (!(record instanceof HTMLElement)) return;
      const categoryMatch = activeFilter === "all" || record.dataset.category === activeFilter;
      const queryMatch = !query || record.dataset.search?.includes(query);
      const visible = Boolean(categoryMatch && queryMatch);
      record.hidden = !visible;
      if (visible && record.dataset.postId) visiblePosts.add(record.dataset.postId);
    });
    timelineYears.forEach((year) => {
      if (!(year instanceof HTMLElement)) return;
      year.hidden = !year.querySelector("[data-kisara-record]:not([hidden])");
    });
    const visibleCount = visiblePosts.size;
    if (count) count.textContent = `${visibleCount} SIGNALS`;
    if (empty instanceof HTMLElement) empty.hidden = visibleCount !== 0;
  };

  input?.addEventListener("input", refresh, { signal });
  buttons.forEach((button) => button.addEventListener("click", () => {
    if (!(button instanceof HTMLElement)) return;
    activeFilter = button.dataset.kisaraFilter ?? "all";
    buttons.forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
    refresh();
  }, { signal }));
  viewButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      if (button instanceof HTMLElement) setActiveView(button.dataset.kisaraView ?? "stream");
    }, { signal });
    button.addEventListener("keydown", (event) => {
      if (!(event instanceof KeyboardEvent) || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      let nextIndex = index;
      if (event.key === "ArrowLeft") nextIndex = (index - 1 + viewButtons.length) % viewButtons.length;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % viewButtons.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = viewButtons.length - 1;
      const nextButton = viewButtons[nextIndex];
      if (nextButton instanceof HTMLElement) {
        setActiveView(nextButton.dataset.kisaraView ?? "stream");
        nextButton.focus();
      }
    }, { signal });
  });

  try {
    const storedView = window.sessionStorage.getItem("yuimi:kisara:blog-view");
    if (storedView) setActiveView(storedView, false);
  } catch {}
  refresh();
}
