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

export function applyLive2dExpression(core, reaction, now) {
  const ids = core._model?.parameters?.ids;
  if (!ids) return;
  for (const [id, scale] of Object.entries(PARAMETER_SCALE)) {
    const index = ids.indexOf(id);
    if (index < 0) continue;
    const baseline = core.getParameterDefaultValue(index);
    const current = core.getParameterValueByIndex(index);
    core.setParameterValueByIndex(index, baseline + (current - baseline) * scale);
  }

  const cheek = ids.indexOf("ParamCheek");
  if (cheek >= 0 && reaction.cheek > 0) {
    core.setParameterValueByIndex(cheek, core.getParameterValueByIndex(cheek) + reaction.cheek);
  }
  const elapsed = now - reaction.blinkAt;
  const blink = elapsed >= 0 && elapsed < 240
    ? Math.sin(Math.PI * elapsed / 240) * reaction.blinkStrength
    : 0;
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

export function createLive2dReactions(AppDelegate, doc = document, win = window) {
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
  const reducedMotion = win.matchMedia?.("(prefers-reduced-motion: reduce)");
  const reaction = { cheek: 0, blinkAt: -Infinity, blinkStrength: 0, eyes: "both" };
  const originalRun = AppDelegate.prototype.run;

  const active = () => root && !root.classList.contains("waifu-hidden")
    && !doc.hidden && !reducedMotion?.matches;
  const scheduleIdle = () => {
    win.clearTimeout(idleTimer);
    if (!active()) return;
    idleTimer = win.setTimeout(() => {
      if (active() && !hovering) {
        const variant = Math.floor(Math.random() * 3);
        reaction.blinkAt = win.performance.now();
        reaction.blinkStrength = variant === 0 ? 0.85 : 0.72;
        reaction.eyes = variant === 1 ? "left" : variant === 2 ? "right" : "both";
        reaction.cheek = variant === 0 ? 0.1 : 0.2;
      }
      scheduleIdle();
    }, 9000 + Math.random() * 9000);
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
        const target = hovering ? 0.16 : 0;
        reaction.cheek += (target - reaction.cheek) * Math.min(1, dt / 180);
        if (now - reaction.blinkAt > 850 && !hovering) reaction.cheek *= 0.88;
        applyLive2dExpression(this, reaction, now);
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
    reaction.blinkAt = win.performance.now();
    reaction.blinkStrength = 0.9;
    reaction.eyes = "right";
    reaction.cheek = 0.32;
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
      reaction.cheek = 0;
      reaction.blinkAt = -Infinity;
    },
    destroy() {
      this.stop();
      if (AppDelegate.prototype.run === onRun) AppDelegate.prototype.run = originalRun;
      delegate = null;
    }
  };
}
