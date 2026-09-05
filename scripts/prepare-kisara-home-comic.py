"""Publish approved hybrid comic assets; keep full vector masters in the study."""

import hashlib
import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
STUDY = ROOT / "design/kisara-comic-001"
spec = importlib.util.spec_from_file_location("comic_study", STUDY / "prepare.py")
study = importlib.util.module_from_spec(spec)
spec.loader.exec_module(study)
PUBLIC = ROOT / "public/themes/kisara/assets/home-comic"
MASTERS = STUDY / "collection"
SOURCES = [
    ("candle", "28ce8482-4832-4aea-b637-2e3755480071.png", (24, 0, 334, 644)),
    ("quiet", "6f86b3e5-43d6-4723-bfef-a9938b9366b6.png", (26, 15, 456, 598)),
    ("hero", "7b26cabc-16c0-4c1b-8afa-3b05643aaa3e.png", None),
    ("smile", "d5b197bb-16e3-4c75-92d0-1554db7c4841.png", (125, 380, 735, 940)),
    ("action", "eb0036a3-0dc2-466c-a7e9-8780be340339.png", (36, 105, 490, 825)),
]


def main():
    PUBLIC.mkdir(parents=True, exist_ok=True)
    MASTERS.mkdir(parents=True, exist_ok=True)
    records, thumbnails = [], []
    for name, filename, crop in SOURCES:
        source = ROOT / "kisara/comic" / filename
        raw_bytes = source.read_bytes()
        digest = hashlib.sha256(raw_bytes).hexdigest()
        original = Image.open(source).convert("L")
        raw = np.asarray(original, dtype=np.float32)
        paper = float(np.percentile(raw, 90))
        corrected = Image.fromarray(np.round(np.clip(raw / paper, 0, 1) * 255).astype(np.uint8))
        if name == "hero":
            # Publish the exact accepted pair without resampling or retracing it.
            for suffix in ("hybrid.webp", "structure.svg"):
                (PUBLIC / f"hero-{suffix}").write_bytes(
                    (STUDY / "assets" / f"subject-{suffix}").read_bytes()
                )
            runtime = PUBLIC / "hero-hybrid.webp"
            vector = (STUDY / "assets/subject-vector.svg").read_text(encoding="utf-8")
            layers = json.loads((STUDY / "assets/report.json").read_text())["layers"]
        else:
            panel = corrected.crop(crop)
            runtime = PUBLIC / f"{name}.webp"
            panel.save(runtime, quality=91, method=6)
            gray = np.asarray(panel)
            smooth = study.cv2.bilateralFilter(gray, 5, 14, 2).astype(np.float32) / 255
            groups, layers = [], []
            for threshold, layer_name, color in [
                (0.90, "light-tone", "#cecece"),
                (0.69, "middle-tone", "#828282"),
                (0.44, "key-ink", "#121212"),
            ]:
                group, metrics = study.vector_layer(
                    smooth, np.ones_like(smooth), threshold, layer_name, color
                )
                groups.append(group)
                layers.append(metrics)
            w, h = panel.size
            vector = (
                f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
                f"<title>Kisara {name} vector master</title>"
                f'<path fill="#fff" d="M0 0H{w}V{h}H0Z"/>'
                + "".join(groups) + "</svg>"
            )
        (MASTERS / f"{name}.svg").write_text(vector, encoding="utf-8")
        preview = Image.open(runtime).convert("RGBA")
        preview.thumbnail((278, 570), Image.Resampling.LANCZOS)
        thumbnails.append((name, preview))
        records.append({
            "id": name, "source": filename, "sourceSha256": digest,
            "originalSize": list(original.size), "sourceBytes": len(raw_bytes),
            "paperWhite": paper, "crop": crop, "runtimeSize": list(Image.open(runtime).size),
            "runtimeBytes": runtime.stat().st_size, "vectorBytes": len(vector.encode()),
            "contours": sum(layer["contours"] for layer in layers),
        })
        assert hashlib.sha256(source.read_bytes()).hexdigest() == digest
        print(f'{name}: hybrid {runtime.stat().st_size} bytes; vector {len(vector.encode())} bytes', flush=True)
    sheet = Image.new("RGB", (1450, 610), "white")
    draw = ImageDraw.Draw(sheet)
    for i, (name, thumbnail) in enumerate(thumbnails):
        draw.text((i * 290 + 12, 10), name.upper(), fill="black")
        sheet.paste(thumbnail, (i * 290 + (290 - thumbnail.width) // 2, 32), thumbnail)
    output = MASTERS / "collection-review.jpg"
    sheet.save(output, quality=84, optimize=True)
    manifest = {
        "assets": records,
        "runtimeBytes": sum(record["runtimeBytes"] for record in records)
            + (PUBLIC / "hero-structure.svg").stat().st_size,
        "review": {"path": str(output), "size": list(sheet.size), "bytes": output.stat().st_size},
    }
    (MASTERS / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"runtimeBytes": manifest["runtimeBytes"], "review": manifest["review"]}))


if __name__ == "__main__":
    main()
