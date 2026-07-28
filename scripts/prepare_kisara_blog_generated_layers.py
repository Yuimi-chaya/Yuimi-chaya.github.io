from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from rembg import new_session, remove
from scipy.ndimage import distance_transform_edt


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_GENERATED = ROOT / "output" / "imagegen" / "blog-character-reconstruction" / "luna"
DEFAULT_ROUGH = ROOT / "public" / "themes" / "kisara" / "assets" / "blog"
DEFAULT_OUTPUT = ROOT / "public" / "themes" / "kisara" / "assets" / "blog"
DEFAULT_QA = ROOT / "output" / "imagegen" / "blog-character-reconstruction" / "aligned"

WORK_SIZE = (1536, 1024)
SOURCE_FIT_SIZE = (1536, 1040)
SOURCE_CROP_TOP = 8
FINAL_SIZE = (1440, 975)

CHARACTERS = (
    {
        "name": "shu-middle",
        "generated": "shu-purple-v1.png",
        "rough": "shu-middle-v2.png",
        "key": "#7A00FF",
        "repair_radius": 9.0,
    },
    {
        "name": "kisara-front",
        "generated": "kisara-green-v1.png",
        "rough": "kisara-front-v2.png",
        "key": "#00F05A",
        "repair_radius": 11.0,
    },
    {
        "name": "ayano-middle",
        "generated": "ayano-magenta-v1.png",
        "rough": "ayano-middle-v2.png",
        "key": "#FF00B8",
        "repair_radius": 14.0,
    },
    {
        "name": "sharon-back",
        "generated": "sharon-green-v1.png",
        "rough": "sharon-back-v2.png",
        "key": "#00E85C",
        "repair_radius": 11.0,
    },
)


def read_cv(path: Path, flags: int = cv2.IMREAD_UNCHANGED) -> np.ndarray:
    data = np.fromfile(str(path), dtype=np.uint8)
    image = cv2.imdecode(data, flags)
    if image is None:
        raise ValueError(f"Unable to decode {path}")
    return image


