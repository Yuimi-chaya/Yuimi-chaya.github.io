import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

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
