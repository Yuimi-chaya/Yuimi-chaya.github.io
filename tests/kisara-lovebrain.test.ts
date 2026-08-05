import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const readSource = (relativePath: string) => readFileSync(
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
  "utf8"
);

const layoutSource = readSource("src/themes/kisara/layouts/KisaraLayout.astro");
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

test("Home 003 gives the semantic spare-key grant before dispatch", () => {
  const grantIndex = homeSource.indexOf("const completeReward = (autoplay: boolean) => {");
  const spareKeyIndex = homeSource.indexOf("markSpareKey", grantIndex);
  const dispatchIndex = homeSource.indexOf('new CustomEvent("yuimi:kisara-secret-audio"', grantIndex);
  assert.ok(grantIndex >= 0);
  assert.ok(spareKeyIndex > grantIndex && dispatchIndex > spareKeyIndex);
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
});

test("Lovebrain uses a dedicated page mode and bridge transport", () => {
  assert.match(homeSource, /let lovebrainActive = false/);
  assert.match(homeSource, /pageMode = "lovebrain"/);
  assert.match(homeSource, /const enterLovebrainNextPage =/);
  assert.match(homeSource, /window\.__yuimiKisaraHomeLovebrain/);
  assert.match(homeSource, /activate: activateLovebrain/);
  assert.match(homeSource, /leaveToOpening: leaveLovebrainToOpening/);
  assert.match(homeSource, /is-lovebrain-active/);
  assert.match(homeSource, /is-lovebrain-home-active/);
  assert.match(homeSource, /pageMode = "next"/);

  const forwardStart = homeSource.indexOf("const enterLovebrainNextPage =");
  const forwardEnd = homeSource.indexOf("const completeGateReturn =", forwardStart);
  const forwardSource = homeSource.slice(forwardStart, forwardEnd);
  assert.doesNotMatch(forwardSource, /activateOpeningBridgePortal/);
  assert.doesNotMatch(forwardSource, /startOpeningBridgeDissolve/);
  assert.doesNotMatch(forwardSource, /resetGateState/);
  assert.doesNotMatch(forwardSource, /scheduleWarningWarmup/);
  assert.match(forwardSource, /lovebrainActive = false/);
  assert.match(forwardSource, /document\.body\.classList\.remove\("is-lovebrain-home-active"\)/);
  assert.match(forwardSource, /startSpaceLens\(\)/);
  assert.match(forwardSource, /startTitleLens\(\)/);

  const returnStart = homeSource.indexOf("const returnLovebrainToGate =");
  const returnEnd = homeSource.indexOf("const isHomeSectionSnapEnabled =", returnStart);
  const returnSource = homeSource.slice(returnStart, returnEnd);
  assert.doesNotMatch(returnSource, /activateOpeningBridgePortal/);
  assert.doesNotMatch(returnSource, /startOpeningTitleBridgeDissolve/);
  assert.doesNotMatch(returnSource, /resetGateState/);
  assert.doesNotMatch(returnSource, /scheduleWarningWarmup/);
  assert.match(returnSource, /yuimi:kisara-lovebrain-return-start/);
});

test("Default Home runtime loops and renderers are stopped while Lovebrain owns the gate", () => {
  assert.match(homeSource, /if \(lovebrainActive \|\| pageMode === "lovebrain"\) return;/);
  assert.match(homeSource, /if \(!energyContext \|\| lovebrainActive \|\| pageMode !== "gate"/);
  assert.match(homeSource, /spaceLensRenderer\?\.destroy\(\)/);
  assert.match(homeSource, /titleLensRenderer\?\.destroy\(\)/);
  assert.match(homeSource, /cancelBurstWarmup\(\)/);
  assert.match(homeSource, /cancelWarningWarmupSchedule\(\)/);
  assert.match(homeSource, /finishWarningPresentationWarmup\(false, true\)/);
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
