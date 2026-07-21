from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
from rembg import new_session


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "kisara" / "engage kiss.png"
DEFAULT_OUTPUT = ROOT / "public" / "themes" / "kisara" / "assets" / "blog"

CHARACTERS = [
    {
        "name": "kisara-front",
        "prompt": [
            {"type": "rectangle", "label": 1, "data": [0, 500, 1915, 1298]},
            {"type": "point", "label": 1, "data": [1225, 720]},
            {"type": "point", "label": 1, "data": [1190, 970]},
            {"type": "point", "label": 1, "data": [1650, 760]},
            {"type": "point", "label": 1, "data": [725, 1000]},
            {"type": "point", "label": 1, "data": [235, 950]},
            {"type": "point", "label": 0, "data": [845, 510]},
            {"type": "point", "label": 0, "data": [1590, 420]},
            {"type": "point", "label": 0, "data": [1265, 235]},
        ],
    },
    {
        "name": "shu-middle",
        "prompt": [
            {"type": "rectangle", "label": 1, "data": [615, 285, 1195, 1298]},
        ],
    },
    {
        "name": "ayano-middle",
        "prompt": [
            {"type": "rectangle", "label": 1, "data": [1200, 205, 1840, 930]},
            {"type": "point", "label": 1, "data": [1605, 350]},
            {"type": "point", "label": 1, "data": [1580, 560]},
            {"type": "point", "label": 1, "data": [1665, 680]},
            {"type": "point", "label": 1, "data": [1375, 425]},
            {"type": "point", "label": 0, "data": [1370, 740]},
            {"type": "point", "label": 0, "data": [1290, 275]},
            {"type": "point", "label": 0, "data": [1110, 610]},
        ],
    },
    {
        "name": "sharon-back",
        "prompt": [
            {"type": "rectangle", "label": 1, "data": [745, 35, 1595, 705]},
            {"type": "point", "label": 1, "data": [1295, 165]},
            {"type": "point", "label": 1, "data": [1305, 350]},
            {"type": "point", "label": 1, "data": [1010, 190]},
            {"type": "point", "label": 1, "data": [1115, 470]},
        ],
    },
]

def refine_seed(mask: Image.Image, width: int, height: int) -> np.ndarray:
    array = np.asarray(mask.resize((width, height), Image.Resampling.LANCZOS), dtype=np.uint8)
    binary = np.where(array >= 112, 255, 0).astype(np.uint8)
    kernel = np.ones((3, 3), dtype=np.uint8)
    return cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=1)


def partition_union(seeds: dict[str, np.ndarray], union_alpha: np.ndarray) -> dict[str, np.ndarray]:
    names = [character["name"] for character in CHARACTERS]
    distances = []
    for name in names:
        background_to_seed = np.where(seeds[name] > 0, 0, 1).astype(np.uint8)
        distances.append(cv2.distanceTransform(background_to_seed, cv2.DIST_L2, 5))

    owner = np.argmin(np.stack(distances, axis=0), axis=0)
    foreground = union_alpha > 4
    masks: dict[str, np.ndarray] = {}
    for index, name in enumerate(names):
        alpha = np.where(foreground & (owner == index), union_alpha, 0).astype(np.uint8)
        alpha[alpha < 6] = 0
        alpha[alpha > 249] = 255
        masks[name] = alpha
    return masks


def save_layer(source: np.ndarray, alpha: np.ndarray, path: Path, target_width: int) -> None:
    rgba = np.dstack((source, alpha))
    image = Image.fromarray(rgba, mode="RGBA")
    target_height = round(image.height * target_width / image.width)
    image = image.resize((target_width, target_height), Image.Resampling.LANCZOS)
    image.save(path, "WEBP", lossless=True, method=6)


def save_scene(source: Image.Image, path: Path, target_width: int) -> None:
    target_height = round(source.height * target_width / source.width)
    scene = source.resize((target_width, target_height), Image.Resampling.LANCZOS)
    scene = scene.filter(ImageFilter.GaussianBlur(radius=13))
    scene = ImageEnhance.Brightness(scene).enhance(0.44)
    scene = ImageEnhance.Color(scene).enhance(0.76)
    scene.save(path, "WEBP", quality=84, method=6)


def save_preview(masks: dict[str, np.ndarray], source: np.ndarray, path: Path) -> None:
    previews = []
    colors = [(255, 63, 111), (94, 164, 255), (134, 117, 255), (255, 200, 111)]
    for (name, alpha), color in zip(masks.items(), colors, strict=True):
        tinted = source.astype(np.float32) * 0.34
        overlay = np.empty_like(source)
        overlay[:] = color
        weight = (alpha.astype(np.float32) / 255.0)[..., None]
        tinted = tinted * (1 - weight * 0.55) + overlay * (weight * 0.55)
        panel = Image.fromarray(np.clip(tinted, 0, 255).astype(np.uint8))
        panel.thumbnail((640, 440), Image.Resampling.LANCZOS)
        previews.append((name, panel.copy()))

    sheet = Image.new("RGB", (1280, 920), (8, 10, 28))
    for index, (_, panel) in enumerate(previews):
        x = (index % 2) * 640
        y = (index // 2) * 460
        sheet.paste(panel, (x, y))
    sheet.save(path, "WEBP", quality=88, method=6)


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract the four Engage Kiss characters for the Kisara blog hero.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--width", type=int, default=1440)
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()

    source_path = args.source.resolve()
    output_path = args.output.resolve()
    if not source_path.exists():
        raise FileNotFoundError(source_path)

    output_path.mkdir(parents=True, exist_ok=True)
    source_image = Image.open(source_path).convert("RGB")
    source_array = np.asarray(source_image)
    sam_session = new_session("sam")
    anime_session = new_session("isnet-anime")
    union_mask = anime_session.predict(source_image)[0].convert("L")
    union_alpha = np.array(union_mask, dtype=np.uint8, copy=True)
    union_alpha[union_alpha < 6] = 0
    union_alpha[union_alpha > 249] = 255

    seeds: dict[str, np.ndarray] = {}
    for character in CHARACTERS:
        predicted = sam_session.predict(source_image, sam_prompt=character["prompt"])[0]
        seeds[character["name"]] = refine_seed(predicted, source_image.width, source_image.height)

    masks = partition_union(seeds, union_alpha)

    save_scene(source_image, output_path / "engage-kiss-scene.webp", args.width)
    for character in CHARACTERS:
        name = character["name"]
        save_layer(source_array, masks[name], output_path / f"{name}.webp", args.width)
    preview_path = output_path / "layer-preview.webp"
    if args.preview:
        save_preview(masks, source_array, preview_path)
    else:
        preview_path.unlink(missing_ok=True)

    print(f"Generated {len(CHARACTERS)} layers in {output_path}")


if __name__ == "__main__":
    main()
