type RequestPriority = "high" | "low" | "auto";

type PriorityRequestInit = RequestInit & {
  priority?: RequestPriority;
};

type IdleDeadlineLike = {
  didTimeout: boolean;
  timeRemaining: () => number;
};

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: (deadline: IdleDeadlineLike) => void,
    options?: { timeout?: number }
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

type ConnectionNavigator = Navigator & {
  deviceMemory?: number;
  connection?: {
    effectiveType?: string;
    saveData?: boolean;
  };
};

type RouteWarmupController = {
  dispose: () => void;
  refresh: () => void;
};

type RouteWarmupEntry = {
  completedAt: number;
  promise: Promise<void>;
};

declare global {
  interface Window {
    __yuimiKisaraRouteWarmup?: RouteWarmupController;
  }
}

const KISARA_ROUTE_PREFIX = "/themes/kisara/";
const ROUTE_WARM_TTL = 45_000;
const MAX_AUTOMATIC_WARMUPS = 2;
const ROUTE_PRIORITY = [
  "/themes/kisara/games/",
  "/themes/kisara/projects/",
  "/themes/kisara/blog/",
  "/themes/kisara/about/"
];
const warmups = new Map<string, RouteWarmupEntry>();
const warmedStylesheets = new Set<string>();

const performanceProfile = () => document.documentElement.dataset.yuimiPerformance ?? "full";

const canWarmRoutes = (automatic = false) => {
  const connection = (navigator as ConnectionNavigator).connection;
  if (!navigator.onLine || connection?.saveData) return false;
  if (connection?.effectiveType && /2g/i.test(connection.effectiveType)) return false;
  if (performanceProfile() === "lite") return false;
  return !automatic || performanceProfile() === "full";
};

const maxConcurrentWarmups = () => performanceProfile() === "full" ? 2 : 1;

const normalizeRoute = (value: string) => {
  try {
    const url = new URL(value, window.location.href);
    url.hash = "";
    if (url.origin !== window.location.origin) return null;
    if (!url.pathname.startsWith(KISARA_ROUTE_PREFIX)) return null;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return null;
    return url.href;
  } catch {
    return null;
  }
};

const lowPriorityFetch = (url: string) => fetch(url, {
  cache: "default",
  credentials: "same-origin",
  priority: "low"
} satisfies PriorityRequestInit);

const warmStylesheets = async (html: string, routeUrl: string) => {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const currentStylesheets = new Set(
    Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'))
      .map((link) => link.href)
  );
  const stylesheetUrls = Array.from(parsed.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]'))
    .map((link) => {
      try {
        return new URL(link.getAttribute("href") ?? "", routeUrl);
      } catch {
        return null;
      }
    })
    .filter((url): url is URL => Boolean(url && url.origin === window.location.origin))
    .map((url) => url.href)
    .filter((url) => !currentStylesheets.has(url) && !warmedStylesheets.has(url));

  await Promise.allSettled(stylesheetUrls.map(async (url) => {
    warmedStylesheets.add(url);
    try {
      await lowPriorityFetch(url);
    } catch {
      warmedStylesheets.delete(url);
    }
  }));
};

const warmRoute = (routeUrl: string) => {
  const existing = warmups.get(routeUrl);
  if (existing && (!existing.completedAt || Date.now() - existing.completedAt < ROUTE_WARM_TTL)) {
    return existing.promise;
  }
  if (existing) warmups.delete(routeUrl);

  const entry: RouteWarmupEntry = {
    completedAt: 0,
    promise: Promise.resolve()
  };
  entry.promise = (async () => {
    const response = await lowPriorityFetch(routeUrl);
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !contentType.includes("text/html")) throw new Error("Route warmup returned a non-HTML response.");
    const html = await response.text();
    await warmStylesheets(html, response.url || routeUrl);
    entry.completedAt = Date.now();
  })().catch(() => {
    warmups.delete(routeUrl);
  });

  warmups.set(routeUrl, entry);
  return entry.promise;
};

