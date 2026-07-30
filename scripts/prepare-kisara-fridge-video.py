from __future__ import annotations

from pathlib import Path
import subprocess

import cv2
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "kisara" / "Ep08.mp4"
ASSET_DIR = ROOT / "public" / "themes" / "kisara" / "assets"
OUTPUT_VIDEO = ASSET_DIR / "fridge-opening-002.mp4"
OUTPUT_FIRST = ASSET_DIR / "fridge-opening-002-first.webp"
OUTPUT_LAST = ASSET_DIR / "fridge-opening-002-last.webp"


def save_webp(frame, destination: Path, quality: int) -> None:
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    Image.fromarray(rgb, mode="RGB").save(destination, format="WEBP", quality=quality, method=6)


def extract_posters() -> None:
    capture = cv2.VideoCapture(str(OUTPUT_VIDEO))
    if not capture.isOpened():
        raise FileNotFoundError(OUTPUT_VIDEO)

    first_frame = None
    last_frame = None
    while True:
        success, frame = capture.read()
        if not success:
            break
        if first_frame is None:
            first_frame = frame.copy()
        last_frame = frame
    capture.release()

    if first_frame is None or last_frame is None:
        raise RuntimeError(f"No video frames found in {OUTPUT_VIDEO}")
    save_webp(first_frame, OUTPUT_FIRST, quality=80)
    save_webp(last_frame, OUTPUT_LAST, quality=86)


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)
    ASSET_DIR.mkdir(parents=True, exist_ok=True)

    # The supplied 4K capture keeps the subtitle entirely inside the lowest
    # 260 pixels. Crop that band and the matching horizontal margin together,
    # preserving a clean 16:9 composition without a repaired blur strip.
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(SOURCE),
            "-vf",
            "crop=3378:1900:230:0,scale=1920:1080:flags=lanczos",
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "slow",
            "-crf",
            "20",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(OUTPUT_VIDEO),
        ],
        check=True,
    )
    extract_posters()


if __name__ == "__main__":
    main()
