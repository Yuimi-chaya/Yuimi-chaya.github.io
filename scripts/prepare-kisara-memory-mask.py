from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "public/themes/kisara/assets/opening-memory-001-mask.png"


def make_points(values: list[tuple[float, float]], width: int, height: int):
    scale_x = width / 960
    scale_y = height / 540
    return [(round(x * scale_x), round(y * scale_y)) for x, y in values]


def texture_mask(shape: Image.Image, *, seed: int) -> Image.Image:
    width, height = shape.size
    scale = min(width / 960, height / 540)
    feather_radius = max(9, int(16 * scale))
    feather = shape.filter(ImageFilter.GaussianBlur(feather_radius))
    inner = shape.filter(ImageFilter.GaussianBlur(max(3, int(5 * scale))))

    rng = np.random.default_rng(seed)
    low = Image.fromarray(
        rng.integers(0, 256, (max(12, height // 18), max(18, width // 18)), dtype=np.uint8),
        mode="L",
    ).resize((width, height), Image.Resampling.BICUBIC)
    low = low.filter(ImageFilter.GaussianBlur(max(2, int(4 * scale))))
    medium = Image.fromarray(
        rng.integers(0, 256, (max(24, height // 7), max(36, width // 7)), dtype=np.uint8),
        mode="L",
    ).resize((width, height), Image.Resampling.BICUBIC)
    medium = medium.filter(ImageFilter.GaussianBlur(max(1, int(1.5 * scale))))

    field = np.asarray(feather, dtype=np.float32) / 255.0
    low_noise = np.asarray(low, dtype=np.float32) / 255.0 - 0.5
    medium_noise = np.asarray(medium, dtype=np.float32) / 255.0 - 0.5
    edge_weight = np.clip(1.0 - np.abs(field * 2.0 - 1.0), 0.0, 1.0) ** 0.68
    field = field + (low_noise * 0.3 + medium_noise * 0.09) * edge_weight
    alpha = np.clip((field - 0.035) / 0.82, 0.0, 1.0)
    alpha = alpha * alpha * (3.0 - 2.0 * alpha)
    textured = Image.fromarray(np.uint8(alpha * 255), mode="L")
    inner = inner.point(lambda value: max(0, min(255, int((value - 36) * 1.22))))
    return ImageChops.lighter(textured, inner)


def to_rgba(alpha: Image.Image) -> Image.Image:
    result = Image.new("RGBA", alpha.size, (255, 255, 255, 0))
    result.putalpha(alpha)
    return result


def build_mask(width: int, height: int) -> Image.Image:
    shape = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(shape, "L")

    draw.polygon(make_points([
        (30, 292), (46, 254), (92, 226), (146, 202), (198, 174),
        (250, 152), (304, 158), (348, 178), (396, 172), (446, 184),
        (498, 178), (548, 190), (596, 204), (642, 226), (684, 248),
        (720, 278), (748, 308), (736, 336), (744, 360), (718, 388),
        (726, 414), (684, 432), (648, 454), (604, 460), (560, 478),
        (512, 466), (468, 486), (420, 472), (374, 494), (328, 476),
        (280, 488), (238, 466), (192, 474), (154, 448), (112, 454),
        (86, 426), (54, 420), (38, 388), (24, 356),
    ], width, height), fill=255)

    return texture_mask(shape, seed=20260730)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the Kisara 001 watercolor reveal mask.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--width", type=int, default=960)
    parser.add_argument("--height", type=int, default=540)
    args = parser.parse_args()

    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    to_rgba(build_mask(args.width, args.height)).save(output, optimize=True)
    print(output)


if __name__ == "__main__":
    main()
