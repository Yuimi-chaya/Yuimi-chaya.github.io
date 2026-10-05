type Scene = { id: string; image: string };
type Status = "idle" | "queued" | "decoding" | "ready" | "retrying" | "failed" | "timed-out";
type Record = {
  image: HTMLImageElement;
  source: string;
  status: Status;
  priority: number;
  attempts: number;
  cancel: (() => void) | null;
};

// Normally two requests; at most two slow downloads can linger without blocking the queue.
export function createStoryImageLoader(
  scenes: Scene[],
  signal: AbortSignal,
  onChange: () => void,
) {
  const records = new Map<string, Record>(scenes.map(scene => [scene.id, {
    image: new Image(), source: scene.image, status: "idle", priority: 0, attempts: 0, cancel: null,
  }]));
  let active = 0;
  let outstanding = 0;
  let enabled = true;
  let stopped = false;
  const retries = new Set<ReturnType<typeof setTimeout>>();
  const pump = () => {
    if (stopped || signal.aborted || document.hidden || !enabled) return;
    while (active < 2 && outstanding < 4) {
      const record = [...records.values()].filter(item => item.status === "queued")
        .sort((a, b) => b.priority - a.priority)[0];
      if (!record) break;
      start(record);
    }
  };
  const start = (record: Record) => {
    active++;
    outstanding++;
    record.status = "decoding";
    record.attempts++;
    const image = record.image;
    image.decoding = "async";
    image.fetchPriority = record.priority >= 2 ? "high" : "low";
    let finished = false;
    let released = false;
    let decoding = false;
    const release = () => {
      if (released) return;
      released = true;
      active--;
    };
    const cleanup = () => {
      clearTimeout(timer);
      clearTimeout(deadline);
      image.removeEventListener("load", loaded);
      image.removeEventListener("error", failed);
      record.cancel = null;
    };
    const finish = (ready: boolean, cancelled = false) => {
      if (finished) return;
      finished = true;
      cleanup();
      release();
      outstanding--;
      if (cancelled || stopped || signal.aborted) return;
      record.status = ready ? "ready" : "failed";
      if (!ready && record.attempts < 2) {
        record.status = "retrying";
        // Retry an actual failure once, not a download still in flight.
        const retry = setTimeout(() => {
          retries.delete(retry);
          if (stopped || signal.aborted) return;
          record.image = new Image();
          record.status = "queued";
          pump();
        }, 800);
        retries.add(retry);
      }
      onChange();
      pump();
    };
    const failed = () => finish(false);
    const loaded = () => {
      if (finished || decoding) return;
      if (!image.naturalWidth) { failed(); return; }
      decoding = true;
      // Some engines reject decode() despite a usable loaded bitmap.
      if (typeof image.decode === "function") {
        image.decode().then(() => finish(true), () => finish(image.complete && image.naturalWidth > 0));
      } else finish(true);
    };
    const timer = setTimeout(() => {
      if (finished || stopped || signal.aborted) return;
      if (image.complete && image.naturalWidth > 0) { finish(true); return; }
      // Let the next shot download, but still accept this slow response when it arrives.
      record.status = "timed-out";
      release();
      onChange();
      pump();
    }, 15000);
    const deadline = setTimeout(() => {
      if (finished || stopped || signal.aborted) return;
      if (image.complete && image.naturalWidth > 0) { finish(true); return; }
      // Only a truly hung connection is cancelled and retried, with a bounded budget.
      image.removeAttribute("src");
      finish(false);
    }, 60000);
    record.cancel = () => finish(false, true);
    image.addEventListener("load", loaded);
    image.addEventListener("error", failed);
    image.src = record.source;
    if (image.complete && image.naturalWidth > 0) loaded();
  };
  const request = (scene: Pick<Scene, "id"> | undefined, priority = 1) => {
    const record = scene && records.get(scene.id);
    if (!record || stopped || signal.aborted) return;
    record.priority = Math.max(record.priority, priority);
    if (["decoding", "timed-out"].includes(record.status) && priority >= 2) record.image.fetchPriority = "high";
    if (record.status === "idle") record.status = "queued";
    pump();
  };
  const ready = (scene: Pick<Scene, "id"> | undefined) => {
    const record = scene && records.get(scene.id);
    if (!record) return true;
    request(scene, 2);
    // A missing shot never traps navigation; the compositor keeps the last good plate.
    return ["ready", "failed", "timed-out"].includes(record.status);
  };
  const destroy = () => {
    stopped = true;
    retries.forEach(clearTimeout);
    retries.clear();
    records.forEach(record => record.cancel?.());
    document.removeEventListener("visibilitychange", pump);
  };
  document.addEventListener("visibilitychange", pump);
  signal.addEventListener("abort", destroy, { once: true });
  if (signal.aborted) destroy();
  const setActive = (value: boolean) => {
    enabled = value;
    if (value) pump();
  };
  return { records, request, ready, setActive };
}
