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
- 细微视觉效果不得以 Codex 浏览器截图作为最终判断依据。浏览器截图只用于一眼可见的大范围布局、状态或回归检查；链节咬合、微小位移、材质厚度、粒子手感等细节必须交由用户目视验收。需要用户查看但主任务仍可继续时，优先发送 Windows 提醒，不要为了等待视觉判断中断当前任务。
- 子代理必须按难度分配：`luna` 只负责只读的文件/路径/行号查找与简单问题；`terra` 负责中等难度的代码追踪、日志归纳和方案比较；`sol` 只用于较高或高难度问题，并允许创建与主代理同级的 `sol` 作为独立审查或疑难问题协作者。创建时显式选择模型并提供自包含任务，不依赖 fork 上下文；默认仅允许主代理派发一级子代理，任务边界要小，完成后收束摘要并关闭。

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
- Kisara ball-lightning/performance refinement commit: `280cd0d Refine Kisara lightning core and performance`.
- Kisara procedural plasma-core refinement commit: `1426bde Refine Kisara blade gloss and plasma core`.
- Kisara morning blade-gloss restoration commit: `f4aeb16 Restore Kisara morning blade gloss`.
- Kisara blade text-mask correction commit: `444d77c Clip Kisara blade gloss to title`.
- Kisara procedural singularity rollback commit before the post-release interaction pass: `7059c87 Integrate Kisara procedural singularity core`.
- Kisara title-erosion/singularity-flow checkpoint commit: `4e61262 Checkpoint Kisara data erosion and singularity flow`.
- Kisara charge-beam transition refinement commit: `139ab81 Refine Kisara charge beam transition`.
- Kisara post-release whip-particle refinement commit: `a20782e Refine Kisara post-release whip particles`.
- Kisara title-data erosion integration rollback commit: `cc15be9 Integrate Kisara title data erosion`.
- Kisara gate-runtime restoration commit: `c016746 Restore Kisara gate interaction runtime`.
- Kisara eye-particle flow refinement commit: `3eae746 Refine Kisara eye particle flow`.
- Kisara segmented charge-flight checkpoint commit: `1725af6 Checkpoint Kisara charge flight continuity`.
- Kisara continuous charge-flight refinement commit: `f754c06 Smooth Kisara charge flight path`.
- Kisara charge-flight notes rollback commit: `e399d3e Update Kisara charge flight notes`.
- Kisara rejected 2D liquid-overlay rollback commit: `ba82ee4 Refine Kisara post-release title effect`.
- Kisara eight-second automatic-release timing commit: `f20ab43 Tighten Kisara autoplay timing to 8 seconds`.
- Kisara full-screen warning experiment rollback commit: `40d1558 Checkpoint full-screen Kisara warning experiment`.
- Kisara full-screen warning refinement checkpoint: `010e9e7 Refine Kisara full-screen warning`.
- Kisara continuous warning-spin rollback commit: `eee26e7 Smooth Kisara warning cross rotation`.
- Kisara shortened warning-handoff rollback commit: `72794e2 Tighten Kisara singularity handoff`.
- Kisara staged singularity entrance rollback commit: `a235044 Stage Kisara singularity entrance`.
- Kisara warning overexposure rollback commit: `0baecad Refine Kisara warning overexposure`.
- Kisara July 20 warning restoration checkpoint: `556a90e Restore Kisara July 20 warning cross`.
- Kisara original-scene exposure refinement commit: `d112f11 Refine Kisara warning exposure`.
- Kisara chain rupture/heart-seal rollback commit before the immediate-crush refinement: `3204f96 Rework Kisara chain rupture and heart seal`.
- Kisara opening-transition rollback commit: `cb1fa6e Refine Kisara opening transition`.
- Kisara compressed singularity/reversible-intro checkpoint: `91356a2 Tighten Kisara singularity sequence`.
- Kisara stable outer-chain motion rollback commit: `2d7853b Stabilize Kisara outer chain motion`.
- Kisara adaptive chain-interlock rollback commit: `d1ffa62 Refine Kisara chain interlock`.
- Latest Kisara inner-page functional checkpoint: `39c76f9 Fix Kisara arcade mobile sizing`.
- Kisara original transformation-scene rollback commit: `603abbc Integrate Kisara transformation scene sequence`.
- Deployment: Astro static output to GitHub Pages through `.github/workflows/deploy.yml`.
- Local state: the Kisara image transition, seal-chain title progression, post-gloss procedural warning, segmented foreground pink-black-hole release, original-scene `6 -> 7 -> 8` transformation bridge, continuous full-frame WebGL2 lensing, independent title refraction/dissolve/reconstruction, full-screen block reconstruction, lingering particle rain, post-reconstruction highlights/parallax, and site-wide deep-indigo UI are implemented and browser-validated. Blog, Works, Game, and Me now use four distinct page structures rather than variants of one card layout. The title keeps its clear red core and soft tide, while the blade gloss remains the Beijing-time July 19 morning slanted text layer clipped inside the glyphs. The rejected `ba82ee4` 2D overlay remains a rollback reference only; `1725af6` remains the segmented-flight rollback point. Untracked user source materials remain separate and untouched (`102000325_p0.jpg`, `122472458_p0.png`, `gate-background.jpg`, `XP/`, `kisara/`, `showcase-output/`).
- Default theme ID: `fuyukawa-kagari`.
- Available theme IDs: `fuyukawa-kagari`, `blank`, `kisara`.
- Route decision: `fuyukawa-kagari` remains on existing root URLs; `blank` uses `/themes/blank/...`; `kisara` uses `/themes/kisara/...`. Alternate themes canonicalize to matching root URLs.
- Preference key: `yuimi-theme-id-v1` with an allowlist and `fuyukawa-kagari` fallback.
- Implementation state: three independent frontends are locally available. The Kisara homepage interaction, article layout, and redesigned Blog/Works/Game/Me pages have passed the current local test/build/browser checks and are awaiting final user visual acceptance; they have not been pushed. The subject-aware lensing checkpoint is `1164fb4`, the latest warning rollback point is `d112f11`, the opening-transition rollback point is `cb1fa6e`, the compressed-release checkpoint is `91356a2`, and the latest inner-page checkpoint is `f4776b2`.

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
- Kisara presentation assets: the user-selected cold background is at `public/themes/kisara/assets/gate-background.jpg`; the explicitly selected fight artwork is at `public/themes/kisara/assets/fight.jpg`. Transformation sources `kisara/6.png`, `kisara/7.png`, and `kisara/8.png` remain user-owned and untouched; optimized runtime copies are `transformation-smoke-wide.webp`, `transformation-detail.webp`, and `transformation-silhouette.webp` under `public/themes/kisara/assets/`.
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
- Status: image transition, continuous organic charge beam, two-stage overcharge sequence, persistent particle pools, segmented pink-black-hole release, side-field WebGL refraction, post-reconstruction eye/blade highlights, mouse parallax, and the WebGL liquid-title takeover are implemented and browser-validated on desktop and `375x844` mobile viewports; publication is pending.
- Key behavior: while the homepage is at the top, downward wheel/touch/keyboard input raises a blue-to-red diagonal tide and upward input lowers it. Input changes a target level; `requestAnimationFrame` advances the visible level with damped velocity, so the mask, background transition, and crest continue smoothly between wheel events. The cold background gradually blurs and dims while the fight artwork fades in from blur to clarity. The lower contract display is a Canvas-only tapered energy beam drawn from one continuous envelope; its internal filaments use periodic phase functions without modulo-wrapped packets or differently scaled shell geometry. Wake particles emit from the beam nose and keep visible streak continuity through jet, inertial coast, and ambient-drift phases before a late TTL fade. Normal-charge instability eases toward the current charge instead of jumping at wheel segments, and an explicit initial-state latch makes a second charge cycle restart from a clean pose phase after returning to zero. After the red tide settles at 100%, the title gloss finishes first; a short pre-warning blur then precedes the procedural DOM warning. The warning directly desaturates and raises the contrast of the actual scene, closes a dark elliptical focus field onto the title center, and keeps its black/white core, four unequal tapered rays, broken shards, and sparks above that field. Its rotation follows one uninterrupted wall-clock timeline across build, flash, and collapse instead of restarting at eased phase boundaries; only a restrained pulse-local shake remains near the impact. It then collapses sharply back into the core and hands off to an automatic eight-second segmented release. The sequence now dwells through field lock, deep collapse, terminal-crush hold, rupture, and aftermath rather than sweeping one linear progress curve. The local meter dissolves permanently for that sequence. A foreground pink black hole forms at the warning center while the title and background remain depth-blurred: layered far/near accretion arcs, a feathered absorption core, broken photon arcs, lensing paths, and bounded orbit particles build pressure before an inversion flash. The background WebGL pass leaves the middle third at the original UV while the outer thirds receive visible pull, fold, torsion, refraction sheen, and shock displacement; narrow screens apply a lower field scale because the subject spans more of the side zones. The title remains independently refracted through rupture, dissolves into the blast instead of visibly springing back, and reconstructs from blur only during the final aftermath. Three slingshot particle waves, curved bipolar jets, expanding echo rings, residual ribbons, longer-lived fragments, slower gravity-driven rain, and afterglow replace the abrupt particle-only ending. The burst Canvas is a top-level gate layer and is explicitly excluded from the common blur selector, so the black hole remains sharp above the blurred title. The lower state text shows `CONTRACT 000%` through the first charge and switches to continuously changing machine-glitch output instead of replaying a second percentage counter. Document scrolling is released only after both stages settle at 100%; the next section and the return to the blue gate use a time-scaled damped spring rather than a distance-proportional jump.
- Escape paths: reduced-motion users start completed, restored pages below the top are synchronized to completed, and an explicit `SKIP` link bypasses the gate.
- Current energy refinement: the local beam uses one continuously advancing master phase rather than wrapping or visibly resetting at `2π`; return-to-gate resets its timestamp but preserves the oscillator phase. The envelope ripple, front/back depth-separated helix, compression rings, helical fragments, and nose shock therefore remain continuous across long runs and repeated charge cycles. Local and flight filaments now calculate each strand once, then batch segments into four depth buckets; the post-50% exterior coils use the same batched approach. During ordinary charge-only frames, the presentation fast path updates only the meter pose instead of rewriting the full black-hole/title/background variable set. Wake particles retain the low-pass beam-head velocity inheritance and bounded jet/coast/drift lifecycle.
- Current charge prelude: the 0-100% local beam follows a more pronounced softly displaced centerline, and its upper/lower envelope now enters the rounded nose through continuous cubic tangents rather than two straight shoulder ramps. Exterior front/back energy coils and partial halos appear progressively after 50%. When the target reaches full and the visible charge crosses roughly `99.5%`, the state locks to `100%` immediately and begins the bounded 2.7-second intro without waiting for the spring velocity to settle. The full-screen beam first inherits the meter's live translate/rotate/scale pose, then detaches. Its head follows one five-control U-shaped curve sampled by real arc length, rather than restarting easing at a launch/turn boundary. The lagging tail gathers through a matched quintic segment whose end tangent and acceleration agree with the main route, so it leaves the meter without a pinned endpoint or a second impulse when it crosses the old seam. Reversing after the intro still resets the prelude cleanly.
- Current seal-chain refinement: the outer frame feed is derived only from reversible scroll progress, with a separate bounded take-up feed during the automatic crush; wall-clock pose time no longer advances the closed loop while input is idle. Frame records are distributed by equal arc length and forced to an even count so the left closure cannot join two links with the same orientation. Upright links and flat connectors render in four depth passes: upright far arc, connector far arc, upright near arc, connector near arc. Connector width is calculated from the current pair-center span and the upright-link inner aperture instead of one global scale, so each connector remains independent, reaches both neighboring inner edges, and does not form a continuous strip behind the upright links. The user visually accepted the current fine interlock; future micro-adjustments must use user judgment rather than browser screenshots.
- Current black-hole refinement: the release uses keyframed progress across five perceptual stages instead of one linear autoplay. Collapse reaches a nonlinear terminal crush, pauses under maximum pressure, then releases through a separate vacuum shockwave and detonation. The bounded procedural field no longer uses `angle * 3/5/7/11` spiral families, five rotating dark arms, rotating edge arcs, or a continuously changing global angle. Cartesian advected currents animate inside a stationary irregular envelope; only two or three short fixed-anchor fragments travel inward. Absorption clouds pulse radially without orbiting, orbit particles favor radial fall over angular acceleration, and four offset dark contours build the event well without a hard radial-gradient disk. The WebGL background lens keeps its strict three-zone horizontal field, and the independent title lens still handles rupture, dissolve, and measured reconstruction. Desktop retains the full side field; mobile scales the field down while preserving center lock and zero horizontal overflow.
- Post-reconstruction interaction: activation is strictly `burstComplete && pageMode === "gate"`, not `.is-released`, because the latter is only applied after scrolling into the next section. A transparent scene Canvas maps normalized eye and blade coordinates through the exact `background-size: cover` geometry of `fight.jpg`, then draws screen-blended blooms, tapered anime trails, and bounded particles that detach in screen space. Pointer direction selects one damped travel target rather than restarting on every event; the fight background moves at most `14px` desktop or `8px` mobile inside the existing `24px` bleed, and particles eject opposite that movement. Eye particles retain straight local streaks; their collective path bends upward through eye-only lift and a lifetime-weighted steering target. Do not curve each particle stroke, because that produces the rejected comma-shaped appearance. The eye flame's outer lobes are longer and progressively bend upward while the bright core remains compact. The rejected 2D title-data Canvas is forced hidden in post-release. The existing WebGL title lens remains active after reconstruction and becomes the only visible title source: low idle flow preserves readability, while pointer pressure broadens the deformation across multiple letters and the flow front mirrors the background direction. Broken edge drag is generated by shifted glyph texture samples rather than fixed external lines. Once post-release owns the title, the older burst renderer must not call `drawTitleLens()` or write title-source opacity; this ownership guard prevents the multi-second entry flicker caused by two RAF loops toggling the same layers.
- Site-wide presentation: the homepage continues into full-width channel, current-pulse, project, and article bands instead of repeating the hero effect. Inner pages use a fixed theme header, mobile bottom navigation, cold-blue information lines, rose active states, restrained `fight.jpg` atmosphere, and page-specific list/article controls. Blog search/filtering, Projects technology filtering, Games metadata/actions, About identity signals, article reading progress/share controls, and a themed 404 are functional rather than decorative-only.
- Boundary: no root `kisara/` source image is imported, copied, staged, or published.
- Local helper: root `preview-blog.bat` runs `npm run build` first and starts `npm run dev -- --host 127.0.0.1` only after a successful build.

