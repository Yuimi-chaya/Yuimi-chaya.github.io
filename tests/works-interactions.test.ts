import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";
import { projectEntries } from "../src/core/data/projects.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Both Works pages and route labels only use icons included by Astro", () => {
  const config = read("astro.config.mjs");
  const source = [
    "src/themes/kisara/pages/ProjectsPage.astro",
    "src/themes/fuyukawa-kagari/pages/ProjectsPage.astro",
    "src/themes/kisara/data/openingRoutes.ts"
  ].map(read).join("\n");
  for (const [, namespace, name] of source.matchAll(/(?:name|icon)\s*(?:=|:)\s*"(tabler|simple-icons):([^"]+)"/g)) {
    const list = config.match(new RegExp(`(?:"${namespace}"|${namespace}): \\[([^\\]]+)\\]`))![1];
    assert.ok(list.includes(`"${name}"`), `Icon not included: ${namespace}:${name}`);
  }
});

class Node {
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  selectors = new Map<string, Node[]>();
  listeners = new Map<string, Set<(event: any) => void>>();
  parent: Node | null = null;
  textContent = "";
  hidden = false;
  disabled = false;
  matches = false;
  focusCalls = 0;
  classes = new Set<string>();
  classList = {
    toggle: (name: string, enabled: boolean) => {
      if (enabled) this.classes.add(name);
      else this.classes.delete(name);
      return enabled;
    },
    remove: (name: string) => this.classes.delete(name)
  };

  constructor(dataset: Record<string, string> = {}, text = "") {
    this.dataset = dataset;
    this.textContent = text;
  }

  querySelector(selector: string) { return this.selectors.get(selector)?.[0] ?? null; }
  querySelectorAll(selector: string) { return this.selectors.get(selector) ?? []; }
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  focus() { this.focusCalls++; }
  contains(node: Node): boolean { return node === this || !!node.parent && this.contains(node.parent); }
  closest(selector: string): Node | null {
    const key = selector.match(/^\[data-([\w-]+)\]$/)?.[1]
      .replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    if (key && key in this.dataset) return this;
    return this.parent?.closest(selector) ?? null;
  }
  addEventListener(name: string, listener: (event: any) => void) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name)!.add(listener);
  }
  removeEventListener(name: string, listener: (event: any) => void) {
    this.listeners.get(name)?.delete(listener);
  }
  dispatch(name: string, target: Node = this, detail = 1) {
    this.listeners.get(name)?.forEach((listener) => listener({ target, type: name, detail }));
  }
  map(selector: string, nodes: Node[]) {
    this.selectors.set(selector, nodes);
    for (const node of nodes) node.parent = this;
    return nodes;
  }
}

function addPager(root: Node) {
  const [pager] = root.map("[data-works-pagination]", [new Node()]);
  const [range] = root.map("[data-works-range]", [new Node()]);
  const [previous] = root.map('[data-works-page="prev"]', [new Node({ worksPage: "prev" })]);
  const [next] = root.map('[data-works-page="next"]', [new Node({ worksPage: "next" })]);
  return { pager, range, previous, next };
}

function kisaraFixture(search = "", mobile = false) {
  const root = new Node();
  const document = new Node();
  const compact = new Node();
  compact.matches = mobile;
  const pager = addPager(root);
  const buttons = root.map("[data-works-filter]", [
    new Node({ worksFilter: "all" }),
    ...["blog", "astrbot", "codex", "web", "guide"].map((worksFilter) => new Node({ worksFilter }))
  ]);
  const cards = root.map("[data-project-line]", projectEntries.map((project) => {
    const card = new Node({ projectLine: project.line, projectId: project.id });
    card.map("details", [new Node()]);
    card.map("a, summary", [new Node()]);
    return card;
  }));
  const [count] = root.map("[data-works-count]", [new Node()]);
  const [empty] = root.map("[data-works-empty]", [new Node()]);
  const bind = vm.runInNewContext(
    read("src/themes/kisara/lib/worksIndex.js").replace("export function", "function") + "\nbindWorksIndex",
    { document, HTMLElement: Node, Element: Node, URLSearchParams, window: { location: { search }, matchMedia: () => compact } }
  );
  const cleanup = bind(root);
  return { root, document, buttons, cards, count, empty, cleanup, compact, ...pager };
}

