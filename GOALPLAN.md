# Kisara Home Episode 1 Chapter Redesign

## Status And Recovery

This plan supersedes the rejected legacy-stage plan from August 7, 2026. The old implementation is preserved only as recovery material and must not remain the normal Home presentation.

- Repository: `C:\Users\a1234\Desktop\个人博客`
- Branch/HEAD before this redesign: `main` / `e912826`
- Exact pre-redesign backup: `C:\Users\a1234\Documents\Codex\backups\yuimi-home\kisara-home-attack-freeze-complete-20260807-174434`
- Backup patch SHA256: `A9C6B1127EEB708D2C7EA5A5F310CD6ADD1C6C3E7797B2157A5F45B7082EB4C3`
- Do not stage, delete, move, or overwrite unrelated dirty/untracked files.

## Product Direction

Rebuild Home as a fixed-viewport Episode 1 chapter stage similar to the proven Me page interaction model:

- Six authored chapters rather than one long legacy effect timeline.
- One deliberate gesture changes a chapter or advances one authored internal beat.
- Each chapter has its own media behavior, composition, transition, and stable resting frame.
- Compact clickable chapter markers replace the global right-side progress rail.
- Users may jump directly to another chapter without replaying every preceding clip.
- The old `KISARA` chain/heart/blade/black-hole/data-storm performance is retired from the normal Home flow.
- Do not reproduce the previous file-viewer pattern of play, pause, switch file, and repeat.

## Six Chapters

### 1. Rescue

- Entry auto-plays until Kisara's largest, most forceful eye frame and settles there.
- The first forward intent does not leave immediately. It triggers a diagonal sword-mask transition.
- The incoming layer is already playing the monster's severed tentacle, skipping the source anime's white blade-flash frames.
- Continue to Kisara's back-view composition and settle.
- A fresh forward intent enters Request.

### 2. Request

- Begin with Kisara turning toward Shu and complaining that he is useless.
- Settle on a composition that can host a small rounded overlay at Shu's source position.
- The overlay loops Shu kneeling with hands together; it must be visually seamless and must not reveal zoom-outs, black frames, or a loop reset.
- The loop is part of the scene composition, not a framed card or HUD widget.

### 3. Counterattack

- Begin on the faceless side-view shot of Kisara holding her sword.
- Auto-play to the running handoff.
- The running interval is a smooth reversible wheel/touch scrub, using a short-GOP/no-B-frame derivative and a one-seek-in-flight/latest-target queue.
- After the clash, use an authored montage cut to Kisara rolling on the ground.
- Settle immediately before Shu lifts her.

### 4. Contract

- Start with Kisara already in Shu's arms and acting spoiled.
- Continue naturally into the kiss and settle on a stable final frame.
- Crossing the kiss qualification point grants the existing `kokoro-spare-key` protocol once.

### 5. Transformation

- Use a dedicated transformation performance with no legacy title/chain renderer layered on top.
- The media itself owns smoke, transformation, attack escalation, and its final resting frame.
- Fine decorative effects may be added later only after the chapter timing is accepted.

### 6. Jealousy

- Auto-play the back-to-back confrontation until Kisara's slash setup.
- Forward intent follows the visible sword trajectory with a diagonal mask.
- A second clip is already playing underneath and resolves into Kisara's black-face close-up; the slash source itself does not continue through the reveal.
- Settle on the close-up, mark `home-jealousy`, and expose normal page exits / Lovebrain eligibility.

## Input Model

- Fixed viewport; the document itself does not scroll during the Home performance.
- Wheel, touch, Arrow/Page keys, Home/End, and chapter-marker clicks share one controller.
- A fresh gesture advances at most one public chapter or one chapter-owned internal beat.
- Momentum tails cannot cross another boundary.
- Clicking a marker cancels stale playback, preloads the target first/hold frame, and enters that chapter directly.
- Marker jumps may present the chapter's authored entry animation, but must never replay all preceding chapters.
- Backward navigation restores stable internal beats deterministically and supports reversing the running scrub.
- No instructional copy such as “scroll down”; use quiet visual response only.

