export const LIVE2D_POINTER_PROFILE = Object.freeze({
  x: 0.72,
  y: 0.56
});

const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

export function dampenLive2dPointer(event, canvas, profile = LIVE2D_POINTER_PROFILE) {
  if (!canvas?.getBoundingClientRect || !event) return false;
  const rect = canvas.getBoundingClientRect();
  if (!(rect.width > 0) || !(rect.height > 0)) return false;

  const clientX = finite(Number(event.clientX), Number(event.pageX));
  const clientY = finite(Number(event.clientY), Number(event.pageY));
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return false;

  const pageX = finite(Number(event.pageX), clientX);
  const pageY = finite(Number(event.pageY), clientY);
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const nextClientX = centerX + (clientX - centerX) * profile.x;
  const nextClientY = centerY + (clientY - centerY) * profile.y;

  try {
    Object.defineProperties(event, {
      pageX: { configurable: true, value: nextClientX + pageX - clientX },
      pageY: { configurable: true, value: nextClientY + pageY - clientY }
    });
    return true;
  } catch {
    return false;
  }
}

export function mountLive2dPointerGuard(canvas, doc = document) {
  const move = (event) => dampenLive2dPointer(event, canvas);
  doc.addEventListener("mousemove", move, { capture: true, passive: true });
  return () => doc.removeEventListener("mousemove", move, { capture: true });
}