### Kisara Inner-Page Redesign

- Goal: rebuild Blog, Projects/Works, Games, and About/Me as four distinct interaction models inside the existing Kisara visual system, without changing the accepted homepage gate sequence or article layout.
- Status: implemented and locally validated; user visual acceptance is pending. `d1ffa62` is the rollback point before this work, and `f4776b2` is the latest functional checkpoint.
- Blog asset source: user-owned `kisara/engage kiss.png`; the source remains untracked and untouched. A reproducible offline extraction script may read it and publish only generated, compressed theme assets under `public/themes/kisara/assets/blog/`.
- Blog direction: layered city transmission intro with four separately masked visible-character layers. Entry order follows the requested front-to-back depth order, replays on every Blog entry, and degrades to a static composition for reduced motion. The DOM still stacks Sharon, Ayano, Shu, then Kisara from back to front; back-character masks are intentionally allowed to overlap already-visible front layers so occluded clothes and weapons remain intact beneath the correct foreground instead of being destructively partitioned.
- Page boundaries: Blog owns search/archive behavior; Works owns technical-track filtering; Games owns a single-focus arcade selector; Me owns profile and interest navigation. New selectors must be page-prefixed so shared homepage and article styles remain unchanged.
- Functional commits: `9c488a4`, `5c11956`, `f066c50`, `f20b1cf`, `67a7a54`, `702ccfb`, and `39c76f9`.
- Generated Blog assets: `public/themes/kisara/assets/blog/engage-kiss-scene.webp`, `kisara-front.webp`, `shu-middle.webp`, `ayano-middle.webp`, and `sharon-back.webp`. The old full-scene `isnet-anime` union plus nearest-seed/Voronoi ownership was removed after it assigned Shu clothing, Ayano's weapon, and Sharon clothing to front layers. Curated source-size masks now live at `scripts/assets/kisara-blog-masks/`; `scripts/extract_kisara_blog_layers.py` validates and resizes those masks deterministically without modifying the source artwork or rerunning an unstable model.
- Blog mask/framing validation (`2026-07-22`): cumulative front-to-back previews confirmed Kisara no longer reveals the visible clothes or weapon of later characters, Shu retains his visible jacket/lower clothing, Ayano retains her gun and clothing, and Sharon retains her visible dress. Desktop `1440x900` uses shared `object-position: center 4%`, keeps Sharon's head visible without changing z-index, and has no horizontal overflow. Mobile `390x844` retains `object-fit: contain`, top alignment, and equal `scrollWidth`/`clientWidth`. Browser warning/error logs were empty; `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, 36-page Pagefind index) passed.
- Temporary extraction tooling: SAM2 experiments were isolated under `C:\Users\a1234\AppData\Local\Temp\yuimi-sam2-venv` with model `C:\Users\a1234\AppData\Local\Temp\yuimi-sam2-models\sam2.1_s.pt`; they are not project or global Python dependencies. Ultralytics created local settings at `C:\Users\a1234\AppData\Roaming\Ultralytics\settings.json` and `C:\Users\a1234\Desktop\Ultralytics\settings.json`; do not delete them without an explicit cleanup request.

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

1. Obtain user visual acceptance for the redesigned Kisara Blog, Works, Game, and Me pages, especially fine character-layer timing and page-specific visual density.
2. Continue homepage or puppet-layer refinement only as a separate scoped task so the accepted inner-page baseline stays recoverable.
3. Push the baseline and Kisara commits only when separately requested.

## Test and Validation Record

