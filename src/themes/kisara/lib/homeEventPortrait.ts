// Coordinates are measured on the 1920 x 1080 final frame, not the viewport.
export function homePortraitLayout(width: number, height: number) {
  const scale = Math.max(width / 1920, height / 1080) * 1.12;
  const mediaWidth = 1920 * scale, mediaHeight = 1080 * scale;
  const size = Math.min(180, Math.max(112, width * .105));
  const tipX = 750 * scale, tipY = 373 * scale;
  const bubbleWidth = Math.min(width <= 760 ? 316 : 380, width - 40);
  const bubbleHalf = bubbleWidth / 2;
  const desiredTip = width <= 760 ? width * .7 : tipX + (width - mediaWidth) / 2;
  const safeTip = Math.max(bubbleHalf + 20 + size * .46,
    Math.min(width - bubbleHalf - 20 + size * .46, desiredTip));
  const x = Math.max(width - mediaWidth, Math.min(0, safeTip - tipX));
  const y = (height - mediaHeight) / 2;
  return {
    mediaWidth, mediaHeight, x, y, size, bubbleWidth,
    portraitX: tipX + x - size * .46,
    portraitY: tipY + y - size * .12,
  };
}

export function bindHomeEventPortrait(root: HTMLElement) {
  const rig = root.querySelector<HTMLElement>("[data-portrait-rig]");
  const bubble = root.querySelector<HTMLButtonElement>("[data-portrait-bubble]");
  if (!rig || !bubble) return { reveal() {}, setActive(_active: boolean) {}, reset() {}, destroy() {} };
  const knives = [...root.querySelectorAll<HTMLElement>("[data-portrait-knife]")];
  const frames = [...root.querySelectorAll<HTMLElement>("[data-portrait-reaction]")];
  const controller = new AbortController();
  const { signal } = controller;
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let active = false, revealed = false, hovering = false, focused = false;
  let step = 0, frame = 0, timer = 0, due = 0, remaining = 220;
  const layout = () => {
    // CSS variables must use local sizes, not rects already reduced by the theme zoom.
    const box = homePortraitLayout(root.clientWidth, root.clientHeight);
    const values = {
      "board-width": box.mediaWidth, "board-height": box.mediaHeight,
      "board-x": box.x, "board-y": box.y, "portrait-size": box.size,
      "portrait-x": box.portraitX, "portrait-y": box.portraitY,
      "bubble-width": box.bubbleWidth,
    };
    for (const [key, value] of Object.entries(values)) root.style.setProperty(`--${key}`, `${value}px`);
  };
  const stop = () => {
    if (!timer) return;
    remaining = Math.max(0, due - performance.now());
    window.clearTimeout(timer);
    timer = 0;
  };
  const nextFrame = () => {
    frame = (frame + 1) % frames.length;
    frames.forEach((item, index) => { item.hidden = index !== frame; });
  };
  const schedule = () => {
    if (timer || !active || !revealed || motion.matches || signal.aborted) return;
    if (step >= 7 && (hovering || focused)) return;
    due = performance.now() + remaining;
    timer = window.setTimeout(() => {
      timer = 0;
      if (step < 6) {
        const index = Math.floor(step / 2);
        if (step % 2 === 0) knives[index]?.setAttribute("data-landed", "");
        else rig.dataset.impact = String(index + 1);
        remaining = step % 2 === 0 ? 120 : 260;
        step++;
      } else if (step === 6) {
        root.setAttribute("data-bubble-ready", "");
        remaining = 3200;
        step++;
      } else {
        nextFrame();
        remaining = 3200;
      }
      schedule();
    }, remaining);
  };
  const settle = () => {
    stop();
    knives.forEach(knife => knife.setAttribute("data-landed", ""));
    rig.dataset.impact = "3";
    root.setAttribute("data-bubble-ready", "");
    step = 7;
    remaining = 3200;
  };
  const reveal = () => {
    if (revealed || signal.aborted) return;
    revealed = true;
    root.setAttribute("data-portrait-ready", "");
    root.setAttribute("data-bubble-ready", "");
    frames.forEach(item => {
      const image = item.querySelector<HTMLImageElement>("img");
      if (image) image.loading = "eager";
    });
    if (motion.matches) settle();
    else schedule();
  };
  bubble.addEventListener("click", () => {
    if (!revealed) return;
    if (step < 7) { nextFrame(); return; }
    stop();
    nextFrame();
    remaining = 3200;
    schedule();
  }, { signal });
  bubble.addEventListener("pointerenter", () => { hovering = true; if (step >= 7) stop(); }, { signal });
  bubble.addEventListener("pointerleave", () => { hovering = false; schedule(); }, { signal });
  bubble.addEventListener("focus", () => { focused = true; if (step >= 7) stop(); }, { signal });
  bubble.addEventListener("blur", () => { focused = false; schedule(); }, { signal });
  motion.addEventListener("change", () => {
    if (motion.matches && revealed) settle();
    else schedule();
  }, { signal });
  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(layout) : null;
  observer?.observe(root);
  window.addEventListener("resize", layout, { passive: true, signal });
  layout();
  return {
    reveal,
    setActive(value: boolean) { active = value; if (active) schedule(); else stop(); },
    reset() {
      stop();
      revealed = false;
      step = frame = 0;
      remaining = 220;
      root.removeAttribute("data-portrait-ready");
      root.removeAttribute("data-bubble-ready");
      rig.dataset.impact = "0";
      knives.forEach(knife => knife.removeAttribute("data-landed"));
      frames.forEach((item, index) => { item.hidden = index !== 0; });
    },
    destroy() { stop(); controller.abort(); observer?.disconnect(); },
  };
}
