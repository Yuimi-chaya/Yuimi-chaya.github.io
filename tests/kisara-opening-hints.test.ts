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
const stageStyles = readSource("src/themes/kisara/styles/stage-home.css");
const homeSource = readSource("src/themes/kisara/pages/HomePage.astro");

test("StageHome declares all 14 ordered assets with one explicit renderer boundary", () => {
  const scenePattern = /\{ id: "(0[1-9]|1[0-4])", order: (\d+), mode: "(auto|still|scrub|legacy)", renderer: "(stage|legacy)", media: "(image|video)", src: `\$\{base\}\/(0[1-9]|1[0-4])\.(mp4|webp)`/g;
  const scenes = [...stageHomeSource.matchAll(scenePattern)].map((match) => ({
    id: match[1],
    order: Number(match[2]),
    mode: match[3],
    renderer: match[4],
    media: match[5],
    assetId: match[6]
  }));
  const expectedIds = Array.from({ length: 14 }, (_, index) => String(index + 1).padStart(2, "0"));

  assert.equal(scenes.length, 14);
  assert.deepEqual(scenes.map((scene) => scene.id), expectedIds);
  assert.deepEqual(scenes.map((scene) => scene.order), Array.from({ length: 14 }, (_, index) => index + 1));
  assert.deepEqual(scenes.map((scene) => scene.assetId), expectedIds);
  assert.equal(scenes.filter((scene) => scene.mode === "scrub").length, 1);
  assert.equal(scenes.find((scene) => scene.id === "06")?.mode, "scrub");
  assert.equal(scenes.find((scene) => scene.id === "06")?.renderer, "stage");
  assert.deepEqual(
    scenes.filter((scene) => scene.renderer === "legacy").map((scene) => scene.id),
    ["08", "09", "10", "11", "12", "13"]
  );
  assert.equal(scenes.find((scene) => scene.id === "14")?.mode, "auto");
  assert.equal(scenes.find((scene) => scene.id === "14")?.renderer, "stage");
});

test("StageHome owns input and media continuity without the rejected prologue handoff", () => {
  for (const group of ["intercept", "contract", "intimacy", "transformation", "jealousy"]) {
    assert.match(stageHomeSource, new RegExp(`group: "${group}"`));
  }

  assert.match(stageHomeSource, /data-stage-engine="single-owner"/);
  assert.match(stageHomeSource, /data-stage-first-frame/);
  assert.match(stageHomeSource, /data-stage-hold-frame/);
  assert.match(stageRuntimeSource, /const showStageSurface = async/);
  assert.match(stageRuntimeSource, /await hydrateScene\(index, true\)/);
  assert.match(stageRuntimeSource, /requestVideoFrameCallback/);
  assert.doesNotMatch(stageRuntimeSource, /video\.poster =/);
  assert.match(stageRuntimeSource, /const enterLegacy = async/);
  assert.match(stageRuntimeSource, /const enterFinal = async/);
  assert.match(stageRuntimeSource, /yuimi:kisara-legacy-release-complete/);
  assert.doesNotMatch(stageRuntimeSource, /yuimi:kisara-stage-legacy-start/);
  assert.doesNotMatch(stageRuntimeSource, /yuimi:kisara-legacy-ready/);
  assert.match(stageHomeSource, /aria-label="用滚动推进这一击"/);
  assert.match(stageHomeSource, /class="kisara-stage-scrub-gesture" aria-hidden="true"><i><\/i><i><\/i><i><\/i>/);
  assert.doesNotMatch(stageStyles, /white-continuity/);
  assert.doesNotMatch(stageStyles, /kisara-stage-v2-white-continuity/);
});

test("Kisara Home uses the legacy gate only as an external renderer and keeps the footer off Home", () => {
  assert.match(homeSource, /KisaraStageHome/);
  assert.match(homeSource, /\.\.\/styles\/home\.css/);
  assert.match(homeSource, /stage-home\.css\?url/);
  assert.match(homeSource, /data-kisara-external-stage-control="true"/);
  assert.match(homeSource, /data-kisara-stage-renderer="idle"/);
  assert.match(homeSource, /const externalStageControl = gate\.dataset\.kisaraExternalStageControl === "true"/);
  assert.match(homeSource, /window\.__yuimiKisaraLegacyStage = externalStageBridge/);
  assert.match(homeSource, /yuimi:kisara-legacy-stage-ready/);
  assert.match(homeSource, /externalStageControl && !foundSelfActive && !lovebrainActive/);
  assert.match(homeSource, /if \(externalStageControl\) return;/);
  assert.match(homeSource, /const renderArchivedHomeSections = false/);
  assert.doesNotMatch(homeSource, /yuimi:kisara-stage-legacy-start/);

  assert.match(layoutSource, /\{!isHome && \(\s*<footer class="kisara-footer">/);
  assert.equal((layoutSource.match(/<footer\b/g) ?? []).length, 1);
});

test("StageHome keeps FoundSelf, spare-key, and final-stage qualification on the single controller", () => {
  assert.match(stageRuntimeSource, /document\.documentElement\.dataset\.kisaraFoundSelfEntry === "pending"/);
  assert.match(stageRuntimeSource, /yuimi:kisara-legacy-found-self-finished/);

  assert.match(stageRuntimeSource, /const grantSpareKey = \(\) =>/);
  assert.match(stageRuntimeSource, /__yuimiKisaraLovebrainProgress\?\.markSpareKey\?\.\(\) === true/);
  assert.match(stageRuntimeSource, /__yuimiKisaraEasterLedger\?\.mark\?\.\("photo-archive"\)/);
  assert.match(stageRuntimeSource, /if \(activeIndex === KISS_INDEX\) grantSpareKey\(\);/);

  assert.match(stageRuntimeSource, /const markFinalStage = \(\) =>/);
  assert.match(stageRuntimeSource, /__yuimiKisaraLovebrainProgress\?\.markStage\?\.\("home-jealousy"\)/);
  assert.match(stageRuntimeSource, /runtimeWindow\.__yuimiKisaraLegacyStage\?\.setFinalStage\?\.\(\)/);
});