## Architecture

`stageHome.ts` remains the single input and lifecycle owner, but its old six-file/legacy-renderer model is replaced by a chapter controller.

It owns:

- chapter index and chapter-local beat state;
- automatic video playback tokens;
- smooth queued scrub seeking;
- transition serials and decoded first/hold frames;
- marker clicks and accessibility state;
- same-tab restoration;
- hidden-tab, BFCache, route-swap, reduced-motion, and mobile behavior;
- FoundSelf, spare-key, jealousy, Lovebrain, audio, and gate-progress protocols.

The normal Home DOM must not initialize the old ten-thousand-line legacy renderer. `HomePage.astro` should become a thin assembly layer for the new chapter stage and the two independent secret overlays.

## Existing Protocols To Preserve

- FoundSelf ticket consumption and automatic playback before normal chapter entry.
- FoundSelf audio suspension, SKIP, hidden-tab recovery, and one-shot behavior.
- Lovebrain qualification, entry, departure, return, and persistent-player behavior.
- Spare-key grant during the Contract chapter.
- `home-jealousy` qualification after the final black-face hold.
- Same-tab secret ledger and persistent audio rules.
- `astro:before-swap`, `pagehide`, `pageshow`, and visibility cleanup.
- Mobile performance gates and reduced-motion stable states.
- Home boot-ready contract from `KisaraLayout`.

## Media Workflow

- Source: `E:\契约之吻\Ep01.mkv`.
- Candidate media remains outside the repository until selected.
- Review only compressed contact sheets/previews, normally longest edge <= 1600-2048px and <= 12MB per batch.
- Runtime media uses semantic filenames, first/last posters, H.264/yuv420p, and no audio.
- Scrub media uses short GOP, no B-frames, bounded resolution, and deterministic seeking.
- Source files and unrelated user assets remain untouched.

## Visual Rules

- Full-bleed media must cover the viewport without black borders.
- Never expose a stale poster, video frame zero, decoder blank, or white/exposure flash.
- The diagonal sword transitions must follow actual action direction and reveal already-running incoming media.
- The Request loop must visually belong to the source composition rather than read as a floating UI card.
- Chapter transitions are pair-specific. Do not apply one generic dissolve, diagonal cut, or damping preset everywhere.
- The compact chapter rail is navigation, not another progress meter.

## Ordered Work

1. Export and judge chapter media plus posters outside the repository.
2. Finalize `KISARA_HOME_STATE_TABLE.md` with exact files and timings.
3. Replace the Home component, runtime, and styles with the chapter model.
4. Remove the normal Home dependency on the legacy renderer and old gate runtime.
5. Port FoundSelf and Lovebrain host APIs into the chapter controller.
6. Add focused tests for chapter ownership, internal beats, scrub queue, markers, lifecycle, and secret protocols.
7. Run `git diff --check`, targeted tests, full `npm test`, and one production build.
8. Hand the first functional visual pass to the user before decorative refinement.
9. After user timing acceptance, perform browser/lifecycle QA and create a scoped local checkpoint. Do not push unless requested.

## Definition Of First-Pass Delivery

- All six chapters and marker jumps work.
- Rescue eye hold and severed-tentacle diagonal transition work.
- Request background and seamless kneeling overlay work.
- Counterattack entry, smooth running scrub, clash montage, and pre-lift hold work.
- Contract, Transformation, and Jealousy chapters play and settle independently.
- Jealousy diagonal reveal lands on the black-face close-up.
- No old title/chain/black-hole performance appears in the normal flow.
- No global right-side progress rail appears on Home.
- Existing secret/audio/lifecycle contracts remain functional.
- Static tests and production build pass.
- Fine composition and motion remain explicitly subject to the user's visual review.
