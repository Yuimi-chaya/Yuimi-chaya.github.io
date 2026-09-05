import assert from "node:assert/strict";
import test from "node:test";
import { createGateReconstructionRenderer } from "../src/themes/kisara/lib/gateReconstruction.ts";

function fixture(mode = "ready") {
  const images: any[] = [];
  const timers = new Map<number, () => void>();
  const live = new Set<object>();
  const uniforms = new Map<string, number[]>();
  let lost = false;
  let frames = 0;
  let nextTimer = 0;
  let uploads = 0;
  const gl: any = new Proxy({
    getShaderParameter: () => mode !== "shader-failed",
    getProgramParameter: () => mode !== "link-failed",
    getUniformLocation: (_program: object, name: string) => name,
    isContextLost: () => lost,
    uniform1f: (name: string, value: number) => uniforms.set(name, [value]),
    uniform2f: (name: string, ...value: number[]) => uniforms.set(name, value),
    drawArrays: () => { frames++; },
    texImage2D: () => {
      if (mode === "upload-failed") throw new Error("upload failed");
      uploads++;
    }
  }, {
    get(target, key: string) {
      if (key in target) return target[key];
      if (key.startsWith("create")) return () => { const item = {}; live.add(item); return item; };
      if (key.startsWith("delete")) return (item: object) => live.delete(item);
      if (/^[A-Z0-9_]+$/.test(key)) return 1;
      return () => {};
    }
  });
  class FakeImage {
    naturalWidth = 1920;
    naturalHeight = 1080;
    decoding = "";
    src = "";
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor() { images.push(this); }
  }
  const originalImage = Object.getOwnPropertyDescriptor(globalThis, "Image");
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "Image", { configurable: true, value: FakeImage });
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    setTimeout: (callback: () => void) => { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: (timer: number) => timers.delete(timer)
  } });
  const canvas = {
    style: { opacity: "0" }, dataset: { fightSrc: "/fight.webp", active: "false" },
    clientWidth: 1920, clientHeight: 1080, width: 1, height: 1,
    getContext: () => mode === "no-webgl" ? null : gl
  };
  const controller = new AbortController();
  const options: any = {
    canvas, signal: controller.signal, reducedMotion: false, mobile: false, lite: false,
    warmup: (_gl: unknown, _canvas: unknown, draw: () => void, clear: () => void) => ({
      warm: async () => { draw(); clear(); return true; }, destroy: () => {}
    })
  };
  return {
    options, canvas, controller, images, timers, live, uniforms,
    get frames() { return frames; }, get uploads() { return uploads; },
    lose() { lost = true; },
    restore() {
      controller.abort();
      if (originalImage) Object.defineProperty(globalThis, "Image", originalImage);
      else delete (globalThis as any).Image;
      if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
      else delete (globalThis as any).window;
    }
  };
}

test("reconstruction uses one target texture, bounded canvases, and no repeated upload on replay", async () => {
  for (const profile of ["desktop", "mobile", "lite"]) {
    const f = fixture();
    try {
      f.options.mobile = profile !== "desktop";
      f.options.lite = profile === "lite";
      const pending = createGateReconstructionRenderer(f.options);
      assert.equal(f.images.length, 1);
      f.images[0].onload();
      const renderer = await pending;
      assert.ok(renderer);
      assert.equal(f.timers.size, 0);
      assert.equal(f.uploads, 1);
      for (let run = 0; run < 3; run++) {
        for (const progress of [0.1, 0.5, 0.9]) {
          renderer.draw({ reconstruction: progress, opacity: 0.92, centerX: 0.5, centerY: 0.52, time: run });
          assert.equal(f.uniforms.get("uProgress")![0], progress);
        }
        renderer.clear();
        assert.equal(f.canvas.style.opacity, "0");
      }
      const budget = profile === "desktop" ? 1300000 : profile === "mobile" ? 290000 : 210000;
      assert.ok(f.canvas.width * f.canvas.height <= budget + 2200);
      assert.equal(f.uploads, 1);
      await renderer.warm();
      assert.equal(f.canvas.dataset.active, "false");
      const before = f.frames;
      f.lose();
      renderer.draw({ reconstruction: 0.5, opacity: 1, centerX: 0.5, centerY: 0.5, time: 0 });
      assert.equal(f.frames, before);
      renderer.destroy();
      renderer.destroy();
      assert.equal(f.live.size, 0);
    } finally { f.restore(); }
  }
});

test("reconstruction errors, timeout, and abort release all provisional resources", async () => {
  for (const mode of ["no-webgl", "shader-failed", "link-failed", "image-failed", "upload-failed", "timeout", "abort"]) {
    const f = fixture(mode);
    try {
      const pending = createGateReconstructionRenderer(f.options);
      if (f.images.length) {
        if (mode === "abort") f.controller.abort();
        else if (mode === "timeout") for (const callback of [...f.timers.values()]) callback();
        else if (mode === "image-failed") f.images[0].onerror();
        else f.images[0].onload();
      }
      assert.equal(await pending, null, mode);
      assert.equal(f.timers.size, 0, mode);
      assert.equal(f.live.size, 0, mode);
      if (f.images.length) {
        assert.equal(f.images[0].onload, null);
        assert.equal(f.images[0].onerror, null);
      }
    } finally { f.restore(); }
  }
});

test("reduced motion does not create a reconstruction context or request", async () => {
  const f = fixture();
  try {
    f.options.reducedMotion = true;
    assert.equal(await createGateReconstructionRenderer(f.options), null);
    assert.equal(f.images.length, 0);
    assert.equal(f.live.size, 0);
  } finally { f.restore(); }
});
