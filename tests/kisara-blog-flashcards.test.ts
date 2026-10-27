import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../src/themes/kisara/lib/blogFlashcards.js", import.meta.url), "utf8");

function fixture(size = 3, reduced = false, initial: { focused?: boolean; hovering?: boolean } = {}) {
  const timers = new Map<number, () => void>();
  const animations: any[] = [];
  let serial = 0;
  class Node extends EventTarget {
    dataset: Record<string, string> = {};
    attributes = new Map<string, string>();
    style = { zIndex: "" };
    hidden = false;
    inert = false;
    disabled = false;
    textContent = "";
    setAttribute(name: string, value: string) { this.attributes.set(name, value); }
    removeAttribute(name: string) { this.attributes.delete(name); }
    toggleAttribute(name: string, value: boolean) {
      if (value) this.setAttribute(name, "");
      else this.removeAttribute(name);
    }
    animate(frames: unknown, timing: unknown) {
      let complete!: () => void;
      const animation = {
        frames, timing, cancelled: false,
        finished: new Promise<void>(resolve => { complete = resolve; }),
        finish: () => complete(),
        cancel() { this.cancelled = true; },
      };
      animations.push(animation);
      return animation;
    }
  }
  const root = new Node();
  const cards = Array.from({ length: size }, (_, i) => Object.assign(new Node(), {
    dataset: { flashcardTone: ["rose", "mint", "blue"][i % 3], flashcardTitle: `Article ${i + 1}` },
  }));
  const nodes = new Map(["prev", "next", "pause", "count", "status", "controls"].map(name => [name, new Node()]));
  const wrappedRoot = Object.assign(root, {
    querySelectorAll: () => cards,
    querySelector: (selector: string) => nodes.get(selector.replace("[data-flashcard-", "").replace("]", "")) ?? null,
    contains: (node: unknown) => node === root || cards.includes(node as Node) || [...nodes.values()].includes(node as Node),
    matches: () => Boolean(initial.hovering),
  });
  const document = Object.assign(new EventTarget(), { hidden: false, activeElement: initial.focused ? cards[0] : null });
  const motion = Object.assign(new EventTarget(), { matches: reduced });
  const window = Object.assign(new EventTarget(), {
    matchMedia: (query: string) => query.includes("reduced-motion") ? motion : { matches: true },
    setTimeout: (callback: () => void) => { const id = ++serial; timers.set(id, callback); return id; },
    clearTimeout: (id: number) => timers.delete(id),
  });
  const bind = vm.runInNewContext(`${source.replace("export function", "function")}; bindBlogFlashcards`, {
    window, document, AbortController,
  });
  const controller = bind(wrappedRoot);
  const emit = (target: EventTarget, type: string, extra = {}) =>
    target.dispatchEvent(Object.assign(new Event(type), extra));
  const fire = () => {
    assert.equal(timers.size, 1);
    const [id, callback] = [...timers][0];
    timers.delete(id);
    callback();
  };
  return { root, cards, nodes, document, motion, window, timers, animations, controller, emit, fire };
}

test("Flashcards start static, rotate on one timer, and preserve the outgoing card until the new one lands", async () => {
  const f = fixture();
  assert.equal(f.timers.size, 0);
  assert.equal(f.cards.filter(card => !card.inert).length, 1);
  f.controller.setActive(true);
  f.fire();
  assert.equal(f.nodes.get("count")!.textContent, "02 / 03");
  assert.equal(f.nodes.get("status")!.textContent, "", "automatic changes are not live announcements");
  assert.equal(f.cards.filter(card => !card.hidden).length, 2);
  assert.equal(f.cards.filter(card => !card.inert).length, 1);
  assert.equal(f.cards[0].attributes.get("aria-hidden"), "true");
  f.animations[0].finish();
  await Promise.resolve();
  assert.equal(f.cards.filter(card => !card.hidden).length, 1);
  assert.equal(f.cards[1].hidden, false);
  assert.equal(f.timers.size, 1);
  f.controller.cleanup();
});

test("Hover and focus pause rotation independently without replacing the focused article", () => {
  const f = fixture();
  f.controller.setActive(true);
  f.emit(f.root, "pointerenter", { pointerType: "mouse" });
  assert.equal(f.timers.size, 0);
  f.emit(f.root, "focusin");
  f.emit(f.root, "pointerleave");
  assert.equal(f.timers.size, 0);
  f.emit(f.root, "focusout", { relatedTarget: f.nodes.get("next") });
  assert.equal(f.timers.size, 0);
  f.emit(f.root, "focusout", { relatedTarget: null });
  assert.equal(f.timers.size, 1);
  assert.equal(f.cards[0].hidden, false);
  f.emit(f.root, "pointerenter", { pointerType: "touch" });
  assert.equal(f.timers.size, 1);
  f.controller.cleanup();
});

