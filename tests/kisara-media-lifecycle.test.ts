import assert from "node:assert/strict";
import { setMaxListeners } from "node:events";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import { parse } from "@astrojs/compiler";
import { buildSync } from "esbuild";

const components = [
  { name: "002", tag: "kisara-fridge-scene", file: "KisaraFridgeScene.astro", selector: "[data-fridge-video]" },
  { name: "003", tag: "kisara-home-event-video", file: "KisaraHomeEventVideo.astro", selector: "[data-home-event-video]" },
];
const scripts = new Map<string, string>();
for (const component of components) {
  const path = new URL(`../src/themes/kisara/components/${component.file}`, import.meta.url);
  const { ast } = await parse(readFileSync(path, "utf8"));
  const script = ast.children.find(node => node.type === "element" && node.name === "script");
  assert.ok(script && "children" in script);
  const contents = script.children.map(node => "value" in node ? node.value : "").join("");
  scripts.set(component.tag, buildSync({
    stdin: { contents, loader: "ts", resolveDir: fileURLToPath(new URL(".", path)) },
    bundle: true, write: false, format: "iife", platform: "browser",
  }).outputFiles[0].text);
}
// Exercise the installed router's actual connection/replacement order.
const swapScript = buildSync({
  entryPoints: [fileURLToPath(new URL("../node_modules/astro/dist/transitions/swap-functions.js", import.meta.url))],
  bundle: true, write: false, format: "iife", globalName: "astroSwap", platform: "browser",
  define: { "import.meta.env.DEV": "false" },
}).outputFiles[0].text;
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function fixture(component: typeof components[number], reduced = false) {
  let serial = 0;
  const frames = new Map<number, Function>();
  const timers = new Map<number, Function>();
  const observers: Observer[] = [];
  const registry = new Map<string, typeof Element>();
  const doc = Object.assign(new EventTarget(), { hidden: false, documentElement: null as unknown as Element });
  class Element extends EventTarget {
    localName: string;
    attrs = new Map<string, string>();
    dataset: Record<string, string> = {};
    children: Element[] = [];
    parentNode: Element | null = null;
    ownerDocument = doc;
    isConnected = false;
    style = { transform: "", setProperty() {}, removeProperty() {} };
    clientWidth = 1440;
    clientHeight = 900;
    offsetWidth = 100;
    offsetHeight = 100;
    rect = { top: 2000, bottom: 2900, height: 900, width: 1440, left: 0 };
    classes = new Set<string>();
    classList = {
      add: (...names: string[]) => names.forEach(name => this.classes.add(name)),
      remove: (...names: string[]) => names.forEach(name => this.classes.delete(name)),
      contains: (name: string) => this.classes.has(name),
    };
    constructor(name = "div") { super(); this.localName = name; }
    get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
    setAttribute(name: string, value: string) {
      this.attrs.set(name, value);
      if (name.startsWith("data-")) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    }
    hasAttribute(name: string) { return this.attrs.has(name); }
    getAttribute(name: string) { return this.attrs.get(name) ?? null; }
    removeAttribute(name: string) { this.attrs.delete(name); }
    toggleAttribute(name: string, force: boolean) { if (force) this.setAttribute(name, ""); else this.removeAttribute(name); }
    set src(value: string) { this.setAttribute("src", value); }
    get src() { return this.getAttribute("src") ?? ""; }
    getBoundingClientRect() { return this.rect; }
    matches(selector: string) {
      if (selector.startsWith(".")) return this.classes.has(selector.slice(1));
      const attr = selector.match(/^([\w-]+)?\[([\w-]+)\]$/);
      return attr ? (!attr[1] || attr[1] === this.localName) && this.hasAttribute(attr[2]) : selector === this.localName;
    }
    querySelectorAll(selector: string): Element[] {
      const selectors = selector.split(",").map(value => value.trim());
      return this.children.flatMap(child => [
        ...(selectors.some(part => child.matches(part)) ? [child] : []),
        ...child.querySelectorAll(selector),
      ]);
    }
    querySelector(selector: string) { return this.querySelectorAll(selector)[0] ?? null; }
    connectedCallback?(): void;
    disconnectedCallback?(): void;
    connect(value: boolean) {
      const nodes: Element[] = [];
      const visit = (node: Element) => { nodes.push(node); node.children.forEach(visit); };
      visit(this);
      nodes.forEach(node => { node.isConnected = value; });
      nodes.forEach(node => value ? node.connectedCallback?.() : node.disconnectedCallback?.());
    }
    append(...nodes: Element[]) {
      for (const node of nodes) {
        node.parentNode = this;
        this.children.push(node);
        if (this.isConnected) node.connect(true);
      }
    }
    replaceWith(next: Element) {
      const parent = this.parentNode!;
      const index = parent.children.indexOf(this);
      if (this.isConnected) this.connect(false);
      this.parentNode = null;
      parent.children[index] = next;
      next.parentNode = parent;
      if (parent.isConnected) next.connect(true);
    }
    remove() {
      if (this.isConnected) this.connect(false);
      if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(node => node !== this);
      this.parentNode = null;
    }
    // Only <source> children need serialization in this DOM lifecycle fixture.
    get innerHTML() { return JSON.stringify(this.children.map(child => ({ tag: child.localName, attributes: child.attributes }))); }
    set innerHTML(value: string) {
      this.children = [];
      for (const child of JSON.parse(value)) {
        const node = new Element(child.tag);
        for (const { name, value } of child.attributes) node.setAttribute(name, value);
        this.append(node);
      }
    }
  }
  class Video extends Element {
    paused = true;
    ended = false;
    error = null;
    readyState = 0;
    seeking = false;
    currentTime = 0;
    duration = 1.126;
    plays = 0;
    loads = 0;
    callbacks = new Map<number, Function>();
    constructor() { super("video"); }
    load() { this.loads++; this.currentTime = 0; this.ended = false; }
    play() { this.plays++; this.paused = false; this.ended = false; return Promise.resolve(); }
    pause() {
      if (!this.paused) { this.paused = true; this.dispatchEvent(new Event("pause")); }
    }
    requestVideoFrameCallback(callback: Function) { this.callbacks.set(++serial, callback); return serial; }
    cancelVideoFrameCallback(id: number) { this.callbacks.delete(id); }
    present(time = .1) {
      this.readyState = 4;
      this.currentTime = time;
      const pending = [...this.callbacks.values()];
      this.callbacks.clear();
      pending.forEach(callback => callback(0, { mediaTime: time }));
    }
  }
  class Observer {
    active = false;
    constructor(_callback: Function) { observers.push(this); }
    observe() { this.active = true; }
    disconnect() { this.active = false; }
  }
  class Controller extends AbortController {
    constructor() { super(); setMaxListeners(0, this.signal); }
  }
  const window = Object.assign(new EventTarget(), {
    innerHeight: 900,
    matchMedia: () => Object.assign(new EventTarget(), { matches: reduced }),
    requestAnimationFrame(callback: Function) { frames.set(++serial, callback); return serial; },
    cancelAnimationFrame(id: number) { frames.delete(id); },
    setTimeout(callback: Function) { timers.set(++serial, callback); return serial; },
    clearTimeout(id: number) { timers.delete(id); },
    IntersectionObserver: Observer,
  });
  const document = Object.assign(doc, {
    createElement: (tag: string) => tag === "video" ? new Video() : new Element(tag),
  });
  document.documentElement = new Element("html");
  document.documentElement.isConnected = true;
  const context = vm.createContext({
    window, document, HTMLElement: Element, HTMLVideoElement: Video,
    AbortController: Controller, IntersectionObserver: Observer, queueMicrotask,
    requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame,
    setTimeout: window.setTimeout, clearTimeout: window.clearTimeout,
    customElements: { get: (name: string) => registry.get(name), define: (name: string, ctor: typeof Element) => registry.set(name, ctor) },
  });
  vm.runInContext(scripts.get(component.tag)!, context);
  const swap = vm.runInContext(swapScript + "\nastroSwap.swapBodyElement", context);
  let body = new Element("body");
  document.documentElement.append(body);
  const createScene = () => {
    const Scene = registry.get(component.tag)!;
    const scene = new Scene() as Element & {
      preloadPresentation(): void;
      resetPresentation(): void;
      prepareCoveredEntry(): Promise<void> | undefined;
    };
    scene.localName = component.tag;
    const video = new Video();
    video.setAttribute(component.selector.slice(1, -1), "");
    if (component.name === "002") {
      video.setAttribute("data-src", "/fridge.mp4");
      const stage = new Element();
      stage.setAttribute("data-fridge-physics", "");
      for (let index = 0; index < 4; index++) {
        const item = new Element("button");
        item.setAttribute("data-fridge-body", "");
        stage.append(item);
      }
      scene.append(stage);
    } else {
      const source = new Element("source");
      source.setAttribute("data-src", "/board.mp4");
      video.append(source);
    }
    scene.append(video);
    return { scene, parsedVideo: video };
  };
  return {
    observers, frames, timers, document, window,
    enter(routeSwap = false) {
      const entry = createScene();
      if (routeSwap) {
        const next = new Element("body");
        next.append(entry.scene);
        swap(next, body);
        body = next;
      } else body.append(entry.scene);
      return { ...entry, video: entry.scene.querySelector(component.selector) as Video };
    },
    async play(entry: ReturnType<typeof createScene> & { video: Video }) {
      entry.scene.rect = { top: 0, bottom: 900, height: 900, width: 1440, left: 0 };
      entry.scene.preloadPresentation();
      const covered = entry.scene.prepareCoveredEntry();
      entry.video.present();
      await flush();
      return covered;
    },
    reconnect(scene: Element) { scene.remove(); body.append(scene); },
    destroy() {
      body.remove();
      assert.equal(observers.filter(observer => observer.active).length, 0);
      assert.equal(frames.size, 0);
      assert.equal(timers.size, 0);
    },
  };
}