test("Kisara runtime keeps the seven-project archive, pages and line counts in sync", () => {
  const fixture = kisaraFixture();
  const { root, buttons, cards, count, empty } = fixture;
  assert.equal(count.textContent, "07");
  assert.equal(cards.filter((card) => !card.hidden).length, 4);
  for (const line of ["blog", "astrbot", "codex", "web", "guide"]) {
    const button = buttons.find((item) => item.dataset.worksFilter === line)!;
    root.dispatch("click", button);
    const visible = cards.filter((card) => !card.hidden);
    assert.equal(visible.length, projectEntries.filter((project) => project.line === line).length);
    assert.ok(visible.every((card) => card.dataset.projectLine === line));
    assert.equal(count.textContent, String(visible.length).padStart(2, "0"));
    assert.equal(button.attributes.get("aria-pressed"), "true");
    assert.equal(buttons.filter((item) => item.attributes.get("aria-pressed") === "true").length, 1);
    assert.equal(root.dataset.selectedProject, visible[0].dataset.projectId);
    assert.equal(empty.hidden, true);
  }
  root.dispatch("click", buttons[0]);
  assert.equal(count.textContent, "07");
});

test("Kisara accepts valid deep links, ignores unknown lines and preserves native links", () => {
  const valid = kisaraFixture("?line=blog");
  assert.equal(valid.count.textContent, "01");
  assert.equal(valid.cards.find((card) => !card.hidden)?.dataset.projectId, "yuimi-blog");
  const invalid = kisaraFixture("?line=missing");
  assert.equal(invalid.count.textContent, "07");
  const link = new Node();
  link.parent = invalid.cards[1];
  invalid.root.dispatch("focusin", link);
  assert.equal(invalid.root.dataset.selectedProject, invalid.cards[1].dataset.projectId);
  invalid.root.dispatch("click", link);
  assert.equal(invalid.count.textContent, "07");
  invalid.document.dispatch("astro:before-swap");
  assert.ok([...invalid.root.listeners.values()].every((listeners) => listeners.size === 0));
  assert.equal(invalid.document.listeners.get("astro:before-swap")?.size, 0);
  assert.doesNotThrow(() => invalid.cleanup());
});

function fuyukawaFixture(search = "", mobile = false) {
  const root = new Node();
  const document = new Node();
  const compact = new Node();
  compact.matches = mobile;
  const pager = addPager(root);
  document.map("[data-yuimi-works]", [root]);
  const chapterLabels = [
    ["all", "全部条目", "ALL ENTRIES"],
    ["blog", "站点手记", "SITE JOURNAL"],
    ["astrbot", "机器人便签", "BOT NOTES"],
    ["codex", "工具夹层", "TOOLING"],
    ["notes", "经验页", "FIELD NOTES"]
  ];
  const buttons = root.map("[data-works-chapter]", chapterLabels.map(([key, label, english], index) => {
    const button = new Node({ worksChapter: key });
    button.map("strong", [new Node({}, label)]);
    button.map("span", [new Node({}, String(index).padStart(2, "0"))]);
    button.map("small", [new Node({}, english)]);
    return button;
  }));
  const entries = root.map("[data-project-chapter]", projectEntries.map((project) => {
    const chapter = ["guide", "web"].includes(project.line) ? "notes" : project.line;
    const entry = new Node({ projectChapter: chapter });
    entry.map("summary", [new Node()]);
    const [details] = entry.map("details", [new Node()]);
    details.setAttribute("open", "");
    return entry;
  }));
  const photos = root.map("[data-photo]", chapterLabels.slice(1).map(([photo]) => new Node({ photo })));
  const [caption] = root.map("[data-photo-caption]", [new Node()]);
  const [note] = root.map("[data-photo-note]", [new Node()]);
  const [ribbon] = root.map("[data-works-ribbon]", [new Node()]);
  const [total] = root.map("[data-works-total]", [new Node()]);
  const [empty] = root.map("[data-works-empty]", [new Node()]);
  const script = read("src/themes/fuyukawa-kagari/pages/ProjectsPage.astro")
    .match(/<script>([\s\S]*?)<\/script>/)![1];
  vm.runInNewContext(stripTypeScriptTypes(script), {
    document, Element: Node, URLSearchParams, window: { location: { search }, matchMedia: () => compact }
  });
  document.dispatch("astro:page-load");
  return { root, document, buttons, entries, photos, caption, note, ribbon, total, empty, compact, ...pager };
}

