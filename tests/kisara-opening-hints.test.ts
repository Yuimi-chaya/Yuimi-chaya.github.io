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

test("Home exposes six authored chapters with semantic media instead of a legacy finale", () => {
  const chapters = [...stageHomeSource.matchAll(/\{ id: "([^"]+)", label: "([^"]+)", title: "([^"]+)" \}/g)]
    .map((match) => match[1]);
  assert.deepEqual(chapters, [
    "rescue",
    "request",
    "counterattack",
    "contract",
    "transformation",
    "jealousy"
  ]);
  for (const asset of [
    "rescue-eye.mp4",
    "rescue-severed.webp",
    "rescue-slash-last.webp",
    "request-face.webp",
    "request-emerged.webp",
    "counter-entry.mp4",
    "counter-run-scrub.mp4",
    "counter-roll.mp4",
    "contract-embrace.webp",
    "contract-kiss-01.webp",
    "contract-kiss-02.webp",
    "contract-kiss-03.webp",
    "transformation-explosion.webp",
    "transformation-detail.webp",
    "transformation-silhouette.webp",
    "fight.webp",
    "jealousy-setup.webp",
    "jealousy-slash.mp4",
    "jealousy-blackface.mp4",
    "jealousy-action-hold.webp"
  ]) {
    assert.match(stageHomeSource, new RegExp(asset.replaceAll(".", "\\.")), `${asset} must be declared`);
  }
  assert.match(stageHomeSource, /data-stage-engine="chapter-owner"/);
  assert.match(stageHomeSource, /data-home-chapter-target/);
  assert.doesNotMatch(stageHomeSource, /legacy-finale|legacy-transform|data-kisara-legacy-media/);
});

test("HomeChapterController owns chapter beats, bounded input, and decoded playback", () => {
  assert.match(stageRuntimeSource, /class HomeChapterController/);
  assert.match(stageRuntimeSource, /const CHAPTER_IDS: ChapterId\[\] =/);
  assert.match(stageRuntimeSource, /private epoch = 0/);
  assert.match(stageRuntimeSource, /private transitionSerial = 0/);
  assert.match(stageRuntimeSource, /private playbackToken = 0/);
  assert.match(stageRuntimeSource, /private beginOperation\(\)/);
  assert.match(stageRuntimeSource, /private async switchChapter\(/);
  assert.match(stageRuntimeSource, /requestVideoFrameCallback/);
  assert.match(stageRuntimeSource, /private async startRescueMemoryCut\(\)/);
  assert.match(stageRuntimeSource, /private async startJealousyReveal\(\)/);
  assert.match(stageRuntimeSource, /private async playLayerGroup\(/);
  assert.match(stageRuntimeSource, /private async playBeatSequence\(/);
  assert.match(stageRuntimeSource, /JEALOUSY_ACTION_START_AT = 7\.38/);
  assert.match(stageRuntimeSource, /WHEEL_THRESHOLD = 42/);
  assert.match(stageRuntimeSource, /window\.addEventListener\("wheel", this\.handleWheel/);
  assert.match(stageRuntimeSource, /window\.addEventListener\("keydown", this\.handleKeydown/);
  assert.match(stageRuntimeSource, /marker\.dataset\.homeChapterTarget/);
  assert.doesNotMatch(stageRuntimeSource, /LegacyStageBridge|__yuimiKisaraLegacyStage|playImpactReconstruction|releaseAutoplayKeyframes/);
});

test("Chapter-local beats implement the tightened eye, still-sequence, auto-run, kiss, and parallel black-face holds", () => {
  for (const beat of [
    "eye-hold",
    "cut-severed",
    "back-reveal",
    "back-hold",
    "request-face",
    "request-comic",
    "request-hold",
    "run-playing",
    "impact-playing",
    "roll-hold",
    "contract-kiss-1",
    "contract-kiss-2",
    "contract-kiss-3",
    "kiss-hold",
    "transform-explosion",
    "transform-detail",
    "transform-silhouette",
    "transform-fight",
    "transform-hold",
    "parallel-reveal",
    "parallel-playing",
    "blackface-hold"
  ]) {
    assert.match(stageRuntimeSource, new RegExp(`"${beat}"`), `${beat} must be implemented`);
  }
  assert.match(stageRuntimeSource, /playLayer\("counter-run"/);
  assert.match(stageRuntimeSource, /playLayer\("counter-roll"/);
  assert.match(stageRuntimeSource, /RESCUE_PLAYBACK_RATE = 1\.22/);
  assert.match(stageRuntimeSource, /JEALOUSY_SETUP_AT = 5\.589/);
  assert.match(stageRuntimeSource, /private async seekVideo\(/);
  assert.match(stageRuntimeSource, /playLayerGroup\(\[/);
  assert.match(stageRuntimeSource, /onEnter: \(\) => this\.grantSpareKey\(\)/);
  assert.match(stageRuntimeSource, /setFinalHold/);
  assert.doesNotMatch(stageRuntimeSource, /pushCounterScrub|startRequestLoop|requestLoop/);
});

test("Sword transitions and chapter boundaries have distinct visual grammars", () => {
  assert.match(stageStyles, /\.kisara-rescue-severed \{[\s\S]*clip-path:/);
  assert.match(stageStyles, /\.kisara-jealousy-split \{[\s\S]*clip-path: polygon\(45\.5% -3%/);
  assert.match(stageStyles, /@keyframes kisara-jealousy-panel[\s\S]*clip-path:/);
  assert.match(stageStyles, /data-rescue-beat="cut-severed"/);
  assert.match(stageStyles, /data-jealousy-beat="parallel-reveal"/);
  assert.match(stageStyles, /data-jealousy-beat="parallel-playing"/);
  assert.match(stageStyles, /kisara-jealousy-panel/);
  assert.doesNotMatch(stageStyles, /kisara-jealousy-cut/);
  assert.match(stageStyles, /data-chapter-transition="request-counter"/);
  assert.match(stageStyles, /data-chapter-transition="counter-contract"/);
  assert.match(stageStyles, /data-chapter-transition="contract-transform"/);
  assert.match(stageStyles, /data-chapter-transition="transform-jealousy"/);
  assert.match(stageStyles, /\.kisara-request-comic/);
  assert.match(stageStyles, /\.kisara-request-doodles/);
  assert.match(stageStyles, /\.kisara-still-shot/);
  assert.doesNotMatch(stageStyles, /\.kisara-request-loop|\.kisara-scrub-signal/);
  assert.doesNotMatch(stageStyles, /kisara-gate-legacy-media|space-lens|impact-reconstruct/);
});

test("Home is a thin assembly layer and does not initialize the old gate runtime", () => {
  assert.match(homeSource, /<KisaraStageHome \/>/);
  assert.match(homeSource, /<KisaraFoundSelfEasterEgg \/>/);
  assert.match(homeSource, /<KisaraLovebrainEasterEgg \/>/);
  assert.match(homeSource, /data-kisara-gate/);
  assert.match(homeSource, /data-kisara-stage-settled="false"/);
  assert.doesNotMatch(homeSource, /activeFightUrl|externalLegacyMedia|releaseAutoplay|space-lens|renderArchivedHomeSections/);
  assert.ok(homeSource.split(/\r?\n/).length < 80, "HomePage must remain a thin assembly layer");
  assert.match(layoutSource, /\{!isHome && \(\s*<footer class="kisara-footer">/);
});

test("FoundSelf, spare-key, jealousy, and Lovebrain remain on the chapter controller boundary", () => {
  assert.match(stageRuntimeSource, /document\.documentElement\.dataset\.kisaraFoundSelfEntry === "pending"/);
  assert.match(stageRuntimeSource, /private async startFoundSelf\(\)/);
  assert.match(stageRuntimeSource, /private finishFoundSelf\(\)/);
  assert.match(stageRuntimeSource, /yuimi:kisara-audio-suspension/);
  assert.match(stageRuntimeSource, /yuimi:kisara-legacy-found-self-finished/);
  assert.match(stageRuntimeSource, /private grantSpareKey\(\)/);
  assert.match(stageRuntimeSource, /markSpareKey\?\.\(\) === true/);
  assert.match(stageRuntimeSource, /mark\?\.\("photo-archive"\)/);
  assert.match(stageRuntimeSource, /markStage\?\.\("home-jealousy"\)/);
  assert.match(stageRuntimeSource, /activate: this\.activateLovebrain/);
  assert.match(stageRuntimeSource, /leaveToOpening: this\.leaveLovebrain/);
});

test("Home retires the global progress rail in favor of compact clickable chapter markers", () => {
  assert.match(stageStyles, /body\.kisara-home-page \.kisara-scrollbar \{\s*display: none !important;/);
  assert.match(stageStyles, /\.kisara-home-chapter-rail/);
  assert.match(stageStyles, /button\[aria-current="step"\]/);
  assert.match(stageStyles, /grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(stageRuntimeSource, /marker\.dataset\.homeChapterTarget/);
});

test("Chapter lifecycle pauses media, preserves BFCache ownership, and restores stable state", () => {
  assert.match(stageRuntimeSource, /private suspend = \(\) =>/);
  assert.match(stageRuntimeSource, /private resume = \(\) =>/);
  assert.match(stageRuntimeSource, /this\.resumeVideos\.add\(video\)/);
  assert.match(stageRuntimeSource, /private async waitUntilVisible\(epoch: number\)/);
  assert.match(stageRuntimeSource, /window\.addEventListener\("pagehide", this\.suspend/);
  assert.match(stageRuntimeSource, /window\.addEventListener\("pageshow", this\.resume/);
  assert.match(stageRuntimeSource, /document\.addEventListener\("astro:before-swap"/);
  assert.match(stageRuntimeSource, /event\.persisted && root\?\.dataset\.bound === "true"/);
  assert.match(stageRuntimeSource, /yuimi-kisara-home-chapters-v1/);
  assert.match(stageRuntimeSource, /private async restoreStableBeat/);
  assert.match(stageRuntimeSource, /if \(this\.reducedMotion\)/);
  assert.match(stageStyles, /body\.kisara-home-page \.kisara-header \{\s*z-index: 64;/);
});
