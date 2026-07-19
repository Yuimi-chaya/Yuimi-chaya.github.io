# Yuimi Lab Development Notes

## Note Responsibility

- Scope: Yuimi Lab Astro repository and the progressive multi-theme architecture work.
- Authority: canonical recovery note for this repository.
- Language: verified facts and decisions are recorded in Chinese; code identifiers remain unchanged.

## Non-Negotiable Constraints

- Preserve the existing Fuyukawa Kagari theme's public routes, copy, visuals, interactions, and article URLs unless a verified architecture requirement forces a change.
- Never modify, delete, stage, or publish the current untracked source materials under the repository root, `XP/`, `kisara/`, or `showcase-output/` without an explicit request.
- Keep shared article content, covers, and article attachments outside theme namespaces.
- A non-default theme must own its layouts, pages, CSS, runtime, and presentation assets; it must not import Fuyukawa Kagari theme internals.
- Cross-theme navigation must use a full document navigation so `ClientRouter`, theme CSS, and global listeners cannot leak across themes.
- Before every new functional edit, verify that the tracked workspace has a clear Git rollback commit. If the previous functional work is still uncommitted, create a scoped safety commit before changing code; never include the untracked user source-material directories in that checkpoint.
- Windows/PowerShell rules, UTF-8 preservation, minimal edits, and non-destructive Git rules from `AGENTS.md` apply.

## Current Snapshot

- Repository: `C:\Users\a1234\Desktop\个人博客`
- Remote: `https://github.com/Yuimi-chaya/Yuimi-chaya.github.io.git`
- Branch: `main`
- Multi-theme baseline commit: `d4e2a29 Add independent multi-theme architecture`.
- Kisara color-mask prototype rollback commit: `97990c8 Add Kisara scroll mask theme prototype`.
- Deployment: Astro static output to GitHub Pages through `.github/workflows/deploy.yml`.
- Local state: the Kisara image transition, continuous-charge beam motion, post-gloss procedural warning, transparent beam-tail fade, accelerated overcharge burst, and persistent glitch status are implemented and browser-validated on desktop and mobile-sized viewports; the latest working baseline remains local and is not pushed. Untracked user source materials remain separate and untouched (`102000325_p0.jpg`, `122472458_p0.png`, `gate-background.jpg`, `XP/`, `kisara/`, `showcase-output/`).
- Default theme ID: `fuyukawa-kagari`.
- Available theme IDs: `fuyukawa-kagari`, `blank`, `kisara`.
- Route decision: `fuyukawa-kagari` remains on existing root URLs; `blank` uses `/themes/blank/...`; `kisara` uses `/themes/kisara/...`. Alternate themes canonicalize to matching root URLs.
- Preference key: `yuimi-theme-id-v1` with an allowlist and `fuyukawa-kagari` fallback.
- Implementation state: three independent frontends are locally available. The Kisara refinement has passed the current local test/build/browser pass and is awaiting final visual acceptance; it has not been pushed.

## Architecture Decision

- Shared layer: content collections, article queries, site metadata, category labels, SEO inputs, and theme registry/path helpers.
- Fuyukawa Kagari layer: existing pages, layouts, theme CSS at `src/themes/fuyukawa-kagari/styles/theme.css`, navigation presentation, footer copy, Sakura, pig scrollbar, tool dock, music player, Live2D, notice, weather/IP signal, Canvas tag rain, and related assets.
- Blank layer: independent document layout, navigation, pages, article presentation, CSS, context menu, and visible theme return control. It does not load Kagari CSS, assets, remote Live2D, music, weather, or notice runtime.
- Kisara layer: independent dark visual-interaction frontend with a reversible blue-to-red diagonal title tide controlled by captured vertical input. It owns its layout, pages, CSS, mobile navigation, context menu, runtime, and theme-owned background slots under `public/themes/kisara/assets/`.
- Switching: map the current canonical pathname into the target theme, preserve query/hash, persist the target ID, then perform a full-document navigation. Explicit user switches use history-preserving `assign`; automatic preference restoration uses `replace`; browser history traversal adopts the restored page's theme.
- SEO: alternate theme routes use `noindex,follow`; sitemap excludes `/themes/` routes.
- 404: the single GitHub Pages root 404 performs an early client redirect for unknown `/themes/blank/*` paths to `/themes/blank/404/`, carrying the original URL in `from`.

