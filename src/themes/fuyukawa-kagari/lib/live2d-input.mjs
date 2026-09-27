const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smoothstep = (value) => {
  const p = clamp(value, 0, 1);
  return p * p * (3 - 2 * p);
};
const envelope = (elapsed, attack, hold, release) => {
  if (!Number.isFinite(elapsed) || elapsed < 0) return 0;
  if (elapsed < attack) return smoothstep(elapsed / attack);
  if (elapsed < attack + hold) return 1;
  return 1 - smoothstep((elapsed - attack - hold) / release);
};

export function live2dGazeTarget(event, canvas) {
  const rect = canvas?.getBoundingClientRect();
  if (!rect?.width || !rect.height || !Number.isFinite(event?.clientX)
    || !Number.isFinite(event?.clientY)) return { x: 0, y: 0 };
  // The model's face sits left of the canvas center. Using that visual anchor keeps
  // the eyes responsive while the pointer is actually over the character.
  const x = (event.clientX - rect.left - rect.width * 0.36) / Math.max(140, rect.width * 0.56);
  const y = (rect.top + rect.height * 0.2 - event.clientY) / Math.max(120, rect.height * 0.46);
  const length = Math.hypot(x, y);
  const scale = length > 0 ? Math.tanh(length * 1.15) / length : 1;
  return { x: x * scale, y: y * scale };
}

function parameters(model) {
  const ids = model?.getModel?.()?.parameters?.ids;
  if (!ids) return null;
  const set = (id, value) => {
    const i = ids.indexOf(id);
    if (i >= 0) model.setParameterValueByIndex(i, clamp(value,
      model.getParameterMinimumValue(i), model.getParameterMaximumValue(i)));
  };
  const blend = (id, target, amount) => {
    const i = ids.indexOf(id);
    if (i < 0 || amount <= 0) return;
    const current = model.getParameterValueByIndex(i);
    set(id, current + (target - current) * clamp(amount, 0, 1));
  };
  return { set, blend };
}

function applyPose(model, reaction, now, reducedMotion) {
  const p = parameters(model);
  if (!p) return;
  const gaze = reaction.gaze ?? { headX: 0, headY: 0, eyeX: 0, eyeY: 0 };
  const elapsed = now - reaction.startedAt;
  const tap = reaction.kind === "tap";
  const expressive = tap || reaction.kind === "idle-smile" || reaction.kind === "idle-curious";
  const intensity = expressive ? envelope(elapsed, 180, tap ? 450 : 360, 520) : 0;
  const wink = tap ? envelope(elapsed - 60, 100, 260, 260) : 0;
  // Absolute targets avoid accumulating last frame's pose or compounding XY into roll.
  p.set("ParamAngleX", reducedMotion ? 0 : gaze.headX * 8);
  p.set("ParamAngleY", reducedMotion ? 0 : gaze.headY * 5.5);
  p.set("ParamAngleZ", reducedMotion ? 0 : (reaction.eyes === "left" ? -1 : 1) * intensity * 1.2);
  p.set("ParamBodyAngleX", reducedMotion ? 0 : gaze.headX * 0.9);
  p.set("ParamEyeBallX", gaze.eyeX * 0.45 * (1 - wink * 0.65));
  p.set("ParamEyeBallY", gaze.eyeY * 0.34 * (1 - wink * 0.65));
}

export function applyLive2dExpression(model, reaction, now, reducedMotion = false) {
  const p = parameters(model);
  if (!p) return;
  applyPose(model, reaction, now, reducedMotion);
  const { blend } = p;
  const elapsed = now - reaction.startedAt;
  const tap = reaction.kind === "tap";
  const smile = tap || reaction.kind === "idle-smile"
    ? envelope(elapsed, 180, tap ? 450 : 360, 520) : 0;
  const curious = reaction.kind === "idle-curious" ? envelope(elapsed, 220, 320, 500) : 0;
  const hover = reaction.hover ?? 0;
  const wink = tap ? envelope(elapsed - 60, 100, 260, 260) : 0;
  const blink = envelope(now - reaction.blinkAt, 70, 35, 130);
  // Chieri's neutral smile-eye value is 0.5. Preserve the open eye and runtime blink baseline.
  const warmth = Math.max(hover * 0.35, smile * 0.65, curious * 0.18);
  blend("ParamEyeLSmile", 0.2, warmth);
  blend("ParamEyeRSmile", 0.2, warmth);
  blend("ParamMouthForm", -0.6, Math.max(hover * 0.45, smile, curious * 0.15));
  blend("ParamMouthOpenY", 0.42, tap ? envelope(elapsed - 180, 150, 160, 330) : curious * 0.4);
  blend("ParamBrowLY", 0.12, Math.max(smile, curious));
  blend("ParamBrowRY", 0.12, Math.max(smile, curious));
  for (const [side, eye] of [["left", "L"], ["right", "R"]]) {
    const closure = Math.max(blink, reaction.eyes === side ? wink : 0);
    blend("ParamEye" + eye + "Open", 0, closure);
    if (tap && reaction.eyes === side) blend("ParamEye" + eye + "Smile", 0.08, wink);
  }
}

