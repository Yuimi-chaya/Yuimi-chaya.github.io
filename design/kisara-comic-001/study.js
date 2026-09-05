(() => {
  "use strict";
  const stage = document.querySelector("#stage");
  const comic = document.querySelector("#comic");
  const portrait = document.querySelector("#portrait-image");
  const fridge = document.querySelector("#fridge");
  const video = document.querySelector("#fridge-video");
  const finalFrame = document.querySelector("#fridge-final");
  const next = document.querySelector("#next");
  const replay = document.querySelector("#replay");
  const message = document.querySelector("#stage-message");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const report = window.comicStudyMetrics;
  const materialInputs = [...document.querySelectorAll('[name="material"]')];
  const pending = new Set();
  let generation = 0;
  let materialGeneration = 0;
  let mediaController = null;
  let videoFrame = 0;
  let busy = false;
  let visibilityPaused = false;

  const schedule = (callback, delay) => {
    const timer = setTimeout(() => { pending.delete(timer); callback(); }, delay);
    pending.add(timer);
    return timer;
  };
  const setBusy = (value) => {
    busy = value;
    stage.setAttribute("aria-busy", String(value));
    next.disabled = value;
    materialInputs.forEach(input => { input.disabled = value; });
  };
  const showError = (text) => { message.textContent = text; message.hidden = false; };
  const clearAsync = () => {
    generation++;
    materialGeneration++;
    pending.forEach(clearTimeout);
    pending.clear();
    mediaController?.abort();
    mediaController = null;
    if (videoFrame && video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(videoFrame);
    videoFrame = 0;
    video.pause();
    visibilityPaused = false;
    comic.classList.remove("is-entering");
    stage.classList.remove("is-closing", "is-covered", "is-video-ready");
  };
  const resetComic = (animate = false) => {
    clearAsync();
    stage.dataset.state = "comic";
    fridge.setAttribute("aria-hidden", "true");
    comic.removeAttribute("aria-hidden");
    fridge.classList.remove("is-open");
    finalFrame.hidden = true;
    video.hidden = false;
    message.hidden = true;
    next.innerHTML = '<span>002</span><svg><use href="#icon-right"/></svg>';
    next.setAttribute("aria-label", "Preview transition to 002");
    const currentMaterial = portrait.src.endsWith(".svg") ? "vector" : "hybrid";
    materialInputs.forEach(input => { input.checked = input.value === currentMaterial; });
    document.querySelector(".material-size").textContent = sizeLabel(currentMaterial);
    setBusy(false);
    if (animate && !motion.matches) {
      void comic.offsetWidth;
      comic.classList.add("is-entering");
      schedule(() => comic.classList.remove("is-entering"), 860);
    }
  };

  const sizeLabel = (kind) => {
    if (!report) return "";
    const bytes = kind === "vector" ? report.files["subject-vector.svg"] : report.hybridBundleBytes;
    return `${(bytes / 1024).toFixed(1)} KiB`;
  };
  document.querySelectorAll("[data-size]").forEach(node => {
    node.textContent = sizeLabel(node.dataset.size);
  });
  if (report) {
    document.querySelector("[data-complexity]").textContent =
      `${report.contours.toLocaleString()} CONTOURS / ${(report.vectorGzipBytes / 1024).toFixed(1)} KiB GZIP`;
  }
  materialInputs.forEach(input => input.addEventListener("change", async () => {
    const serial = ++materialGeneration;
    const selected = input.value;
    const image = new Image();
    image.src = `assets/subject-${selected}.` + (selected === "vector" ? "svg" : "webp");
    try {
      await image.decode();
      if (serial !== materialGeneration) return;
      portrait.src = image.src;
      document.querySelector(".material-size").textContent = sizeLabel(selected);
      message.hidden = true;
    } catch {
      if (serial !== materialGeneration) return;
      const current = portrait.src.endsWith(".svg") ? "vector" : "hybrid";
      materialInputs.forEach(node => { node.checked = node.value === current; });
      showError("The selected image could not be loaded.");
    }
  }));

  const beginFridge = () => {
    if (busy) return;
    if (stage.dataset.state === "fridge") { resetComic(true); return; }
    clearAsync();
    message.hidden = true;
    setBusy(true);
    const serial = generation;
    const alive = () => serial === generation;
    mediaController = new AbortController();
    const signal = mediaController.signal;
    let covered = false;
    let ready = false;
    let launched = false;
    let watchTimer = 0;
    const fail = (text) => {
      if (!alive()) return;
      resetComic(false);
      showError(text);
    };
    const launch = () => {
      if (!alive() || !covered || !ready || launched || document.hidden) return;
      launched = true;
      stage.dataset.state = "fridge";
      fridge.setAttribute("aria-hidden", "false");
      comic.setAttribute("aria-hidden", "true");
      const revealVideo = () => {
        videoFrame = 0;
        if (!alive()) return;
        // The footage's first frame is blue-black, not mathematical black.
        stage.classList.add("is-video-ready");
        schedule(() => {
          if (alive()) stage.classList.remove("is-covered", "is-closing", "is-video-ready");
        }, motion.matches ? 0 : 180);
        setBusy(false);
        next.innerHTML = '<svg><use href="#icon-left"/></svg><span>001</span>';
        next.setAttribute("aria-label", "Return to comic 001");
      };
      if (video.requestVideoFrameCallback) {
        videoFrame = video.requestVideoFrameCallback(revealVideo);
      } else {
        video.addEventListener("playing", revealVideo, { once: true, signal });
      }
      video.play().catch(() => fail("Playback was blocked. Use the replay button to try again."));
    };
    const refreshReady = () => {
      ready = video.readyState >= 2 && !video.seeking && video.currentTime < .05;
      launch();
    };
    const clearWatchdog = () => {
      clearTimeout(watchTimer);
      pending.delete(watchTimer);
      watchTimer = 0;
    };
    const armWatchdog = () => {
      clearWatchdog();
      watchTimer = schedule(() => {
        if (alive() && busy && !document.hidden) {
          fail("The video did not become ready. Return to 001 and try again.");
        }
      }, 10000);
    };
    video.addEventListener("loadeddata", refreshReady, { signal });
    video.addEventListener("seeked", refreshReady, { signal });
    video.addEventListener("error", () => fail("The local 002 video is unavailable."), { signal });
    video.addEventListener("ended", () => {
      if (!alive()) return;
      fridge.classList.add("is-open");
      if (finalFrame.complete && finalFrame.naturalWidth) {
        finalFrame.hidden = false;
        video.hidden = true;
      }
    }, { signal });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) clearWatchdog();
      else { armWatchdog(); launch(); }
    }, { signal });
    if (!video.getAttribute("src")) video.src = video.dataset.src;
    try { video.currentTime = 0; } catch { /* Loading may not have created a seekable timeline yet. */ }
    ready = video.readyState >= 2 && !video.seeking && video.currentTime < .05;
    stage.classList.add("is-closing");
    schedule(() => {
      if (!alive()) return;
      stage.classList.add("is-covered");
      stage.classList.remove("is-closing");
      covered = true;
      launch();
    }, motion.matches ? 60 : 720);
    armWatchdog();
  };

  next.addEventListener("click", beginFridge);
  replay.addEventListener("click", () => resetComic(true));
  document.querySelectorAll('[name="view"]').forEach(input => input.addEventListener("change", () => {
    resetComic(false);
    document.querySelector("#scene-view").hidden = input.value !== "scene";
    document.querySelector("#compare-view").hidden = input.value !== "compare";
  }));
  const zoom = document.querySelector("#zoom");
  const syncZoom = () => {
    const value = Number(zoom.value);
    document.querySelector("#zoom-value").value = `${value.toFixed(1)}x`;
    document.querySelectorAll(".inspect-frame > img").forEach(image => {
      image.style.transform = `translateX(-50%) scale(${value})`;
    });
  };
  zoom.addEventListener("input", syncZoom);
  document.querySelectorAll('[name="crop"]').forEach(input => input.addEventListener("change", () => {
    document.querySelector("#comparison").dataset.crop = input.value;
    zoom.value = "1";
    syncZoom();
  }));
  document.addEventListener("visibilitychange", () => {
    stage.classList.toggle("is-suspended", document.hidden);
    if (document.hidden && !video.paused) {
      visibilityPaused = true;
      video.pause();
    } else if (!document.hidden && visibilityPaused && stage.dataset.state === "fridge") {
      visibilityPaused = false;
      video.play().catch(() => {
        resetComic(false);
        showError("Playback could not resume.");
      });
    }
  });
  window.addEventListener("pagehide", clearAsync);
  window.addEventListener("pageshow", event => { if (event.persisted) resetComic(false); });
  setBusy(true);
  const bootGeneration = generation;
  portrait.decode().then(() => {
    if (bootGeneration === generation) resetComic(true);
  }).catch(() => {
    if (bootGeneration !== generation) return;
    setBusy(false);
    showError("The portrait could not be loaded.");
  });
})();