- `npm test`: 3/3 Node tests passed for all theme IDs, canonical path stripping, and cross-theme article-context mapping.
- `npm run build`: passed after the current Kisara site-wide presentation pass; 36 static pages generated, sitemap created, Pagefind indexed 36 pages.
- Kisara inner-page redesign validation (`2026-07-21`): Blog desktop/mobile layouts retained zero positive horizontal overflow and replayed the four-character entrance in the order Kisara, Shu, Ayano, Sharon, including after browser Back via `pageshow`. Works technology filtering reduced the queue to the expected UE5 record. Game keyboard/button navigation changed the active title and scene without clipping on mobile. Me interest tabs switched content correctly and kept the avatar square at `220x220` desktop and `170x170` mobile. The accepted homepage gate and an article containing seven Expressive Code blocks remained intact, and browser warning/error logs were empty. `npm test` passed 3/3 and `npm run build` generated 36 pages, sitemap, and a 36-page Pagefind index.
- Seal-chain motion and interlock validation (`2026-07-21`): the outer frame remains stationary after input settles, reverses along the same equal-arc-length path, and no longer splits into independently rotating sections during upward input. The closed loop uses an even link count, and flat connector width is derived from the neighboring upright-link inner spacing with split front/back depth passes. The user visually accepted the resulting connector/upright interlock. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, 36-page Pagefind index) passed. Browser warning/error logs were empty; Statsig network timeouts belonged to browser-control telemetry, not the site.
- WebGL liquid-title validation (`2026-07-20`): desktop replay completed the full charge, enchantment, automatic black-hole release, strong pointer travel in both directions, damped section entry, blue reset, and a second complete release. The CSS title source returned to opacity `1` with the lens cleared on section entry, then the lens retook ownership after the second release. A focused 60-sample transition audit found zero upward source-opacity jumps after `is-post-release`; source opacity moved monotonically `1 -> 0`, and lens activity changed only once from off to on. Mobile `375x844` reported equal document/client widths with no positive horizontal overflow and retained a readable centered title. Page warning/error logs were empty; repeated Statsig timeouts were browser-control telemetry only. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, 36-page Pagefind index) passed.
- Charge-flight continuity validation (`2026-07-20`): the segmented quadratic/cubic experiment preserved direction but still produced visible impulses because launch acceleration restarted and the lagging tail crossed a separate path seam at the U-turn; that approach is superseded and retained only in rollback commit `1725af6`. The current implementation uses one quintic head route, a 96-sample arc-length lookup, smootherstep launch timing, and a quintic gather segment matched through position, tangent, and acceleration. Desktop `1280x720` frame sampling showed continuous travel through launch, the U-turn low point, and title approach. Mobile `375x844` kept `scrollY` locked at `0`, reported zero positive horizontal overflow, and retained the complete route. Page warning/error logs were empty. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, 36-page Pagefind index) passed.
- Kisara gate runtime restoration (`2026-07-20`): `cc15be9` extracted title-data drawing into `drawTitleDataCell()` but retained two loop-only `continue` statements, causing `SyntaxError: Illegal continue statement` before the global wheel listener registered. Replacing them with `return` restored the captured gate input without changing the visual parameters. A fresh browser load had no warning/error logs; downward input kept `scrollY` at `0` while advancing `CONTRACT 000% -> 009%`. The full desktop sequence reached enchantment, automatic release, `SIGNAL RELEASED / CONTINUE`, damped scrolling to `scrollY 720`, blue reset on return, and a working second charge cycle. `npm test` passed 3/3 and `npm run build` generated 36 pages, sitemap, and a 36-page Pagefind index.
- Post-release eye-flow refinement (`2026-07-20`): the first attempt curved each short particle stroke and was rejected because individual particles read as commas. The final implementation restores straight particle streaks, stores the emitting source kind, and bends only eye-particle velocity toward the upward axis over its lifetime. Desktop browser checks in both pointer directions showed one continuous upward-curving stream, longer outer flame lobes, no warning/error logs, and an intact full gate/release sequence. `npm test` passed 3/3 and `npm run build` generated 36 pages, sitemap, and a 36-page Pagefind index.
- Subject-protection and automatic handoff validation (`2026-07-20`): added `fight-distortion-protect.svg`, a feathered local alpha mask aligned with the current `fight.jpg` cover crop. The background WebGL lens now suppresses source and destination distortion, caustic, refraction sheen, and black-hole horizon darkening inside the marked face/body/handgrip region while leaving the independent `Kisara` title lens active. Checkpoint commit: `1164fb4`. The release timeline then changed so the blade-gloss stage can hand off automatically after its fade: the black/white warning cross, collapse, black hole, detonation, and particle rain now run without another wheel event. Browser validation reached `AUTOMATIC RELEASE / STAND BY` mid-sequence and `SIGNAL RELEASED / CONTINUE` after completion with `scrollY` locked at `0`, zero horizontal overflow, and no page warning/error logs. `npm test` passed 3/3 and `npm run build` generated 36 pages, sitemap, and a 36-page Pagefind index. The timing follow-up was committed as `f20ab43`.
- Full-screen warning refinement validation (`2026-07-20`): removed the rejected full-viewport horizontal/vertical shutter gradients that appeared as one large white cross. Scene desaturation, contrast, and brightness now apply directly to the background/title compositing layers, while a variable elliptical aperture closes toward the shared title/black-hole origin. The procedural warning cross moved into the top-level impact layer so it stays sharp without lifting the whole title above the black-hole Canvas. Desktop `1280x720` and mobile `375x844` replay measured title/cross center error below `1px`; mobile reported equal `scrollWidth` and `clientWidth`, the complete release still reached `SIGNAL RELEASED / CONTINUE`, and browser warning/error logs were empty. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, 36-page Pagefind index) passed.
- Continuous warning-spin validation (`2026-07-20`): replaced the three accumulated build/flash/release rotation terms and phase-driven angular wobble with one autoplay-clock curve spanning the entire visible warning. The first cycle produced 153 measured visible frame steps from about `-7deg` to `185deg`; the post-release return-to-blue second cycle produced 156 measured steps across the same range. Both cycles reported zero stalled steps below the chosen motion threshold and zero reverse steps, while the reduced positional shake remained confined to the flash/release pulse. The second full release still reached `SIGNAL RELEASED / CONTINUE`, retained zero horizontal overflow, and produced no browser warning/error logs. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, 36-page Pagefind index) passed.
- Post-reconstruction interaction validation (`2026-07-19`): desktop completed the full automatic release twice with an intervening damped transition, blue reset, and second cycle. The post layer activated only at `is-burst-complete`, reset to opacity/offset `0` on section entry, and returned without stale particles. Rightward travel sampled a smooth monotonic `6.04 -> 10.67 -> 12.61 -> 13.42 -> 13.74px`; the mirrored title strip moved from the opposite edge without per-event restarts. Mobile `375x844` used a `360x844` Canvas, capped parallax at `8px`, retained zero positive horizontal overflow, and kept both eye highlights aligned after cover cropping. Page warning/error logs were empty; after the final idle-frame cap, `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, 36-page Pagefind index) passed.
- Title-erosion/singularity-flow validation (`2026-07-19`): browser-replayed repeated desktop release cycles plus a complete `375x844` mobile release. The post-release title Canvas measured `812.5x254.3` desktop and `342.2px` wide mobile, remained at zero positive horizontal overflow, parked at both directional edges, and visibly retained square cells outside the `Kisara` strokes. The black-hole core no longer exposed fixed arm counts or global rotation; the remaining event well is assembled from offset irregular dark layers and short inward fragments. Page warning/error logs were empty. After the final dark-layer offset adjustment, `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) all passed.
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
- Ball-lightning/performance validation (`2026-07-19`): desktop captures at the wider blade pass and automatic-release `84%-93%` stages confirmed a broad silver-white metal face, narrow bright core, moving internal lightning branches, a breathing plasma sphere, deeper moving void, orbital foreground depth, and nonlinear collapse into the existing rupture. Mobile `375x844` retained the blade inside the title mask, used a `360x844` burst buffer for a `360x844` CSS surface, had no positive horizontal overflow, and produced no page errors. A complete release, damped transition, return to blue, and second charge reached `34.286%` with `burst=0%` and no stale particles or state. Canvas/WebGL dimensions remained stable under the throttled `ResizeObserver`; adaptive quality now trims existing excess particles and restores at least `0.88` quality on a new cycle. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, 36-page Pagefind index) passed.
- Plasma-core/morning-gloss validation (`2026-07-19`): desktop `1280x720` and mobile `375x844` captures confirmed the restored independent gloss layer uses the `5b1d2b7` slanted polygon, white-to-pink vertical gradient, screen blend, sharp `filter: none`, explicit `background-clip: text`, and the original `0.01 -> 0.3` sweep/fade timing. The slanted rectangle is no longer visible outside the title strokes. The later black-hole stage retained the procedural plasma field without symbol-like radial branches. Mobile used a `360x844` burst buffer, had no positive horizontal overflow, and completed at `SIGNAL RELEASED / CONTINUE` with no page errors. A CDP requestAnimationFrame sample during the mobile black-hole stage kept the browser's full refresh cadence. Desktop completed the release, damped transition, blue reset, and second charge to `34.286%`. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, 36-page Pagefind index) passed.
- Opening-transition validation (`2026-07-21`): desktop `1307x882` reproduced the reported lower-edge leak during the red chain stage, then confirmed that moving the sampled continuation to second-section `top: 0` with `overflow: hidden` removes the exposed source-image line. Mobile `390x844` retained zero positive horizontal overflow. A blue-state `SKIP` kept `--kisara-fill` at `0%` and fight opacity at `0` throughout the damped move, while gate reset now occurs only after the first screen is offscreen. A fresh reload added no warning/error entries. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, 36-page Pagefind index) passed.
- Compressed-singularity/reverse validation (`2026-07-21`): desktop `1280x720` traced the automatic release from blade handoff to completion in `5573ms`; warning began near `71ms`, singularity at `539ms`, collapse at `947ms`, detonation at `2833ms`, and reconstruction at `4603ms`. The pure warning stage held a `16.6ms` p95 frame interval with a `16.7ms` maximum after duplicate presentation work was removed. Mid-enchant upward input reversed the visuals and gate rail continuously from roughly `55%` to `44%`, while the next-section return rail moved from `10.9%` to `0%` without switching to document progress. During strong collapse the base scene carried about `3.57px` blur while the protected character layer remained at `0.98` opacity; WebGL source/destination protection use the same feather and transparent handoff, avoiding an opaque mask rim. Reconstruction wash samples had zero backward opacity steps. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, 36-page Pagefind index) passed. Statsig network timeouts came from the browser-control runtime, not the site.
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

