# Kisara Home Keyframe Scene State Table

## Ownership

- One `HomeChapterController` owns all Home input, scene changes, short actions, restoration, and lifecycle state.
- The old legacy renderer has no normal-flow ownership and is not initialized by Home.
- Every asynchronous operation carries an epoch plus a playback token.
- Persisted state contains only a scene and stable state. Action playback and CSS phases are never restored.

## Public Scenes

| Index | ID | Stable composition | Short action | Forward behavior | Backward behavior | Qualification |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | `rescue` | maximum-eye still | `rescue-action.mp4`, about `0.29s` | enters Request directly | edge nudge | FoundSelf may run before entry |
| 1 | `request` | emerged comic still | static face-to-paste action, about `0.62s` | enters Counterattack directly | restores Rescue stable frame | none |
| 2 | `counterattack` | roll/landing still | `counter-action.mp4`, about `1.00s`, from the run-end launch through the energy clash | enters Contract directly | restores Request stable frame | none |
| 3 | `contract` | final kiss still | two-frame embrace-to-kiss action, about `0.52s` | enters Transformation directly | restores Counterattack stable frame | grant spare key on stable arrival |
| 4 | `transformation` | Fight still | unhurried static explosion/detail/silhouette/Fight sequence, about `1.08s` | enters Jealousy and starts its slash immediately | restores Contract stable frame | none |
| 5 | `jealousy` | completed action plus right comic panel | `jealousy-action.mp4`, about `1.54s`, with a fast-slow-fast turn/slash curve | edge nudge; Lovebrain may be activated after settle | restores Transformation stable frame | mark `home-jealousy` on final settle |

## Runtime Media

Runtime directory: `public/themes/kisara/assets/home-stage/chapters/`.

| Slot | Runtime file | Role |
| --- | --- | --- |
| Rescue action | `rescue-action.mp4` | selected eye rush only; no source white flash |
| Rescue stable | `rescue-eye-last.webp` | maximum-eye scene hold |
| Rescue bridge | `rescue-severed.webp`, `rescue-slash-last.webp` | static outgoing relation during Rescue -> Request |
| Request stable | `request-emerged.webp` | oversized manga/OP paste hold |
| Request source | `request-face.webp` | dimmed source still below the paste |
| Counter action | `counter-action.mp4` | continuous run-end launch to energy clash; no sword prelude, hit/roll chain, or wheel scrub |
| Counter stable | `counter-roll-last.webp` | landing/roll hold and Counter action fallback |
| Contract stable | `contract-kiss-03.webp` | final kiss hold |
| Contract cut | `contract-embrace.webp` | the only pre-kiss still; it cuts directly to the stable kiss frame |
| Transformation stable | `fight.webp` | final Fight hold |
| Transformation cuts | `transformation-explosion.webp`, `transformation-detail.webp`, `transformation-silhouette.webp` | static reconstruction keyframes only |
| Jealousy action | `jealousy-action.mp4` | complete closed-mouth turn and slash with encoded fast-slow-fast timing, no long spoken prelude |
| Jealousy stable | `jealousy-action-hold.webp`, `jealousy-blackface-last.webp` | completed base and right comic panel |

## Scene Action Contract

### Rescue

`scene-active -> action-running -> settled`

- The initial eye action is a purpose-cut `0.20-0.30s` clip.
- The stable eye composition remains readable after the action. The severed/back images are used only as a short static bridge while leaving for Request.

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

- Explosion, detail, silhouette, and Fight are static layers with enough dwell to read each key image; they are not compressed like a micro-video. The legacy title/chain/black-hole renderer remains absent.

### Jealousy

`scene-active -> action-running -> final`

- The slash video starts as part of entering Jealousy from Transformation. The user never needs a second forward gesture to start it.
- The turn and sword arc remain visible through a fast-slow-fast source-frame curve. The right-side black-face image waits for the final acceleration, then settles with the action base.

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
