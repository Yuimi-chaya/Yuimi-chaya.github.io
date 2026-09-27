import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";

const source = readFileSync(new URL("../styles/refresh.css", import.meta.url), "utf8");
const css = postcss.parse(source);
const rule = [...css.nodes].flatMap((node) => {
  if (node.type !== "rule") return [];
  return node.selectors.includes("body[data-fuyukawa] #live2d") ? [node] : [];
})[0];
const declarations = Object.fromEntries(rule.nodes
  .filter((node) => node.type === "decl")
  .map((node) => [node.prop, node.value]));

test("Live2D feet dissolve into the hero without changing the model asset", () => {
  assert.ok(rule, "Fuyukawa must own the Live2D canvas styling");
  assert.match(declarations["-webkit-mask-image"], /linear-gradient/);
  assert.match(declarations["mask-image"], /transparent 100%/);
  assert.equal(declarations["-webkit-mask-repeat"], "no-repeat");
  assert.equal(declarations["mask-size"], "100% 100%");
});
