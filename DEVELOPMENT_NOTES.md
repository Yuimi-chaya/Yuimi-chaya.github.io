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
- Kisara automatic-release rollback commit: `0409dbf Stabilize Kisara automatic burst sequence`.
- Kisara organic-beam rollback commit: `9ac9223 Refine Kisara organic beam and release`.
- Kisara beam-detail rollback commit: `fcc9397 Refine Kisara beam detail and performance`.
- Kisara site-wide presentation rollback commit: `fae3b93 Unify Kisara theme presentation`.
- Kisara momentum/screen-impact rollback commit: `835baa4 Refine Kisara beam motion and black hole impact`.
- Kisara seamless-phase/collapse rollback commit: `e19ca2a Deepen Kisara collapse and lensing sequence`.
- Kisara WebGL lens baseline rollback commit: `5864321 Replace Kisara warp slices with WebGL lensing`.
- Kisara continuous-lensing refinement commit: `bd03ae6 Refine Kisara black hole lensing`.
- Kisara subject-aware lensing refinement commit: `5a70d67 Prioritize Kisara subject-aware lensing`.
- Kisara continuous-title-lens checkpoint commit: `5e3949d Checkpoint Kisara continuous lensing`.
- Kisara side-field lensing refinement commit: `139ca19 Constrain Kisara lensing to side fields`.
- Kisara segmented aftermath refinement commit: `3b017b0 Deepen Kisara black hole aftermath`.
- Kisara title-clarity checkpoint commit: `957edab Checkpoint Kisara clarity reconstruction pass`.
- Kisara block-reconstruction checkpoint commit: `d774fcc Extend Kisara block reconstruction field`.
- Kisara sharp blade-gloss refinement commit: `3e0c690 Keep Kisara blade gloss sharp`.
- Deployment: Astro static output to GitHub Pages through `.github/workflows/deploy.yml`.
- Local state: the Kisara image transition, single-envelope charge beam, jet/coast/drift wake particles, post-gloss procedural warning, segmented foreground pink-black-hole release, side-only WebGL2 background lensing, independent title refraction/dissolve/reconstruction, full-screen block reconstruction, multi-wave aftermath, lingering particle rain, persistent glitch status, and site-wide deep-indigo UI are implemented and browser-validated. The red title layer now retains its progress-driven blur while the metal blade gloss stays sharp inside the same text/tide mask. The latest visual refinement is committed locally at `3e0c690` and is not pushed. Untracked user source materials remain separate and untouched (`102000325_p0.jpg`, `122472458_p0.png`, `gate-background.jpg`, `XP/`, `kisara/`, `showcase-output/`).
- Default theme ID: `fuyukawa-kagari`.
- Available theme IDs: `fuyukawa-kagari`, `blank`, `kisara`.
- Route decision: `fuyukawa-kagari` remains on existing root URLs; `blank` uses `/themes/blank/...`; `kisara` uses `/themes/kisara/...`. Alternate themes canonicalize to matching root URLs.
- Preference key: `yuimi-theme-id-v1` with an allowlist and `fuyukawa-kagari` fallback.
- Implementation state: three independent frontends are locally available. The Kisara interaction and full-page presentation pass have passed the current local test/build/browser checks and are awaiting final visual acceptance; they have not been pushed.

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
- Status: image transition, continuous organic charge beam, two-stage overcharge sequence, persistent particle pools, segmented pink-black-hole release, side-field WebGL refraction, and the first complete site-wide UI pass are implemented and browser-validated on desktop and `375x844` mobile viewports; publication is pending.
- Key behavior: while the homepage is at the top, downward wheel/touch/keyboard input raises a blue-to-red diagonal tide and upward input lowers it. Input changes a target level; `requestAnimationFrame` advances the visible level with damped velocity, so the mask, background transition, and crest continue smoothly between wheel events. The cold background gradually blurs and dims while the fight artwork fades in from blur to clarity. The lower contract display is a Canvas-only tapered energy beam drawn from one continuous envelope; its internal filaments use periodic phase functions without modulo-wrapped packets or differently scaled shell geometry. Wake particles emit from the beam nose and keep visible streak continuity through jet, inertial coast, and ambient-drift phases before a late TTL fade. Normal-charge instability eases toward the current charge instead of jumping at wheel segments, and an explicit initial-state latch makes a second charge cycle restart from a clean pose phase after returning to zero. After the red tide settles at 100%, the title gloss finishes first; a short pre-warning blur then precedes the procedural DOM warning. The warning has a black/white core, four unequal tapered rays, broken shards, and sparks; it rotates and strobes, collapses sharply back into the core, then hands off to an automatic 10.6-second segmented release. The sequence now dwells through field lock, deep collapse, terminal-crush hold, rupture, and aftermath rather than sweeping one linear progress curve. The local meter dissolves permanently for that sequence. A foreground pink black hole forms at the warning center while the title and background remain depth-blurred: layered far/near accretion arcs, a feathered absorption core, broken photon arcs, lensing paths, and bounded orbit particles build pressure before an inversion flash. The background WebGL pass leaves the middle third at the original UV while the outer thirds receive visible pull, fold, torsion, refraction sheen, and shock displacement; narrow screens apply a lower field scale because the subject spans more of the side zones. The title remains independently refracted through rupture, dissolves into the blast instead of visibly springing back, and reconstructs from blur only during the final aftermath. Three slingshot particle waves, curved bipolar jets, expanding echo rings, residual ribbons, longer-lived fragments, slower gravity-driven rain, and afterglow replace the abrupt particle-only ending. The burst Canvas is a top-level gate layer and is explicitly excluded from the common blur selector, so the black hole remains sharp above the blurred title. The lower state text shows `CONTRACT 000%` through the first charge and switches to continuously changing machine-glitch output instead of replaying a second percentage counter. Document scrolling is released only after both stages settle at 100%; the next section and the return to the blue gate use a time-scaled damped spring rather than a distance-proportional jump.
- Escape paths: reduced-motion users start completed, restored pages below the top are synchronized to completed, and an explicit `SKIP` link bypasses the gate.
- Current energy refinement: the local beam uses one master phase whose integer spatial/time harmonics close exactly at `2π`; the envelope ripple, front/back depth-separated helix, compression rings, helical fragments, and nose shock therefore hand off across the loop boundary without a first-frame snap. Helix depth is now blended per segment instead of switching path visibility at a hard threshold. Beam pose frequencies advance independent integrated phases, so changing charge intensity after a long idle cannot multiply an accumulated clock into a phase jump. Wake particles retain the low-pass beam-head velocity inheritance and bounded jet/coast/drift lifecycle. The energy renderer remains guarded by one active RAF epoch, and return-to-gate resets pose, flow, particle, and beam-head clocks.
- Current black-hole refinement: the release uses keyframed progress across five perceptual stages instead of one linear autoplay. Collapse reaches a nonlinear terminal crush, pauses under maximum pressure, then releases through a separate vacuum shockwave and detonation. The black-hole center is built from two broad feathered absorption gradients with a much smaller pure-dark center, asymmetrical depth offsets, subtle breathing, and broken rim arcs; no hard opaque ellipse is stamped over the composition. The WebGL background lens uses a strict three-zone horizontal field: the middle third returns the original UV, while the two side fields receive stronger radius reach, inward tension, low-frequency folds, torsion, refraction sheen, and shock displacement. The title WebGL pass remains independent and adds rupture displacement plus procedural dissolve; its source layer crossfades into the lens, stays hidden during breakup, and returns through a measured blurred reconstruction after the blast. The endpoint retains three bounded burst waves, echo rings, residual magnetic ribbons, longer-lived fragments, reduced-gravity particle rain, delayed blur/lens recovery, and low-frequency completed-state scheduling. Desktop retains the full side field; mobile scales the field down while preserving the same center lock and zero horizontal overflow.
- Site-wide presentation: the homepage continues into full-width channel, current-pulse, project, and article bands instead of repeating the hero effect. Inner pages use a fixed theme header, mobile bottom navigation, cold-blue information lines, rose active states, restrained `fight.jpg` atmosphere, and page-specific list/article controls. Blog search/filtering, Projects technology filtering, Games metadata/actions, About identity signals, article reading progress/share controls, and a themed 404 are functional rather than decorative-only.
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

