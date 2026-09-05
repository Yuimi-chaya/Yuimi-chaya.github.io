import { createComicMotion, settleWithin } from "./comicMotion.ts";

export function bindComicOpening(scene: HTMLElement) {
  const controller = new AbortController();
  const { signal } = controller;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const motion = createComicMotion(signal, reducedMotion);
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const images = Array.from(scene.querySelectorAll<HTMLImageElement>("[data-comic-src]"));
  const nodes = Array.from(scene.querySelectorAll<HTMLElement>("[data-kisara-route-kind]"));
  const branches = Array.from(scene.querySelectorAll<HTMLElement>("[data-kisara-route-branch]"));
  const routeLists = Array.from(scene.querySelectorAll<HTMLElement>("[data-comic-routes]"));
  const observers: IntersectionObserver[] = [];
  let pendingImages: Promise<void> | null = null;
  let generation = 0;
  let entered = false;
  let visible = false;
  scene.classList.add("is-comic-armed");

  const prepare = () => {
    pendingImages ??= Promise.allSettled(images.map(async image => {
      image.src = image.dataset.comicSrc ?? "";
      try { await image.decode(); }
      catch { image.classList.add("is-comic-image-failed"); }
    })).then(() => undefined);
    return pendingImages;
  };
  const cancelEntrance = () => {
    generation++;
    motion.cancel();
    scene.classList.remove("is-comic-entering");
  };
  const activateBranch = (id: string) => {
    branches.forEach(branch => {
      const selected = branch.dataset.kisaraRouteBranch === id;
      branch.classList.toggle("is-active", selected);
      branch.querySelector("a")?.setAttribute("aria-expanded", String(selected));
    });
    routeLists.forEach(list => { list.hidden = list.dataset.comicRoutes !== id; });
  };
  const reset = () => {
    cancelEntrance();
    entered = false;
    scene.classList.add("is-comic-armed");
    activateBranch("home");
    branches.forEach(branch => { delete branch.dataset.routeTapReady; });
  };
  const settle = () => {
    cancelEntrance();
    entered = true;
    scene.classList.remove("is-comic-armed");
  };
  const enter = async () => {
    if (entered || signal.aborted || document.hidden) return;
    entered = true;
    const serial = ++generation;
    await settleWithin(prepare(), 1000, signal);
    if (signal.aborted || serial !== generation) return;
    scene.classList.remove("is-comic-armed");
    if (!reducedMotion) {
      scene.classList.add("is-comic-entering");
      await motion.play(scene);
      if (!signal.aborted && serial === generation) {
        scene.classList.remove("is-comic-entering");
        motion.cancel();
      }
    }
  };
  const refresh = () => {
    const rect = scene.getBoundingClientRect();
    visible = rect.bottom > 0 && rect.top < window.innerHeight;
    if (visible && !document.hidden) void enter();
  };
  branches.forEach(branch => {
    const id = branch.dataset.kisaraRouteBranch ?? "home";
    branch.addEventListener("focusin", () => activateBranch(id), { signal });
    if (finePointer) branch.addEventListener("pointerenter", () => activateBranch(id), { signal });
    else branch.querySelector("a")?.addEventListener("click", event => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (branch.dataset.routeTapReady === "true") return;
      event.preventDefault();
      branches.forEach(candidate => { delete candidate.dataset.routeTapReady; });
      branch.dataset.routeTapReady = "true";
      activateBranch(id);
    }, { signal });
  });
  scene.addEventListener("keydown", event => {
    if (event.key === "Escape") activateBranch("home");
  }, { signal });

  const achieve = (node: HTMLElement | undefined, animate = false) => {
    if (!node || node.classList.contains("is-route-achieved")) return;
    node.classList.add("is-route-achieved");
    if (node.hasAttribute("data-kisara-opening-hint")) node.classList.add("is-hint-achieved");
    if (animate && visible && !reducedMotion) node.classList.add("is-hint-drawing");
  };
  const find = (kind: string, id: string) => nodes.find(node =>
    node.dataset.kisaraRouteKind === kind && node.dataset.kisaraRouteId === id
  );
  nodes.filter(node => node.dataset.kisaraRouteKind === "easter").forEach(node => {
    if (window.__yuimiKisaraEasterLedger?.has(node.dataset.kisaraRouteId ?? "")) achieve(node);
  });
  window.addEventListener("yuimi:kisara-opening-hint-achieved", event => {
    const id = event instanceof CustomEvent ? event.detail?.id : undefined;
    if (typeof id === "string") achieve(find("easter", id), true);
  }, { signal });
  const syncPages = (visited: unknown) => {
    if (Array.isArray(visited)) visited.forEach(id => {
      if (typeof id === "string") achieve(find("page", id));
    });
  };
  syncPages(window.__yuimiKisaraLovebrainProgress?.snapshot?.().visited);
  achieve(find("page", "home"));
  window.addEventListener("yuimi:kisara-lovebrain-progress", event => {
    if (event instanceof CustomEvent) syncPages(event.detail?.visited);
  }, { signal });
  const storageKey = "yuimi-kisara-opening-route-chapters-v1";
  const valid = new Set(["001", "002", "003", "004"]);
  const visited = new Set<string>();
  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    const values = Array.isArray(stored) ? stored : stored?.version === 1 ? stored.visited : [];
    if (Array.isArray(values)) values.forEach(id => { if (valid.has(id)) visited.add(id); });
  } catch { /* Storage can be unavailable in private or restored documents. */ }
  visited.forEach(id => achieve(find("chapter", id)));
  const achieveChapter = (id: string) => {
    if (!valid.has(id)) return;
    visited.add(id);
    achieve(find("chapter", id));
    try { sessionStorage.setItem(storageKey, JSON.stringify({ version: 1, visited: [...visited] })); }
    catch { /* The visible visit state does not depend on storage. */ }
  };
  if ("IntersectionObserver" in window) {
    const preloadObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { void prepare(); preloadObserver.disconnect(); }
    }, { rootMargin: "50% 0px" });
    preloadObserver.observe(scene);
    const sceneObserver = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .2);
      if (visible) void enter();
      else reset();
    }, { threshold: [0, .2] });
    sceneObserver.observe(scene);
    const chapterObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= .24) {
          achieveChapter((entry.target as HTMLElement).dataset.kisaraHomeStop ?? "");
        }
      });
    }, { threshold: [0, .24] });
    document.querySelectorAll<HTMLElement>("[data-kisara-home-stop]").forEach(node => chapterObserver.observe(node));
    observers.push(preloadObserver, sceneObserver, chapterObserver);
  } else { void prepare(); refresh(); achieveChapter("001"); }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelEntrance();
      if (scene.classList.contains("is-comic-armed")) entered = false;
    }
    else refresh();
  }, { signal });
  window.addEventListener("pageshow", refresh, { signal });
  return {
    prepare, enter, reset, refresh, settle,
    destroy() {
      controller.abort(); cancelEntrance();
      observers.forEach(observer => observer.disconnect());
    },
  };
}
