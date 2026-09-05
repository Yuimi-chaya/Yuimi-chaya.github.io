import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const homeSource = readFileSync(
  fileURLToPath(new URL("../src/themes/kisara/pages/HomePage.astro", import.meta.url)),
  "utf8"
);

test("Home clears release particles before the opaque comic handoff leaves the Gate", () => {
  const clearStart = homeSource.indexOf("const clearReleaseTransientEffects =");
  const clearEnd = homeSource.indexOf("const startReleaseAutoplay =", clearStart);
  const clearSource = homeSource.slice(clearStart, clearEnd);
  for (const collection of ["wakeParticles", "orbitParticles", "burstParticles", "rainParticles"]) {
    assert.match(clearSource, new RegExp(`${collection}\\.length = 0`));
  }
  assert.match(clearSource, /burstContext\?\.clearRect/);

  const enterStart = homeSource.indexOf("const enterNextPage =");
  const enterEnd = homeSource.indexOf("const finalizeLovebrainExit =", enterStart);
  const enterSource = homeSource.slice(enterStart, enterEnd);
  const clearIndex = enterSource.indexOf("clearReleaseTransientEffects()");
  const bridgeIndex = enterSource.indexOf('runComicHandoff("opening"');
  assert.ok(clearIndex >= 0 && bridgeIndex > clearIndex);
  assert.doesNotMatch(enterSource, /smoothScrollTo\(/);
  assert.doesNotMatch(enterSource, /activateOpeningBridgePortal\(/);
  assert.match(enterSource, /finalizeGateResetForNextPage\(\)/);
});

test("Restored and damped Home navigation settles on a current section anchor", () => {
  assert.match(homeSource, /let restoredHomeSectionAlignmentPending = restoredBelowGate/);
  assert.match(homeSource, /const findRestoredHomeSectionStop =/);
  assert.match(homeSource, /decodeURIComponent\(rawHash\)/);
  assert.match(homeSource, /const settleHomeSectionStop =/);
  assert.match(homeSource, /setScrollPosition\(destination, true\)/);

  const sectionStart = homeSource.indexOf("const smoothScrollToHomeSection =");
  const sectionEnd = homeSource.indexOf("const resetHomeSectionWheelGesture =", sectionStart);
  assert.match(homeSource.slice(sectionStart, sectionEnd), /settleHomeSectionStop\(stop\)/);

  const restoreStart = homeSource.indexOf("const scheduleRestoreWindowClose =");
  const restoreEnd = homeSource.indexOf("const syncDeferredGateReset =", restoreStart);
  const restoreSource = homeSource.slice(restoreStart, restoreEnd);
  assert.match(restoreSource, /scheduleRestoredHomeSectionAlignment\(\)/);
  assert.match(restoreSource, /restoredHomeSectionAlignmentPending = true/);
  assert.match(homeSource, /cancelAnimationFrame\(restoredHomeSectionAlignmentFrame\)/);
});
