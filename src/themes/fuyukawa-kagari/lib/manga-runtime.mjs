export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function springStep(position, velocity, target, seconds) {
  const dt = clamp(seconds, 0, 1 / 30);
  // Fixed substeps keep the spring stable after a slow frame or interrupted input.
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  for (let i = 0; i < steps; i++) {
    velocity += ((target - position) * 100 - velocity * 10) * dt / steps;
    position += velocity * dt / steps;
  }
  return { position: clamp(position, -1.08, 1.08), velocity };
}

export function layerOffsets(x, y, scroll = 0) {
  return {
    back: { x: -clamp(x, -1.08, 1.08) * 4, y: -clamp(y, -1.08, 1.08) * 3 - clamp(scroll, 0, 1) * 5 },
    front: { x: clamp(x, -1.08, 1.08) * 9, y: clamp(y, -1.08, 1.08) * 6 + clamp(scroll, 0, 1) * 8 }
  };
}

export function mountMangaScene(root, win = window, doc = document) {
  const front = root.querySelector("[data-manga-front]");
  const back = root.querySelector("[data-manga-back]");
  const surface = root.parentElement ?? root;
  if (!front || !back) return () => {};
  const reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
  const pointer = win.matchMedia("(hover: hover) and (pointer: fine)");
  const removers = [];
  let disposed = false, loaded = false, visible = true, raf = 0, last = 0;
  let targetX = 0, targetY = 0, x = 0, y = 0, vx = 0, vy = 0;
  let rect = { left: 0, top: 0, width: 1, height: 1 }, documentTop = 0;
  const listen = (node, event, callback, options) => {
    node.addEventListener(event, callback, options);
    removers.push(() => node.removeEventListener(event, callback, options));
  };
  const allowed = () => loaded && !disposed && visible && !doc.hidden && !reduced.matches && pointer.matches
    && doc.documentElement.dataset.yuimiPerformance !== "lite" && !win.navigator?.connection?.saveData;
  const paint = () => {
    const scroll = clamp((win.scrollY - documentTop) / Math.max(rect.height, 1), 0, 1);
    const offsets = layerOffsets(x, y, scroll);
    for (const [image, offset] of [[front, offsets.front], [back, offsets.back]]) {
      image.style.transform = `translate3d(${offset.x.toFixed(3)}px, ${offset.y.toFixed(3)}px, 0)`;
    }
  };
  const stop = (reset = false) => {
    win.cancelAnimationFrame(raf);
    raf = 0; last = 0;
    if (reset) {
      x = y = vx = vy = targetX = targetY = 0;
      front.style.transform = back.style.transform = "";
    }
  };
  const frame = (now) => {
    raf = 0;
    if (!allowed()) { stop(true); return; }
    const dt = last ? (now - last) / 1000 : 1 / 60;
    last = now;
    ({ position: x, velocity: vx } = springStep(x, vx, targetX, dt));
    ({ position: y, velocity: vy } = springStep(y, vy, targetY, dt));
    paint();
    if (Math.abs(x - targetX) + Math.abs(y - targetY) + Math.abs(vx) + Math.abs(vy) > .002) {
      raf = win.requestAnimationFrame(frame);
    } else {
      x = targetX; y = targetY; vx = vy = 0; last = 0; paint();
    }
  };
  const wake = () => { if (allowed() && !raf) raf = win.requestAnimationFrame(frame); };
  const measure = () => {
    rect = root.getBoundingClientRect();
    documentTop = rect.top + win.scrollY;
    wake();
  };
  const changeMode = () => { if (!allowed()) stop(true); else { measure(); wake(); } };
  listen(surface, "pointermove", (event) => {
    if (!allowed() || event.pointerType === "touch") return;
    targetX = clamp((event.clientX - rect.left) / Math.max(rect.width, 1) * 2 - 1, -1, 1);
    targetY = clamp((event.clientY - (documentTop - win.scrollY)) / Math.max(rect.height, 1) * 2 - 1, -1, 1);
    wake();
  }, { passive: true });
  listen(surface, "pointerleave", () => { targetX = targetY = 0; wake(); });
  listen(win, "scroll", wake, { passive: true });
  listen(win, "resize", measure, { passive: true });
  listen(doc, "visibilitychange", changeMode);
  listen(reduced, "change", changeMode);
  listen(pointer, "change", changeMode);
  listen(win, "pagehide", () => stop(true));
  listen(win, "pageshow", changeMode);
  const observer = win.IntersectionObserver ? new win.IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    changeMode();
  }, { threshold: 0 }) : null;
  observer?.observe(root);
  const decode = (image) => {
    if (typeof image.decode === "function") return image.decode().then(() => {
      if (!image.naturalWidth) throw new Error("Empty image");
    });
    if (image.complete) return image.naturalWidth ? Promise.resolve() : Promise.reject(new Error("Image unavailable"));
    return new Promise((resolve, reject) => {
      listen(image, "load", resolve, { once: true });
      listen(image, "error", reject, { once: true });
    });
  };
  Promise.all([decode(front), decode(back)]).then(() => {
    if (disposed || !root.isConnected) return;
    loaded = true;
    root.dataset.ready = "true";
    measure();
  }).catch(() => {
    if (!disposed) { root.dataset.ready = "false"; stop(true); }
  });
  measure();
  return () => {
    disposed = true;
    stop(true);
    observer?.disconnect();
    removers.splice(0).forEach((remove) => remove());
  };
}

