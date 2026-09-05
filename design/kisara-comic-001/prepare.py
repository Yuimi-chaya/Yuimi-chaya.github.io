"""Build an isolated comic study using existing local image-processing tools."""

import gzip
import hashlib
import json
import os
from pathlib import Path
from time import perf_counter

os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("OMP_NUM_THREADS", "2")

import cv2
import numpy as np
from PIL import Image, ImageDraw
from skimage.measure import approximate_polygon, find_contours


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "kisara/comic/7b26cabc-16c0-4c1b-8afa-3b05643aaa3e.png"
OUTPUT = Path(__file__).resolve().parent / "assets"
SOURCE_HASH = "3592b9c18c611019631cb3b99463a4b767fe2bb967f766b81507d4fefe703d08"
cv2.setNumThreads(2)

# Authored around this source's visible silhouette, in a 671 x 1024 review space.
# Nothing outside the original crop is invented. Both variants use this mask.
OUTLINE = [
    ("M", [(239, 0)]),
    ("C", [(210, 10), (185, 36), (163, 60)]),
    ("C", [(136, 77), (119, 117), (106, 161)]),
    ("C", [(90, 192), (81, 232), (80, 264)]),
    ("C", [(77, 294), (91, 320), (105, 329)]),
    ("C", [(103, 349), (102, 377), (115, 408)]),
    ("L", [(112, 428)]),
    ("C", [(96, 440), (100, 470), (77, 508)]),
    ("C", [(56, 548), (29, 584), (0, 612)]),
    ("L", [(0, 672)]),
    ("C", [(11, 660), (25, 652), (33, 647)]),
    ("C", [(10, 690), (1, 732), (1, 772)]),
    ("C", [(3, 796), (13, 804), (25, 811)]),
    ("C", [(9, 795), (15, 767), (18, 756)]),
    ("C", [(25, 793), (33, 817), (43, 844)]),
    ("C", [(52, 861), (66, 864), (83, 862)]),
    ("C", [(78, 922), (77, 976), (82, 1024)]),
    ("L", [(553, 1024)]),
    ("C", [(556, 992), (560, 973), (566, 953)]),
    ("L", [(640, 850)]),
    ("C", [(656, 834), (665, 821), (671, 808)]),
    ("L", [(671, 621)]),
    ("C", [(622, 591), (568, 546), (541, 513)]),
    ("C", [(530, 477), (522, 443), (509, 413)]),
    ("C", [(530, 384), (540, 345), (534, 310)]),
    ("C", [(530, 272), (515, 232), (502, 210)]),
    ("C", [(482, 150), (461, 96), (414, 52)]),
    ("C", [(390, 29), (368, 22), (346, 16)]),
    ("C", [(319, 3), (274, -4), (239, 0)]),
]


def outline_geometry(width, height):
    scale = np.array([width / 671, height / 1024])
    samples, commands = [], []
    previous = None
    for command, raw in OUTLINE:
        points = np.array(raw, dtype=float) * scale
        commands.append(command + " ".join(f"{x:.2f} {y:.2f}" for x, y in points))
        if command == "C":
            a, b, c = points
            for t in np.linspace(0, 1, 24)[1:]:
                samples.append(
                    (1 - t) ** 3 * previous
                    + 3 * (1 - t) ** 2 * t * a
                    + 3 * (1 - t) * t * t * b
                    + t ** 3 * c
                )
        else:
            samples.append(points[-1])
        previous = points[-1]
    return commands, samples


def vector_layer(intensity, mask, threshold, name, color):
    # Marching squares keeps subpixel boundaries; holes share one even-odd path.
    coverage = np.clip((threshold - intensity) / 0.065 + 0.5, 0, 1) * mask
    contours = find_contours(np.pad(coverage, 1), 0.5, fully_connected="high")
    paths, vertices, kept = [], 0, 0
    for contour in contours:
        contour = contour[:, ::-1] - 1
        center = contour.mean(axis=0)
        is_face = 185 < center[0] < 500 and 190 < center[1] < 440
        tolerance = 0.24 if is_face else 0.46
        area = abs(cv2.contourArea(contour.astype(np.float32)))
        if area < (0.6 if is_face else 2.1):
            continue
        points = approximate_polygon(contour, tolerance=tolerance)
        if len(points) < 4:
            continue
        points = points[:-1] if np.allclose(points[0], points[-1]) else points
        paths.append("M" + " ".join(f"{x:.1f},{y:.1f}" for x, y in points) + "Z")
        vertices += len(points)
        kept += 1
    group = (
        f'<g id="{name}" fill="{color}" fill-rule="evenodd">'
        f'<path d="{"".join(paths)}"/></g>'
    )
    return group, {"id": name, "contours": kept, "vertices": vertices}


