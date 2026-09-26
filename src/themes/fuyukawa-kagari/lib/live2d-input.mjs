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
