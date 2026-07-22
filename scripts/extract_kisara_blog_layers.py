from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "kisara" / "engage kiss.png"
DEFAULT_MASKS = ROOT / "scripts" / "assets" / "kisara-blog-masks"
DEFAULT_OUTPUT = ROOT / "public" / "themes" / "kisara" / "assets" / "blog"

CHARACTERS = [
    {"name": "kisara-front", "mask": "kisara-front.png"},
    {"name": "shu-middle", "mask": "shu-middle.png"},
    {"name": "ayano-middle", "mask": "ayano-middle.png"},
    {"name": "sharon-back", "mask": "sharon-back.png"},
]


def load_masks(mask_dir: Path, source_size: tuple[int, int]) -> dict[str, Image.Image]:
    masks: dict[str, Image.Image] = {}
    for character in CHARACTERS:
        mask_path = mask_dir / character["mask"]
        if not mask_path.exists():
            raise FileNotFoundError(mask_path)

        mask = Image.open(mask_path).convert("L")
        if mask.size != source_size:
            raise ValueError(f"{mask_path} is {mask.size}, expected {source_size}")

        binary = np.where(np.asarray(mask, dtype=np.uint8) >= 128, 255, 0).astype(np.uint8)
        if not np.any(binary):
            raise ValueError(f"{mask_path} is empty")
        masks[character["name"]] = Image.fromarray(binary, mode="L")
    return masks


def resize_scene(source: Image.Image, target_width: int) -> Image.Image:
    target_height = round(source.height * target_width / source.width)
    return source.resize((target_width, target_height), Image.Resampling.LANCZOS)


def save_layer(source: Image.Image, alpha: Image.Image, path: Path, target_width: int) -> None:
    scene = resize_scene(source, target_width).convert("RGBA")
    resized_alpha = alpha.resize(scene.size, Image.Resampling.LANCZOS)
    scene.putalpha(resized_alpha)
    scene.save(path, "WEBP", lossless=True, method=6)


def save_scene(source: Image.Image, path: Path, target_width: int) -> None:
    scene = resize_scene(source, target_width)
    scene = scene.filter(ImageFilter.GaussianBlur(radius=13))
    scene = ImageEnhance.Brightness(scene).enhance(0.44)
    scene = ImageEnhance.Color(scene).enhance(0.76)
    scene.save(path, "WEBP", quality=84, method=6)


def save_preview(
    masks: dict[str, Image.Image],
    source: Image.Image,
    path: Path,
    target_width: int,
) -> None:
    scene = resize_scene(source, target_width)
    background = scene.filter(ImageFilter.GaussianBlur(radius=13))
    background = ImageEnhance.Brightness(background).enhance(0.44)
    background = ImageEnhance.Color(background).enhance(0.76).convert("RGBA")
    panels: list[Image.Image] = []

    # Characters enter front-to-back, while their visual stacking remains back-to-front.
    for index, character in enumerate(CHARACTERS, start=1):
        canvas = background.copy()
        for visible_character in reversed(CHARACTERS[:index]):
            alpha = masks[visible_character["name"]].resize(scene.size, Image.Resampling.LANCZOS)
            layer = scene.convert("RGBA")
            layer.putalpha(alpha)
            canvas.alpha_composite(layer)

        panel = canvas.convert("RGB")
        panel.thumbnail((720, 488), Image.Resampling.LANCZOS)
        framed = Image.new("RGB", (720, 520), (8, 10, 28))
        framed.paste(panel, ((720 - panel.width) // 2, 32))
        ImageDraw.Draw(framed).text(
            (14, 10),
            f"STAGE {index}: {character['name'].upper()}",
            fill="white",
        )
        panels.append(framed)

    sheet = Image.new("RGB", (1440, 1040), (8, 10, 28))
    for index, panel in enumerate(panels):
        sheet.paste(panel, ((index % 2) * 720, (index // 2) * 520))
    sheet.save(path, "WEBP", quality=88, method=6)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the four layered characters for the Kisara Blog hero.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--masks", type=Path, default=DEFAULT_MASKS)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--width", type=int, default=1440)
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()

    source_path = args.source.resolve()
    mask_path = args.masks.resolve()
    output_path = args.output.resolve()
    if not source_path.exists():
        raise FileNotFoundError(source_path)
    if args.width <= 0:
        raise ValueError("--width must be greater than zero")

    output_path.mkdir(parents=True, exist_ok=True)
    source_image = Image.open(source_path).convert("RGB")
    masks = load_masks(mask_path, source_image.size)

    save_scene(source_image, output_path / "engage-kiss-scene.webp", args.width)
    for character in CHARACTERS:
        name = character["name"]
        save_layer(source_image, masks[name], output_path / f"{name}.webp", args.width)

    preview_path = output_path / "layer-preview.webp"
    if args.preview:
        save_preview(masks, source_image, preview_path, args.width)
    else:
        preview_path.unlink(missing_ok=True)

    print(f"Generated {len(CHARACTERS)} layers in {output_path}")


if __name__ == "__main__":
    main()
