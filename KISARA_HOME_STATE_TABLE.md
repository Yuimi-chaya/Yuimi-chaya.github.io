# Kisara Home Keyframe Scene State Table

## Ownership

- One `HomeChapterController` owns all Home input, scene changes, short actions, restoration, and lifecycle state.
- The old legacy renderer has no normal-flow ownership and is not initialized by Home.
- Every asynchronous operation carries an epoch plus a playback token.
- Persisted state contains only a scene and stable state. Action playback and CSS phases are never restored.

## Public Scenes

| Index | ID | Stable composition | Short action | Forward behavior | Backward behavior | Qualification |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | `rescue` | Kisara back-view still | `rescue-action.mp4`, about `0.29s`, then an automatic `0.50s` diagonal cut/back-view reveal | enters Request directly | edge nudge | FoundSelf may run before entry |
| 1 | `request` | emerged comic still | static face-to-paste action, about `0.62s` | enters Counterattack directly | restores Rescue stable frame | none |
| 2 | `counterattack` | roll/landing still | `counter-action.mp4`, about `1.00s`, from the run-end launch through the energy clash | enters Contract directly | restores Request stable frame | none |
| 3 | `contract` | final kiss still | two-frame embrace-to-kiss action, about `0.52s` | enters Transformation directly | restores Counterattack stable frame | grant spare key on stable arrival |
| 4 | `transformation` | Fight still | old-stage-style overlapping explosion/detail/silhouette/Fight fades, about `1.32s` | enters Jealousy and starts its slash immediately | restores Contract stable frame | none |
| 5 | `jealousy` | completed action plus right comic panel | `jealousy-action.mp4`, about `1.25s`; the preparation runs at `1.25x` and the final slash accelerates | edge nudge; Lovebrain may be activated after settle | restores Transformation stable frame | mark `home-jealousy` on final settle |

## Runtime Media

Runtime directory: `public/themes/kisara/assets/home-stage/chapters/`.

| Slot | Runtime file | Role |
| --- | --- | --- |
| Rescue action | `rescue-action.mp4` | selected eye rush only; no source white flash |
| Rescue action hold | `rescue-eye-last.webp` | maximum-eye frame before the automatic cut |
| Rescue stable | `rescue-severed.webp`, `rescue-slash-last.webp` | diagonal cut followed by the persistent Kisara back-view composition |
| Request stable | `request-emerged.webp` | oversized manga/OP paste hold |
| Request source | `request-face.webp` | dimmed source still below the paste |
| Counter action | `counter-action.mp4` | continuous run-end launch to energy clash; no sword prelude, hit/roll chain, or wheel scrub |
| Counter stable | `counter-roll-last.webp` | landing/roll hold and Counter action fallback |
| Contract stable | `contract-kiss-03.webp` | final kiss hold |
| Contract cut | `contract-embrace.webp` | the only pre-kiss still; it cuts directly to the stable kiss frame |
| Transformation stable | `fight.webp` | final Fight hold |
| Transformation cuts | `transformation-explosion.webp`, `transformation-detail.webp`, `transformation-silhouette.webp` | static reconstruction keyframes only |
| Jealousy action | `jealousy-action.mp4` | complete closed-mouth turn and slash with `1.25x` preparation and accelerated final slash, no long spoken prelude |
| Jealousy stable | `jealousy-action-hold.webp`, `jealousy-blackface-last.webp` | completed base and right comic panel |

## Persistent KISARA Wordmark

Each chapter renders the same fixed six-letter geometry through `KisaraLetterStage.astro`. The visible chapter owns the active-letter presentation, so the wordmark is derived from the public scene and adds no independent persisted timeline.

