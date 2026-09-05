export function createFrameQueue<T>(paint: (value: T) => void) {
  let frame = 0;
  let pending: { value: T } | null = null;
  const flush = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    const next = pending;
    pending = null;
    if (next) paint(next.value);
  };
  return {
    push(value: T) {
      pending = { value };
      if (!frame) frame = requestAnimationFrame(flush);
    },
    flush,
    cancel() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      pending = null;
    },
  };
}
