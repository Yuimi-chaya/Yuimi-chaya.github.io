# Fuyukawa Presentation Refresh

## Scope

Theme-local supplement to the repository's `DEVELOPMENT_NOTES.md`. This file owns
only the September 2026 Fuyukawa presentation refresh; shared architecture and
Kisara history remain authoritative in the repository note, which is not edited.

## Current State

- September 24 publication: `main` fast-forward pushed `f6768f4..194f6ba` (10 commits) to `origin/main`; `git ls-remote` matched local `194f6ba` afterward. The range includes earlier Kisara and blog-cover commits as well as Fuyukawa work. Uncommitted root notes, responsive-cover manifest and user media were not staged or pushed. No browser, CI or deployed-site verification was performed.
- September 24 correction on `main` at `2e74563a9fa8e743fd562f094f07b37f003ee63f`: user meant Kisara's outline-and-pen reveal only, explicitly retaining Fuyukawa's original title font. The prior Georgia Italic outline was the wrong typeface despite matching the requested motion mechanism. Original CSS used `"Segoe Print"` at weight 700; local `segoeprb.ttf` is the matching 2048-unit bold face. The known generated asset (old SHA-256 `fe78e689b639c8508bd6b252a991694278ca3dad87773107151e9f80adfc62b6`) was replaced with Segoe Print Bold outline (new SHA-256 `2a74d459851789d80e111355902c74d0c5ccd5452dd15fc766da3152df48dd7c`), keeping the 52px copy lift, dark ink/white rim/pink shadow and the same 18-stroke SVG pen-mask reveal. Offline 904px candidate loses 122/53,584 solid pixels (0.23%) against the unmasked font and adds none. Fuyukawa tests 42/42 and direct Astro build 78 routes / 79 Pagefind pages pass; Home HTML remains 99,985/100,000 bytes and the built title asset returns HTTP 200. The generator is idempotent after replacement and checks Segoe Print's Bold subfamily; no runtime font dependency. Other themes, original art and unrelated dirty media remain untouched. No browser/subagent used; actual pen timing and typeface feel await user acceptance. Logs: `%TEMP%/fuyukawa-title-print-{theme,build}.log`.
- Scoped checkpoint: `fix(fuyukawa): trace the original handwritten title face`, five Fuyukawa-only files. Pushed in the range above.
- Historical, superseded typography: the previous Home title follow-up baked Georgia Italic into `assets/hero-title.svg` and passed theme tests/build and Fuyukawa budgets, but the user explicitly rejected its typeface. Its code recovery point is `2e74563`; do not reuse that title outline. The 52px desktop copy lift and mobile 118/123px top offset remain requested. Repository test/budget failures from unrelated responsive-cover media remain separate.
- Scoped local checkpoint: `style(fuyukawa): trace baked home title and raise hero copy`, seven Fuyukawa-only files. Not pushed.
- Current flower interaction follow-up starts from `ce6f2bd137ef4b1c070ee516615be5875c3b0b4f`; Fuyukawa tree was clean, unrelated root note, responsive-cover manifest and user media dirty. User screenshot identifies the Home avatar flower as hard to catch and seemingly immobile. Confirmed source cause: 28x50 hit box was narrower than the bloom; angle was normalized against the full avatar so hovering the flower yielded very little rotation, then a 620ms transform transition dulled feedback. A 64x64 transparent target preserves the bloom/stem/leaf artwork positions (including its leaf and rotation pivot); flower-local hover and pointer-captured drag give direct bounded sway, with release/cancel/navigation cleanup and reduced-motion handling. Focused manga tests 15/15 pass; direct Astro build 78 routes / 79 Pagefind pages passes, generated Home contains the flower marker and 64px/docked pointer rules. The local dev server serves the themed Home with HTTP 200 on port 4321. Repository tests 319/320 pass: unrelated dirty responsive-cover manifest now has 36 sources while `tests/media-optimization.test.ts` still asserts 24. Do not alter that separate task to force green. No browser/subagents used; actual feel remains for user acceptance. Logs: `%TEMP%/fuyukawa-flower-{focused-final,repository,build-final}.log`.
- Flower change has a scoped local checkpoint under `fix(fuyukawa): make avatar flower easy to flick`; only five Fuyukawa files were staged. Nothing was pushed.
- September 23 visual follow-up: the user's Home/Blog screenshots show two different nav treatments, not merely a background-contrast difference. Confirmed cause: the common `refresh.css` owns the Home pill but `refresh-pages.css` added an inner-page-specific override to its fill, border, blur, shadow, and pseudo highlight. A first attempt to retint that override was rejected by the user before commit; it was removed. Inner pages now inherit the exact same shared pill rules as Home, keeping centered placement and the transparent header band. Focused tests 14/14, repository tests 320/320, direct Astro build 78 routes / 79 Pagefind pages pass. Built Home and Blog share `index.BSXH5lnB.css`; Blog's additional `refresh-pages.CDFBwtrp.css` has no nav/header selectors or old white gradient. No browser or subagent used; human visual acceptance remains pending. Logs: `%TEMP%/fuyukawa-nav-shared-{tests,build}.log`.
- September 23 follow-up on `main` at `cdc662da2ea4dd72cbf27cb4d5356e1124b22acc`: Fuyukawa tree clean; root note and unrelated media dirty. User now requests one consistent portrait cover package for Home/Blog, using Kisara's 7:10 crop ratio and focal positions, plus visible liquid-glass navigation on inner pages. This supersedes the earlier `contain` preference, but not the objection to landscape frames cutting portraits. Kisara remains read-only. The shared Fuyukawa 7:10 poster style now uses inset mat, thin edge and `cover` at `50% 32%`; only cover-08 emits its `50% 30%` override. Existing responsive source sets remain. Non-Home pages load a higher-specificity pill-only glass layer with highlight, stronger blur and edge/shadow; the transparent header band and centered navigation remain. No source images changed.
- Final non-browser verification for this follow-up: focused Fuyukawa tests 40/40, repository tests 320/320, direct Astro production build 78 routes / 79 Pagefind pages, Fuyukawa generated-page audit 19 pages / 178 images / 163 theme links. Build markup has 3 Home and 13 Blog poster frames; only one blog frame outputs the exceptional focal style. Home does not load inner-page CSS; Blog and sample article do. Existing 4321 Home/Blog/Games/article routes return HTTP 200; no browser or subagent used. Human evaluation of crop focus and glass feel is pending.
- Numeric performance limits pass unchanged, including Fuyukawa Home HTML 99,925 / 100,000 bytes and CSS 103.2 / 109.4 KiB. The budget command still exits nonzero solely because current public source covers and Kisara reviewed candidate art are copied into `dist`, a pre-existing unrelated media exclusion failure; do not move/delete user materials as part of this theme request. The first implementation emitted redundant default inline focus on three Home covers and exceeded the tight HTML limit by 81 bytes; this was corrected by relying on the CSS default and removing a redundant class. Logs: `%TEMP%\fuyukawa-cover-glass-{focused-final,repository-final,build-final,budgets-final}.log`. Build/test processes exited.
- Scoped local implementation checkpoint: `857d8020744893e0c9ba2141b7d66bc47ef247c8` (`style(fuyukawa): unify portrait covers and inner-page glass nav`), seven theme-only files. Not pushed. The pre-change `cdc662d` remains available; unrelated root note and media were not staged.
- September 23 follow-up on `main` at `706a44cc71783afa71b08162d5ee6402ccf18edb` starts from a clean Fuyukawa tree. The user reports an article TOC stuck at the article start, a hard lower edge on the separated Home character, and an invisible daily-notice close glyph. The unrelated root note and untracked media remain untouched; browser/subagents remain prohibited.
- Confirmed stylesheet causes: legacy `body { overflow-x: hidden }` creates a non-viewport scroll container for the article TOC's `position: sticky`; the layered hero front image has no own lower-alpha transition; refreshed notice CSS hides the legacy glyph with `font-size: 0` and disables its `::before` icon. Fix only the article body overflow (except while notice-locked), the foreground image mask, and the notice button typography.
- September 23 implementation: `refresh-pages.css` uses `overflow-x: clip` only on article body outside notice lock, preserving viewport sticky; `manga.css` masks only the independent front image over its lower 24% while keeping foreground/backplate files and the overall hero blend unchanged; `refresh.css` restores a visible `×` glyph and foreground stacking in the notice close button. Focused theme tests 40/40 and repository tests 320/320 pass. Direct Astro build completed 78 routes / 79 Pagefind pages, and the Fuyukawa generated-page audit passed 19 pages / 178 images / 163 local links. Built CSS includes all three effective rules; existing 4321 Home and article HTTP routes return 200. No browser or real visual verification was performed.
- Budget check: all numerical limits pass, including Fuyukawa Home HTML 97.5/97.7 KiB and CSS 102.8/109.4 KiB. The command still exits nonzero because the current repository's public assets copy the checker-excluded reviewed source covers and Kisara candidate art into `dist` (see `scripts/check-performance-budgets.mjs`); none are modified by this task. Do not delete user source media to make the checker green. Logs: `%TEMP%\fuyukawa-sept23-{focused-final,repository,build}.log`; test/build processes exited. Human assessment of sticky behavior and fade feel remains pending.
- Scoped local code checkpoint: `3058d22bfa558f67a1868868996e297612851915` (`fix(fuyukawa): restore article index and home controls`); only five Fuyukawa source/test/note files. Not pushed. The pre-fix `706a44c` remains the recovery point; unrelated working-tree changes were not staged.
- September 9 follow-up: the user approves the overall manga direction and asks
  for five localized corrections: clipped utility drawer/player, sakura petals,
  Live2D leaving the viewport after scrolling, oversized About game thumbnails,
  and low-contrast Home lettering. This is not blanket acceptance of every edge.
