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
const homeEventStyles = readSource("src/themes/kisara/styles/home-event-video.css");
const homeStyles = readSource("src/themes/kisara/styles/home.css");

test("Gate attribution keeps its text as a quiet serif credit without cue decoration", () => {
  assert.match(homeSource, /kisara-credit-author">Yuimi-chaya<\/span> \/ <span>GPT in Codex<\/span>/);
  const credit = homeStyles.match(/\.kisara-scroll-cue \{([^}]+)\}/)?.[1] ?? "";
  assert.match(credit, /font: 400 14px\/1\.6 Georgia/);
  assert.match(credit, /right: max\(8%, 24px\)/);
  assert.match(credit, /max-width: calc\(100% - 48px\)/);
  assert.doesNotMatch(credit, /text-shadow|animation|background|border:|transform/);
  assert.doesNotMatch(homeStyles, /\.kisara-scroll-cue(?:::before|\.is-guiding|\.is-enter-ready)\s*\{/);
  assert.match(homeStyles, /\.kisara-credit-author \{ color: #ddd9dd; \}/);
  assert.match(homeStyles, /\.kisara-scroll-cue \{[^}]*font-size: 12px/);
});

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
    homeSource.indexOf("const updateGatePresentation =")
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
  assert.match(fluidSource, /!reducedMotion \|\| Math\.abs\(fill - titleAbyssFluidLastPalette\) < 0\.0025/);
  assert.match(homeSource, /const titleLiquidLastPaintTimestamp =|let titleLiquidLastPaintTimestamp/);
  assert.match(homeSource, /const liquidInterval =/);
  assert.match(homeSource, /liquidDelta < \(reducedMotion \? 0\.002 : 0\.012\)/);
  assert.doesNotMatch(homeSource, /const aftermathQuality =|drawScreenEnergy/);
  assert.match(homeSource, /postReleaseParticles\.length >= \(postReleaseCanvasWidth < 640 \? 104 : 172\)/);
  assert.match(homeSource, /postReleaseCanvasWidth < 640 \? 18 : 28/);
  assert.doesNotMatch(homeSource, /burstDistance|bladeWheelGain|silhouetteBladeScale/);
  assert.match(homeSource, /if \(pageMode === "gate"\) drawTitleAbyss\(performance\.now\(\), true\)/);
  assert.match(abyssSource, /!titleAbyssTideImageData[^]*classList\.remove\("is-title-abyss-ready"\)/);
  assert.match(homeSource, /const titleAbyssDomHandoffStart = 0\.72/);
  assert.match(homeSource, /phaseProgress\(intro, titleAbyssDomHandoffStart, 0\.88\)/);
  assert.doesNotMatch(abyssSource, /chargeIntroProgress >= titleAbyssDomHandoffStart/);
  assert.match(abyssSource, /sourceFrame\.sourceOpacity <= \.001[^]*classList\.remove\("is-title-abyss-ready"\)/);
  assert.match(abyssSource, /burstProgress >= releaseStart[^]*classList\.remove\("is-title-abyss-ready"\)/);
  assert.doesNotMatch(abyssSource, /paintSingularityField|eventHorizon|ringRadius|Starfield|voidPockets/);
  assert.match(homeSource, /titleAbyssPointerX \* \(mobilePerformance \? 20 : 76\)/);
  assert.match(homeSource, /1000 \/ \(activeMotion \? 45 : 30\)/);
  assert.match(homeSource, /const handleTitleAbyssPointer =/);
  assert.match(homeSource, /progress >= 0\.999/);
  assert.match(homeSource, /document\.visibilityState !== "visible"/);
  assert.match(homeSource, /clearTitleAbyssCanvas\(true\)/);
  assert.match(homeStyles, /\.kisara-gate\.is-title-abyss-ready \.kisara-title-abyss-canvas/);
  assert.match(homeStyles, /\.kisara-post-release-canvas[^]*contain: strict/);
  assert.match(homeStyles, /\.kisara-space-lens-canvas[^]*contain: strict/);
  assert.match(homeStyles, /:is\(\.is-bursting, \.is-burst-complete, \.is-post-release\)[^]*transition: none/);
});

test("Kisara Home contains opposing weave tails and keeps their sources unbounded", () => {
  const chainPathSource = readSource("src/themes/kisara/lib/titleChainRig.ts");
  const chainSpacingSource = homeSource.slice(
    homeSource.indexOf("const buildTitleChainLinkUnits ="),
    homeSource.indexOf("const drawChainLinkArc =")
  );
  assert.equal((chainPathSource.match(/buildStart:/g) ?? []).length, 3);
  assert.match(chainPathSource, /-definition\.xInset/);
  assert.match(chainPathSource, /1 \+ box\.width \* definition\.xInset \/ width/);
  assert.match(chainPathSource, /\[counterX, counterY,/);
  assert.match(chainPathSource, /crossing\.overId = crossing\.ids\[crossing\.overIndex\]/);
  assert.match(chainSpacingSource, /const sourceTailStep = 1 \/ Math\.max\(1, linkCount - 1\)/);
  assert.match(chainSpacingSource, /Math\.ceil\(entryOverscan \/ sourceTailStep \/ 2\) \* 2/);
  assert.match(chainSpacingSource, /definition\.entryOverscan \* entryReferenceLength \/ totalLength/);
  assert.match(chainSpacingSource, /definition\.direction > 0[^]*\? -sourceDistance[^]*: 1 \+ sourceDistance/);
  assert.match(homeSource, /const order = clamp\([^]*definition\.direction > 0 \? distanceUnit : 1 - distanceUnit[^]*0,[^]*1[^]*\)/);
  assert.match(homeSource, /const travel = definition\.type === "weave" \? build : easeOutCubic\(build\)/);
});

test("Kisara Home 003 keeps its full-screen fragment deferred and subtitle-free", () => {
  assert.match(homeEventSource, /data-kisara-home-stop="003"/);
  assert.match(homeEventSource, /data-home-event-video/);
  assert.match(homeEventSource, /class="kisara-home-board-first" src="\/themes\/kisara\/assets\/home-event-003-new-first\.webp"/);
  assert.doesNotMatch(homeEventSource, /\sposter=/);
  assert.match(homeEventSource, /preload="none"/);
  assert.match(homeEventSource, /muted/);
  assert.match(homeEventSource, /playsinline/);
  assert.match(homeEventSource, /data-src="\/themes\/kisara\/assets\/home-event-003-new\.mp4"/);
  assert.doesNotMatch(homeEventSource, /<track\b/i);
  assert.doesNotMatch(homeEventSource, /<source\b[^>]*\ssrc=/i);
});

test("Kisara Home 003 uses a one-shot board scene with a portrait and the four original XP images", () => {
  const runtime = readSource("src/themes/kisara/lib/homeEvent.ts");
  assert.match(homeEventSource, /data-home-portrait/);
  assert.match(homeEventSource, /猫娘控.*二次元死宅.*蒸鹅心/);
  assert.match(homeEventSource, /xpFavorites\.map/);
  assert.match(homeEventSource, /\/themes\/fuyukawa-kagari\/assets\/about\/xp-\$\{item\.key\}\.webp/);
  assert.match(homeEventSource, /😋.*🤤.*😍.*😚/);
  assert.match(homeEventSource, /人类<em>公敌<\/em>/);
  assert.match(homeEventSource, /kisara-home-board-aside">BE LIKE:<\/span>/);
  assert.match(homeEventSource, /未必是人类<\/p>/);
  assert.doesNotMatch(homeEventSource, /kisara-home-tags|tagGroups|PERSONAL INDEX/);
  assert.match(homeEventStyles, /\.kisara-home-video-event \{[^]*display: block;[^]*min-height: calc\(100svh \/ var\(--kisara-scale, 1\)\)/);
  assert.match(homeEventStyles, /\.kisara-home-video-stage \{[^]*display: block;[^]*min-height: calc\(100svh \/ var\(--kisara-scale, 1\)\)/);
  assert.doesNotMatch(homeEventSource, /data-home-event-progress|data-home-event-replay|data-notebook-tab/);
  assert.doesNotMatch(runtime, /requestVideoFrameCallback|requestAnimationFrame|animation\.currentTime/);
  assert.match(runtime, /prefers-reduced-motion: reduce/);
});

test("Kisara Home 003 reveals the foreground composition when it enters view", () => {
  const source = readSource("src/themes/kisara/lib/homeEvent.ts");
  const refresh = source.slice(source.indexOf("  const refresh ="), source.indexOf("  const reset ="));
  assert.match(refresh, /if \(next\) portrait\.reveal\(\)/);
  assert.ok(refresh.indexOf("portrait.reveal()") < refresh.indexOf("else if (!completed) void play"));
});

test("Kisara Home retains overlapping color joins alongside live-scene chapter handoffs", () => {
  const transitions = readSource("src/themes/kisara/styles/home-transitions.css");
  assert.match(homeSource, /is-fridge-to-event[^]*is-event-to-latest/);
  assert.doesNotMatch(homeSource, /class="kisara-home-transition is-memory-to-fridge"/);
  assert.match(transitions, /height: 96px/);
  assert.match(transitions, /margin-block: -48px/);
  assert.match(transitions, /z-index: 6/);
  assert.match(homeSource, /chapterTransition\.run\(current\.element, stop\.element, reverse/);
  assert.doesNotMatch(transitions, /is-doors|skewX/);
  assert.doesNotMatch(homeStyles, /--transition-paper|kisara-home-transition-arc/);
});