export const initKisaraRouteWarmup = () => {
  const existing = window.__yuimiKisaraRouteWarmup;
  if (existing) {
    existing.refresh();
    return;
  }

  const lifecycle = new AbortController();
  const idleWindow = window as IdleWindow;
  const queue: string[] = [];
  const queued = new Set<string>();
  let activeWarmups = 0;
  let idleHandle = 0;
  let fallbackTimer = 0;

  const clearSchedule = () => {
    if (idleHandle && idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(idleHandle);
    if (fallbackTimer) window.clearTimeout(fallbackTimer);
    idleHandle = 0;
    fallbackTimer = 0;
  };

  const schedulePump = () => {
    if (!queue.length || idleHandle || fallbackTimer || !canWarmRoutes()) return;
    const run = () => {
      idleHandle = 0;
      fallbackTimer = 0;
      const concurrency = maxConcurrentWarmups();
      while (activeWarmups < concurrency && queue.length) {
        const routeUrl = queue.shift();
        if (!routeUrl) break;
        queued.delete(routeUrl);
        activeWarmups += 1;
        void warmRoute(routeUrl).finally(() => {
          activeWarmups -= 1;
          schedulePump();
        });
      }
    };

    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(run, { timeout: 1800 });
    } else {
      fallbackTimer = window.setTimeout(run, 500);
    }
  };

  const enqueue = (value: string) => {
    const routeUrl = normalizeRoute(value);
    const existingWarmup = routeUrl ? warmups.get(routeUrl) : null;
    const isFresh = Boolean(
      existingWarmup && (!existingWarmup.completedAt || Date.now() - existingWarmup.completedAt < ROUTE_WARM_TTL)
    );
    if (!routeUrl || isFresh || queued.has(routeUrl)) return;
    queued.add(routeUrl);
    queue.push(routeUrl);
    schedulePump();
  };

  const refresh = () => {
    if (!canWarmRoutes(true)) return;
    const candidates = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('a[data-kisara-route-warmup="load"][href]')
    ).map((link) => link.href);
    candidates.sort((left, right) => {
      const leftPath = new URL(left, window.location.href).pathname;
      const rightPath = new URL(right, window.location.href).pathname;
      const leftPriority = ROUTE_PRIORITY.indexOf(leftPath);
      const rightPriority = ROUTE_PRIORITY.indexOf(rightPath);
      return (leftPriority < 0 ? ROUTE_PRIORITY.length : leftPriority)
        - (rightPriority < 0 ? ROUTE_PRIORITY.length : rightPriority);
    });
    candidates.slice(0, MAX_AUTOMATIC_WARMUPS).forEach(enqueue);
  };

  const warmFromIntent = (event: Event) => {
    if (!canWarmRoutes()) return;
    const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!(target instanceof HTMLAnchorElement)) return;
    const routeUrl = normalizeRoute(target.href);
    if (!routeUrl) return;
    void warmRoute(routeUrl);
  };

  document.addEventListener("astro:page-load", refresh, { signal: lifecycle.signal });
  document.addEventListener("pointerover", warmFromIntent, { passive: true, signal: lifecycle.signal });
  document.addEventListener("focusin", warmFromIntent, { signal: lifecycle.signal });
  document.addEventListener("pointerdown", warmFromIntent, { passive: true, signal: lifecycle.signal });
  window.addEventListener("online", refresh, { signal: lifecycle.signal });

  const controller: RouteWarmupController = {
    refresh,
    dispose: () => {
      clearSchedule();
      lifecycle.abort();
      queue.length = 0;
      queued.clear();
      if (window.__yuimiKisaraRouteWarmup === controller) {
        window.__yuimiKisaraRouteWarmup = undefined;
      }
    }
  };

  window.__yuimiKisaraRouteWarmup = controller;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refresh, { once: true, signal: lifecycle.signal });
  } else {
    refresh();
  }
};
