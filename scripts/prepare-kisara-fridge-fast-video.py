from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "public" / "themes" / "kisara" / "assets"
SOURCE = ASSET_DIR / "fridge-opening-002.mp4"
OUTPUT = ASSET_DIR / "fridge-opening-002-fast.mp4"


def main() -> None:
    if not SOURCE.is_file():
        raise FileNotFoundError(SOURCE)
    if OUTPUT.exists():
        raise FileExistsError(OUTPUT)

    # Bake the original 1.25x runtime cut at 1.5x source speed. Keep the
    # source and its first/last posters for a lossless rollback path.
    subprocess.run(
        [
            "ffmpeg",
            "-n",
            "-loglevel",
            "error",
            "-i",
            str(SOURCE),
            "-vf",
            "setpts=PTS/1.5,fps=24000/1001",
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
            str(OUTPUT),
        ],
        check=True,
    )


if __name__ == "__main__":
    main()
