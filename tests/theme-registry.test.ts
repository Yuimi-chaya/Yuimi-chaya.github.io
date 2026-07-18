import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_THEME_ID,
  getCanonicalPath,
  getThemePath,
  isThemeId
} from "../src/core/themes/registry.ts";

test("theme registry uses the character theme as the default", () => {
  assert.equal(DEFAULT_THEME_ID, "fuyukawa-kagari");
  assert.equal(isThemeId("fuyukawa-kagari"), true);
  assert.equal(isThemeId("blank"), true);
  assert.equal(isThemeId("removed-theme"), false);
});

test("canonical paths strip the blank theme prefix", () => {
  assert.equal(getCanonicalPath("/themes/blank/"), "/");
  assert.equal(getCanonicalPath("/themes/blank/blog/hello-asteria/"), "/blog/hello-asteria/");
  assert.equal(getCanonicalPath("/blog/hello-asteria/"), "/blog/hello-asteria/");
});

test("theme paths preserve the current page context", () => {
  const article = "/blog/hello-asteria/";
  assert.equal(getThemePath("blank", article), "/themes/blank/blog/hello-asteria/");
  assert.equal(
    getThemePath("fuyukawa-kagari", "/themes/blank/blog/hello-asteria/"),
    article
  );
});