export function createLive2dReactions(AppDelegate, doc = document, win = window, random = Math.random) {
  let delegate = null, root = null, canvas = null, attachedModel = null;
  let restoreModel = () => {}, restoreInput = () => {};
  let modelTimer = 0, idleTimer = 0, press = null, pointer = null, hovering = false;
  let lastFrame = 0, nextBlink = Infinity, taps = 0;
  const reducedMotion = win.matchMedia?.("(prefers-reduced-motion: reduce)");
  const reaction = {
    hover: 0, kind: null, startedAt: -Infinity, blinkAt: -Infinity, eyes: "both",
    gaze: { headX: 0, headY: 0, eyeX: 0, eyeY: 0 }
  };
  const active = () => root && !root.classList.contains("waifu-hidden") && !doc.hidden;
  const scheduleIdle = () => {
    win.clearTimeout(idleTimer);
    if (!active() || reducedMotion?.matches) return;
    idleTimer = win.setTimeout(() => {
      if (active() && !hovering && !press) {
        reaction.kind = random() < 0.65 ? "idle-smile" : "idle-curious";
        reaction.startedAt = win.performance.now();
        reaction.eyes = "both";
      }
      scheduleIdle();
    }, 9000 + random() * 9000);
  };
  const resetAttention = () => {
    pointer = null;
    press = null;
    hovering = false;
  };
  const tick = () => {
    const now = win.performance.now();
    const dt = clamp(now - lastFrame, 0, 100);
    lastFrame = now;
    const target = live2dGazeTarget(press ? null : pointer, canvas);
    for (const [name, axis, ms] of [["headX", "x", 180], ["headY", "y", 210],
      ["eyeX", "x", 72], ["eyeY", "y", 92]]) {
      reaction.gaze[name] += (target[axis] - reaction.gaze[name]) * (1 - Math.exp(-dt / ms));
    }
    reaction.hover += ((hovering && !press?.dragged ? 1 : 0) - reaction.hover) * (1 - Math.exp(-dt / 180));
    if (!reducedMotion?.matches && now >= nextBlink && now - reaction.startedAt > 1500) {
      reaction.blinkAt = now;
      nextBlink = now + 3200 + random() * 2600;
    }
    return now;
  };
  const getModel = () => delegate?.subdelegates?.at(0)?.getLive2DManager()?._models?.at(0);
  const attachModel = () => {
    const outer = getModel();
    const model = outer?.getModel?.();
    // LAppModel -> CubismModel -> Core.Model: only the last object exposes .parameters.
    if (!model?.getModel?.()?.parameters?.ids || outer === attachedModel) return;
    restoreModel();
    attachedModel = outer;
    const originalOuterUpdate = outer.update;
    const originalModelUpdate = model.update;
    const physics = outer._physics;
    const originalPhysics = physics?.evaluate;
    let now = win.performance.now();
    const physicsUpdate = function (...args) {
      if (active()) applyPose(model, reaction, now, reducedMotion?.matches);
      return originalPhysics.apply(this, args);
    };
    // Compose before the sole Core update so drawable flags and rendering stay in SDK order.
    const beforeMesh = function (...args) {
      if (active()) applyLive2dExpression(model, reaction, now, reducedMotion?.matches);
      return originalModelUpdate.apply(this, args);
    };
    const update = function (...args) {
      if (active()) now = tick();
      return originalOuterUpdate.apply(this, args);
    };
    outer.update = update;
    model.update = beforeMesh;
    if (originalPhysics) physics.evaluate = physicsUpdate;
    delegate.subdelegates.at(0).getLive2DManager().onDrag?.(0, 0);
    restoreModel = () => {
      if (outer.update === update) outer.update = originalOuterUpdate;
      if (model.update === beforeMesh) model.update = originalModelUpdate;
      if (originalPhysics && physics.evaluate === physicsUpdate) physics.evaluate = originalPhysics;
      attachedModel = null;
      restoreModel = () => {};
    };
  };
  const findModel = () => {
    win.clearTimeout(modelTimer);
    if (!root || !delegate) return;
    attachModel();
    modelTimer = win.setTimeout(findModel, attachedModel ? 1000 : 120);
  };
  const takeInput = () => {
    restoreInput();
    const owner = delegate;
    const entries = [["mousemove", "mouseMoveEventListener"],
      ["mouseout", "mouseEndedEventListener"], ["pointerdown", "tapEventListener"]]
      .map(([name, key]) => [name, key, owner[key]]);
    for (const [name, , listener] of entries) if (listener) doc.removeEventListener(name, listener);
    restoreInput = () => {
      for (const [name, key, listener] of entries) {
        if (listener && owner[key] === listener) doc.addEventListener(name, listener, { passive: true });
      }
      restoreInput = () => {};
    };
  };
  const originalRun = AppDelegate.prototype.run;
  const onRun = function (...args) {
    delegate = this;
    takeInput();
    findModel();
    return originalRun.apply(this, args);
  };
  AppDelegate.prototype.run = onRun;

  const onMove = (event) => {
    if (!active()) return;
    if (press && event.pointerId === press.id
      && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) press.dragged = true;
    if (!event.pointerType || ["mouse", "pen"].includes(event.pointerType)) {
      pointer = { clientX: event.clientX, clientY: event.clientY };
    }
  };
  const onEnter = (event) => {
    if (event.pointerType === "touch") return;
    hovering = true;
    onMove(event);
  };
  const onLeave = () => { hovering = false; };
  const onOut = (event) => { if (!event.relatedTarget) resetAttention(); };
  const onDown = (event) => {
    if (!active() || event.target !== canvas || event.button !== 0 || !event.isPrimary) return;
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
    scheduleIdle();
  };
  const onUp = (event) => {
    if (!press || event.pointerId !== press.id) return;
    const dragged = press.dragged || Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8;
    press = null;
    if (dragged || !active()) return;
    reaction.kind = "tap";
    reaction.startedAt = win.performance.now();
    reaction.eyes = ++taps % 2 ? "right" : "left";
    scheduleIdle();
  };
  const onVisibility = () => {
    resetAttention();
    if (active()) {
      nextBlink = win.performance.now() + 3200;
      scheduleIdle();
    } else win.clearTimeout(idleTimer);
  };
  return {
    start(nextRoot, nextCanvas) {
      this.stop();
      root = nextRoot;
      canvas = nextCanvas;
      lastFrame = win.performance.now();
      nextBlink = lastFrame + 3200 + random() * 2600;
      doc.addEventListener("pointermove", onMove, { capture: true, passive: true });
      doc.addEventListener("pointerup", onUp, { capture: true });
      doc.addEventListener("pointercancel", resetAttention, { capture: true });
      doc.addEventListener("mouseout", onOut);
      doc.addEventListener("visibilitychange", onVisibility);
      win.addEventListener("blur", resetAttention);
      reducedMotion?.addEventListener?.("change", onVisibility);
      canvas?.addEventListener("pointerenter", onEnter);
      canvas?.addEventListener("pointerleave", onLeave);
      root?.addEventListener("pointerdown", onDown);
      findModel();
      scheduleIdle();
    },
    stop() {
      win.clearTimeout(idleTimer);
      win.clearTimeout(modelTimer);
      doc.removeEventListener("pointermove", onMove, { capture: true });
      doc.removeEventListener("pointerup", onUp, { capture: true });
      doc.removeEventListener("pointercancel", resetAttention, { capture: true });
      doc.removeEventListener("mouseout", onOut);
      doc.removeEventListener("visibilitychange", onVisibility);
      win.removeEventListener("blur", resetAttention);
      reducedMotion?.removeEventListener?.("change", onVisibility);
      canvas?.removeEventListener("pointerenter", onEnter);
      canvas?.removeEventListener("pointerleave", onLeave);
      root?.removeEventListener("pointerdown", onDown);
      restoreModel();
      root = null;
      canvas = null;
      resetAttention();
      reaction.hover = 0;
      reaction.kind = null;
      reaction.startedAt = reaction.blinkAt = -Infinity;
      for (const key of Object.keys(reaction.gaze)) reaction.gaze[key] = 0;
    },
    destroy() {
      this.stop();
      restoreInput();
      if (AppDelegate.prototype.run === onRun) AppDelegate.prototype.run = originalRun;
      delegate = null;
    }
  };
}
