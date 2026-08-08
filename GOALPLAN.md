# Kisara Home Keyframe Stage Rebuild

## Status And Recovery

This plan supersedes the August 7-8 six-chapter implementation and its later key-frame trimming pass. The current implementation remains a recovery point, but it must not be refined through more chapter-local auto chains, scrub behavior, or generic transition layers.

- Repository: `C:\Users\a1234\Desktop\个人博客`
- Active branch / starting HEAD: `main` / `9b5d37b refine(kisara): reframe jealousy closeup`
- Starting tracked worktree: clean. Existing untracked source, candidate, generated, and temporary assets are user-owned and must not be staged, moved, deleted, or overwritten.
- Previous pre-redesign recovery material remains valid under `C:\Users\a1234\Documents\Codex\backups\yuimi-home\`. It is historical recovery material only; do not restore it blindly.
- Before writing Home runtime, scene, CSS, tests, or selected media, create a scoped local Git checkpoint or a binary patch covering only tracked task files.

## Product Decision

Home becomes a fixed-viewport, six-scene Episode 1 keyframe stage. It borrows the proven Me page interaction grammar, not its visual templates.

- A static composition is the actual scene. Video is only the short action verb that brings that composition on screen.
- Every forward gesture moves directly to the next public scene. There is no separate gesture that merely finishes the current scene before navigation can happen.
- Each scene contains at most one short tension action, normally `0.20-0.40s`, exceptionally no more than `0.60s`, then settles immediately into a readable static final frame.
- Remaining narration, composition, page copy, route cues, and easter-egg affordances use static frames and lightweight DOM motion. Do not fill quiet time with another source clip.
- Scene transitions should be authored through adjacent composition, camera direction, and scene-local before/active/after poses. Do not add universal full-screen fades, white flashes, decorative masks, or generic damping layers.
- The six compact Home chapter markers remain navigation, not a progress rail. A marker jump enters only the requested scene; it never plays the earlier story again.
- The normal Home flow does not initialize the old legacy `KISARA` chain, heart, blade, black-hole, data-reconstruction renderer.

## Interaction Grammar To Reuse From Me

Use the Me scene model as the behavioral baseline:

- Maintain one active scene plus adjacent `before` and `after` spatial states.
- Group wheel intent after roughly `180ms` quiet time, use one threshold, and discard momentum tails during the transition lock.
- A successful gesture changes scene ownership immediately. The incoming scene displays a ready first/stable frame at once, starts its short action when decoded, then settles. It must never wait for a second wheel gesture.
- Use scene-specific transform/clip/camera poses only where adjacent imagery supports them. Home must not copy Me's exact shapes or each scene's decoration.
- Copy is a scene-local DOM layer: title may enter after roughly `120-180ms`, supporting line around `220-300ms`, and route/secondary cue around `320-420ms`. Use opacity plus small transform/scale movement; do not use blur-based text entrances.
- When moving backward, return to the previous scene's stable composition through its authored spatial exit. Do not force reverse playback of anime footage.
- During an action, input is blocked and discarded until the short settle completes. Auto mode may advance only after a readable dwell; it may not recursively chain scenes without user intent.

## Six Scene Contract

### 1. Rescue

- Preserve the eye-poke as the opening impact, but derive a compact `0.20-0.30s` cut from only the forceful eye frames. Frame removal and a controlled speed ramp are preferred to optical-flow interpolation.
- The scene settles into one accepted rescue composition. Any severed-tentacle/back-view material becomes a brief scene-entry/exit relation, not two additional user stops.
- This scene carries the smallest site-introduction layer only after the action settles; the eye frame remains visually dominant.

### 2. Request

- Retain the face/emergence relation, but use no looped window and no attempt to conceal a continuing source video.
- The movement is one `0.25-0.40s` OP/manga-style paste or cut. The settled composition is static and can carry the Blog introduction.
- Typography must occupy deliberate negative space and belong to the source composition; it must not repeat a generic side column.

### 3. Counterattack

- Replace `entry -> run -> impact -> roll` as three video phases with one `0.35-0.55s` compressed action montage: selected sword/run/contact/throw frames only.
- The final rolling/landing frame is a static rest state. The scene carries the Works introduction after the action, not during the run.
- No wheel scrub, seek queue, or hidden instructional prompt survives in this scene.

### 4. Contract

- Use a stable embrace composition and one compact `0.25-0.45s` approach-to-kiss action. Other kiss frames are still cuts or scene-local static layers, not a timed four-step sequence.
- The settled kiss composition carries the Me introduction.
- `kokoro-spare-key` is granted exactly once when the scene reaches its stable qualification point, independent of media duration or visibility interruption.

### 5. Transformation

- Keep only a short explosion/reconstruction impulse, normally `0.35-0.60s`; detail, silhouette, and Fight are stable keyframe compositions connected by Me-style spatial movement.
- The settled fight composition carries the Games introduction. Works/Game route cue placement must remain readable on desktop and mobile without covering the subject.
- No long transformation clip, infinite pulse, or legacy finale renderer appears here.

### 6. Jealousy

- Enter on the selected pre-turn static frame. The very next forward transition immediately runs the turn-and-slash action and brings in the right-side black-face composition in the same `0.35-0.55s` scene entrance.
- The user must never enter Jealousy, see a static setup, and need another downward gesture just to trigger the actual slash.
- Preserve the accepted simple right-side comic region and independent close-up framing direction, but treat the completed split as the scene's static end composition.
- The settled end marks `home-jealousy`, exposes Lovebrain eligibility, and retains replay/end behavior.

## Media Rules

- Selected runtime clips must be purpose-exported short actions with semantic names, first-frame poster, hold-frame poster, H.264/yuv420p, no audio, and a verified frame boundary. Do not reuse long clips with runtime speed changes as the primary solution.
- For anime source, favor intentional frame selection, held impact frames, and variable frame cadence over interpolation. Do not introduce optical-flow artifacts in line art.
- Normal source action cuts must not show burned subtitles, white source flashes, stale first/last video frames, blank decoders, black borders, or aspect-ratio mismatch.
- All selected media is decoded/prewarmed for the current and adjacent scenes. If the action clip is not ready at scene activation, show the target stable first frame immediately, queue only that action, and never make a user repeat the gesture.
- Existing media files are not deleted in this task. First remove runtime references and test expectations; a later dedicated asset audit may decide cleanup.

## Architecture Boundaries

`HomeChapterController` remains the sole Home owner for input, playback, restoration, and lifecycle. It must become a scene controller rather than a nested beat sequencer.

It must retain:

- wheel, touch, keyboard, marker navigation, reduced-motion, and mobile behavior;
- `FoundSelf` ticket, input lock, audio suspension, skip, visibility and route recovery;
- `Lovebrain` qualification, entry/departure, return path, and persistent-player rules;
- `kokoro-spare-key`, `home-jealousy`, secret-session, and audio protocols;
- `kisara:gate-progress`, Home boot-ready, `astro:before-swap`, `pagehide`, `pageshow`, BFCache, and same-tab restoration;
- operation epochs plus playback/transition tokens so a stale decoder, timeout, or route callback can never reveal inactive media.

It must remove or replace:

- chapter-local `playBeatSequence()` chains;
- forward behavior that first settles an unfinished beat instead of entering the next scene;
- Counter scrub/seek state and instructional affordance;
- generic `CHAPTER_TRANSITION_MS` style ownership and a large beat-to-CSS state matrix;
- restoration fields that describe transient playback instead of `{ sceneId, stableState }`.

## Visual Motion Budget

- Per viewport: one primary action, one text/interaction response, and at most one low-frequency ambient effect.
- Scene action is the transition. Avoid stacking an unrelated overlay transition on top of it.
- Copy does not appear as opaque cards or repeated dashboard panels. Each scene gets its own placement, typographic scale, and relation to its source composition.
- Stable scenes must remain legible and calm enough for the user to choose a route or notice an easter clue.
- Mobile uses the same narrative stops but may replace micro-clips with stable posters or lighter motion where decoding/performance pressure would weaken the experience.

## Implementation Order

1. Create a scoped recovery checkpoint before functional changes.
2. Inspect and export only the selected short action candidates plus first/hold posters outside tracked runtime paths; review compressed previews before adoption.
3. Replace `KISARA_HOME_STATE_TABLE.md` with six single-scene contracts, exact qualifying moments, and no hidden internal stops.
4. Refactor `KisaraStageHome.astro`, `stageHome.ts`, and `stage-home.css` around Me-like scene positions and short action overlays; preserve existing secret hosts and external protocol names.
5. Implement Rescue, Request, and Counterattack first as a coherent hand-feel sample. Create a scoped checkpoint before expanding to Contract, Transformation, and Jealousy.
6. Migrate the remaining three scenes, secret trigger timing, marker jumps, backward return poses, same-tab restoration, reduced motion, and mobile gates.
7. Add/update focused tests for one-gesture navigation, action readiness, no nested auto chains, lifecycle cancellation, restored stable states, spare-key, jealousy, FoundSelf, and Lovebrain.
8. Run `git diff --check`, focused tests, full `npm test`, and a production build. Browser navigation/lifecycle review uses `luna max`; fine visual timing remains for human review.
9. After human acceptance, create a local Git checkpoint containing only tracked task files, update `DEVELOPMENT_NOTES.md`, and push only if the user explicitly asks.

## Delivery Criteria

- Six stable Home scenes work on wheel, touch, keyboard, marker click, restore, replay, and reduced-motion paths.
- Every forward gesture lands in the next scene without a preliminary "finish current beat" gesture.
- Every source-video action is a purpose-cut tension beat no longer than `0.60s`; ordinary beats target `0.20-0.40s`.
- Counter no longer chains three videos, Contract no longer advances through four timed still beats, Transformation no longer chains four timed beats, and Jealousy slash begins on entry from Transformation.
- Text enters as part of each active scene and remains readable on the settled frame; it does not use a repeated side-column template or blur transition.
- No white flash, stale frame zero, blank video, aspect-ratio border, wheel dead zone, recursive auto-chain, or duplicate listener appears during normal use.
- FoundSelf, Lovebrain, spare-key, secret audio, `home-jealousy`, route cleanup, BFCache/visibility recovery, and mobile/reduced-motion behavior remain correct.
- Static validation passes. Fine timing, crop, and visual comfort are explicitly subject to the user's human review.
