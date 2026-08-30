import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const readSource = (relativePath: string) => readFileSync(
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
  "utf8"
);

const layoutSource = readSource("src/themes/kisara/layouts/KisaraLayout.astro");
const openingSource = readSource("src/themes/kisara/components/KisaraOpeningMemoryScene.astro");
const homeCssSource = readSource("src/themes/kisara/styles/home.css");
const chibiSource = readSource("src/themes/kisara/components/KisaraChibiStage.astro");
const homeSource = readSource("src/themes/kisara/pages/HomePage.astro");
const audioSource = readSource("src/themes/kisara/components/KisaraAudioControl.astro");
const gamesSource = readSource("src/themes/kisara/pages/GamesPage.astro");

const hintIds = [
  "chibi-jealousy",
  "chibi-apple",
  "found-self",
  "photo-archive",
  "memory-return",
  "game-shake"
];

test("Kisara opening hints use one versioned tab-session ledger", () => {
  assert.match(layoutSource, /yuimi-kisara-opening-hints-v1/);
  assert.match(layoutSource, /yuimi:kisara-opening-hint-achieved/);
  for (const id of hintIds) {
    assert.match(layoutSource, new RegExp(`"${id}"`), `${id} must be allowlisted`);
    const routeDefinition = openingSource.match(new RegExp(`\{ id: "${id}"[^\n]+\}`, "g")) ?? [];
    assert.equal(routeDefinition.length, 1, `${id} must own exactly one hidden-route definition`);
  }
  assert.match(openingSource, /data-kisara-opening-hint=\{route\.id\}/);
});

test("Each opening hint is marked only from its accepted trigger path", () => {
  assert.match(chibiSource, /mark\("chibi-jealousy"\)/);
  assert.match(chibiSource, /mark\("chibi-apple"\)/);
  assert.match(homeSource, /mark\("found-self"\)/);
  assert.match(homeSource, /mark\("photo-archive"\)/);
  assert.match(audioSource, /mark\("memory-return"\)/);
  assert.match(gamesSource, /mark\("game-shake"\)/);

  const gamePlayIndex = gamesSource.indexOf("await shakeEasterVideo.play()");
  const gameHintIndex = gamesSource.indexOf('mark("game-shake")', gamePlayIndex);
  assert.ok(gamePlayIndex >= 0 && gameHintIndex > gamePlayIndex);

  const rewardIndex = homeSource.indexOf("const completeReward = (autoplay: boolean) => {");
  const solvedIndex = homeSource.indexOf('setState("solved")', rewardIndex);
  const photoHintIndex = homeSource.indexOf('mark("photo-archive")', solvedIndex);
  assert.ok(rewardIndex >= 0 && solvedIndex > rewardIndex && photoHintIndex > solvedIndex);
});

test("Opening hint strike keeps the Pulse-style layered motion and reduced-motion fallback", () => {
  assert.match(homeCssSource, /kisara-opening-hint-strike/);
  assert.match(homeCssSource, /clip-path: polygon/);
  assert.match(homeCssSource, /is-hint-achieved/);
  assert.match(homeCssSource, /prefers-reduced-motion: reduce/);
});

test("Each achieved opening hint draws one continuous stroke across its marker", () => {
  const hiddenTemplateStart = openingSource.indexOf('class="kisara-opening-route-secret"');
  const hiddenTemplateEnd = openingSource.indexOf("</span>", openingSource.indexOf("kisara-opening-easter-hint-fragment", hiddenTemplateStart));
  const hiddenTemplate = openingSource.slice(hiddenTemplateStart, hiddenTemplateEnd);
  assert.ok(hiddenTemplateStart >= 0 && hiddenTemplateEnd > hiddenTemplateStart);
  assert.equal((hiddenTemplate.match(/kisara-opening-easter-hint-copy/g) ?? []).length, 1);
  assert.equal((hiddenTemplate.match(/kisara-opening-easter-hint-fragment/g) ?? []).length, 1);
  assert.equal((hiddenTemplate.match(/kisara-opening-route-secret/g) ?? []).length, 1);
});

