import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const readSource = (relativePath: string) => readFileSync(
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
  "utf8"
);

const layoutSource = readSource("src/themes/kisara/layouts/KisaraLayout.astro");
const stageRuntimeSource = readSource("src/themes/kisara/runtime/stageHome.ts");
const homeSource = readSource("src/themes/kisara/pages/HomePage.astro");
const audioSource = readSource("src/themes/kisara/components/KisaraAudioControl.astro");
const componentSource = readSource("src/themes/kisara/components/KisaraLovebrainEasterEgg.astro");

test("Lovebrain progress is an independent tab-session facade", () => {
  assert.match(layoutSource, /yuimi-kisara-lovebrain-v1/);
  assert.match(layoutSource, /__yuimiKisaraLovebrainProgress/);
  assert.match(layoutSource, /visited/);
  assert.match(layoutSource, /spareKeyTriggered/);
  assert.match(layoutSource, /stageTriggered/);
  assert.match(layoutSource, /snapshot/);
  assert.match(layoutSource, /isEligible/);
  assert.match(layoutSource, /markVisit/);
  assert.match(layoutSource, /markSpareKey/);
  assert.match(layoutSource, /markStage/);
  assert.match(layoutSource, /yuimi:kisara-lovebrain-progress/);
  assert.match(layoutSource, /astro:page-load/);

  const facadeStart = layoutSource.indexOf('"yuimi-kisara-lovebrain-v1"');
  const facadeEnd = layoutSource.indexOf('<script is:inline define:vars={{ isHome }}>', facadeStart);
  assert.ok(facadeStart >= 0 && facadeEnd > facadeStart);
  const facadeSource = layoutSource.slice(facadeStart, facadeEnd);
  assert.doesNotMatch(facadeSource, /astro:before-preparation/);
  assert.match(facadeSource, /photo-archive/);
  assert.match(facadeSource, /chibi-jealousy/);
  assert.match(facadeSource, /chibi-apple/);
  for (const page of ["games", "blog", "projects", "about"]) {
    assert.match(facadeSource, new RegExp(`"${page}"`), `${page} must be eligible history`);
  }
});

test("the chapter controller is the final-settled Lovebrain host", () => {
  assert.match(
    stageRuntimeSource,
    /__yuimiKisaraHomeLovebrain = \{\s*activate: this\.activateLovebrain,\s*leaveToOpening: this\.leaveLovebrain\s*\}/
  );
  assert.match(homeSource, /data-kisara-stage-settled="false"/);
  assert.match(stageRuntimeSource, /this\.host\.dataset\.kisaraStageSettled = "true"/);
  assert.match(stageRuntimeSource, /private setFinalHold\(\)/);
  assert.match(stageRuntimeSource, /markStage\?\.\("home-jealousy"\)/);
  assert.doesNotMatch(stageRuntimeSource, /__yuimiKisaraLegacyStage|setFinalStage/);

  assert.match(componentSource, /const isHomeGate = \(\) =>/);
  assert.match(componentSource, /dataset\.kisaraStageSettled === "true"/);
  assert.match(componentSource, /const visible = isEligible\(\) && isHomeGate\(\)/);
});

