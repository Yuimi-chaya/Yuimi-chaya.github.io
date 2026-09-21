export function bindBlogPage() {
  window.__yuimiKisaraInnerCleanup?.();
  const lifecycle = new AbortController();
  const signal = lifecycle.signal;
  const hero = document.querySelector("[data-kisara-blog-hero]");
  const archive = document.querySelector("[data-kisara-archive]");
  let introTimer = 0;
  let introGeneration = 0;
  let introFrame = 0;
  let introDeadline = 0;
  let introRemaining = 1320;
  let heroVisible = true;
  let heroObserver = null;
  let castResizeObserver = null;
  let scrollFrame = 0;
  let lockedCastFocus = "all";
  let hoveredCastFocus = "all";
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
    window.clearTimeout(introTimer);
    window.cancelAnimationFrame(introFrame);
    heroObserver?.disconnect();
    castResizeObserver?.disconnect();
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
    window.clearTimeout(introTimer);
    introTimer = 0;
    window.cancelAnimationFrame(introFrame);
    introFrame = 0;
    hero.dataset.introState = "complete";
    if (castPointerActive) scheduleCastHit();
  };

  const syncHeroActivity = () => {
    if (!(hero instanceof HTMLElement) || signal.aborted) return;
    const active = heroVisible && !document.hidden;
    hero.toggleAttribute("data-hero-active", active);
    if (!active) {
      if (introTimer) introRemaining = Math.max(0, introDeadline - performance.now());
      window.clearTimeout(introTimer);
      introTimer = 0;
      window.cancelAnimationFrame(castHitFrame);
      castHitFrame = 0;
      castPointerActive = false;
    } else if (hero.dataset.introState === "playing" && !introTimer) {
      introDeadline = performance.now() + introRemaining;
      introTimer = window.setTimeout(finishIntro, introRemaining);
    }
  };

  const playIntro = async () => {
    if (!(hero instanceof HTMLElement)) return;
    const generation = ++introGeneration;
    window.clearTimeout(introTimer);
    introTimer = 0;
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
      new Promise((resolve) => window.setTimeout(resolve, 420))
    ]);
    if (signal.aborted || generation !== introGeneration) return;
    void hero.offsetWidth;
    introFrame = requestAnimationFrame(() => {
      introFrame = 0;
      if (signal.aborted || generation !== introGeneration) return;
      hero.dataset.introState = "playing";
      introRemaining = 1320;
      syncHeroActivity();
    });
  };

  const syncScroll = () => {
    scrollFrame = 0;
    if (!(hero instanceof HTMLElement)) return;
    const rect = hero.getBoundingClientRect();
    const archiveRect = archive instanceof HTMLElement ? archive.getBoundingClientRect() : null;
    const progress = archiveRect
      ? clamp((rect.height - archiveRect.top) / Math.max(1, rect.height * 0.62), 0, 1)
      : clamp(-rect.top / Math.max(1, rect.height * 0.58), 0, 1);
    const exit = 1 - Math.pow(1 - progress, 3);
    hero.style.setProperty("--blog-scroll-progress", progress.toFixed(4));
    hero.style.setProperty("--blog-scroll-exit", exit.toFixed(4));
    hero.style.setProperty("--blog-cast-exit-x", `${Math.round(-170 * exit)}px`);
    hero.style.setProperty("--blog-cast-exit-y", `${Math.round(-92 * exit)}px`);
    hero.style.setProperty("--blog-cast-scale", (1 - exit * 0.08).toFixed(4));
    hero.style.setProperty("--blog-copy-exit-x", `${Math.round(-104 * exit)}px`);
    hero.style.setProperty("--blog-copy-exit-y", `${Math.round(-58 * exit)}px`);
    hero.style.setProperty("--blog-copy-scale", (1 - exit * 0.04).toFixed(4));
    hero.style.setProperty("--blog-copy-opacity", (1 - exit).toFixed(4));
    hero.style.setProperty("--blog-index-exit-y", `${Math.round(76 * exit)}px`);
    hero.style.setProperty("--blog-index-opacity", (1 - exit).toFixed(4));
  };

  const scheduleScrollSync = () => {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(syncScroll);
  };

  window.addEventListener("scroll", scheduleScrollSync, { passive: true, signal });
  window.addEventListener("resize", scheduleScrollSync, { passive: true, signal });
  scheduleScrollSync();

  const castVoices = {
    all: ["", ""],
    kisara: ["木更 / KISARA", "记得太多，反而最像被留下的人。"],
    shu: ["修 / SHU", "靠遗忘继续前进，却总在别人的记忆里出现。"],
    ayano: ["绫乃 / AYANO", "想把过去说清楚的人，往往最晚收到回复。"],
    sharon: ["莎朗 / SHARON", "从旧契约里追来，也把局面重新写了一遍。"]
  };
  const castIndex = hero?.querySelector("[data-blog-cast-index]");
  const castButtons = Array.from(hero?.querySelectorAll("[data-blog-cast]") || []);
  const castControls = castButtons;
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
    castControls.forEach((button) => {
      if (!(button instanceof HTMLButtonElement)) return;
      const controlId = button.dataset.blogCast;
      button.setAttribute("aria-pressed", String(controlId === id));
    });
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
        top: bounds.top + window.scrollY + (parseFloat(style.getPropertyValue("--cast-y")) || 0) * bounds.height / 100,
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

  const findCharacterAtPoint = (clientX, clientY) => {
    for (let index = castHitMasks.length - 1; index >= 0; index -= 1) {
      const mask = castHitMasks[index];
      const rect = mask.rect;
      if (!rect) continue;
      const pageY = clientY + window.scrollY;
      if (clientX < rect.left || clientX >= rect.left + rect.width || pageY < rect.top || pageY >= rect.top + rect.height) continue;
      const x = Math.min(mask.width - 1, Math.floor((clientX - rect.left) / rect.width * mask.width));
      const y = Math.min(mask.height - 1, Math.floor((pageY - rect.top) / rect.height * mask.height));
      if (mask.alpha[y * mask.width + x] >= 14) return mask.id;
    }
    return "all";
  };

  const resolveCastHit = () => {
    castHitFrame = 0;
    if (!(hero instanceof HTMLElement) || hero.dataset.introState !== "complete") return;
    if (castPointerTarget instanceof Element && castPointerTarget.closest("[data-blog-cast]")) {
      hero.dataset.castHover = "all";
      hoveredCastFocus = "all";
      return;
    }
    if (castPointerTarget instanceof Element && castPointerTarget.closest("a, button, input, select, textarea")) {
      hero.dataset.castHover = "all";
      hoveredCastFocus = "all";
      setCastFocus(lockedCastFocus);
      return;
    }
    const nextFocus = findCharacterAtPoint(castPointerX, castPointerY);
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

  castControls.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) return;
    const id = button.dataset.blogCast;
    if (!id) return;
    button.addEventListener("pointerenter", () => setCastFocus(id), { signal });
    button.addEventListener("focus", () => setCastFocus(id), { signal });
    button.addEventListener("blur", () => setCastFocus(lockedCastFocus), { signal });
    button.addEventListener("click", () => {
      lockedCastFocus = lockedCastFocus === id ? "all" : id;
      setCastFocus(lockedCastFocus);
    }, { signal });
  });
  castIndex?.addEventListener("pointerleave", () => setCastFocus(lockedCastFocus), { signal });
  hero?.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    lockedCastFocus = hoveredCastFocus = "all";
    setCastFocus("all");
  }, { signal });

  hero?.querySelector("[data-blog-replay]")?.addEventListener("click", playIntro, { signal });
  hero?.querySelector("[data-blog-skip]")?.addEventListener("click", finishIntro, { signal });
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
