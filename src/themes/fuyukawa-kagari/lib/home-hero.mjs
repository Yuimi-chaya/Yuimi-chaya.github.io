export function mountHomeHero() {
    window.__yuimiHeroCleanup?.();
    const heroCleanupTasks = [];
    window.__yuimiHeroCleanup = () => {
      heroCleanupTasks.splice(0).forEach((cleanup) => cleanup());
    };

    const stage = document.querySelector("[data-hero-stage]");
    const hero = stage?.querySelector(".hero");
    const typingTarget = document.querySelector("[data-terminal-typing]");
    const nameTarget = document.querySelector("[data-name-typing]");

    const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
    const pullDistance = 260;
    const dockThreshold = 0.56;
    const resetDelay = 260;
    const releaseDelay = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 900;
    const profileCard = hero?.querySelector(".identity-terminal");
    const terminalLines = [
      "pin --dev-notes --anime-diary",
      "collect \"blue moments\" && write",
      "npm run scrapbook",
      "echo \"做自己想做，想自己所想\""
    ];
    const nameLines = ["喝益胃", "Yuimi-chaya"];

    let pull = 0;
    let reversePull = 0;
    let state = "idle";
    let resetTimer = 0;
    let releaseTimer = 0;
    const typingTimers = new Set();

    const setTypingTimer = (callback, delay) => {
      const timer = window.setTimeout(() => {
        typingTimers.delete(timer);
        callback();
      }, delay);
      typingTimers.add(timer);
    };

    const runTypingLoop = (target, lines, writeDelay = 58, eraseDelay = 32, holdDelay = 1250) => {
      if (!target) return;

      let lineIndex = 0;
      let charIndex = 0;
      let deleting = false;

      const tick = () => {
        const line = lines[lineIndex];
        target.textContent = line.slice(0, charIndex);

        if (!deleting && charIndex < line.length) {
          charIndex += 1;
          setTypingTimer(tick, writeDelay);
          return;
        }

        if (!deleting && charIndex === line.length) {
          deleting = true;
          setTypingTimer(tick, holdDelay);
          return;
        }

        if (deleting && charIndex > 0) {
          charIndex -= 1;
          setTypingTimer(tick, eraseDelay);
          return;
        }

        deleting = false;
        lineIndex = (lineIndex + 1) % lines.length;
        setTypingTimer(tick, 360);
      };

      tick();
    };

    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    const initialHash = location.hash;
    const initialScrollFrame = !initialHash
      ? requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0 }))
      : 0;
    heroCleanupTasks.push(() => cancelAnimationFrame(initialScrollFrame));

    const setProgress = (progress) => {
      if (!hero) return;

      const value = clamp(progress);
      hero.style.setProperty("--avatar-y", `${(1 - value) * 56}vh`);
      hero.style.setProperty("--avatar-scale", `${0.78 + value * 0.22}`);
      hero.style.setProperty("--profile-opacity", `${clamp((value - 0.08) / 0.48)}`);
      hero.style.setProperty("--copy-opacity", `${1 - clamp((value - 0.12) / 0.42)}`);
      hero.style.setProperty("--cue-opacity", `${1 - clamp(value / 0.48)}`);
    };

    const resetPull = () => {
      if (state === "passed") return;
      window.clearTimeout(resetTimer);
      window.clearTimeout(releaseTimer);
      pull = 0;
      reversePull = 0;
      state = "idle";
      hero?.classList.remove("is-docked", "is-pulling");
      setProgress(0);
    };

    const settlePull = () => {
      if (state !== "pulling") return;

      if (pull / pullDistance >= dockThreshold) {
        dockProfile();
      } else {
        resetPull();
      }
    };

    const schedulePullSettle = () => {
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(settlePull, resetDelay);
    };

    const releaseScroll = () => {
      if (state !== "docked") return;
      window.clearTimeout(releaseTimer);
      releaseTimer = 0;
      state = "passed";
    };

    const handleProfileTransitionEnd = (event) => {
      if (event.target === profileCard && event.propertyName === "transform") {
        releaseScroll();
      }
    };

    const dockProfile = () => {
      pull = pullDistance;
      reversePull = 0;
      state = "docked";
      hero?.classList.remove("is-pulling");
      hero?.classList.add("is-docked");
      setProgress(1);

      window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(releaseScroll, releaseDelay);
    };

    const handleHeroWheel = (event) => {
      if (!stage || !hero) return;
      if (document.documentElement.classList.contains("is-notice-open")) return;

      const stageRect = stage.getBoundingClientRect();
      const atHeroTop = window.scrollY <= 2 && stageRect.top >= -2;
      if (!atHeroTop) {
        if (state === "passed" || initialHash || stageRect.bottom <= 0) return;
        event.preventDefault();
      }

      if (event.deltaY < 0) {
        event.preventDefault();

        if (state === "passed" || state === "docked") {
          reversePull += -event.deltaY;
          if (reversePull < 36) return;
          window.clearTimeout(releaseTimer);
          pull = 0;
          reversePull = 0;
          state = "idle";
          hero.classList.remove("is-docked", "is-pulling");
          setProgress(0);
          return;
        }

        pull = clamp(pull + event.deltaY * 0.82, 0, pullDistance);
        state = pull > 0 ? "pulling" : "idle";
        hero.classList.toggle("is-pulling", state === "pulling");
        hero.classList.remove("is-docked");
        setProgress(pull / pullDistance);
        if (state === "pulling") {
          schedulePullSettle();
        } else {
          window.clearTimeout(resetTimer);
        }
        return;
      }

      reversePull = 0;
      if (state === "passed") return;
      if (state === "docked") {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      window.clearTimeout(releaseTimer);

      const resistance = 1 - clamp(pull / pullDistance) * 0.5;
      pull = clamp(pull + event.deltaY * resistance, 0, pullDistance);
      const progress = pull / pullDistance;

      hero.classList.add("is-pulling");
      hero.classList.remove("is-docked");
      state = "pulling";
      setProgress(progress);
      schedulePullSettle();
    };

    const handleHeroScroll = () => {
      if (!stage || !hero) return;

      const nativeProgress = clamp(-stage.getBoundingClientRect().top / (window.innerHeight || 1));
      hero.style.setProperty("--hero-dim", `${0.12 + clamp((nativeProgress - 1.05) / 0.25) * 0.12}`);

      if (window.scrollY <= 2 && state === "passed") {
        pull = pullDistance;
        hero.classList.remove("is-pulling");
        hero.classList.add("is-docked");
        setProgress(1);
      }
    };

    runTypingLoop(typingTarget, terminalLines);
    runTypingLoop(nameTarget, nameLines, 96, 46, 1500);

    const pokeAvatar = document.querySelector("[data-poke-avatar]");
    const avatarFlower = document.querySelector("[data-avatar-flower]");
    const pokeBubble = document.querySelector("[data-poke-bubble]");
    let lastPokeAt = 0;
    let bubbleTimer = 0;
    let pokeTimer = 0;
    let flowerPointerId = null;
    let flowerDragX = 0;
    let flowerDragAngle = 0;
    let flowerAngle = 0;
    const reduceFlowerMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const showPokeBubble = (text) => {
      if (!pokeBubble) return;
      pokeBubble.textContent = text;
      pokeBubble.classList.add("is-visible");
      window.clearTimeout(bubbleTimer);
      bubbleTimer = window.setTimeout(() => {
        pokeBubble.classList.remove("is-visible");
      }, 1700);
    };

    const setFlowerAngle = (angle) => {
      flowerAngle = clamp(angle, -32, 32);
      avatarFlower.style.setProperty("--flower-sway", `${flowerAngle}deg`);
    };

    const handleFlowerMove = (event) => {
      if (flowerPointerId !== null) {
        if (event.pointerId === flowerPointerId) {
          setFlowerAngle(flowerDragAngle + (event.clientX - flowerDragX) * 0.45);
        }
        return;
      }
      if (reduceFlowerMotion) return;
      if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") return;
      const rect = avatarFlower.getBoundingClientRect();
      avatarFlower.classList.add("is-tracking");
      setFlowerAngle(((event.clientX - rect.left) / rect.width - 0.5) * 40);
    };

    const handleFlowerDown = (event) => {
      if (flowerPointerId !== null || event.isPrimary === false || event.button !== 0) return;
      event.preventDefault();
      flowerPointerId = event.pointerId;
      flowerDragX = event.clientX;
      flowerDragAngle = flowerAngle;
      avatarFlower.classList.remove("is-tracking");
      avatarFlower.classList.add("is-dragging");
      avatarFlower.setPointerCapture(event.pointerId);
    };

    const resetFlower = () => {
      flowerPointerId = null;
      avatarFlower.classList.remove("is-tracking", "is-dragging");
      setFlowerAngle(0);
    };

    const handleFlowerUp = (event) => {
      if (event.pointerId !== flowerPointerId) return;
      if (avatarFlower.hasPointerCapture(event.pointerId)) {
        avatarFlower.releasePointerCapture(event.pointerId);
      }
      resetFlower();
    };

    const handleFlowerLeave = () => {
      if (flowerPointerId === null) resetFlower();
    };

    const handlePokeDoubleClick = (event) => {
      event.preventDefault();
      const now = Date.now();
      if (now - lastPokeAt < 10000) {
        showPokeBubble("\u64cd\u4f5c\u592a\u5feb\u5566\uff0c\u4f11\u606f\u4e00\u4e0b\u5427");
        return;
      }

      lastPokeAt = now;
      pokeAvatar.classList.remove("is-poked");
      void pokeAvatar.offsetWidth;
      pokeAvatar.classList.add("is-poked");
      showPokeBubble("\u6233\u5230\u4e86~");
      window.clearTimeout(pokeTimer);
      pokeTimer = window.setTimeout(() => pokeAvatar.classList.remove("is-poked"), 720);
    };

    avatarFlower?.addEventListener("pointermove", handleFlowerMove);
    avatarFlower?.addEventListener("pointerdown", handleFlowerDown);
    avatarFlower?.addEventListener("pointerup", handleFlowerUp);
    avatarFlower?.addEventListener("pointercancel", handleFlowerUp);
    avatarFlower?.addEventListener("lostpointercapture", handleFlowerUp);
    avatarFlower?.addEventListener("pointerleave", handleFlowerLeave);
    pokeAvatar?.addEventListener("dblclick", handlePokeDoubleClick);
    heroCleanupTasks.push(() => {
      if (flowerPointerId !== null && avatarFlower?.hasPointerCapture(flowerPointerId)) {
        avatarFlower.releasePointerCapture(flowerPointerId);
      }
      if (avatarFlower) resetFlower();
      avatarFlower?.removeEventListener("pointermove", handleFlowerMove);
      avatarFlower?.removeEventListener("pointerdown", handleFlowerDown);
      avatarFlower?.removeEventListener("pointerup", handleFlowerUp);
      avatarFlower?.removeEventListener("pointercancel", handleFlowerUp);
      avatarFlower?.removeEventListener("lostpointercapture", handleFlowerUp);
      avatarFlower?.removeEventListener("pointerleave", handleFlowerLeave);
      pokeAvatar?.removeEventListener("dblclick", handlePokeDoubleClick);
    });

    setProgress(0);
    handleHeroScroll();
    profileCard?.addEventListener("transitionend", handleProfileTransitionEnd);
    window.addEventListener("wheel", handleHeroWheel, { passive: false });
    window.addEventListener("scroll", handleHeroScroll, { passive: true });
    window.addEventListener("resize", handleHeroScroll);
    window.addEventListener("pageshow", handleHeroScroll);
    heroCleanupTasks.push(() => {
      window.clearTimeout(resetTimer);
      window.clearTimeout(releaseTimer);
      window.clearTimeout(bubbleTimer);
      window.clearTimeout(pokeTimer);
      typingTimers.forEach((timer) => window.clearTimeout(timer));
      typingTimers.clear();
      profileCard?.removeEventListener("transitionend", handleProfileTransitionEnd);
      window.removeEventListener("wheel", handleHeroWheel);
      window.removeEventListener("scroll", handleHeroScroll);
      window.removeEventListener("resize", handleHeroScroll);
      window.removeEventListener("pageshow", handleHeroScroll);
    });

    return window.__yuimiHeroCleanup;
}