- During the follow-up the user rejects the first new petal as an elongated heart
  and too transparent. Superseded: deep symmetric notch, 1.32-height frame,
  narrow .35 flutter scale and compounded .26-.59 opacity. Current correction:
  side-edge shallow notch (not a central heart cleft), square frame,
  .7-1 flutter scale and .79-.98 steady
  combined opacity. Earlier candidate is backed up outside the repository at
  `C:\Users\a1234\Desktop\codex-backups\fuyukawa-utility-20260909\petal-heart-candidate.svg`.
- Recovery point for this follow-up: `2c73400aa95135ec6c741f734c1c5aa698125931`
  (code milestone `787fa0c`); theme clean before edits. Preserve unrelated root
  note/media changes. Main agent only; browser/subagents remain prohibited.
- Confirmed causes: drawer keeps intrinsic grid row sizes inside a max-height
  scroll area while hiding its scrollbar; mobile top offset is not included in
  that height. About game cards specify columns without `display: grid`, so their
  full-width images ignore the intended thumbnail column. Home white lettering
  has insufficient separation from white manga panels.
- Live2D's own theme rule does not define fixed positioning or hidden/active
  states; it relies on dynamically injected external CSS. That stylesheet is not
  persisted across Astro head swaps. Pinning/state styling will be theme-owned.
  The exact user scroll sequence is not browser-reproduced.