test("Opening 001 keeps five page stops and separates hidden routes from navigation", () => {
  assert.match(openingSource, /data-kisara-opening-route-map/);
  assert.match(openingSource, />KISARA</);
  for (const branch of ["home", "blog", "games", "projects", "about"]) {
    assert.match(openingSource, new RegExp(`id: "${branch}"`), `${branch} must own a top-level branch`);
  }
  for (const label of ["HOME", "BLOG", "GAME", "WORKS", "ME"]) {
    assert.match(openingSource, new RegExp(`label: "${label}"`));
  }
  assert.doesNotMatch(openingSource, /id: "hidden"/);
  assert.match(openingSource, /routeBranches\.map/);
  assert.match(openingSource, /branch\.routes\.map/);
  assert.equal((openingSource.match(/data-kisara-route-kind="page"/g) ?? []).length, 1, "page hubs are generated from one mapped template");
  assert.equal((openingSource.match(/kind: "chapter"/g) ?? []).length, 4, "HOME owns four independently tracked chapters");
  assert.equal((openingSource.match(/data-kisara-route-kind="easter"/g) ?? []).length, 1, "easter nodes are generated from one mapped template");
  assert.match(openingSource, /hiddenRoutes\.map/);
  assert.match(openingSource, /yuimi-kisara-opening-route-chapters-v1/);
  assert.match(openingSource, /__yuimiKisaraLovebrainProgress\?\.snapshot/);
  assert.match(openingSource, /yuimi:kisara-lovebrain-progress/);
  assert.match(openingSource, /data-kisara-home-stop/);
  assert.match(openingSource, /is-route-achieved/);
});

test("Opening contract stage docks, rewrites one clause, and strikes completed routes", () => {
  assert.match(openingSource, /data-kisara-opening-route-root/);
  assert.match(openingSource, /data-kisara-opening-route-journey inert/);
  assert.match(openingSource, /routeMap\.clientWidth \* 0\.5/);
  assert.match(openingSource, /routeMap\.clientHeight \* 0\.5/);
  assert.match(openingSource, /--kisara-opening-route-root-center-x/);
  assert.match(openingSource, /--kisara-opening-route-root-center-y/);
  assert.match(openingSource, /routeJourney\?\.setAttribute\("inert", ""\)/);
  assert.match(openingSource, /routeJourney\?\.removeAttribute\("inert"\)/);
  assert.match(openingSource, /kisara-opening-contract-copy/);
  assert.match(openingSource, /kisara-opening-contract-caption/);
  assert.match(openingSource, /kisara-opening-route-revision/);
  assert.doesNotMatch(openingSource, /kisara-opening-route-thread/);
  assert.match(openingSource, /data-kisara-route-branch/);
  assert.match(openingSource, /activateRouteBranch/);
  assert.match(openingSource, /clearRouteBranch/);
  assert.match(openingSource, /is-route-focused/);
  assert.match(openingSource, /\(hover: hover\) and \(pointer: fine\)/);
  assert.match(openingSource, /pointerenter/);
  assert.match(openingSource, /focusin/);
  assert.match(openingSource, /routeTapReady/);
  assert.match(openingSource, /event\.preventDefault\(\)/);
  assert.match(homeCssSource, /kisara-opening-contract-copy-in/);
  assert.match(openingSource, /playRootCenterEntrance/);
  assert.match(openingSource, /playTitleEntrance/);
  assert.match(openingSource, /playSettledEntrance/);
  assert.match(openingSource, /target\.animate\(keyframes, options\)/);
  assert.match(openingSource, /duration: 760/);
  assert.match(openingSource, /delay: 620 \+ index \* 115/);
  assert.match(homeCssSource, /is-memory-video-playing \.kisara-opening-route-root[\s\S]*?route-root-center-x/);
  assert.match(homeCssSource, /is-memory-video-settled \.kisara-opening-route-root[\s\S]*?route-root-dock-y/);
  assert.match(homeCssSource, /is-memory-route-ready \.kisara-opening-route-journey/);
  assert.match(homeCssSource, /\.kisara-opening-route-page\.is-active \.kisara-opening-route-notes/);
  assert.match(homeCssSource, /\.kisara-opening-route-secrets/);
  assert.match(homeCssSource, /kisara-opening-route-strike/);
  assert.match(homeCssSource, /\.kisara-opening-route-page-hub::before/);
  assert.match(homeCssSource, /\.kisara-opening-route-node::before/);
  assert.match(homeCssSource, /is-route-achieved:not\(\.is-route-drawing\)/);
  assert.match(homeCssSource, /prefers-reduced-motion: reduce[\s\S]*?\.kisara-opening-route-node/);
});

test("Opening route labels stay readable instead of truncating the navigation", () => {
  const routeCssStart = homeCssSource.indexOf(".kisara-opening-route-map");
  const routeCssEnd = homeCssSource.indexOf(".kisara-opening-easter-hint-fragment", routeCssStart);
  const routeCss = homeCssSource.slice(routeCssStart, routeCssEnd);
  assert.ok(routeCssStart >= 0 && routeCssEnd > routeCssStart);
  assert.doesNotMatch(routeCss, /text-overflow:\s*ellipsis/);
  assert.match(routeCss, /\.kisara-opening-route-root[\s\S]*?width: 250px/);
  assert.match(routeCss, /\.kisara-opening-route-page-copy strong[\s\S]*?font: 900 var\(--route-word-size\)/);
  assert.match(routeCss, /\.kisara-opening-route-node[\s\S]*?min-height: 42px/);
  assert.match(routeCss, /\.kisara-opening-route-notes > li:nth-child\(4\)/);
});