1. Obtain user visual acceptance for the latest segmented collapse/rupture/aftermath pass, side-only refraction, and feathered abyss core; tune field strength, void depth, or aftermath density only from new visual feedback.
2. Add parallax, character cutouts, or puppet layers only after suitable source material is explicitly selected.
3. Push the baseline and Kisara commits only when separately requested.

## Test and Validation Record

- `npm test`: 3/3 Node tests passed for all theme IDs, canonical path stripping, and cross-theme article-context mapping.
- `npm run build`: passed after the current Kisara site-wide presentation pass; 36 static pages generated, sitemap created, Pagefind indexed 36 pages.
- Sitemap: verified that `/themes/blank/` routes are excluded.
- Resource boundary: verified no legacy `/assets/` or `/music/` runtime references and no Blank import/reference to Kagari internals or assets.
- Desktop browser: verified both theme home pages, Blank article deep link, canonical/noindex, zero horizontal overflow, two-way switching, query/hash preservation, refresh persistence, browser back/forward, and no console warnings/errors.
- Mobile browser at 390x844: verified both themes fit without horizontal overflow and both visible theme controls remain reachable.
- Kisara browser validation: confirmed intermediate downward input raises the mask while `scrollY` remains `0`; normal-charge particles visibly fan across the full gate; the second stage sweeps the title gloss before pressure, expansion, shock rings, and the full-screen burst; and upward input first retracts the burst before lowering the red tide. At both stages settled to `100%`, the next downward wheel input scrolls into the full-width content band. Desktop and `390x844` mobile layouts have no horizontal overflow, and the browser console has no warnings or errors.
- Latest Kisara browser validation: confirmed the wake ribbons and trailing particles are emitted from the beam nose toward the rear, charge-dependent floating motion is continuous, the overcharge beam reforms centrally without extending its length, thickens while shaking, dissolves into particle rain, and then releases damped section scrolling. Returning upward from the next section resets the gate to the blue `CONTRACT 000%` state on desktop and `390x844` mobile.
- Current Kisara warning validation: at `1280x720` and `461x551`, the procedural rays extend from the title center, rotate without forming a fixed X logo, collapse into the core, and hand off to a center shock ring. At `OVERCHARGE 064%`, warning opacity, ray length, and ring opacity were all `0` while the reformed beam had begun at partial opacity, confirming the warning cannot overlap the beam regrowth. Both viewports had no positive horizontal overflow, and the browser warning/error log was empty.
- Latest Kisara refinement validation: at `1280x720` and `461x551`, charge movement stayed continuous during rapid input, the gloss opacity reached `0` before the warning variables became non-zero, performance blur reached about `4.8px` before warning build, the beam tail remained composited from transparent to opaque across its rear third, and detonation reached stronger scale/angle/glow values without positive horizontal overflow. After the first `CONTRACT 100%`, the status changed to continuously varying glitch text; both viewports released damped document scrolling after `100%`, and page console logs remained empty.
- Latest Kisara feedback validation (`2026-07-19`): after a full charge/retract/recharge cycle, the beam pose restarted from a clean initial phase; at the warning stage all four title text layers reported the active performance blur while the procedural cross remained separate. The transformed beam anchor followed the cross center on desktop and `390x844` mobile, and after the 5.2-second automatic release the beam opacity was `0`, the gate had no positive horizontal overflow, and the final canvas frame showed no visible wake residue. Downward release reset to blue before the next section completed, and upward return landed at `CONTRACT 000%` without replaying the red scene. `npm test` passed 3/3 and `npm run build` generated 36 pages, sitemap, and Pagefind index. The browser page log remained empty; one Statsig telemetry timeout was tool-side only.
- Persistent-particle/cinematic-release validation (`2026-07-19`): desktop `1265x712` and mobile `375x844` browser passes confirmed that charge packets fade at both wrap boundaries, wake exhaust separates from the nose and becomes bounded ambient drift, the automatic release grows an asymmetric rear-weighted body instead of restoring the local meter, and three event-driven burst waves hand off to slower particle rain and residual motes. Both viewports had no positive horizontal overflow; the performance blur recovered to `0px`, the final cue reached `SIGNAL RELEASED / CONTINUE`, and the desktop viewport was restored after mobile testing. `npm test` passed 3/3 and `npm run build` generated 36 pages, sitemap, and a 36-page Pagefind index.
- Pink-black-hole validation (`2026-07-19`): desktop `1265x712` continuous frame sampling confirmed the ordered sequence of sharp accretion/lensing build, dark-core compression, white-pink inversion, curved bipolar jets, elliptical shock rings, slingshot fragments, and lingering particle rain. The title and background remained depth-blurred while the top-level burst Canvas stayed sharp above them. Mobile `375x844` checks confirmed the continuous charge beam and black hole remain inside the gate with no positive horizontal overflow. The final cue reached `SIGNAL RELEASED / CONTINUE`.
- Beam-detail/performance validation (`2026-07-19`): desktop `1280x720` confirmed the charge beam retains one continuous envelope while clipped helical shards circulate inside it and a primed wake immediately opens into a denser, longer rearward plume. The black-hole endpoint now skips transparent detonation drawing, clears inherited Canvas shadow blur before residual particles, fades and releases the old wake with the beam, paints residual rain at about 30 FPS, and stops Canvas/layout work once only the low-frequency glitch label remains. `npm test` passed 3/3 and `npm run build` generated 36 pages, sitemap, and a 36-page Pagefind index.
- Site-wide presentation validation (`2026-07-19`): desktop checks covered the homepage continuation, Blog, Projects, Games, About, Article, and 404. Blog keyword search returned two `Hexo` signals and the Projects UE5 filter reduced the list to its matching record. Mobile `375x844` checks covered the homepage continuation and all major page types; Projects filtering remains horizontally scrollable with its native scrollbar hidden, About and 404 have no positive horizontal overflow, and long hand-written article `pre` blocks scroll only inside the code surface. The page log contained Vite debug messages only, with no warnings or errors. `git diff --check` reported no content errors, `npm test` passed 3/3, and `npm run build` generated 36 pages, sitemap, and a 36-page Pagefind index.
- Momentum-wake/screen-impact validation (`2026-07-19`): desktop testing completed a full charge, automatic black-hole release, damped transition to the next section, return to a blue `0%` gate, and a second charge to `60%` without the previous post-release beam twitch. Timed screenshots at about `85%`, `90%`, `93%`, and `96%` confirmed full-gate gravity/vignette/chromatic feedback, sharp black-hole depth, inversion flash, coherent release waves, and recovery into residual particles. Mobile `375x844` completed the release with no positive horizontal overflow, and desktop/mobile page logs contained no warnings or errors. `git diff --check` reported no content errors, `npm test` passed 3/3, and `npm run build` generated 36 pages, sitemap, and a 36-page Pagefind index. One Statsig request failure came from the browser-control runtime, not the site.
- Seamless-phase/collapse validation (`2026-07-19`): desktop `1280x720` completed repeated gate cycles with the beam driven by one closed master phase. A second-cycle `43%` pose sample after a four-second zero-state idle measured a maximum 55ms step of about `1.95px`; after holding partial charge for another five seconds and nudging to `50%`, the maximum step was about `1.88px`, with no accumulated-time phase jump. Timed automatic-release captures confirmed a distinct inward black-hole compression, a high-opacity radial background-lensing/shockwave stage, restrained sub-pixel screen displacement, final detonation, and complete blur/warp recovery. The gate visual stayed at an identity transform, desktop and mobile `375x844` had zero positive horizontal overflow, and page warning/error logs were empty. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, 36-page Pagefind index) passed. A Statsig timeout was emitted by the browser-control runtime only.
- Terminal-crush/refraction validation (`2026-07-19`): desktop `1280x720` timed captures confirmed the black hole retains a deep blue-violet interior before its disk and horizon accelerate into a much smaller white-hot singularity. The peak shockwave used two masked background copies with independent radial scaling and opposite rotation/skew; displaced artwork remained visible above the atmosphere layer, no rectangular filter boundary appeared, and both warp opacities recovered to `0`. Desktop and mobile `375x844` completed the automatic release with no positive horizontal overflow, `--kisara-performance-blur: 0px` at rest, `SIGNAL RELEASED / CONTINUE`, and empty warning/error logs. The abandoned SVG displacement filter was removed after browser testing exposed a rectangular compositor clip at large lens radii.
- Segmented-aftermath validation (`2026-07-19`): desktop `1280x720` timed captures at roughly `86%`, `90.6%`, `95%`, and `98.3%` confirmed a slower five-stage release, a feathered small-core void instead of a hard black disk, visible fold/torsion refraction in both outer thirds, a stable middle background zone, title rupture/dissolve without reverse-morph playback, and a multi-wave aftermath with echo rings, residual ribbons, fragments, and rain. The title source-opacity samples progressed from `0` at `98.7%` through `0.0313`, `0.5709`, and `0.9714` to `1` at completion while blur fell to `0`, confirming reconstruction rather than a single-frame snap. Mobile `375x844` used a reduced side-field scale, retained zero positive horizontal overflow, completed at `SIGNAL RELEASED / CONTINUE`, restored the source title to `1`, and cleared both WebGL canvases. Browser page warning/error logs were empty; Statsig timeouts were emitted by the browser-control runtime only. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, 36-page Pagefind index) passed.
- Title-clarity/block-reconstruction/gloss validation (`2026-07-19`): the blue title begins at `8.8px` blur, reaches about `2px` when the red tide completes, and returns to full clarity after reconstruction. The final background pass expands the same `9px` block vocabulary used by the title from the rupture center across the viewport, then resolves each cell back into the clear scene. During the blade-gloss stage, desktop and mobile `375x844` computed styles confirmed the tide parent and gloss layer use `filter: none`, the red layer alone retains `blur(2px)`, and both generated layers retain `background-clip: text`; mobile had no positive horizontal overflow. A fresh page produced no console errors. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, 36-page Pagefind index) passed.
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