test("Fuyukawa chapters update rows, cover, caption, count and accessible state together", () => {
  const { root, buttons, entries, photos, caption, note, ribbon, total, empty } = fuyukawaFixture();
  assert.equal(total.textContent, "7");
  const counts = [7, 1, 1, 2, 3];
  for (let index = 0; index < buttons.length; index++) {
    root.dispatch("click", buttons[index].querySelector("strong")!);
    const key = buttons[index].dataset.worksChapter;
    assert.equal(entries.filter((entry) => !entry.hidden).length, Math.min(counts[index], 4));
    assert.equal(total.textContent, String(counts[index]));
    assert.equal(root.dataset.chapter, key);
    assert.equal(photos.filter((photo) => photo.classes.has("is-current")).length, 1);
    assert.equal(photos.find((photo) => photo.classes.has("is-current"))?.dataset.photo, key === "all" ? "notes" : key);
    assert.equal(caption.textContent, `${String(index).padStart(2, "0")} / ${buttons[index].querySelector("strong")!.textContent}`);
    assert.equal(ribbon.textContent, buttons[index].querySelector("small")!.textContent);
    assert.ok(note.textContent.length > 10);
    assert.equal(empty.hidden, true);
    assert.equal(buttons[index].attributes.get("aria-pressed"), "true");
  }
  assert.ok(entries.filter((entry) => entry.hidden).every((entry) =>
    !entry.querySelector("details")!.attributes.has("open")
  ));
});

test("Fuyukawa direct links, repeated page loads and leaving the page remain bounded", () => {
  const fixture = fuyukawaFixture("?chapter=codex");
  assert.equal(fixture.total.textContent, "2");
  assert.equal(fixture.root.dataset.chapter, "codex");
  for (let index = 0; index < 4; index++) fixture.document.dispatch("astro:page-load");
  assert.equal(fixture.root.listeners.get("click")?.size, 1);
  fixture.document.dispatch("astro:before-swap");
  assert.equal(fixture.root.listeners.get("click")?.size, 0);
  assert.equal(fixture.root.dataset.worksBound, undefined);
  fixture.document.dispatch("astro:page-load");
  assert.equal(fixture.root.listeners.get("click")?.size, 1);
  assert.equal(fixture.total.textContent, "2");
  const invalid = fuyukawaFixture("?chapter=missing");
  assert.equal(invalid.total.textContent, "7");
  assert.equal(invalid.root.dataset.chapter, "all");
});

test("both Works pagers cover every retained project without duplicates, overrun or wheel interception", () => {
  for (const theme of ["kisara", "fuyukawa"]) {
    const fixture = theme === "kisara" ? kisaraFixture() : fuyukawaFixture();
    const items = "cards" in fixture ? fixture.cards : fixture.entries;
    const seen = new Set<Node>();
    assert.equal(fixture.previous.disabled, true);
    assert.equal(fixture.range.textContent, "1–4 / 7");
    assert.equal(fixture.pager.hidden, false);
    items.filter((item) => !item.hidden).forEach((item) => seen.add(item));
    const [first] = items;
    first.querySelector("details")!.setAttribute("open", "");
    fixture.root.dispatch("click", fixture.next);
    assert.equal(fixture.range.textContent, "5–7 / 7");
    assert.equal(fixture.next.disabled, true);
    assert.equal(first.querySelector("details")!.attributes.has("open"), false);
    items.filter((item) => !item.hidden).forEach((item) => seen.add(item));
    assert.equal(seen.size, projectEntries.length);
    fixture.root.dispatch("click", fixture.next);
    assert.equal(fixture.range.textContent, "5–7 / 7");
    fixture.root.dispatch("click", fixture.previous);
    assert.equal(fixture.range.textContent, "1–4 / 7");
    assert.equal(fixture.root.listeners.has("wheel"), false);
    assert.equal(fixture.root.listeners.has("scroll"), false);
  }
});