def write_cv(path: Path, image: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ok, encoded = cv2.imencode(path.suffix, image)
    if not ok:
        raise ValueError(f"Unable to encode {path}")
    encoded.tofile(str(path))


def parse_hex_color(value: str) -> np.ndarray:
    value = value.removeprefix("#")
    if len(value) != 6:
        raise ValueError(f"Invalid color: {value}")
    return np.array([int(value[index : index + 2], 16) for index in (0, 2, 4)], dtype=np.float32)


def smoothstep(edge0: float, edge1: float, value: np.ndarray) -> np.ndarray:
    normalized = np.clip((value - edge0) / max(edge1 - edge0, 1e-6), 0.0, 1.0)
    return normalized * normalized * (3.0 - 2.0 * normalized)


def fit_rough_layer(image: np.ndarray) -> np.ndarray:
    if image.ndim != 3 or image.shape[2] != 4:
        raise ValueError("Rough layer must be RGBA")
    resized = cv2.resize(image, SOURCE_FIT_SIZE, interpolation=cv2.INTER_LANCZOS4)
    return resized[SOURCE_CROP_TOP : SOURCE_CROP_TOP + WORK_SIZE[1], :, :]


def repair_internal_artifacts(name: str, image_bgr: np.ndarray) -> tuple[np.ndarray, dict[str, int]]:
    repaired = image_bgr.copy()
    stats = {"green_hair_pixels": 0, "blue_sock_pixels": 0}
    if name != "sharon-back":
        return repaired, stats

    # Green contamination was painted inside Sharon's hair/left-hand silhouette,
    # so alpha cleanup cannot remove it. Restrict the repair to the confirmed ROI.
    green_mask = np.zeros(repaired.shape[:2], dtype=np.uint8)
    green_roi = repaired[247:286, 878:930]
    blue, green, red = cv2.split(green_roi)
    contaminated_green = (
        (green.astype(np.int16) > red.astype(np.int16) + 16)
        & (green.astype(np.int16) > blue.astype(np.int16) + 8)
        & (green > 72)
    )
    green_mask[247:286, 878:930][contaminated_green] = 255
    green_mask = cv2.dilate(green_mask, np.ones((3, 3), dtype=np.uint8), iterations=1)
    stats["green_hair_pixels"] = int(np.count_nonzero(green_mask))
    if stats["green_hair_pixels"]:
        repaired = cv2.inpaint(repaired, green_mask, 3.5, cv2.INPAINT_TELEA)

    # The blue fleck sits inside the raised left white stocking. Replace only
    # blue-dominant pixels in the confirmed box with the nearest local white-sock tone.
    blue_mask = np.zeros(repaired.shape[:2], dtype=bool)
    patch = repaired[272:284, 901:917]
    patch_blue, patch_green, patch_red = cv2.split(patch)
    blue_pixels = (
        (patch_blue.astype(np.int16) > patch_red.astype(np.int16) + 20)
        & (patch_blue.astype(np.int16) > patch_green.astype(np.int16) + 10)
        & (patch_blue > 78)
    )
    blue_mask[272:284, 901:917] = blue_pixels
    stats["blue_sock_pixels"] = int(np.count_nonzero(blue_mask))
    if stats["blue_sock_pixels"]:
        local = repaired[258:302, 888:930]
        local_hsv = cv2.cvtColor(local, cv2.COLOR_BGR2HSV)
        white_local = (local_hsv[..., 1] < 62) & (local_hsv[..., 2] > 96)
        white_safe = np.zeros(repaired.shape[:2], dtype=bool)
        white_safe[258:302, 888:930] = white_local
        if np.any(white_safe):
            _, nearest_white = distance_transform_edt(~white_safe, return_indices=True)
            repaired[blue_mask] = repaired[nearest_white[0][blue_mask], nearest_white[1][blue_mask]]
        else:
            fallback_mask = np.where(blue_mask, 255, 0).astype(np.uint8)
            repaired = cv2.inpaint(repaired, fallback_mask, 2.5, cv2.INPAINT_TELEA)

    return repaired, stats


def extract_anime_subject(
    image_bgr: np.ndarray,
    key_rgb: np.ndarray,
    session: object,
    repair_radius: float,
) -> tuple[np.ndarray, dict[str, float]]:
    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB).astype(np.float32)
    distance = np.linalg.norm(rgb - key_rgb[None, None, :], axis=2)

    source = Image.fromarray(rgb.astype(np.uint8), mode="RGB")
    model_mask = remove(source, session=session, only_mask=True, post_process_mask=False)
    if not isinstance(model_mask, Image.Image):
        raise ValueError("Anime segmentation did not return a PIL mask")
    model_alpha = np.asarray(model_mask.convert("L"), dtype=np.float32) / 255.0

    border_width = 24
    border = np.concatenate(
        (
            distance[:border_width, :].ravel(),
            distance[-border_width:, :].ravel(),
            distance[:, :border_width].ravel(),
            distance[:, -border_width:].ravel(),
        )
    )
    transparent_threshold = max(18.0, float(np.percentile(border, 99.8)) + 7.0)
    opaque_threshold = max(transparent_threshold + 48.0, 76.0)
    color_gate = smoothstep(transparent_threshold, opaque_threshold, distance)
    model_confidence = smoothstep(0.48, 0.94, model_alpha)
    alpha = model_alpha * np.maximum(color_gate, model_confidence)

    candidate = (alpha > 0.01).astype(np.uint8)
    component_count, labels, stats, _ = cv2.connectedComponentsWithStats(candidate, 8)
    keep = np.zeros(candidate.shape, dtype=np.uint8)
    sure_foreground = model_alpha >= 0.72
    height, width = candidate.shape
    for label in range(1, component_count):
        x, y, component_width, component_height, area = stats[label]
        if area < 6:
            continue
        touches_border = x == 0 or y == 0 or x + component_width >= width or y + component_height >= height
        component = labels == label
        if touches_border or np.count_nonzero(component & sure_foreground) < 3:
            continue
        keep[component] = 1

    alpha *= keep.astype(np.float32)
    alpha[alpha < 0.003] = 0.0
    alpha = np.clip(alpha, 0.0, 1.0)

    inside_distance = distance_transform_edt(alpha > 0.025)
    interior_harden = smoothstep(2.0, 4.5, inside_distance) * smoothstep(0.76, 0.97, model_alpha)
    alpha += (1.0 - alpha) * interior_harden
    alpha[alpha > 0.992] = 1.0

    safe_alpha = np.maximum(alpha[..., None], 1.0 / 255.0)
    unmatted = (rgb - key_rgb[None, None, :] * (1.0 - safe_alpha)) / safe_alpha
    edge_weight = np.clip((1.0 - np.abs(alpha * 2.0 - 1.0)) * 1.35, 0.0, 1.0)[..., None]
    cleaned_rgb = rgb * (1.0 - edge_weight) + np.clip(unmatted, 0.0, 255.0) * edge_weight

    # Replace key-colored edge spill with the nearest trustworthy interior color.
    # This preserves thin anime hair and weapon tips instead of eroding them.
    safe_interior = (alpha > 0.965) & (distance > 92.0) & (inside_distance > 2.2)
    if np.any(safe_interior):
        _, nearest = distance_transform_edt(~safe_interior, return_indices=True)
        nearest_color = cleaned_rgb[nearest[0], nearest[1]]
        key_similarity = 1.0 - smoothstep(24.0, 142.0, distance)
        boundary_weight = 1.0 - smoothstep(1.0, repair_radius, inside_distance)
        color_delta = np.linalg.norm(cleaned_rgb - nearest_color, axis=2)
        visible_value = np.max(cleaned_rgb, axis=2)
        chromatic_outlier = smoothstep(34.0, 108.0, color_delta) * smoothstep(62.0, 126.0, visible_value)
        spill_score = np.maximum(key_similarity, chromatic_outlier * 0.72)
        repair_weight = np.clip(spill_score * boundary_weight * (alpha > 0.015), 0.0, 0.985)[..., None]
        cleaned_rgb = cleaned_rgb * (1.0 - repair_weight) + nearest_color * repair_weight

    cleaned_bgr = cv2.cvtColor(np.clip(cleaned_rgb, 0.0, 255.0).astype(np.uint8), cv2.COLOR_RGB2BGR)
    rgba = np.dstack((cleaned_bgr, np.clip(alpha * 255.0 + 0.5, 0, 255).astype(np.uint8)))
    return rgba, {
        "transparent_threshold": round(transparent_threshold, 3),
        "opaque_threshold": round(opaque_threshold, 3),
        "model": "isnet-anime",
        "repair_radius": repair_radius,
        "partial_pixels": int(np.count_nonzero((alpha > 0.0) & (alpha < 1.0))),
        "foreground_pixels": int(np.count_nonzero(alpha > 0.02)),
    }