## Asset Inventory

- Shared content assets: `public/blog-assets/`, `public/blog-covers/`, Markdown content images.
- Fuyukawa Kagari theme assets: `public/themes/fuyukawa-kagari/assets/`, `public/themes/fuyukawa-kagari/music/`, Live2D CDN configuration, homepage background/avatars/brand images, About media, and the 404 visual.
- External Fuyukawa Kagari runtime dependencies: jsDelivr Live2D packages, Cubism SDK, location/weather endpoints.
- Kisara presentation assets: the user-selected cold background is at `public/themes/kisara/assets/gate-background.jpg`; the explicitly selected fight artwork is at `public/themes/kisara/assets/fight.jpg`. Root `kisara/` images remain user-owned source material and are intentionally not referenced directly.
- Kisara gate asset matching: the base names `gate-background` and `fight` accept `.webp`, `.png`, `.jpg`, or `.jpeg`, in that priority order. Keep one custom format per base name when comparing artwork.
- Historical or unreferenced candidates remain untouched until a later cleanup request; absence of a current reference is not deletion approval.

## Migration Map

| Previous path or role | Current path or role |
|---|---|
| `src/layouts/BaseLayout.astro` | `src/themes/fuyukawa-kagari/layouts/BaseLayout.astro` |
| `src/layouts/ArticleLayout.astro` | `src/themes/fuyukawa-kagari/layouts/ArticleLayout.astro` |
| `src/styles/global.css` | `src/themes/fuyukawa-kagari/styles/theme.css` |
| `src/data/noticeContent.ts` | `src/themes/fuyukawa-kagari/data/noticeContent.ts` |
| Theme-heavy implementations in `src/pages/*.astro` | `src/themes/fuyukawa-kagari/pages/*Page.astro`; root `src/pages/` files are thin public route entries |
| `public/assets/` | `public/themes/fuyukawa-kagari/assets/` |
| `public/music/` | `public/themes/fuyukawa-kagari/music/` |
| Blog collection, `public/blog-assets/`, `public/blog-covers/`, `src/lib/site.ts` | Remain shared and outside theme namespaces |

## Adding a Third Theme

1. Add a stable ID, label, and static `routePrefix` to `src/core/themes/registry.ts`.
2. Create `src/themes/<theme-id>/index.ts` as the public entry and export the theme's independent page components.
3. Implement the theme's own layout, pages, styles, runtime, and presentation data without importing another theme's internals.
4. Add thin static route entries under `src/pages/themes/<theme-id>/`, including article `getStaticPaths()` through the shared blog helper.
5. Store fixed URL assets under `public/themes/<theme-id>/`; keep article images and attachments shared.
6. Render `ThemePreferenceGate` with the new ID and expose both a context-menu choice and a touch/keyboard-accessible return control.
7. Keep prefixed theme pages `noindex,follow`, canonicalize to root content URLs, and retain the sitemap `/themes/` exclusion unless the SEO policy changes.
8. Extend registry tests, then verify build, deep links, history, refresh persistence, 404 fallback, desktop/mobile layout, and resource isolation.

## Active Workstreams

### Multi-Theme Foundation

- Goal: make `fuyukawa-kagari` and `blank` independently renderable and switchable while preserving existing routes.
- Status: implemented and validated locally; publication pending.
- Key paths: `src/core/`, `src/themes/`, `src/pages/`, `public/themes/`.
- Validation: production build, root/deep-link rendering, both-direction context-preserving switch, refresh persistence, history navigation, and allowlisted fallback logic passed.

### Fuyukawa Kagari Boundary Migration

- Goal: move existing theme implementation as intact units before any internal refactor.
- Status: implemented and browser-validated with existing root routes preserved.
- Explicitly deferred: splitting the large Kagari layout script, homepage runtime, and theme CSS into smaller modules.