- Implemented utility follow-up: viewport-bounded, visibly scrollable drawer;
  compact record deck and native icon/range controls; corrected muted-volume UI;
  theme-owned Live2D fixed/hidden states, bounded pointer drag, stale async/hide
  guards and stylesheet reattachment after swaps; 92x64 contained game thumbnails;
  dark handwritten title interiors with white stroke. Final verification passes
  38 theme tests and 181 repository tests, direct Astro production build (74
  routes / 75 indexed pages), and all 17 unchanged performance budgets. Home HTML
  is 96.7/97.7 KiB and CSS is 102.5/109.4 KiB.
- The generated CSS audit caught Astro's higher-specificity scoped About rules
  overriding some global thumbnail declarations. Game card geometry now has one
  owner in `AboutPage.astro`; the old conflicting image rules were removed. Do not
  reintroduce competing image sizes in `refresh-pages.css`.
- Built-output audit: 18 theme pages / 172 images / 77 inline scripts / 154 local
  links / 57 stylesheets pass, plus an explicit emitted scoped-CSS assertion for
  92x64 contained game thumbnails. Existing 4321 routes/CSS/final petal return 200.
  The existing server (PID 23024) was not restarted. Build/test processes exited.
- A 168x168, 9188-byte offline raster review of the final petal is at
  `%TEMP%\fuyukawa-petal-final-review.png`; it is not a browser screenshot.
  Source art hashes, hero layer pixels and prior cover/header tests still pass.
  Logs: `%TEMP%\fuyukawa-utilities-{focused,repository,build}-final.log`.
