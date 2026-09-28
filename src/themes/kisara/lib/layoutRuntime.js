import { getKisaraScale } from "./displayScale";
import { getHomeChapterProgress } from "./homeScrollRail";

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
  const scrollFill = scrollbar?.querySelector(".kisara-scrollbar-progress");
  const scrollThumb = scrollbar?.querySelector(".kisara-scrollbar-thumb");
  let returnFocus = null;
  let menuSession = 0;
  let feedbackTimer = 0;
  let scrollbarFrame = 0;
  let scrollbarResizeObserver = null;
  const homeStops = body.classList.contains("kisara-home-page")
    ? [...document.querySelectorAll("[data-kisara-home-stop], .kisara-footer")] : [];
  let homeRailTransitioning = body.dataset.kisaraHomeTransition === "true";
  let scrollbarReady = false;

  const getScrollbarMetrics = () => {
    if (!(scrollbar instanceof HTMLElement)) return null;
    const root = document.scrollingElement ?? document.documentElement;
    const viewportHeight = window.innerHeight;
    const scrollHeight = root.scrollHeight;
    const scrollRange = Math.max(0, scrollHeight - viewportHeight);
    const minimumThumbSize = window.innerWidth <= 600 ? 34 : 46;
    const trackHeight = scrollbar.clientHeight;
    const thumbSize = clamp(trackHeight * (viewportHeight / Math.max(scrollHeight, 1)), minimumThumbSize, 82);
    return { trackHeight, scrollRange, thumbSize };
  };

  const updateScrollbar = () => {
    scrollbarFrame = 0;
    if (!(scrollbar instanceof HTMLElement)) return;
    if (homeRailTransitioning && scrollbarReady) return;
    const metrics = getScrollbarMetrics();
    if (!metrics) return;
    const chapter = getHomeChapterProgress(homeStops.map(stop =>
      Math.min(metrics.scrollRange, Math.round(stop.getBoundingClientRect().top + window.scrollY))
    ), window.scrollY);
    const pageProgress = metrics.scrollRange > 0 ? clamp(window.scrollY / metrics.scrollRange, 0, 1) : 0;
    const progress = homeStops.length ? chapter?.progress ?? 0 : pageProgress;
    const thumbSize = homeStops.length ? 8 : metrics.thumbSize;
    const thumbTravel = Math.max(0, metrics.trackHeight - thumbSize);
    const thumbY = thumbTravel * progress;
    scrollbar.classList.toggle("is-idle", (!homeStops.length && metrics.scrollRange <= 1) || metrics.trackHeight <= 0);
    const fillTransform = "scaleY(" + progress + ")";
    if (scrollFill && scrollFill.style.transform !== fillTransform) {
      scrollbar.dataset.railMotion = String(scrollbarReady && (Boolean(chapter) || scrollbar.dataset.chapter !== "0"));
      scrollFill.style.transform = fillTransform;
    }
    scrollbar.dataset.chapter = String(chapter ? chapter.index + 1 : 0);
    if (homeStops.length) scrollbar.setAttribute("aria-hidden", String(!chapter));
    if (scrollThumb) {
      scrollThumb.style.height = thumbSize + "px";
      scrollThumb.style.transform = "translate3d(0," + thumbY + "px,0)";
    }
    scrollbar.setAttribute("aria-label", homeStops.length ? "Home 导览进度" : "页面滚动进度");
    scrollbar.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
    scrollbar.setAttribute(
      "aria-valuetext",
      chapter ? (chapter.index === homeStops.length - 1 ? "Home 页尾" : "Home 第 " + (chapter.index + 1) + " 章，共 " + (homeStops.length - 1) + " 章") : `页面 ${Math.round(progress * 100)}%`
    );
    scrollbarReady = true;
  };

  const scheduleScrollbarUpdate = () => {
    if (scrollbarFrame) return;
    scrollbarFrame = requestAnimationFrame(updateScrollbar);
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
  window.addEventListener("kisara:home-transition", (event) => {
    if (!(event instanceof CustomEvent)) return;
    if (event.detail?.active && !homeRailTransitioning) {
      if (scrollbarFrame) cancelAnimationFrame(scrollbarFrame);
      updateScrollbar();
    }
    homeRailTransitioning = Boolean(event.detail?.active);
    if (!homeRailTransitioning) scheduleScrollbarUpdate();
  }, { signal });
  window.addEventListener("pageshow", () => {
    scheduleScrollbarUpdate();
  }, { signal });
  scrollbarResizeObserver = typeof ResizeObserver === "function"
    ? new ResizeObserver(scheduleScrollbarUpdate)
    : null;
  scrollbarResizeObserver?.observe(body);
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
      const focus = document.activeElement;
      field.select();
      try { return document.execCommand("copy"); }
      finally { field.remove(); focus?.focus({ preventScroll: true }); }
    } catch {
      return false;
    }
  };

  const showActionFeedback = (label, success) => {
    clearFeedback();
    setMenuStatus(label, success ? "success" : "error");
    feedbackTimer = window.setTimeout(clearFeedback, 1600);
  };

  const clearFeedback = () => {
    window.clearTimeout(feedbackTimer);
    feedbackTimer = 0;
    setMenuStatus();
  };

  const closeMenu = (restoreFocus = true) => {
    if (!menu || menu.hidden) return;
    menuSession++;
    const restore = menu.contains(document.activeElement);
    menu.hidden = true;
    clearFeedback();
    if (restoreFocus && restore && returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
  };

  const showMenu = (x, y, focusFirst = false) => {
    if (!menu) return;
    if (menu.hidden || !menu.contains(document.activeElement)) {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : panelButton;
    }
    menuSession++;
    clearFeedback();
    closePanel();
    menu.hidden = false;
    menu.style.left = "0px";
    menu.style.top = "0px";
    const menuWidth = menu.offsetWidth;
    const menuHeight = menu.offsetHeight;
    const scale = getKisaraScale();
    x /= scale;
    y /= scale;
    const left = Math.max(12, Math.min(x, window.innerWidth / scale - menuWidth - 12));
    const top = Math.max(12, Math.min(y, window.innerHeight / scale - menuHeight - 12));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.setProperty("--menu-origin", `${x > left ? "right" : "left"} ${y > top ? "bottom" : "top"}`);
    if (focusFirst) menu.querySelector('[data-kisara-action="back"]')?.focus({ preventScroll: true });
  };

  const keepNativeMenu = (target) => target instanceof Element
    && Boolean(target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), audio[controls], video[controls]'));
  menu?.addEventListener("keydown", (event) => {
    const items = [...menu.querySelectorAll('button:not(:disabled), a[href]')];
    const index = items.indexOf(document.activeElement);
    let next;
    if (["ArrowDown", "ArrowRight"].includes(event.key)) next = (index + 1) % items.length;
    if (["ArrowUp", "ArrowLeft"].includes(event.key)) next = (index <= 0 ? items.length : index) - 1;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      event.stopPropagation();
      items[next]?.focus({ preventScroll: true });
    }
    if (event.key === "Tab") closeMenu();
  }, { signal });
  menu?.addEventListener("click", event => {
    if (event.target instanceof Element && event.target.closest("a[href]")) closeMenu(false);
  }, { signal });
  window.addEventListener("scroll", event => {
    if (!(event.target instanceof Node) || !menu?.contains(event.target)) closeMenu();
  }, { capture: true, passive: true, signal });
  window.addEventListener("resize", () => closeMenu(), { passive: true, signal });
  window.addEventListener("blur", () => closeMenu(false), { signal });

  panelButton?.addEventListener("click", () => {
    if (!panel) return;
    const opening = panel.hidden;
    panel.hidden = !opening;
    panelButton.setAttribute("aria-expanded", String(opening));
  }, { signal });
  panelClose?.addEventListener("click", closePanel, { signal });

  window.addEventListener("contextmenu", (event) => {
    if (event.shiftKey || keepNativeMenu(event.target) || window.getSelection()?.toString().trim()) {
      closeMenu(false);
      return;
    }
    event.preventDefault();
    showMenu(event.clientX, event.clientY);
  }, { signal });
  window.addEventListener("yuimi:context-menu-request", (event) => {
    if (!(event instanceof CustomEvent)) return;
    const x = Number(event.detail?.clientX);
    const y = Number(event.detail?.clientY);
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
      if (keepNativeMenu(event.target) || window.getSelection()?.toString().trim()) return;
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
    if (action === "back") history.back();
    if (action === "forward") history.forward();
    if (action === "copy" || action === "copy-title") {
      const session = menuSession;
      const copied = await copyText(action === "copy-title" ? document.title : window.location.href);
      if (signal.aborted || menu?.hidden || session !== menuSession) return;
      showActionFeedback(copied ? (action === "copy" ? "页面链接已复制" : "页面标题已复制") : "复制失败，请使用浏览器复制", copied);
      return;
    }
    if (action) closeMenu();

    if (!target?.closest("[data-kisara-theme-panel]") && !target?.closest("[data-kisara-theme-button]")) {
      closePanel();
    }
    if (!target?.closest("[data-kisara-context-menu]")) closeMenu();
  }, { signal });

  const cleanup = () => {
    closeMenu(false);
    clearFeedback();
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

document.addEventListener("astro:after-swap", initKisaraLayoutRuntime);
document.addEventListener("astro:page-load", initKisaraLayoutRuntime);
initKisaraLayoutRuntime();