test("Opening route navigation fills the paper with asymmetric contract clauses", () => {
  assert.match(openingSource, /id: "home"[\s\S]*?columns: 4/);
  assert.match(openingSource, /<\/h2>\s*<\/header>\s*<nav class="kisara-opening-video-body kisara-opening-route-map"/);
  assert.match(homeCssSource, /\.kisara-opening-video-copy[\s\S]*?width: min\(820px/);
  assert.match(homeCssSource, /\.kisara-opening-route-map[\s\S]*?position: absolute[\s\S]*?top: clamp\(300px, 31vh, 340px\)[\s\S]*?min-height: 380px/);
  assert.match(homeCssSource, /\.kisara-opening-route-root-mark/);
  assert.match(homeCssSource, /\.kisara-opening-route-node-icon/);
  assert.match(homeCssSource, /--route-x/);
  assert.match(homeCssSource, /--route-y/);
  assert.match(homeCssSource, /\.kisara-opening-route-page\.is-blog[\s\S]*?--route-y: 64%/);
  assert.match(homeCssSource, /\.kisara-opening-route-page\.is-projects[\s\S]*?--route-y: 21%/);
  assert.match(homeCssSource, /\.kisara-opening-route-page\.is-active[\s\S]*?left: 59%[\s\S]*?width: 380px/);
  assert.match(homeCssSource, /\.kisara-opening-route-map\.is-route-focused[\s\S]*?opacity: 0\.2/);
  assert.match(homeCssSource, /\.kisara-opening-route-root-copy strong[\s\S]*?font: 900 2\.8rem/);
  assert.doesNotMatch(openingSource, /kisara-opening-video-note/);
  assert.doesNotMatch(openingSource, /kisara-opening-video-lead/);
  assert.doesNotMatch(openingSource, /这份契约还没有定稿/);
  assert.match(homeCssSource, /\.kisara-opening-video-copy[\s\S]*?top: clamp\(212px, 22vh, 246px\)/);
  assert.match(homeCssSource, /\.kisara-opening-video-copy h2[\s\S]*?font-size: clamp\(2\.25rem, 3\.1vw, 3\.45rem\)/);
});

test("Opening 001 keeps the upper edge physically transparent before its media fade begins", () => {
  assert.match(homeCssSource, /\.kisara-opening \{[\s\S]*?rgba\(241, 239, 235, 0\) 0 116px[\s\S]*?rgba\(241, 239, 235, 0\.06\) 146px/);
  assert.match(homeCssSource, /\.kisara-opening-video-media[\s\S]*?transparent 0 72px[\s\S]*?#000 206px/);
  assert.match(homeCssSource, /\.kisara-opening-video,[\s\S]*?filter: blur\(3\.2px\) saturate\(0\.84\) contrast\(0\.92\)/);
  assert.match(homeCssSource, /\.kisara-opening::after[\s\S]*?transparent 0 72px[\s\S]*?#000 182px/);
  assert.match(homeCssSource, /\.kisara-opening\.is-opening-bridge-live[\s\S]*?rgba\(241, 233, 224, 0\) 0 116px[\s\S]*?rgba\(241, 233, 224, 0\.06\) 146px[\s\S]*?#f1e9e0 218px/);
  assert.doesNotMatch(homeCssSource, /rgba\(241, 233, 224, 0\.025\) 42px/);
});

test("Opening 001 projects one deferred first-screen memory without embedding live pages", () => {
  assert.match(openingSource, /const routePreviews = \[/);
  for (const id of ["home", "blog", "games", "projects", "about"]) {
    assert.match(openingSource, new RegExp(`data-kisara-route-preview=\{preview\.id\}`));
    assert.match(openingSource, new RegExp(`id: "${id}"[\\s\\S]*?src: "/themes/kisara/assets/`));
  }
  assert.match(openingSource, /data-src=\{preview\.src\}/);
  assert.match(openingSource, /blog-hero-first\.webp/);
  assert.match(openingSource, /--preview-blur/);
  assert.match(openingSource, /image\.src = image\.dataset\.src/);
  assert.match(openingSource, /removeAttribute\("src"\)/);
  assert.match(openingSource, /data-preview-active/);
  assert.doesNotMatch(openingSource, /<iframe/);
  assert.match(homeCssSource, /\.kisara-opening-route-preview[\s\S]*?visibility: hidden/);
  assert.match(homeCssSource, /\.kisara-opening-route-preview-figure[\s\S]*?mask-image: linear-gradient/);
  assert.match(homeCssSource, /\.kisara-opening-route-map\.is-route-focused \.kisara-opening-route-preview/);
});
