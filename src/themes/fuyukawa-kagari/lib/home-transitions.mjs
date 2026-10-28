const easeOut = "cubic-bezier(.23, 1, .32, 1)";
const easeInOut = "cubic-bezier(.77, 0, .175, 1)";
const lockClass = "is-fuyukawa-transition-locked";

export function mountHomeTransitions(win = window, doc = document) {
  const hero = doc.querySelector("[data-hero-stage]");
  const rail = doc.querySelector("[data-manga-rail]");
  const railStage = rail?.querySelector(".chapter-rail-stage");
  const nextScene = doc.querySelector(".home-content-bg");
  if (!hero || !railStage || !nextScene) return { enterContents() {}, isRunning: () => false, cleanup() {} };
  const reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
  const fine = win.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 761px)");
  const root = doc.documentElement;
  const screen = doc.createElement("div");
  screen.className = "fuyukawa-home-transition";
  screen.setAttribute("aria-hidden", "true");
  screen.hidden = true;
  doc.body.append(screen);
  const animations = new Set();
  const timers = new Map();
  const removers = [];
  let running = false, disposed = false, generation = 0, lockedY = 0;
  let direction = 1, reversePull = 0, reverse = null;
  let previousY = win.scrollY, nativeNavigation = false;
  const listen = (node, type, callback, options) => {
    node.addEventListener(type, callback, options);
    removers.push(() => node.removeEventListener(type, callback, options));
  };
  const allowed = () => !disposed && !reduced.matches && fine.matches && !doc.hidden
    && !root.classList.contains("is-notice-open") && typeof screen.animate === "function";
  const top = element => element.getBoundingClientRect().top + win.scrollY;
  const railStart = () => top(rail);
  const railEnd = () => railStart() + Math.max(0, rail.offsetHeight - railStage.clientHeight);
  const delta = event => event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? win.innerHeight : 1);
  const ignoresWheel = event => event.ctrlKey || event.metaKey || Math.abs(event.deltaX || 0) > Math.abs(event.deltaY)
    || event.target?.closest?.("input, select, textarea, [contenteditable], .toy-dock, [role=dialog]");
  const sceneReady = () => doc.dispatchEvent(new win.Event("fuyukawa:home-scene-ready"));
  const clearAnimations = () => {
    for (const animation of animations) animation.cancel();
    animations.clear();
    for (const [timer, resolve] of timers) { win.clearTimeout(timer); resolve(); }
    timers.clear();
  };
  const finish = (notify = true) => {
    const wasRunning = running;
    running = false;
    clearAnimations();
    screen.hidden = true;
    root.classList.remove(lockClass);
    previousY = win.scrollY;
    if (notify && wasRunning && !disposed && !doc.hidden && !reduced.matches) sceneReady();
  };
  const cancel = () => {
    generation++;
    reverse = null;
    finish();
  };
  const animate = (element, frames, duration, delay = 0, easing = easeOut) => {
    const animation = element.animate(frames, { duration, delay, easing, fill: "both" });
    animations.add(animation);
    return animation;
  };
  const wait = async (animation, duration) => {
    let timer;
    await Promise.race([
      animation.finished.catch(() => {}),
      new Promise(resolve => {
        timer = win.setTimeout(resolve, duration + 100);
        timers.set(timer, resolve);
      }),
    ]);
    win.clearTimeout(timer);
    timers.delete(timer);
  };
  const reveal = (target, kind, travelDirection) => {
    const elements = target === rail
      ? [rail.querySelector(".manga-section-heading"), ...rail.querySelectorAll(".chapter-leaf")]
      : target === hero ? [] : [...nextScene.querySelectorAll(".home-art-word, .home-signal-card, .home-welcome-bubble")];
    return elements.filter(element => element?.animate).map((element, index) => {
      const settled = win.getComputedStyle(element).transform;
      const base = settled === "none" ? "" : settled;
      return animate(element, [
        { opacity: 0, transform: `${base} translate3d(${kind === "wipe" ? travelDirection * 18 : 0}px, ${kind === "fade" ? 14 : 0}px, 0)` },
        { opacity: 1, transform: settled },
      ], 240, index * 50);
    });
  };
  const transition = async (from, target, kind, travelDirection, destination, returnTo) => {
    if (running || !allowed()) return;
    const token = ++generation;
    const duration = kind === "fade" ? 240 : 300;
    direction = travelDirection;
    reversePull = 0;
    reverse = null;
    running = true;
    lockedY = win.scrollY;
    root.classList.add(lockClass);
    // Cancel any native smooth scroll before revealing the covering surface.
    win.scrollTo({ top: lockedY, behavior: "instant" });
    screen.hidden = false;
    const covered = { opacity: 1, clipPath: "inset(0)" };
    const enter = kind === "fade" ? { opacity: 0, clipPath: "inset(0)" }
      : { opacity: 1, clipPath: travelDirection > 0 ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)" };
    const leave = kind === "fade" ? { opacity: 0, clipPath: "inset(0)" }
      : { opacity: 1, clipPath: travelDirection > 0 ? "inset(0 100% 0 0)" : "inset(0 0 0 100%)" };
    try {
      await wait(animate(screen, [enter, covered], duration, 0, kind === "fade" ? easeOut : easeInOut), duration);
      if (disposed || token !== generation) return;
      lockedY = destination();
      win.scrollTo({ top: lockedY, behavior: "instant" });
      const entrances = reveal(target, kind, travelDirection);
      const exitDuration = kind === "fade" ? 240 : 300;
      const exit = animate(screen, [covered, leave], exitDuration, 0, kind === "fade" ? easeOut : easeInOut);
      await Promise.all([
        wait(exit, exitDuration),
        ...entrances.map((animation, index) => wait(animation, 240 + index * 50)),
      ]);
      if (disposed || token !== generation) return;
      const shouldReverse = reverse;
      finish(!shouldReverse);
      if (shouldReverse) transition(target, from, kind, -travelDirection, returnTo, destination);
    } catch {
      if (token === generation) cancel();
    }
  };
  const consume = (event, from, target, kind, travelDirection, destination, returnTo) => {
    event.preventDefault();
    transition(from, target, kind, travelDirection, destination, returnTo);
  };
  const coverRailBoundary = (travelDirection) => {
    const boundary = travelDirection > 0 ? railEnd() : top(nextScene);
    previousY = boundary;
    win.scrollTo({ top: boundary, behavior: "instant" });
    if (travelDirection > 0) transition(rail, nextScene, "wipe", 1, () => top(nextScene), railEnd);
    else transition(nextScene, rail, "wipe", -1, railEnd, () => top(nextScene));
  };
  const enterContents = event => {
    if (!allowed() || running || event.defaultPrevented || ignoresWheel(event) || event.deltaY <= 0
      || win.scrollY > 2 || rail.dataset.railMode !== "scroll") return;
    consume(event, hero, rail, "fade", 1, railStart, () => 0);
  };
  const onWheel = event => {
    if (!allowed() || ignoresWheel(event)) return;
    const movement = delta(event);
    if (!movement) return;
    if (running) {
      event.preventDefault();
      reversePull = movement * direction < 0 ? reversePull + Math.abs(movement) : 0;
      reverse = reversePull >= 36;
      return;
    }
    if (event.defaultPrevented || rail.dataset.railMode !== "scroll"
      || root.classList.contains("is-fuyukawa-hero-locked")) return;
    const start = railStart(), end = railEnd(), next = top(nextScene), y = win.scrollY;
    nativeNavigation = false;
    previousY = y;
    if (y > end + 2 && y < next - 2) {
      event.preventDefault();
      coverRailBoundary(movement > 0 ? 1 : -1);
      return;
    }
    if (movement > 0 && y >= start - 2 && y <= end + 2) {
      if (y >= end - 2) consume(event, rail, nextScene, "wipe", 1, () => top(nextScene), railEnd);
      else if (y + movement > end) { event.preventDefault(); win.scrollTo({ top: end, behavior: "instant" }); }
    } else if (movement < 0 && y >= start - 2 && y <= end + 2) {
      if (y <= start + 2) consume(event, rail, hero, "fade", -1, () => 0, railStart);
      else if (y + movement < start) { event.preventDefault(); win.scrollTo({ top: start, behavior: "instant" }); }
    } else if (movement < 0 && y >= next - 2 && y <= next + 2) {
      consume(event, nextScene, rail, "wipe", -1, railEnd, () => top(nextScene));
    } else if (movement < 0 && y > next && y + movement < next) {
      event.preventDefault();
      win.scrollTo({ top: next, behavior: "instant" });
    }
  };
  const onScroll = () => {
    const y = win.scrollY, before = previousY;
    previousY = y;
    if (running && Math.abs(win.scrollY - lockedY) > 2 && !root.classList.contains("is-notice-open")) {
      previousY = lockedY;
      win.scrollTo({ top: lockedY, behavior: "instant" });
      return;
    }
    if (running || nativeNavigation || !allowed() || rail.dataset.railMode !== "scroll"
      || root.classList.contains("is-fuyukawa-hero-locked")) return;
    const start = railStart(), end = railEnd(), next = top(nextScene);
    // Actual browser displacement can exceed a wheel delta or arrive without a cancelable wheel.
    if (y > end + 2 && ((before <= end + 2 && before >= start - 2) || (y < next - 2 && y >= before))) {
      coverRailBoundary(1);
    } else if (y < next - 2 && y >= start - 2 && ((before >= next - 2) || (y > end + 2 && y < before))) {
      coverRailBoundary(-1);
    }
  };
  const navigate = () => {
    nativeNavigation = true;
    previousY = win.scrollY;
    cancel();
  };
  listen(win, "wheel", onWheel, { passive: false });
  listen(win, "scroll", onScroll, { passive: true });
  listen(win, "resize", cancel, { passive: true });
  listen(win, "pagehide", cancel);
  listen(win, "hashchange", navigate);
  listen(reduced, "change", cancel);
  listen(fine, "change", cancel);
  listen(doc, "visibilitychange", () => { if (doc.hidden) cancel(); });
  listen(doc, "keydown", event => {
    if (["Tab", "Escape", "Home", "End", "PageUp", "PageDown", "ArrowUp", "ArrowDown", " "].includes(event.key)) navigate();
  });
  listen(doc, "click", event => {
    if (event.target?.closest?.("a[href], [data-notice-open]")) navigate();
  }, true);
  listen(doc, "focusin", navigate);
  return {
    enterContents,
    isRunning: () => running,
    cleanup() {
      disposed = true;
      cancel();
      removers.splice(0).forEach(remove => remove());
      screen.remove();
    },
  };
}