test("Focus or hover already present before the async runtime binds prevents automatic replacement", () => {
  for (const initial of [{ focused: true }, { hovering: true }]) {
    const f = fixture(3, false, initial);
    f.controller.setActive(true);
    assert.equal(f.timers.size, 0);
    assert.equal(f.cards[0].inert, false);
    if (initial.focused) f.emit(f.root, "focusout", { relatedTarget: null });
    else f.emit(f.root, "pointerleave");
    assert.equal(f.timers.size, 1);
    f.controller.cleanup();
  }
});

test("Keyboard navigation switches instantly and announces the chosen article; pause persists", () => {
  const f = fixture();
  f.controller.setActive(true);
  f.emit(f.nodes.get("prev")!, "click", { detail: 0 });
  assert.equal(f.nodes.get("count")!.textContent, "03 / 03");
  assert.equal(f.animations.length, 0);
  assert.match(f.nodes.get("status")!.textContent, /第 3 篇.*Article 3/);
  f.emit(f.nodes.get("pause")!, "click");
  assert.equal(f.timers.size, 0);
  f.controller.setActive(false);
  f.controller.setActive(true);
  assert.equal(f.timers.size, 0);
  assert.equal(f.nodes.get("pause")!.attributes.get("aria-pressed"), "true");
  f.emit(f.nodes.get("pause")!, "click");
  assert.equal(f.timers.size, 1);
  f.controller.cleanup();
});

test("Hidden documents, archive coverage and pagehide stop timers; cleanup rejects late callbacks", () => {
  const f = fixture();
  f.controller.setActive(true);
  f.document.hidden = true;
  f.emit(f.document, "visibilitychange");
  assert.equal(f.timers.size, 0);
  f.document.hidden = false;
  f.emit(f.document, "visibilitychange");
  assert.equal(f.timers.size, 1);
  f.controller.setActive(false);
  assert.equal(f.timers.size, 0);
  f.controller.setActive(true);
  f.emit(f.window, "pagehide");
  assert.equal(f.timers.size, 0);
  f.emit(f.window, "pageshow");
  assert.equal(f.timers.size, 1);
  const late = [...f.timers.values()][0];
  f.controller.cleanup();
  assert.equal(f.timers.size, 0);
  late();
  f.emit(f.window, "pageshow");
  f.emit(f.document, "visibilitychange");
  assert.equal(f.timers.size, 0);
  assert.equal(f.cards[0].hidden, false);
});

test("Reduced motion keeps manual navigation, and changing the preference settles an in-flight swap", () => {
  const f = fixture(3, true);
  f.controller.setActive(true);
  assert.equal(f.timers.size, 0);
  assert.equal(f.nodes.get("pause")!.disabled, true);
  f.emit(f.nodes.get("next")!, "click", { detail: 1 });
  assert.equal(f.cards[1].hidden, false);
  assert.equal(f.animations.length, 0);
  f.motion.matches = false;
  f.emit(f.motion, "change");
  f.fire();
  assert.equal(f.cards.filter(card => !card.hidden).length, 2);
  f.motion.matches = true;
  f.emit(f.motion, "change");
  assert.equal(f.timers.size, 0);
  assert.equal(f.animations.at(-1).cancelled, true);
  assert.equal(f.cards.filter(card => !card.hidden).length, 1);
  f.controller.cleanup();
});

test("Rapid manual swaps ignore a stale animation completion and deactivate to one visible card", async () => {
  const f = fixture();
  f.controller.setActive(true);
  f.emit(f.nodes.get("next")!, "click", { detail: 1 });
  f.emit(f.nodes.get("next")!, "click", { detail: 1 });
  assert.equal(f.animations[0].cancelled, true);
  f.animations[0].finish();
  await Promise.resolve();
  assert.equal(f.cards[2].hidden, false);
  f.controller.setActive(false);
  assert.equal(f.cards.filter(card => !card.hidden).length, 1);
  f.animations[1].finish();
  await Promise.resolve();
  assert.equal(f.cards[2].hidden, false);
  f.controller.cleanup();
});

test("Empty and single-card selections never schedule an auto rotation", () => {
  for (const size of [0, 1]) {
    const f = fixture(size);
    f.controller.setActive(true);
    assert.equal(f.timers.size, 0);
    assert.equal(f.nodes.get("prev")!.disabled, true);
    assert.equal(f.nodes.get("next")!.disabled, true);
    assert.equal(f.nodes.get("controls")!.hidden, true);
    f.controller.cleanup();
  }
});
