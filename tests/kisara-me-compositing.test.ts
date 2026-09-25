import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const source = readFileSync(
  fileURLToPath(new URL("../src/themes/kisara/styles/about.css", import.meta.url)),
  "utf8"
);

test("Kisara Me memory scenes keep a stable compositing surface", () => {
  const memoryRule = source.match(/\.kisara-me-memory \{([\s\S]*?)\n\}/)?.[1] ?? "";
  const activeRule = source.match(/\.kisara-me-memory\[data-scene-position="active"\] \{([\s\S]*?)\n\}/)?.[1] ?? "";
  const sunriseAfterRule = source.match(
    /\.kisara-me-memory\[data-me-memory="sunrise"\]\[data-scene-position="after"\] \{([\s\S]*?)\n\}/
  )?.[1] ?? "";
  const sunriseBeforeRule = source.match(
    /\.kisara-me-memory\[data-me-memory="sunrise"\]\[data-scene-position="before"\] \{([\s\S]*?)\n\}/
  )?.[1] ?? "";

  assert.match(memoryRule, /backface-visibility:\s*hidden/);
  assert.match(activeRule, /transform:\s*translate3d\(0,\s*0,\s*0\)/);
  assert.doesNotMatch(activeRule, /transform:\s*none/);
  assert.match(sunriseAfterRule, /clip-path:\s*inset\(0\s+0\s+0\s+99\.5%\)/);
  assert.match(sunriseBeforeRule, /clip-path:\s*inset\(0\s+99\.5%\s+0\s+0\)/);
  assert.doesNotMatch(`${sunriseAfterRule}\n${sunriseBeforeRule}`, /clip-path:[^;]*100%/);
});
