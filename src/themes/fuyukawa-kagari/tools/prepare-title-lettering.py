"""Bake the fixed Home title from Georgia Italic outlines and authored pen paths."""

import argparse
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont


TITLE = "Yuimi Lab"
SCALE = 3 / 64
STROKES = {
    "Y": (
        "M190 1380L680 1380M405 1300Q475 920 610 550",
        "M1030 1380L1450 1380M1220 1270Q960 940 610 550",
        "M610 550L520 160Q500 55 190 35L840 35",
    ),
    "u": (
        "M70 920Q470 1120 350 700L250 265Q195 30 450 35Q610 35 790 210",
        "M1000 950L810 180Q755 -30 1115 80",
    ),
    "i": (
        "M490 1390L490 1370",
        "M85 940Q470 1110 380 720L240 145Q210 25 540 70",
    ),
    "m": (
        "M90 920Q470 1100 375 720L200 40",
        "M425 815Q830 1130 960 835Q1010 730 930 480L795 40",
        "M1035 815Q1510 1160 1550 820L1420 155Q1410 25 1730 85",
    ),
    "L": (
        "M285 1380L890 1380",
        "M555 1300L305 155Q280 35 0 35L790 35Q1030 50 1170 380",
    ),
    "a": (
        "M877 901Q567 1155 286 723Q35 249 252 64Q439 -102 753 214",
        "M995 1000L799 224Q735 -18 1135 86",
    ),
    "b": (
        "M210 1500L570 1500L235 150",
        "M390 800Q670 1090 885 850Q1110 580 850 235Q615 -90 300 105",
    ),
}


def build_svg(font_path: Path) -> str:
    font = TTFont(font_path)
    if font["head"].unitsPerEm != 2048:
        raise ValueError("Expected the Georgia Italic 2048-unit outlines")
    glyph_set = font.getGlyphSet()
    names = font.getBestCmap()
    advances = font["hmtx"]
    definitions = []
    groups = []
    cursor = 4.0
    order = 0

    for character in dict.fromkeys(TITLE.replace(" ", "")):
        pen = SVGPathPen(glyph_set)
        glyph_set[names[ord(character)]].draw(pen)
        definitions.append(f'<path id="glyph-{character}" d="{pen.getCommands()}"/>')

    for index, character in enumerate(TITLE):
        if character == " ":
            cursor += advances[names[ord(character)]][0] * SCALE
            continue
        paths = []
        for stroke in STROKES[character]:
            paths.append(
                f'<path class="pen" d="{stroke}" pathLength="1" fill="none" '
                f'stroke="#fff" stroke-width="360" stroke-linecap="round" '
                f'stroke-linejoin="round" style="animation-delay:{order * 68}ms"/>'
            )
            order += 1
        definitions.append(
            f'<mask id="pen-{index}" maskUnits="userSpaceOnUse" '
            f'x="-200" y="-300" width="2200" height="2100">{"".join(paths)}</mask>'
        )
        groups.append(
            f'<g transform="translate({cursor:.3f} 94) scale({SCALE} -{SCALE})">'
            f'<use href="#glyph-{character}" mask="url(#pen-{index})" '
            f'fill="#465575" stroke="#fff" stroke-width="100" '
            f'stroke-linejoin="round" paint-order="stroke fill"/></g>'
        )
        cursor += advances[names[ord(character)]][0] * SCALE

    width = round(cursor + 4, 3)
    style = (
        "<style>"
        ".pen{stroke-dasharray:1 1;animation:write 170ms linear both}"
        "@keyframes write{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}"
        "@media(prefers-reduced-motion:reduce){.pen{animation:none}}"
        "</style>"
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 12 {width} 94" '
        f'width="{width}" height="94">{style}<defs>{"".join(definitions)}</defs>'
        f'{"".join(groups)}</svg>\n'
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--font", type=Path, default=Path(r"C:\Windows\Fonts\georgiai.ttf"))
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[4]
        / "public/themes/fuyukawa-kagari/assets/hero-title.svg",
    )
    args = parser.parse_args()
    svg = build_svg(args.font)
    if args.output.exists():
        if args.output.read_text(encoding="utf-8") != svg:
            raise FileExistsError(f"Different lettering already exists: {args.output}")
    else:
        args.output.write_text(svg, encoding="utf-8", newline="\n")
    print(f"{args.output}: {len(svg.encode('utf-8'))} bytes")


if __name__ == "__main__":
    main()
