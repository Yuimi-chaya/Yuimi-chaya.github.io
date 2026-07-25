from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "kisara"
ASSET_DIR = ROOT / "public" / "themes" / "kisara" / "assets"
OUTPUT_SIZE = (1920, 1080)


def remove_corner_mark(source: Path, destination: Path) -> Image.Image:
    encoded = np.fromfile(str(source), dtype=np.uint8)
    image = cv2.imdecode(encoded, cv2.IMREAD_COLOR)
    if image is None:
        raise FileNotFoundError(source)

    height, width = image.shape[:2]
    # The supplied captures use the same 2560x1440 framing. Keep the mask
    # proportional so the cleanup remains deterministic if a new capture is
    # exported at a different resolution later.
    sx = width / 2560
    sy = height / 1440
    x1, y1 = round(2180 * sx), round(34 * sy)
    x2, y2 = round(2460 * sx), round(184 * sy)

    mask = np.zeros((height, width), dtype=np.uint8)
    cv2.rectangle(mask, (x1, y1), (x2, y2), 255, thickness=-1)
    repaired = cv2.inpaint(image, mask, 13, cv2.INPAINT_TELEA)

    # Feather the repaired area into the original ceiling/background. This
    # avoids a hard rectangular patch around the cleaned corner.
    feather = cv2.GaussianBlur(mask, (0, 0), sigmaX=max(8, round(14 * sx)))
    alpha = feather.astype(np.float32) / 255.0
    alpha = alpha[..., None]
    blended = image.astype(np.float32) * (1.0 - alpha) + repaired.astype(np.float32) * alpha
    blended = np.clip(blended, 0, 255).astype(np.uint8)

    rgb = cv2.cvtColor(blended, cv2.COLOR_BGR2RGB)
    result = Image.fromarray(rgb, mode="RGB")
    result.save(destination, format="PNG", optimize=True)
    return result


def remove_fridge_subtitles(image: Image.Image) -> Image.Image:
    """Repair the subtitle band while keeping the foreground objects intact."""
    rgb = np.asarray(image.convert("RGB"))
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    height, width = bgr.shape[:2]
    sx = width / 2560
    sy = height / 1440

    x1, y1 = round(650 * sx), round(1230 * sy)
    x2, y2 = round(2140 * sx), round(1435 * sy)
    roi = bgr[y1:y2, x1:x2]
    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    spread = roi.max(axis=2).astype(np.int16) - roi.min(axis=2).astype(np.int16)
    candidates = cv2.bitwise_and(
        cv2.inRange(gray, 190, 255),
        cv2.inRange(spread.astype(np.uint8), 0, 90),
    )

    components, labels, stats, _ = cv2.connectedComponentsWithStats(candidates, 8)
    mask_roi = np.zeros_like(candidates)
    for index in range(1, components):
        left, top, comp_width, comp_height, area = stats[index]
        # The subtitle is the only cluster of glyph-sized bright components
        # in this lower band; ignore the large foreground highlights above it.
        if (
            104 <= top <= 190
            and 3 <= comp_height <= 78
            and 2 <= comp_width <= 110
            and area >= 3
        ):
            mask_roi[labels == index] = 255

    # Include the dark outline around each white glyph without turning the
    # whole refrigerator panel into a rectangular blurred strip.
    mask_roi = cv2.dilate(mask_roi, np.ones((19, 19), dtype=np.uint8), iterations=1)
    mask = np.zeros((height, width), dtype=np.uint8)
    mask[y1:y2, x1:x2] = mask_roi
    repaired = cv2.inpaint(bgr, mask, 13, cv2.INPAINT_TELEA)

    feather = cv2.GaussianBlur(mask, (0, 0), sigmaX=max(1.5, round(2 * sy)))
    alpha = feather.astype(np.float32) / 255.0
    alpha = alpha[..., None]
    blended = bgr.astype(np.float32) * (1.0 - alpha) + repaired.astype(np.float32) * alpha
    blended = np.clip(blended, 0, 255).astype(np.uint8)

    result = cv2.cvtColor(blended, cv2.COLOR_BGR2RGB)
    return Image.fromarray(result, mode="RGB")


def save_webp(image: Image.Image, destination: Path, quality: int) -> None:
    image.save(destination, format="WEBP", quality=quality, method=6)


def main() -> None:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    temp_dir = ROOT / ".kisara-refresh-tmp"
    temp_dir.mkdir(exist_ok=True)
    try:
        fridge_clean_path = temp_dir / "fridge-clean.png"
        game_clean_path = temp_dir / "game-clean.png"

        fridge = remove_corner_mark(SOURCE_DIR / "new0042.png", fridge_clean_path)
        fridge = remove_fridge_subtitles(fridge)
        game = remove_corner_mark(SOURCE_DIR / "new116.png", game_clean_path)

        fridge = fridge.resize(OUTPUT_SIZE, Image.Resampling.LANCZOS)
        game = game.resize(OUTPUT_SIZE, Image.Resampling.LANCZOS)

        save_webp(fridge, ASSET_DIR / "fridge-discovery-002.webp", quality=84)

        veil = fridge.filter(ImageFilter.GaussianBlur(18))
        veil = ImageEnhance.Brightness(veil).enhance(0.38)
        veil = ImageEnhance.Color(veil).enhance(0.62)
        save_webp(veil, ASSET_DIR / "fridge-discovery-002-veil.webp", quality=72)

        # Keep the existing PNG slot aligned with the new hero source for any
        # local tools that still inspect it; runtime references use WebP.
        game.save(ASSET_DIR / "game-night-hero.png", format="PNG", optimize=True)
        save_webp(game, ASSET_DIR / "game-night-hero.webp", quality=84)
    finally:
        for path in temp_dir.glob("*"):
            path.unlink(missing_ok=True)
        temp_dir.rmdir()


if __name__ == "__main__":
    main()
