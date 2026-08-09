# Kisara Home Six-Letter Continuity Stage

## Status And Recovery

- Date: `2026-08-09`.
- Repository: `C:\Users\a1234\Desktop\个人博客`.
- Starting branch / HEAD: `main` / `d20447b refine(kisara): extend rescue and tighten jealousy`.
- Starting tracked worktree is clean. Existing untracked source, candidate, generated, and temporary assets are user-owned and must not be staged, moved, deleted, or overwritten.
- The complete pre-redesign Home remains recoverable on `codex/kisara-pre-home-redesign-20260806` and historical commit `72a7719`. They are reference sources only and must not be restored wholesale.
- Browser QA is explicitly excluded. Static validation is required; final motion, hierarchy, timing, and comfort belong to the user's direct visual review.

## Execution Warning

Do not be lazy.

- Do not ship six identical letters that merely swap color or glow.
- Do not copy the old multi-thousand-line Home renderer back into the new six-scene controller.
- Do not create six independent full-screen canvases, filters, or permanent GPU surfaces.
- Do not stop after a convincing K/I/S sample and label A/R/A as later polish.
- Do not let the title cover every subject or force all scene copy into one repeated side column.
- Do not break, simplify, or silently defer FoundSelf, Lovebrain, secret audio, marker, restore, BFCache, mobile, or reduced-motion behavior.
- Do not claim visual acceptance. Deliver the complete implementation, evidence, and checkpoints, then stop for human review.

## Product Decision

The six-scene Home keeps its current media, copy, navigation, and one-gesture scene grammar. A fixed `KISARA` word becomes the continuous visual state carrier that the old Home previously provided.

- `KISARA` contains six independently addressable letters and maps one-to-one to the six public scenes.
- The word keeps one stable responsive position and letter spacing across the entire normal Home performance.
- Exactly one letter is active in a stable scene. The other five remain readable only as restrained translucent glass outlines with edge refraction and almost transparent interiors.
- Previously visited letters may retain a faint scene-specific scar or residue. Future letters remain clean glass. Neither state may compete with the active letter.
- The active letter owns the scene-specific effect. Scene media remains the primary image; the word is a persistent narrative instrument, not an opaque logo card.
- On scene changes, energy/material travels from the outgoing letter to the incoming letter. The word must not behave like six unrelated traffic lights switching instantly.
- At the final Jealousy settle, all six letters may synchronize briefly once, then cool back to glass with the damaged final `A` remaining active.

## Letter And Scene Contract

### K / Rescue

- Starts as the weakest gray glass state.
- The eye impact introduces the first internal pink response.
- The automatic diagonal blade transition cuts through the `K`; the back-view settle leaves a thin pink incision and one damaged edge.
- No chain, heart, or full enchantment appears yet.

### I / Request

- The transfer from `K` reaches the vertical `I` as a restrained pulse.
- A lightweight chain wraps the letter from opposite directions and settles under visible tension.
- The chain is scene-local and must not require the old full-title chain simulation or a permanent animation loop.
- The Request comic and copy remain readable around the fixed word.

### S / Counterattack

- Energy releases from the chained `I` and runs along the curvature of `S`.
- The active material behaves as a fast directional ribbon with local exposure, color separation, and a short impact surge tied to launch/contact.
- Stable motion is low-frequency and bounded. It may not look like a generic neon loading spinner.

### A1 / Contract

- Pink and muted green strands enter from opposite sides and connect through the counter of the first `A`.
- The embrace-to-kiss cut triggers one heart pulse and a short connection wave through the word.
- The heart is integrated with the letter opening, not placed as a floating emoji or independent icon.
- Spare-key qualification remains owned by the scene controller and is not coupled to the decorative effect completing.

### R / Awaken

- The connection pulse reaches `R` and becomes the most complete enchantment state.
- Contract-like traces, hot pink material, restrained glyph fragments, and local reconstruction cells travel along the strokes while the existing four-image crossfade runs.
- The effect may borrow the old enchantment/data language, but not the old black-hole renderer or full-screen reconstruction field.
- The final Fight image remains the stable media composition.

### A2 / Jealousy

- The second `A` begins vivid pink, then deepens toward wine red and black as the turn-and-slash action advances.
- The decoded slash cue cuts the letter diagonally. That cut continues into the existing right-side black-face comic boundary so both effects share one cause.
- The completed state retains a dark fracture and red edge rather than reusing the Contract heart.
- `home-jealousy`, Lovebrain eligibility, Replay, and the final one-time six-letter synchronization remain scene-controller outcomes.

## Architecture

### Markup

- Add one dedicated `KisaraLetterStage` component inside `KisaraStageHome`.
- Render six indexed letter nodes, not IDs derived from the glyph, because the two `A` letters have different behavior.
- Each node owns glass, active material, edge, residue, and scene-decoration sublayers.
- Add at most one shared lightweight FX canvas for particles, sparks, or chain accents. It must be clipped/bounded around the word and must never become another full-screen compositor.

