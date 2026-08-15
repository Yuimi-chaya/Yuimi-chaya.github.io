import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const fridgeSource = readFileSync(
  fileURLToPath(new URL("../src/themes/kisara/components/KisaraFridgeScene.astro", import.meta.url)),
  "utf8"
);

test("Fridge inventory begins dropping just before the door reaches its open frame", () => {
  assert.match(fridgeSource, /const bodyDropStartTime = 0\.88;/);
  assert.match(fridgeSource, /video\.addEventListener\("timeupdate", bodyReleaseHandler\)/);
  assert.match(fridgeSource, /video\.currentTime >= bodyDropStartTime/);
  assert.match(fridgeSource, /bodyElements\.length !== 4/);
  assert.match(fridgeSource, /data-fridge-kind="pig-capsule"/);
  assert.match(fridgeSource, /mini-pig-scroll\.webp/);

  const startOpening = fridgeSource.slice(fridgeSource.indexOf("const startOpening"));
  const bodyReleaseIndex = startOpening.indexOf("bodyReleaseHandler =");
  const endedIndex = startOpening.indexOf("const handleEnded");
  assert.ok(bodyReleaseIndex >= 0 && endedIndex >= 0 && bodyReleaseIndex > endedIndex);
});
