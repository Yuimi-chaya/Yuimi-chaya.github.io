import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const source = read("src/themes/kisara/lib/layoutRuntime.js");
const between = (start: string, end: string) => {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a);
  return source.slice(a, b);
};

function fixture(scale = 1) {
  const doc: any = { activeElement: null };
  class Element extends EventTarget {
    hidden = true;
    isConnected = true;
    attributes: Record<string, string> = {};
    style: any = { setProperty(key: string, value: string) { this[key] = value; } };
    classList = { remove() {}, toggle() {} };
    offsetWidth = 292;
    offsetHeight = 368;
    focus() { doc.activeElement = this; }
    contains(node: any) { return node === this || items.includes(node); }
    querySelector() { return items[1]; }
    querySelectorAll() { return items; }
    closest(selector: string) { return this.attributes.native && selector.includes("input") ? this : null; }
  }
  const items = Array.from({ length: 6 }, () => new Element());
  const menu = new Element(), trigger = new Element();
  trigger.focus();
  const win = Object.assign(new EventTarget(), { innerWidth: 320, innerHeight: 568, clearTimeout() {} });
  const controller = new AbortController();
  const runtime = new Function("menu", "document", "window", "HTMLElement", "Element", "Node", "items", "signal", "getKisaraScale", `
    let returnFocus = null, menuSession = 0;
    const panelButton = null, clearFeedback = () => {}, closePanel = () => {};
    ${between("  const closeMenu =", '  panelButton?.addEventListener("click"')}
    return { showMenu, closeMenu, keepNativeMenu, session: () => menuSession };
  `)(menu, doc, win, Element, Element, Element, items, controller.signal, () => scale);
  return { runtime, menu, trigger, items, doc, win, Element, destroy: () => controller.abort() };
}

function layoutFixture() {
  class Element extends EventTarget {
    tagName = "div";
    controls = false;
    dataset: Record<string, string> = {};
    classList = { contains() { return false; } };
    style: any = { setProperty(key: string, value: string) { this[key] = value; } };
    offsetWidth = 292;
    offsetHeight = 368;
    opens = 0;
    private concealed = true;
    get hidden() { return this.concealed; }
    set hidden(value: boolean) { this.concealed = value; if (!value) this.opens++; }
    contains(node: unknown) { return node === this; }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    closest(selector: string) {
      return selector.split(",").some(part => {
        const [tag, attribute] = part.trim().split("[");
        return tag === this.tagName && (!attribute || (attribute === "controls]" && this.controls));
      }) ? this : null;
    }
  }
  let menu = new Element();
  const doc = Object.assign(new EventTarget(), {
    body: new Element(), documentElement: { dataset: { theme: "kisara" } }, activeElement: null,
    querySelector(selector: string) { return selector === "[data-kisara-context-menu]" ? menu : null; },
  });
  const win = Object.assign(new EventTarget(), {
    innerWidth: 1200, innerHeight: 800, clearTimeout() {},
    selection: "", getSelection() { return this.selection; },
    __yuimiKisaraLayoutCleanup: null as null | (() => void),
  });
  new Function("document", "window", "HTMLElement", "Element", "Node", "getKisaraScale", "requestAnimationFrame", "cancelAnimationFrame",
    source.slice(source.indexOf("const clamp =")).replace("export const initKisaraLayoutRuntime", "const initKisaraLayoutRuntime")
  )(doc, win, Element, Element, Element, () => 1, () => 1, () => {});
  return {
    doc, win, Element, get menu() { return menu; },
    swap(theme = "kisara") {
      doc.dispatchEvent(new Event("astro:before-swap"));
      doc.body = new Element();
      menu = new Element();
      doc.documentElement.dataset.theme = theme;
      doc.dispatchEvent(new Event("astro:after-swap"));
    },
    rightClick(target = doc.body, shiftKey = false) {
      const event = Object.assign(new Event("contextmenu", { cancelable: true }), { clientX: 100, clientY: 120, shiftKey });
      Object.defineProperty(event, "target", { value: target });
      win.dispatchEvent(event);
      return event;
    },
    destroy() { win.__yuimiKisaraLayoutCleanup?.(); },
  };
}