### State Ownership

- `HomeChapterController` remains the only input, navigation, playback, restore, and lifecycle owner.
- Active letter index derives directly from the active public scene. Do not persist a second independent letter timeline.
- The controller exposes only bounded semantic states to the letter renderer: scene ID/index, entering, active, settled, leaving, direction, suspended, reduced motion, and final synchronization.
- Marker jumps activate only the requested scene/letter. Skipped scene effects do not replay.
- Backward navigation restores the previous letter's stable residue without reverse-playing its source action.
- Same-tab restoration derives the correct active letter and stable effect from the persisted scene/stable state.

### Rendering And Performance

- Prefer DOM/CSS text masks, gradients, strokes, pseudo-elements, and bounded transforms for persistent letter materials.
- A shared Canvas renderer is allowed only for effects that materially benefit from it. Cap DPR, pause when hidden, stop on route changes, and avoid readback or per-frame layout measurements.
- Measure letter bounds on init/resize only. Cache geometry and update it through one resize path.
- Do not use full-word `filter: blur(...)` surfaces, hidden full-size filtered layers, repeated visibility churn, or per-letter permanent `will-change` promotion.
- Stable scenes receive one low-frequency ambient response at most. Action effects may briefly increase intensity, then settle.
- The title layer sits above scene media and grades but below interactive copy, navigation, player, FoundSelf, and Lovebrain overlays.

## Responsive And Accessibility

- Desktop keeps the fixed full-word composition and all six scene identities.
- Mobile keeps the same word and active-letter mapping but reduces particle count, chain detail, filter use, and ambient motion. Inactive glass letters become thinner and less bright so media remains readable.
- Use stable responsive dimensions and `clamp()` sizing; do not scale font size directly with viewport width.
- `prefers-reduced-motion` shows the correct active material and stable residue without chain travel, energy chase, heart burst, reconstruction motion, or final synchronization animation.
- Decorative layers are `aria-hidden`. The scene titles, route links, markers, and status text remain the accessible controls.

## External Protocols To Preserve

- Current Rescue automatic eye -> blade -> back-view action.
- Request comic paste, Counter action, Contract two-frame cut, Awaken crossfade, and Jealousy media-time panel cue.
- FoundSelf ticket, skip, audio suspension, hidden-tab recovery, and return state.
- Lovebrain eligibility, activation, departure, return path, and persistent-player rules.
- `kokoro-spare-key`, `home-jealousy`, secret-session, and audio protocols.
- `kisara:gate-progress`, Home boot-ready, marker/replay, keyboard/touch/wheel ownership, `astro:before-swap`, `pagehide`, `pageshow`, BFCache, and same-tab restoration.

## Implementation Order And Checkpoints

1. Inspect the old title renderer and current Home layering. Record reusable visual language and rejected performance patterns.
2. Replace this plan and create a plan-only local Git checkpoint from `d20447b`.
3. Add the fixed six-letter component, glass states, active-index binding, layer ordering, mobile sizing, reduced-motion baseline, and focused structural tests.
4. Create a skeleton checkpoint before scene-specific effects.
5. Implement K/I/S effects and their transfer behavior without changing scene media timing.
6. Implement A1/R/A2 effects, connect the final slash to the black-face panel, and add the one-time final synchronization.
7. Integrate suspend/resume/dispose, marker jumps, restoration, FoundSelf/Lovebrain hiding, and mobile performance limits.
8. Update `KISARA_HOME_STATE_TABLE.md`, focused tests, and `DEVELOPMENT_NOTES.md` with exact ownership and remaining human-review risks.
9. Run `git diff --check`, focused Home tests, full `npm test`, and `npm run build`. Do not run browser QA.
10. Create the final scoped local checkpoint containing only task-owned tracked files. Do not push unless explicitly requested.

## Delivery Criteria

- A fixed, readable `KISARA` silhouette persists across all six normal Home scenes without dominating every composition.
- Exactly one indexed letter is active per stable scene; the other five remain restrained glass outlines.
- K, I, S, A1, R, and A2 each have a visibly distinct effect tied to Rescue, Request, Counterattack, Contract, Awaken, and Jealousy respectively.
- Letter-to-letter transfers feel continuous and do not introduce white flashes, full-screen color cuts, generic overlay fades, or extra user gestures.
- The Jealousy slash and right comic boundary share one decoded-media cue.
- Marker jumps, backward navigation, replay, same-tab restore, reduced motion, and mobile all resolve to the correct active letter without replaying skipped effects.
- No old full-title runtime, black-hole renderer, full-screen data compositor, duplicate input owner, stale callback, or permanent heavy GPU layer returns.
- Existing easter eggs and audio protocols remain intact.
- Static validation passes. Final visual acceptance is explicitly reserved for the user.
