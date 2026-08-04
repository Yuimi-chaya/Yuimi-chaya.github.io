import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectsPagePath = fileURLToPath(new URL("../src/themes/kisara/pages/ProjectsPage.astro", import.meta.url));
const projectsCssPath = fileURLToPath(new URL("../src/themes/kisara/styles/projects.css", import.meta.url));
const projectsPageSource = readFileSync(projectsPagePath, "utf8");
const projectsCssSource = readFileSync(projectsCssPath, "utf8");

test("Works reuses the transparent Fuyukawa pig as a rare unsliceable target", () => {
  assert.match(projectsPageSource, /mini-pig-scroll\.webp/);
  assert.match(projectsPageSource, /data-fruit-kind="pig"/);
  assert.match(projectsPageSource, /isPig \? 4\.8 \+ Math\.random\(\) \* 5\.2/);
  assert.match(projectsPageSource, /state\.isPig \? 5\.8 \+ Math\.random\(\) \* 7\.4/);
  assert.match(projectsPageSource, /state\.isPig \|\| state\.phase !== "whole"/);
});

test("Pig collisions block the blade path and use pointer velocity as impulse", () => {
  assert.match(projectsPageSource, /const segmentEllipseCollision =/);
  assert.match(projectsPageSource, /blockedEnd = \{ \.\.\.pigCollision\.collision, time: point\.time \}/);
  assert.match(projectsPageSource, /const pointerSpeed = clamp\(distance \/ elapsed, 180, 2800\)/);
  assert.match(projectsPageSource, /directionX \* impulse/);
  assert.match(projectsPageSource, /directionY \* impulse/);
  assert.match(projectsPageSource, /appendSliceTrail\(start, collision\)/);
});

test("Pig bounces from side and top walls, never the bottom, then fades", () => {
  assert.match(projectsPageSource, /state\.x - halfWidth < 0 && state\.vx < 0/);
  assert.match(projectsPageSource, /state\.x \+ halfWidth > width && state\.vx > 0/);
  assert.match(projectsPageSource, /state\.y - halfHeight < 0 && state\.vy < 0/);
  assert.doesNotMatch(projectsPageSource, /state\.y \+ halfHeight > height && state\.vy > 0/);
  assert.match(projectsPageSource, /state\.bounceCount >= state\.maxBounces/);
  assert.match(projectsPageSource, /state\.fadeElapsed \/ 0\.9/);
  assert.match(projectsCssSource, /kisara-works-pig-impact/);
  assert.match(projectsCssSource, /@keyframes kisara-works-pig-hit/);
});
