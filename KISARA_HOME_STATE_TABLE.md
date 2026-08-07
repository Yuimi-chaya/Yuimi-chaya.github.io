# Kisara Home Chapter State Table

## Ownership

- One `HomeChapterController` owns all Home input, playback, transition, restoration, and lifecycle state.
- The old legacy renderer has no normal-flow ownership and is not initialized by Home.
- Every asynchronous operation carries an epoch plus a playback/transition token.
- Each chapter exposes stable entry, active, and hold states; hidden media never becomes the visible fallback.

## Public Chapters

| Index | ID | Primary behavior | Stable entry/rest | Forward contract | Backward contract | Secret behavior |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | `rescue` | auto eye clip, then authored slash continuation | `eye-hold` -> `back-hold` | first down runs slash/tentacle continuation; next down enters Request | from back hold return to eye hold; from eye hold stay at start edge | FoundSelf may run before this chapter |
| 1 | `request` | auto complaint background plus kneeling loop overlay | complaint/background hold with active Shu loop | fresh down enters Counterattack | fresh up returns to Rescue back hold | none |
| 2 | `counterattack` | auto sword entry -> reversible running scrub -> clash/roll montage | `run-ready`, scrub position, or `roll-hold` | down advances scrub; completion runs montage; fresh down from roll hold enters Contract | up reverses scrub or returns to Request hold | none |
| 3 | `contract` | continuous embrace/spoiled/kiss auto clip | kiss hold | fresh down enters Transformation | fresh up returns to Counterattack roll hold | grant spare key at decoded kiss threshold |
| 4 | `transformation` | independent automatic transformation clip | transformation/attack hold | fresh down enters Jealousy | fresh up returns to Contract hold | none |
| 5 | `jealousy` | auto slash setup, then diagonal reveal into black-face follow-up | `slash-hold` -> `blackface-hold` | first down runs diagonal reveal; further down nudges end edge | from blackface return to slash hold; further up returns to Transformation hold | mark `home-jealousy`; enable eligible Lovebrain entry |

## Selected Runtime Media

Runtime directory: `public/themes/kisara/assets/home-stage/chapters/`.

| Slot | Runtime file | Source range / duration | Stable behavior |
| --- | --- | --- | --- |
| `rescue-eye` | `rescue-eye.mp4` | about `00:16:11:22-00:16:14:00`, `2.13s` | holds on the maximum eye frame |
| `rescue-slash` | `rescue-slash.mp4` | about `00:16:15.25-00:16:20.63`, `5.38s` | begins after the source flash and holds on Kisara's back |
| `request-background` | `request-background.mp4` | about `00:16:30.75-00:16:36.75`, `6.01s` | holds on the wide request composition |
| `request-shu-loop` | `request-shu-loop.mp4` | ping-pong derivative of `00:16:35.00-00:16:35.50`, about `1s` | complete kneeling Shu crop at source-space `x=560, y=420, w=380, h=500` |
| `counter-entry` | `counter-entry.mp4` | about `00:17:03.97-00:17:05.55`, `1.585s` | full relation shot into faceless sword detail |
| `counter-run-scrub` | `counter-run-scrub.mp4` | `3.23s`, 30fps short-GOP/no-B-frame derivative | reversible queued wheel/touch scrub |
| `counter-roll` | `counter-roll.mp4` | montage from about `00:17:08.67-00:17:09.25` and `00:17:14.39-00:17:16.57`, `2.753s` | ends with Kisara down before Shu touches her |
| `contract-kiss` | `contract-kiss.mp4` | `25.27s` | in-arms request through stable kiss hold |
| `transformation` | `transformation.mp4` | `18.31s` | smoke through transformed attack hold |
| `jealousy-slash` | `jealousy-slash.mp4` | `8.01s` | holds at the authored sword trigger |
| `jealousy-blackface` | `jealousy-blackface.mp4` | `2.25s` | resolves to the red-eye black-face close-up |

Every ordinary video has matching `-first.webp` and `-last.webp` posters. The Request background and kneeling loop share one centered 16:9 coordinate space so the portrait crop stays aligned under `object-fit: cover`; it is not positioned as a free-floating card.

## Chapter-Local Beat State

### Rescue

`entry -> eye-playing -> eye-hold -> slash-transition -> slash-playing -> back-hold`

- Incoming slash media is decoded and started behind the diagonal mask before the mask opens.
- Original blade-flash frames are not present in the runtime clip.

### Request

`entry -> complaint-playing -> request-hold`

- The cropped Shu loop begins only after its first decoded frame is ready.
- Background and loop pause together when hidden and resume without phase reset.

### Counterattack

`entry -> sword-playing -> run-ready -> run-scrub -> montage-playing -> roll-hold`

- Scrub input changes a target ratio.
- One RAF smooths visible ratio.
- Only one seek is in flight; the latest target replaces older queued targets.
- Reversing direction reverses the same scrub media instead of switching clips.

### Contract

`entry -> contract-playing -> kiss-hold`

- The spare-key threshold is tied to decoded media time and is idempotent per chapter run.

### Transformation

`entry -> transform-playing -> transform-hold`

- No legacy title/chain/black-hole renderer is layered on this chapter.

### Jealousy

`entry -> slash-playing -> slash-hold -> diagonal-reveal -> blackface-playing -> blackface-hold`

- The black-face clip starts beneath the mask before reveal.
- The outgoing slash video stays frozen at its authored trigger frame.

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
