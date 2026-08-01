from pathlib import Path

import cv2
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "kisara" / "new00102.png"
OUTPUT = ROOT / "public" / "themes" / "kisara" / "assets" / "opening-memory-001-closeup.webp"


def read_image(path: Path) -> np.ndarray:
    data = np.fromfile(str(path), dtype=np.uint8)
    image = cv2.imdecode(data, cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError(f"Unable to decode {path}")
    return image


def write_webp(path: Path, image: np.ndarray) -> None:
    ok, encoded = cv2.imencode(".webp", image, [cv2.IMWRITE_WEBP_QUALITY, 91])
    if not ok:
        raise RuntimeError(f"Unable to encode {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    encoded.tofile(str(path))


def remove_pause_label(image: np.ndarray) -> np.ndarray:
    height, width = image.shape[:2]
    hard_mask = np.zeros((height, width), dtype=np.uint8)
    x1, y1 = round(width * 0.002), round(height * 0.002)
    x2, y2 = round(width * 0.043), round(height * 0.041)
    cv2.rectangle(hard_mask, (x1, y1), (x2, y2), 255, thickness=-1)

    repaired = cv2.inpaint(image, hard_mask, 6, cv2.INPAINT_TELEA)
    feather = cv2.GaussianBlur(hard_mask, (0, 0), sigmaX=4.5, sigmaY=4.5)
    alpha = feather.astype(np.float32)[..., None] / 255.0
    return np.clip(image * (1.0 - alpha) + repaired * alpha, 0, 255).astype(np.uint8)


def main() -> None:
    image = remove_pause_label(read_image(SOURCE))
    runtime = cv2.resize(image, (1920, 1080), interpolation=cv2.INTER_LANCZOS4)
    write_webp(OUTPUT, runtime)
    print(f"Wrote {OUTPUT.relative_to(ROOT)} ({runtime.shape[1]}x{runtime.shape[0]})")


if __name__ == "__main__":
    main()