for (const component of components) {
  test(`${component.name} binds the live video after every Astro media replacement`, async () => {
    const f = fixture(component);
    try {
      let previous: ReturnType<typeof f.enter> | null = null;
      for (let visit = 0; visit < 5; visit++) {
        const entry = f.enter(visit > 0);
        await flush();
        if (visit > 0) assert.notEqual(entry.video, entry.parsedVideo, "The real Astro swap must replace the parsed video");
        const playback = f.play(entry);
        await flush();
        assert.equal(entry.video.plays, 1, `Visit ${visit}: playback must target the displayed video`);
        assert.equal(entry.video.loads, 1, "The live video hydrates once");
        assert.ok(entry.scene.hasAttribute("data-frame-ready"));
        await playback;
        if (visit > 0) {
          assert.equal(entry.parsedVideo.plays, 0, "Do not play the detached parser node");
          assert.equal(entry.parsedVideo.loads, 0, "Do not load the detached parser node");
        }
        if (previous) {
          const state = entry.scene.dataset.state;
          previous.video.dispatchEvent(new Event("canplay"));
          previous.video.dispatchEvent(new Event("ended"));
          assert.equal(previous.video.paused, true);
          assert.equal(previous.video.callbacks.size, 0);
          assert.equal(entry.scene.dataset.state, state, "Old media events cannot change the new scene");
        }
        previous = entry;
      }
    } finally { f.destroy(); }
  });

  test(`${component.name} keeps explicit replay working without reloading decoded media`, async () => {
    const f = fixture(component);
    try {
      const entry = f.enter();
      await flush();
      for (let replay = 0; replay < 5; replay++) {
        if (replay) entry.scene.resetPresentation();
        await f.play(entry);
        assert.equal(entry.video.plays, replay + 1);
        assert.equal(entry.video.loads, 1);
        entry.video.currentTime = entry.video.duration;
        entry.video.ended = true;
        entry.video.dispatchEvent(new Event("ended"));
        assert.equal(entry.video.paused, true);
      }
    } finally { f.destroy(); }
  });

  test(`${component.name} cancels initialization when removed before the swap task settles`, async () => {
    const f = fixture(component);
    try {
      const entry = f.enter(true);
      entry.scene.remove();
      await flush();
      assert.equal(f.observers.length, 0);
      assert.equal(entry.video.loads, 0);
      assert.equal(entry.parsedVideo.loads, 0);
    } finally { f.destroy(); }
  });

  test(`${component.name} initializes only the latest synchronous reconnection`, async () => {
    const f = fixture(component);
    try {
      const entry = f.enter(true);
      f.reconnect(entry.scene);
      await flush();
      assert.equal(f.observers.length, 2, "Only the latest connection may create preload/visibility observers");
      await f.play(entry);
      assert.equal(entry.video.plays, 1);
    } finally { f.destroy(); }
  });

  test(`${component.name} preserves reduced-motion behavior after an Astro swap`, async () => {
    const f = fixture(component, true);
    try {
      const entry = f.enter(true);
      await flush();
      await f.play(entry);
      assert.equal(entry.video.plays, 0);
      assert.equal(entry.video.loads, 0);
      assert.equal(entry.parsedVideo.plays, 0);
    } finally { f.destroy(); }
  });
}