### 2026-07-19 Kisara ball-lightning core and adaptive performance refinement

- Added a translucent sharp red title core beneath the existing blurred tide, widened the moving metal blade into a silver-white face with a narrow bright edge, removed residual crest blur, and reduced the title WebGL texture/drop-shadow softness.
- Replaced the broad repeated elliptical void fills with a small offscreen Canvas ball-lightning renderer. Its near-black sphere contains continuously moving pink/blue/white branches, plasma lobes, a breathing contour, a drifting deep void, Fresnel edge light, and short outward tendrils that tighten during collapse.
- Kept the sphere on the existing release anchor and composited it between rear and foreground accretion layers, preserving the established title, cross, lens, collapse, shockwave, detonation, and aftermath timing.
- Removed per-frame Canvas and WebGL layout reads. Canvas dimensions and meter geometry are cached, WebGL renderers resize only when marked dirty, and a throttled `ResizeObserver` covers font/container changes that do not emit `window.resize`.
- Lowered the burst Canvas DPR ceiling and added render-cost-based quality control for particle density, pool limits, shadow blur, and offscreen-core resolution. Existing excess particles are trimmed when quality drops, while a returning gate restores at least a `0.88` baseline so later runs do not visibly shrink.
- Browser-validated desktop and mobile blade/core stages, a complete automatic release, return-to-gate, second-cycle charge, stable buffers, zero positive horizontal overflow, and empty page error logs. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed.

### 2026-07-19 Kisara procedural plasma core and morning gloss restoration

- Replaced the readable radial/curved lightning paths inside the black-hole sphere with a bounded low-resolution procedural electric field. Warped pink/blue ridges, mist, moving charge nodes, a dark moving void, and intermittent outer tendrils now fill the sphere without forming pasted lightning symbols.
- Kept the field at `64-96px` depending on viewport and adaptive quality, then scales it into the existing offscreen core. This removes most per-frame `Path2D` allocations and keeps the expensive field work bounded while preserving the established black-hole timeline.
- Initially tested a broad tide pseudo-element gloss, then superseded it after visual review. Restored the Beijing-time July 19 morning implementation from `5b1d2b7`: a dedicated `.kisara-title-gloss` span with the original white/pink vertical gradient, slanted polygon clip, screen blend, glow, and `0.01 -> 0.3` sweep timing.
- Added explicit sharp-filter and text-clipping overrides because later title reconstruction work applies blur to every title span, and a `background` shorthand reset the inherited text clip. The gloss now uses `background-image` so the morning geometry remains constrained to the glyph mask.
- Browser-validated desktop and mobile gloss/core stages, a complete automatic release, damped transition, blue reset, second-cycle charge, mobile full-refresh frame sampling, stable buffers, no positive horizontal overflow, and empty page error logs. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed.

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

### 2026-07-19 Kisara integrated procedural singularity core

- Removed the remaining complete offscreen sphere composite from the black-hole center. The release no longer draws a standalone ball, SVG-like shell, Fresnel circle, or the extra three elliptical horizon arcs.
- Kept one bounded `68-108px` procedural electric field only as moving plasma texture. Its irregular alpha envelope, central exclusion, spiral ridges, and pink/blue currents are generated per frame and composited directly into the main release Canvas.
- Rebuilt the visible center from overlapping absorption clouds, five tapered inward currents, and a very small animated irregular throat. These elements share the accretion-disk transform and collapse timing, so the core grows out of the existing scene instead of reading as a pasted asset.
- Preserved rollback checkpoints for each visual direction: `0668d7c` (field without sphere), `b670763` (cloud aperture), `059ac5b` (deeper well), and `9d5c22e` (spiral inflow).
- Revalidated desktop and mobile `375x844` black-hole frames, zero positive horizontal overflow, empty browser warning/error logs, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind). Final visual acceptance remains with the user.

### 2026-07-19 Kisara post-reconstruction highlight and parallax pass

- Added a dedicated post-release Canvas behind the title and above the reconstructed fight artwork. It projects two eye points and one pale-blade point from normalized `fight.jpg` coordinates through the live cover crop, avoiding viewport-percentage stickers that drift off the artwork.
- Added soft integrated pink blooms, anime-style tapered light trails, and bounded lifetime particles. Movement particles remain in screen coordinates after emission and eject opposite the current background travel, so they separate naturally from all three moving sources.
- Added a `Kisara` text-only pixel-data strip. A direction change starts one mirrored journey; its position and fade derive from the actual damped background displacement, so repeated pointer events in the same direction cannot restart the strip.
- Composed parallax additively with the existing black-hole fight shifts, dynamically capped it against the background layer's physical bleed, and reset the new RAF, Canvas, particles, CSS variables, and direction state during visibility changes, section entry, restored navigation, and return-to-blue flows.
- Fixed two stale `lightningCoreLastPaintTimestamp` reset references left after the procedural singularity rename.

### 2026-07-19 Kisara ember eyes and persistent pixel-band refinement

- Removed the `YUIMI LAB / INTERACTION CHANNEL 03` gate label that crossed the character's eyes after reconstruction.
- Rebuilt the title data effect as a square-cell band with an independent roughly 1.2-second journey. It now travels opposite the background parallax, reverses from its current position, and remains fully visible at the left or right text edge instead of fading out at arrival.
- Recalibrated the third post-release source to the pale blade's right edge in `fight.jpg`. Both eyes now use larger breathing blooms, a layered rising flame core, and directional flame tongues; the blade uses an elongated edge flare rather than a circular point.
- Increased the bounded post-release particle budget and weighted emission toward the eyes. All three sources share one mirrored direction, launch upward, and retain stronger age-dependent lift after ejection so their free drift continues diagonally upward instead of resembling falling tears.
- Slowed the horizontal background response to match the longer data-band read time while retaining the existing physical bleed limits and no-black-edge guarantee.
- Revalidated `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind). Browser validation covered a complete desktop release, bidirectional pixel-band travel and edge parking, a complete `375x844` release, zero positive horizontal overflow, and empty page warning/error logs.

### 2026-07-19 Kisara title-data erosion and singularity-flow refinement

- Replaced the clipped CSS title grid with an oversized Canvas. It rasterizes the live title typography once per resize, samples the title gradient into deterministic `9px` data cells, and computes three neighboring mask rings so selected cells can continue outside the glyph silhouette.
- Ported the full-screen reconstruction language into the moving title band: hash-driven cell timing, animated noise, front/settle phases, sampled block color, sparse blue edge cells, and white front heat. Direction reversal still follows the existing damped parallax journey and the band remains parked at either title edge.
- Removed the black-hole field's global rotation, angular spiral families, five dark radial arms, and rotating rim starts. Replaced them with Cartesian turbulence, fixed-anchor short inward fragments, radial cloud pulsing, reduced orbit angular acceleration, stationary contour harmonics, and offset layered dark shapes.
- Browser-validated repeated desktop cycles and a complete `375x844` cycle. The title cells extend beyond the strokes without horizontal overflow, the mobile bottom navigation remains visible, and page warning/error logs are empty. The untracked source-material boundary remained intact.

### 2026-07-19 Kisara charge-beam enchantment prelude

- Rebuilt the local charge envelope around a moving centerline with faster early thickness growth, a softer shoulder, a tapered energy-knot nose, and stronger continuous internal helix alignment.
- Added three depth-separated exterior energy strands plus partial halos that become visible after 50% charge without introducing another DOM layer or dependency.
- Added an independent 2.7-second charge-intro state between 100% fill and the existing blade-gloss phase. The full-screen burst Canvas morphs the beam from its meter pose into a U-shaped cubic flight, preserves the moving internal filaments, carries wake-particle velocity with the head, and lands on the live title center.
- Added a dedicated `Kisara` enchantment span clipped to the glyphs. The impact expands through the letters, leaves a restrained animated pink/blue charge, then fades as the original blade gloss begins.
- Updated reduced-motion, skip, reset, reverse-scroll, visibility, and repeated-cycle paths so the new state cannot strand input or reuse an old flight clock.
- Browser-validated desktop charge, U-turn, impact, blade handoff, complete black-hole release, and a `375x844` mobile charge/impact pass. The mobile layout retained zero positive horizontal overflow, a reverse-and-recharge cycle restarted the intro, and page warning/error logs remained empty.
- Final verification passed `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind).

