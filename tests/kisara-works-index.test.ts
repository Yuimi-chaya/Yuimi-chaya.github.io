import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";
import { projectEntries, projectTechLines } from "../src/core/data/projects.ts";
import sharp from "sharp";
import postcss from "postcss";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path: string) => existsSync(new URL(`../${path}`, import.meta.url));
const page = read("src/themes/kisara/pages/ProjectsPage.astro");
const styles = read("src/themes/kisara/styles/projects.css");
const runtime = read("src/themes/kisara/lib/worksIndex.js");

test("Kisara Works presents the real repository archive and keeps every link in the page", () => {
  assert.equal(projectEntries.length, 7);
  assert.equal(new Set(projectEntries.map((project) => project.id)).size, 7);
  for (const removed of ["jp-tts", "memory-bridge", "codex-browser-patch"]) {
    assert.ok(!projectEntries.some((project) => project.id === removed));
  }
  for (const project of projectEntries) {
    assert.match(project.href, /^https:\/\/github\.com\/Yuimi-chaya\//);
    assert.ok(project.summary.length > 20, project.id);
    assert.ok(project.note.length > 10, project.id);
  }
  assert.match(page, /class="kisara-index-card-link" href=\{project\.href\}/);
  assert.match(page, /featured\.demo &&/);
  assert.match(page, /https:\/\/github\.com\/Yuimi-chaya/);
  assert.doesNotMatch(page, /kisara-kitchen-lab|kisara-drink-title|data-kisara-works-hero/);
});

test("Kisara Works filters are derived from the shared project lines", () => {
  assert.match(page, /const archive = projects;/);
  assert.doesNotMatch(page, /projects\.slice\(1\)/);
  for (const line of projectTechLines) {
    assert.match(page, new RegExp(`data-works-filter=\{line\\.key\}`));
    assert.ok(projectEntries.some((project) => project.line === line.key), line.key);
  }
  assert.match(runtime, /card\.dataset\.projectLine === line/);
  assert.match(runtime, /count\.textContent = String\(shown\)/);
  assert.match(runtime, /empty\.hidden = shown !== 0/);
  assert.match(page, /aria-live="polite"/);
});

test("Kisara project cards use list semantics rather than listbox options around links", () => {
  assert.match(page, /class="kisara-index-grid" role="list"/);
  assert.match(page, /role="listitem"/);
  assert.doesNotMatch(page, /role="listbox"|role="option"|aria-selected/);
  assert.doesNotMatch(runtime, /aria-selected|tabIndex/);
  assert.match(styles, /\.kisara-index-card:focus-within/);
});

test("Kisara Works keeps the four supplied covers with compact local assets", async () => {
  const heights = [1051, 874, 1051, 1051];
  for (const index of [1, 2, 3, 4]) {
    const path = `public/themes/kisara/assets/works-index/work-0${index}.webp`;
    assert.ok(exists(path), path);
    assert.ok(statSync(new URL(`../${path}`, import.meta.url)).size < 170_000, path);
    const { width, height } = await sharp(readFileSync(new URL(`../${path}`, import.meta.url))).metadata();
    assert.deepEqual([width, height], [720, heights[index - 1]], path);
  }
  assert.match(page, /const covers = \[/);
  assert.match(page, /cover: covers\[index % covers\.length\]/);
  assert.match(page, /height=\{project\.coverHeight\}/);
});

test("Kisara Works keeps filters and selection usable without hover-only content", () => {
  assert.match(styles, /\.kisara-index-card-reveal \{/);
  assert.match(page, /<details class="kisara-index-card-reveal" name="kisara-project-notes">/);
  assert.match(page, /<summary>/);
  assert.match(styles, /\.kisara-index-card-reveal\[open\] summary svg/);
  assert.match(styles, /\.kisara-index-card\[hidden\]/);
  assert.match(styles, /\.kisara-index-empty\[hidden\]/);
  assert.doesNotMatch(runtime, /preventDefault|is-open/);
  assert.match(runtime, /preset = new URLSearchParams\(window\.location\.search\)\.get\("line"\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});

test("Kisara Works deep links point at the current page sections", () => {
  const routes = read("src/themes/kisara/data/openingRoutes.ts");
  assert.match(routes, /#kisara-archive/);
  assert.match(routes, /#kisara-feature-title/);
  assert.doesNotMatch(routes, /kisara-kitchen-lab|kisara-drink-title|刀切测试|技术食材|实验配方/);
});

test("Works keeps the preferred English masthead and real project-side notes without portfolio statistics", () => {
  assert.match(page, /kisara-index-title-main">WORKS/);
  assert.match(page, /kisara-index-title-tail">built in <span>layers\.<\/span>/);
  assert.match(page, /id="kisara-works-heading" lang="en"/);
  assert.doesNotMatch(page, /FILES MATCHED|FILTER BY LINE|FEATURED FILE|kisara-index-stats|distinctLanguages/);
  assert.match(page, /class="kisara-index-workbench"[\s\S]*class="kisara-index-sidebar"[\s\S]*class="kisara-index-archive"/);
  assert.match(page, /data-works-margin-quote>\{featured\.note\}/);
  assert.match(page, /data-project-note=\{project\.note\}/);
  assert.match(page, /data-project-title=\{project\.title\}/);
  assert.doesNotMatch(page, /project\.stars/);
  assert.match(page, /为什么做它/);
});

test("Works retains the accepted art framing without a second override at a breakpoint", () => {
  const css = postcss.parse(styles);
  let ratio = 0;
  let fit = 0;
  let focus = 0;
  let blend = 0;
  css.walkRules((rule) => {
    if (rule.selector === ".kisara-index-card") rule.walkDecls("grid-template-columns", (decl) => {
      assert.equal(decl.value, "minmax(0, 2fr) minmax(0, 3fr)");
      ratio++;
    });
    if (rule.selector === ".kisara-index-card-art img") {
      rule.walkDecls("object-fit", (decl) => { assert.equal(decl.value, "cover"); fit++; });
      rule.walkDecls("object-position", (decl) => { assert.equal(decl.value, "50% 28%"); focus++; });
    }
    if (rule.selector === ".kisara-index-card-art::after") rule.walkDecls("background", (decl) => {
      assert.equal(decl.value, "linear-gradient(90deg, transparent 66%, var(--index-card-paper))");
      blend++;
    });
  });
  assert.deepEqual([ratio, fit, focus, blend], [1, 1, 1, 1]);
});

test("Works mobile rules follow descending breakpoints and reduce covers every new motion target", () => {
  const css = postcss.parse(styles);
  const widths: number[] = [];
  let reduced = "";
  css.walkAtRules("media", (rule) => {
    const width = rule.params.match(/^\(max-width: (\d+)px\)$/)?.[1];
    if (width) widths.push(Number(width));
    if (rule.params === "(prefers-reduced-motion: reduce)") reduced += rule.toString();
  });
  assert.deepEqual(widths, [...widths].sort((a, b) => b - a));
  assert.match(styles, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  const pageBody = css.nodes.find((node) => node.type === "rule" && node.selector === 'html[data-theme="kisara"] body[data-kisara-page="projects"]') as postcss.Rule;
  assert.ok(pageBody);
  assert.ok(pageBody.nodes.some((node) => node.type === "decl" && node.prop === "overflow-x" && node.value === "clip"));
  for (const selector of [
    ".kisara-index-title-main", ".kisara-index-title-tail", ".kisara-index-title-tail > span::after",
    ".kisara-index-filters button::before", ".kisara-index-card-reveal summary svg"
  ]) assert.ok(reduced.includes(selector), selector);
  assert.doesNotMatch(runtime, /addEventListener\(["'](?:wheel|scroll)|scrollTo|scrollIntoView/);
  assert.doesNotMatch(styles, /background-size: 48px 48px|transition: all/);
});
