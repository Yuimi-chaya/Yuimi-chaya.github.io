const gateStageLabels = {
  awakening: "锁链唤醒",
  "outer-bind": "外环缠绕",
  "inner-bind": "内层交织",
  "maximum-tension": "封印拉满",
  glitch: "封印过载",
  rupture: "锁链崩断",
  enchant: "契约附魔",
  reconstruction: "数据重构",
  complete: "契约释放",
  returning: "信号回收"
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const initKisaraLayoutRuntime = () => {
  const body = document.body;
  if (!body || document.documentElement.dataset.theme !== "kisara") return;
  if (body.dataset.kisaraLayoutRuntimeBound === "true") return;

  window.__yuimiKisaraLayoutCleanup?.();
  body.dataset.kisaraLayoutRuntimeBound = "true";

  const lifecycle = new AbortController();
  const signal = lifecycle.signal;
  const panel = document.querySelector("[data-kisara-theme-panel]");
  const panelButton = document.querySelector("[data-kisara-theme-button]");
  const panelClose = document.querySelector("[data-kisara-panel-close]");
  const menu = document.querySelector("[data-kisara-context-menu]");
  const menuStatus = menu?.querySelector("[data-kisara-context-status]");
  const scrollbar = document.querySelector("[data-kisara-scrollbar]");
  let returnFocus = null;
  let scrollbarFrame = 0;
  let scrollbarResizeObserver = null;
  let gateRailActive = false;
  let gateRailProgress = 0;
  let gateRailStage = "document";
  let gateRailGuided = false;
  let gateRailTransitioning = false;
  let gateRailPlaybackRate = 1;
  let gateRailPressure = 0;
  let gateRailReleaseMode = "manual";

  const getScrollbarMetrics = () => {
    if (!(scrollbar instanceof HTMLElement)) return null;
    const root = document.scrollingElement ?? document.documentElement;
    const trackRect = scrollbar.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const scrollHeight = Math.max(root.scrollHeight, body.scrollHeight);
    const scrollRange = Math.max(0, scrollHeight - viewportHeight);
    const minimumThumbSize = window.innerWidth <= 600 ? 34 : 46;
    const thumbSize = clamp(trackRect.height * (viewportHeight / Math.max(scrollHeight, 1)), minimumThumbSize, 82);
    return { trackRect, scrollRange, thumbSize };
  };

  const updateScrollbar = () => {
    scrollbarFrame = 0;
    if (!(scrollbar instanceof HTMLElement)) return;
    const metrics = getScrollbarMetrics();
    if (!metrics) return;
    const gateMode = gateRailActive && (window.scrollY <= 2 || gateRailTransitioning);
    const pageProgress = metrics.scrollRange > 0 ? clamp(window.scrollY / metrics.scrollRange, 0, 1) : 0;
    const progress = gateMode ? gateRailProgress : pageProgress;
    const thumbSize = gateMode ? (window.innerWidth <= 600 ? 34 : 46) : metrics.thumbSize;
    const thumbTravel = Math.max(0, metrics.trackRect.height - thumbSize);
    const thumbY = thumbTravel * progress;
    const markerY = thumbY + thumbSize * 0.5;
    scrollbar.classList.toggle("is-idle", metrics.scrollRange <= 1 || metrics.trackRect.height <= 0);
    scrollbar.classList.toggle("is-gate-progress", gateMode);
    scrollbar.classList.toggle("is-scroll-guided", gateMode && gateRailGuided);
    scrollbar.classList.toggle("is-returning", gateMode && gateRailTransitioning);
    scrollbar.classList.toggle(
      "is-release-boosted",
      gateMode && gateRailReleaseMode === "forward" && gateRailPressure > 0.08
    );
    scrollbar.dataset.stage = gateMode ? gateRailStage : "document";
    scrollbar.dataset.releaseMode = gateMode ? gateRailReleaseMode : "document";
    scrollbar.style.setProperty("--kisara-scroll-progress", String(progress));
    scrollbar.style.setProperty("--kisara-scroll-thumb-size", `${thumbSize}px`);
    scrollbar.style.setProperty("--kisara-scroll-thumb-y", `${thumbY}px`);
    scrollbar.style.setProperty("--kisara-scroll-marker-y", `${markerY}px`);
    scrollbar.style.setProperty("--kisara-scroll-energy", String(gateMode ? progress : 0));
    scrollbar.style.setProperty("--kisara-scroll-boost", String(gateMode ? gateRailPressure : 0));
    scrollbar.style.setProperty(
      "--kisara-scroll-boost-scale",
      String(1 + (gateMode ? gateRailPressure : 0) * 0.16)
    );
    scrollbar.style.setProperty(
      "--kisara-scroll-boost-glow",
      `${8 + (gateMode ? gateRailPressure : 0) * 20}px`
    );
    scrollbar.style.setProperty(
      "--kisara-scroll-boost-duration",
      `${Math.round(820 - (gateMode ? gateRailPlaybackRate - 1 : 0) * 420)}ms`
    );
    scrollbar.setAttribute("aria-label", gateMode ? "Kisara 契约演出进度" : "页面滚动进度");
    scrollbar.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
    scrollbar.setAttribute(
      "aria-valuetext",
      gateMode
        ? `${gateStageLabels[gateRailStage] ?? "契约演出"} ${Math.round(progress * 100)}%`
        : `页面 ${Math.round(progress * 100)}%`
    );
  };

  const scheduleScrollbarUpdate = () => {
    if (scrollbarFrame) return;
    scrollbarFrame = requestAnimationFrame(updateScrollbar);
  };

  const applyGateRailState = (detail) => {
    if (!detail || typeof detail !== "object") return;
    gateRailActive = Boolean(detail.active);
    gateRailProgress = clamp(Number(detail.progress) || 0, 0, 1);
    gateRailStage = typeof detail.stage === "string" ? detail.stage : "awakening";
    gateRailGuided = Boolean(detail.guided);
    gateRailTransitioning = Boolean(detail.transitioning);
    gateRailPlaybackRate = clamp(Number(detail.playbackRate) || 1, 0.1, 2);
    gateRailPressure = clamp(Number(detail.pressure) || 0, 0, 1);
    gateRailReleaseMode = typeof detail.releaseMode === "string" ? detail.releaseMode : "manual";
    scheduleScrollbarUpdate();
  };

  const syncGateRailFromDom = () => {
    const gateProgressSource = document.querySelector("[data-kisara-gate]");
    if (!(gateProgressSource instanceof HTMLElement)) return;
    applyGateRailState({
      active: gateProgressSource.dataset.kisaraScrollActive === "true",
      progress: gateProgressSource.dataset.kisaraScrollProgress,
      stage: gateProgressSource.dataset.kisaraScrollStage,
      guided: gateProgressSource.dataset.kisaraScrollGuided === "true",
      transitioning: gateProgressSource.dataset.kisaraScrollTransitioning === "true",
      playbackRate: gateProgressSource.dataset.kisaraScrollPlaybackRate,
      pressure: gateProgressSource.dataset.kisaraScrollPressure,
      releaseMode: gateProgressSource.dataset.kisaraScrollReleaseMode
    });
  };

  const isSelectionLocked = () => body.dataset.yuimiSelectionLock === "true";
  if (isSelectionLocked()) {
    document.querySelectorAll("img, video").forEach((asset) => asset.setAttribute("draggable", "false"));
  }

  document.addEventListener("dragstart", (event) => {
    if (!isSelectionLocked()) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("img, picture, canvas, video, svg, .kisara-title, .kisara-gate-visual")) {
      event.preventDefault();
    }
  }, { capture: true, signal });

  document.addEventListener("selectstart", (event) => {
    if (!isSelectionLocked()) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(".kisara-gate, img, picture, canvas, video, svg")) event.preventDefault();
  }, { capture: true, signal });

  window.addEventListener("scroll", scheduleScrollbarUpdate, { passive: true, signal });
  window.addEventListener("resize", scheduleScrollbarUpdate, { passive: true, signal });
  window.addEventListener("kisara:gate-progress", (event) => {
    if (event instanceof CustomEvent) applyGateRailState(event.detail);
  }, { signal });
  window.addEventListener("pageshow", () => {
    syncGateRailFromDom();
    scheduleScrollbarUpdate();
  }, { signal });
  scrollbarResizeObserver = typeof ResizeObserver === "function"
    ? new ResizeObserver(scheduleScrollbarUpdate)
    : null;
  scrollbarResizeObserver?.observe(body);
  syncGateRailFromDom();
  scheduleScrollbarUpdate();

  const closePanel = () => {
    if (panel) panel.hidden = true;
    panelButton?.setAttribute("aria-expanded", "false");
  };

  const setMenuStatus = (label = "", tone = "") => {
    if (!(menuStatus instanceof HTMLElement)) return;
    const text = menuStatus.querySelector("span");
    if (text) text.textContent = label;
    menuStatus.dataset.tone = tone;
  };

  const copyText = async (value) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {}

    try {
      const field = document.createElement("textarea");
      field.value = value;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      body.append(field);
      field.select();
      const copied = document.execCommand("copy");
      field.remove();
      return copied;
    } catch {
      return false;
    }
  };

  const showActionFeedback = (button, label, success) => {
    if (!(button instanceof HTMLButtonElement)) return;
    const text = button.querySelector(":scope > span");
    const defaultLabel = button.dataset.kisaraDefaultLabel ?? text?.textContent ?? "";
    if (text) text.textContent = label;
    button.classList.toggle("is-success", success);
    setMenuStatus(label, success ? "success" : "error");
    window.setTimeout(() => {
      if (text) text.textContent = defaultLabel;
      button.classList.remove("is-success");
      setMenuStatus();
    }, 1100);
  };

  const closeMenu = () => {
    if (!menu || menu.hidden) return;
    const restore = menu.contains(document.activeElement);
    menu.hidden = true;
    setMenuStatus();
    if (restore && returnFocus instanceof HTMLElement) returnFocus.focus({ preventScroll: true });
  };

  const showMenu = (x, y, focusFirst = false) => {
    if (!menu) return;
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : panelButton;
    menu.hidden = false;
    menu.style.left = "0px";
    menu.style.top = "0px";
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    menu.style.left = `${Math.max(12, Math.min(x, window.innerWidth - menuWidth - 12))}px`;
    menu.style.top = `${Math.max(12, Math.min(y, window.innerHeight - menuHeight - 12))}px`;
    setMenuStatus();
    if (focusFirst) menu.querySelector('[data-kisara-action="back"]')?.focus({ preventScroll: true });
  };

  panelButton?.addEventListener("click", () => {
    if (!panel) return;
    const opening = panel.hidden;
    panel.hidden = !opening;
    panelButton.setAttribute("aria-expanded", String(opening));
  }, { signal });
  panelClose?.addEventListener("click", closePanel, { signal });

  window.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    closePanel();
    showMenu(event.clientX, event.clientY);
  }, { signal });
  window.addEventListener("yuimi:context-menu-request", (event) => {
    if (!(event instanceof CustomEvent)) return;
    const x = Number(event.detail?.clientX);
    const y = Number(event.detail?.clientY);
    closePanel();
    showMenu(
      Number.isFinite(x) ? x : window.innerWidth / 2,
      Number.isFinite(y) ? y : window.innerHeight / 2
    );
  }, { signal });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePanel();
      closeMenu();
    }
    if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
      event.preventDefault();
      const rect = document.activeElement?.getBoundingClientRect?.();
      showMenu(
        rect ? rect.left + 24 : window.innerWidth / 2,
        rect ? rect.top + 24 : window.innerHeight / 2,
        true
      );
    }
  }, { signal });

  document.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const themeButton = target?.closest("[data-theme-select]");
    if (themeButton) {
      closePanel();
      closeMenu();
      window.__yuimiTheme?.select(themeButton.dataset.themeSelect);
      return;
    }

    const actionButton = target?.closest("[data-kisara-action]");
    const action = actionButton?.dataset.kisaraAction;
    if (action === "top") window.scrollTo({ top: 0, behavior: "smooth" });
    if (action === "refresh") window.location.reload();
    if (action === "home") {
      const homeLink = document.querySelector("a.kisara-brand[href]");
      if (homeLink instanceof HTMLAnchorElement) homeLink.click();
    }
    if (action === "back") history.back();
    if (action === "forward") history.forward();
    if (action === "close") {
      closeMenu();
      return;
    }
    if (action === "copy") {
      const copied = await copyText(window.location.href);
      showActionFeedback(actionButton, copied ? "链接已复制" : "复制失败", copied);
      return;
    }
    if (action) closeMenu();

    if (!target?.closest("[data-kisara-theme-panel]") && !target?.closest("[data-kisara-theme-button]")) {
      closePanel();
    }
    if (!target?.closest("[data-kisara-context-menu]")) closeMenu();
  }, { signal });

  const cleanup = () => {
    lifecycle.abort();
    if (scrollbarFrame) cancelAnimationFrame(scrollbarFrame);
    scrollbarFrame = 0;
    scrollbarResizeObserver?.disconnect();
    delete body.dataset.kisaraLayoutRuntimeBound;
    if (window.__yuimiKisaraLayoutCleanup === cleanup) {
      window.__yuimiKisaraLayoutCleanup = null;
    }
  };
  window.__yuimiKisaraLayoutCleanup = cleanup;
  document.addEventListener("astro:before-swap", cleanup, { once: true, signal });
};

document.addEventListener("astro:page-load", initKisaraLayoutRuntime);
initKisaraLayoutRuntime();
