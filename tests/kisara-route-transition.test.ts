import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const resolve = (relativePath: string) => fileURLToPath(new URL(`../${relativePath}`, import.meta.url));
const read = (relativePath: string) => readFileSync(resolve(relativePath), "utf8");

const layout = read("src/themes/kisara/layouts/KisaraLayout.astro");
const themeStyles = read("src/themes/kisara/styles/theme.css");

test("Kisara route swaps do not animate or composite old and new pages", () => {
  assert.match(layout, /<ClientRouter fallback="swap" \/>/);
  assert.doesNotMatch(layout, /KisaraRouteRelay|transition:name/);
  assert.equal(existsSync(resolve("src/themes/kisara/components/KisaraRouteRelay.astro")), false);
  assert.match(themeStyles, /::view-transition-old\(\*\)\s*\{\s*display:\s*none\s*!important;/);
  assert.match(themeStyles, /::view-transition-new\(\*\)\s*\{[^}]*opacity:\s*1\s*!important;/s);
  assert.match(themeStyles, /::view-transition-group\(\*\),\s*::view-transition-old\(\*\),\s*::view-transition-new\(\*\)\s*\{[^}]*animation:\s*none\s*!important;/s);
});
