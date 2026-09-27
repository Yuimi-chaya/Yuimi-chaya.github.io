import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";

const source = readFileSync(new URL("../styles/refresh.css", import.meta.url), "utf8");
const css = postcss.parse(source);
const prefix = "body[data-fuyukawa]";
const declarations = (selector, media = null) => {
  const result = {};
  css.walkRules((rule) => {
    if (!rule.selectors.includes(selector)) return;
    if (media ? rule.parent.params !== media : rule.parent.type !== "root") return;
    rule.walkDecls((decl) => { result[decl.prop] = decl.value; });
  });
  return result;
};
const deck = declarations(prefix + " .music-widget .record-player");
const disc = declarations(prefix + " .music-widget .record-disc");
const label = declarations(prefix + " .music-widget .record-label");
const pivot = declarations(prefix + " .music-widget .record-player::after");
const arm = declarations(prefix + " .music-widget .record-arm");
const weight = declarations(prefix + " .record-arm::before");
const cartridge = declarations(prefix + " .record-arm::after");
const playing = declarations(prefix + ".is-music-playing .record-arm");
const em = (value, size) => {
  assert.match(value, /^-?[.0-9]+em$/);
  return parseFloat(value) * size;
};
const percent = (value, size) => {
  assert.match(value, /^[.0-9]+%$/);
  return parseFloat(value) / 100 * size;
};
const angle = (value) => {
  assert.match(value, /^rotate[(]-?[.0-9]+deg[)]$/);
  return parseFloat(value.slice(7));
};

test("record deck scales every mechanical part together without changing the music layout", () => {
  assert.equal(deck.width, "var(--record-size)");
  assert.equal(deck.height, deck.width);
  assert.equal(deck["font-size"], deck.width);
  assert.equal(deck["--record-size"], "108px");
  assert.equal(declarations(prefix + " .music-widget .record-player", "(max-width: 360px)")["--record-size"], "92px");
  for (const part of [deck, disc, label, pivot, cartridge, weight]) assert.equal(part["box-sizing"], "border-box");
  assert.ok(Number(pivot["z-index"]) > 2, "the fixed axle covers the moving arm root");
  assert.match(disc.background, /repeating-radial-gradient/);
});

test("tonearm stays joined to a fixed axle and touches grooves, not the label", () => {
  assert.equal(arm.border, "0");
  assert.equal(arm.right, "auto");
  assert.equal(arm.top, pivot.top);
  assert.equal(arm["transform-origin"], "50% 0");
  assert.equal(cartridge.transform, "translateX(-50%)");
  assert.equal(cartridge.left, "50%");
  assert.equal(cartridge.bottom, "auto");
  const offset = arm.left.match(/^calc[(]([.0-9]+)% - ([.0-9]+em)[)]$/);
  const overlap = cartridge.top.match(/^calc[(]100% - ([.0-9]+em)[)]$/);
  assert.ok(offset && overlap);
  for (const size of [108, 92]) {
    const inner = size - 2 * parseFloat(deck.border);
    const origin = { x: percent(pivot.left, inner), y: percent(pivot.top, inner) };
    const armX = Number(offset[1]) / 100 * inner - em(offset[2], size);
    assert.ok(Math.abs(armX + em(arm.width, size) / 2 - origin.x) < 1e-9);
    const length = em(arm.height, size);
    const headTop = length - em(overlap[1], size);
    const headEnd = headTop + em(cartridge.height, size);
    assert.ok(headTop < length && headEnd > length, "cartridge physically overlaps the shaft");
    const center = { x: percent(disc.left, inner) + em(disc.width, size) / 2,
      y: percent(disc.top, inner) + em(disc.height, size) / 2 };
    const radius = em(disc.width, size) / 2;
    const rotate = (x, y, degrees) => {
      const a = degrees * Math.PI / 180;
      return { x: origin.x + x * Math.cos(a) - y * Math.sin(a),
        y: origin.y + x * Math.sin(a) + y * Math.cos(a) };
    };
    for (const degrees of [angle(arm.transform), angle(playing.transform)]) {
      const tip = rotate(0, headEnd, degrees);
      const distance = Math.hypot(tip.x - center.x, tip.y - center.y);
      if (degrees === angle(playing.transform)) {
        assert.ok(distance < radius - 2, "playing stylus is on the vinyl");
        assert.ok(distance > em(label.width, size) / 2 + 2, "stylus clears the illustrated label");
      } else assert.ok(distance > radius + 2, "paused stylus parks outside the disc");
    }
    // Sweep the complete transition, including cartridge and counterweight corners.
    for (let degrees = angle(arm.transform); degrees <= angle(playing.transform); degrees += 1) {
      for (const [width, top, bottom] of [[em(arm.width, size), 0, length],
        [em(cartridge.width, size), headTop, headEnd],
        [em(weight.width, size), em(weight.top, size), em(weight.top, size) + em(weight.height, size)]]) {
        for (const x of [-width / 2, width / 2]) for (const y of [top, bottom]) {
          const point = rotate(x, y, degrees);
          assert.ok(point.x >= 2 && point.x <= inner - 2 && point.y >= 2 && point.y <= inner - 2,
            "all mechanical parts stay inside the deck at " + size + "px / " + degrees + "deg");
        }
      }
    }
  }
});

test("record motion retains pause, hidden drawer, and reduced-motion handling", () => {
  assert.equal(disc["animation-play-state"], "paused");
  assert.equal(declarations(prefix + ".is-music-playing .record-disc")["animation-play-state"], "running");
  for (const state of [".is-dismissed", ":not(:hover):not(:focus-within):not(.is-pinned)"]) {
    assert.equal(declarations(prefix + " .toy-dock" + state + " .record-disc")["animation-play-state"], "paused");
  }
  assert.equal(declarations(prefix + " .music-widget .record-disc", "(prefers-reduced-motion: reduce)").animation, "none");
  assert.equal(declarations(prefix + " .music-widget .record-arm", "(prefers-reduced-motion: reduce)").transition, "none");
  assert.equal(arm.transition, "transform 240ms var(--manga-ease)");
});