### 2026-07-19 Kisara persistent particle and cinematic release refinement

- Replaced modulo-recomputed wake streaks with bounded stateful particles that move through jet, deceleration, ambient drift, edge response, and TTL fade phases.
- Rebuilt the normal-charge beam from one continuous tapered envelope, braided internal flow, and boundary-faded packets so visible texture no longer snaps back to a first frame or exposes a hard rear splice.
- Replaced the post-warning restored meter with an asymmetric full-screen plasma body, open electric edges, an internal spine, pre-blast compression, directional rush lines, three event-driven burst waves, shock arcs, shards, slower rain, and residual afterglow.
- Extended automatic release from 5.2 to 6.8 seconds and applied width-aware release thickness so the cinematic body remains readable on narrow mobile screens.
- Revalidated `npm test` (3/3), `npm run build` (36 pages, sitemap, Pagefind), desktop `1265x712`, mobile `375x844`, zero positive horizontal overflow, final blur recovery, and restored desktop viewport state.

### 2026-07-19 Kisara pink black-hole release refinement

- Replaced the remaining multi-shell normal-charge beam with one continuous teardrop envelope and phase-continuous internal filaments, removing both visible shell seams and packet-loop snapback.
- Extended wake particles into explicit jet, inertial-coast, and ambient-drift phases with longer TTL, weaker drag, curl-driven separation, and late fade so exhaust can escape and remain in the gate before disappearing.
- Replaced the final restored plasma body with a lightweight Canvas 2D pink black hole inspired by accretion/lensing hierarchy rather than importing the reference project's WebGL/LUT assets. The sequence now uses far/near accretion arcs, an occluding dark core, photon ring, lensing paths, orbit particles, tangential slingshot waves, curved bipolar jets, shock rings, spiral rush lines, and residual rain.
- Moved the burst Canvas out of the negative-z background container, placed it above the title, excluded it from the common performance-blur selector, and kept the title/background blurred during black-hole formation.
- Extended automatic release from 6.8 to 8.2 seconds and revalidated desktop `1265x712` and mobile `375x844` framing with no positive horizontal overflow.

