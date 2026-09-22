import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import postcss from "postcss";
import { bindWorksStage } from "../src/themes/kisara/lib/worksStage.ts";

const read = (path: string) => fs.readFileSync(path, "utf8");
const page = read("src/themes/kisara/pages/ProjectsPage.astro");
const stage = read("src/themes/kisara/lib/worksStage.ts");
const runtime = read("src/themes/kisara/lib/worksPage.js");
const layout = read("src/themes/kisara/layouts/KisaraLayout.astro");
const styles = read("src/themes/kisara/styles/projects.css");

test("Works owns a single stage track with explicit prep and result panels", () => {
  assert.match(page, /data-works-stage-track/);
  assert.match(page, /data-works-stage/);
  assert.match(page, /data-kitchen-tab="prep"/);
  assert.match(page, /data-kitchen-tab="result"/);
  assert.match(page, /data-kitchen-panel="prep"/);
  assert.match(page, /data-kitchen-panel="result"/);
  assert.match(page, /showFooter=\{false\}/);
});

test("Works stage binds scroll entry, keyboard tabs, and hash deep links", () => {
  assert.match(stage, /export function bindWorksStage/);
  assert.match(stage, /ArrowLeft/);
  assert.match(stage, /ArrowRight/);
  assert.match(stage, /location\.hash === "#kisara-result-panel"/);
  assert.match(stage, /showPanel\("result"\)/);
  assert.match(stage, /window\.scrollTo\(\{ top: top \+ distance/);
});

test("Works runtime pauses hero interaction outside the opening and routes results to the result tab", () => {
  assert.match(runtime, /heroStageActive/);
  assert.match(runtime, /worksStage\?\.showPanel\("result"\)/);
  assert.match(runtime, /root\.dataset\.activePanel === "result"/);
  assert.match(runtime, /onHeroActive\(active\)/);
});

test("Works stage CSS provides sticky geometry, panel isolation, and responsive controls", () => {
  assert.match(styles, /\.kisara-works-stage\s*\{\s*position: sticky/s);
  assert.match(styles, /\.kisara-kitchen-panel\[hidden\]\s*\{\s*display: none !important/s);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /@media \(max-width: 560px\)/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("Kisara footer remains opt-out rather than being removed globally", () => {
  assert.match(layout, /showFooter\?: boolean/);
  assert.match(layout, /showFooter = true/);
  assert.match(layout, /\{showFooter && <footer class="kisara-footer">/);
});

test("Worktop fits the remaining viewport without a fixed minimum stage height", () => {
  const css = postcss.parse(styles);
  const values = (selector: string, property: string) => {
    const found: string[] = [];
    css.walkRules(selector, rule => rule.walkDecls(property, decl => { found.push(decl.value); }));
    return found;
  };
  const scope = 'body[data-kisara-page="projects"] ';
  assert.deepEqual(values(scope + ".kisara-works-stage", "min-height"), ["0"]);
  assert.deepEqual(values(scope + ".kisara-kitchen-lab", "inset"), ["var(--works-header-space, 90px) 0 0"]);
  assert.deepEqual(values(scope + ".kisara-kitchen-lab", "height"), ["auto"]);
  assert.deepEqual(values(scope + ".kisara-kitchen-lab", "grid-template-rows"), ["auto minmax(0, 1fr)"]);
  assert.deepEqual(values(scope + ".kisara-kitchen-panel", "overflow"), ["auto"]);
  assert.deepEqual(values(scope + ".kisara-kitchen-counter", "height"), ["100%"]);
});

test("At 90 and 100 percent zoom, entry unlocks tabs, clicks and keyboard switch panels, resize updates header clearance", () => {
  const globals = ["window", "document", "location", "ResizeObserver"] as const;
  const original = globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  try {
    for (const zoom of [.9, 1]) {
      const frames = new Map<number, () => void>();
      let id = 0;
      let headerBottom = 76 * zoom;
      const controller = new AbortController();
      const win: any = new EventTarget();
      win.scrollY = 0;
      win.matchMedia = () => ({ matches: false });
      win.requestAnimationFrame = (fn: () => void) => { frames.set(++id, fn); return id; };
      win.cancelAnimationFrame = (key: number) => frames.delete(key);
      win.scrollTo = ({ top }: { top: number }) => { win.scrollY = top; };
      const flush = () => { const batch = [...frames.values()]; frames.clear(); batch.forEach(fn => fn()); };
      const doc: any = { activeElement: null };
      class Node extends EventTarget {
        dataset: Record<string, string> = {};
        hidden = false;
        inert = false;
        tabIndex = 0;
        clientHeight = 768 / zoom;
        attrs = new Map<string, string>();
        props = new Map<string, string>();
        style: any = {
          setProperty: (key: string, value: string) => this.props.set(key, value),
          removeProperty: (key: string) => this.props.delete(key)
        };
        setAttribute(key: string, value: string) { this.attrs.set(key, value); }
        removeAttribute(key: string) { this.attrs.delete(key); }
        focus() { doc.activeElement = this; }
        contains(node: unknown) { return node === this; }
        querySelector(_selector: string): any { return null; }
        querySelectorAll(_selector: string): any[] { return []; }
        getBoundingClientRect() { return { top: 0, height: 768, bottom: 768 }; }
      }
      const shell = new Node(), hero = new Node(), kitchen = new Node(), scrim = new Node();
      const prep = new Node(), result = new Node(), prepTab = new Node(), resultTab = new Node();
      prep.dataset.kitchenPanel = prepTab.dataset.kitchenTab = "prep";
      result.dataset.kitchenPanel = resultTab.dataset.kitchenTab = "result";
      const track = new Node();
      track.getBoundingClientRect = () => ({ top: -win.scrollY, height: 0, bottom: 0 });
      const nodes: Record<string, Node> = {
        "[data-works-stage]": shell, "[data-kisara-works-hero]": hero,
        "[data-kisara-kitchen]": kitchen, "[data-works-stage-scrim]": scrim
      };
      track.querySelector = selector => nodes[selector] ?? null;
      track.querySelectorAll = selector => selector === "[data-kitchen-tab]" ? [prepTab, resultTab] : [prep, result];
      const header = { getBoundingClientRect: () => ({ bottom: headerBottom }) };
      doc.querySelector = () => header;
      Object.defineProperty(globalThis, "window", { configurable: true, value: win });
      Object.defineProperty(globalThis, "document", { configurable: true, value: doc });
      Object.defineProperty(globalThis, "location", { configurable: true, value: { hash: "" } });
      Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, value: undefined });
      const binding = bindWorksStage(track as any, {
        signal: controller.signal, onHeroActive() {}, onLeavePrep() {}
      });
      assert.equal(kitchen.inert, true);
      assert.equal(Number.parseFloat(shell.props.get("--works-header-space")!), 88);
      assert.ok(Math.abs(Number.parseFloat(track.style.height) * zoom - 768 * 1.65) < .01);
      binding.enterKitchen();
      flush();
      assert.equal(kitchen.inert, false);
      assert.equal(hero.inert, true);
      resultTab.dispatchEvent(new Event("click"));
      assert.equal(kitchen.dataset.activePanel, "result");
      assert.equal(result.hidden, false);
      assert.equal(prep.inert, true);
      const key = new Event("keydown", { cancelable: true });
      Object.defineProperty(key, "key", { value: "ArrowLeft" });
      resultTab.dispatchEvent(key);
      assert.equal(kitchen.dataset.activePanel, "prep");
      assert.equal(prep.inert, false);
      assert.equal(result.hidden, true);
      headerBottom = 100 * zoom;
      win.dispatchEvent(new Event("resize"));
      flush();
      assert.ok(Math.abs(Number.parseFloat(shell.props.get("--works-header-space")!) - 112) < .001);
      controller.abort();
      assert.equal(shell.props.size, 0);
      assert.equal(frames.size, 0);
    }
  } finally {
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
