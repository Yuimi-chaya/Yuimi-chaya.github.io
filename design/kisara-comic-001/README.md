# Kisara Comic 001 Study

Isolated asset and composition experiment. Open `index.html` directly; no server,
dependency installation, production route, or production stylesheet is required.

## Boundaries

- Uses only the third user-supplied screenshot, `7b26cabc...png`.
- Original screenshots are read-only and are not included in this checkpoint.
- The existing Home gate, 001, 002, and their lifecycle code are unchanged.
- The optional transition preview references the existing 002 video in `public`.
- This is a sample awaiting human acceptance, not an integrated Home redesign.

## Assets

- `subject-hybrid.webp`: corrected original line/shading detail with an alpha mask.
- `subject-structure.svg`: manually authored silhouette, shared by both versions.
- `subject-vector.svg`: real vector paths in three tone groups. No embedded bitmap.
- `panel-clean.webp`: corrected full panel for the background and detail window.
- `report.json`: source hash, image dimensions, file sizes, and vector complexity.

The character interior is contour-traced, not claimed as a full manual redraw.
No AI upscaling or invented facial detail is used. The source crop remains a limit.
The grayscale screenshot's paper white is normalized from 128 to 255.

## Reproduction

From the repository root, with the already available Python environment:

```powershell
python "design/kisara-comic-001/prepare.py"
node "design/kisara-comic-001/verify.mjs"
node --test "design/kisara-comic-001/study.test.mjs"
```

The generator requires the existing Pillow, NumPy, OpenCV, and scikit-image
packages. It pins the source SHA-256 and refuses a different source. Processing
is bounded to two OpenCV threads. It rewrites only its own generated assets.

The verifier uses the repository's existing Sharp dependency to rasterize the
SVG and create a compressed review comparison. These raster checks are not
browser performance measurements or human visual acceptance.

## Preview

- Scene: switch Hybrid / Vector, replay the entrance, or preview the 002 handoff.
- Compare: inspect both versions at the same crop and zoom.
- The 002 preview is media-only; the live inventory interaction is not duplicated.
- There is no wheel interception, autoplaying video, or continuous render loop.
- The black cover waits for a decoded frame and then fades over 160ms because
  the refrigerator footage begins in blue-black rather than pure black.
- Eight DOM-fixture tests cover media readiness, seeking, replay cancellation,
  reduced motion, visibility, load failures, view switching, and zoom. These
  complement the asset checks but do not substitute for a real browser review.