### 2026-07-20 Kisara charge handoff and renderer refinement

- Removed the visible phase restart by keeping the energy oscillator unbounded during a session and preserving its phase across gate resets while still zeroing the frame timestamp to prevent hidden-time catch-up.
- Replaced the local nose's sampled shoulder/semicircle join with two tangent-matched cubic curves. The rod's upper and lower wave boundaries now enter one continuous rounded front without the two diagonal connector lines.
- Changed the automatic-intro trigger from a fully settled `99.9%` spring to a `99.5%` visual threshold that atomically locks charge, target, and velocity at `100%`. The full-screen handoff inherits the live meter transform before detaching, removing the pause and ghosted pose change between canvases.
- Parameterized the launch as one shared path for both endpoints. The head leads while the tail follows `0.46` path units behind, so the left edge leaves the meter instead of staying pinned while the body turns back toward the title.
- Reused per-strand helix/orbit samples across front/back passes and replaced hundreds of per-segment `stroke()` calls with four depth-batched paths per pass. A normal-charge fast path now skips unrelated gate-wide CSS/WebGL presentation writes.
- Browser validation covered desktop `1280x720`, mobile `375x844`, `77%` charge, the full-meter handoff, tail departure, U-turn progression, and zero positive horizontal overflow. A 3-second desktop CDP sample at `77%` reduced `TaskDuration` from about `1.33s` to `0.65s` and `RecalcStyleDuration` from about `0.79s` to `0.05s`; these are local comparative samples, not a formal benchmark. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed.

### 2026-07-20 Kisara post-release flow and title-mask integration

- Added rollback checkpoint `a20782e` for the post-release highlight flow. Eye and pale-blade particles now follow an eight-segment angular spring chain: the source turns first, older particles follow delayed segments, and direction changes travel through the stream as an upward whip instead of splitting into two binary exhaust branches.
- Rebuilt the final parallax title-data composite into two passes. Interior cells render first and are clipped with the rasterized `Kisara` alpha mask via `destination-in`; neighboring ring cells render afterward with distance-weighted opacity, preserving controlled pixel erosion beyond the glyph edge.
- Changed the title-data Canvas from additive `lighter`/screen blending to sampled-color `source-over` compositing, reduced its oversized bounds, lowered it beneath the sharp gloss layer, and softened the external glow so the blocks read as title material rather than a separate transparent overlay.
- `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed. Exact final-stage visual acceptance remains pending user review in the local preview.

### 2026-07-20 Kisara liquid-title refraction pass

- Historical/rejected: this pass superseded the square-cell title presentation but was itself rejected after visual review because the still-visible CSS title plus a half-transparent 2D Canvas read as a plastic film, while four explicit post-mask curves read as four unrelated thin lines.
- Replaced pixel sampling with a reusable white glyph mask, a quiet rose material base, aligned `fight.jpg` sampling, and fine overlapping strips whose continuous phase creates liquid refraction without a rectangular overlay or visible scanline gaps.
- Added a damped pressure signal derived from actual pointer velocity, direction-change travel, and the existing particle whip. It drives a mirrored slanted pressure wave, restrained pink/blue contract veins, and four short post-mask energy threads that may cross the glyph edge without outlining the Canvas bounds.
- Initialized the liquid title at low idle strength immediately after release, reset all pressure/data state on section entry and blue-gate return, and removed the obsolete frequent pixel-read context option.
- Browser validation covered desktop pointer travel in both directions, section entry/reset, a second complete release cycle, and `375x844` mobile with zero positive horizontal overflow. Page warning/error logs were empty; `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed.

### 2026-07-20 Kisara WebGL liquid-title takeover

- Kept `ba82ee4` as the rejected-overlay rollback point and removed the 2D title-data Canvas from the active final-stage rendering path.
- Extended the existing WebGL title-lens shader with final-flow uniforms driven by the established post-release phase, pressure, direction, flow-front, and parallax states. The shader now displaces the glyph texture itself, adds moving caustic/contract traces, modest chromatic separation, and broken sampled edge drag without fixed external lines.
- During the 880ms post-release intro, the CSS source title fades monotonically while the WebGL title becomes the sole visible glyph. Idle flow remains readable; pointer motion broadens the pressure field across multiple letters and visibly bends/compresses the word in the direction opposite the background travel.
- Fixed an entry flicker discovered during user testing: the residual burst RAF and post-release RAF were both writing title-lens/source state for several seconds. `updateBurstPresentation()` now stops calling `drawTitleLens()` once `postReleaseActive` owns the title.
- Desktop checks covered idle flow, both pointer directions, section entry, blue reset, and a second full release. A 60-sample entry audit recorded zero source-opacity reversals and one expected lens activation. Mobile `375x844` retained zero positive horizontal overflow. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed.

### 2026-07-20 Kisara reconstruction light restoration and flame-tip emission

- Corrected the reconstruction-light interpretation after visual review: the target is not extra exposure. The processed fight background is darkened by the atmosphere overlay and by the WebGL scene mix, while `fight.jpg` itself is deliberately bright.
- Added a clean fight-art layer above the dark atmosphere. A feathered radial mask shares the black-hole reconstruction center and easing, so the original image brightness is restored only inside the expanding data circle and remains fully restored in the post-release state.
- Changed the WebGL reconstruction cells to sample the raw fight texture instead of the darkened scene sample. This keeps the square-cell transition and the CSS reveal on the same image-level brightness rather than compensating with `brightness()`.
- Eye particles now reuse the three live outer-flame lobe tips as their spawn positions, begin on the late segment of the existing flow chain, and use a shorter birth fade. The particles therefore detach from the moving pointed flame edge instead of appearing at each eye's central bloom.
- Browser validation covered desktop mid/late reconstruction frames, full original-brightness restoration, parallax, return-to-blue reset, and a complete `375x844` release with no positive horizontal overflow. Page warning/error logs were empty; `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed.

### 2026-07-20 Kisara warning-to-singularity handoff refinement

- Compressed the procedural warning cross from roughly `1.48s` to about `0.65s` while keeping its rotation on one uninterrupted wall-clock curve.
- Moved black-hole ingress into the warning cross's final contraction and changed its opacity build to a fast ease-out. The singularity is therefore already established at the shared title-center impact point when the final cross rays disappear, instead of beginning a separate slow growth afterward.
- Started the restrained gravity blur and lens ingress slightly before the cross finishes, then shortened the monochrome focus tail so the warning hands control directly to the collapse stage without an empty visual pause.
- Rebalanced the remaining eight-second autoplay keyframes so collapse, shockwave, detonation, reconstruction, and particle rain retain their detail after the shorter warning.
- Browser validation covered the shortened warning frame sequence, a complete release, next-section entry, blue-gate reset, and a second warning cycle. The second cycle retained cross/lens overlap, `SIGNAL RELEASED / CONTINUE`, and zero positive horizontal overflow. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed.

### 2026-07-20 Kisara staged singularity entrance

- Replaced the single `blackHoleOpacity` entrance switch with separate core, disk, orbit-particle, and full-screen field curves. The central singularity can now take over before the accretion disk and particle system appear.
- Added a short implosion bridge behind the DOM warning cross: a contracting white-pink nucleus, an inward-moving elliptical ring, and eight bounded deterministic fragments converge on the existing title-center impact point.
- Rebuilt the disk entrance as a horizontal throw rather than a uniform scale-up. Its radius, thickness, opacity, halo, front/back bands, lens arcs, and highlights unfold from the core on the same bounded phase, with a brief bright ignition ellipse masking the handoff.
- Delayed orbit-particle emission and the broad gravity shade until their own entrance phases, and extended the monochrome focus tail only through disk ignition so color restoration no longer lands on the same frame as the shape change.
- During development, a temporary `blackHoleFade` declaration-order error stopped Canvas drawing; it was corrected before validation. Fresh reloads after the fix produced no new page errors.
- Browser validation covered aligned entrance frames, the complete eight-second release, next-section entry, blue reset, and a second staged entrance. Both cycles reached `SIGNAL RELEASED / CONTINUE` with zero positive horizontal overflow. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed.

### 2026-07-20 Kisara warning overexposure refinement

- Added a short-lived local exposure layer centered on the existing warning impact point. It uses a feathered radial mask and a bounded grayscale/brightness/contrast backdrop filter, so the scene clips locally around the cross instead of receiving another full-screen white wash.
- Added broad screen-blended bloom behind the four rotating cross rays and strengthened the procedural core's white/pink light only during the warning peak. The glow follows the existing uninterrupted cross rotation and does not add a separate rectangular cross asset.
- Added a thin elliptical shock ring with a bright inner echo and restrained dark outer edge. Its size, thickness, and opacity are driven by the existing cross build/release phases and fade before the staged black-hole field takes ownership.
- Browser playback reached the complete release state on repeated runs with no positive horizontal overflow. The current browser supports the localized backdrop filter; no new page error appeared after the previous fixed `blackHoleFade` timestamps. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed.

### 2026-07-20 Kisara reconstruction-to-liquid handoff

- Removed the plain-red title interval between full-screen data reconstruction and the final WebGL liquid state. The root cause was that reconstruction restored the CSS source title to full opacity while the post-release liquid pass applied a second smoothstep to an already eased `880ms` intro.
- Started the liquid shader during the final `58%` of the reconstruction sub-phase. The old gravity, rupture, and dissolve parameters fade out on the complementary weight while `finalFlow` rises, so the same title-lens Canvas morphs from reconstructed data into the liquid material without changing owners on a blank frame.
- Faded the CSS title source against the liquid handoff and made the completed post-release renderer begin at full title ownership. The highlight/particle Canvas still keeps its original restrained fade-in; only the title material handoff is immediate.
- Browser validation captured reconstruction, blended handoff, and completed liquid frames. Immediately before ownership switched, CSS title opacity was approximately `0-0.0032`; the second cycle peaked at only `0.3828` while the liquid Canvas was already active, then settled at `0`. Both cycles reached `SIGNAL RELEASED / CONTINUE`, page logs were empty, and there was no positive horizontal overflow. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed.

### 2026-07-20 Kisara fragmented warning shockwave

- Rejected the complete-ring warning treatment after browser review showed that the CSS ring, cross inner ring, and two Canvas ellipse passes combined into thick concentric white outlines with a pasted-on target appearance.
- Replaced the warning shell with three independent, non-closing conic-gradient arc fragments. Each fragment has its own radius offset, rotation, elliptic compression, opacity, and radial mask; a restrained soft pressure trail and one short white-hot center flash replace the previous full radial wash.
- Removed the DOM cross-ring element and made the four warning rays fade as the fragment wave expands. The monochrome scene is now deliberately darkened so the center and fragments remain the only strong highlights instead of turning the fight artwork into a broad white flash.
- Replaced the two later Canvas full-ellipse loops with deterministic short arc groups. Line widths are bounded near `0.7-2px`, and the fragments use limited glow instead of closed `lighter` rings.
- A failed intermediate fragment used dark normal-blended sectors at a radius near `1800px`, which appeared as rectangular black wedges inside the viewport. The final implementation bounds the DOM wave near the center, uses light-only screen-blended fragments, and keeps user source materials untouched.
- Desktop browser validation covered the warning peak, the later detonation, complete next-section release, blue reset, and a second same-tab warning cycle. The second cycle retained the same fragment size/state, no closed white rings or black sectors returned, and page warning/error logs were empty. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed.

### 2026-07-21 Kisara warning cross strike rhythm

- Split the warning cross into an independent three-beat action clock instead of inheriting the broad smooth interpolation used by the full eight-second release sequence.
- The cross now enters near full visibility within roughly `36ms`, completes a full `360deg` high-speed rotation in about `224ms`, holds its completed angle for about `96ms`, then retracts in about `160ms` with a short `12deg` reverse bite and a concentrated core/shard flash.
- Cross rays, shards, sparks, opacity, scale, and core light now share the same strike/hold/retract envelope. The warning arcs and singularity retain their existing timeline, so visual ownership transfers immediately after the cross retracts without extending the total autoplay duration.
- Browser frame sampling measured the first cycle at `98.842deg / 0.875 opacity` near `180ms`, `249.445deg / 0.879` near `267ms`, and the completed `342deg` endpoint (starting from `-18deg`) at `390ms`; the cross was effectively gone by `577ms`. A complete reset and second cycle produced the same `342deg`, full-ray hold state and `330deg` retracted endpoint. Page warning/error logs were empty; `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed.