test("both pagers reset on filtering and preserve the first item across responsive resize", () => {
  for (const theme of ["kisara", "fuyukawa"]) {
    const fixture = theme === "kisara" ? kisaraFixture("", true) : fuyukawaFixture("", true);
    const items = "cards" in fixture ? fixture.cards : fixture.entries;
    assert.equal(items.filter((item) => !item.hidden).length, 2);
    assert.equal(fixture.range.textContent, "1–2 / 7");
    fixture.root.dispatch("click", fixture.next);
    fixture.root.dispatch("click", fixture.next);
    assert.equal(fixture.range.textContent, "5–6 / 7");
    fixture.compact.matches = false;
    fixture.compact.dispatch("change");
    assert.equal(fixture.range.textContent, "5–7 / 7");
    fixture.root.dispatch("click", fixture.buttons[1]);
    assert.equal(fixture.range.textContent, "1–1 / 1");
    assert.equal(fixture.pager.hidden, true);
    fixture.root.dispatch("click", fixture.buttons[0]);
    assert.equal(fixture.range.textContent, "1–4 / 7");
    fixture.document.dispatch("astro:before-swap");
    assert.equal(fixture.compact.listeners.get("change")?.size, 0);
    if (theme === "fuyukawa") {
      fixture.document.dispatch("astro:page-load");
      assert.equal(fixture.compact.listeners.get("change")?.size, 1);
    }
  }
});

test("keyboard pagination enters the new page and resizing never strands focus on a hidden project", () => {
  for (const theme of ["kisara", "fuyukawa"]) {
    const fixture = theme === "kisara" ? kisaraFixture() : fuyukawaFixture();
    const items = "cards" in fixture ? fixture.cards : fixture.entries;
    const selector = theme === "kisara" ? "a, summary" : "summary";
    fixture.root.dispatch("click", fixture.next, 0);
    assert.equal(items[4].querySelector(selector)!.focusCalls, 1);
    fixture.root.dispatch("click", fixture.previous, 1);
    assert.equal(items[0].querySelector(selector)!.focusCalls, 0, "pointer pagination must not move focus");
    const focused = items[3].querySelector(selector)!;
    (fixture.document as Node & { activeElement: Node }).activeElement = focused;
    fixture.compact.matches = true;
    fixture.compact.dispatch("change");
    assert.equal(items[3].hidden, true);
    assert.equal(items[0].querySelector(selector)!.focusCalls, 1);
  }
});

test("Works layouts stay compact, keep all content without JS and support reduced-motion and keyboard input", () => {
  const kisara = read("src/themes/kisara/pages/ProjectsPage.astro");
  const fuyukawa = read("src/themes/fuyukawa-kagari/pages/ProjectsPage.astro");
  for (const page of [kisara, fuyukawa]) {
    assert.match(page, /data-works-pagination[^>]*hidden/);
    assert.doesNotMatch(page, /hidden=\{.*(?:page|index|project)/);
    assert.doesNotMatch(page, /addEventListener\("wheel"|preventDefault\(|scrollTo\(/);
    assert.match(page, /name="(?:kisara|fuyukawa)-project-notes"/);
  }
  const css = read("src/themes/fuyukawa-kagari/styles/works.css");
  assert.match(css, /\.yuimi-works-list \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.yuimi-works-photo \{[^}]*position: relative;/);
  assert.match(css, /data-works-input="keyboard"[^}]*transition: none/);
  assert.match(css, /opacity 200ms var\(--manga-ease\)/);
  const fixture = fuyukawaFixture();
  fixture.root.dispatch("click", fixture.buttons[2], 0);
  assert.equal(fixture.root.dataset.worksInput, "keyboard");
  fixture.root.dispatch("click", fixture.buttons[3], 1);
  assert.equal(fixture.root.dataset.worksInput, "pointer");
});
