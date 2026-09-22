import { bindGamesViewport } from "./gamesViewport.ts";

export function bindGamesPage(page) {
  window.__yuimiKisaraInnerCleanup?.();
  if (!(page instanceof HTMLElement)) return;
  const lifecycle = new AbortController();
  const { signal } = lifecycle;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scenes = [...page.querySelectorAll("[data-game-scene]")];
  const arcade = page.querySelector("[data-kisara-arcade]");
  if (!(arcade instanceof HTMLElement) || scenes.length !== 2) return;
  const selectors = [...arcade.querySelectorAll("[data-game-select]")];
  const panels = [...arcade.querySelectorAll("[data-game-panel]")];
  let frame = arcade.querySelector("[data-game-frame]");
  const menu = arcade.querySelector("[data-game-menu]");
  const session = arcade.querySelector("[data-game-session]");
  const screen = arcade.querySelector("[data-game-screen]");
  const loader = arcade.querySelector("[data-game-loader]");
  const status = arcade.querySelector("[data-game-status]");
  const launchers = [...arcade.querySelectorAll("[data-game-launch]")];
  const ejectors = [...arcade.querySelectorAll("[data-game-eject]")];
  const restart = arcade.querySelector("[data-game-restart]");
  let activeScene = -1;
  let activeGame = 0;
  let loadTimer = 0;
  let animations = [];
  let transitionId = 0;
  let disposed = false;
  const viewport = bindGamesViewport(page);
  const sceneFromHash = () => ["#kisara-arcade-console", "#kisara-arcade-title"].includes(location.hash) ? 1 : 0;

  const stopAnimations = () => {
    animations.forEach(animation => animation.cancel());
    animations = [];
    scenes.forEach(scene => scene.removeAttribute("data-scene-leaving"));
  };
  const clearLoadTimer = () => {
    window.clearTimeout(loadTimer);
    loadTimer = 0;
  };
  const unloadGame = (focus = false) => {
    clearLoadTimer();
    frame.removeAttribute("src");
    frame.hidden = true;
    session.hidden = true;
    menu.hidden = false;
    loader.hidden = true;
    screen.dataset.screenState = "idle";
    launchers.forEach(button => { button.disabled = false; });
    ejectors[0].hidden = true;
    restart.hidden = true;
    status.textContent = "READY";
    arcade.querySelector("[data-game-machine-title]").textContent = "SELECT GAME";
    if (focus) selectors[activeGame]?.focus({ preventScroll: true });
  };
  const activateGame = (index, focus = false) => {
    unloadGame();
    activeGame = (index + selectors.length) % selectors.length;
    const selected = selectors[activeGame];
    arcade.dataset.activeGame = selected.dataset.gameSelect;
    selectors.forEach((button, position) => {
      button.setAttribute("aria-selected", String(position === activeGame));
      button.tabIndex = position === activeGame ? 0 : -1;
    });
    panels.forEach(panel => { panel.hidden = panel.dataset.gamePanel !== selected.dataset.gameSelect; });
    arcade.querySelector("[data-game-counter]").textContent = `${String(activeGame + 1).padStart(2, "0")} / ${String(selectors.length).padStart(2, "0")}`;
    arcade.querySelector("[data-game-external]").href = selected.dataset.gameExternalSrc;
    if (focus) selected.focus({ preventScroll: true });
  };
  const loadGame = () => {
    if (activeScene !== 1 || screen.dataset.screenState === "loading") return;
    clearLoadTimer();
    const selected = selectors[activeGame];
    screen.dataset.screenState = "loading";
    menu.hidden = true;
    session.hidden = false;
    loader.hidden = false;
    arcade.querySelector("[data-game-machine-title]").textContent = selected.dataset.gameName;
    arcade.querySelector("[data-game-load-message]").textContent = "正在连接游戏…";
    launchers.forEach(button => { button.disabled = true; });
    ejectors[0].hidden = false;
    restart.hidden = true;
    status.textContent = "CONNECTING";
    ejectors[0].focus({ preventScroll: true });
    // A fresh browsing context prevents a late load from a previous game winning.
    const nextFrame = frame.cloneNode(false);
    nextFrame.removeAttribute("src");
    nextFrame.title = `${selected.dataset.gameName} 游戏画面`;
    nextFrame.hidden = false;
    nextFrame.addEventListener("load", () => {
      if (disposed || nextFrame !== frame || screen.dataset.screenState !== "loading" || !frame.getAttribute("src")) return;
      clearLoadTimer();
      screen.dataset.screenState = "loaded";
      loader.hidden = true;
      launchers.forEach(button => { button.disabled = false; });
      restart.hidden = false;
      status.textContent = "IN GAME";
      if (document.activeElement === ejectors[0]) frame.focus({ preventScroll: true });
    }, { once: true, signal });
    nextFrame.src = selected.dataset.gameSrc;
    frame.replaceWith(nextFrame);
    frame = nextFrame;
    loadTimer = window.setTimeout(() => {
      loadTimer = 0;
      if (screen.dataset.screenState !== "loading") return;
      status.textContent = "连接较慢";
      arcade.querySelector("[data-game-load-message]").textContent = "仍在连接，可以重试或在新窗口打开";
      restart.hidden = false;
    }, 15000);
  };
  const showScene = (index, { focus = false, instant = false, updateHash = true } = {}) => {
    const target = Math.max(0, Math.min(scenes.length - 1, index));
    if (target === activeScene || page.querySelector("dialog[open]")) return;
    const previous = activeScene;
    const serial = ++transitionId;
    stopAnimations();
    if (previous === 1) unloadGame();
    activeScene = target;
    page.dataset.activeScene = String(target);
    scenes.forEach((scene, position) => {
      scene.hidden = position !== target;
      scene.inert = position !== target;
      scene.dataset.scenePosition = position === target ? "active" : position < target ? "before" : "after";
    });
    viewport.update();
    page.dispatchEvent(new CustomEvent("kisara:game-scene", { detail: { activeScene: target } }));
    page.querySelectorAll("[data-game-scene-jump]").forEach(link => {
      link.setAttribute("aria-current", String(Number(link.dataset.gameSceneJump) === target));
    });
    if (target === 1) {
      const backdrop = arcade.querySelector("[data-arcade-backdrop-src]");
      if (!backdrop.hasAttribute("src")) backdrop.src = backdrop.dataset.arcadeBackdropSrc;
    }
    if (updateHash) history.replaceState(history.state, "", target ? "#kisara-arcade-console" : "#kisara-game-investigation");
    if (previous !== -1) window.scrollTo({ top: 0, behavior: "instant" });
    if (focus) {
      const destination = target === 1 ? selectors[activeGame] : scenes[0].querySelector("[data-game-scene-next]");
      destination?.focus({ preventScroll: true });
    }
    if (instant || reducedMotion.matches || previous === -1 || typeof scenes[target].animate !== "function") return;
    const direction = target > previous ? 1 : -1;
    const outgoing = scenes[previous];
    outgoing.hidden = false;
    outgoing.setAttribute("data-scene-leaving", "");
    const exit = outgoing.animate([
      { opacity: 1, transform: "translateX(0)" },
      { opacity: 0, transform: `translateX(${-direction * 32}px)` }
    ], { duration: 180, easing: "ease-out", fill: "both" });
    const entry = scenes[target].animate([
      { opacity: 0, transform: `translateX(${direction * 48}px)` },
      { opacity: 1, transform: "translateX(0)" }
    ], { duration: 320, easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "both" });
    animations = [exit, entry];
    Promise.all(animations.map(animation => animation.finished)).then(() => {
      if (disposed || serial !== transitionId) return;
      stopAnimations();
      scenes.forEach((scene, position) => { scene.hidden = position !== activeScene; });
    }).catch(() => {});
  };
  page.querySelectorAll("[data-game-scene-next]").forEach(button => {
    button.addEventListener("click", event => showScene(1, { focus: true, instant: event.detail === 0 }), { signal });
  });
  page.querySelectorAll("[data-game-scene-jump]").forEach(link => {
    link.addEventListener("click", event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      showScene(Number(link.dataset.gameSceneJump), { instant: event.detail === 0 });
    }, { signal });
  });
  selectors.forEach((button, index) => {
    button.addEventListener("click", () => activateGame(index), { signal });
    button.addEventListener("keydown", event => {
      const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (delta) { event.preventDefault(); activateGame(activeGame + delta, true); }
      else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        activateGame(event.key === "Home" ? 0 : selectors.length - 1, true);
      }
    }, { signal });
  });
  arcade.querySelector("[data-game-previous]").addEventListener("click", () => activateGame(activeGame - 1), { signal });
  arcade.querySelector("[data-game-next]").addEventListener("click", () => activateGame(activeGame + 1), { signal });
  launchers.forEach(button => button.addEventListener("click", loadGame, { signal }));
  ejectors.forEach(button => button.addEventListener("click", () => unloadGame(true), { signal }));
  restart.addEventListener("click", () => { unloadGame(); loadGame(); }, { signal });
  window.addEventListener("hashchange", () => {
    showScene(sceneFromHash(), { focus: true, instant: true, updateHash: false });
  }, { signal });
  const cleanup = () => {
    disposed = true;
    lifecycle.abort();
    viewport.cleanup();
    stopAnimations();
    unloadGame();
    delete page.dataset.sceneReady;
    scenes.forEach(scene => { scene.hidden = false; scene.inert = false; });
    if (window.__yuimiKisaraInnerCleanup === cleanup) window.__yuimiKisaraInnerCleanup = null;
  };
  window.__yuimiKisaraInnerCleanup = cleanup;
  document.addEventListener("astro:before-swap", cleanup, { once: true, signal });
  page.dataset.sceneReady = "true";
  activateGame(0);
  showScene(sceneFromHash(), { instant: true, updateHash: false });
}