def estimate_alignment(generated_bgr: np.ndarray, generated_alpha: np.ndarray, rough: np.ndarray, key_rgb: np.ndarray) -> tuple[np.ndarray, dict[str, float]]:
    rough_alpha = rough[..., 3]
    rough_bgr = rough[..., :3].copy()
    rough_bgr[rough_alpha == 0] = key_rgb[::-1].astype(np.uint8)

    sift = cv2.SIFT_create(nfeatures=5000, contrastThreshold=0.016)
    target_points, target_descriptors = sift.detectAndCompute(cv2.cvtColor(rough_bgr, cv2.COLOR_BGR2GRAY), rough_alpha)
    source_points, source_descriptors = sift.detectAndCompute(cv2.cvtColor(generated_bgr, cv2.COLOR_BGR2GRAY), generated_alpha)
    if target_descriptors is None or source_descriptors is None:
        raise ValueError("Unable to find alignment descriptors")

    matches = cv2.BFMatcher().knnMatch(source_descriptors, target_descriptors, k=2)
    good = [first for first, second in matches if first.distance < 0.72 * second.distance]
    if len(good) < 12:
        raise ValueError(f"Only {len(good)} alignment matches")

    source = np.float32([source_points[match.queryIdx].pt for match in good])
    target = np.float32([target_points[match.trainIdx].pt for match in good])
    matrix, inliers = cv2.estimateAffinePartial2D(
        source,
        target,
        method=cv2.RANSAC,
        ransacReprojThreshold=6.0,
        maxIters=8000,
        confidence=0.999,
    )
    if matrix is None or inliers is None:
        raise ValueError("Unable to estimate alignment")

    inlier_count = int(inliers.sum())
    scale = float(np.hypot(matrix[0, 0], matrix[0, 1]))
    angle = float(np.degrees(np.arctan2(matrix[1, 0], matrix[0, 0])))
    if inlier_count < 20 or not 0.55 <= scale <= 2.25 or abs(angle) > 7.5:
        raise ValueError(f"Unsafe alignment: inliers={inlier_count}, scale={scale:.3f}, angle={angle:.3f}")

    return matrix, {
        "matches": len(good),
        "inliers": inlier_count,
        "scale": round(scale, 6),
        "angle": round(angle, 4),
        "translate_x": round(float(matrix[0, 2]), 3),
        "translate_y": round(float(matrix[1, 2]), 3),
    }