def main():
    started = perf_counter()
    original = SOURCE.read_bytes()
    digest = hashlib.sha256(original).hexdigest()
    if digest != SOURCE_HASH:
        raise ValueError("Source changed: review the new image before regenerating its mask.")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    image = Image.open(SOURCE).convert("L")
    width, height = image.size
    raw = np.asarray(image, dtype=np.float32)
    # The source screenshot's modal paper value is 128, not 255.
    paper = float(np.percentile(raw, 90))
    cleaned = np.clip(raw / paper, 0, 1)
    gray = np.round(cleaned * 255).astype(np.uint8)
    Image.fromarray(gray).save(OUTPUT / "panel-clean.webp", quality=91, method=6)
    source_review = image.copy()
    source_review.thumbnail((420, 650))
    source_review.save(OUTPUT / "source-review.webp", quality=83, method=6)

    commands, samples = outline_geometry(width, height)
    path = " ".join(commands) + "Z"
    mask_image = Image.new("L", (width * 3, height * 3))
    ImageDraw.Draw(mask_image).polygon(
        [(float(point[0] * 3), float(point[1] * 3)) for point in samples],
        fill=255,
    )
    mask_image = mask_image.resize((width, height), Image.Resampling.LANCZOS)
    mask = np.asarray(mask_image, dtype=np.float32) / 255
    portrait = Image.fromarray(gray).convert("RGBA")
    portrait.putalpha(mask_image)
    portrait.save(OUTPUT / "subject-hybrid.webp", quality=94, method=6)

    svg_start = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'width="{width}" height="{height}">'
    )
    (OUTPUT / "subject-structure.svg").write_text(
        svg_start
        + '<title>Kisara authored silhouette</title>'
        + f'<path id="subject-paper" fill="#fff" d="{path}"/>'
        + "</svg>",
        encoding="utf-8",
    )

    smooth = cv2.bilateralFilter(gray, 5, 14, 2).astype(np.float32) / 255
    groups, layers = [], []
    for threshold, name, color in [
        (0.90, "light-tone", "#cecece"),
        (0.69, "middle-tone", "#828282"),
        (0.44, "key-ink", "#121212"),
    ]:
        group, metrics = vector_layer(smooth, mask, threshold, name, color)
        groups.append(group)
        layers.append(metrics)
    svg = (
        svg_start
        + "<title>Kisara three-tone vector study</title>"
        + "<desc>Source-derived contour tracing and an authored silhouette; no raster image.</desc>"
        + f'<path id="subject-paper" fill="#fff" d="{path}"/>'
        + "".join(groups)
        + "</svg>"
    )
    (OUTPUT / "subject-vector.svg").write_text(svg, encoding="utf-8")

    files = {
        name: (OUTPUT / name).stat().st_size
        for name in (
            "subject-hybrid.webp", "subject-structure.svg", "subject-vector.svg",
            "panel-clean.webp", "source-review.webp",
        )
    }
    report = {
        "source": str(SOURCE.relative_to(ROOT)).replace("\\", "/"),
        "sourceSha256": digest,
        "sourceBytes": len(original),
        "width": width,
        "height": height,
        "paperWhite": paper,
        "files": files,
        "vectorGzipBytes": len(gzip.compress(svg.encode(), mtime=0)),
        "layers": layers,
        "contours": sum(layer["contours"] for layer in layers),
        "vertices": sum(layer["vertices"] for layer in layers),
        "hybridBundleBytes": files["subject-hybrid.webp"] + files["subject-structure.svg"],
        "generationSeconds": round(perf_counter() - started, 3),
        "note": "File sizes and geometry counts, not browser frame-time measurements.",
    }
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != digest:
        raise ValueError("Original source changed during processing.")
    payload = json.dumps(report, indent=2, ensure_ascii=True)
    (OUTPUT / "report.json").write_text(payload + "\n", encoding="utf-8")
    (OUTPUT / "metrics.js").write_text(
        "window.comicStudyMetrics = " + payload + ";\n", encoding="utf-8"
    )
    print(payload)


if __name__ == "__main__":
    main()
