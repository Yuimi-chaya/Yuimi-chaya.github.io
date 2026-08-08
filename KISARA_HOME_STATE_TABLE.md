# Kisara Home Chapter State Table

## Ownership

- One `HomeChapterController` owns all Home input, playback, transition, restoration, and lifecycle state.
- The old legacy renderer has no normal-flow ownership and is not initialized by Home.
- Every asynchronous operation carries an epoch plus a playback/transition token.
- Each chapter exposes stable entry, active, and hold states; hidden media never becomes the visible fallback.

## Public Chapters

| Index | ID | Primary behavior | Stable entry/rest | Forward contract | Backward contract | Secret behavior |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | `rescue` | auto eye clip, then two authored still cuts | `eye-hold` -> `back-hold` | first down cuts to the severed tentacle and soft-hands off to Kisara's back; next down enters Request | from back hold return to eye hold; from eye hold stay at start edge | FoundSelf may run before this chapter |
| 1 | `request` | Kisara face still -> oversized comic-paste emergence still | emerged comic hold | fresh down enters Counterattack; input during the short still sequence settles it first | fresh up returns to Rescue back hold | none |
| 2 | `counterattack` | sword entry -> automatic run/clash -> automatic impact/roll | `roll-hold` | fresh down enters Contract; input during playback settles on the roll hold | fresh up returns to Request hold | none |
| 3 | `contract` | embrace still plus three kiss stills | final kiss hold | fresh down enters Transformation; input during the still sequence settles it first | fresh up returns to Counterattack roll hold | grant spare key on the second kiss cut |
| 4 | `transformation` | explosion still -> legacy detail/silhouette/fight still sequence | fight hold | fresh down enters Jealousy; input during the still sequence settles it first | fresh up returns to Contract hold | none |
| 5 | `jealousy` | setup still -> slash continuation -> concurrent action/black-face split | `slash-hold` -> `blackface-hold` | first down runs the action and diagonal split; further down nudges end edge | from blackface return to slash hold; further up returns to Transformation hold | mark `home-jealousy`; enable eligible Lovebrain entry |

## Selected Runtime Media

Runtime directory: `public/themes/kisara/assets/home-stage/chapters/`.

| Slot | Runtime file | Source range / duration | Stable behavior |
| --- | --- | --- | --- |
| `rescue-eye` | `rescue-eye.mp4` | about `00:16:11:22-00:16:14:00`, `2.13s` | holds on the maximum eye frame |
| `rescue-severed` | `rescue-severed.webp` | selected near `0.48s` of the old slash clip | one clean severed-tentacle still |
| `rescue-back` | `rescue-slash-last.webp` | old slash clip final frame | Kisara back-view hold |
| `request-face` | `request-face.webp` | selected near `2.75s` of the old Request clip | full-bleed speaking close-up |
| `request-emerged` | `request-emerged.webp` | selected near `5.72s` of the old Request clip | complete emergence frame used as a large irregular comic paste |
| `counter-entry` | `counter-entry.mp4` | about `00:17:03.97-00:17:05.55`, `1.585s` | full relation shot into faceless sword detail |
| `counter-run` | `counter-run-scrub.mp4` | `3.23s`, 30fps short-GOP/no-B-frame derivative | now plays automatically through the run/clash |
| `counter-roll` | `counter-roll.mp4` | montage from about `00:17:08.67-00:17:09.25` and `00:17:14.39-00:17:16.57`, `2.753s` | ends with Kisara down before Shu touches her |
| `contract-stills` | `contract-embrace.webp`, `contract-kiss-01/02/03.webp` | selected from the old `25.27s` Contract clip | embrace, approach, contact, and final kiss cuts |
| `transformation-stills` | `transformation-explosion.webp`, `transformation-detail.webp`, `transformation-silhouette.webp`, `fight.webp` | explosion plus the proven legacy finale assets | compact explosion-to-fight sequence |
| `jealousy-setup` | `jealousy-setup.webp` | selected at `2.72s` | direct chapter entry hold |
| `jealousy-slash` | `jealousy-slash.mp4` | resumes at `2.72s` and hands off around `7.38s` | carries the setup into the first back-action frame |
| `jealousy-action` | `jealousy-blackface.mp4` from `0-1.08s` | duplicated action lane | remains visible as the lower-left/base composition |
| `jealousy-blackface` | `jealousy-blackface.mp4` from `1.25s` | duplicated close-up lane | plays concurrently inside the upper-right triangle |

Every remaining ordinary video keeps decoded first/hold fallbacks. Static sequences are hydrated before their chapter becomes visible, and the Request composition intentionally reads as an oversized pasted manga panel rather than a repaired in-scene loop.

## Chapter-Local Beat State

### Rescue

`entry -> eye-playing -> eye-hold -> cut-severed -> back-reveal -> back-hold`

- The diagonal cut reveals one severed-tentacle still without replaying the source flash.
- The severed frame and back-view frame use the legacy stage's decoded two-layer blur/scale handoff.

### Request

`entry -> request-face -> request-comic -> request-hold`

- The rejected kneeling loop/window is removed.
- The emergence frame enters as an intentionally irregular, doodled comic paste over the dimmed face still.

### Counterattack

`entry -> entry-playing -> entry-hold -> run-playing -> run-hold -> impact-playing -> roll-hold`

- Running and impact now auto-play as one bounded chapter sequence.
- Each incoming video remains hidden until its first decoded frame is available; the outgoing hold remains visible until then.

### Contract

`entry -> contract-embrace -> contract-kiss-1 -> contract-kiss-2 -> contract-kiss-3 -> kiss-hold`

- The four stills use the same soft two-slot handoff grammar as the proven legacy scene compositor.
- The spare-key grant is tied to the second kiss cut and remains idempotent per chapter run.

### Transformation

`entry -> transform-explosion -> transform-detail -> transform-silhouette -> transform-fight -> transform-hold`

- No legacy title/chain/black-hole renderer is layered on this chapter.
- Only the proven legacy scene stills are reused; the old long transformation video is no longer played.

### Jealousy

`entry -> slash-hold -> swing-playing -> parallel-preparing -> parallel-reveal -> parallel-playing -> blackface-hold`

- The chapter enters directly on the former first manual trigger frame.
- After the slash reaches the first back-action frame, two copies of the follow-up clip run concurrently: the action lane at `0s` and the black-face lane at `1.25s`.
- The top-left-to-bottom-right cut opens the upper-right triangle while both lanes are already moving, then both settle to independent hold images.

## Marker Navigation

- Six compact buttons mirror the six public chapters.
- `aria-current="step"` identifies the active chapter.
- Clicking a marker cancels stale media, sets an operation epoch, preloads target media, and enters only that chapter.
- Desktop markers are compact vertical signals; mobile markers form a bottom horizontal row.
- The layout's existing right-side scroll/progress rail is hidden on Home.

## Lifecycle

- `visibilitychange` and `pagehide` pause active auto, loop, and scrub media.
- `pageshow`/visible resume only media that was genuinely playing before suspension.
- BFCache restoration reuses one bound controller; route swaps abort it once.
- Reduced motion uses stable hold posters and instant chapter transitions.
- Same-tab restoration stores chapter ID plus chapter-local stable beat, never an in-flight transition.
- FoundSelf blocks normal input and audio until completed/skipped.
- Lovebrain owns input only while active; departure returns to Rescue and dispatches the established completion event.