def warp_premultiplied(image: np.ndarray, matrix: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    alpha = image[..., 3:4].astype(np.float32) / 255.0
    premultiplied = image[..., :3].astype(np.float32) * alpha
    warped_alpha = cv2.warpAffine(alpha, matrix, size, flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    warped_color = cv2.warpAffine(premultiplied, matrix, size, flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    if warped_alpha.ndim == 2:
        warped_alpha = warped_alpha[..., None]
    color = np.divide(
        warped_color,
        np.maximum(warped_alpha, 1e-6),
        out=np.zeros_like(warped_color),
        where=warped_alpha > 1e-6,
    )
    return np.dstack((np.clip(color, 0, 255), np.clip(warped_alpha[..., 0] * 255.0, 0, 255))).astype(np.uint8)


def resize_premultiplied(image: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    alpha = image[..., 3:4].astype(np.float32) / 255.0
    premultiplied = image[..., :3].astype(np.float32) * alpha
    resized_alpha = cv2.resize(alpha, size, interpolation=cv2.INTER_LANCZOS4)
    resized_color = cv2.resize(premultiplied, size, interpolation=cv2.INTER_LANCZOS4)
    if resized_alpha.ndim == 2:
        resized_alpha = resized_alpha[..., None]
    color = np.divide(
        resized_color,
        np.maximum(resized_alpha, 1e-6),
        out=np.zeros_like(resized_color),
        where=resized_alpha > 1e-6,
    )
    return np.dstack((np.clip(color, 0, 255), np.clip(resized_alpha[..., 0] * 255.0, 0, 255))).astype(np.uint8)


def restore_source_aspect(image: np.ndarray) -> np.ndarray:
    canvas = np.zeros((SOURCE_FIT_SIZE[1], SOURCE_FIT_SIZE[0], 4), dtype=np.uint8)
    canvas[SOURCE_CROP_TOP : SOURCE_CROP_TOP + WORK_SIZE[1], :, :] = image
    return resize_premultiplied(canvas, FINAL_SIZE)


def soft_mask_from_alpha(alpha: np.ndarray, close_size: int, dilate_size: int, blur: float) -> np.ndarray:
    binary = (alpha > 8).astype(np.uint8)
    if close_size > 1:
        close_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_size, close_size))
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, close_kernel)
    if dilate_size > 1:
        dilate_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (dilate_size, dilate_size))
        binary = cv2.dilate(binary, dilate_kernel, iterations=1)
    mask = binary.astype(np.float32)
    if blur > 0:
        mask = cv2.GaussianBlur(mask, (0, 0), blur)
    return np.clip(mask, 0.0, 1.0)


def convex_occlusion_for_region(
    alpha: np.ndarray,
    region: tuple[int, int, int, int],
    blur: float = 1.25,
) -> np.ndarray:
    left, top, right, bottom = region
    crop = alpha[top:bottom, left:right]
    points_yx = np.column_stack(np.where(crop > 8))
    mask = np.zeros(alpha.shape, dtype=np.float32)
    if len(points_yx) < 3:
        return mask
    points_xy = np.column_stack((points_yx[:, 1] + left, points_yx[:, 0] + top)).astype(np.int32)
    hull = cv2.convexHull(points_xy)
    cv2.fillConvexPoly(mask, hull, 1.0)
    if blur > 0:
        mask = cv2.GaussianBlur(mask, (0, 0), blur)
    return np.clip(mask, 0.0, 1.0)