### Blank Theme

- Goal: provide a minimal independent theme for all existing major pages and article reading.
- Status: implemented and browser-validated.
- Coverage: home, blog list, article detail, About, Projects, Games, and themed 404 on desktop and 390px mobile.
- Boundary: no import from `src/themes/fuyukawa-kagari/` and no `/themes/fuyukawa-kagari/` asset reference.

### Kisara Theme

- Goal: establish a visual-interaction-first character theme before selecting final artwork.
- Status: image transition, softened boat-wake energy beam, two-stage overcharge prototype, and the latest timing/motion refinement are implemented and browser-validated at `1280x720` and `390x844`; publication is pending.
- Key behavior: while the homepage is at the top, downward wheel/touch/keyboard input raises a blue-to-red diagonal tide and upward input lowers it. Input changes a target level; `requestAnimationFrame` advances the visible level with damped velocity, so the mask, background transition, and crest continue smoothly between wheel events. The cold background gradually blurs and dims while the fight artwork fades in from blur to clarity. The lower contract display is a Canvas-only tapered energy beam with a thin origin, progressively widening body, and a softer wake: curved low-alpha ribbons and lifecycle-based particles emit from the nose, split naturally, and trail toward the rear instead of forming rigid symmetric lines. Normal-charge instability eases toward the current charge instead of jumping at wheel segments, and an explicit initial-state latch makes a second charge cycle restart from a clean pose phase after returning to zero. The narrow rear third of the beam is composited through a transparent tail mask. After the red tide settles at 100%, the title gloss finishes first; a short pre-warning blur then precedes the procedural DOM warning. The warning has a black/white core, four unequal tapered rays, broken shards, and sparks; it rotates and strobes, collapses sharply back into the core, then emits a short radial shock flash. Every warning layer reaches zero before the Canvas beam regrows. During reform, the beam head is anchored to the actual transformed cross center; the reformed beam thickens and accelerates into a faster detonation with stronger head-anchored rings and particles, then becomes a slower particle rain while blur recovers. Title text layers explicitly follow the performance blur while the cross remains independent. Screen-level wake and ambient particles share the release fade and disappear with the beam at the end of the rain. The lower state text shows `CONTRACT 000%` through the first charge and switches to continuously changing machine-glitch output instead of replaying a second percentage counter. Document scrolling is released only after both stages settle at 100%; the next section and the return to the blue gate use a time-scaled damped spring rather than a distance-proportional jump.
- Escape paths: reduced-motion users start completed, restored pages below the top are synchronized to completed, and an explicit `SKIP` link bypasses the gate.
- Boundary: no root `kisara/` source image is imported, copied, staged, or published.
- Local helper: root `preview-blog.bat` runs `npm run build` first and starts `npm run dev -- --host 127.0.0.1` only after a successful build.

## Known Risks

- `ClientRouter`, `transition:persist`, and global event listeners can retain Kagari runtime state; cross-theme switches therefore require full navigation.
- Existing absolute resource URLs assume the GitHub Pages user-site root. A future project-page deployment needs a separate base-path migration.
- Music filenames contain spaces and non-ASCII characters; URL generation must remain encoded and verified after namespacing.
- Live2D and IP/weather services are network-dependent and remain Kagari-only.
- `npm test` currently covers registry allowlisting and path mapping only. Browser behaviors are manually verified; no browser test runner is configured.
- No `astro check` script or `@astrojs/check` dependency exists. It was not installed because this task does not authorize new tooling installation without confirmation.
- Unknown Blank paths rely on JavaScript to move from the single GitHub Pages 404 to the Blank 404. Normal Blank pages remain readable without JavaScript.
- Kisara's scroll gate intentionally uses global wheel/touch/keyboard listeners on its homepage. Future interaction work must keep browser zoom shortcuts, focused controls, restored scroll positions, reduced motion, and a visible mobile navigation path working.

## Immediate Next Actions

