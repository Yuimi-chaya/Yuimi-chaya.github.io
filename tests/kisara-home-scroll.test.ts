import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const homeSource = readFileSync(
  fileURLToPath(new URL("../src/themes/kisara/pages/HomePage.astro", import.meta.url)),
  "utf8"
);

test("Home clears release particles only inside the covered comic commit", () => {
  const clearStart = homeSource.indexOf("const clearReleaseTransientEffects =");
  const clearEnd = homeSource.indexOf("const startReleaseAutoplay =", clearStart);
  const clearSource = homeSource.slice(clearStart, clearEnd);
  for (const collection of ["wakeParticles", "orbitParticles", "burstParticles", "rainParticles"]) {
    assert.match(clearSource, new RegExp(`${collection}\\.length = 0`));
  }
  assert.match(clearSource, /spaceLensRenderer\?\.clear/);
  assert.match(clearSource, /titleLensRenderer\?\.clear/);
  assert.doesNotMatch(homeSource, /data-kisara-burst-canvas/);

  const enterStart = homeSource.indexOf("const enterNextPage =");
  const enterEnd = homeSource.indexOf("const finalizeLovebrainExit =", enterStart);
  const enterSource = homeSource.slice(enterStart, enterEnd);
  const clearIndex = enterSource.indexOf("clearReleaseTransientEffects()");
  const bridgeIndex = enterSource.indexOf('runComicHandoff("opening"');
  assert.ok(bridgeIndex >= 0 && clearIndex > bridgeIndex);
  assert.ok(enterSource.indexOf("setPostReleaseActive(false)") > bridgeIndex);
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

function sectionNavigation() {
  class Element {
    id: string;
    constructor(id: string) { this.id = id; }
    closest() { return null; }
  }
  const sections = ["001", "002", "003", "004"].map(id => new Element(id));
  const transitions: string[] = [];
  let prevented = 0;
  const context = vm.createContext({
    HTMLElement: Element, Element,
    opening: sections[0],
    homeSectionSnapMedia: { matches: true }, pageMode: "next", modalOpen: false,
    document: {
      querySelector: (selector: string) => sections.find(section => selector.includes(`"${section.id}"`)),
      documentElement: { classList: { contains: () => context.modalOpen } },
    },
    window: { scrollY: 0, innerHeight: 900 },
    clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
    getHomeSectionStopRecords: () => sections.map((element, index) => ({ element, index, top: index * 900 })),
    smoothScrollToHomeSection: (stop: { element: Element }) => transitions.push(stop.element.id),
    performance: { now: () => 1000 }, homeSectionInputGuardUntil: 0,
    readHomeSectionWheelDirection: (delta: number) => ({ direction: Math.sign(delta), gestureSerial: 1 }),
    homeGateReturnArmed: false, clearHomeGateReturnArm() {}, armHomeGateReturn() {},
  });
  const between = (start: string, end: string) => {
    const at = homeSource.indexOf(start);
    assert.ok(at >= 0);
    const until = homeSource.indexOf(end, at);
    assert.ok(until > at);
    return homeSource.slice(at, until);
  };
  vm.runInContext([
    between("const homeSectionStops =", "let scrollFrame ="),
    between("const isHomeSectionSnapEnabled =", "const getHomeSectionTop ="),
    between("const findHomeSectionTarget =", "const smoothScrollToHomeSection ="),
    between("const handleHomeSectionInput =", "const shapeGateWheelDelta ="),
    "globalThis.navigate = handleHomeSectionInput; globalThis.stopCount = homeSectionStops.length;",
  ].join("\n"), context);
  return {
    context, transitions,
    prevented: () => prevented,
    navigate: (delta: number, type = "wheel") => context.navigate(delta, {
      target: new Element("body"), preventDefault: () => prevented++,
    }, type),
  };
}

test("Four Home chapters still intercept wheel and keyboard input for every adjacent transition", () => {
  const f = sectionNavigation();
  assert.equal(f.context.stopCount, 4);
  for (const type of ["wheel", "keyboard"]) {
    for (const [from, delta, to] of [[0, 120, "002"], [1, 120, "003"], [2, 120, "004"],
      [3, -120, "003"], [2, -120, "002"], [1, -120, "001"]] as const) {
      f.context.window.scrollY = from * 900;
      assert.equal(f.navigate(delta, type), true, `${type}: ${from + 1} → ${to}`);
      assert.equal(f.transitions.at(-1), to);
    }
  }
  assert.equal(f.prevented(), 12);
  f.context.window.scrollY = 2700;
  assert.equal(f.navigate(120), true);
  assert.equal(f.transitions.length, 12, "004 has no extra standalone stage destination");
});

test("Home chapter interception still yields to touch, narrow screens, Gate mode and event dialogs", () => {
  const f = sectionNavigation();
  assert.equal(f.navigate(120, "touch"), false);
  f.context.homeSectionSnapMedia.matches = false;
  assert.equal(f.navigate(120), false);
  f.context.homeSectionSnapMedia.matches = true;
  f.context.pageMode = "gate";
  assert.equal(f.navigate(120), false);
  f.context.pageMode = "next";
  f.context.modalOpen = true;
  assert.equal(f.navigate(120), false);
  assert.equal(f.prevented(), 0);
  assert.equal(f.transitions.length, 0);
});
