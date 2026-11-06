const bindings = new WeakMap();
const noop = { finish() {}, cleanup() {} };

export function bindWorksDetails(root, easingProperty, win = window) {
  bindings.get(root)?.cleanup();
  const grid = root.querySelector("[data-works-disclosure-layout]");
  const records = Array.from(root.querySelectorAll("[data-works-disclosure]")).map((detail) => ({
    detail,
    summary: detail.querySelector("summary"),
    content: detail.querySelector("[data-works-disclosure-content]"),
    inner: detail.querySelector("[data-works-disclosure-inner]"),
    item: detail.closest("[data-works-disclosure-item]"),
    name: detail.getAttribute("name"),
    target: detail.open,
    expectedOpen: detail.open
  }));
  if (!records.length || !grid || typeof grid.animate !== "function" || records.some((record) =>
    !record.summary || !record.inner || !record.item || typeof record.content?.animate !== "function"
  )) return noop;

  const document = root.ownerDocument;
  const motion = win.matchMedia("(prefers-reduced-motion: reduce)");
  const easing = win.getComputedStyle(root).getPropertyValue(easingProperty).trim() || "cubic-bezier(.23, 1, .32, 1)";
  const gridRows = grid.style.gridTemplateRows;
  const originals = new Map(records.map((record) => [record, {
    height: record.content.style.height,
    overflow: record.content.style.overflow,
    inert: record.content.inert,
    expanded: record.summary.getAttribute("aria-expanded"),
    state: record.detail.getAttribute("data-works-expanded")
  }]));
  const bySummary = new Map(records.map((record) => [record.summary, record]));
  let animations = [];
  let generation = 0;
  let resizeFrame = 0;
  let disposed = false;

  const publish = (record, focusTarget = record.summary) => {
    if (!record.target && record.content.contains(document.activeElement)) focusTarget.focus({ preventScroll: true });
    record.content.inert = !record.target;
    record.summary.setAttribute("aria-expanded", String(record.target));
    record.detail.setAttribute("data-works-expanded", String(record.target));
  };

  const cancel = () => {
    generation++;
    const previous = animations;
    animations = [];
    previous.forEach((animation) => animation.cancel());
    if (resizeFrame) win.cancelAnimationFrame(resizeFrame);
    resizeFrame = 0;
  };

  const finish = () => {
    if (disposed) return;
    for (const record of records) {
      if (record.detail.open !== record.expectedOpen) choose(record, record.detail.open && !record.item.hidden);
    }
    cancel();
    for (const record of records) {
      if (record.item.hidden) record.target = false;
      publish(record);
      record.expectedOpen = record.target;
      record.detail.open = record.target;
      const original = originals.get(record);
      record.content.style.height = original.height;
      record.content.style.overflow = original.overflow;
    }
    grid.style.gridTemplateRows = gridRows;
  };

  const choose = (record, open) => {
    if (open && record.name) {
      for (const peer of records) if (peer !== record && peer.name === record.name) peer.target = false;
    }
    record.target = open;
    for (const peer of records) publish(peer, open ? record.summary : peer.summary);
  };

  const measureRows = () => {
    const rows = [];
    for (const { item } of records) {
      if (item.hidden || !item.offsetHeight) continue;
      let row = rows.find((entry) => Math.abs(entry.top - item.offsetTop) <= 1);
      if (!row) rows.push(row = { top: item.offsetTop, height: 0 });
      row.height = Math.max(row.height, item.offsetHeight);
    }
    const natural = rows.sort((a, b) => a.top - b.top).map((row) => row.height);
    const used = String(win.getComputedStyle(grid).gridTemplateRows || "").trim().split(/\s+/);
    return used.length === natural.length && used.every((track) => /^\d+(?:\.\d+)?px$/.test(track))
      ? used.map((track) => Number.parseFloat(track))
      : natural;
  };
  const tracks = (rows) => rows.map((height) => `${height}px`).join(" ");
  const targetHeights = new Map();

  const animate = () => {
    if (disposed) return;
    if (motion.matches || document.hidden) return finish();
    const heights = records.map((record) =>
      record.detail.open && !record.item.hidden ? record.content.offsetHeight : 0
    );
    const before = measureRows();
    cancel();
    const entry = generation;
    grid.style.gridTemplateRows = gridRows;
    records.forEach((record, index) => {
      record.expectedOpen = record.target || heights[index] > 0;
      record.detail.open = record.expectedOpen;
      record.content.style.overflow = "hidden";
      targetHeights.set(record, record.target ? record.inner.offsetHeight : 0);
      record.content.style.height = `${targetHeights.get(record)}px`;
    });
    const after = measureRows();
    const options = { duration: 240, easing, fill: "both" };

    // A row follows its start/end envelope rather than dipping as peers trade places.
    if (before.length && before.length === after.length && tracks(before) !== tracks(after)) {
      grid.style.gridTemplateRows = tracks(before);
      animations.push(grid.animate([
        { gridTemplateRows: tracks(before) },
        { gridTemplateRows: tracks(after) }
      ], options));
    } else if (before.length && before.length === after.length) {
      grid.style.gridTemplateRows = tracks(before);
    }
    records.forEach((record, index) => {
      const end = targetHeights.get(record);
      record.content.style.height = `${heights[index]}px`;
      if (record.item.hidden || Math.abs(end - heights[index]) < 1) return;
      animations.push(record.content.animate([
        { height: `${heights[index]}px` },
        { height: `${end}px` }
      ], options));
    });
    if (!animations.length) return finish();
    const settled = () => {
      if (!disposed && entry === generation) finish();
    };
    Promise.all(animations.map((animation) => animation.finished)).then(settled, settled);
  };

  const onClick = (event) => {
    if (event.defaultPrevented || event.button > 0) return;
    const summary = event.target?.closest?.("summary");
    const record = bySummary.get(summary);
    if (!record || record.item.hidden) return;
    if (event.target.closest("a, button, input, select, textarea, label")) return;
    if (!animations.length) {
      for (const peer of records) peer.target = peer.detail.open && !peer.item.hidden;
    }
    event.preventDefault();
    choose(record, !record.target);
    if (event.detail === 0 || motion.matches || document.hidden) finish();
    else animate();
  };

  const onToggle = (record) => {
    if (record.detail.open === record.expectedOpen) return;
    choose(record, record.detail.open && !record.item.hidden);
    finish();
  };
  const toggles = new Map(records.map((record) => [record, () => onToggle(record)]));
  const onMotion = () => { if (motion.matches) finish(); };
  const onVisibility = () => { if (document.hidden) finish(); };
  const onResize = () => finish();
  const observer = typeof win.ResizeObserver === "function" ? new win.ResizeObserver(() => {
    if (!animations.length || resizeFrame) return;
    if (!records.some((record) => record.target && Math.abs(record.inner.offsetHeight - targetHeights.get(record)) >= 1)) return;
    resizeFrame = win.requestAnimationFrame(() => {
      resizeFrame = 0;
      if (animations.length) animate();
    });
  }) : null;

  records.forEach((record) => {
    record.detail.removeAttribute("name");
    publish(record);
    record.detail.addEventListener("toggle", toggles.get(record));
    observer?.observe(record.inner);
  });
  root.addEventListener("click", onClick);
  motion.addEventListener("change", onMotion);
  document.addEventListener("visibilitychange", onVisibility);
  win.addEventListener("resize", onResize);
  win.addEventListener("pagehide", onResize);

  const cleanup = () => {
    if (disposed) return;
    finish();
    disposed = true;
    observer?.disconnect();
    root.removeEventListener("click", onClick);
    motion.removeEventListener("change", onMotion);
    document.removeEventListener("visibilitychange", onVisibility);
    win.removeEventListener("resize", onResize);
    win.removeEventListener("pagehide", onResize);
    for (const record of records) {
      record.detail.removeEventListener("toggle", toggles.get(record));
      const original = originals.get(record);
      record.content.inert = original.inert;
      if (original.expanded === null) record.summary.removeAttribute("aria-expanded");
      else record.summary.setAttribute("aria-expanded", original.expanded);
      if (original.state === null) record.detail.removeAttribute("data-works-expanded");
      else record.detail.setAttribute("data-works-expanded", original.state);
      if (record.name !== null) record.detail.setAttribute("name", record.name);
    }
    if (bindings.get(root) === controller) bindings.delete(root);
  };
  const controller = { finish, cleanup };
  bindings.set(root, controller);
  return controller;
}