const PARAMETER_SCALE = Object.freeze({
  ParamAngleX: 0.22,
  ParamAngleY: 0.18,
  ParamAngleZ: 0,
  ParamBodyAngleX: 0.28,
  ParamEyeBallX: 0.68,
  ParamEyeBallY: 0.55
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function applyLive2dExpression(core, reaction, now, reducedMotion = false) {
  const ids = core._model?.parameters?.ids;
  if (!ids) return;
  const set = (id, value) => {
    const index = ids.indexOf(id);
    if (index >= 0) core.setParameterValueByIndex(index, value);
  };
  const add = (id, value) => {
    const index = ids.indexOf(id);
    if (index >= 0) core.setParameterValueByIndex(index, core.getParameterValueByIndex(index) + value);
  };
  for (const [id, scale] of Object.entries(PARAMETER_SCALE)) {
    const index = ids.indexOf(id);
    if (index < 0) continue;
    const baseline = core.getParameterDefaultValue(index);
    const current = core.getParameterValueByIndex(index);
    core.setParameterValueByIndex(index, baseline + (current - baseline) * scale);
  }

  const elapsed = now - reaction.startedAt;
  const duration = reaction.kind === "tap" ? 1250 : 1500;
  const expression = elapsed >= 0 && elapsed < duration
    ? Math.min(1, elapsed / 180, (duration - elapsed) / 320)
    : 0;
  const hover = reaction.hover ?? 0;
  const smile = reaction.kind === "tap" || reaction.kind === "idle-smile" ? expression : 0;
  const curious = reaction.kind === "idle-curious" ? expression : 0;
  const eyeSmile = Math.max(hover * 0.65, smile, curious * 0.4);
  add("ParamCheek", hover * 0.3 + smile * 0.65 + curious * 0.25);
  add("ParamMouthForm", -hover * 0.25 - smile * 0.7);
  add("ParamMouthOpenY", smile * 0.25 + curious * 0.18);
  add("ParamBrowLY", smile * 0.18 + curious * 0.38);
  add("ParamBrowRY", smile * 0.18 + curious * 0.38);
  if (eyeSmile > 0) {
    for (const id of ["ParamEyeLSmile", "ParamEyeRSmile"]) {
      const index = ids.indexOf(id);
      if (index < 0) continue;
      const baseline = core.getParameterDefaultValue(index);
      set(id, baseline + (0.05 - baseline) * eyeSmile);
    }
  }
  if (!reducedMotion && expression > 0) {
    const direction = reaction.eyes === "left" ? -1 : 1;
    if (reaction.kind === "tap" || reaction.kind === "idle-curious") {
      add("ParamAngleZ", direction * (reaction.kind === "tap" ? 2 : 1.2) * expression);
      add("ParamHairSide", direction * 0.65 * Math.sin(Math.PI * elapsed / duration) * expression);
    }
  }

  const blink = reaction.kind === "tap" ? expression * 0.96
    : reaction.kind === "idle-blink" && elapsed >= 0 && elapsed < 420
      ? Math.sin(Math.PI * elapsed / 420) * 0.82 : 0;
  if (blink <= 0) return;
  const eyeIds = reaction.eyes === "left" ? ["ParamEyeLOpen"]
    : reaction.eyes === "right" ? ["ParamEyeROpen"]
      : ["ParamEyeLOpen", "ParamEyeROpen"];
  for (const id of eyeIds) {
    const index = ids.indexOf(id);
    if (index < 0) continue;
    const closed = core.getParameterMinimumValue(index);
    const current = core.getParameterValueByIndex(index);
    core.setParameterValueByIndex(index, current + (closed - current) * blink);
  }
}

export function createLive2dReactions(AppDelegate, doc = document, win = window, random = Math.random) {
  let delegate = null;
  let root = null;
  let canvas = null;
  let core = null;
  let originalUpdate = null;
  let idleTimer = 0;
  let modelTimer = 0;
  let press = null;
  let hovering = false;
  let lastFrame = 0;
  let taps = 0;
  const reducedMotion = win.matchMedia?.("(prefers-reduced-motion: reduce)");
  const reaction = { hover: 0, kind: null, startedAt: -Infinity, eyes: "both" };
  const originalRun = AppDelegate.prototype.run;

  const active = () => root && !root.classList.contains("waifu-hidden") && !doc.hidden;
  const scheduleIdle = () => {
    win.clearTimeout(idleTimer);
    if (!active() || reducedMotion?.matches) return;
    idleTimer = win.setTimeout(() => {
      if (active() && !hovering) {
        const variant = Math.floor(random() * 3);
        reaction.kind = ["idle-blink", "idle-smile", "idle-curious"][variant];
        reaction.startedAt = win.performance.now();
        reaction.eyes = "both";
      }
      scheduleIdle();
    }, 9000 + random() * 9000);
  };
  const restoreCore = () => {
    if (core && originalUpdate) core.update = originalUpdate;
    core = null;
    originalUpdate = null;
  };
  const attachCore = () => {
    const next = delegate?.subdelegates?.at(0)?.getLive2DManager()?._models?.at(0)?.getModel();
    if (!next || next === core || !next._model?.parameters?.ids) return;
    restoreCore();
    core = next;
    originalUpdate = next.update;
    next.update = function (...args) {
      if (active()) {
        const now = win.performance.now();
        const dt = clamp(now - lastFrame, 0, 100);
        lastFrame = now;
        reaction.hover += ((hovering ? 1 : 0) - reaction.hover) * Math.min(1, dt / 180);
        applyLive2dExpression(this, reaction, now, reducedMotion?.matches);
      }
      return originalUpdate.apply(this, args);
    };
  };
  const onMove = () => {
    if (!active()) return;
    scheduleIdle();
  };
  const onEnter = (event) => {
    if (event.pointerType && !["mouse", "pen"].includes(event.pointerType)) return;
    hovering = true;
    scheduleIdle();
  };
  const onLeave = () => {
    hovering = false;
    press = null;
    scheduleIdle();
  };
  const onDown = (event) => {
    if (event.button !== 0 || !event.isPrimary) return;
    press = { id: event.pointerId, x: event.clientX, y: event.clientY };
  };
  const onUp = (event) => {
    if (!press || event.pointerId !== press.id) return;
    const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    press = null;
    if (moved > 8 || !active()) return;
    reaction.kind = "tap";
    reaction.startedAt = win.performance.now();
    reaction.eyes = ++taps % 2 ? "right" : "left";
    scheduleIdle();
  };
  const onVisibility = () => {
    if (active()) scheduleIdle();
    else win.clearTimeout(idleTimer);
  };
  const findModel = () => {
    if (!root || !delegate) return;
    attachCore();
    if (!core) modelTimer = win.setTimeout(findModel, 120);
  };
  const onRun = function (...args) {
    delegate = this;
    const result = originalRun.apply(this, args);
    findModel();
    return result;
  };
  AppDelegate.prototype.run = onRun;

  return {
    start(nextRoot, nextCanvas) {
      this.stop();
      root = nextRoot;
      canvas = nextCanvas;
      lastFrame = win.performance.now();
      doc.addEventListener("mousemove", onMove, { passive: true });
      doc.addEventListener("visibilitychange", onVisibility);
      reducedMotion?.addEventListener?.("change", onVisibility);
      canvas?.addEventListener("pointerenter", onEnter);
      canvas?.addEventListener("pointerleave", onLeave);
      canvas?.addEventListener("pointerdown", onDown);
      root?.addEventListener("pointerup", onUp);
      root?.addEventListener("pointercancel", onLeave);
      findModel();
      scheduleIdle();
    },
    stop() {
      win.clearTimeout(idleTimer);
      win.clearTimeout(modelTimer);
      modelTimer = 0;
      doc.removeEventListener("mousemove", onMove);
      doc.removeEventListener("visibilitychange", onVisibility);
      reducedMotion?.removeEventListener?.("change", onVisibility);
      canvas?.removeEventListener("pointerenter", onEnter);
      canvas?.removeEventListener("pointerleave", onLeave);
      canvas?.removeEventListener("pointerdown", onDown);
      root?.removeEventListener("pointerup", onUp);
      root?.removeEventListener("pointercancel", onLeave);
      restoreCore();
      root = null;
      canvas = null;
      press = null;
      hovering = false;
      reaction.hover = 0;
      reaction.kind = null;
      reaction.startedAt = -Infinity;
    },
    destroy() {
      this.stop();
      if (AppDelegate.prototype.run === onRun) AppDelegate.prototype.run = originalRun;
      delegate = null;
    }
  };
}