| Index | Scene | Letter | Active effect | Stable residue |
| --- | --- | --- | --- | --- |
| 0 | Rescue | `K` | cold gray material, then the accepted eye action hands off to a diagonal pink blade cut | a thin diagonal incision |
| 1 | Request | `I` | legacy-derived metal links build on front/back canvases and weave around the vertical stroke | a dimmed settled chain |
| 2 | Counterattack | `S` | directional pink/white/blue charge follows the curve and releases at impact | a static charged edge |
| 3 | Contract | first `A` | legacy enchant material and gloss feed a layered front/back heart imprint and shard pulse | a faint enchanted heart trace |
| 4 | Transformation | `R` | legacy enchant material, glyph-clipped data reconstruction, and a local liquid WebGL letter follow the four-image crossfade | a stable vivid enchanted material |
| 5 | Jealousy | second `A` | the decoded black-face cue darkens and cuts the letter on the same slash event | a wine-red fracture and dark diagonal scar |

- Non-active letters remain low-opacity glass outlines. Past letters may show faint residue; future letters remain clean glass.
- No legacy title state machine, full-screen title Canvas, backdrop blur, black-hole renderer, or second `sessionStorage` state is used. The accepted legacy visual algorithms are isolated in `runtime/letterStageFx.ts` and bounded to `I`, Contract `A`, and `R`.
- Marker jumps and backward restoration display only the target chapter's stable wordmark state; skipped letter effects do not replay.
- A completed Jealousy action may trigger one `620ms` non-persistent synchronization across the inactive letters. Restore and reduced-motion paths do not replay it.
- Mobile and reduced motion keep the compact fixed word and static active material without creating the local Canvas/WebGL controller. Static Rescue/Jealousy scars remain available.

## Scene Action Contract

### Rescue

`scene-active -> action-running -> settled`

- The initial eye action is a purpose-cut `0.20-0.30s` clip.
- Its completion automatically starts the existing diagonal severed-tentacle cut and back-view reveal. The back-view image is the stable composition, and the cut does not replay when leaving for Request.

### Request

`scene-active -> action-running -> settled`

- The face remains the quiet source layer while the complete emergence still enters as one irregular paste.
- There is no kneeling loop, floating card, or hidden source video.

### Counterattack

`scene-active -> action-running -> settled`

- The purpose-cut clip begins at the final running launch and preserves the continuous jump/contact motion at a readable speed. The landing frame is static below the action layer.
- There is no scrub state, seek queue, or extra gesture for impact/roll.

### Contract

`scene-active -> action-running -> settled`

- The action contains exactly two compositions: embrace, then kiss. No approach intermediates or internal wheel stops exist.
- The stable qualification point is the final kiss composition and is idempotent.

### Transformation

`scene-active -> action-running -> settled`

- Explosion, detail, silhouette, and Fight remain static layers, but adjacent images overlap through the legacy stage's soft opacity/edge-blur envelope instead of appearing as isolated flashes. The legacy title/chain/black-hole renderer remains absent.

### Jealousy

`scene-active -> action-running -> final`

- The slash video starts as part of entering Jealousy from Transformation. The user never needs a second forward gesture to start it.
- The turn and sword arc remain visible with the preparation tightened to `1.25x`. The right-side black-face image is triggered from decoded media time `0.98s` at the slash onset, then settles with the action base.

## Input And Restoration

- Fixed viewport; the document does not scroll during the Home performance.
- Wheel intent is grouped after roughly `180ms` silence with a threshold of `42` and an input lock around `720ms`.
- One successful gesture changes at most one public scene. Momentum tails are discarded and never consumed as a hidden internal beat.
- Touch, keyboard, marker click, and replay use the same scene owner.
- Marker jumps preload only the target scene and run its short entry action once.
- Same-tab restoration stores `{ version: 2, scene, stable }` and returns directly to the stable composition.
- Only the active scene and its explicit outgoing partner may paint during a handoff. Hidden-tab, BFCache, and route cleanup pause/cancel short media without revealing stale frames or replaying a scene unexpectedly.
- Reduced motion restores the final stable scene without action playback.

## External Protocols To Preserve

- FoundSelf ticket, skip, audio suspension, hidden-tab recovery, completion event, and one-shot behavior.
- Lovebrain qualification, activation, departure, return, and persistent-player behavior.
- `kokoro-spare-key`, `photo-archive`, `home-jealousy`, secret audio, and same-tab ledger behavior.
- `kisara:gate-progress`, Home boot-ready, `astro:before-swap`, `pagehide`, `pageshow`, and visibility cleanup.
