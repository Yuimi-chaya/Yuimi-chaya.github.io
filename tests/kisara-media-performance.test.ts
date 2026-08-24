import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const readSource = (relativePath: string) => readFileSync(
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
  "utf8"
);

const aboutSource = readSource("src/themes/kisara/pages/AboutPage.astro");
const audioSource = readSource("src/themes/kisara/components/KisaraAudioControl.astro");
const lovebrainSource = readSource("src/themes/kisara/components/KisaraLovebrainEasterEgg.astro");

test("Kisara keeps offscreen epilogue media out of the initial image queue", () => {
  assert.match(aboutSource, /me-epilogue\.webp[^]*loading="lazy"[^]*fetchpriority="low"/);
});

test("Kisara persistent audio artwork declares stable intrinsic dimensions", () => {
  assert.match(audioSource, /memory-return-player\.webp[^]*width="480"[^]*height="270"/);
});

test("Lovebrain deferred panels reserve their final media geometry", () => {
  assert.match(lovebrainSource, /stage1-scrub\.mp4[^]*width="1920"[^]*height="1080"/);
  assert.equal((lovebrainSource.match(/width="740"/g) ?? []).length, 3);
  assert.equal((lovebrainSource.match(/height="900"/g) ?? []).length >= 8, true);
  assert.match(lovebrainSource, /final\.webp[^]*width="1600"[^]*height="900"/);
});
