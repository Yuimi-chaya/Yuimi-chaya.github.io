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

test("Kisara Home renders its title abyss procedurally and pauses it with the Gate lifecycle", () => {
  const rimSource = homeSource.slice(
    homeSource.indexOf("const rebuildTitleEffectMask ="),
    homeSource.indexOf("const rebuildTitleAbyssFluidBuffer =")
  );
  const abyssSource = homeSource.slice(
    homeSource.indexOf("const drawTitleAbyss ="),
    homeSource.indexOf("const paintBurstWarmupStep =")
  );
  const fluidSource = homeSource.slice(
    homeSource.indexOf("const paintTitleAbyssFluid ="),
    homeSource.indexOf("const resizeTitleDataCanvas =")
  );
  assert.match(homeSource, /data-kisara-title-abyss/);
  assert.match(homeSource, /const drawTitleAbyss =/);
  assert.match(homeSource, /const rebuildTitleAbyssFluidBuffer =/);
  assert.match(homeSource, /const paintTitleAbyssFluid =/);
  assert.match(homeSource, /const titleAbyssRimCanvas =/);
  assert.match(homeSource, /const titleAbyssTideCanvas =/);
  assert.match(homeSource, /titleAbyssTideCanvas\.getContext\("2d", \{ alpha: false \}\)/);
  assert.equal((rimSource.match(/titleAbyssRimContext\.strokeText/g) ?? []).length, 1);
  assert.match(rimSource, /getPropertyValue\("-webkit-text-stroke-color"\)/);
  assert.doesNotMatch(rimSource, /rgba\(1,3,14,0\.98\)|rimGradient|rgba\(126,143,183/);
  assert.match(homeSource, /litePerformance \? 128 : mobilePerformance \? 176 : 320/);
  assert.match(homeSource, /Math\.max\(window\.devicePixelRatio \|\| 1, 1\.6\)/);
  assert.match(homeSource, /Math\.min\(deviceScale, 2304 \/ width, 680 \/ height\)/);
  assert.match(abyssSource, /context\.imageSmoothingQuality = "high"/);
  assert.match(abyssSource, /paintTitleAbyssFluid\(timestamp, fill, force\)/);
  assert.match(abyssSource, /context\.drawImage\(\s*titleAbyssTideCanvas/);
  assert.match(fluidSource, /tidePixels\[offset \+ 3\] = 255/);
  assert.match(abyssSource, /litePerformance \? 24 : mobilePerformance \? 34 : 48/);
  assert.match(abyssSource, /const spillPulse =/);
  assert.match(abyssSource, /const covePulse =/);
  assert.match(abyssSource, /closeTidePath\(covePoints, width \+ padding\)/);
  assert.match(abyssSource, /context\.clip\(fringePath\)/);
  assert.match(abyssSource, /context\.clip\(tidePath\)/);
  assert.match(abyssSource, /context\.clip\(covePath\)[^]*context\.clip\(tidePath\)/);
  assert.doesNotMatch(abyssSource, /stroke\(edgePath\)|lineWidth = 13|lineWidth = 7\.5|tidePath\.ellipse/);
  assert.doesNotMatch(fluidSource, /signedDistance|tideAlpha|edgeAmplitude = \(3\.6/);
  assert.doesNotMatch(abyssSource, /const redGradient =/);
  assert.match(abyssSource, /context\.drawImage\(titleAbyssRimCanvas, 0, 0\)/);
  assert.match(homeSource, /reducedMotion \? 0\.0025 : 0\.025/);
  assert.match(abyssSource, /!titleAbyssTideImageData[^]*classList\.remove\("is-title-abyss-ready"\)/);
  assert.match(homeSource, /const titleAbyssDomHandoffStart = 0\.72/);
  assert.match(homeSource, /intro - titleAbyssDomHandoffStart/);
  assert.match(abyssSource, /chargeIntroProgress >= titleAbyssDomHandoffStart[^]*classList\.remove\("is-title-abyss-ready"\)/);
  assert.match(abyssSource, /burstProgress > glossFadeEnd \+ 0\.002[^]*classList\.remove\("is-title-abyss-ready"\)/);
  assert.doesNotMatch(abyssSource, /paintSingularityField|eventHorizon|ringRadius|Starfield|voidPockets/);
  assert.match(homeSource, /titleAbyssPointerX \* \(mobilePerformance \? 20 : 76\)/);
  assert.match(homeSource, /1000 \/ \(activeMotion \? 45 : 30\)/);
  assert.match(homeSource, /const handleTitleAbyssPointer =/);
  assert.match(homeSource, /progress >= 0\.999/);
  assert.match(homeSource, /document\.visibilityState !== "visible"/);
  assert.match(homeSource, /clearTitleAbyssCanvas\(true\)/);
  assert.match(homeStyles, /\.kisara-gate\.is-title-abyss-ready \.kisara-title-abyss-canvas/);
  assert.match(homeStyles, /:is\(\.is-bursting, \.is-burst-complete, \.is-post-release\)[^]*transition: none/);
});

test("Kisara Home contains opposing weave tails and keeps their sources unbounded", () => {
  const chainPathSource = homeSource.slice(
    homeSource.indexOf("const chainDefinitions ="),
    homeSource.indexOf("const sampleTitleChain =")
  );
  const chainSpacingSource = homeSource.slice(
    homeSource.indexOf("const buildTitleChainLinkUnits ="),
    homeSource.indexOf("const getChainLinkSprite =")
  );
  assert.equal((chainPathSource.match(/tailInset:/g) ?? []).length, 2);
  assert.match(chainPathSource, /const entryInset = box\.width \* definition\.xInset/);
  assert.match(chainPathSource, /const tailLinkWidth = getChainLinkDimensions\(definition\)\.width/);
  assert.match(chainPathSource, /tailLinkWidth \* 0\.72 \+ box\.height \* 0\.06[^]*\) \+ tailLinkWidth/);
  assert.match(chainPathSource, /definition\.direction < 0 \? textLeft \+ tailBurial : textLeft - entryInset/);
  assert.match(chainPathSource, /definition\.direction > 0 \? textRight - tailBurial : textRight \+ entryInset/);
  assert.match(chainSpacingSource, /const sourceTailStep = 1 \/ Math\.max\(1, linkCount - 1\)/);
  assert.match(chainSpacingSource, /Math\.ceil\(definition\.entryOverscan \/ sourceTailStep \/ 2\) \* 2/);
  assert.match(chainSpacingSource, /definition\.direction > 0[^]*\? -sourceDistance[^]*: 1 \+ sourceDistance/);
  assert.match(homeSource, /const order = clamp\([^]*definition\.direction > 0 \? distanceUnit : 1 - distanceUnit[^]*0,[^]*1[^]*\)/);
  assert.match(homeSource, /const travel = definition\.type === "weave" \? build : easeOutCubic\(build\)/);
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

test("Kisara Home masks chapter seams with motion-paper transitions", () => {
  assert.match(homeSource, /is-memory-to-fridge[^]*is-fridge-to-event[^]*is-event-to-latest/);
  assert.match(homeStyles, /\.kisara-home-transition \{[^]*--transition-paper:[^]*radial-gradient\(circle, var\(--transition-dot\)/);
  assert.match(homeStyles, /\.kisara-home-transition:not\(\.is-latest-to-footer\)::before,[^]*border: 2px dashed var\(--transition-pink\)/);
  assert.match(homeStyles, /\.kisara-home-transition\.is-event-to-latest \{[^]*--transition-from: #080a12;[^]*--transition-to: #dbe2ec;/);
  assert.match(homeStyles, /animation-timeline: view\(block\)/);
  assert.match(homeStyles, /prefers-reduced-motion: reduce[^]*\.kisara-home-transition::before[^]*animation: none !important/);
  assert.match(homeStyles, /data-yuimi-performance="lite"[^]*\.kisara-home-transition::before[^]*animation: none !important/);
});
