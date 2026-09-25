import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { stripTypeScriptTypes } from "node:module";

const fridgeSource = readFileSync(
  fileURLToPath(new URL("../src/themes/kisara/components/KisaraFridgeScene.astro", import.meta.url)),
  "utf8"
);

test("Baked fridge clip is smaller while the original remains available", () => {
  const asset = (name: string) => fileURLToPath(new URL(`../public/themes/kisara/assets/${name}`, import.meta.url));
  const original = statSync(asset("fridge-opening-002.mp4"));
  const baked = statSync(asset("fridge-opening-002-fast.mp4"));
  assert.ok(baked.size > 0 && baked.size < original.size);
  assert.match(fridgeSource, /data-src="\/themes\/kisara\/assets\/fridge-opening-002-fast\.mp4"/);
});

test("Fridge inventory begins dropping just before the door reaches its open frame", () => {
  assert.match(fridgeSource, /const bodyDropStartTime = 0\.88 \/ 1\.5;/);
  assert.match(fridgeSource, /video\.playbackRate = 1;/);
  assert.match(fridgeSource, /video\.addEventListener\("timeupdate", bodyReleaseHandler\)/);
  assert.match(fridgeSource, /bodyReleaseFrame = video\.requestVideoFrameCallback\(checkReleaseFrame\)/);
  assert.match(fridgeSource, /video\.cancelVideoFrameCallback\(bodyReleaseFrame\)/);
  assert.match(fridgeSource, /video\.currentTime >= bodyDropStartTime/);
  assert.match(fridgeSource, /bodyElements\.length !== 4/);
  assert.match(fridgeSource, /data-fridge-kind="pig-capsule"/);
  assert.match(fridgeSource, /mini-pig-scroll\.webp/);

  const startOpening = fridgeSource.slice(fridgeSource.indexOf("const startOpening"));
  const bodyReleaseIndex = startOpening.indexOf("bodyReleaseHandler =");
  const endedIndex = startOpening.indexOf("const handleEnded");
  assert.ok(bodyReleaseIndex >= 0 && endedIndex >= 0 && bodyReleaseIndex > endedIndex);
});

test("Fridge coverage survives playback retries until a ready frame, final fallback, or cancellation", async () => {
  const start = fridgeSource.indexOf("this.coveredEntry = () =>");
  const end = fridgeSource.indexOf("const resumeLoadedOpening =", start);
  assert.ok(start >= 0 && end > start);
  const code = stripTypeScriptTypes(fridgeSource.slice(start, end));
  for (const outcome of ["ready", "timeout", "hidden", "abort"]) {
    const controller = new AbortController();
    const timers = new Map<number, Function>();
    const doc = Object.assign(new EventTarget(), { hidden: false });
    let starts = 0, resolved = false, serial = 0;
    const scope = {
      signal: controller.signal, document: doc, sceneVisible: false, opened: false, reducedMotion: false,
      finishCoveredEntry: null as (() => void) | null,
      measureSceneVisibility: () => true,
      armOpening() {},
      startOpening() { starts++; },
      finishOpening() { scope.opened = true; scope.finishCoveredEntry?.(); },
      window: {
        setTimeout(callback: Function) { timers.set(++serial, callback); return serial; },
        clearTimeout(id: number) { timers.delete(id); },
      },
    };
    const root = { coveredEntry: null as (() => Promise<void>) | null };
    new Function("scope", `with (scope) { ${code} }`).call(root, scope);
    const pending = root.coveredEntry!().then(() => { resolved = true; });
    const barrier = scope.finishCoveredEntry;
    scope.startOpening();
    await Promise.resolve();
    assert.equal(starts, 2);
    assert.equal(resolved, false);
    assert.equal(scope.finishCoveredEntry, barrier);
    if (outcome === "ready") scope.finishCoveredEntry?.();
    if (outcome === "timeout") [...timers.values()][0]();
    if (outcome === "hidden") { doc.hidden = true; doc.dispatchEvent(new Event("visibilitychange")); }
    if (outcome === "abort") controller.abort();
    await pending;
    assert.equal(timers.size, 0);
    assert.equal(scope.finishCoveredEntry, null);
    assert.equal(scope.opened, false, "A cover timeout must not complete the video");
    controller.abort();
  }
});
