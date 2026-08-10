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
const letterStageSource = readSource("src/themes/kisara/components/KisaraLetterStage.astro");
const letterFxSource = readSource("src/themes/kisara/runtime/letterStageFx.ts");
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
  assert.match(stageHomeSource, /data-rescue-bridge-state="hidden"/);
  assert.doesNotMatch(stageHomeSource, /data-rescue-beat|data-request-beat|data-counter-beat|data-contract-beat|data-transformation-beat|data-jealousy-beat/);
});

test("Home carries one indexed KISARA wordmark contract through all six scenes", () => {
  assert.match(letterStageSource, /const letters = \["K", "I", "S", "A", "R", "A"\]/);
  assert.match(letterStageSource, /data-letter-state=/);
  assert.match(letterStageSource, /data-wordmark-letter=/);
  assert.equal(stageHomeSource.match(/<KisaraLetterStage /g)?.length, 1);
  assert.match(letterStageSource, /data-wordmark-action="idle"/);
  assert.match(stageStyles, /\.kisara-stage-wordmark/);
  assert.match(stageStyles, /data-letter-state="active"/);
  assert.match(stageStyles, /data-letter-state="past"/);
  assert.match(stageStyles, /data-letter-state="future"/);
  assert.match(stageStyles, /data-wordmark-scene="rescue"/);
  assert.match(stageStyles, /kisara-letter-k-slash/);
  assert.match(stageStyles, /data-wordmark-scene="request"/);
  assert.match(stageStyles, /kisara-letter-i-chain-left/);
  assert.match(stageStyles, /data-wordmark-scene="counterattack"/);
  assert.match(stageStyles, /kisara-letter-s-charge/);
  assert.match(stageStyles, /data-wordmark-scene="contract"/);
  assert.match(stageStyles, /kisara-letter-a1-heart/);
  assert.match(stageStyles, /data-wordmark-scene="transformation"/);
  assert.match(stageStyles, /kisara-letter-r-enchant/);
  assert.match(stageStyles, /data-wordmark-scene="jealousy"/);
  assert.match(stageStyles, /kisara-letter-a2-slash/);
  assert.match(stageStyles, /data-wordmark-finale="running"/);
  assert.match(letterStageSource, /data-letter-chain-back/);
  assert.match(letterStageSource, /data-letter-chain-front/);
  assert.match(letterStageSource, /data-letter-contract-back/);
  assert.match(letterStageSource, /data-letter-contract-front/);
  assert.match(letterStageSource, /data-letter-data/);
  assert.match(letterStageSource, /data-letter-lens/);
  assert.doesNotMatch(letterStageSource, /kisara-stage-letter-fx/);
  assert.match(letterFxSource, /class ChainRenderer/);
  assert.match(letterFxSource, /createHeartPath/);
  assert.match(letterFxSource, /createLiquidRenderer/);
  assert.match(letterFxSource, /data-wordmark-action/);
  assert.doesNotMatch(letterFxSource, /const frameLinks/);
  assert.doesNotMatch(letterFxSource, /sceneIndex\s*>=/);
  assert.match(letterFxSource, /scene === "request"/);
  assert.match(letterFxSource, /scene === "contract"/);
  assert.match(letterFxSource, /scene === "transformation"/);
  assert.match(letterFxSource, /reconstructionOpacity/);
  assert.match(letterFxSource, /liquidOpacity/);
  assert.match(stageRuntimeSource, /new KisaraLetterFxController\(root\)/);
  assert.match(stageRuntimeSource, /this\.letterFx\.dispose\(\)/);
  assert.match(stageRuntimeSource, /private syncWordmark\(/);
  assert.match(stageRuntimeSource, /wordmark\.dataset\.wordmarkScene/);
  assert.match(stageRuntimeSource, /letter\.dataset\.letterState/);
  assert.match(stageStyles, /display: flex;[\s\S]*width: max-content;[\s\S]*font-size: 13\.4rem/);
  assert.match(stageStyles, /data-wordmark-scene="rescue"[\s\S]*?kisara-stage-letter-material \{\s*background-image:/);
  assert.match(stageStyles, /data-wordmark-scene="request"[\s\S]*?kisara-stage-letter-material \{\s*background-image:/);
  assert.match(stageStyles, /\.kisara-stage-letter:not\(\[data-letter-state="active"\]\)[\s\S]*?\.kisara-letter-lens-canvas[\s\S]*?opacity: 0 !important/);
  assert.match(stageStyles, /\.kisara-stage-letter:not\(\[data-letter-state="active"\]\) \.kisara-stage-letter-glass \{[\s\S]*?text-shadow: none;/);
  assert.match(stageStyles, /\.kisara-stage-letter:not\(\[data-letter-state="active"\]\) \.kisara-stage-letter-glass::before \{[\s\S]*?transform: none;/);
  assert.match(stageStyles, /\.kisara-stage-letter:not\(\[data-letter-state="active"\]\) \.kisara-stage-letter-glass::after \{\s*content: none;/);
  assert.match(stageStyles, /\.kisara-stage-letter-residue \{[\s\S]*?-webkit-text-stroke: 0 transparent;/);
  assert.match(stageStyles, /\.kisara-letter-contract-front \{[\s\S]*?z-index: 12/);
  assert.match(stageStyles, /\.kisara-letter-data-canvas,[\s\S]*?width: 100%;[\s\S]*?height: 100%/);
  assert.match(stageStyles, /--kisara-r-material-opacity/);
  assert.doesNotMatch(stageHomeSource, /kisara-title-stage|data-kisara-chain|data-kisara-title-data/);
  assert.doesNotMatch(stageStyles, /\.kisara-stage-wordmark[^}]*backdrop-filter/s);
  assert.match(stageStyles, /@media \(max-width: 720px\)[\s\S]*\.kisara-stage-letter-fx \{\s*display: none;/);
  assert.match(stageStyles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*data-wordmark-scene="request"/);
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
  assert.match(stateTable, /jealousy-action\.mp4.*1\.25s/);
  assert.match(stateTable, /Persistent KISARA Wordmark/);
  assert.match(stateTable, /Rescue \| `K`/);
  assert.match(stateTable, /Request \| `I`/);
  assert.match(stateTable, /Counterattack \| `S`/);
  assert.match(stateTable, /Contract \| first `A`/);
  assert.match(stateTable, /Transformation \| `R`/);
  assert.match(stateTable, /Jealousy \| second `A`/);
  assert.match(stateTable, /adds no independent persisted timeline/);
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
  assert.match(stageStyles, /data-rescue-bridge-state="playing"/);
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
  assert.match(stageRuntimeSource, /RESCUE_BRIDGE_MS = 500/);
  assert.match(stageRuntimeSource, /setRescueBridgeState\("playing"\)/);
  assert.match(stageRuntimeSource, /JEALOUSY_PANEL_REVEAL_AT = 0\.98/);
  assert.match(stageRuntimeSource, /setJealousyPanelState\("revealing"\)/);
  assert.match(stageRuntimeSource, /private triggerWordmarkFinale\(\)/);
  assert.match(stageRuntimeSource, /wordmark\.dataset\.wordmarkFinale = "running"/);
  assert.match(stageRuntimeSource, /id === "jealousy" && actionCompleted/);
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
