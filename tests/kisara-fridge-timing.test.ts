import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const fridgeSource = readFileSync(
  fileURLToPath(new URL("../src/themes/kisara/components/KisaraFridgeScene.astro", import.meta.url)),
  "utf8"
);

test("Fridge inventory begins dropping when the door reaches its open frame", () => {
  assert.match(fridgeSource, /const bodyDropStartTime = 1;/);
  assert.match(fridgeSource, /video\.addEventListener\("timeupdate", bodyReleaseHandler\)/);
  assert.match(fridgeSource, /video\.currentTime >= bodyDropStartTime/);

  const startOpening = fridgeSource.slice(fridgeSource.indexOf("const startOpening"));
  const bodyReleaseIndex = startOpening.indexOf("bodyReleaseHandler =");
  const endedIndex = startOpening.indexOf("const handleEnded");
  assert.ok(bodyReleaseIndex >= 0 && endedIndex >= 0 && bodyReleaseIndex > endedIndex);
});