### 2026-07-19 Kisara beam detail and release performance

- Restored small helical shards inside the normal-charge beam with phase-boundary fades, so fragments circulate with the internal flow without adding another beam shell or a visible loop reset.
- Added an initial primed wake burst, higher rearward launch speed, wider side separation, longer jet/coast phases, and a larger bounded pool. Escaped particles still transition into ambient drift, while overcharge now fades and clears the old wake before the black-hole phase.
- Removed the post-impact hot path by skipping the completed transparent detonation layer, resetting inherited `shadowBlur` before burst/rain particles, suppressing invisible ambient work, and throttling completed residual particles to roughly 30 FPS. After all Canvas particles expire, the frame loop only updates the runaway glitch label at low frequency and performs no Canvas or layout repaint.
- Revalidated `git diff --check`, `npm test` (3/3), `npm run build` (36 pages, sitemap, Pagefind), and desktop `1280x720` charge/release behavior.

### 2026-07-19 Kisara site-wide presentation pass

- Replaced the placeholder homepage continuation with full-width contract introduction, channel navigation, current-pulse, project-preview, and latest-article sections that extend the gate palette without repeating its cinematic effect.
- Rebuilt the Kisara layout shell with page-aware navigation states, a compact fixed inner-page header, clearer context-menu actions, footer status/navigation, and a reachable mobile bottom bar.
- Reworked Blog, Projects, Games, About, Article, and 404 into page-specific information systems using cold-blue rules, rose activation, dense editorial type, and restrained fight-art atmosphere instead of generic glass-card stacks.
- Added functional Blog search/category filtering and results count, Projects technology filtering, Games metadata/actions, About identity and live-signal blocks, article reading progress/copy-link behavior, and themed recovery actions on 404.
- Fixed narrow-layout overflow for hand-written article `pre` blocks and hid the native scrollbar on mobile filter tracks while preserving horizontal scrolling. Revalidated `git diff --check`, `npm test` (3/3), `npm run build` (36 pages, sitemap, Pagefind), desktop major pages, and mobile `375x844` Projects/About/404 with no warning or error logs.

