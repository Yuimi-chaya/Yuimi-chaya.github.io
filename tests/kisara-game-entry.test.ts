import assert from "node:assert/strict";
import test from "node:test";
import { bindGameEntry } from "../src/themes/kisara/lib/gameEntry.ts";

function fixture(loaded = true, { reduced = false, fonts = Promise.resolve(), decode = () => Promise.resolve() } = {}) {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const oldCustomEvent = Object.getOwnPropertyDescriptor(globalThis, "CustomEvent");
  const timers = new Map<number, { at: number; fn: () => void }>();
  let timer = 0;
  let now = 0;
  const image: any = new EventTarget();
  image.complete = loaded;
  image.naturalWidth = loaded ? 1516 : 0;
  image.src = "/picture.webp";
  image.currentSrc = image.src;
  image.decode = decode;
  const photo: any = { inert: false, attributes: new Set<string>(), setAttribute(key: string) { this.attributes.add(key); }, removeAttribute(key: string) { this.attributes.delete(key); } };
  const cover: any = { hidden: false };
  const status: any = { textContent: "" };
  const retry: any = new EventTarget();
  retry.hidden = true;
  const scene: any = new EventTarget();
  scene.dataset = { entryState: "waiting" };
  scene.closest = () => ({ focus() {} });
  const parts: Record<string, any> = {
    ".kisara-event-photo > img": image, ".kisara-event-photo": photo, "[data-game-entry]": cover,
    "[data-game-entry-status]": status, "[data-game-entry-retry]": retry,
  };
  scene.querySelector = (key: string) => parts[key];
  const win = {
    matchMedia: () => ({ matches: reduced }),
    setTimeout(fn: () => void, delay: number) { timers.set(++timer, { at: now + delay, fn }); return timer; },
    clearTimeout(id: number) { timers.delete(id); },
  };
  Object.defineProperty(globalThis, "window", { configurable: true, value: win });
  Object.defineProperty(globalThis, "document", { configurable: true, value: { fonts: { ready: fonts } } });
  Object.defineProperty(globalThis, "CustomEvent", { configurable: true, value: Event });
  const controller = new AbortController();
  bindGameEntry(scene, controller.signal);
  const advance = (delay: number) => {
    const target = now + delay;
    while (true) {
      const next = [...timers.entries()].filter(([, task]) => task.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      now = next[1].at;
      timers.delete(next[0]);
      next[1].fn();
    }
    now = target;
  };
  const restore = () => {
    controller.abort();
    for (const [name, descriptor] of [["window", oldWindow], ["document", oldDocument], ["CustomEvent", oldCustomEvent]] as const) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  };
  return { image, photo, cover, status, retry, scene, controller, timers, advance, restore };
}

test("cached photo waits for the minimum title beat, then opens without resizing the photo", async () => {
  const f = fixture();
  try {
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(f.scene.dataset.entryState, "loading");
    assert.equal(f.photo.inert, true);
    f.advance(240);
    assert.equal(f.scene.dataset.entryState, "opening");
    f.advance(280);
    assert.equal(f.scene.dataset.entryState, "complete");
    assert.equal(f.cover.hidden, true);
    assert.equal(f.photo.inert, false);
  } finally { f.restore(); }
});

test("failed photo exposes retry and abort cancels outstanding entry timers", async () => {
  const f = fixture(false);
  try {
    f.image.dispatchEvent(new Event("error"));
    assert.equal(f.scene.dataset.entryState, "error");
    assert.equal(f.retry.hidden, false);
    f.image.complete = true;
    f.image.naturalWidth = 1516;
    f.retry.dispatchEvent(new Event("click"));
    f.image.dispatchEvent(new Event("load"));
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(f.scene.dataset.entryState, "loading");
    f.advance(520);
    assert.equal(f.scene.dataset.entryState, "complete");
    f.controller.abort();
    assert.equal(f.timers.size, 0);
    assert.equal(f.photo.inert, false);
  } finally { f.restore(); }
});

test("slow image stays covered until loaded, while a stuck request releases after six seconds", async () => {
  const f = fixture(false);
  try {
    await Promise.resolve();
    f.advance(1000);
    assert.equal(f.scene.dataset.entryState, "loading");
    f.image.complete = true;
    f.image.naturalWidth = 1516;
    f.image.dispatchEvent(new Event("load"));
    await Promise.resolve();
    assert.equal(f.scene.dataset.entryState, "opening");
    f.advance(280);
    assert.equal(f.cover.hidden, true);
  } finally { f.restore(); }
  const slow = fixture(false);
  try {
    slow.advance(6000);
    assert.equal(slow.scene.dataset.entryState, "fallback");
    assert.equal(slow.photo.inert, false);
    assert.equal(slow.cover.hidden, true);
    slow.image.dispatchEvent(new Event("load"));
    await Promise.resolve();
    assert.equal(slow.scene.dataset.entryState, "fallback", "late media must not restart the entrance");
  } finally { slow.restore(); }
});

test("reduced motion has no artificial hold or shutter delay", async () => {
  const f = fixture(true, { reduced: true });
  try {
    await Promise.resolve();
    f.advance(0);
    assert.equal(f.scene.dataset.entryState, "complete");
    assert.equal(f.timers.size, 0);
  } finally { f.restore(); }
});

test("aborted image decode cannot reopen an outgoing or disconnected scene", async () => {
  let resolveDecode!: () => void;
  const pending = new Promise<void>(resolve => { resolveDecode = resolve; });
  const f = fixture(true, { decode: () => pending });
  try {
    f.controller.abort();
    const state = f.scene.dataset.entryState;
    resolveDecode();
    await Promise.resolve();
    f.advance(10000);
    assert.equal(f.scene.dataset.entryState, state);
    assert.equal(f.timers.size, 0);
    assert.equal(f.photo.inert, false);
  } finally { f.restore(); }
});

test("entry waits for font settlement and decode rejection can use a valid image", async () => {
  let resolveFonts!: () => void;
  const fonts = new Promise<void>(resolve => { resolveFonts = resolve; });
  const f = fixture(true, { fonts, decode: () => Promise.reject(new Error("interrupted decode")) });
  try {
    await Promise.resolve();
    f.advance(240);
    assert.equal(f.scene.dataset.entryState, "loading");
    resolveFonts();
    await Promise.resolve();
    assert.equal(f.scene.dataset.entryState, "opening");
    f.advance(280);
    assert.equal(f.scene.dataset.entryState, "complete");
  } finally { f.restore(); }
});
