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
| 2 | `counterattack` | roll/landing still | `counter-action.mp4`, about `0.43s` | enters Contract directly | restores Request stable frame | none |
| 3 | `contract` | final kiss still | static embrace-to-kiss keyframe action, about `0.62s` | enters Transformation directly | restores Counterattack stable frame | grant spare key on stable arrival |
| 4 | `transformation` | Fight still | static explosion/detail/silhouette reconstruction, about `0.66s` | enters Jealousy and starts its slash immediately | restores Contract stable frame | none |
| 5 | `jealousy` | completed action plus right comic panel | `jealousy-action.mp4`, about `0.46s`, then static panel settle | edge nudge; Lovebrain may be activated after settle | restores Transformation stable frame | mark `home-jealousy` on final settle |

## Runtime Media

Runtime directory: `public/themes/kisara/assets/home-stage/chapters/`.

| Slot | Runtime file | Role |
| --- | --- | --- |
| Rescue action | `rescue-action.mp4` | selected eye rush only; no source white flash |
| Rescue stable | `rescue-eye-last.webp` | maximum-eye scene hold |
| Rescue bridge | `rescue-severed.webp`, `rescue-slash-last.webp` | static outgoing relation during Rescue -> Request |
| Request stable | `request-emerged.webp` | oversized manga/OP paste hold |
| Request source | `request-face.webp` | dimmed source still below the paste |
| Counter action | `counter-action.mp4` | selected sword/run/contact montage, no wheel scrub |
| Counter stable | `counter-roll-last.webp` | landing/roll hold and Counter action fallback |
| Contract stable | `contract-kiss-03.webp` | final kiss hold |
| Contract cuts | `contract-embrace.webp`, `contract-kiss-01.webp`, `contract-kiss-02.webp` | static keyframe action only |
| Transformation stable | `fight.webp` | final Fight hold |
| Transformation cuts | `transformation-explosion.webp`, `transformation-detail.webp`, `transformation-silhouette.webp` | static reconstruction keyframes only |
| Jealousy action | `jealousy-action.mp4` | selected closed-mouth turn to slash, no long prelude |
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

- The purpose-cut clip contains only the sword/run/contact beats. The landing frame is static below the action layer.
- There is no scrub state, seek queue, or extra gesture for impact/roll.

### Contract

`scene-active -> action-running -> settled`

- Embrace, approach, and kiss are static cuts inside one bounded CSS action. No internal wheel stops exist.
- The stable qualification point is the final kiss composition and is idempotent.

### Transformation

`scene-active -> action-running -> settled`

- Explosion, detail, silhouette, and Fight are static layers with a short timed reconstruction. The legacy title/chain/black-hole renderer remains absent.

### Jealousy

`scene-active -> action-running -> final`

- The slash video starts as part of entering Jealousy from Transformation. The user never needs a second forward gesture to start it.
- The right-side black-face image enters as a single clean comic region and settles with the action base.

## Input And Restoration

- Fixed viewport; the document does not scroll during the Home performance.
- Wheel intent is grouped after roughly `180ms` silence with a threshold of `42` and an input lock around `720ms`.
- One successful gesture changes at most one public scene. Momentum tails are discarded and never consumed as a hidden internal beat.
- Touch, keyboard, marker click, and replay use the same scene owner.
- Marker jumps preload only the target scene and run its short entry action once.
- Same-tab restoration stores `{ version: 2, scene, stable }` and returns directly to the stable composition.
- Hidden-tab, BFCache, and route cleanup pause/cancel short media without revealing stale frames or replaying a scene unexpectedly.
- Reduced motion restores the final stable scene without action playback.

## External Protocols To Preserve

- FoundSelf ticket, skip, audio suspension, hidden-tab recovery, completion event, and one-shot behavior.
- Lovebrain qualification, activation, departure, return, and persistent-player behavior.
- `kokoro-spare-key`, `photo-archive`, `home-jealousy`, secret audio, and same-tab ledger behavior.
- `kisara:gate-progress`, Home boot-ready, `astro:before-swap`, `pagehide`, `pageshow`, and visibility cleanup.