- This follow-up is implemented and non-browser verified. Human acceptance of
  the revised petal and actual drawer/drag feel is pending; no browser or subagent
  was used. Root notes retain their unrelated 457-line addition; other themes and
  original media are untouched. Scoped checkpoint subject:
  `fix(fuyukawa): polish viewport utilities and sakura petals`. Nothing is pushed.
- Code checkpoint created: `911fa6fd2bef6e6900b1b0dadfc04340d81d7b54`,
  10 theme-only files. Scoped staging and whitespace checks passed; the previous
  `2c73400` recovery point remains available.
- Requested: refresh every Fuyukawa page and section with a fresh anime aesthetic.
- Main agent only. Edit only `src/themes/fuyukawa-kagari/` and its dedicated
  `public/themes/fuyukawa-kagari/` assets.
- The user explicitly prohibits browser and subagent use in this task without
  permission. Source, fixture tests, build and HTTP checks are not visual acceptance.
- Original refresh baseline: `main`, `4fba1e1663f24a1f0e4f71e03c1575fbf0c36abc`.
  The layered manga iteration starts from `671b016`; see the final section.
- Original theme copied to
  `C:\Users\a1234\Desktop\codex-backups\fuyukawa-refresh-20260909-001424\fuyukawa-kagari`.
- Existing root note edits and untracked media are unrelated and must stay intact.
- Existing preview: `http://127.0.0.1:4321/themes/fuyukawa-kagari/`.
- Presentation uses a theme body attribute and a final stylesheet so legacy
  interaction styles remain available. No shared configuration or assets changed.
- Preserve the homepage reveal state machine, tag canvas, music and Live2D.
- Blog search now rejects stale async results and reinitializes after navigation;
  project filters reinitialize after navigation and expose pressed states.
- Revised implementation and non-browser verification are complete; visual
  acceptance remains pending. Local checkpoint subject:
  `style(fuyukawa): renew anime diary pages and utilities`. Nothing is pushed.

## September 9 Review

- The first green/minimal candidate was rejected by the user. It loaded correctly
  in their screenshot but looked too generic, with a heavy green title and a
  partially exposed tool drawer. Do not call this an accepted visual direction.
- The revision uses a handwritten white/sky title with pink offset detail,
  translucent navigation, pastel paper edges on individual entries, and a fully
  concealed drawer with a visible icon handle. Original media remains untouched.
- Pre-revision snapshot:
  `C:\Users\a1234\Desktop\codex-backups\fuyukawa-refresh-20260909-001424\before-anime-rework`.
- Vite on port 4321 cached the initial missing relative stylesheet import.
  Switching to the existing project alias restored both page and CSS HTTP 200;
  the file was present, and no user server was stopped.