1. Obtain user visual acceptance for the current continuous-charge, warning, tail-fade, and overcharge sequence; only then tune particle density, flash strength, beam expansion, blur, or image positioning from new feedback.
2. Add parallax, character cutouts, or puppet layers only after suitable source material is explicitly selected.
3. Push the baseline and Kisara commits only when separately requested.

## Test and Validation Record

- `npm test`: 3/3 Node tests passed for all theme IDs, canonical path stripping, and cross-theme article-context mapping.
- `npm run build`: passed after the current Kisara procedural warning refinement; 36 static pages generated, sitemap created, Pagefind indexed 36 pages.
- Sitemap: verified that `/themes/blank/` routes are excluded.
- Resource boundary: verified no legacy `/assets/` or `/music/` runtime references and no Blank import/reference to Kagari internals or assets.
- Desktop browser: verified both theme home pages, Blank article deep link, canonical/noindex, zero horizontal overflow, two-way switching, query/hash preservation, refresh persistence, browser back/forward, and no console warnings/errors.
- Mobile browser at 390x844: verified both themes fit without horizontal overflow and both visible theme controls remain reachable.
- Kisara browser validation: confirmed intermediate downward input raises the mask while `scrollY` remains `0`; normal-charge particles visibly fan across the full gate; the second stage sweeps the title gloss before pressure, expansion, shock rings, and the full-screen burst; and upward input first retracts the burst before lowering the red tide. At both stages settled to `100%`, the next downward wheel input scrolls into the full-width content band. Desktop and `390x844` mobile layouts have no horizontal overflow, and the browser console has no warnings or errors.
- Latest Kisara browser validation: confirmed the wake ribbons and trailing particles are emitted from the beam nose toward the rear, charge-dependent floating motion is continuous, the overcharge beam reforms centrally without extending its length, thickens while shaking, dissolves into particle rain, and then releases damped section scrolling. Returning upward from the next section resets the gate to the blue `CONTRACT 000%` state on desktop and `390x844` mobile.
- Current Kisara warning validation: at `1280x720` and `461x551`, the procedural rays extend from the title center, rotate without forming a fixed X logo, collapse into the core, and hand off to a center shock ring. At `OVERCHARGE 064%`, warning opacity, ray length, and ring opacity were all `0` while the reformed beam had begun at partial opacity, confirming the warning cannot overlap the beam regrowth. Both viewports had no positive horizontal overflow, and the browser warning/error log was empty.
- Latest Kisara refinement validation: at `1280x720` and `461x551`, charge movement stayed continuous during rapid input, the gloss opacity reached `0` before the warning variables became non-zero, performance blur reached about `4.8px` before warning build, the beam tail remained composited from transparent to opaque across its rear third, and detonation reached stronger scale/angle/glow values without positive horizontal overflow. After the first `CONTRACT 100%`, the status changed to continuously varying glitch text; both viewports released damped document scrolling after `100%`, and page console logs remained empty.
- Latest Kisara feedback validation (`2026-07-19`): after a full charge/retract/recharge cycle, the beam pose restarted from a clean initial phase; at the warning stage all four title text layers reported the active performance blur while the procedural cross remained separate. The transformed beam anchor followed the cross center on desktop and `390x844` mobile, and after the 5.2-second automatic release the beam opacity was `0`, the gate had no positive horizontal overflow, and the final canvas frame showed no visible wake residue. Downward release reset to blue before the next section completed, and upward return landed at `CONTRACT 000%` without replaying the red scene. `npm test` passed 3/3 and `npm run build` generated 36 pages, sitemap, and Pagefind index. The browser page log remained empty; one Statsig telemetry timeout was tool-side only.
- Accessibility: verified Kagari context menu opens with `Shift+F10`, focuses its first item, closes with Escape, becomes `visibility:hidden`, and returns focus outside the hidden menu.
- Search: Pagefind query returned the canonical root article once and did not expose a duplicate Blank result.
- Production 404: verified `/themes/blank/not-a-real-page/?x=1#lost` redirects to the Blank 404 with the original URL encoded in `from`.

## Independent Review Record

