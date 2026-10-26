import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import test from "node:test";
import { projectEntries, projectTechLines } from "../src/core/data/projects.ts";
import sharp from "sharp";

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
