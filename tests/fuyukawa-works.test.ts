import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { projectEntries } from "../src/core/data/projects.ts";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path: string) => existsSync(new URL(`../${path}`, import.meta.url));
const page = read("src/themes/fuyukawa-kagari/pages/ProjectsPage.astro");
const styles = read("src/themes/fuyukawa-kagari/styles/works.css");

test("Fuyukawa Works groups all projects into four photographed chapters", () => {
  const groups = [...page.matchAll(/key: "(blog|astrbot|codex|notes)"/g)].map((match) => match[1]);
  assert.deepEqual(groups, ["blog", "astrbot", "codex", "notes"]);
  for (const index of [1, 2, 3, 4]) {
    const path = `public/themes/fuyukawa-kagari/assets/works-index/work-0${index}.webp`;
    assert.ok(exists(path), path);
    assert.match(page, new RegExp(`/works-index/work-0${index}\\.webp`));
  }
  for (const project of projectEntries) {
    assert.match(project.href, /^https:\/\/github\.com\/Yuimi-chaya\//);
  }
  assert.equal(projectEntries.length, 10);
});

test("Fuyukawa chapters filter entries and swap the active photograph", () => {
  assert.match(page, /data-works-chapter=\{group\.key\}/);
  assert.match(page, /entry\.hidden = !matches/);
  assert.match(page, /photo\.classList\.toggle\("is-current", photo\.dataset\.photo === key\)/);
  assert.match(page, /if \(total\) total\.textContent = String\(shown\)/);
  assert.match(page, /root\.dataset\.worksBound === "true"/);
  assert.match(page, /const preset = new URLSearchParams\(window\.location\.search\)\.get\("chapter"\)/);
});

test("Fuyukawa entries are native details with visible repository links", () => {
  assert.match(page, /<details>/);
  assert.match(page, /<summary>/);
  assert.match(page, /href=\{project\.href\}/);
  assert.match(page, /rel="noopener noreferrer"/);
  assert.doesNotMatch(page, /hidden=\{index[^}]*\}/);
});

test("Fuyukawa Works loads its own stylesheet and keeps theme isolation", () => {
  assert.match(page, /import worksStylesheet from "\.\.\/styles\/works\.css\?url"/);
  assert.match(page, /stylesheets=\{\[worksStylesheet\]\}/);
  const layout = read("src/themes/fuyukawa-kagari/layouts/BaseLayout.astro");
  assert.match(layout, /stylesheets\?: string\[\]/);
  assert.match(layout, /stylesheets\.map\(\(stylesheet\) => <link rel="stylesheet" href=\{stylesheet\} \/>\)/);
  assert.match(styles, /^body\[data-fuyukawa\] \.yuimi-works \{/m);
  assert.doesNotMatch(styles, /kisara-index|data-kisara/);
  assert.match(styles, /@media \(max-width: 520px\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