- A resource review: no missing runtime resources, old-path references, Blank/Kagari boundary violations, or accidental use of untracked user materials. Adopted its warning to keep `public/themes/fuyukawa-kagari/` in the eventual commit scope.
- B note review: found stale dirty-state, asset-path, status, test, and next-action entries. All were corrected in this note.
- C logic review: found the missing Blank unknown-path fallback, inaccessible/hidden-focus Kagari theme menu, and broken history semantics from `location.replace`. All three were implemented and browser-verified. Its browser-test-suite suggestion remains deferred because no browser runner exists.
- D final review: found incomplete Blank keyboard focus handling and missing migration/third-theme recovery notes. Both were corrected. A targeted re-review found no remaining blocker or important issue and marked the implementation deliverable. The no-JavaScript 404 limitation remains documented; the root 404 now also exposes a direct Blank link.
- Kisara interaction review: found missing skip behavior, browser zoom interception, focused-control keyboard interception, hidden mobile navigation, narrow-viewport menu clipping, scroll-restore drift, and alternate-theme 404 matching gaps. These were addressed before final validation.

## Engineering History

### 2026-07-18 Kisara interaction prototype

- Registered `kisara` at `/themes/kisara/` with independent routes, layout, pages, CSS, mobile navigation, theme controls, canonical/noindex behavior, and themed 404 handling.
- Implemented a color-only homepage gate: `Kisara` starts blue and fills red diagonally from bottom-left to top-right as downward input accumulates.
- Replaced direct per-wheel percentage steps with a reversible target/visible/velocity state model, a damped frame-time animation loop, a soft red mask edge, and a narrow moving tide crest.
- Kept all root `kisara/` image sources untouched and outside the published theme.
- Created the architecture rollback point `d4e2a29` before starting the prototype.

### 2026-07-18 Kisara image transition and energy meter

- Copied the explicitly selected `kisara/fight.jpg` into the theme-owned public asset slot without modifying the original source directory.
- Replaced the single gate background with independent cold and fight image layers. The existing reversible tide progress now controls opacity, blur, scale, saturation, and brightness continuously in both directions.
- Rebuilt the contract meter as a growing energy beam with a Canvas wave, moving particles, rays, and a glowing front; the animation pauses when the document is hidden and degrades to a static frame for reduced-motion users.
- Removed the gate pseudo-decoration/background arrangement that could expose a rectangular dark frame around the masked title; title mask sizing and alpha behavior are now explicit.

### 2026-07-18 Kisara tapered beam refinement

- Removed the ruler-like track, tick marks, DOM fill bar, and detached front orb after visual review.
- Reworked the Canvas display into a cone-like beam whose width increases continuously from its origin to a pointed energy nose. Particle count, spread, and speed increase with charge, while the front glow remains integrated with the beam rather than clipped at the canvas edge.
- Removed the remaining gate center axis so the background no longer presents the original cross-shaped frame.

### 2026-07-18 Kisara overcharge burst sequence

- Added a second reversible captured-input stage after the red title tide reaches 100%; normal document scrolling remains locked until this stage also settles at 100%.
- Added a diagonal blade-gloss pass across the title, progressively stronger beam shake, bloom, and expansion, followed by late-stage viewport shock rings and flash.
- Added a gate-sized Canvas particle field. Normal charging now sends radial streaks from the beam nose toward the full viewport, while detonation increases particle density, travel distance, speed, and brightness.
- Kept reverse input symmetrical: upward input retracts the detonation and gloss before it can lower the original title tide.
- Created safety rollback commit `d3333c0` before the final full-screen particle and staged-detonation refinement.

### 2026-07-18 Kisara wake and release refinement

- Replaced the remaining radial charge particles with two head-connected wake ribbons and rearward streaks so the diffusion reads as motion generated by the energy nose rather than decoration attached to the meter.
- Added a continuous charge-dependent float before overcharge, then made the post-100% sequence dissolve and reform the beam in the center, tilt it upward, increase thickness and shake, blur the surrounding gate, and end in a full-screen particle rain without extending the beam's length.
- Added damped snapping from the completed gate to `#kisara-opening`, and back to the top with a blue reset when the user scrolls upward from the next section.
- Re-ran `npm test` (3/3) and `npm run build` (36 pages, sitemap, Pagefind) after the final Canvas/CSS adjustments.