- First-pass tests: 9 theme fixtures, 181 repository tests, 74 built routes and 75
  indexed pages passed. CSS exceeded the existing 112000-byte budget; superseded
  declarations and unused legacy sections were subsequently consolidated with
  PostCSS and selector parsing.

## Final Verification

- Theme fixtures: `node --test src/themes/fuyukawa-kagari/tests/refresh.test.mjs`,
  10/10, including drawer concealment, search races and route reinitialization.
- Repository tests: `npm test`, 181/181.
- Production: direct Astro build, 74 routes, 75 Pagefind pages. Asset generation
  was deliberately not run because no original image/music regeneration is needed.
- All 17 existing performance budgets pass without changes: Fuyukawa Home HTML
  96.5 KiB / 97.7 KiB; CSS 105.7 KiB / 109.4 KiB.
- Parse5 audit: 18 Fuyukawa documents, 125 image references, 78 inline scripts and
  150 Fuyukawa links checked, no missing local resources or script syntax errors.
- Original 4321 preview returns HTTP 200 for Home, Blog, Game, Works, About and a
  sample article. The themed 404 correctly responds with status 404.
- `public/`, shared data/configuration/routes, Kisara and Blank have no task diff.
  The root development note's pre-existing changes are untouched.
- Test/build logs: `%TEMP%/fuyukawa-refresh-{focused-final,tests-final,build-final}.log`.
  Test and build processes exited normally. No browser or subagent was used.
- Visual acceptance is still pending. Subsequent cover/header feedback and its
  corrections are recorded below; earlier automated passes do not imply approval.

## Cover and Header Correction

- User feedback on `97a78da6561078d5a96e6a2f3ca7880c0122872e`: Home and Blog covers
  cut off the subjects, and the user prefers a transparent centered header.
  This supersedes the earlier landscape-frame and opaque header decisions.
- Root cause: portrait sources were fitted with `cover` into forced 8:5 boxes.
  The screenshot's sources are 1003x1416, 1319x2000 and 1400x2207, respectively.
- Both listings now use stable 7:10 frames with centered `contain`, including
  square/landscape fallbacks. Images are not edited; old Blog crop offsets removed.
- Header band is transparent; equal side grid tracks place the glass navigation
  at viewport center independently of the brand. Narrow screens center only the
  navigation and omit the brand to avoid overlap.
- Recovery point: `97a78da`. Scope limited to Fuyukawa cover/header presentation,
  targeted tests and this note. No browser or subagent use.
- Verification: 12/12 theme tests, 181/181 repository tests, 74 built pages and
  75 Pagefind pages. All 17 budgets pass; Fuyukawa Home CSS is 106.0/109.4 KiB.
  Test/build processes exited normally. Logs use `%TEMP%/fuyukawa-cover-header-*`.
- Existing 4321 Home, Blog and stylesheet return HTTP 200; the served CSS contains
  the 7:10 frames, contain fitting and symmetric navigation tracks. No server was
  restarted and no image, shared route, other theme or root note was changed.
- Implemented and automatically verified; actual visual acceptance remains with
  the user. Scoped local checkpoint subject:
  `fix(fuyukawa): preserve cover artwork and center transparent navigation`.

## Layered Manga Art Direction

- New request: separate the Home character and manga backdrop without harming
  either, add parallax, and design all theme pages around the supplied artwork.
- Recovery checkpoint: `671b0161a53f468550e873ed5de81b8fe375cdd0`, theme clean.
- The user authorizes deriving crops, cutouts and redraws from all 55 still images
  under root `fuyukawa/`; the two MP4s are excluded. Sources remain read-only.
- Keep the recently corrected complete article covers and centered transparent
  navigation. Preserve original assets under their existing filenames.
- Only the main agent, no browser/subagents. Use local compressed contact sheets,
  deterministic media checks, runtime fixtures, compilation and HTTP verification;
  none of these is human visual acceptance.
- Original source images total 12.33 MiB. Inspection copies go to
  `%TEMP%/fuyukawa-art-review`; generated production artwork stays theme-local.
