import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const readSource = (relativePath: string) => readFileSync(
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
  "utf8"
);

const gamesPageSource = readSource("src/themes/kisara/pages/GamesPage.astro");
const gameClueSource = readSource("src/themes/kisara/components/KisaraGameClueScene.astro");
const gameInvestigationCssSource = readSource("src/themes/kisara/styles/game-investigation.css");

test("Game first scene owns the migrated investigation and accepted camera state machine", () => {
  assert.match(gamesPageSource, /<KisaraGameClueScene\s*\/>/);
  assert.match(gameClueSource, /id="kisara-game-investigation"/);
  assert.match(gameClueSource, /class="kisara-game-scene kisara-game-hero kisara-game-investigation"/);
  assert.match(gameClueSource, /<kisara-game-clue-scene/);
  assert.match(gameClueSource, /data-game-scene-next/);
  assert.match(gameClueSource, /const syncTapeGlint =/);
  assert.match(gameClueSource, /const runCameraPan =/);
  assert.match(gameClueSource, /is-camera-snapping/);
  assert.match(gameClueSource, /cameraClueY = 44\.3/);
  assert.match(gameInvestigationCssSource, /\.kisara-event-lens-vignette/);
  assert.match(gameInvestigationCssSource, /\.kisara-event-scan-corners/);
});

test("Game shake easter is temporarily absent from the page runtime", () => {
  assert.doesNotMatch(gamesPageSource, /data-game-shake-easter/);
  assert.doesNotMatch(gamesPageSource, /game-shake-easter\.mp4/);
  assert.doesNotMatch(gamesPageSource, /darekare-scramble/);
  assert.doesNotMatch(gamesPageSource, /shakeEaster/);
  assert.doesNotMatch(gameClueSource, /data-game-overdrive/);
  assert.doesNotMatch(gameClueSource, /data-game-input-speed/);
});
