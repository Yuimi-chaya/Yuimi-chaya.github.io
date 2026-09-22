import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import postcss from "postcss";
import { bindWorksStage, getWorksPanelFit } from "../src/themes/kisara/lib/worksStage.ts";

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
  const sync = stage.slice(stage.indexOf("const sync ="), stage.indexOf("const schedule ="));
  assert.ok(sync.indexOf("fitPanels();") > sync.indexOf("animation.currentTime ="));
});

test("Works runtime pauses hero interaction outside the opening and routes results to the result tab", () => {
  assert.match(runtime, /heroStageActive/);
  assert.match(runtime, /worksStage\?\.showPanel\("result"\)/);
  assert.match(runtime, /root\.dataset\.activePanel === "result"/);
  assert.match(runtime, /onHeroActive\(active\)/);
});

test("Works intro removes the metadata chip and adds two Chinese lines below the title", () => {
  assert.doesNotMatch(page, /kisara-works-editorial-meta|KISARA KITCHEN \/ WORKS/);
  assert.match(page, /class="kisara-works-editorial-copy"/);
  assert.match(page, /把零散的灵感，放进一张清晰的工作台。/);
  assert.match(page, /从备料到成品，每一步都留下自己的节奏。/);
  assert.match(styles, /\.kisara-works-editorial-copy\s*\{/);
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
  assert.deepEqual(values(scope + ".kisara-works-stage", "overflow"), ["clip"]);
  assert.deepEqual(values(scope + ".kisara-kitchen-lab", "inset"), ["0"]);
  assert.match(values(scope + ".kisara-kitchen-lab", "padding")[0], /^var\(--works-header-space, 90px\)/);
  assert.deepEqual(values(scope + ".kisara-kitchen-lab", "height"), ["auto"]);
  assert.deepEqual(values(scope + ".kisara-kitchen-lab", "overflow"), ["clip"]);
  assert.deepEqual(values(scope + ".kisara-kitchen-lab", "overscroll-behavior"), ["auto"]);
  assert.deepEqual(values(scope + ".kisara-kitchen-lab", "grid-template-rows"), ["minmax(0, 1fr)"]);
  assert.deepEqual(values(scope + ".kisara-kitchen-workspace", "grid-template-rows"), ["auto minmax(0, 1fr)"]);
  assert.deepEqual(values(scope + ".kisara-kitchen-panel", "overflow"), ["clip"]);
  assert.deepEqual(values(scope + ".kisara-kitchen-panel", "width"), ["100%"]);
  assert.deepEqual(values(scope + ".kisara-kitchen-counter", "width"), ["calc(100% - 32px)"]);
  assert.deepEqual(values(scope + ".kisara-kitchen-counter", "height"), ["calc(100% - 54px)"]);
  assert.deepEqual(values(scope + ".kisara-kitchen-counter", "min-height"), ["0", "0"]);
  assert.deepEqual(values(scope + ".kisara-drink-result", "width"), ["calc(100% - 32px)"]);
  assert.deepEqual(values(scope + ".kisara-drink-result", "height"), ["calc(100% - 32px)"]);
  assert.match(styles, /scale\(var\(--works-panel-fit, 1\)\)/);
});

test("Tabs belong to the worktop header without a detached toolbar gap", () => {
  const workspace = page.indexOf('<div class="kisara-kitchen-workspace">');
  const toolbar = page.indexOf('<header class="kisara-kitchen-toolbar">');
  const prep = page.indexOf('id="kisara-prep-panel"');
  const result = page.indexOf('id="kisara-result-panel"');
  assert.ok(workspace > 0 && workspace < toolbar && toolbar < prep && prep < result);
  const css = postcss.parse(styles);
  const values: Record<string, string> = {};
  css.walkRules('body[data-kisara-page="projects"] .kisara-kitchen-toolbar', rule => {
    if (rule.parent?.type === "root") rule.walkDecls(decl => { values[decl.prop] = decl.value; });
  });
  assert.equal(values.position, "relative");
  assert.equal(values.margin, "0 16px");
  assert.equal(values["min-height"], "44px");
  assert.match(styles, /transform-origin: top center/);
});

test("Board uses the former readout row instead of keeping an empty fourth grid track", () => {
  assert.doesNotMatch(page, /BOARD LOAD|CUT LEVEL|class="kisara-prep-readout"/);
  const rows: string[] = [];
  postcss.parse(styles).walkRules('body[data-kisara-page="projects"] .kisara-kitchen-prep', rule => {
    rule.walkDecls("grid-template-rows", decl => { rows.push(decl.value); });
  });
  assert.deepEqual(rows, ["minmax(300px, 1fr) auto auto", "minmax(0, 1fr) auto auto"]);
});

test("Desktop worktops fill short CSS viewports as well as large screens", () => {
  // 1203x457 is the measured panel at a 1177x581 CSS viewport and DPR 2.
  // Physical screenshot dimensions must not substitute for CSS viewport sizes.
  for (const [panelWidth, panelHeight] of [[1203, 457], [1374, 653], [1776, 880], [2476, 1233]]) {
    const width = panelWidth - 32;
    const height = panelHeight - 54;
    const fit = getWorksPanelFit(width, height + 22, panelWidth, panelHeight);
    assert.equal(fit, 1);
    assert.ok(width * fit / panelWidth > .95);
    assert.ok(height * fit / panelHeight > .85);
  }
});

test("Complete worktop and result bounds fit the panel, not a nested scroll area", () => {
  for (const [viewportWidth, viewportHeight] of [[2358, 1286], [1920, 1080], [1366, 768], [1024, 600], [844, 390], [390, 844]]) {
    for (const zoom of [.9, 1]) {
      const width = viewportWidth / zoom - 144;
      const height = viewportHeight / zoom - 200;
      for (const [contentWidth, contentHeight] of [[1380, 722], [940, 642], [1000, 950], [400, 1800]]) {
        const fit = getWorksPanelFit(contentWidth, contentHeight, width, height);
        assert.ok(fit > 0 && fit <= 1);
        assert.ok(contentWidth * fit <= width - 32 + .001);
        assert.ok(contentHeight * fit <= height - 32 + .001);
      }
    }
  }
  assert.equal(getWorksPanelFit(900, 600, 1000, 700), 1);
  assert.equal(getWorksPanelFit(0, 0, 0, 0), 1);
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
        clientWidth = 1100;
        offsetWidth = 1000;
        scrollWidth = 1000;
        offsetHeight = 700;
        scrollHeight = 722;
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
      const prepContent = new Node(), resultContent = new Node();
      prep.clientHeight = result.clientHeight = 500 / zoom;
      prep.querySelector = () => prepContent;
      result.querySelector = () => resultContent;
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
      win.scrollY = 200;
      win.dispatchEvent(new Event("scroll"));
      flush();
      assert.equal(kitchen.inert, false);
      resultTab.dispatchEvent(new Event("click"));
      assert.equal(kitchen.dataset.activePanel, "result");
      assert.equal(result.hidden, false);
      assert.equal(prep.inert, true);
      const expectedFit = getWorksPanelFit(1000, 722, 1100, result.clientHeight);
      assert.equal(Number(resultContent.props.get("--works-panel-fit")), expectedFit);
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
      assert.equal(Number(prepContent.props.get("--works-panel-fit")), expectedFit);
      prepContent.scrollHeight = 950;
      win.dispatchEvent(new Event("resize"));
      flush();
      assert.equal(Number(prepContent.props.get("--works-panel-fit")), getWorksPanelFit(1000, 950, 1100, prep.clientHeight));
      controller.abort();
      assert.equal(shell.props.size, 0);
      assert.equal(prepContent.props.size, 0);
      assert.equal(resultContent.props.size, 0);
      assert.equal(frames.size, 0);
    }
  } finally {
    for (const [key, descriptor] of original) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
