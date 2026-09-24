import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { selectCoverNames } from "../scripts/lib/cover-selection.mjs";

test("cover generation uses accepted sources, not every candidate file in public", async () => {
  const manifest = JSON.parse(await readFile(new URL("../src/core/content/responsive-covers.json", import.meta.url), "utf8"));
  const selected = selectCoverNames(manifest);
  assert.deepEqual(selected, Object.keys(manifest).map(source => source.slice("/blog-covers/".length)).sort());
  assert.deepEqual(selectCoverNames({ "/blog-covers/cover-01.webp": {} }, ["cover-25.webp"]),
    ["cover-01.webp", "cover-25.webp"]);
  assert.deepEqual(selectCoverNames({ "/blog-covers/cover-01.webp": {} }, ["cover-01.webp"]),
    ["cover-01.webp"]);
  assert.throws(() => selectCoverNames({}), /No accepted/);
  assert.throws(() => selectCoverNames({ "/other/cover-01.webp": {} }), /Invalid responsive/);
  assert.throws(() => selectCoverNames({ "/blog-covers/cover-01.webp": {} }, ["../secret.webp"]), /Invalid cover/);
});
