from __future__ import annotations

import argparse
from collections import deque
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "kisara" / "Q.png"
DEFAULT_OUTPUT = ROOT / "public" / "themes" / "kisara" / "assets" / "chibi"
DEFAULT_SCALE = 2

CHARACTERS = (
    {
        "name": "kisara",
        "label": "Kisara",
        "crop": (72, 18, 307, 266),
    },
    {
        "name": "ayano",
        "label": "Ayano",
        "crop": (24, 220, 199, 475),
    },
    {
        "name": "sharon",
        "label": "Sharon",
        "crop": (184, 219, 425, 478),
    },
    {
        "name": "shu",
        "label": "Shu",
        "crop": (412, 202, 600, 487),
    },
)


def connected_white_background(rgb: np.ndarray) -> np.ndarray:
    """Find only near-white pixels connected to a crop edge.

    Keeping the search edge-connected preserves white clothing and eye highlights
    enclosed by the character line art while removing the white source canvas.
    """

    lightness = rgb.min(axis=2)
    channel_spread = rgb.max(axis=2) - lightness
    candidate = (lightness >= 238) & (channel_spread <= 22)
    height, width = candidate.shape
    visited = np.zeros((height, width), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    def seed(x: int, y: int) -> None:
        if candidate[y, x] and not visited[y, x]:
            visited[y, x] = True
            queue.append((x, y))

    for x in range(width):
        seed(x, 0)
        seed(x, height - 1)
    for y in range(height):
        seed(0, y)
        seed(width - 1, y)

    while queue:
        x, y = queue.popleft()
        for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if (
                0 <= next_x < width
                and 0 <= next_y < height
                and candidate[next_y, next_x]
                and not visited[next_y, next_x]
            ):
                visited[next_y, next_x] = True
                queue.append((next_x, next_y))

    return visited


def remove_white_canvas(crop: Image.Image) -> Image.Image:
    rgb = np.asarray(crop.convert("RGB"), dtype=np.uint8)
    background = connected_white_background(rgb)
    foreground = ~background
    core = cv2.erode(
        foreground.astype(np.uint8),
        np.ones((3, 3), dtype=np.uint8),
        iterations=1,
    )
    hard_alpha = (core * 255).astype(np.uint8)

    # Feather only inward. Blurring into the removed white canvas would make its
    # RGB values visible again as a pale fringe on the dark footer.
    softened = np.asarray(
        Image.fromarray(hard_alpha, mode="L").filter(ImageFilter.GaussianBlur(0.62)),
        dtype=np.uint8,
    )
    alpha = np.where(foreground, softened, 0).astype(np.uint8)

    # The source was antialiased against white. Reverse that matte for partially
    # transparent edge pixels so their RGB color belongs to the character itself.
    alpha_float = alpha.astype(np.float32) / 255.0
    color = rgb.astype(np.float32)
    edge = (alpha > 0) & (alpha < 252)
    safe_alpha = np.maximum(alpha_float, 1 / 255.0)[..., None]
    unmatted = (color - 255.0 * (1.0 - safe_alpha)) / safe_alpha
    color[edge] = np.clip(unmatted, 0, 255)[edge]

    # Pull the outer one-to-two pixels toward nearby line-art colors. This
    # removes the final pale antialias fringe without shrinking the silhouette.
    inside_distance = cv2.distanceTransform((alpha > 0).astype(np.uint8), cv2.DIST_L2, 3)
    rim = (inside_distance > 0) & (inside_distance < 2.7)
    darker_neighbor = np.asarray(
        Image.fromarray(color.astype(np.uint8), mode="RGB").filter(ImageFilter.MinFilter(3)),
        dtype=np.float32,
    )
    rim_mix = (np.clip((2.7 - inside_distance) / 2.7, 0, 0.82) * rim)[..., None]
    color = color * (1.0 - rim_mix) + darker_neighbor * rim_mix

    rgba = np.dstack((color.astype(np.uint8), alpha))
    return Image.fromarray(rgba, mode="RGBA")


def remove_source_intrusions(image: Image.Image, name: str) -> Image.Image:
    if name != "shu":
        return image

    rgba = np.asarray(image, dtype=np.uint8).copy()
    height, width = rgba.shape[:2]
    region_y = min(31, height)
    region_x_start = min(78, width)
    region_x_end = min(118, width)
    region = rgba[:region_y, region_x_start:region_x_end]
    magenta = (
        (region[..., 0] > 105)
        & (region[..., 0] > region[..., 1] * 1.16)
        & (region[..., 2] > region[..., 1] * 1.04)
        & (region[..., 3] > 0)
    ).astype(np.uint8)
    if np.any(magenta):
        strand = cv2.dilate(magenta, np.ones((5, 5), dtype=np.uint8), iterations=1)
        strand[21:, :] = 0
        region[..., 3] = np.where(strand > 0, 0, region[..., 3])
        rgba[:region_y, region_x_start:region_x_end] = region
    return Image.fromarray(rgba, mode="RGBA")


def keep_character_components(image: Image.Image, name: str) -> Image.Image:
    alpha = np.asarray(image.getchannel("A"), dtype=np.uint8)
    count, labels, stats, centroids = cv2.connectedComponentsWithStats(
        (alpha > 96).astype(np.uint8),
        connectivity=8,
    )
    if count <= 1:
        raise ValueError(f"No foreground components found for {name}")

    main_label = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
    keep_labels = {main_label}
    main_top = int(stats[main_label, cv2.CC_STAT_TOP])
    main_bottom = main_top + int(stats[main_label, cv2.CC_STAT_HEIGHT])

    # Kisara's tiny floating hearts are separate components; neighboring heads
    # and the source logo are much larger and sit near the crop boundaries.
    if name == "kisara":
        for label in range(1, count):
            if label == main_label:
                continue
            area = int(stats[label, cv2.CC_STAT_AREA])
            center_y = float(centroids[label, 1])
            if 18 <= area <= 220 and main_top + 28 <= center_y <= main_bottom - 42:
                keep_labels.add(label)

    keep = np.isin(labels, tuple(keep_labels)).astype(np.uint8)
    keep = cv2.dilate(keep, np.ones((5, 5), dtype=np.uint8), iterations=1)
    cleaned_alpha = np.where(keep > 0, alpha, 0).astype(np.uint8)
    cleaned = image.copy()
    cleaned.putalpha(Image.fromarray(cleaned_alpha, mode="L"))
    return cleaned


def trim_transparency(image: Image.Image, padding: int = 6) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError("Generated character layer is empty")

    left, top, right, bottom = bbox
    left = max(0, left - padding)
    top = max(0, top - padding)
    right = min(image.width, right + padding)
    bottom = min(image.height, bottom + padding)
    return image.crop((left, top, right, bottom))


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract the four footer chibis from Kisara Q.png.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--scale", type=int, default=DEFAULT_SCALE)
    args = parser.parse_args()

    source_path = args.source.resolve()
    output_path = args.output.resolve()
    if not source_path.exists():
        raise FileNotFoundError(source_path)
    if args.scale <= 0:
        raise ValueError("--scale must be greater than zero")

    source = Image.open(source_path).convert("RGB")
    output_path.mkdir(parents=True, exist_ok=True)

    for character in CHARACTERS:
        layer = source.crop(character["crop"])
        layer = remove_white_canvas(layer)
        layer = keep_character_components(layer, character["name"])
        layer = remove_source_intrusions(layer, character["name"])
        layer = trim_transparency(layer)
        if args.scale != 1:
            layer = layer.resize(
                (layer.width * args.scale, layer.height * args.scale),
                Image.Resampling.LANCZOS,
            )
        destination = output_path / f"{character['name']}.png"
        layer.save(destination, "PNG", optimize=True)
        print(f"{character['label']}: {layer.width}x{layer.height} -> {destination}")


if __name__ == "__main__":
    main()
