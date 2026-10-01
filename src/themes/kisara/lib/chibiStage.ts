import { createFrameQueue } from "../lib/frameQueue";
import { getKisaraScale } from "./displayScale";
export const initKisaraChibiStage = (root: HTMLElement) => {
  if (!(root instanceof HTMLElement)) return;
  if (root.dataset.kisaraRuntimeBound === "true") return;

  window.__yuimiKisaraChibiCleanup?.();
  root.dataset.kisaraRuntimeBound = "true";

  const lifecycle = new AbortController();
  const nodes = new Map(
    Array.from(root.querySelectorAll("[data-chibi]"))
      .filter((node) => node instanceof HTMLElement)
      .map((node) => [node.dataset.chibi, node])
  );
  const resetButton = root.querySelector("[data-chibi-reset]");
  const liveRegion = root.querySelector("[data-chibi-live]");
  const appleCutscene = root.querySelector("[data-chibi-apple-cutscene]");
  const appleVideo = root.querySelector("[data-chibi-apple-video]");
  const appleFallback = root.querySelector("[data-chibi-apple-fallback]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const embedded = root.classList.contains("is-embedded");
  const homeChapter = embedded ? root.closest('[data-kisara-home-stop="003"]') : null;
  const jealousyBubbleSource = "/themes/kisara/assets/chibi/jealousy-emoji.png";
  const characterOrder = ["kisara", "ayano", "shu", "sharon"];
  const nameMap = { kisara: "木更", ayano: "绫乃", shu: "修", sharon: "莎朗" };
  const soloEmoji = {
    kisara: ["💗✨", "😤💢", "🍬💗", "👀❓"],
    ayano: ["😌☕", "📋✨", "😏🍱", "🙃💭"],
    shu: ["😅💸", "☕😵", "📦❓", "🙂💭"],
    sharon: ["😐☕", "🧐📏", "⏱️👀", "🙏✨"],
  };

  const scenes = {
    "ayano|kisara": [
      [["kisara", "😤💢"], ["ayano", "😏🍱"], ["kisara", "😡🔪💗"]],
      [["ayano", "👀💗"], ["kisara", "🙅‍♀️💥"], ["ayano", "😌☕"]],
      [["kisara", "🧐❓"], ["ayano", "🙂➕🍱"], ["kisara", "😑💢"]],
    ],
    "kisara|shu": [
      [["kisara", "🥰💗✨"], ["shu", "😅💸"], ["kisara", "☕🚫💢"]],
      [["shu", "🙂👍"], ["kisara", "😳💗💗"], ["shu", "😵‍💫✨"]],
      [["kisara", "🏠💗❓"], ["shu", "📋😓"], ["kisara", "😤👉🏠"]],
    ],
    "kisara|sharon": [
      [["sharon", "🧐📏"], ["kisara", "😤🛡️💗"], ["sharon", "😐☕"]],
      [["kisara", "👀🔔❓"], ["sharon", "⏱️😐"], ["kisara", "🍬🤝"]],
      [["sharon", "🙏✨"], ["kisara", "😑💭"], ["sharon", "☕➕🍬"]],
    ],
    "ayano|shu": [
      [["ayano", "📋✍️"], ["shu", "😵❓"], ["ayano", "😏👉"]],
      [["shu", "☕🙂"], ["ayano", "😳↩️😌"], ["shu", "👀❓"]],
      [["ayano", "📞⚡"], ["shu", "😮‍💨💸"], ["ayano", "🚗💨"]],
    ],
    "ayano|sharon": [
      [["ayano", "👀❓"], ["sharon", "👁️👁️"], ["ayano", "😌☕"]],
      [["sharon", "🕯️⚠️"], ["ayano", "🔧✨"], ["sharon", "🙂👍"]],
      [["ayano", "🍵❓"], ["sharon", "🤔➕🍬"], ["ayano", "😏✨"]],
    ],
    "sharon|shu": [
      [["sharon", "🧾🤨"], ["shu", "😐🤏"], ["sharon", "📚👉"]],
      [["shu", "🥪❓"], ["sharon", "🙂🤏"], ["shu", "😮‍💨✨"]],
      [["sharon", "⏱️3️⃣"], ["shu", "😵‍💫💦"], ["sharon", "😐📌"]],
    ],
    "ayano|kisara|shu": [
      [["kisara", "😤👉💗"], ["ayano", "😏↔️"], ["shu", "😵🥤"], ["kisara", "🥤💗🔒"]],
      [["ayano", "🍱✨"], ["kisara", "🍱💢"], ["shu", "😅🙏"], ["ayano", "😌✌️"]],
    ],
    "kisara|sharon|shu": [
      [["sharon", "🚪👀"], ["kisara", "✋💥➡️"], ["shu", "😓❓"], ["sharon", "📌😐"]],
      [["kisara", "🛡️💗"], ["sharon", "📏⚠️"], ["shu", "🙃☕"], ["kisara", "😤✨"]],
    ],
    "ayano|sharon|shu": [
      [["ayano", "📋📋📋"], ["shu", "3️⃣⏱️"], ["sharon", "✂️📄"], ["ayano", "🙂👍"]],
      [["sharon", "🧐📌"], ["ayano", "🔧📋"], ["shu", "😶☕"], ["sharon", "✅✨"]],
    ],
    "ayano|kisara|sharon": [
      [["kisara", "👀❓"], ["ayano", "🙂🔞❌"], ["sharon", "💸🚪"], ["kisara", "😤📚"]],
      [["ayano", "☕🤝"], ["sharon", "🍬👍"], ["kisara", "😑💢"], ["ayano", "😏✨"]],
    ],
    "ayano|kisara|sharon|shu": [
      [["shu", "📦4️⃣🍱❓"], ["ayano", "🙂✨"], ["kisara", "😤💗🏆"], ["sharon", "🧐🔢"], ["shu", "😵❓"], ["kisara", "🥄1️⃣💗"], ["ayano", "🙈🎲"]],
      [["kisara", "💗🍱💥"], ["ayano", "😏🍱✨"], ["sharon", "📋🔍"], ["shu", "😰🙏"], ["kisara", "👑💗"], ["ayano", "🎲👀"], ["sharon", "⏱️▶️"]],
    ],
  };

  const state = new Map();
  const groups = [];
  const timers = new Set();
  const bubbleTimers = new Map();
  let drag = null;
  let sceneToken = 0;
  let layoutFrame = 0;
  let stageVisible = false;
  let stageRect = null;
  const characterSizes = new Map();
  let lastStageSize = { width: 0, height: 0 };
  let lastCompactLayout = null;
  let applePairHits = 0;
  let lastApplePairAt = 0;
  let appleCooldownUntil = 0;
  let appleFallbackToken = 0;
  let appleActive = false;
  let jealousyImagePreload = null;
  let shuJealousyHits = 0;
  let cleaned = false;

  const schedule = (callback, delay) => {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      if (!cleaned && stageVisible && !document.hidden) callback();
    }, delay);
    timers.add(timer);
    return timer;
  };

  const clearTimerSet = () => {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();
    bubbleTimers.forEach((timer) => window.clearTimeout(timer));
    bubbleTimers.clear();
  };

  const randomItem = (items) => items[Math.floor(Math.random() * items.length)];
  const sceneKey = (ids) => [...ids].sort().join("|");

  const dimensions = (id) => {
    return characterSizes.get(id) || { width: 120, height: 180 };
  };

  const measureCharacters = () => {
    nodes.forEach((node, id) => {
      characterSizes.set(id, { width: node.offsetWidth || 120, height: node.offsetHeight || 180 });
    });
    stageRect = null;
  };

  const clampPosition = (id, x, y) => {
    const { width, height } = dimensions(id);
    return {
      x: Math.min(Math.max(8, x), Math.max(8, lastStageSize.width - width - 8)),
      y: Math.min(Math.max(38, y), Math.max(38, lastStageSize.height - height - 24)),
    };
  };

  const setPosition = (id, x, y, animate = false) => {
    const node = nodes.get(id);
    if (!node) return;
    const next = clampPosition(id, x, y);
    state.set(id, next);
    if (animate) {
      node.classList.add("is-snapping");
      schedule(() => node.classList.remove("is-snapping"), 580);
    }
    node.style.setProperty("--chibi-x", `${next.x}px`);
    node.style.setProperty("--chibi-y", `${next.y}px`);
  };

  const centerOf = (id) => {
    const point = state.get(id) || { x: 0, y: 0 };
    const { width, height } = dimensions(id);
    return { x: point.x + width / 2, y: point.y + height / 2 };
  };

  const boundsOf = (ids) => {
    const bounds = ids.reduce((result, id) => {
      const point = state.get(id) || { x: 0, y: 0 };
      const { width, height } = dimensions(id);
      result.left = Math.min(result.left, point.x);
      result.right = Math.max(result.right, point.x + width);
      result.top = Math.min(result.top, point.y);
      result.bottom = Math.max(result.bottom, point.y + height);
      return result;
    }, { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity });

    if (!Number.isFinite(bounds.left)) {
      return {
        left: root.clientWidth / 2,
        right: root.clientWidth / 2,
        top: root.clientHeight / 2,
        bottom: root.clientHeight / 2,
        centerX: root.clientWidth / 2,
        centerY: root.clientHeight / 2,
      };
    }

    return {
      ...bounds,
      centerX: (bounds.left + bounds.right) / 2,
      centerY: (bounds.top + bounds.bottom) / 2,
    };
  };

  const removeFromGroups = (id) => {
    for (let index = groups.length - 1; index >= 0; index -= 1) {
      const remaining = groups[index].filter((member) => member !== id);
      if (remaining.length < 2) groups.splice(index, 1);
      else groups[index] = remaining;
    }
  };

  const groupFor = (id) => groups.find((group) => group.includes(id));

  const animateClass = (node, className, duration = 620) => {
    if (!(node instanceof HTMLElement)) return;
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
    schedule(() => node.classList.remove(className), duration);
  };

  const revealBubble = (id, node, bubble, announcement, duration, animateFigure) => {
    const previousTimer = bubbleTimers.get(id);
    if (previousTimer) window.clearTimeout(previousTimer);
    bubble.setAttribute("aria-hidden", "false");
    bubble.classList.remove("is-visible");
    void bubble.offsetWidth;
    bubble.classList.add("is-visible");
    if (animateFigure) animateClass(node, "is-speaking", 560);
    if (liveRegion) liveRegion.textContent = `${nameMap[id] || id} ${announcement}`;

    const timer = window.setTimeout(() => {
      bubble.classList.remove("is-visible");
      bubble.setAttribute("aria-hidden", "true");
      bubbleTimers.delete(id);
    }, duration);
    bubbleTimers.set(id, timer);
  };

  const setBubble = (id, emoji, duration = 1180, animateFigure = true) => {
    const node = nodes.get(id);
    const bubble = node?.querySelector("[data-chibi-bubble]");
    if (!(node instanceof HTMLElement) || !(bubble instanceof HTMLElement)) return;

    bubble.classList.remove("is-image");
    bubble.textContent = emoji;
    revealBubble(id, node, bubble, emoji, duration, animateFigure);
  };

  const setImageBubble = (id, source, announcement, duration = 2100, onReady = null) => {
    const node = nodes.get(id);
    const bubble = node?.querySelector("[data-chibi-bubble]");
    if (!(node instanceof HTMLElement) || !(bubble instanceof HTMLElement)) return;

    const image = document.createElement("img");
    if (typeof onReady === "function") image.addEventListener("load", onReady, { once: true });
    image.src = source;
    image.alt = "";
    image.width = 694;
    image.height = 531;
    image.decoding = "async";
    image.draggable = false;
    bubble.classList.add("is-image");
    bubble.replaceChildren(image);
    revealBubble(id, node, bubble, announcement, duration, true);
  };

  const preloadJealousyBubble = () => {
    if (jealousyImagePreload instanceof Image) return;
    jealousyImagePreload = new Image();
    jealousyImagePreload.decoding = "async";
    jealousyImagePreload.src = jealousyBubbleSource;
  };

  const loadAppleVideo = () => {
    if (!(appleVideo instanceof HTMLVideoElement)) return false;
    const source = appleVideo.dataset.src;
    if (!source || !appleVideo.canPlayType('video/webm; codecs="vp9"')) return false;
    if (!appleVideo.getAttribute("src")) {
      appleVideo.preload = "auto";
      appleVideo.src = source;
      appleVideo.load();
    }
    return true;
  };

  const startAppleMedia = async () => {
    if (!(appleCutscene instanceof HTMLElement)) return false;
    const token = sceneToken;

    if (loadAppleVideo() && appleVideo instanceof HTMLVideoElement) {
      try {
        appleVideo.pause();
        if (appleVideo.readyState > 0) appleVideo.currentTime = 0;
        appleVideo.playbackRate = 0.82;
        appleCutscene.dataset.renderer = "video";
        await appleVideo.play();
        if (cleaned || token !== sceneToken || !stageVisible || document.hidden) {
          if (!appleActive) appleVideo.pause();
          return false;
        }
        return true;
      } catch {
        if (cleaned || token !== sceneToken || !stageVisible || document.hidden) return false;
        appleVideo.pause();
      }
    }

    if (!(appleFallback instanceof HTMLImageElement) || !appleFallback.dataset.src) return false;
    appleFallbackToken += 1;
    appleFallback.src = `${appleFallback.dataset.src}#play-${appleFallbackToken}`;
    appleCutscene.dataset.renderer = "fallback";
    try {
      await appleFallback.decode();
    } catch {
      // The first animated frame can still render even when decode() is unavailable.
    }
    return !cleaned && token === sceneToken && stageVisible && !document.hidden;
  };

  const configureAppleScene = () => {
    if (!(appleCutscene instanceof HTMLElement)) return 1;
    const kisaraCenter = centerOf("kisara");
    const ayanoCenter = centerOf("ayano");
    const direction = ayanoCenter.x >= kisaraCenter.x ? 1 : -1;
    const midpointX = (kisaraCenter.x + ayanoCenter.x) / 2;
    const midpointY = (kisaraCenter.y + ayanoCenter.y) / 2;
    const compactMinimum = Math.min(414, root.clientWidth * 1.08);
    const mediaWidth = Math.min(830, Math.max(compactMinimum, root.clientWidth * 0.7));
    const mediaHeight = mediaWidth * 540 / 740;
    const clampMediaCenter = (value, size, available) => {
      const margin = size / 2 + 6;
      if (margin * 2 >= available) return available / 2;
      return Math.min(Math.max(margin, value), available - margin);
    };
    const cutinX = clampMediaCenter(midpointX, mediaWidth, root.clientWidth);
    const cutinY = clampMediaCenter(midpointY - 12, mediaHeight, root.clientHeight);
    const impactX = Math.min(Math.max(46, ayanoCenter.x), root.clientWidth - 46);
    const impactY = Math.min(Math.max(70, ayanoCenter.y), root.clientHeight - 54);

    appleCutscene.style.setProperty("--apple-x", `${cutinX}px`);
    appleCutscene.style.setProperty("--apple-y", `${cutinY}px`);
    appleCutscene.style.setProperty("--apple-media-width", `${mediaWidth}px`);
    appleCutscene.style.setProperty("--apple-direction", `${direction}`);
    appleCutscene.style.setProperty("--apple-entry-x", `${direction > 0 ? -42 : 42}px`);
    appleCutscene.style.setProperty("--apple-exit-x", `${direction > 0 ? 24 : -24}px`);
    appleCutscene.style.setProperty("--apple-impact-x", `${impactX}px`);
    appleCutscene.style.setProperty("--apple-impact-y", `${impactY}px`);

    root.style.setProperty("--apple-throw-wind", direction > 0 ? "-5deg" : "5deg");
    root.style.setProperty("--apple-throw-release", direction > 0 ? "7deg" : "-7deg");
    root.style.setProperty("--apple-throw-settle", direction > 0 ? "-2deg" : "2deg");
    root.style.setProperty("--apple-hit-far", `${direction * 13}px`);
    root.style.setProperty("--apple-hit-return", `${direction * -5}px`);
    root.style.setProperty("--apple-hit-settle", `${direction * 3}px`);
    root.style.setProperty("--apple-hit-tilt", `${direction * 7}deg`);
    root.style.setProperty("--apple-hit-return-tilt", `${direction * -4}deg`);
    root.style.setProperty("--apple-hit-settle-tilt", `${direction * 2}deg`);
    return direction;
  };

  const clearAppleScene = () => {
    appleActive = false;
    root.removeAttribute("data-apple-playing");
    root.classList.remove("is-apple-impact");
    appleCutscene?.classList.remove("is-active");
    appleCutscene?.removeAttribute("data-renderer");
    nodes.forEach((node) => node.classList.remove("is-apple-focus", "is-apple-throw", "is-apple-hit"));
    if (appleVideo instanceof HTMLVideoElement) {
      appleVideo.pause();
    }
    appleFallback?.removeAttribute("src");
  };

  const cancelScene = (hideBubbles = true) => {
    sceneToken += 1;
    if (appleActive) clearAppleScene();
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();
    if (!hideBubbles) return;
    bubbleTimers.forEach((timer) => window.clearTimeout(timer));
    bubbleTimers.clear();
    nodes.forEach((node) => {
      node.classList.remove("is-speaking", "is-dropped", "is-snapping");
      const bubble = node.querySelector("[data-chibi-bubble]");
      bubble?.classList.remove("is-visible", "is-image");
      bubble?.setAttribute("aria-hidden", "true");
    });
  };

  const playSolo = (id) => {
    cancelScene();
    setBubble(id, randomItem(soloEmoji[id] || ["✨"]));
  };

  const playScene = (ids) => {
    cancelScene();
    const key = sceneKey(ids);
    const variants = scenes[key];
    if (!variants?.length) {
      ids.forEach((id, index) => schedule(() => setBubble(id, randomItem(soloEmoji[id])), index * 220));
      return;
    }

    const token = sceneToken;
    const beats = randomItem(variants);
    root.style.setProperty("--scene-accent", key.includes("kisara") ? "255, 91, 126" : key.includes("sharon") ? "145, 132, 255" : "112, 164, 255");
    beats.forEach(([speaker, emoji], index) => {
      schedule(() => {
        if (token !== sceneToken) return;
        setBubble(speaker, emoji, index === beats.length - 1 ? 1450 : 1120);
      }, 160 + index * 610);
    });
  };

  const playApplePrelude = () => {
    cancelScene();
    if (!reducedMotion.matches) loadAppleVideo();
    const token = sceneToken;
    const beats = [["kisara", "😤💢"], ["ayano", "😏🍎"], ["kisara", "👀🍎❓"]];
    root.style.setProperty("--scene-accent", "255, 91, 126");
    beats.forEach(([speaker, emoji], index) => {
      schedule(() => {
        if (token !== sceneToken) return;
        setBubble(speaker, emoji, index === beats.length - 1 ? 1380 : 1040);
      }, 120 + index * 520);
    });
  };

  const playJealousyScene = () => {
    cancelScene();
    const token = sceneToken;
    root.style.setProperty("--scene-accent", "255, 73, 117");
    schedule(() => {
      if (token !== sceneToken) return;
      setImageBubble("kisara", jealousyBubbleSource, "你又在想着别的女人了对吧", 2200, () => {
        if (token === sceneToken) window.__yuimiKisaraEasterLedger?.mark("chibi-jealousy");
      });
    }, 100);
    schedule(() => {
      if (token !== sceneToken) return;
      setBubble("shu", "😰", 1480);
    }, 920);
  };

  const playAppleScene = () => {
    cancelScene();
    const token = sceneToken;
    appleActive = true;
    configureAppleScene();
    const kisaraNode = nodes.get("kisara");
    const ayanoNode = nodes.get("ayano");

    root.dataset.applePlaying = "true";
    root.style.setProperty("--scene-accent", "255, 73, 105");
    kisaraNode?.classList.add("is-apple-focus");
    ayanoNode?.classList.add("is-apple-focus");
    setBubble("kisara", "😡🍎", 760, false);
    schedule(() => {
      if (token !== sceneToken) return;
      setBubble("ayano", "😳❗", 720, false);
    }, 120);

    const playImpact = () => {
      if (token !== sceneToken || !appleActive) return;
      root.classList.remove("is-apple-impact");
      void root.offsetWidth;
      root.classList.add("is-apple-impact");
      animateClass(ayanoNode, "is-apple-hit", 700);
      setBubble("ayano", "🍎💫😵‍💫", 1420, false);
      schedule(() => {
        if (token !== sceneToken) return;
        setBubble("kisara", "😤💢", 1240, false);
      }, 210);
    };

    if (reducedMotion.matches) {
      window.__yuimiKisaraEasterLedger?.mark("chibi-apple");
      animateClass(kisaraNode, "is-apple-throw", 1);
      schedule(playImpact, 180);
      schedule(() => {
        if (token === sceneToken) clearAppleScene();
      }, 900);
      return;
    }

    schedule(async () => {
      const mediaReady = await startAppleMedia();
      if (token !== sceneToken || !appleActive) return;

      if (mediaReady && appleCutscene instanceof HTMLElement) {
        window.__yuimiKisaraEasterLedger?.mark("chibi-apple");
        appleCutscene.classList.remove("is-active");
        void appleCutscene.offsetWidth;
        appleCutscene.classList.add("is-active");
      }

      animateClass(kisaraNode, "is-apple-throw", 760);
      schedule(playImpact, mediaReady ? 430 : 220);
      schedule(() => appleCutscene?.classList.remove("is-active"), mediaReady ? 900 : 520);
      schedule(() => {
        if (token !== sceneToken) return;
        clearAppleScene();
        root.style.setProperty("--scene-accent", "255, 91, 126");
      }, mediaReady ? 1320 : 920);
    }, 180);
  };

  const appleInteractionMode = (actorId, ids) => {
    const isApplePair = actorId === "kisara" && sceneKey(ids) === "ayano|kisara";
    if (!isApplePair) {
      if (actorId === "kisara") applePairHits = 0;
      return "normal";
    }

    const now = performance.now();
    if (now < appleCooldownUntil) return "normal";
    if (now - lastApplePairAt > 9000) applePairHits = 0;
    lastApplePairAt = now;
    applePairHits += 1;

    if (applePairHits < 2) return "prelude";
    applePairHits = 0;
    appleCooldownUntil = now + 12000;
    return "cutscene";
  };

  const jealousyInteractionMode = (ids) => {
    const members = new Set(ids);
    const hasShu = members.has("shu");
    const hasKisara = members.has("kisara");
    const hasOtherWoman = members.has("ayano") || members.has("sharon");

    if (shuJealousyHits >= 2) {
      shuJealousyHits = 0;
      return hasShu && hasKisara ? "cutscene" : "normal";
    }

    if (hasShu && hasOtherWoman && !hasKisara) {
      shuJealousyHits += 1;
      preloadJealousyBubble();
    }
    return "normal";
  };

  const initialLayout = (animate = false) => {
    cancelScene();
    groups.splice(0, groups.length);
    const width = root.clientWidth;
    const height = root.clientHeight;
    lastStageSize = { width, height };
    measureCharacters();
    const compact = !embedded && width < 620;
    lastCompactLayout = compact;

    if (compact) {
      const placements = {
      kisara: [0.08, 0.28],
      ayano: [0.58, 0.28],
      shu: [0.12, 0.64],
      sharon: [0.55, 0.64],
      };
      characterOrder.forEach((id) => {
        const { width: itemWidth } = dimensions(id);
        const [ratioX, ratioY] = placements[id];
        setPosition(id, Math.min(width - itemWidth - 10, width * ratioX), height * ratioY, animate);
      });
    } else {
      const ratios = embedded
        ? { kisara: 0.015, ayano: 0.265, shu: 0.505, sharon: 0.745 }
        : { kisara: 0.06, ayano: 0.31, shu: 0.58, sharon: 0.79 };
      characterOrder.forEach((id, index) => {
        const { height: itemHeight } = dimensions(id);
        const y = height - itemHeight - (index % 2 ? 42 : 34);
        setPosition(id, width * ratios[id], y, animate);
      });
    }

    root.style.setProperty("--scene-accent", "255, 91, 126");
    root.dataset.ready = "true";
    revealArrival();
    lastStageSize = { width, height };
  };

  const layoutGroup = (ids, placement) => {
    const ordered = [...new Set(ids)].filter((id) => nodes.has(id));
    const items = ordered.map((id) => ({ id, ...dimensions(id) }));
    const stageWidth = root.clientWidth;
    const stageHeight = root.clientHeight;
    const maxWidth = Math.max(...items.map((item) => item.width));
    const maxHeight = Math.max(...items.map((item) => item.height));
    const anchor = placement.anchor;
    const useGrid = !embedded && (
      (stageWidth < 660 && items.length >= 3) ||
      (stageWidth < 760 && items.length >= 4));

    if (!useGrid) {
      const gap = embedded ? Math.max(2, Math.min(14,
        (stageWidth - 24 - items.reduce((sum, item) => sum + item.width, 0)) / Math.max(1, items.length - 1))) : 14;
      const totalWidth = items.reduce((sum, item) => sum + item.width, 0) + gap * (items.length - 1);
      const preferredStartX = Number.isFinite(placement.startX)
        ? placement.startX
        : anchor.x - totalWidth / 2;
      const startX = Math.min(
        Math.max(12, preferredStartX),
        Math.max(12, stageWidth - totalWidth - 12)
      );
      const preferredBaseline = Number.isFinite(placement.baseline)
        ? placement.baseline
        : anchor.y + maxHeight * 0.47;
      const baseline = Math.min(
        Math.max(maxHeight + 54, preferredBaseline),
        stageHeight - 30
      );
      let cursor = startX;
      items.forEach((item, index) => {
        setPosition(item.id, cursor, baseline - item.height + (index % 2 ? 3 : 0), true);
        cursor += item.width + gap;
      });
      return;
    }

    const columns = 2;
    const cellWidth = Math.min(maxWidth + 15, (stageWidth - 34) / columns);
    const rowGap = Math.max(102, maxHeight * 0.63);
    const rows = Math.ceil(items.length / columns);
    const totalWidth = cellWidth * columns;
    const startX = Math.min(Math.max(12, anchor.x - totalWidth / 2), Math.max(12, stageWidth - totalWidth - 12));
    const blockHeight = maxHeight + rowGap * (rows - 1);
    const startY = Math.min(Math.max(48, anchor.y - blockHeight / 2), Math.max(48, stageHeight - blockHeight - 26));

    items.forEach((item, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const rowCount = Math.min(columns, items.length - row * columns);
      const rowOffset = rowCount === 1 ? cellWidth / 2 : 0;
      setPosition(
        item.id,
        startX + column * cellWidth + rowOffset + (cellWidth - item.width) / 2,
        startY + row * rowGap + (maxHeight - item.height),
        true
      );
    });
  };

  const nearestTarget = (actorId) => {
    const actorCenter = centerOf(actorId);
    const actorSize = dimensions(actorId);
    let winner = null;

    nodes.forEach((node, id) => {
      if (id === actorId) return;
      const targetCenter = centerOf(id);
      const targetSize = dimensions(id);
      const distance = Math.hypot(actorCenter.x - targetCenter.x, actorCenter.y - targetCenter.y);
      const threshold = Math.min(210, (actorSize.width + targetSize.width) * 0.72);
      if (distance <= threshold && (!winner || distance < winner.distance)) {
        winner = { id, distance, center: targetCenter };
      }
    });
    return winner;
  };

  const settleCharacter = (id) => {
    const node = nodes.get(id);
    if (!node) return;
    animateClass(node, "is-dropped", 620);
    const target = nearestTarget(id);
    if (!target) {
      if (id === "kisara") applePairHits = 0;
      playSolo(id);
      return;
    }

    const existing = groupFor(target.id) || [target.id];
    const existingBounds = boundsOf(existing);
    const actorCenter = centerOf(id);
    const horizontalDelta = actorCenter.x - existingBounds.centerX;
    const leftRoom = existingBounds.left - 12;
    const rightRoom = root.clientWidth - existingBounds.right - 12;
    const placeOnLeft = Math.abs(horizontalDelta) < 12
      ? leftRoom > rightRoom
      : horizontalDelta < 0;
    const members = placeOnLeft ? [id, ...existing] : [...existing, id];
    const preferredStartX = placeOnLeft
      ? existingBounds.left - dimensions(id).width - 14
      : existingBounds.left;
    groups.splice(0, groups.length, ...groups.filter((group) => !group.some((member) => members.includes(member))));
    groups.push(members);
    layoutGroup(members, {
      anchor: {
        x: existingBounds.centerX,
        y: existingBounds.centerY,
      },
      startX: preferredStartX,
      baseline: existingBounds.bottom,
    });
    const appleMode = appleInteractionMode(id, members);
    const jealousyMode = jealousyInteractionMode(members);
    schedule(() => {
      if (jealousyMode === "cutscene") playJealousyScene();
      else if (appleMode === "cutscene") playAppleScene();
      else if (appleMode === "prelude") playApplePrelude();
      else playScene(members);
    }, 360);
  };

  const beginDrag = (event, id) => {
    if (event.button !== 0 && event.pointerType !== "touch") return;
    if (drag || document.hidden) return;
    const node = nodes.get(id);
    if (!node) return;
    event.preventDefault();
    cancelScene();
    removeFromGroups(id);
    const rect = node.getBoundingClientRect();
    stageRect = root.getBoundingClientRect();
    drag = {
      id,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      lastX: event.clientX,
      moved: false,
    };
    node.setPointerCapture?.(event.pointerId);
    node.classList.remove("is-snapping", "is-dropped");
    node.classList.add("is-dragging");
    root.dataset.dragging = "true";
  };

  const dragFrame = createFrameQueue<{ id: string; x: number; y: number; tilt: number }>(({ id, x, y, tilt }) => {
    if (!drag || drag.id !== id) return;
    nodes.get(id)?.style.setProperty("--drag-tilt", `${tilt}deg`);
    setPosition(id, x, y);
  });

  const moveDrag = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    stageRect ??= root.getBoundingClientRect();
    const nextX = (event.clientX - stageRect.left - drag.offsetX) / getKisaraScale();
    const nextY = (event.clientY - stageRect.top - drag.offsetY) / getKisaraScale();
    const deltaX = event.clientX - drag.lastX;
    drag.lastX = event.clientX;
    drag.moved ||= Math.abs(deltaX) > 2 || Math.abs(event.movementY || 0) > 2;
    dragFrame.push({ id: drag.id, x: nextX, y: nextY, tilt: Math.max(-7, Math.min(7, deltaX * 0.55)) });
  };

  const endDrag = (event, cancelled = false) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (cancelled) dragFrame.cancel();
    else dragFrame.flush();
    const current = drag;
    drag = null;
    const node = nodes.get(current.id);
    if (node?.hasPointerCapture?.(event.pointerId)) node.releasePointerCapture(event.pointerId);
    node?.classList.remove("is-dragging");
    node?.style.setProperty("--drag-tilt", "0deg");
    root.removeAttribute("data-dragging");
    if (!cancelled) settleCharacter(current.id);
  };

  nodes.forEach((node, id) => {
    const settleArrival = () => {
      root.setAttribute("data-entered", "");
      node.setAttribute("data-arrival-settled", "");
    };
    if (embedded) {
      node.addEventListener("focusin", settleArrival, { signal: lifecycle.signal });
      node.addEventListener("pointerdown", settleArrival, { signal: lifecycle.signal });
      node.addEventListener("animationend", event => {
        if (event.animationName === "kisara-embedded-chibi-pop") settleArrival();
      }, { signal: lifecycle.signal });
    }
    node.addEventListener("pointerdown", (event) => beginDrag(event, id), { signal: lifecycle.signal });
    node.addEventListener("pointermove", moveDrag, { signal: lifecycle.signal });
    node.addEventListener("pointerup", (event) => endDrag(event), { signal: lifecycle.signal });
    node.addEventListener("pointercancel", (event) => endDrag(event, true), { signal: lifecycle.signal });
    node.addEventListener("lostpointercapture", (event) => endDrag(event, true), { signal: lifecycle.signal });
    node.addEventListener("keydown", (event) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        cancelScene();
        removeFromGroups(id);
        const point = state.get(id);
        if (!point) return;
        const step = event.shiftKey ? 48 : 20;
        setPosition(id, point.x + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0), point.y + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0));
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        settleCharacter(id);
      }
    }, { signal: lifecycle.signal });
  });

  resetButton?.addEventListener("click", () => {
    if (drag) endDrag({ pointerId: drag.pointerId }, true);
    applePairHits = 0;
    lastApplePairAt = 0;
    appleCooldownUntil = 0;
    shuJealousyHits = 0;
    initialLayout(true);
  }, { signal: lifecycle.signal });

  const resizeStage = () => {
    const width = root.clientWidth;
    const height = root.clientHeight;
    if (!width || !height) return;
    if (drag) endDrag({ pointerId: drag.pointerId }, true);
    measureCharacters();
    const compact = !embedded && width < 620;
    if (!lastStageSize.width || !lastStageSize.height) {
      initialLayout(false);
      return;
    }
    if (lastCompactLayout !== compact) {
      initialLayout(false);
      return;
    }
    const scaleX = width / lastStageSize.width;
    const scaleY = height / lastStageSize.height;
    lastStageSize = { width, height };
    state.forEach((point, id) => setPosition(id, point.x * scaleX, point.y * scaleY));
  };
  const scheduleLayout = () => {
    if (layoutFrame) return;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      if (!cleaned) resizeStage();
    });
  };
  const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(scheduleLayout) : null;
  resizeObserver?.observe(root);
  window.addEventListener("resize", scheduleLayout, { passive: true, signal: lifecycle.signal });
  window.addEventListener("scroll", () => {
    stageRect = null;
    if (!visibilityObserver) refreshVisibility();
  }, { passive: true, signal: lifecycle.signal });

  const resetArrival = () => {
    if (!embedded) return;
    root.removeAttribute("data-entered");
    nodes.forEach(node => node.removeAttribute("data-arrival-settled"));
  };
  const suspendStage = () => {
    stageVisible = false;
    root.removeAttribute("data-stage-visible");
    if (drag) endDrag({ pointerId: drag.pointerId }, true);
    dragFrame.cancel();
    cancelScene();
  };
  const revealArrival = () => {
    if (!embedded || !stageVisible || !root.dataset.ready || root.hasAttribute("data-entered")) return;
    const rect = root.getBoundingClientRect();
    const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
    if (visibleHeight >= Math.min(rect.height * .6, window.innerHeight * .35)) {
      root.setAttribute("data-entered", "");
    }
  };
  const refreshVisibility = () => {
    const rect = root.getBoundingClientRect();
    const chapterRect = homeChapter?.getBoundingClientRect() ?? rect;
    // Rearm only after leaving the chapter, not after scrolling within it or hiding the tab.
    if (!document.hidden && (chapterRect.bottom <= 0 || chapterRect.top >= window.innerHeight)) {
      resetArrival();
    }
    stageVisible = !document.hidden && rect.bottom > 0 && rect.top < window.innerHeight;
    root.toggleAttribute("data-stage-visible", stageVisible);
    revealArrival();
    if (!stageVisible) suspendStage();
  };
  const visibilityObserver = typeof IntersectionObserver === "function"
    ? new IntersectionObserver(refreshVisibility, { threshold: embedded ? [0, .35, .6, 1] : 0 }) : null;
  visibilityObserver?.observe(root);
  if (homeChapter) visibilityObserver?.observe(homeChapter);
  document.addEventListener("visibilitychange", refreshVisibility, { signal: lifecycle.signal });
  window.addEventListener("pagehide", suspendStage, { signal: lifecycle.signal });
  window.addEventListener("pageshow", refreshVisibility, { signal: lifecycle.signal });
  window.addEventListener("blur", () => { if (drag) endDrag({ pointerId: drag.pointerId }, true); }, { signal: lifecycle.signal });
  document.addEventListener("freeze", suspendStage, { signal: lifecycle.signal });
  document.addEventListener("resume", refreshVisibility, { signal: lifecycle.signal });

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    dragFrame.cancel();
    if (layoutFrame) cancelAnimationFrame(layoutFrame);
    if (drag) endDrag({ pointerId: drag.pointerId }, true);
    clearTimerSet();
    clearAppleScene();
    resizeObserver?.disconnect();
    visibilityObserver?.disconnect();
    lifecycle.abort();
    if (appleVideo instanceof HTMLVideoElement) {
      appleVideo.removeAttribute("src");
      appleVideo.load();
    }
    appleFallback?.removeAttribute("src");
    delete root.dataset.kisaraRuntimeBound;
    if (window.__yuimiKisaraChibiCleanup === cleanup) delete window.__yuimiKisaraChibiCleanup;
  };

  window.__yuimiKisaraChibiCleanup = cleanup;
  document.addEventListener("astro:before-swap", cleanup, { once: true, signal: lifecycle.signal });
  refreshVisibility();
  scheduleLayout();
};
