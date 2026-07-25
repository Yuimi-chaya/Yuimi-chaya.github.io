from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "public" / "themes" / "kisara" / "assets" / "opening-memory-ink-mask.png"
DEFAULT_GRAIN_OUTPUT = ROOT / "public" / "themes" / "kisara" / "assets" / "opening-memory-grain.webp"
DEFAULT_WIDTH = 1280
DEFAULT_HEIGHT = 1000
SEED = 20260725


def resized_noise(
    rng: np.random.Generator,
    width: int,
    height: int,
    columns: int,
    rows: int,
) -> np.ndarray:
    source = (rng.random((rows, columns)) * 255).astype(np.uint8)
    image = Image.fromarray(source, mode="L").resize(
        (width, height),
        Image.Resampling.BICUBIC,
    )
    return np.asarray(image, dtype=np.float32) / 255.0


def noise_curve(
    rng: np.random.Generator,
    length: int,
    controls: int,
) -> np.ndarray:
    source = (rng.random((1, controls)) * 255).astype(np.uint8)
    image = Image.fromarray(source, mode="L").resize(
        (length, 1),
        Image.Resampling.BICUBIC,
    )
    return np.asarray(image, dtype=np.float32)[0] / 255.0


def smoothstep(start: float, end: float, value: np.ndarray) -> np.ndarray:
    amount = np.clip((value - start) / (end - start), 0.0, 1.0)
    return amount * amount * (3.0 - 2.0 * amount)


def draw_ink_extensions(
    rng: np.random.Generator,
    width: int,
    height: int,
    right_edge: np.ndarray,
    bottom_edge: np.ndarray,
) -> np.ndarray:
    body = Image.new("L", (width, height), 0)
    haze = Image.new("L", (width, height), 0)
    body_draw = ImageDraw.Draw(body)
    haze_draw = ImageDraw.Draw(haze)

    for _ in range(38):
        y = int(rng.uniform(0.07, 0.94) * height)
        edge_x = int(right_edge[y] * width)
        reach = int(rng.uniform(0.025, 0.12) * width)
        rise = int(rng.normal(0, height * 0.022))
        thickness = int(rng.uniform(9, 31))
        strength = int(rng.uniform(18, 72))
        center_x = edge_x + int(reach * rng.uniform(0.38, 0.68))
        center_y = y + int(rise * 0.64)
        points = [
            (edge_x - int(rng.uniform(8, 30)), y),
            (center_x, center_y),
            (edge_x + reach, y + rise),
        ]
        body_draw.line(points, fill=strength, width=thickness, joint="curve")
        haze_draw.line(
            points,
            fill=max(10, int(strength * 0.56)),
            width=max(18, thickness * 2),
            joint="curve",
        )
        radius_x = int(reach * rng.uniform(0.3, 0.58))
        radius_y = int(rng.uniform(9, 42))
        body_draw.ellipse(
            (
                center_x - radius_x,
                center_y - radius_y,
                center_x + radius_x,
                center_y + radius_y,
            ),
            fill=max(12, int(strength * 0.76)),
        )

    for _ in range(32):
        x = int(rng.uniform(0.2, 0.9) * width)
        edge_y = int(bottom_edge[x] * height)
        drift = int(rng.normal(0, width * 0.024))
        sink = int(rng.uniform(0.012, 0.065) * height)
        strength = int(rng.uniform(16, 66))
        center_x = x + drift
        center_y = edge_y + sink
        radius_x = int(rng.uniform(22, 82))
        radius_y = int(rng.uniform(9, 34))
        body_draw.ellipse(
            (
                center_x - radius_x,
                center_y - radius_y,
                center_x + radius_x,
                center_y + radius_y,
            ),
            fill=max(11, int(strength * 0.72)),
        )
        haze_draw.ellipse(
            (
                center_x - int(radius_x * 1.35),
                center_y - int(radius_y * 1.8),
                center_x + int(radius_x * 1.35),
                center_y + int(radius_y * 1.8),
            ),
            fill=max(8, int(strength * 0.48)),
        )

    body_alpha = np.asarray(
        body.filter(ImageFilter.GaussianBlur(4.2)),
        dtype=np.float32,
    ) / 255.0
    haze_alpha = np.asarray(
        haze.filter(ImageFilter.GaussianBlur(16.5)),
        dtype=np.float32,
    ) / 255.0
    return np.maximum(body_alpha * 0.76, haze_alpha * 0.86)


def draw_edge_notches(
    rng: np.random.Generator,
    width: int,
    height: int,
    right_edge: np.ndarray,
    bottom_edge: np.ndarray,
) -> np.ndarray:
    image = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(image)

    for _ in range(34):
        y = int(rng.uniform(0.04, 0.96) * height)
        x = int(right_edge[y] * width + rng.normal(0, width * 0.012))
        radius_x = int(rng.uniform(6, 30))
        radius_y = int(rng.uniform(5, 34))
        draw.ellipse(
            (x - radius_x, y - radius_y, x + radius_x, y + radius_y),
            fill=int(rng.uniform(42, 130)),
        )

    for _ in range(30):
        x = int(rng.uniform(0.02, 0.94) * width)
        y = int(bottom_edge[x] * height + rng.normal(0, height * 0.012))
        radius_x = int(rng.uniform(5, 34))
        radius_y = int(rng.uniform(6, 28))
        draw.ellipse(
            (x - radius_x, y - radius_y, x + radius_x, y + radius_y),
            fill=int(rng.uniform(38, 118)),
        )

    return np.asarray(
        image.filter(ImageFilter.GaussianBlur(4.2)),
        dtype=np.float32,
    ) / 255.0


