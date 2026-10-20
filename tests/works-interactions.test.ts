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
  dispatch(name: string, target: Node = this) {
    this.listeners.get(name)?.forEach((listener) => listener({ target, type: name }));
  }
  map(selector: string, nodes: Node[]) {
    this.selectors.set(selector, nodes);
    for (const node of nodes) node.parent = this;
    return nodes;
  }
}

function kisaraFixture(search = "") {
  const root = new Node();
  const document = new Node();
  const buttons = root.map("[data-works-filter]", [
    new Node({ worksFilter: "all" }),
    ...["blog", "astrbot", "codex", "web", "guide"].map((worksFilter) => new Node({ worksFilter }))
  ]);
  const cards = root.map("[data-project-line]", projectEntries.map((project) =>
    new Node({ projectLine: project.line, projectId: project.id })
  ));
  const [count] = root.map("[data-works-count]", [new Node()]);
  const [empty] = root.map("[data-works-empty]", [new Node()]);
  const bind = vm.runInNewContext(
    read("src/themes/kisara/lib/worksIndex.js").replace("export function", "function") + "\nbindWorksIndex",
    { document, HTMLElement: Node, Element: Node, URLSearchParams, window: { location: { search } } }
  );
  const cleanup = bind(root);
  return { root, document, buttons, cards, count, empty, cleanup };
}

test("Kisara runtime keeps all ten projects, line counts and selected cards in sync", () => {
  const fixture = kisaraFixture();
  const { root, buttons, cards, count, empty } = fixture;
  assert.equal(count.textContent, "10");
  assert.equal(cards.filter((card) => !card.hidden).length, 10);
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
  assert.equal(count.textContent, "10");
});

test("Kisara accepts valid deep links, ignores unknown lines and preserves native links", () => {
  const valid = kisaraFixture("?line=blog");
  assert.equal(valid.count.textContent, "01");
  assert.equal(valid.cards.find((card) => !card.hidden)?.dataset.projectId, "yuimi-blog");
  const invalid = kisaraFixture("?line=missing");
  assert.equal(invalid.count.textContent, "10");
  const link = new Node();
  link.parent = invalid.cards[1];
  invalid.root.dispatch("focusin", link);
  assert.equal(invalid.root.dataset.selectedProject, invalid.cards[1].dataset.projectId);
  invalid.root.dispatch("click", link);
  assert.equal(invalid.count.textContent, "10");
  invalid.document.dispatch("astro:before-swap");
  assert.ok([...invalid.root.listeners.values()].every((listeners) => listeners.size === 0));
  assert.equal(invalid.document.listeners.get("astro:before-swap")?.size, 0);
  assert.doesNotThrow(() => invalid.cleanup());
});

function fuyukawaFixture(search = "") {
  const root = new Node();
  const document = new Node();
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
    const [details] = entry.map("details", [new Node()]);
    details.setAttribute("open", "");
    return entry;
  }));
  const photos = root.map("[data-photo]", chapterLabels.map(([photo]) => new Node({ photo })));
  const [caption] = root.map("[data-photo-caption]", [new Node()]);
  const [note] = root.map("[data-photo-note]", [new Node()]);
  const [ribbon] = root.map("[data-works-ribbon]", [new Node()]);
  const [total] = root.map("[data-works-total]", [new Node()]);
  const [empty] = root.map("[data-works-empty]", [new Node()]);
  const script = read("src/themes/fuyukawa-kagari/pages/ProjectsPage.astro")
    .match(/<script>([\s\S]*?)<\/script>/)![1];
  vm.runInNewContext(stripTypeScriptTypes(script), {
    document, Element: Node, URLSearchParams, window: { location: { search } }
  });
  document.dispatch("astro:page-load");
  return { root, document, buttons, entries, photos, caption, note, ribbon, total, empty };
}

test("Fuyukawa chapters update rows, cover, caption, count and accessible state together", () => {
  const { root, buttons, entries, photos, caption, note, ribbon, total, empty } = fuyukawaFixture();
  assert.equal(total.textContent, "10");
  const counts = [10, 1, 3, 3, 3];
  for (let index = 0; index < buttons.length; index++) {
    root.dispatch("click", buttons[index].querySelector("strong")!);
    const key = buttons[index].dataset.worksChapter;
    assert.equal(entries.filter((entry) => !entry.hidden).length, counts[index]);
    assert.equal(total.textContent, String(counts[index]));
    assert.equal(root.dataset.chapter, key);
    assert.equal(photos.filter((photo) => photo.classes.has("is-current")).length, 1);
    assert.equal(photos.find((photo) => photo.classes.has("is-current"))?.dataset.photo, key);
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
  assert.equal(fixture.total.textContent, "3");
  assert.equal(fixture.root.dataset.chapter, "codex");
  for (let index = 0; index < 4; index++) fixture.document.dispatch("astro:page-load");
  assert.equal(fixture.root.listeners.get("click")?.size, 1);
  fixture.document.dispatch("astro:before-swap");
  assert.equal(fixture.root.listeners.get("click")?.size, 0);
  assert.equal(fixture.root.dataset.worksBound, undefined);
  fixture.document.dispatch("astro:page-load");
  assert.equal(fixture.root.listeners.get("click")?.size, 1);
  assert.equal(fixture.total.textContent, "3");
  const invalid = fuyukawaFixture("?chapter=missing");
  assert.equal(invalid.total.textContent, "10");
  assert.equal(invalid.root.dataset.chapter, "all");
});
