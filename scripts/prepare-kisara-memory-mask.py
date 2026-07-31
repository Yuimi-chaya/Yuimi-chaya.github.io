from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "public/themes/kisara/assets/opening-memory-001-mask.png"


def build_mask(width: int, height: int) -> Image.Image:
    scale_x = width / 960
    scale_y = height / 540

    def points(values: list[tuple[float, float]]):
        return [(round(x * scale_x), round(y * scale_y)) for x, y in values]

    shape = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(shape, "L")
    draw.polygon(points([
        (18, 276), (34, 242), (66, 220), (112, 205), (164, 190),
        (206, 164), (258, 148), (304, 154), (344, 170), (394, 178),
        (446, 166), (492, 184), (536, 174), (580, 198), (624, 194), (648, 218),
        (696, 220), (714, 254), (758, 281), (742, 316), (782, 340),
        (746, 374), (756, 410), (704, 418), (674, 450), (620, 442),
        (580, 474), (522, 458), (480, 488), (423, 468), (376, 496),
        (320, 470), (267, 494), (218, 466), (166, 482), (130, 450),
        (77, 454), (58, 420), (30, 408), (16, 374),
    ]), fill=255)

    # Tapered brush traces extend the photo without forming a second closed frame.
    for trace, alpha in [
        ([(520, 208), (676, 222), (812, 286), (856, 318), (790, 330), (660, 292)], 176),
        ([(176, 452), (356, 476), (560, 470), (744, 446), (804, 464), (650, 504), (390, 518), (204, 492)], 184),
    ]:
        draw.polygon(points(trace), fill=alpha)

    feather_radius = max(9, int(16 * min(scale_x, scale_y)))
    feather = shape.filter(ImageFilter.GaussianBlur(feather_radius))
    inner = shape.filter(ImageFilter.GaussianBlur(max(3, int(5 * min(scale_x, scale_y)))))

    rng = np.random.default_rng(20260730)
    low = Image.fromarray(
        rng.integers(0, 256, (max(12, height // 18), max(18, width // 18)), dtype=np.uint8),
        mode="L",
    ).resize((width, height), Image.Resampling.BICUBIC)
    low = low.filter(ImageFilter.GaussianBlur(max(2, int(4 * min(scale_x, scale_y)))))
    medium = Image.fromarray(
        rng.integers(0, 256, (max(24, height // 7), max(36, width // 7)), dtype=np.uint8),
        mode="L",
    ).resize((width, height), Image.Resampling.BICUBIC)
    medium = medium.filter(ImageFilter.GaussianBlur(max(1, int(1.5 * min(scale_x, scale_y)))))

    field = np.asarray(feather, dtype=np.float32) / 255.0
    low_noise = np.asarray(low, dtype=np.float32) / 255.0 - 0.5
    medium_noise = np.asarray(medium, dtype=np.float32) / 255.0 - 0.5
    edge_weight = np.clip(1.0 - np.abs(field * 2.0 - 1.0), 0.0, 1.0) ** 0.68
    field = field + (low_noise * 0.3 + medium_noise * 0.09) * edge_weight
    alpha = np.clip((field - 0.035) / 0.82, 0.0, 1.0)
    alpha = alpha * alpha * (3.0 - 2.0 * alpha)
    textured = Image.fromarray(np.uint8(alpha * 255), mode="L")

    # Preserve a calm readable center while leaving the perimeter mottled.
    inner = inner.point(lambda value: max(0, min(255, int((value - 36) * 1.22))))
    return ImageChops.lighter(textured, inner)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the Kisara 001 watercolor reveal mask.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--width", type=int, default=960)
    parser.add_argument("--height", type=int, default=540)
    args = parser.parse_args()

    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    alpha = build_mask(args.width, args.height)
    result = Image.new("RGBA", alpha.size, (255, 255, 255, 0))
    result.putalpha(alpha)
    result.save(output, optimize=True)
    print(output)


if __name__ == "__main__":
    main()