### 2026-07-21 Kisara protected distortion seam blending

- Traced the visible character-mask outline to a displacement discontinuity: the solid protection path forced the subject to zero motion while adjacent pixels resumed substantial lens displacement across only the SVG's narrow blur halo.
- Kept the existing `fight-distortion-protect.svg` unchanged. The space-lens shader now expands its protection weight with bounded axial and diagonal samples, preserves a fully stable core, and eases exterior distortion in through a wider computed guard band.
- Replaced the transition band's single interpolated UV sample with a conditional dual-sample blend between the stable scene and softened displaced scene. Most fully protected or fully distorted pixels still use one scene sample; only the feather band pays for both, limiting the additional shader cost.
- Destination-mask protection now prevents displaced samples from folding back across the subject edge, and caustic, horizon, refraction, and alpha effects share the same softened distortion weight so secondary effects cannot redraw the old hard boundary.
- Browser playback confirmed WebGL remained in the `ready` state with the lens active through collapse. Screenshots around `2.35s` and `3.0s` of autoplay retained a stable face/body/weapon core while the surrounding hair, wings, and background continued to distort without the previous frame-like seam. `npm test` (3/3), `npm run build` (36 pages, sitemap, Pagefind), and `git diff --check` passed. Exact FPS sampling was unavailable in the browser's read-only evaluation surface; visual playback showed no new fallback or obvious hitching.

### 2026-07-21 Kisara detached blade warning redesign

- Superseded by the later `d112f11` restoration pass; retain this section and `260ac46` only as rollback references for the rejected detached-blade direction.
- Replaced the rejected regular cross, complete rings, broad exposure wash, and dot sparks with one procedural strike assembly: four unequal black/silver/pink blade traces, four small fragments, and an irregular near-black core.
- The blades no longer share a rigid center axle. Each uses a different orbit angle, radius, local tilt, size, and vertical offset; the existing high-speed action clock rotates the detached array, then a single fold offset pulls every trace into the black core before the Canvas singularity takes over.
- Kept the warning inside the existing eight-second release timeline. No independent timer or animation loop was added, and the black-hole ingress still begins at the established handoff boundary.
- Rejected a full-layer interpolated `invert()` after browser frames showed a gray-white flashbang intermediate. The final warning keeps the scene dark and monochrome, raises contrast briefly, and uses two bounded diagonal difference-blend cuts plus a focused center pulse for the negative-image strike.
- Rollback checkpoints are `7d6c61b` (first blade replacement) and `a91f64e` (dark contrast / segmented negative pass).
- Browser validation covered desktop `1280x720`, mobile `375x844`, complete release, next-section transition, blue reset, and a second same-tab warning cycle. Both viewports retained zero positive horizontal overflow, warning variables reset to zero, and page warning/error logs stayed empty. Final verification passed `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind).

### 2026-07-21 Kisara July 20 warning restoration and exposure pass

- Used `f754c06` from `2026-07-20 20:13:10 +0800` as the exact visual baseline instead of reverting whole files. Restored the old procedural DOM assembly: one small broken ring, four unequal black/white tapered rays, four shards, four sparks, and the concentric black/white/pink core.
- Kept the current eight-second autoplay, subject-protection mask, WebGL lensing, black-hole renderer, reconstruction, and post-release interaction. The warning alone now starts at `144ms`, finishes its eased `360deg` turn by `344ms`, holds for about `56ms`, and retracts by `536ms`; black-hole ingress overlaps the final retraction instead of growing after an empty pause.
- Removed the rejected detached blade, difference-cut, and large masked exposure presentation from the active DOM. The warning still darkens/desaturates the scene for focus, but overexposure now raises brightness and contrast on the real gate visual. Only the compact procedural core and short flare draw white light, so no ellipse, rectangle, or full-screen white overlay boundary remains.
- Rollback checkpoints are `260ac46` for the detached-blade version, `556a90e` for the first restored-cross pass, and `d112f11` for the final original-scene exposure treatment.
- Browser validation covered repeated desktop `1280x720` releases, next-section entry, blue reset, a same-tab second cycle, and a complete mobile `375x844` release. Desktop and mobile retained zero positive horizontal overflow, the warning handed off at the title center, release completed at `SIGNAL RELEASED / CONTINUE`, and page warning/error logs were empty. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed.

### 2026-07-21 Kisara interlocking seal-chain pass

- Replaced the rejected energy-bar/flat-chain direction with three Canvas seal chains: one shallow outer loop plus two alternating weave paths that pass in front of and behind the live `Kisara` title.
- The outer loop is no longer a deep ellipse around the title. Its front and back arcs are compressed into a shallow perspective band inside the glyph bounds; the back arc is slightly narrower/smaller and renders first on the lowest Canvas layer, while the front arc renders last above every weave chain.
- Chain entry now travels from outside the path with Canvas-edge and path-distance feathering, removing the hard crop at the left boundary. Cold and hot metal sprites are cached separately and cross-faded with a moving heat front, so the chain no longer switches to red in one frame.
- Tightening removes slack through a direction-aware take-up wave and one bounded lock impulse instead of repeated whole-path scaling. Rupture opens one-link gaps, moves each side as a coherent weighted segment, keeps only the outer loop's split-link pieces, and uses restrained local sparks instead of independently scattered links, a heart icon, or a white energy ball.
- Rollback checkpoints for this pass are `e95f128`, `fce7b00`, `347ab07`, and `2efba36`. The final shallow-depth refinement passed `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind); the in-app preview retained zero positive horizontal overflow and no page warning/error logs.

