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
const stateTable = readSource("KISARA_HOME_STATE_TABLE.md");

test("Home exposes six public scenes with one action lane per scene", () => {
  const scenes = [...stageHomeSource.matchAll(/\{ id: "([^"]+)", label: "([^"]+)", title: "([^"]+)" \}/g)]
    .map((match) => match[1]);
  assert.deepEqual(scenes, [
    "rescue",
    "request",
    "counterattack",
    "contract",
    "transformation",
    "jealousy"
  ]);
  for (const asset of [
    "rescue-action.mp4",
    "rescue-eye-last.webp",
    "rescue-severed.webp",
    "request-face.webp",
    "request-emerged.webp",
    "counter-action.mp4",
    "counter-roll-last.webp",
    "contract-embrace.webp",
    "contract-kiss-03.webp",
    "transformation-explosion.webp",
    "transformation-detail.webp",
    "transformation-silhouette.webp",
    "fight.webp",
    "jealousy-action.mp4",
    "jealousy-action-hold.webp",
    "jealousy-blackface-last.webp"
  ]) {
    assert.match(stageHomeSource, new RegExp(asset.replaceAll(".", "\\.")), `${asset} must be declared`);
  }
  assert.match(stageHomeSource, /data-stage-engine="keyframe-owner"/);
  assert.match(stageHomeSource, /data-scene-action="idle"/);
  assert.doesNotMatch(stageHomeSource, /data-rescue-beat|data-request-beat|data-counter-beat|data-contract-beat|data-transformation-beat|data-jealousy-beat/);
});

test("Home controller uses scene/stable/action ownership instead of nested beat playback", () => {
  assert.match(stageRuntimeSource, /class HomeChapterController/);
  assert.match(stageRuntimeSource, /const CHAPTER_IDS: ChapterId\[\] =/);
  assert.match(stageRuntimeSource, /private stableState: StableState/);
  assert.match(stageRuntimeSource, /private actionState: "idle" \| "running" \| "settled"/);
  assert.match(stageRuntimeSource, /private epoch = 0/);
  assert.match(stageRuntimeSource, /private transitionSerial = 0/);
  assert.match(stageRuntimeSource, /private playbackToken = 0/);
  assert.match(stageRuntimeSource, /private beginOperation\(\)/);
  assert.match(stageRuntimeSource, /data\.transitionParticipant|dataset\.transitionParticipant/);
  assert.match(stageRuntimeSource, /private videoLayerName\(/);
  assert.match(stageRuntimeSource, /private async switchChapter\(/);
  assert.match(stageRuntimeSource, /private async runSceneAction\(/);
  assert.match(stageRuntimeSource, /requestVideoFrameCallback/);
  assert.match(stageRuntimeSource, /const INPUT_LOCK_MS = 720/);
  assert.match(stageRuntimeSource, /const GESTURE_GAP = 180/);
  assert.match(stageRuntimeSource, /window\.addEventListener\("wheel", this\.handleWheel/);
  assert.match(stageRuntimeSource, /marker\.dataset\.homeChapterTarget/);
  assert.doesNotMatch(stageRuntimeSource, /playBeatSequence|playLayerGroup|startRescueMemoryCut|startJealousyReveal|CHAPTER_TRANSITION_MS|JEALOUSY_SETUP_AT|JEALOUSY_BLACKFACE_AT/);
});

test("Home scene state table defines short actions and no hidden internal stops", () => {
  assert.match(stateTable, /Public Scenes|六个稳定场景/i);
  assert.match(stateTable, /rescue-action\.mp4.*0\.29s/);
  assert.match(stateTable, /counter-action\.mp4.*1\.00s/);
  assert.match(stateTable, /jealousy-action\.mp4.*1\.38s/);
  assert.match(stateTable, /There is no scrub state/);
  assert.match(stateTable, /The user never needs a second forward gesture/);
  assert.doesNotMatch(stateTable, /chapter-local beats|run-playing|parallel-preparing/);
});

test("Scene transitions use Me-like positions and delayed copy without a generic flash layer", () => {
  assert.match(stageStyles, /data-chapter-position="before"/);
  assert.match(stageStyles, /data-chapter-position="after"/);
  assert.match(stageStyles, /data-chapter-transition="rescue-request"/);
  assert.match(stageStyles, /data-chapter-transition="contract-transform"/);
  assert.match(stageStyles, /kisara-home-copy-in/);
  assert.match(stageStyles, /animation-delay: 120ms/);
  assert.match(stageStyles, /animation-delay: 300ms/);
  assert.match(stageStyles, /animation-delay: 410ms/);
  assert.match(stageStyles, /kisara-home-jealousy-panel/);
  assert.match(stageStyles, /data-jealousy-panel-state="revealing"/);
  assert.match(stageStyles, /kisara-home-transform-detail/);
  assert.match(stageStyles, /data-transition-participant="outgoing"/);
  assert.doesNotMatch(stageStyles, /is-switching \.kisara-home-chapter\[data-chapter-position="before"\]/);
  assert.doesNotMatch(stageStyles, /data-transition-participant="outgoing"[^}]*opacity:\s*1/s);
  assert.doesNotMatch(stageStyles, /data-scene-action="running"\] \.kisara-scene-action > \[data-layer-video\]/);
  assert.doesNotMatch(stageStyles, /kisara-home-jealousy-panel[^}]*1040ms/s);
  assert.doesNotMatch(stageStyles, /kisara-home-chapter\[data-chapter-position="active"\].*data-.*beat/);
});

test("Home remains a thin assembly layer and does not initialize the old gate runtime", () => {
  assert.match(homeSource, /<KisaraStageHome \/>/);
  assert.match(homeSource, /<KisaraFoundSelfEasterEgg \/>/);
  assert.match(homeSource, /<KisaraLovebrainEasterEgg \/>/);
  assert.match(homeSource, /data-kisara-gate/);
  assert.match(homeSource, /data-kisara-stage-settled="false"/);
  assert.doesNotMatch(homeSource, /activeFightUrl|externalLegacyMedia|releaseAutoplay|space-lens|renderArchivedHomeSections/);
  assert.ok(homeSource.split(/\r?\n/).length < 80, "HomePage must remain a thin assembly layer");
  assert.match(layoutSource, /\{!isHome && \(\s*<footer class="kisara-footer">/);
});

test("FoundSelf, spare-key, jealousy, and Lovebrain remain on the scene controller boundary", () => {
  assert.match(stageRuntimeSource, /document\.documentElement\.dataset\.kisaraFoundSelfEntry === "pending"/);
  assert.match(stageRuntimeSource, /private async startFoundSelf\(\)/);
  assert.match(stageRuntimeSource, /private finishFoundSelf\(\)/);
  assert.match(stageRuntimeSource, /yuimi:kisara-audio-suspension/);
  assert.match(stageRuntimeSource, /yuimi:kisara-legacy-found-self-finished/);
  assert.match(stageRuntimeSource, /private grantSpareKey\(\)/);
  assert.match(stageRuntimeSource, /markSpareKey\?\.\(\) === true/);
  assert.match(stageRuntimeSource, /mark\?\.\("photo-archive"\)/);
  assert.match(stageRuntimeSource, /markStage\?\.\("home-jealousy"\)/);
  assert.match(stageRuntimeSource, /JEALOUSY_PANEL_REVEAL_AT = 1\.1/);
  assert.match(stageRuntimeSource, /setJealousyPanelState\("revealing"\)/);
  assert.match(stageRuntimeSource, /activate: this\.activateLovebrain/);
  assert.match(stageRuntimeSource, /leaveToOpening: this\.leaveLovebrain/);
});

test("Home keeps compact markers, no global progress rail, and lifecycle-safe stable restoration", () => {
  assert.match(stageStyles, /body\.kisara-home-page \.kisara-scrollbar \{\s*display: none !important;/);
  assert.match(stageStyles, /\.kisara-home-chapter-rail/);
  assert.match(stageStyles, /button\[aria-current="step"\]/);
  assert.match(stageStyles, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(stageRuntimeSource, /marker\.dataset\.homeChapterTarget/);
  assert.match(stageRuntimeSource, /yuimi-kisara-home-keyframe-v2/);
  assert.match(stageRuntimeSource, /private suspend = \(\) =>/);
  assert.match(stageRuntimeSource, /private resume = \(\) =>/);
  assert.match(stageRuntimeSource, /window\.addEventListener\("pagehide", this\.suspend/);
  assert.match(stageRuntimeSource, /window\.addEventListener\("pageshow", this\.resume/);
  assert.match(stageRuntimeSource, /document\.addEventListener\("astro:before-swap"/);
  assert.match(stageRuntimeSource, /if \(this\.reducedMotion\)/);
  assert.match(stageStyles, /body\.kisara-home-page \.kisara-header \{\s*z-index: 64;/);
});