### 2026-07-18 Kisara cinematic timing refinement

- Replaced the hard symmetric wake strokes with curved, low-alpha ribbons and age-based turbulent streaks that inherit their origin and rearward flow from the energy nose.
- Added visible idle instability and charge-weighted multi-frequency float/rotation/jitter so the beam reads as increasingly difficult to contain from the first charge.
- Moved the pre-blast cross into the title DOM layer. The gloss, cross build, white-core flash/release, beam reform, pressure, detonation, and post-impact rain now occupy separate ordered phases; the beam cannot reappear before the cross has finished.
- Reused the transformed beam head as the burst anchor, delayed rain until after detonation, and made the surrounding blur recover completely during the rain.
- Replaced distance-proportional scroll stepping with a delta-time damped spring and revalidated `npm test` (3/3), `npm run build` (36 pages, sitemap, Pagefind), desktop interaction, zero horizontal overflow, and an empty warning/error console.

### 2026-07-18 Kisara procedural pre-blast warning

- Replaced the full-rectangle dual-gradient cross and its rectangular shadow with a DOM effect assembled from a black/white core, four unequal tapered rays, broken shards, small sparks, and a release-only shock ring. No SVG or bitmap warning asset is used.
- Changed the warning motion to a fast center-out extension, progress-driven rotation and strobe, late nonlinear collapse, core flash, and radial release pulse before the energy beam reforms.
- Fixed two broad title selectors (`.kisara-title span` and `.kisara-gate.is-complete .kisara-title span`) that were clipping the effect backgrounds to empty text and overriding every child transform; both now target only the direct text layers.
- Revalidated `npm test` (3/3), `npm run build` (36 pages, sitemap, Pagefind), desktop and mobile-sized layouts, phase ordering, zero positive horizontal overflow, and an empty browser warning/error log.

### 2026-07-18 Kisara charge continuity and runaway status refinement

- Smoothed the normal-charge instability through a frame-time state so rapid wheel input no longer chains the strongest per-segment shake into repetitive vertical twitching.
- Moved the procedural warning after the title gloss and added a short background-blur prelude before the warning appears.
- Added a Canvas destination-in tail mask that fades the narrow rear third of the energy beam to transparent without changing its head position.
- Reworked detonation motion with nonlinear reach, faster head-anchored particle/ring travel, stronger beam shake, and larger late-stage thickness/brightness.
- Replaced the second `OVERCHARGE 000%→100%` counter with persistent deterministic glitch output that continues updating after the first contract reaches `100%`.
- Revalidated `npm test` (3/3), `npm run build` (36 pages, sitemap, Pagefind), desktop `1280x720`, mobile `461x551`, zero positive horizontal overflow, release scrolling, and an empty page console warning/error log.

### 2026-07-18 Multi-theme implementation

- Added shared content/data helpers and theme registry under `src/core/`.
- Moved the existing frontend intact into `src/themes/fuyukawa-kagari/` and its fixed assets into `public/themes/fuyukawa-kagari/`.
- Added independent Blank pages and routes under `src/themes/blank/` and `src/pages/themes/blank/`.
- Added persistent context-preserving theme switching to both context menus plus visible touch/keyboard controls.
- Browser testing found and fixed a non-executable Astro conditional 404 script and a hidden-menu focus restoration issue.

### 2026-07-18 Pre-migration survey and route decision

- Verified before migration that all existing pages ultimately used one theme-heavy `BaseLayout.astro`, while `global.css` mixed reset, page styles, theme visuals, and responsive rules.
- Verified before migration that no prior theme or dark-mode registry existed.
- Rejected same-URL client-only theme replacement because a static Astro build cannot select complete server-rendered layouts from `localStorage` without duplicate DOM/CSS or visible replacement.
- Chose root `fuyukawa-kagari` plus prefixed `blank` routes to preserve current public URLs and provide fully independent static documents.