### 2026-07-21 Kisara glyph-adaptive weave height

- Fixed the weave paths using one full-word cap height for every crossing. `rebuildTitleChainLayout()` now reads each `Kisara` glyph's Canvas `actualBoundingBoxAscent` and `actualBoundingBoxDescent`, maps the metrics onto the existing title bounds, and blends neighboring glyphs into seven local anchor bounds.
- `resolveTitleChainPath()` now applies each chain definition's insets against the local anchor height. The `i/s` and `a/r` arches therefore sit at their surrounding lowercase height instead of inheriting the tallest glyph, while Catmull interpolation keeps the transitions continuous and the established front/back draw order unchanged.
- Browser metrics confirmed the old mismatch (`K: 122`, `i: 133`, `s/a/r: 88` ascent units). Same-tab reload reached `INNER BIND / INTERLOCKING`, both chain canvases remained visible, and positive horizontal overflow stayed at zero. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed.

### 2026-07-21 Kisara rupture and contract-heart restoration

- Traced the weak rupture presentation to two concrete issues: broken-ring pieces were only drawn for the outer frame, and their dark metal outline inherited `screen` compositing, which visually erased most of the fragment body. Broken pieces now reuse the cached chain-link metal sprites for all three chains under normal compositing, then add only the hot fracture edge and sparks with `screen` blending.
- Reworked the break motion into a short staggered snap with stronger tangent recoil, normal kick, and visible half-link rotation. A later three-link group wave travels from each break point toward the chain ends, keeping neighboring links coherent while letting the final chain mass separate and extinguish instead of fading as one rigid strip.
- Restored the love motif using the procedural heart geometry from historical checkpoint `4b294ff`, but did not restore its rejected diamond, oversized glow, or sticker-like afterglow. Three break-point tethers press a compact contract heart into the title center; the mark gains a central crack, separates into two clipped halves, and emits a bounded set of directional fragments.
- Current rollback point before this pass is `738e0e8`. Same-tab mobile preview showed the snap, heart formation, split, and grouped chain breakup with zero positive horizontal overflow. A 2.4-second animation sample recorded 301 frames, `p50 5.6ms`, `p95 16.7ms`, and `max 22.3ms`. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed; exact visual acceptance remains pending user review.

### 2026-07-21 Kisara immediate chain crush and fine shatter

- Removed the 100% handoff pause. The wheel event that raises `targetProgress` to full now calls `startChargeIntro()` in the same frame, so the gate no longer waits for the damped fill spring or another wheel input before beginning the seal break.
- Replaced the direction-by-direction take-up prelude with a short global inward pull and earlier lock impulse. All three chains visibly tighten at once and enter rupture immediately instead of pausing to gather strength.
- Removed coherent broken-segment motion from the active render path. Each complete link now disappears almost immediately after its local fracture starts and is replaced by four mobile or six desktop metal shards emitted from points around that link's elliptical rim. The shards inherit radial, tangent, and normal velocity, rotate independently, travel in multiple directions, and fade as particles rather than leaving large chain sections to vanish in place.
- Replaced the previous split-heart treatment in the active draw order with a compact contract-heart imprint, short break-point tethers, a lock pulse, inward collapse, and bounded fine particles.
- Changed the ordinary blue-to-red tide into a worn seal red: low-saturation wine/crimson gradients, restrained patina flecks, and fine directional wear remain visible through normal scroll charging. A new `--kisara-title-vivid` state stays at zero during that phase, then ramps during the chain/enchantment intro so the existing vivid pink-red returns only around the contract imprint.
- Rebuilt the cached chain-link sprites without changing their paths or timing. Every visible link now uses a higher-resolution blackened-steel bevel with multi-stop cold/hot reflection, a dark inner wall, broken highlight arcs, contact shadow, and deterministic micro-scratches; the hot version remains predominantly dark metal with crimson reflection instead of a flat pink ring.
- Rollback point before this refinement: `3204f96`. Same-tab desktop replay validated the immediate `100% -> is-enchanting` handoff twice with `scrollY = 0`; timed frames showed fine shatter beginning around the first quarter-second and expanding across the title without large flying chain sections. Additional material checks sampled `--kisara-title-vivid` at `0` during roughly `68%` charge, `0` at the instant the seal intro began, about `0.86` during the imprint, and `1` after the transition. The page retained zero positive horizontal overflow and no browser warning/error logs. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, 36-page Pagefind index) passed.

### 2026-07-21 Kisara custom page scroll rail baseline

- Hid only the Kisara document's native page scrollbar while preserving normal document scrolling and the separate scroll behavior of theme panels, code blocks, and mobile filter rows.
- Added a fixed contract-signal scroll rail to `KisaraLayout.astro`. Its pink/blue energy marker follows document progress, supports pointer dragging, track jumps, and keyboard Arrow/Page/Home/End controls, updates after resize/BFCache restoration, and disappears when a page has no scroll range.
- Prevented text selection and native drag behavior across the home gate performance plus visual assets (`img`, `picture`, `canvas`, `video`, and `svg`) without disabling selection in article prose or code content.
- Desktop browser checks at `1280x720` confirmed native scrollbar width `0`, zero positive horizontal overflow, title `user-select: none`, empty selection after double-clicking the title, article prose `user-select: auto`, and synchronized `0 -> 100` rail progress. The original home wheel gate still held `scrollY = 0` while charge fill advanced. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed.

### 2026-07-21 Kisara gate-aware scroll rail

- The right-side rail now switches from an interactive document scrollbar to a read-only contract progress indicator while the home gate owns the wheel. The gate publishes a cached `kisara:gate-progress` event plus DOM dataset fallback, and `KisaraLayout.astro` restores the normal draggable/keyboard scrollbar as soon as the page transition begins.
- The complete gate timeline is mapped into stable sections: scroll-driven chain binding uses `0-45%`, chain rupture/enchantment uses `45-55%`, the manual blade/gloss release uses `55-65%`, and the eight-second automatic release uses a real elapsed-time clock for `65-100%`. This avoids the internal nonlinear `burstProgress` jumping the public indicator above `90%` near the start of the black-hole sequence.
- Rail presentation follows the dominant visual stage without adding a second large effect layer: cold blue chain stages warm into crimson rupture/enchantment, the warning uses a tiny white strike, singularity/collapse use a compact orbiting dark core, detonation pulses white-hot, and reconstruction emits three bounded data pixels.
- Desktop full-sequence sampling recorded `71 -> 77 -> 83 -> 89 -> 95 -> 100` through collapse, detonation, and completion. Mobile `390x844` retained zero positive horizontal overflow, hid the native scrollbar, cleared the bottom navigation, and replayed from `0 -> 4%` after returning to the gate. Desktop warning-stage inspection showed the rail at `66%` with the expected white strike; page warning/error logs were empty. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed.

### 2026-07-21 Kisara read-only rail guidance and return sync

- Used `67bd289` as the rollback point. Removed the custom rail's pointer drag, track jump, and dedicated keyboard handlers; it is now a read-only `progressbar`, while native wheel, touch, and page keyboard scrolling remain available.
- Added a manual-input hint beside the live rail marker rather than over the hero artwork. Two larger blue/pink chevrons follow the thumb, appear during scroll-driven charge, manual blade release, and the completed `SCROLL DOWN / ENTER CHANNEL` state, then hide during chain-break and eight-second automatic playback.
- Replaced the return-to-gate rail handoff with an explicit `returning` state. The spring-scroll callback publishes the real document progress on every frame, so the marker cools to blue immediately and travels continuously back to zero before returning to the `awakening` state.
- Desktop return sampling recorded `22 -> 10 -> 3 -> 1 -> 0` while the rail stayed blue and in gate mode; the final frame switched from `returning` to guided `awakening` without a red hold or position jump. Mobile `390x844` retained zero positive horizontal overflow and kept the guide beside, not over, the rail. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed.

### 2026-07-21 Kisara protected-core clarity pass

- Traced the remaining softness inside the subject mask to two mismatched rendering paths: the CSS protection image was still translated and gravity-scaled while the WebGL protection texture stayed in the original cover coordinates, and both the SVG plus shader widened the feather.
- Re-aligned the CSS protection layer with the WebGL scene at viewport cover coordinates, removed its gravity transform, made the inner SVG path solid, narrowed the outer feather, and added an explicit WebGL alpha cutout over the solid protected core. The protection now reaches full opacity as the warning begins rather than waiting for collapse.
- Desktop `1280x720` replay sampled the strong-distortion frame near `87.8%`: the surrounding scene retained about `3.72px` performance blur while the protected layer stayed at opacity `1`, identity transform, and no local blur. The face/body linework remained visibly sharper without restoring the previous hard mask outline. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed.

### 2026-07-22 Kisara maskless side-field distortion