def apply_visibility_repairs(
    prepared: dict[str, np.ndarray],
    rough_dir: Path,
) -> dict[str, dict[str, int]]:
    stats: dict[str, dict[str, int]] = {}

    # Generated back characters keep their generated pixels, but their visible
    # envelope follows the accepted original composition. This prevents newly
    # reconstructed limbs and equipment from protruding through the front layer.
    for name, close_size, dilate_size in (
        ("shu-middle", 7, 11),
        ("ayano-middle", 9, 13),
    ):
        rough_path = rough_dir / f"{name}-v2.webp"
        rough = read_cv(rough_path)
        if rough.shape[:2] != (FINAL_SIZE[1], FINAL_SIZE[0]):
            raise ValueError(f"Unexpected visibility mask size: {rough_path}")
        envelope = soft_mask_from_alpha(rough[..., 3], close_size, dilate_size, 1.15)
        alpha = prepared[name][..., 3].astype(np.float32) / 255.0
        before = int(np.count_nonzero(alpha > 0.02))
        alpha *= envelope
        prepared[name][..., 3] = np.clip(alpha * 255.0 + 0.5, 0, 255).astype(np.uint8)
        stats[name] = {"envelope_removed_pixels": before - int(np.count_nonzero(alpha > 0.02))}

    # Use a filled front-hair occlusion volume only where the screenshot proved
    # that Shu/Ayano were leaking through Kisara's separated hair strands.
    kisara_rough = read_cv(rough_dir / "kisara-front-v2.webp")
    kisara_union = np.maximum(kisara_rough[..., 3], prepared["kisara-front"][..., 3])
    kisara_occlusion = soft_mask_from_alpha(kisara_union, 17, 7, 1.35)
    targets = {
        "shu-middle": ((724, 424, 838, 556),),
        "ayano-middle": ((916, 338, 1260, 658),),
    }
    for name, regions in targets.items():
        alpha = prepared[name][..., 3].astype(np.float32) / 255.0
        removed_before = int(np.count_nonzero(alpha > 0.02))
        for left, top, right, bottom in regions:
            region = (left, top, right, bottom)
            local_hull = convex_occlusion_for_region(kisara_union, region)
            occlusion = np.maximum(kisara_occlusion, local_hull)
            alpha[top:bottom, left:right] *= 1.0 - occlusion[top:bottom, left:right]
        prepared[name][..., 3] = np.clip(alpha * 255.0 + 0.5, 0, 255).astype(np.uint8)
        stats[name]["front_occlusion_removed_pixels"] = removed_before - int(np.count_nonzero(alpha > 0.02))

    # Ayano's generated layer contains a large isolated magenta strand cluster
    # above the valid blue hair. It is model-painted content, not chroma spill.
    ayano = prepared["ayano-middle"]
    strand_roi = ayano[154:312, 966:1132]
    blue, green, red, strand_alpha = cv2.split(strand_roi)
    magenta_strand = (
        (strand_alpha > 24)
        & (red.astype(np.int16) > green.astype(np.int16) + 22)
        & (blue.astype(np.int16) > green.astype(np.int16) + 10)
        & (red > 68)
    )
    strand_mask = np.zeros(ayano.shape[:2], dtype=np.uint8)
    strand_mask[154:312, 966:1132][magenta_strand] = 255
    strand_mask = cv2.dilate(strand_mask, np.ones((5, 5), dtype=np.uint8), iterations=1)
    strand_pixels = int(np.count_nonzero(strand_mask))
    ayano_alpha = ayano[..., 3].astype(np.float32) / 255.0
    strand_soft = cv2.GaussianBlur(strand_mask.astype(np.float32) / 255.0, (0, 0), 0.8)
    ayano_alpha *= 1.0 - np.clip(strand_soft, 0.0, 1.0)
    ayano[..., 3] = np.clip(ayano_alpha * 255.0 + 0.5, 0, 255).astype(np.uint8)
    stats["ayano-middle"]["magenta_strand_removed_pixels"] = strand_pixels

    # The user marked the generated green ovals on Kisara's weapon as unwanted.
    kisara = prepared["kisara-front"]
    weapon_roi = kisara[738:892, 404:532]
    blue, green, red, roi_alpha = cv2.split(weapon_roi)
    green_artifact = (
        (roi_alpha > 96)
        & (green.astype(np.int16) > red.astype(np.int16) + 14)
        & (green.astype(np.int16) > blue.astype(np.int16) + 6)
        & (green > 58)
    )
    weapon_mask = np.zeros(kisara.shape[:2], dtype=np.uint8)
    weapon_mask[738:892, 404:532][green_artifact] = 255
    weapon_mask = cv2.dilate(weapon_mask, np.ones((3, 3), dtype=np.uint8), iterations=1)
    weapon_pixels = int(np.count_nonzero(weapon_mask))
    if weapon_pixels:
        repaired_color = cv2.inpaint(kisara[..., :3], weapon_mask, 4.0, cv2.INPAINT_TELEA)
        kisara[..., :3] = repaired_color
    stats["kisara-front"] = {"weapon_green_pixels": weapon_pixels}
    return stats