def build_mask(width: int, height: int) -> Image.Image:
    rng = np.random.default_rng(SEED)
    x = np.linspace(0.0, 1.0, width, dtype=np.float32)[None, :]
    y = np.linspace(0.0, 1.0, height, dtype=np.float32)[:, None]

    texture = (
        resized_noise(rng, width, height, 15, 12) * 0.56
        + resized_noise(rng, width, height, 31, 24) * 0.29
        + resized_noise(rng, width, height, 67, 52) * 0.15
    )
    texture -= 0.5

    right_curve = (
        0.79
        + (noise_curve(rng, height, 15) - 0.5) * 0.15
        + np.sin(np.linspace(0, np.pi * 7.5, height, dtype=np.float32)) * 0.012
    )
    bottom_curve = (
        0.84
        + (noise_curve(rng, width, 18) - 0.5) * 0.13
        + np.sin(np.linspace(0, np.pi * 8.0, width, dtype=np.float32)) * 0.01
    )
    left_curve = 0.025 + (noise_curve(rng, height, 12) - 0.5) * 0.045
    top_curve = 0.02 + (noise_curve(rng, width, 14) - 0.5) * 0.05

    detail = texture * 0.052
    alpha_left = smoothstep(-0.012, 0.078, x - left_curve[:, None] + detail)
    alpha_top = smoothstep(-0.012, 0.082, y - top_curve[None, :] + detail)
    alpha_right = smoothstep(-0.045, 0.135, right_curve[:, None] - x + detail)
    alpha_bottom = smoothstep(-0.042, 0.14, bottom_curve[None, :] - y + detail)
    alpha = np.minimum.reduce((alpha_left, alpha_top, alpha_right, alpha_bottom))

    extensions = draw_ink_extensions(rng, width, height, right_curve, bottom_curve)
    extensions *= np.power(alpha_bottom, 0.58)
    alpha = 1.0 - (1.0 - alpha) * (1.0 - extensions)

    lower_left_fade = (
        (1.0 - smoothstep(0.11, 0.3, x))
        * smoothstep(0.64, 0.94, y)
    )
    alpha *= 1.0 - lower_left_fade * 0.96

    notches = draw_edge_notches(rng, width, height, right_curve, bottom_curve)
    edge_band = np.clip(1.0 - np.abs(alpha - 0.5) * 2.25, 0.0, 1.0)
    alpha *= 1.0 - notches * edge_band * 0.62
    alpha += texture * edge_band * 0.13
    alpha = np.clip(alpha, 0.0, 1.0)

    softened = Image.fromarray((alpha * 255).astype(np.uint8), mode="L").filter(
        ImageFilter.GaussianBlur(0.85)
    )
    alpha_u8 = np.asarray(softened, dtype=np.uint8).copy()
    alpha_u8[alpha_u8 < 4] = 0
    alpha_u8 = ((alpha_u8 // 3) * 3).astype(np.uint8)

    rgba = np.full((height, width, 4), 255, dtype=np.uint8)
    rgba[..., 3] = alpha_u8
    return Image.fromarray(rgba, mode="RGBA")


def build_grain(size: int = 384) -> Image.Image:
    rng = np.random.default_rng(SEED + 103)
    fine = rng.random((size, size), dtype=np.float32)
    coarse = resized_noise(rng, size, size, 12, 12)
    density = fine * 0.68 + coarse * 0.32
    alpha = np.clip((density - 0.34) * 26.0, 0.0, 18.0)

    speckles = rng.random((size, size)) > 0.985
    alpha[speckles] += rng.uniform(8.0, 22.0, int(speckles.sum()))
    alpha = np.clip(alpha, 0.0, 30.0).astype(np.uint8)

    scratches = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(scratches)
    for _ in range(16):
        x = int(rng.uniform(0, size))
        y = int(rng.uniform(0, size))
        length = int(rng.uniform(size * 0.08, size * 0.34))
        draw.line(
            (x, y, x + int(rng.normal(0, 2.2)), min(size, y + length)),
            fill=int(rng.uniform(5, 14)),
            width=1,
        )
    scratch_alpha = np.asarray(
        scratches.filter(ImageFilter.GaussianBlur(0.45)),
        dtype=np.uint8,
    )
    alpha = np.maximum(alpha, scratch_alpha)

    rgba = np.empty((size, size, 4), dtype=np.uint8)
    rgba[..., 0] = 91
    rgba[..., 1] = 66
    rgba[..., 2] = 62
    rgba[..., 3] = alpha
    return Image.fromarray(rgba, mode="RGBA")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate the Kisara 001 ink-edge mask.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--grain-output", type=Path, default=DEFAULT_GRAIN_OUTPUT)
    parser.add_argument("--width", type=int, default=DEFAULT_WIDTH)
    parser.add_argument("--height", type=int, default=DEFAULT_HEIGHT)
    args = parser.parse_args()

    output = args.output.resolve()
    grain_output = args.grain_output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    grain_output.parent.mkdir(parents=True, exist_ok=True)
    build_mask(args.width, args.height).save(output, optimize=True)
    build_grain().save(grain_output, "WEBP", quality=72, method=6, exact=True)
    print(f"Wrote {output} ({args.width}x{args.height})")
    print(f"Wrote {grain_output} (384x384)")


if __name__ == "__main__":
    main()