- Media implemented: 19 derivatives (about 2.94 MiB), including five transparent
  stickers, a lossless 1920x1080 character cutout and a rebuilt manga background.
  `tools/prepare-art.mjs` records source/output hashes and exact crop provenance.
- The flattened poster has no recoverable hidden background. A first edge-fill
  attempt visibly smeared manga lines and was rejected internally. The current
  background keeps five intact original panel regions pixel-identical and composes
  clean supplied panels in the center. No claim of recovering the original layers.
  The original poster is unchanged and remains the failed-load fallback.
- Runtime: small bounded pointer spring + scroll depth; transform on each image,
  no global input capture, atomic decode, idle/offscreen/hidden/lite/reduced-motion
  handling and Astro navigation cleanup. The existing profile reveal state machine
  is mechanically extracted into `lib/home-hero.mjs`, not redesigned.
- Page direction implemented: horizontal chapter leaves, category-spine archive,
  numbered workshop sheets, illustrated playroom, personal colour-plate album,
  and article colophon/margin art. Complete article covers and centered nav remain.
- Intermediate snapshot before CSS loading split:
  `C:\Users\a1234\Desktop\codex-backups\fuyukawa-manga-before-style-split-20260909`.
- First media/runtime fixtures: 13/13 pass, previous refresh fixtures: 12/12 pass.
  Pixel test caught a 9px panel overlap; reconstruction tile moved, and intact
  panel byte comparisons now pass. Build caught unavailable icons; reused allowed
  existing icons without changing shared config. Final results are recorded below.
- Inner-page-only rules move to `refresh-pages.css` / `manga-pages.css`. Ordinary
  per-page imports still bundled them into Home through the theme barrel exports.
  BaseLayout now conditionally links their Vite `?url` assets on non-Home routes;
  no shared route, barrel or budget changes are needed.

### Final State And Verification

- Implemented and automatically verified; not browser-verified or human-accepted.
  The user still needs to judge the art direction, hair/earmuff cutout edges,
  parallax feel and actual mobile typography. Do not label this visually approved.
- Home's foreground uses contain fitting with a 16px lower movement allowance,
  while the independently rebuilt background fills the scene. Original opaque
  character pixels and five preserved background rectangles compare exactly.
  This is deterministic masking/compositing, not generative restoration.
- The old duplicate Blog list was removed so category filtering has one source
  of truth. Search intentionally continues searching the whole archive.
- Existing profile reveal states are preserved by a VM interaction test.
  Hero cleanup now cancels initial-scroll and avatar timers. Before-swap cleanup
  also stops the old tag-rain/notice runtime and releases the notice body lock.
- Theme tests: 26/26. Repository tests: 181/181. Production: 74 routes and
  75 Pagefind pages. All 17 unchanged performance budgets pass.
  Home HTML 93.5/97.7 KiB; Home CSS 92.7/109.4 KiB (previously 106.0 KiB).
- `tools/audit-build.mjs`: 18 theme documents, 172 image references, 77 inline
  scripts, 154 local links and 57 stylesheet references pass. No duplicate IDs,
  unresolved controls, missing assets or inner-page styles on Home.
- Original 4321 preview responds HTTP 200 for Home/Blog/Works/Game/About and both
  split hero images. No preview server was started or stopped. Build/test
  processes exited normally. Logs: `%TEMP%/fuyukawa-manga-*-final.log`.
- Only this theme's source and `public/themes/fuyukawa-kagari/assets/manga/`
  derivatives belong to the patch. The root note's pre-existing 457-line addition,
  other themes, shared routes/content, all original images and both MP4s are intact.
- Scoped local milestone subject:
  `feat(fuyukawa): build a layered manga notebook`. Nothing is pushed.
- Code checkpoint created: `787fa0c`, 49 theme-only files. The scoped staging
  audit and whitespace check pass; the original `671b016` recovery point and
  external intermediate snapshot remain available.