test("Menu is ready immediately after each body swap, before page scripts finish, without duplicate handlers", () => {
  const f = layoutFixture();
  try {
    assert.equal(f.rightClick().defaultPrevented, true);
    for (let navigation = 0; navigation < 3; navigation++) {
      const previousMenu = f.menu;
      const previousOpens = previousMenu.opens;
      f.swap();
      assert.equal(previousMenu.hidden, true);
      assert.equal(f.rightClick().defaultPrevented, true);
      assert.equal(f.menu.hidden, false);
      assert.equal(f.menu.opens, 1);
      f.doc.dispatchEvent(new Event("astro:page-load"));
      f.rightClick();
      assert.equal(f.menu.opens, 2);
      assert.equal(previousMenu.opens, previousOpens);
    }
    f.swap("fuyukawa-kagari");
    assert.equal(f.rightClick().defaultPrevented, false);
    assert.equal(f.menu.hidden, true);
    f.swap();
    assert.equal(f.rightClick().defaultPrevented, true);
  } finally { f.destroy(); }
});

test("Decorative media opens the custom menu while media controls retain native actions", () => {
  const f = layoutFixture();
  try {
    for (const tagName of ["video", "audio"]) {
      const media = new f.Element();
      media.tagName = tagName;
      assert.equal(f.rightClick(media).defaultPrevented, true);
      assert.equal(f.menu.hidden, false);
      media.controls = true;
      assert.equal(f.rightClick(media).defaultPrevented, false);
      assert.equal(f.menu.hidden, true);
    }
  } finally { f.destroy(); }
});

test("Shift, selected text and form inputs still retain the native context menu", () => {
  const f = layoutFixture();
  try {
    f.rightClick();
    assert.equal(f.rightClick(f.doc.body, true).defaultPrevented, false);
    assert.equal(f.menu.hidden, true);
    f.win.selection = "selected text";
    assert.equal(f.rightClick().defaultPrevented, false);
    f.win.selection = "";
    for (const tagName of ["input", "textarea", "select"]) {
      const input = new f.Element();
      input.tagName = tagName;
      assert.equal(f.rightClick(input).defaultPrevented, false);
    }
    assert.equal(f.rightClick().defaultPrevented, true);
  } finally { f.destroy(); }
});

test("Context menu uses final dimensions and preserves the original focus across repeated openings", () => {
  const f = fixture();
  try {
    f.runtime.showMenu(319, 567, true);
    assert.equal(f.menu.style.left, "16px");
    assert.equal(f.menu.style.top, "188px");
    assert.equal(f.menu.style["--menu-origin"], "right bottom");
    assert.equal(f.doc.activeElement, f.items[1]);
    f.runtime.showMenu(-10, -20, true);
    assert.equal(f.menu.style.left, "12px");
    assert.equal(f.menu.style.top, "12px");
    f.runtime.closeMenu();
    assert.equal(f.doc.activeElement, f.trigger);
    assert.equal(f.menu.hidden, true);
  } finally { f.destroy(); }
});

test("Context menu arrow keys wrap, Home/End select boundaries and Tab dismisses", () => {
  const f = fixture();
  const key = (value: string) => f.menu.dispatchEvent(Object.assign(new Event("keydown", { cancelable: true }), { key: value }));
  try {
    f.runtime.showMenu(30, 30, true);
    key("Home");
    assert.equal(f.doc.activeElement, f.items[0]);
    key("ArrowUp");
    assert.equal(f.doc.activeElement, f.items.at(-1));
    key("ArrowDown");
    assert.equal(f.doc.activeElement, f.items[0]);
    key("End");
    assert.equal(f.doc.activeElement, f.items.at(-1));
    key("Tab");
    assert.equal(f.menu.hidden, true);
  } finally { f.destroy(); }
});

test("Context menu converts viewport positions to the 90 percent theme coordinate space", () => {
  const f = fixture(.9);
  try {
    f.runtime.showMenu(319, 567);
    const left = Number.parseFloat(f.menu.style.left);
    const top = Number.parseFloat(f.menu.style.top);
    assert.ok(Math.abs((left + f.menu.offsetWidth + 12) * .9 - 320) < .001);
    assert.ok(Math.abs((top + f.menu.offsetHeight + 12) * .9 - 568) < .001);
    f.runtime.showMenu(100, 110);
    assert.ok(Number.parseFloat(f.menu.style.left) * .9 <= 100);
  } finally { f.destroy(); }
});

test("Context menu preserves editable targets and closes on viewport change without reviving focus on blur", () => {
  const f = fixture();
  try {
    const input = new f.Element();
    input.attributes.native = "true";
    assert.equal(f.runtime.keepNativeMenu(input), true);
    assert.equal(f.runtime.keepNativeMenu(f.trigger), false);
    f.runtime.showMenu(10, 10);
    f.win.dispatchEvent(new Event("resize"));
    assert.equal(f.menu.hidden, true);
    f.runtime.showMenu(10, 10, true);
    f.win.dispatchEvent(new Event("blur"));
    assert.equal(f.menu.hidden, true);
    assert.notEqual(f.doc.activeElement, f.trigger);
  } finally { f.destroy(); }
});

