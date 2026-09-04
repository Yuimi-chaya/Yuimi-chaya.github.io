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
const layoutSource = readSource("src/themes/kisara/layouts/KisaraLayout.astro");
const homeSource = readSource("src/themes/kisara/pages/HomePage.astro");
const homeEventSource = readSource("src/themes/kisara/components/KisaraHomeEventVideo.astro");
const homeStyles = readSource("src/themes/kisara/styles/home.css");

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

test("Kisara Home discovers and decodes its first Gate scene before revealing it", () => {
  assert.match(layoutSource, /priorityImageUrls\.map\([^]*rel="preload"[^]*as="image"[^]*fetchpriority="high"/);
  assert.match(homeSource, /priorityImages=\{activeBackgroundUrl \? \[activeBackgroundUrl\] : \[\]\}/);
  assert.match(homeSource, /root\.dataset\.kisaraGateMedia = source \? "pending" : "ready"/);
  assert.match(homeSource, /image\.fetchPriority = "high"/);
  assert.match(homeSource, /await image\.decode\(\)/);
  assert.match(homeSource, /revealPaintFrame = window\.requestAnimationFrame/);
  assert.match(homeStyles, /data-kisara-gate-media="pending"[^]*\.kisara-gate-visual-shell::after[^]*opacity: 1/);
  assert.match(homeStyles, /transition: opacity 420ms/);
});

test("Kisara Home 003 keeps its full-screen fragment deferred and subtitle-free", () => {
  assert.match(homeEventSource, /data-kisara-home-stop="003"/);
  assert.match(homeEventSource, /data-home-event-video/);
  assert.match(homeEventSource, /poster="\/themes\/kisara\/assets\/home-event-003-new-last\.webp"/);
  assert.match(homeEventSource, /preload="none"/);
  assert.match(homeEventSource, /muted/);
  assert.match(homeEventSource, /playsinline/);
  assert.match(homeEventSource, /data-src="\/themes\/kisara\/assets\/home-event-003-new\.mp4"/);
  assert.doesNotMatch(homeEventSource, /<track\b/i);
  assert.doesNotMatch(homeEventSource, /<source\b[^>]*\ssrc=/i);
});

test("Kisara Home 003 cues its board labels from the real video clock", () => {
  assert.match(homeEventSource, /data-home-event-cue="target-track"/);
  assert.match(homeEventSource, /POINT OF INTEREST \/ 003/);
  assert.match(homeEventSource, /QUESTION[^]*GESTURE[^]*ANSWER/);
  assert.match(homeEventSource, /video\.currentTime \* 1000/);
  assert.match(homeEventSource, /animation\.currentTime = cueTime/);
  assert.match(homeEventSource, /requestAnimationFrame\(tick\)/);
  assert.match(homeEventSource, /prefers-reduced-motion: reduce/);
});