### 2026-07-19 Kisara momentum wake and screen-impact refinement

- Replaced the single bright internal flow with back-layer dark helices, front-layer luminous helices, travelling compression rings, speed-responsive fragments, and a beam-nose shock flare while retaining one continuous tapered envelope.
- Added a low-pass beam-head velocity tracker. Wake particles now inherit source motion, then progressively receive rearward exhaust force and lateral separation; primed particles use the same integrated trajectory instead of linear side placement.
- Prevented post-release animation multiplication by guarding one active energy RAF epoch. Reset, visibility, and return-to-gate paths now cancel RAF/timers and restart pose, particle, and beam-head clocks from a clean epoch.
- Extended black-hole influence beyond its Canvas object through differential background pull, full-gate vignette/chromatic response, screen shake, ambient-particle attraction, and broad lensing rings.
- Reorganized the explosion into two coherent major-axis waves and reduced orbit, burst, rain, path, highlight, DPR, and lifetime budgets. Completed release updates now use delayed scheduling rather than a 60 Hz no-op RAF loop.
- Revalidated desktop full release plus second-cycle charge, mobile `375x844` release and overflow, empty page warning/error logs, `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind).

### 2026-07-19 Kisara seamless phase and collapse-shockwave refinement

- Replaced frequency-times-accumulated-clock pose equations with independent integrated motion phases. Charge-dependent frequency changes now preserve oscillator phase after long idle periods and across repeated gate cycles.
- Moved all normal-beam internal motion onto one `2π` master phase with integer harmonics. The front/back helix is blended segment by segment, while rings and fragments fade at their periodic travel boundary, removing the visible loop restart.
- Split the black-hole endpoint into a deeper inward collapse, a particle-free full-screen shockwave, and delayed final detonation. Added inward streaks, compression rings, and a central compression glow without increasing persistent particle limits.
- Added a radial-masked duplicate of the cold/fight backgrounds as a local lensing layer. The layer expands with the shockwave while the main wallpaper container remains fixed, replacing prolonged viewport shake and preventing exposed outer edges.
- Revalidated desktop repeated-cycle/long-idle continuity, desktop release staging, mobile `375x844` full release, zero positive horizontal overflow, full blur/warp recovery, empty page logs, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind).

### 2026-07-19 Kisara WebGL lensing and pure-black horizon refinement

- Replaced the superseded CSS background-copy/radial-mask warp with one full-screen WebGL2 fragment pass that cover-samples the theme backgrounds per pixel. Unsupported WebGL2 and context-loss paths keep the Canvas release effects without restoring the old sliced warp.
- Converged on a capped monotonic primary-image lens with a short smooth influence envelope. Removed the experimental signed secondary-image fold, shader chromatic triple sampling, and oversized lens radius after browser captures showed that combination turning the character face into a circular portal.
- Matched the shader background atmosphere to the page, reduced full-screen performance blur, and kept the `Kisara` title in the same blur choreography while the lens Canvas remains a continuous undivided scene.
- Made the event horizon optically empty through both shader and Canvas masks, reduced the bright photon rim, and reapplied a full-radius solid-black mask after foreground disk highlights so no texture or light streak can cross the center.
- Reduced the lens shader from roughly eight texture reads per fragment to two. Desktop runs at up to CSS resolution/60 FPS; mobile remains capped near 30 FPS with a `0.68` render scale and pixel budget. The lens Canvas clears and becomes transparent after release or while hidden.
- Revalidated `git diff --check`, `npm test` (3/3), `npm run build` (36 pages, sitemap, Pagefind), desktop `1280x720`, mobile layout metrics at `375x844`, zero positive horizontal overflow, WebGL ready/active/clear lifecycle, and no browser warning/error logs. Final visual acceptance remains with the user.

### 2026-07-19 Kisara subject-aware lensing refinement

- Historical/superseded by `139ca19`: the per-feature face/hair/body/wing/weapon regions described below are no longer the active background-warp architecture.
- Added a face-protection region derived from normalized coordinates in the current `fight.jpg`, then converted it through the same cover crop used by the WebGL scene. The protection therefore follows the face from desktop center framing to the right-shifted mobile crop instead of relying on fixed viewport pixels.
- Reweighted the shader so the face interior receives almost no radial pull or shock displacement, while an elliptical subject halo around the hair, bow, scarf, shoulders, wings, and weapon receives stronger lensing. The title rectangle is supplied separately as another priority region.
- Added three clipped `Kisara` title refraction layers for upper, middle, and lower bands. Their shear, drift, scale, opacity, and retained source-text blur follow the black-hole pressure, keeping the word visibly bent but readable instead of smearing it into horizontal blocks.
- Revalidated the full automatic release at desktop `1280x720` and mobile `375x844`: facial proportions remain stable, title/subject-edge distortion is visible, the mobile lens buffer remains `255x574`, horizontal overflow stays zero, and browser warning/error logs remain empty. `npm test` passed 3/3 and `npm run build` generated 36 pages with sitemap and Pagefind.
- The normalized protection coordinates are intentionally tuned to the current `public/themes/kisara/assets/fight.jpg`; replacing that artwork with a differently composed image requires retuning the face region.

### 2026-07-19 Kisara side-field lensing and continuous title refinement

- Replaced the three clipped CSS title replicas with one transparent WebGL title texture rendered from Canvas2D. The source title crossfades into the texture only during the black-hole pressure phase, so the word is sampled as one continuous surface rather than as independently stretched bands.
- Superseded the stronger center-collapse title map after browser captures showed it pulling letters into disconnected fragments. The active title field uses low-frequency vertical bend, horizontal ribbon shear, a restrained orbital tangent, and a small shock displacement; it preserves the full word silhouette while still visibly flexing around the release center.
- Removed the fight-art-specific face, hair, body, wing, and weapon uniforms from the background shader. The active field now uses a horizontal three-zone mask: the middle third returns the original UV exactly, while only the left and right thirds receive radial pull, slow side sweep, and shock displacement through a soft boundary.
- The foreground black-hole Canvas remains sharp and centered above the unchanged character area. The background lens and title lens each clear after release or while hidden; unsupported WebGL2 keeps the original DOM title and Canvas release fallback.
- Revalidated the full automatic release at desktop `1280x720` and mobile `375x844`: the central character region remains geometrically stable, the word stays readable while bending, both lens canvases return inactive after release, performance blur returns to `0px`, and positive horizontal overflow remains zero. Fresh-page warning/error logs were empty. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed.

### 2026-07-19 Kisara segmented black-hole aftermath refinement

- Replaced the single linear automatic-release sweep with a 10.6-second keyframed timeline that dwells through field lock, deep collapse, terminal-crush hold, rupture, and aftermath.
- Rebuilt the event horizon from broad feathered absorption gradients, a smaller deep center, subtle breathing, and broken rim arcs, removing the hard opaque ellipse that read as a pasted black shape.
- Increased outer-third WebGL radius reach and added inward tension, low-frequency folds, torsion, refraction sheen, and shock displacement while preserving the exact original UV across the middle third. Narrow screens use a lower side-field scale because the subject spans more of those outer zones.
- Extended the title WebGL pass with rupture displacement and procedural dissolve. The original title now crossfades into the lens, stays hidden during breakup, and returns through a late blurred reconstruction instead of visibly relaxing like an elastic layer.
- Extended the endpoint with three bounded particle waves, longer-lived fragments, expanding echo rings, residual magnetic ribbons, slower rain, delayed lens recovery, and a quieter residual settle. Existing canvas lifecycle and low-frequency completed-state scheduling remain intact.
- Browser-validated desktop `1280x720` and mobile `375x844`, title reconstruction samples, cleared WebGL lifecycle, zero positive horizontal overflow, and empty page warning/error logs. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed.

### 2026-07-19 Kisara clarity, block reconstruction, and sharp gloss refinement

- Added a progress-linked title clarity curve: the cold-blue word begins deliberately soft, becomes increasingly clear with the red tide, retains a small amount of blur before the black-hole release, and finishes fully sharp after reconstruction.
- Replaced the earlier radial/full-screen reconstruction interpretation with the title shader's square-cell language. A `9px` block field now expands from the rupture center, briefly pixelates the affected scene, and resolves outward into the clear background.
- Split the red tide rendering into two generated text layers under the same diagonal tide mask. The red gradient alone receives `--kisara-title-blur`; the metal blade gloss is composited separately with no filter, so it stays crisp without escaping the `Kisara` glyphs.
- Corrected CSS specificity and avoided a `background` shorthand reset that initially reapplied parent blur and changed `background-clip` back to `border-box`.
- Browser-validated the gloss at desktop and mobile `375x844`, confirmed fresh-page console output is clean, and passed `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind).

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