test("Menu copy feedback keeps labels stable and rejects completion after close or navigation", () => {
  const feedback = between("  const showActionFeedback =", "  const closeMenu =");
  assert.doesNotMatch(feedback, /textContent/);
  assert.match(feedback, /clearTimeout\(feedbackTimer\)/);
  assert.match(source, /signal\.aborted \|\| menu\?\.hidden \|\| session !== menuSession/);
  assert.match(source, /event\.shiftKey \|\| keepNativeMenu\(event\.target\) \|\| window\.getSelection/);
  assert.match(source, /action === "copy-title" \? document\.title/);
  assert.match(between("  const cleanup =", "  window.__yuimiKisaraLayoutCleanup = cleanup;"), /clearFeedback\(\)/);
});

test("Late clipboard results cannot write feedback into a closed, reopened or disposed menu", async () => {
  for (const interruption of ["closed", "reopened", "disposed", "none"]) {
    let resolve!: (value: boolean) => void;
    const task = new Promise<boolean>(done => { resolve = done; });
    const feedback: any[] = [];
    const menu = { hidden: false }, signal = { aborted: false };
    const runtime = new Function("menu", "signal", "task", "feedback", `
      let menuSession = 1;
      const action = "copy-title", document = { title: "Test title" }, window = { location: { href: "/" } };
      const copyText = () => task, showActionFeedback = (...args) => feedback.push(args);
      return {
        reopen: () => { menuSession++; },
        run: async () => { ${between('    if (action === "copy" || action === "copy-title")', "    if (action) closeMenu();")} }
      };
    `)(menu, signal, task, feedback);
    const pending = runtime.run();
    if (interruption === "closed") menu.hidden = true;
    if (interruption === "reopened") runtime.reopen();
    if (interruption === "disposed") signal.aborted = true;
    resolve(true);
    await pending;
    assert.equal(feedback.length, interruption === "none" ? 1 : 0);
  }
});

test("Menu palette and layer stay stable regardless of theme stylesheet loading order", () => {
  const theme = postcss.parse(read("src/themes/kisara/styles/theme.css"));
  const menu = postcss.parse(read("src/themes/kisara/styles/context-menu.css"));
  for (const sheets of [[theme, menu], [menu, theme], [menu, theme, menu, theme]]) {
    const declarations = (selector: string) => {
      const result = new Map<string, string>();
      for (const sheet of sheets) {
        for (const rule of sheet.nodes) {
          if (rule.type === "rule" && rule.selectors.includes(selector)) {
            rule.walkDecls(decl => { result.set(decl.prop, decl.value); });
          }
        }
      }
      return result;
    };
    const menuStyle = declarations(".kisara-context-menu");
    assert.equal(menuStyle.get("color"), "var(--menu-ink)");
    assert.equal(menuStyle.get("--menu-ink"), "#303137");
    assert.equal(menuStyle.get("background"), "#fcfcfd");
    assert.equal(menuStyle.get("z-index"), "10060");
    assert.equal(menuStyle.get("max-height"), "calc(calc(100dvh / var(--kisara-scale, 1)) - 24px)");
    const panelStyle = declarations(".kisara-theme-panel");
    assert.equal(panelStyle.get("color"), "#f8f5ff");
    assert.ok(panelStyle.get("background")?.endsWith("#171c40"));
  }
});

test("Kisara menu has five route links, all theme choices and no legacy glass layers", () => {
  const layout = read("src/themes/kisara/layouts/KisaraLayout.astro");
  const css = read("src/themes/kisara/styles/context-menu.css");
  const menu = layout.slice(layout.indexOf('<nav class="kisara-context-menu"'), layout.indexOf("<ThemeLongPressMenu"));
  assert.match(menu, /navItems\.map/);
  assert.match(menu, /themeOptions\.map/);
  assert.match(menu, /aria-current=\{item\.active/);
  assert.match(menu, /role="status"/);
  assert.match(css, /overflow: auto/);
  assert.doesNotMatch(css, /backdrop-filter|filter:|gradient|infinite/);
  assert.doesNotMatch(read("src/themes/kisara/styles/theme.css"), /kisara-context-command-grid|kisara-context-compact-arrive/);
});