export function nearestRailIndex(offsets, left) {
  return offsets.reduce((best, offset, i) => Math.abs(offset - left) < Math.abs(offsets[best] - left) ? i : best, 0);
}

export function mountChapterRail(root, win = window) {
  const stage = root.querySelector(".chapter-rail-stage");
  const track = root.querySelector("[data-rail-track]");
  const items = [...root.querySelectorAll(".chapter-leaf")];
  const previous = root.querySelector("[data-rail-prev]");
  const next = root.querySelector("[data-rail-next]");
  const position = root.querySelector("[data-rail-position]");
  if (!stage || !track || !items.length || !previous || !next) return () => {};
  const reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
  const fine = win.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 761px)");
  let frame = 0, scrollMode = false, travel = 0, active = -1;
  const offsets = () => items.map((item) => item.offsetLeft - items[0].offsetLeft);
  const top = () => root.getBoundingClientRect().top + win.scrollY;
  const select = (index) => {
    previous.disabled = index === 0;
    next.disabled = index === items.length - 1;
    if (active === index) return;
    active = index;
    items.forEach((item, i) => {
      if (i === index) item.setAttribute("data-rail-active", "true");
      else item.removeAttribute("data-rail-active");
    });
    if (position) position.textContent = `${String(index + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`;
  };
  const update = () => {
    frame = 0;
    const left = scrollMode ? clamp(win.scrollY - top(), 0, travel) : track.scrollLeft;
    if (scrollMode) track.style.transform = `translate3d(${-left.toFixed(1)}px, 0, 0)`;
    select(nearestRailIndex(offsets(), left));
  };
  const schedule = () => { if (!frame) frame = win.requestAnimationFrame(update); };
  const measure = () => {
    const enabled = fine.matches && !reduced.matches && items.length > 1;
    root.dataset.railMode = enabled ? "scroll" : "native";
    scrollMode = enabled;
    if (enabled) {
      travel = Math.max(0, track.scrollWidth - stage.clientWidth);
      if (travel > 2) {
        const runway = `${stage.clientHeight + travel}px`;
        if (root.style.getPropertyValue("--rail-runway") !== runway) root.style.setProperty("--rail-runway", runway);
      } else {
        scrollMode = false;
        root.dataset.railMode = "native";
      }
    }
    track.tabIndex = scrollMode ? -1 : 0;
    if (!scrollMode) {
      root.style.removeProperty("--rail-runway");
      track.style.transform = "";
    }
    update();
  };
  const move = (direction) => {
    const positions = offsets();
    const current = scrollMode ? active : nearestRailIndex(positions, track.scrollLeft);
    const index = clamp(current + direction, 0, items.length - 1);
    if (scrollMode) win.scrollTo({ top: top() + positions[index], behavior: "smooth" });
    else track.scrollTo({ left: positions[index], behavior: reduced.matches ? "auto" : "smooth" });
  };
  const prevClick = () => move(-1), nextClick = () => move(1);
  const focusIn = (event) => {
    const index = items.indexOf(event.target);
    if (index < 0 || !scrollMode) return;
    win.scrollTo({ top: top() + offsets()[index], behavior: "instant" });
    schedule();
  };
  const onScroll = () => { if (scrollMode) schedule(); };
  previous.addEventListener("click", prevClick);
  next.addEventListener("click", nextClick);
  track.addEventListener("focusin", focusIn);
  track.addEventListener("scroll", schedule, { passive: true });
  win.addEventListener("scroll", onScroll, { passive: true });
  win.addEventListener("resize", measure, { passive: true });
  fine.addEventListener("change", measure);
  reduced.addEventListener("change", measure);
  measure();
  return () => {
    win.cancelAnimationFrame(frame);
    delete root.dataset.railMode;
    root.style.removeProperty("--rail-runway");
    track.style.transform = "";
    track.tabIndex = 0;
    previous.removeEventListener("click", prevClick);
    next.removeEventListener("click", nextClick);
    track.removeEventListener("focusin", focusIn);
    track.removeEventListener("scroll", schedule);
    win.removeEventListener("scroll", onScroll);
    win.removeEventListener("resize", measure);
    fine.removeEventListener("change", measure);
    reduced.removeEventListener("change", measure);
  };
}

export function mountAlbum(root) {
  const tabs = [...root.querySelectorAll("[data-album-tab]")];
  const pages = [...root.querySelectorAll("[data-album-page]")];
  const handlers = tabs.map((tab, index) => {
    const choose = () => {
      tabs.forEach((item, i) => item.setAttribute("aria-pressed", String(i === index)));
      pages.forEach((item, i) => { item.hidden = i !== index; });
    };
    tab.addEventListener("click", choose);
    return () => tab.removeEventListener("click", choose);
  });
  return () => handlers.forEach((remove) => remove());
}

export function mountArchive(root) {
  const tabs = [...root.querySelectorAll("[data-archive-category]")];
  const entries = [...root.querySelectorAll("[data-entry-category]")];
  const count = root.querySelector("[data-archive-count]");
  const handlers = tabs.map((tab) => {
    const choose = () => {
      const category = tab.dataset.archiveCategory;
      let visible = 0;
      tabs.forEach((item) => item.setAttribute("aria-pressed", String(item === tab)));
      entries.forEach((entry) => {
        entry.hidden = category !== "all" && entry.dataset.entryCategory !== category;
        if (!entry.hidden) visible++;
      });
      if (count) count.textContent = `${visible} 篇笔记`;
    };
    tab.addEventListener("click", choose);
    return () => tab.removeEventListener("click", choose);
  });
  return () => handlers.forEach((remove) => remove());
}
