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
- Local state: the Kisara interaction prototype is implemented and locally validated but not pushed. Untracked user materials remain separate and untouched (`102000325_p0.jpg`, `122472458_p0.png`, `XP/`, `kisara/`, `showcase-output/`).
- Default theme ID: `fuyukawa-kagari`.
- Available theme IDs: `fuyukawa-kagari`, `blank`, `kisara`.
- Route decision: `fuyukawa-kagari` remains on existing root URLs; `blank` uses `/themes/blank/...`; `kisara` uses `/themes/kisara/...`. Alternate themes canonicalize to matching root URLs.
- Preference key: `yuimi-theme-id-v1` with an allowlist and `fuyukawa-kagari` fallback.
- Implementation state: three independent frontends are locally available. The Kisara prototype is awaiting user visual acceptance and has not been pushed.

## Architecture Decision

- Shared layer: content collections, article queries, site metadata, category labels, SEO inputs, and theme registry/path helpers.
- Fuyukawa Kagari layer: existing pages, layouts, theme CSS at `src/themes/fuyukawa-kagari/styles/theme.css`, navigation presentation, footer copy, Sakura, pig scrollbar, tool dock, music player, Live2D, notice, weather/IP signal, Canvas tag rain, and related assets.
- Blank layer: independent document layout, navigation, pages, article presentation, CSS, context menu, and visible theme return control. It does not load Kagari CSS, assets, remote Live2D, music, weather, or notice runtime.
- Kisara layer: independent dark visual-interaction frontend with a reversible blue-to-red diagonal title tide controlled by captured vertical input. It owns its layout, pages, CSS, mobile navigation, context menu, and runtime, and currently references no character images.
- Switching: map the current canonical pathname into the target theme, preserve query/hash, persist the target ID, then perform a full-document navigation. Explicit user switches use history-preserving `assign`; automatic preference restoration uses `replace`; browser history traversal adopts the restored page's theme.
- SEO: alternate theme routes use `noindex,follow`; sitemap excludes `/themes/` routes.
- 404: the single GitHub Pages root 404 performs an early client redirect for unknown `/themes/blank/*` paths to `/themes/blank/404/`, carrying the original URL in `from`.

## Asset Inventory

- Shared content assets: `public/blog-assets/`, `public/blog-covers/`, Markdown content images.
- Fuyukawa Kagari theme assets: `public/themes/fuyukawa-kagari/assets/`, `public/themes/fuyukawa-kagari/music/`, Live2D CDN configuration, homepage background/avatars/brand images, About media, and the 404 visual.
- External Fuyukawa Kagari runtime dependencies: jsDelivr Live2D packages, Cubism SDK, location/weather endpoints.
- Kisara presentation assets: none in the prototype. Root `kisara/` images remain user-owned source material and are intentionally unreferenced.
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
- Status: prototype implemented and browser-validated on desktop and `390x844` mobile.
- Key behavior: while the homepage is at the top, downward wheel/touch/keyboard input raises a blue-to-red diagonal tide and upward input lowers it. Input changes a target level; `requestAnimationFrame` advances the visible level with damped velocity, so the mask and crest continue smoothly between wheel events. Document scrolling is released only after the visible level settles at 100%.
- Escape paths: reduced-motion users start completed, restored pages below the top are synchronized to completed, and an explicit `SKIP` link bypasses the gate.
- Boundary: no root `kisara/` source image is imported, copied, staged, or published.

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

1. Obtain user visual acceptance for the Kisara color-only scroll mask and tune fill distance or typography from that feedback.
2. Add parallax, character cutouts, or puppet layers only after suitable source material is explicitly selected.
3. Push the baseline and Kisara commits only when separately requested.

## Test and Validation Record

- `npm test`: 3/3 Node tests passed for all theme IDs, canonical path stripping, and cross-theme article-context mapping.
- `npm run build`: passed for the Kisara prototype; 36 static pages generated, sitemap created, Pagefind index created.
- Sitemap: verified that `/themes/blank/` routes are excluded.
- Resource boundary: verified no legacy `/assets/` or `/music/` runtime references and no Blank import/reference to Kagari internals or assets.
- Desktop browser: verified both theme home pages, Blank article deep link, canonical/noindex, zero horizontal overflow, two-way switching, query/hash preservation, refresh persistence, browser back/forward, and no console warnings/errors.
- Mobile browser at 390x844: verified both themes fit without horizontal overflow and both visible theme controls remain reachable.
- Kisara browser validation: confirmed intermediate downward input raises the mask while `scrollY` remains `0`, reverse input lowers it continuously, and returning to the top after normal page scrolling allows the next upward input to recede from 100%. At settled `100%`, the next downward input scrolls into the full-width content band. Desktop and `390x844` mobile layouts have no horizontal overflow.
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
