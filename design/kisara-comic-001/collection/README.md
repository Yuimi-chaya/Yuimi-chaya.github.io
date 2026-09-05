# Home 001 Comic Collection

The five supplied crops have real three-tone SVG masters in this directory.
These are contour traces with cleaned paper levels, not hand-redrawn artwork
or SVG wrappers embedding the original screenshots.

Production Home 001 uses the smaller WebP derivatives in
`public/themes/kisara/assets/home-comic/`, plus the accepted portrait's light
SVG silhouette. This preserves fine facial linework and screentones while
keeping thousands of traced paths out of the animation compositor. The
accepted portrait pair is copied byte-for-byte from the original study.

`manifest.json` records the source SHA-256 hashes, original dimensions,
crop bounds, generated dimensions, contour counts, and file sizes.
`collection-review.jpg` is a compressed contact sheet, not a browser preview.
The original screenshots remain untouched and untracked in `kisara/comic/`.

Regenerate with `python "scripts/prepare-kisara-home-comic.py"` from the
repository root, using the same Pillow, NumPy, OpenCV, and scikit-image
environment as the original study. No runtime dependency was added.
`npm test` validates hashes when originals are present, verifies vector
content and runtime sizes, and rasterizes both formats with the existing
Sharp dependency. Browser composition and motion require human acceptance.
