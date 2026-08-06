import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const readSource = (relativePath: string) => readFileSync(
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
  "utf8"
);

const layoutSource = readSource("src/themes/kisara/layouts/KisaraLayout.astro");
const stageHomeSource = readSource("src/themes/kisara/components/KisaraStageHome.astro");
const stageRuntimeSource = readSource("src/themes/kisara/runtime/stageHome.ts");
const homeSource = readSource("src/themes/kisara/pages/HomePage.astro");

test("StageHome declares all 14 ordered assets and mixed playback groups", () => {
  const scenePattern = /\{ id: "(0[1-9]|1[0-4])", order: (\d+), mode: "(auto|still|scrub|sequence)", media: "(image|video)", src: `\$\{base\}\/(0[1-9]|1[0-4])\.(mp4|webp)`/g;
  const scenes = [...stageHomeSource.matchAll(scenePattern)].map((match) => ({
    id: match[1],
    order: Number(match[2]),
    mode: match[3],
    media: match[4],
    assetId: match[5]
  }));
  const expectedIds = Array.from({ length: 14 }, (_, index) => String(index + 1).padStart(2, "0"));

  assert.equal(scenes.length, 14);
  assert.deepEqual(scenes.map((scene) => scene.id), expectedIds);
  assert.deepEqual(scenes.map((scene) => scene.order), Array.from({ length: 14 }, (_, index) => index + 1));
  assert.deepEqual(scenes.map((scene) => scene.assetId), expectedIds);
  assert.equal(scenes.filter((scene) => scene.mode === "scrub").length, 1);
  assert.equal(scenes.find((scene) => scene.id === "06")?.mode, "scrub");
  assert.equal(scenes.find((scene) => scene.id === "06")?.media, "video");
  assert.deepEqual(
    scenes.filter((scene) => scene.id >= "10" && scene.id <= "12").map((scene) => scene.mode),
    ["sequence", "sequence", "sequence"]
  );
  assert.equal(scenes.find((scene) => scene.id === "13")?.mode, "still");

  const transformationStart = stageRuntimeSource.match(/const TRANSFORMATION_START = (\d+);/);
  const transformationEnd = stageRuntimeSource.match(/const TRANSFORMATION_END = (\d+);/);
  assert.equal(Number(transformationStart?.[1]) + 1, 10);
  assert.equal(Number(transformationEnd?.[1]) + 1, 13);
  assert.match(stageRuntimeSource, /const TRANSFORMATION_INDICES = new Set\(\[9, 10, 11\]\)/);
});

test("StageHome v2 groups beats, owns video frames, and explains the only scrub scene", () => {
  for (const group of ["intercept", "contract", "intimacy", "transformation", "jealousy"]) {
    assert.match(stageHomeSource, new RegExp(`group: "${group}"`));
  }

  assert.match(stageHomeSource, /data-stage-first-frame/);
  assert.match(stageHomeSource, /data-stage-hold-frame/);
  assert.match(stageRuntimeSource, /const setFrameState =/);
  assert.match(stageRuntimeSource, /requestVideoFrameCallback/);
  assert.doesNotMatch(stageRuntimeSource, /video\.poster =/);

  assert.match(stageRuntimeSource, /const INTERNAL_AUTO_CHAIN = new Map/);
  for (const edge of [
    /\[0, \{ next: 1/,
    /\[1, \{ next: 2/,
    /\[3, \{ next: 4/,
    /\[4, \{ next: 5/
  ]) {
    assert.match(stageRuntimeSource, edge);
  }
  assert.doesNotMatch(stageRuntimeSource, /config\.transition/);

  assert.match(stageHomeSource, /滚动推进这一击/);
  assert.match(stageHomeSource, /上下拖动推进这一击/);
  assert.match(stageRuntimeSource, /scrubTarget >= 0\.999/);
  assert.match(stageRuntimeSource, /beginScene\(SCRUB_INDEX \+ 1, 1, true\)/);

  assert.match(stageRuntimeSource, /if \(activeIndex < TRANSFORMATION_START\) root\.dataset\.titlePhase = "dormant"/);
  assert.match(stageRuntimeSource, /activeIndex === 9\) root\.dataset\.titlePhase = "awakening"/);
  assert.match(stageRuntimeSource, /activeIndex === 12\) root\.dataset\.titlePhase = "complete"/);
  assert.deepEqual(
    [...stageHomeSource.matchAll(/data-stage-copy="(\d+)"/g)].map((match) => match[1]),
    ["02", "03", "08", "13"]
  );
});

test("Kisara Home is assembled from StageHome and keeps the footer off Home", () => {
  assert.match(homeSource, /KisaraStageHome/);
  assert.match(homeSource, /stage-home\.css\?url/);
  for (const obsoleteReference of [
    /\.\.\/styles\/home\.css/,
    /KisaraFridgeScene/,
    /KisaraOpeningMemoryScene/
  ]) {
    assert.doesNotMatch(homeSource, obsoleteReference);
  }

  assert.match(layoutSource, /\{!isHome && \(\s*<footer class="kisara-footer">/);
  assert.equal((layoutSource.match(/<footer\b/g) ?? []).length, 1);
});

test("StageHome keeps the accepted found-self, spare-key, and jealousy triggers", () => {
  assert.match(stageRuntimeSource, /const hasFoundSelfTicket =/);
  assert.match(stageRuntimeSource, /ticket\?\.source === "me-games"/);
  assert.match(stageRuntimeSource, /document\.documentElement\.dataset\.kisaraFoundSelfEntry = "pending"/);
  assert.match(stageRuntimeSource, /startFoundSelf\(\)/);

  assert.match(stageRuntimeSource, /const grantSpareKey = \(\) =>/);
  assert.match(stageRuntimeSource, /__yuimiKisaraLovebrainProgress\?\.markSpareKey\?\.\(\) === true/);
  assert.match(stageRuntimeSource, /__yuimiKisaraEasterLedger\?\.mark\?\.\("photo-archive"\)/);
  assert.match(stageRuntimeSource, /if \(activeIndex === KISS_INDEX\) grantSpareKey\(\);/);

  assert.match(stageRuntimeSource, /const markFinalStage = \(\) =>/);
  assert.match(stageRuntimeSource, /__yuimiKisaraLovebrainProgress\?\.markStage\?\.\("home-jealousy"\)/);
});