def save_webp(path: Path, bgra: np.ndarray) -> None:
    rgba = cv2.cvtColor(bgra, cv2.COLOR_BGRA2RGBA)
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, mode="RGBA").save(path, "WEBP", quality=92, method=6, exact=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare generated Kisara Blog character layers.")
    parser.add_argument("--generated", type=Path, default=DEFAULT_GENERATED)
    parser.add_argument("--rough", type=Path, default=DEFAULT_ROUGH)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--qa", type=Path, default=DEFAULT_QA)
    args = parser.parse_args()

    generated_dir = args.generated.resolve()
    rough_dir = args.rough.resolve()
    output_dir = args.output.resolve()
    qa_dir = args.qa.resolve()
    qa_dir.mkdir(parents=True, exist_ok=True)
    segmentation_session = new_session("isnet-anime")

    summary: dict[str, dict[str, object]] = {}
    prepared: dict[str, np.ndarray] = {}
    for character in CHARACTERS:
        generated_path = generated_dir / character["generated"]
        rough_path = rough_dir / character["rough"]
        if not generated_path.exists() or not rough_path.exists():
            raise FileNotFoundError(generated_path if not generated_path.exists() else rough_path)

        generated_bgr = read_cv(generated_path, cv2.IMREAD_COLOR)
        if (generated_bgr.shape[1], generated_bgr.shape[0]) != WORK_SIZE:
            raise ValueError(f"Unexpected generated size: {generated_path}")
        generated_bgr, artifact_stats = repair_internal_artifacts(character["name"], generated_bgr)
        rough = fit_rough_layer(read_cv(rough_path))
        key_rgb = parse_hex_color(character["key"])
        keyed, key_stats = extract_anime_subject(
            generated_bgr,
            key_rgb,
            segmentation_session,
            float(character["repair_radius"]),
        )
        matrix, alignment_stats = estimate_alignment(generated_bgr, keyed[..., 3], rough, key_rgb)
        aligned = warp_premultiplied(keyed, matrix, WORK_SIZE)
        final = restore_source_aspect(aligned)

        prepared[character["name"]] = final
        summary[character["name"]] = {
            "source": str(generated_path),
            "key": character["key"],
            "artifact_repairs": artifact_stats,
            "chroma": key_stats,
            "alignment": alignment_stats,
        }

    visibility_stats = apply_visibility_repairs(prepared, rough_dir)
    for character in CHARACTERS:
        name = character["name"]
        qa_path = qa_dir / f"{name}-generated-v5.png"
        output_path = output_dir / f"{name}-generated-v5.webp"
        write_cv(qa_path, prepared[name])
        save_webp(output_path, prepared[name])
        summary[name]["qa"] = str(qa_path)
        summary[name]["output"] = str(output_path)
        summary[name]["visibility_repairs"] = visibility_stats.get(name, {})

    summary_path = qa_dir / "summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Prepared {len(CHARACTERS)} generated character layers.")
    print(summary_path)


if __name__ == "__main__":
    main()