- Superseded the character-shaped `fight-distortion-protect.svg` compositing path after repeated human-visible seams, empty guard bands, and duplicated edge texture. The asset remains untouched for rollback/reference, but the home performance no longer loads it into the DOM or WebGL renderer.
- The middle third of the viewport is now a continuous stable field while only the left and right fields receive lens displacement. The transition weight follows the real distortion field and viewport-edge fade, and the shader samples one interpolated UV instead of blending stable and displaced texture samples that produced ghost copies.
- The space-lens canvas now crossfades as one complete scene-replacement layer. Its shader no longer bakes in the atmosphere overlay already supplied by CSS, so the same scene is not darkened or composited twice around the former mask edge.
- Removed the warning stage's dynamic elliptical aperture and local oval highlight. The black/white cross now sits over a borderless full-screen vignette, leaving no character-mask or focus-ring outline to expose during the high-contrast flash.
- Extended the fifth memory scene through the chain rupture/contract-heart beat, then hands off to the fight artwork with a soft blur settle instead of cutting directly from the kiss frame to a sharp image.
- Desktop replay covered the warning frame, active lens/collapse frame, detonation, reconstruction, and final post-release state. The protection DOM/variables were absent, WebGL entered and exited its active state normally, positive horizontal overflow stayed at zero, and browser warning/error logs were empty. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed. Fine visual acceptance remains with the user on the local display.

### 2026-07-22 Kisara interactive release finisher and smoke reveal

- Commit `4ed5efd` replaces the latter locked cutscene with a release state machine (`manual`, `forward`, `rewinding`, `paused`, `complete`). First autoplay is `3000ms`, later same-tab runs are `1750ms`, downward wheel input can boost playback to `1.8x`, and an early upward input rewinds under a short veil to a resumable blade-stage pause. Once detonation is unsafe to reverse, upward input accelerates completion instead.
- The progress rail now follows autoplay rate, visual pressure, release mode, and rewind state. Release rewind clears transient orbit, burst, rain, Canvas, and WebGL residue before pausing; the completed camera beats reset to identity before the next section.
- The fight-art handoff is now hidden behind a dense procedural smoke field. The manual title gloss sweeps from right to left; fight opacity, blur, brightness, saturation, and smoke dispersal share that blade timeline. The first half remains almost fully obscured, while the latter half clears on one continuous curve instead of a threshold pop.
- Removed the rejected full-rectangle fog base, animated parent blur, and moving `mask-image` after human review found a gray slab sliding left plus possible black compositor flashes. The replacement uses one oversized feathered elliptical veil and three independently fading/moving smoke banks: right clears first, center second, and left last. No parent mask or parent filter remains.
- Added a low-frequency pink energy leak around the fight artwork's upper-body area between the base veil and foreground smoke banks. The stronger core remains partially occluded by real smoke alpha, briefly rises as the blade begins to expose the scene, and fades before the smoke fully clears; its animation changes only opacity/transform, avoiding repeated large filtered-surface reallocations.
- Automated browser checks used the existing single local preview tab only. The pre-blade state reported fight opacity `0.008`, blur about `31.55px`, smoke opacity `0.99`, veil opacity `0.96`, and aura opacity `0.64`; computed parent `mask-image` and `filter` were both `none`. A later sample showed the right bank at `0`, center near `0.12`, and left near `0.66`, confirming staggered non-rectangular withdrawal. The page warning/error log was empty. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed. Fine smoke density, glow strength, and perceived transition quality remain pending user judgment on the local display.

### 2026-07-22 Kisara original transformation scenes and continuous lensing

- Superseded the procedural fight-smoke handoff with three user-selected original frames. Source files `kisara/6.png`, `7.png`, and `8.png` remain untouched; 1920x1080 WebP runtime copies now form the `smoke-wide -> detail -> silhouette` bridge between the kiss memory and reconstruction.
- Split the WebGL space-lens inputs into a pre-release texture and a reconstruction target. Frame `8` is the only artwork distorted through warning, collapse, and detonation; `fight.jpg` is introduced by the existing block-reconstruction front and becomes the stable background only near completion.
- Returned the lens to a full-frame gravity field now that the final fight subject no longer needs protection. Removed both sign-based half-screen polarity and non-periodic `atan()` phase terms after they produced visible vertical and horizontal split lines; the active displacement now uses continuous direction-vector components across the viewport. The user visually confirmed the seam-free result before the idle-motion pass.
- Frame `8` enters with an additional `10.5px` blur. The manual blade sweep continuously removes that blur, restores brightness, and increases its local scale from `1` to `1.022`, creating a restrained push through the smoke before the warning starts.
- Added an automatic scene-camera breath to every pre-fight image stage, including the initial blue artwork, all five memories, and frames `6/7/8`. The current refinement increases the travel and scale range while lowering the secondary frequencies, producing a broader continuous drift instead of a small fast tremor; the envelope still fades through reconstruction and reaches zero for the final fight state.
- Rollback point before the larger-breath/edge-coverage refinement: `4abbc00 Add Kisara pre-fight scene breathing` (`603abbc` remains the transformation-sequence baseline). Per-frame overscan now derives the minimum scale from the live X/Y camera translation and adds a three-CSS-pixel guard on every moving edge, preventing compositor rounding from exposing the viewport boundary. A six-second, 60-sample run in the existing preview tab recorded 60 distinct camera states, at least `3.14px` of bottom coverage, and about `3px` minimum coverage across all four edges; exact one-pixel visual acceptance remains with the user. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed after the final guard increase.

### 2026-07-22 Kisara theme audio signal

- Rollback point before this pass: `501f22a Refine Kisara scene breathing overscan`. Added a theme-wide `KisaraAudioControl.astro` mounted by `KisaraLayout.astro`, so every Kisara route exposes the same compact lower-left control for `対策完了`. The source under the untracked user-owned `kisara/` directory remains untouched; the deployed copy uses the ASCII path `public/themes/kisara/audio/taisaku-kanryo.mp3`.
- The control attempts audible playback immediately at `48%` volume, loops the track, and falls back to an explicit `READY / PLAY` state when browser autoplay policy blocks sound. Click/touch/keyboard interaction retries playback; the same button pauses without resetting time and resumes from that position. Per-tab `sessionStorage` preserves the enabled flag and current time across Kisara document navigation, while avoiding a forced SPA conversion that could destabilize the homepage performance runtime.
- Playback state drives the UI rather than a timer: active audio enables the orbit, scan, pulse, and equalizer animations; pause removes those animation names immediately. Runtime checks confirmed `readyState = 4`, successful click playback with increasing media time, stable media time after pause, and paused-state restoration at the same timestamp after navigating to Blog. Full-document navigation can still require one fresh interaction when the browser reapplies audible autoplay policy. Browser warning/error logs were empty. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed; exact lower-left visual sizing remains pending user review.
- Human review rejected the first framed-card treatment as too conspicuous and disconnected from the scene. Using `ffa8b7b Credit Yuimi and Codex on Kisara gate` as the rollback point, the control is now a frameless lower-left audio signature: the standalone play/pause glyph, five-bar micro waveform, dim two-line label, and one animated signal filament are the only persistent shapes. The former rectangular panel, border, inset background, circular emblem, orbit, and scanning slab were removed; hover adds only a feathered local aura. Playback, pause, autoplay fallback, session persistence, and volume behavior are unchanged. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed; final visual acceptance remains with the user on the local display.

### 2026-07-22 Kisara persistent playlist

- Rollback point before this pass: `00349e9 Restyle Kisara audio control`. Expanded the theme player from the single `対策完了` track to an eight-track playlist by adding seven user-provided songs; `ココロスペアキー.mp3` remains excluded. Runtime copies use ASCII filenames under `public/themes/kisara/audio/`, while the untracked source directory `kisara/` remains untouched.
- Added restrained previous/next controls, automatic advancement at track end, live `NN / 08` status text, and track-aware accessible labels without restoring the rejected framed-card presentation.
- Replaced per-tab playback memory with `localStorage` key `yuimi-kisara-playlist-v2`, preserving the enabled/paused state, active track, and playback position across reloads and later visits. Existing `sessionStorage` state under `yuimi-kisara-audio-v1` is migrated once when no new state exists.
- Runtime verification switched to `愛の力`, paused near `23.28s`, reloaded, restored the same track and timestamp, and resumed forward from that point. Final inspection left `合鍵` paused near `59.70s`; browser warning/error logs were empty. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed.

### 2026-07-22 Kisara warning cold-start prewarm

- Rollback point before this pass: `21f7848 Add persistent Kisara playlist`. Traced the first-run-only hitch around the black/white cross to cold compositor/filter activation plus the first WebGL and singularity-buffer work; the same sequence was already smooth after those resources had been cached once.
- Kept the cross in the render tree at zero opacity instead of revealing it through a first-use `visibility` switch. During the first idle window, the page now briefly prewarms the warning filter layers, executes transparent draws through both WebGL lens pipelines, and allocates the singularity field buffer before the automatic release reaches that stage.
- Cached the gate width and height once per presentation frame so later warning-variable writes no longer interleave with repeated root layout reads. The animation timing and visible parameters remain unchanged.
- A cold reload confirmed both WebGL renderers reached `ready`, returned to an inactive transparent state after warming, and produced no browser warnings/errors. The user then confirmed the refreshed first trigger no longer felt stuck. `git diff --check`, `npm test` (3/3), and `npm run build` (36 pages, sitemap, Pagefind) passed.