test("Lovebrain component owns its ED assets and interactive input", () => {
  for (const asset of [
    "stage1-scrub.mp4",
    "kisara-avatar.webp",
    "shu-avatar.webp",
    "ayano-avatar.webp",
    "race-scrub.mp4",
    "pinch-pingpong.mp4",
    "stage2-loop.mp4",
    "final.webp"
  ]) {
    const escapedAsset = asset.replace(".", "\\.");
    assert.match(componentSource, new RegExp(`lovebrain/${escapedAsset}`), `${asset} must be used`);
  }
  assert.match(componentSource, /trackId: "lovebrain-ed"/);
  for (const input of ["wheel", "keydown", "touchmove", "pointermove"]) {
    assert.match(componentSource, new RegExp(`addEventListener\\(\\"${input}\\"`), `${input} input must advance the ED`);
  }
  assert.match(componentSource, /data-lovebrain-focus/);
  assert.match(componentSource, /prefers-reduced-motion/);
  assert.match(componentSource, /requestLovebrainTrack/);
  assert.match(componentSource, /playbackMode: "playlist"/);
  assert.doesNotMatch(componentSource, /new Audio\(/);
  assert.doesNotMatch(componentSource, /yuimi:kisara-audio-suspension/);
  assert.match(componentSource, /seekPausedVideo/);
  assert.match(componentSource, /targetProgress/);
  assert.match(componentSource, /scheduleProgress/);
  assert.match(componentSource, /const springPop =/);
  assert.match(componentSource, /portraitButtons\.forEach/);
  assert.match(componentSource, /--portrait-enter-y/);
  assert.match(componentSource, /lovebrain-portrait-ribbons/);
  assert.match(componentSource, /pinchBufferVideo/);
  assert.match(componentSource, /const syncPinchVideo =/);
  assert.match(componentSource, /const animatePinchLoop =/);
  assert.match(componentSource, /const raceProgressSpan = 0\.37/);
  assert.match(componentSource, /const raceMaxPlaybackRate = 1\.12/);
  assert.match(componentSource, /const raceProgress = clamp\(\(value - 0\.39\) \/ raceProgressSpan/);
  assert.match(componentSource, /const raceWeight =/);
  assert.match(componentSource, /raceProgressSpan \/ raceDuration \/ 1000/);
  assert.match(componentSource, /raceWeight \* 0\.85/);
  assert.match(componentSource, /requestAnimationFrame\(animateProgress\)/);
  assert.match(componentSource, /addEventListener\("seeked"/);
  assert.match(componentSource, /pendingTime/);
  assert.match(componentSource, /busy/);
  assert.match(componentSource, /video\.pause\(\)/);
  assert.match(componentSource, /hydrateMediaTo/);
  assert.doesNotMatch(componentSource, /<img[^>]*\ssrc="\/themes\/kisara\/assets\/lovebrain\//);
  assert.doesNotMatch(componentSource, /<video[^>]*\ssrc="\/themes\/kisara\/assets\/lovebrain\//);
  assert.match(componentSource, /is-lovebrain-scene-visible/);

  const pinchStart = componentSource.indexOf('data-lovebrain-loop="pinch"');
  const embraceStart = componentSource.indexOf('data-lovebrain-loop="embrace"');
  assert.ok(pinchStart >= 0 && embraceStart > pinchStart);
  assert.doesNotMatch(componentSource.slice(pinchStart, embraceStart), /\sloop\s/);

  const finishStart = componentSource.indexOf("const finishOpening =");
  const finishEnd = componentSource.indexOf("const startReturnToGate =", finishStart);
  const finishSource = componentSource.slice(finishStart, finishEnd);
  assert.match(finishSource, /sceneConsumed = true/);
  assert.doesNotMatch(finishSource, /stopAudioSession/);
  assert.match(componentSource, /window\.__yuimiKisaraLovebrainFinishOpening = finishOpening/);
});

test("HomeChapterController keeps a single progress publisher and lifecycle restoration", () => {
  assert.match(stageRuntimeSource, /new CustomEvent\("kisara:gate-progress"/);
  assert.match(stageRuntimeSource, /document\.addEventListener\("astro:before-swap"/);
  assert.match(stageRuntimeSource, /runtimeWindow\.__yuimiKisaraStageHomeController\?\.dispose\(\)/);
  assert.match(stageRuntimeSource, /this\.lifecycle\.abort\(\)/);
  assert.match(stageRuntimeSource, /private async switchChapter\(/);
  assert.match(stageRuntimeSource, /private async startJealousyReveal\(/);
  assert.match(stageRuntimeSource, /private suspend = \(\) =>/);
  assert.match(stageRuntimeSource, /private resume = \(\) =>/);
  assert.match(stageRuntimeSource, /this\.resumeVideos\.add\(video\)/);
  assert.match(stageRuntimeSource, /this\.resumeVideos\.forEach/);
  assert.match(stageRuntimeSource, /private transitionSerial = 0/);
  assert.match(stageRuntimeSource, /private playbackToken = 0/);
  assert.match(stageRuntimeSource, /await this\.hydrateChapter\(bounded, true\)/);

  const runtimeStart = stageRuntimeSource.indexOf("export const initKisaraStageHomeLifecycle =");
  const rootLookup = stageRuntimeSource.indexOf('document.querySelector<HTMLElement>("[data-kisara-stage-home]")', runtimeStart);
  const priorCleanup = stageRuntimeSource.indexOf("runtimeWindow.__yuimiKisaraStageHomeController?.dispose();", rootLookup);
  const controllerCreate = stageRuntimeSource.indexOf("new HomeChapterController(root)", priorCleanup);
  assert.ok(runtimeStart >= 0 && rootLookup > runtimeStart && priorCleanup > rootLookup && controllerCreate > priorCleanup);

  const stageVideoStart = stageRuntimeSource.indexOf("private async playLayer");
  const stageVideoEnd = stageRuntimeSource.indexOf("private pauseAllVideos", stageVideoStart);
  const stageVideoSource = stageRuntimeSource.slice(stageVideoStart, stageVideoEnd);
  assert.match(stageVideoSource, /const token = \+\+this\.playbackToken/);
  assert.match(stageVideoSource, /this\.playbackToken === token/);
  assert.match(stageVideoSource, /requestVideoFrameCallback/);
  assert.match(stageVideoSource, /video\.removeEventListener\("playing", onPlaying\)/);
  assert.match(stageVideoSource, /video\.removeEventListener\("ended", onEnded\)/);
  assert.match(stageVideoSource, /playback\?\.catch\(onError\)/);

  const reducedStart = stageRuntimeSource.indexOf("private async restore() {");
  const reducedEnd = stageRuntimeSource.indexOf("const saved = readSavedState", reducedStart);
  const reducedSource = stageRuntimeSource.slice(reducedStart, reducedEnd);
  assert.match(reducedSource, /await this\.switchChapter\(5, \{ instant: true, restoreBeat: "blackface-hold" \}\)/);
  assert.match(stageRuntimeSource, /private setFinalHold\(\)/);
});

test("Audio suspension releases only the final owner", () => {
  assert.match(audioSource, /owners: new Set\(\)/);
  assert.match(audioSource, /const suspensionOwners = audioSuspension\.owners/);
  assert.match(audioSource, /suspensionOwners\.add\(id\)/);
  assert.match(audioSource, /if \(!suspensionOwners\.has\(id\)\) return/);
  assert.match(audioSource, /suspensionOwners\.delete\(id\)/);

  const releaseIndex = audioSource.indexOf("suspensionOwners.delete(id)");
  const stillOwnedIndex = audioSource.indexOf("if (suspensionOwners.size > 0)", releaseIndex);
  const resumeIndex = audioSource.indexOf("const shouldResume", releaseIndex);
  assert.ok(releaseIndex >= 0 && stillOwnedIndex > releaseIndex && resumeIndex > stillOwnedIndex);
});

test("Lovebrain audio is consumed once and returns to the saved normal track", () => {
  const endedStart = audioSource.indexOf('audio.addEventListener("ended"');
  const endedEnd = audioSource.indexOf('audio.addEventListener("timeupdate"', endedStart);
  assert.ok(endedStart >= 0 && endedEnd > endedStart, "audio ended handler must remain discoverable");
  const endedSource = audioSource.slice(endedStart, endedEnd);
  assert.match(endedSource, /endedTrack\?\.consumeAfterPlayback === true/);
  assert.match(endedSource, /endedTrack\?\.returnToNormalAfterPlayback === true/);
  assert.match(endedSource, /const nextTrackId = returnToNormal/);
  assert.match(endedSource, /consumeSecretTrack\(consumedId\)/);
  assert.match(endedSource, /secretSession\.normalTrackId/);

  const stepStart = audioSource.indexOf("const stepTrack = (direction) => {");
  const stepEnd = audioSource.indexOf("const syncUnlockedSecretTracks =", stepStart);
  assert.ok(stepStart >= 0 && stepEnd > stepStart, "manual track stepping must remain discoverable");
  const stepSource = audioSource.slice(stepStart, stepEnd);
  assert.match(stepSource, /const returnToNormal = currentTrack\?\.returnToNormalAfterPlayback === true/);
  assert.match(stepSource, /baseTracks\.find\(\(track\) => track\.id === secretSession\.normalTrackId\)/);
});
