from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from pymatting import estimate_alpha_cf, estimate_foreground_ml
from rembg import new_session, remove
from scipy.ndimage import distance_transform_edt


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "output" / "imagegen" / "blog-character-reconstruction" / "luna"
DEFAULT_ROUGH = ROOT / "public" / "themes" / "kisara" / "assets" / "blog"
DEFAULT_FINAL = ROOT / "output" / "imagegen" / "blog-character-reconstruction" / "final"
DEFAULT_PUBLIC = ROOT / "public" / "themes" / "kisara" / "assets" / "blog"

WORK_SIZE = (1536, 1024)
SOURCE_FIT_SIZE = (1536, 1040)
SOURCE_CROP_TOP = 8
RUNTIME_SIZE = (1440, 975)
RUNTIME_SCALE = RUNTIME_SIZE[0] / SOURCE_FIT_SIZE[0]

CHARACTERS = (
    {
        "id": "shu",
        "layer": "shu-middle",
        "source": "shu-purple-v1.png",
        "rough": "shu-middle-v2.png",
        "key": "#7A00FF",
        "background": "fixed",
        "t_bg": 18.0,
        "t_fg": 74.0,
        "outer_band": 5,
        "margin": 36,
        "gradient_weight": 0.45,
        "stage_bbox": (470, 210, 820, 940),
    },
    {
        "id": "kisara",
        "layer": "kisara-front",
        "source": "kisara-green-v1.png",
        "rough": "kisara-front-v2.png",
        "key": "#00F05A",
        "background": "polynomial",
        "t_bg": 23.0,
        "t_fg": 76.0,
        "outer_band": 12,
        "margin": 42,
        "gradient_weight": 0.5,
        "stage_bbox": (370, 310, 1200, 975),
    },
    {
        "id": "ayano",
        "layer": "ayano-middle",
        "source": "ayano-magenta-v1.png",
        "rough": "ayano-middle-v2.png",
        "key": "#FF00B8",
        "background": "polynomial",
        "t_bg": 30.0,
        "t_fg": 82.0,
        "outer_band": 18,
        "margin": 46,
        "gradient_weight": 0.58,
        "stage_bbox": (870, 130, 1360, 840),
    },
    {
        "id": "sharon",
        "layer": "sharon-back",
        "source": "sharon-green-v1.png",
        "rough": "sharon-back-v2.png",
        "key": "#00E85C",
        "background": "polynomial",
        "t_bg": 20.0,
        "t_fg": 74.0,
        "outer_band": 10,
        "margin": 42,
        "gradient_weight": 0.48,
        "stage_bbox": (470, 45, 1000, 675),
    },
)


def read_cv(path: Path, flags: int = cv2.IMREAD_UNCHANGED) -> np.ndarray:
    image = cv2.imdecode(np.fromfile(str(path), dtype=np.uint8), flags)
    if image is None:
        raise ValueError(f"Unable to decode {path}")
    return image


def write_cv(path: Path, image: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ok, encoded = cv2.imencode(path.suffix, image)
    if not ok:
        raise ValueError(f"Unable to encode {path}")
    path.write_bytes(encoded.tobytes())


def parse_hex(value: str) -> np.ndarray:
    value = value.removeprefix("#")
    return np.array([int(value[index : index + 2], 16) for index in (0, 2, 4)], dtype=np.float64)


def smoothstep(edge0: float, edge1: float, value: np.ndarray) -> np.ndarray:
    normalized = np.clip((value - edge0) / max(edge1 - edge0, 1e-8), 0.0, 1.0)
    return normalized * normalized * (3.0 - 2.0 * normalized)


def srgb_to_linear(image: np.ndarray) -> np.ndarray:
    return np.where(image <= 0.04045, image / 12.92, ((image + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(image: np.ndarray) -> np.ndarray:
    image = np.clip(image, 0.0, 1.0)
    return np.where(image <= 0.0031308, image * 12.92, 1.055 * image ** (1.0 / 2.4) - 0.055)


def polynomial_features(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    return np.column_stack(
        (
            np.ones_like(x),
            x,
            y,
            x * x,
            x * y,
            y * y,
            x * x * x,
            x * x * y,
            x * y * y,
            y * y * y,
        )
    )


def fit_background_field(
    rgb: np.ndarray,
    model_alpha: np.ndarray,
    key_rgb: np.ndarray,
    mode: str,
) -> np.ndarray:
    if mode == "fixed":
        return np.broadcast_to(key_rgb, rgb.shape).astype(np.float64).copy()

    height, width = model_alpha.shape
    yy, xx = np.mgrid[0:height, 0:width]
    x = xx.astype(np.float64) / max(width - 1, 1) * 2.0 - 1.0
    y = yy.astype(np.float64) / max(height - 1, 1) * 2.0 - 1.0
    nominal_distance = np.linalg.norm(rgb.astype(np.float64) - key_rgb[None, None, :], axis=2)
    sample_mask = (model_alpha < 0.025) & (nominal_distance < 125.0)
    sample_mask[::8, ::8] &= True
    sparse_mask = np.zeros_like(sample_mask)
    sparse_mask[::8, ::8] = sample_mask[::8, ::8]
    sample_y, sample_x = np.where(sparse_mask)
    if len(sample_x) < 200:
        return np.broadcast_to(key_rgb, rgb.shape).astype(np.float64).copy()

    design = polynomial_features(x[sample_y, sample_x], y[sample_y, sample_x])
    values = rgb[sample_y, sample_x].astype(np.float64)
    coefficients = np.linalg.lstsq(design, values, rcond=None)[0]
    for _ in range(2):
        prediction = design @ coefficients
        residual = np.linalg.norm(prediction - values, axis=1)
        cutoff = min(float(np.percentile(residual, 88.0)), 30.0)
        keep = residual <= max(cutoff, 8.0)
        coefficients = np.linalg.lstsq(design[keep], values[keep], rcond=None)[0]

    field_design = polynomial_features(x.ravel(), y.ravel())
    field = (field_design @ coefficients).reshape(height, width, 3)
    return np.clip(field, 0.0, 255.0)


def keep_components(candidate: np.ndarray, core: np.ndarray) -> np.ndarray:
    component_count, labels, stats, _ = cv2.connectedComponentsWithStats(candidate.astype(np.uint8), 8)
    keep = np.zeros(candidate.shape, dtype=np.uint8)
    for label in range(1, component_count):
        component = labels == label
        area = int(stats[label, cv2.CC_STAT_AREA])
        if area < 4:
            continue
        if np.count_nonzero(component & core) >= 3:
            keep[component] = 1
    return keep


def border_connected(mask: np.ndarray) -> np.ndarray:
    component_count, labels = cv2.connectedComponents(mask.astype(np.uint8), 8)
    border_labels = np.unique(
        np.concatenate((labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]))
    )
    connected = np.zeros(mask.shape, dtype=bool)
    for label in border_labels:
        if label != 0:
            connected |= labels == label
    return connected


def build_trimap(
    model_alpha: np.ndarray,
    color_distance: np.ndarray,
    t_bg: float,
    t_fg: float,
    outer_band: int,
) -> tuple[np.ndarray, np.ndarray]:
    loose_background = border_connected((color_distance < t_fg) & (model_alpha < 0.35))
    core = (model_alpha > 0.985) & ~loose_background
    candidate = (model_alpha > 0.08) | ((model_alpha > 0.012) & (color_distance > t_bg * 1.45))
    candidate = keep_components(candidate, core)

    foreground_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    sure_foreground = cv2.erode(core.astype(np.uint8), foreground_kernel, iterations=1) > 0

    outer_size = outer_band * 2 + 1
    outer_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (outer_size, outer_size))
    dilated_candidate = cv2.dilate(candidate, outer_kernel, iterations=1) > 0
    sure_background = ~dilated_candidate

    color_background = (color_distance < t_bg) & (model_alpha < 0.35)
    sure_background |= border_connected(color_background)
    sure_background[0, :] = True
    sure_background[-1, :] = True
    sure_background[:, 0] = True
    sure_background[:, -1] = True
    sure_foreground &= ~sure_background

    trimap = np.full(model_alpha.shape, 0.5, dtype=np.float64)
    trimap[sure_background] = 0.0
    trimap[sure_foreground] = 1.0
    return trimap, candidate


def matte_character(
    image_bgr: np.ndarray,
    key_rgb: np.ndarray,
    session: object,
    config: dict[str, object],
) -> tuple[np.ndarray, np.ndarray, dict[str, object]]:
    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    source = Image.fromarray(rgb, mode="RGB")
    model_mask = remove(source, session=session, only_mask=True, post_process_mask=False)
    if not isinstance(model_mask, Image.Image):
        raise ValueError("ISNet did not return an image mask")
    model_alpha = np.asarray(model_mask.convert("L"), dtype=np.float64) / 255.0
    background = fit_background_field(
        rgb,
        model_alpha,
        key_rgb,
        str(config["background"]),
    )
    color_distance = np.linalg.norm(rgb.astype(np.float64) - background, axis=2)
    trimap, candidate = build_trimap(
        model_alpha,
        color_distance,
        float(config["t_bg"]),
        float(config["t_fg"]),
        int(config["outer_band"]),
    )

    candidate_y, candidate_x = np.where(candidate > 0)
    margin = int(config["margin"])
    left = max(0, int(candidate_x.min()) - margin)
    right = min(rgb.shape[1], int(candidate_x.max()) + 1 + margin)
    top = max(0, int(candidate_y.min()) - margin)
    bottom = min(rgb.shape[0], int(candidate_y.max()) + 1 + margin)

    srgb = rgb.astype(np.float64) / 255.0
    linear = srgb_to_linear(srgb)
    crop_linear = linear[top:bottom, left:right]
    crop_trimap = trimap[top:bottom, left:right]
    crop_model = model_alpha[top:bottom, left:right]

    alpha = estimate_alpha_cf(
        crop_linear,
        crop_trimap,
        cg_kwargs={"maxiter": 2400, "rtol": 1e-6},
    )
    alpha = np.clip(alpha, 0.0, 1.0)
    alpha[crop_trimap == 0.0] = 0.0
    alpha[crop_trimap == 1.0] = 1.0

    inside_distance = distance_transform_edt(alpha > 0.02)
    # The four assets contain no physically translucent materials. Once a matte
    # region is more than three pixels inside the solved silhouette, keep it fully
    # opaque and preserve the source RGB; only the actual contour remains soft.
    harden = inside_distance > 3.0
    alpha[harden] = 1.0
    alpha[alpha > 0.995] = 1.0
    alpha[alpha < 1.0 / 255.0] = 0.0

    estimated_foreground = estimate_foreground_ml(
        crop_linear,
        alpha,
        regularization=1e-5,
        n_small_iterations=10,
        n_big_iterations=2,
        small_size=32,
        gradient_weight=float(config["gradient_weight"]),
    )
    estimated_srgb = linear_to_srgb(estimated_foreground)
    original_srgb = srgb[top:bottom, left:right]
    edge_mix = np.clip((0.985 - alpha) / 0.18, 0.0, 1.0)[..., None]
    foreground = original_srgb * (1.0 - edge_mix) + estimated_srgb * edge_mix

    rgba = np.zeros((rgb.shape[0], rgb.shape[1], 4), dtype=np.uint8)
    rgba[top:bottom, left:right, :3] = np.clip(foreground * 255.0 + 0.5, 0, 255).astype(np.uint8)
    rgba[top:bottom, left:right, 3] = np.clip(alpha * 255.0 + 0.5, 0, 255).astype(np.uint8)
    rgba[rgba[..., 3] == 0, :3] = 0

    stats = {
        "crop": [left, top, right, bottom],
        "trimap_foreground": int(np.count_nonzero(crop_trimap == 1.0)),
        "trimap_background": int(np.count_nonzero(crop_trimap == 0.0)),
        "trimap_unknown": int(np.count_nonzero(crop_trimap == 0.5)),
    }
    return rgba, model_alpha, stats


def fit_rough_layer(image: np.ndarray) -> np.ndarray:
    resized = cv2.resize(image, SOURCE_FIT_SIZE, interpolation=cv2.INTER_LANCZOS4)
    return resized[SOURCE_CROP_TOP : SOURCE_CROP_TOP + WORK_SIZE[1], :, :]


def estimate_alignment(
    generated_bgr: np.ndarray,
    generated_alpha: np.ndarray,
    rough: np.ndarray,
    key_rgb: np.ndarray,
) -> tuple[np.ndarray, dict[str, float]]:
    rough_alpha = rough[..., 3]
    rough_bgr = rough[..., :3].copy()
    rough_bgr[rough_alpha == 0] = key_rgb[::-1].astype(np.uint8)

    sift = cv2.SIFT_create(nfeatures=5000, contrastThreshold=0.016)
    target_points, target_descriptors = sift.detectAndCompute(
        cv2.cvtColor(rough_bgr, cv2.COLOR_BGR2GRAY), rough_alpha
    )
    source_points, source_descriptors = sift.detectAndCompute(
        cv2.cvtColor(generated_bgr, cv2.COLOR_BGR2GRAY), generated_alpha
    )
    if target_descriptors is None or source_descriptors is None:
        raise ValueError("Unable to find alignment descriptors")

    matches = cv2.BFMatcher().knnMatch(source_descriptors, target_descriptors, k=2)
    good = [first for first, second in matches if first.distance < 0.72 * second.distance]
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
    scale = float(np.hypot(matrix[0, 0], matrix[0, 1]))
    angle = float(np.degrees(np.arctan2(matrix[1, 0], matrix[0, 0])))
    return matrix, {
        "matches": len(good),
        "inliers": int(inliers.sum()),
        "scale": round(scale, 6),
        "angle": round(angle, 4),
        "translate_x": round(float(matrix[0, 2]), 3),
        "translate_y": round(float(matrix[1, 2]), 3),
    }


def source_to_runtime_matrix(matrix: np.ndarray) -> np.ndarray:
    affine = np.vstack((matrix, np.array([0.0, 0.0, 1.0])))
    pad = np.array([[1.0, 0.0, 0.0], [0.0, 1.0, SOURCE_CROP_TOP], [0.0, 0.0, 1.0]])
    scale = np.array([[RUNTIME_SCALE, 0.0, 0.0], [0.0, RUNTIME_SCALE, 0.0], [0.0, 0.0, 1.0]])
    return scale @ pad @ affine


def runtime_rect_to_source_mask(
    rect: tuple[int, int, int, int],
    matrix: np.ndarray,
    shape: tuple[int, int],
) -> np.ndarray:
    left, top, right, bottom = rect
    runtime_mask = np.zeros((RUNTIME_SIZE[1], RUNTIME_SIZE[0]), dtype=np.uint8)
    runtime_mask[top:bottom, left:right] = 255
    inverse = np.linalg.inv(source_to_runtime_matrix(matrix))
    return cv2.warpPerspective(
        runtime_mask,
        inverse,
        (shape[1], shape[0]),
        flags=cv2.INTER_NEAREST,
        borderMode=cv2.BORDER_CONSTANT,
        borderValue=0,
    )


def pre_repair_source(name: str, image_bgr: np.ndarray) -> tuple[np.ndarray, dict[str, int]]:
    repaired = image_bgr.copy()
    stats = {"green_hair": 0, "blue_sock": 0}
    if name != "sharon":
        return repaired, stats

    green_mask = np.zeros(repaired.shape[:2], dtype=np.uint8)
    roi = repaired[247:286, 878:930]
    blue, green, red = cv2.split(roi)
    contamination = (
        (green.astype(np.int16) > red.astype(np.int16) + 16)
        & (green.astype(np.int16) > blue.astype(np.int16) + 8)
        & (green > 72)
    )
    green_mask[247:286, 878:930][contamination] = 255
    green_mask = cv2.dilate(green_mask, np.ones((3, 3), dtype=np.uint8), iterations=1)
    stats["green_hair"] = int(np.count_nonzero(green_mask))
    if stats["green_hair"]:
        repaired = cv2.inpaint(repaired, green_mask, 3.5, cv2.INPAINT_TELEA)

    patch = repaired[272:284, 901:917]
    blue, green, red = cv2.split(patch)
    contamination = (
        (blue.astype(np.int16) > red.astype(np.int16) + 20)
        & (blue.astype(np.int16) > green.astype(np.int16) + 10)
        & (blue > 78)
    )
    blue_mask = np.zeros(repaired.shape[:2], dtype=bool)
    blue_mask[272:284, 901:917] = contamination
    stats["blue_sock"] = int(np.count_nonzero(blue_mask))
    if stats["blue_sock"]:
        local = repaired[258:302, 888:930]
        local_hsv = cv2.cvtColor(local, cv2.COLOR_BGR2HSV)
        white_local = (local_hsv[..., 1] < 62) & (local_hsv[..., 2] > 96)
        white_safe = np.zeros(repaired.shape[:2], dtype=bool)
        white_safe[258:302, 888:930] = white_local
        _, nearest = distance_transform_edt(~white_safe, return_indices=True)
        repaired[blue_mask] = repaired[nearest[0][blue_mask], nearest[1][blue_mask]]
    return repaired, stats


def repair_rgba(
    name: str,
    rgba: np.ndarray,
    alignment: np.ndarray,
) -> tuple[np.ndarray, dict[str, int]]:
    repaired = rgba.copy()
    stats = {"magenta_strand": 0, "green_weapon": 0}

    if name == "ayano":
        region = runtime_rect_to_source_mask((966, 154, 1132, 312), alignment, rgba.shape[:2]) > 0
        red = repaired[..., 0].astype(np.int16)
        green = repaired[..., 1].astype(np.int16)
        blue = repaired[..., 2].astype(np.int16)
        magenta = (
            region
            & (repaired[..., 3] > 24)
            & (red > green + 22)
            & (blue > green + 10)
            & (red > 68)
        )
        mask = cv2.dilate(magenta.astype(np.uint8), np.ones((5, 5), dtype=np.uint8), iterations=1)
        stats["magenta_strand"] = int(np.count_nonzero(mask))
        repaired[mask > 0, 3] = 0
        repaired[mask > 0, :3] = 0

    if name == "kisara":
        region = runtime_rect_to_source_mask((404, 738, 532, 892), alignment, rgba.shape[:2]) > 0
        red = repaired[..., 0].astype(np.int16)
        green = repaired[..., 1].astype(np.int16)
        blue = repaired[..., 2].astype(np.int16)
        artifact = (
            region
            & (repaired[..., 3] > 96)
            & (green > red + 14)
            & (green > blue + 6)
            & (green > 58)
        )
        mask = cv2.dilate(artifact.astype(np.uint8), np.ones((3, 3), dtype=np.uint8), iterations=1)
        stats["green_weapon"] = int(np.count_nonzero(mask))
        if stats["green_weapon"]:
            bgr = cv2.cvtColor(repaired[..., :3], cv2.COLOR_RGB2BGR)
            bgr = cv2.inpaint(bgr, mask * 255, 4.0, cv2.INPAINT_TELEA)
            repaired[..., :3] = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

    repaired[repaired[..., 3] == 0, :3] = 0
    return repaired, stats


def repair_kisara_edges(rgba: np.ndarray) -> tuple[np.ndarray, dict[str, int]]:
    repaired = rgba.copy()
    alpha = repaired[..., 3]
    inside_distance = distance_transform_edt(alpha > 2)
    safe_interior = (alpha >= 250) & (inside_distance >= 5.0)
    _, nearest = distance_transform_edt(~safe_interior, return_indices=True)

    rgb_repair = np.zeros(alpha.shape, dtype=bool)
    for left, top, right, bottom in (
        (945, 155, 1110, 345),
        (435, 135, 610, 405),
    ):
        region = np.zeros(alpha.shape, dtype=bool)
        region[top:bottom, left:right] = True
        rgb_repair |= region & (alpha > 2) & (inside_distance <= 2.25)

    repaired[rgb_repair, :3] = repaired[nearest[0][rgb_repair], nearest[1][rgb_repair], :3]

    eroded_alpha = cv2.erode(alpha, np.ones((3, 3), dtype=np.uint8), iterations=1)
    alpha_repair = np.zeros(alpha.shape, dtype=bool)
    for left, top, right, bottom in (
        (585, 390, 705, 480),
        (790, 390, 1015, 525),
    ):
        region = np.zeros(alpha.shape, dtype=bool)
        region[top:bottom, left:right] = True
        alpha_repair |= region & (alpha > 2) & (inside_distance <= 2.5)
    repaired[alpha_repair, 3] = eroded_alpha[alpha_repair]
    repaired[repaired[..., 3] == 0, :3] = 0
    return repaired, {
        "rgb_edge_pixels": int(np.count_nonzero(rgb_repair)),
        "alpha_edge_pixels": int(np.count_nonzero(alpha_repair)),
    }


def repair_kisara_shoulder_pollution(
    rgba: np.ndarray,
    original_source_bgr: np.ndarray,
) -> tuple[np.ndarray, dict[str, int]]:
    repaired = rgba.copy()
    source = cv2.cvtColor(original_source_bgr, cv2.COLOR_BGR2RGB).astype(np.int16)
    roi = np.zeros(repaired.shape[:2], dtype=bool)
    roi[250:365, 915:1090] = True
    source_green = (
        (source[..., 1] > source[..., 0] + 28)
        & (source[..., 1] > source[..., 2] + 20)
        & (source[..., 1] > 110)
    )
    source_red = (
        (source[..., 0] > source[..., 1] + 62)
        & (source[..., 0] > source[..., 2] + 32)
    )

    removed = np.zeros(repaired.shape[:2], dtype=bool)
    recolored = np.zeros(repaired.shape[:2], dtype=bool)
    for _ in range(2):
        rgb = repaired[..., :3].astype(np.int16)
        alpha = repaired[..., 3]
        output_red = (
            roi
            & (alpha > 12)
            & (rgb[..., 0] > rgb[..., 1] + 34)
            & (rgb[..., 0] > rgb[..., 2] + 18)
        )
        false_fragment = output_red & source_green
        shifted_hair = output_red & ~source_green & ~source_red
        safe_hair = (
            roi
            & (alpha > 90)
            & (rgb[..., 0] > 155)
            & (rgb[..., 2] > 145)
            & (rgb[..., 0] > rgb[..., 1] + 22)
            & (rgb[..., 2] > rgb[..., 1] + 15)
            & (np.abs(rgb[..., 0] - rgb[..., 2]) < 68)
            & ~output_red
        )

        repaired[false_fragment, 3] = 0
        repaired[false_fragment, :3] = 0
        removed |= false_fragment
        recolored |= shifted_hair
        if np.any(safe_hair) and np.any(shifted_hair):
            _, nearest = distance_transform_edt(~safe_hair, return_indices=True)
            nearby = rgb[nearest[0][shifted_hair], nearest[1][shifted_hair]]
            restored = nearby * 0.72 + source[shifted_hair] * 0.28
            repaired[shifted_hair, :3] = np.clip(restored, 0, 255).astype(np.uint8)

    orphan_strand = np.zeros(repaired.shape[:2], dtype=np.uint8)
    strand_points = np.array(
        ((943, 289), (950, 295), (958, 300), (965, 304), (973, 310), (980, 313)),
        dtype=np.int32,
    )
    cv2.polylines(orphan_strand, [strand_points], False, 255, 5, cv2.LINE_AA)
    remove_strand = (orphan_strand > 16) & (repaired[..., 3] > 0)
    remove_strand[300:311, 954:963] |= repaired[300:311, 954:963, 3] > 0
    repaired[remove_strand] = 0

    repaired[repaired[..., 3] == 0, :3] = 0
    return repaired, {
        "false_red_fragments_removed": int(np.count_nonzero(removed)),
        "red_shifted_hair_recolored": int(np.count_nonzero(recolored)),
        "orphan_strand_pixels_removed": int(np.count_nonzero(remove_strand)),
    }


def build_artifact_mask(
    rgba: np.ndarray,
    rect: tuple[int, int, int, int],
    color: str,
) -> tuple[np.ndarray, np.ndarray]:
    rgb = rgba[..., :3].astype(np.int16)
    alpha = rgba[..., 3]
    hsv = cv2.cvtColor(rgba[..., :3], cv2.COLOR_RGB2HSV)
    left, top, right, bottom = rect
    region = np.zeros(alpha.shape, dtype=bool)
    region[top:bottom, left:right] = True

    if color == "magenta":
        core = (
            region
            & (alpha > 8)
            & (hsv[..., 0] >= 145)
            & (hsv[..., 0] <= 175)
            & (hsv[..., 1] > 135)
            & (hsv[..., 2] > 105)
            & (rgb[..., 0] > rgb[..., 1] + 65)
            & (rgb[..., 2] > rgb[..., 1] + 35)
        )
    else:
        core = (
            region
            & (alpha > 8)
            & (hsv[..., 0] >= 38)
            & (hsv[..., 0] <= 105)
            & (hsv[..., 1] > 65)
            & (hsv[..., 2] > 65)
            & (rgb[..., 1] > rgb[..., 0] + 12)
            & (rgb[..., 1] > rgb[..., 2] + 5)
        )
    repair = cv2.dilate(core.astype(np.uint8), np.ones((5, 5), dtype=np.uint8), iterations=1) > 0
    return core, repair


def nearest_interior_fill(rgb: np.ndarray, alpha: np.ndarray, repair: np.ndarray) -> np.ndarray:
    safe = (alpha > 245) & ~repair
    _, nearest = distance_transform_edt(~safe, return_indices=True)
    fixed = rgb.copy()
    fixed[repair] = rgb[nearest[0][repair], nearest[1][repair]]
    return fixed


def inpaint_rgb(rgb: np.ndarray, repair: np.ndarray, radius: float) -> np.ndarray:
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    fixed = cv2.inpaint(
        bgr,
        repair.astype(np.uint8) * 255,
        radius,
        cv2.INPAINT_TELEA,
    )
    return cv2.cvtColor(fixed, cv2.COLOR_BGR2RGB)


def repair_internal_artifacts(
    name: str,
    rgba: np.ndarray,
    rough: np.ndarray,
    alignment: np.ndarray,
) -> tuple[np.ndarray, dict[str, int]]:
    specifications: dict[str, tuple[tuple[int, int, int, int], str, str, float]] = {}
    if name == "sharon":
        specifications = {
            "torso_green": ((878, 107, 978, 323), "green", "nearest", 0.0),
        }
    elif name == "ayano":
        specifications = {
            "face_magenta": ((916, 119, 988, 249), "magenta", "reference", 4.0),
        }
    elif name == "kisara":
        specifications = {
            "weapon_green": ((636, 324, 690, 446), "green", "nearest", 0.0),
            "chest_green": ((885, 232, 1048, 402), "green", "inpaint", 5.0),
        }
    if not specifications:
        return rgba, {}

    repaired = rgba.copy()
    rgb = repaired[..., :3].copy()
    alpha = repaired[..., 3]
    reference: np.ndarray | None = None
    stats: dict[str, int] = {}

    for label, (rect, color, method, radius) in specifications.items():
        core, repair = build_artifact_mask(repaired, rect, color)
        if method == "nearest":
            fixed = nearest_interior_fill(rgb, alpha, repair)
        else:
            fixed = inpaint_rgb(rgb, repair, radius)
            if method == "reference":
                if reference is None:
                    inverse = cv2.invertAffineTransform(alignment)
                    reference = warp_premultiplied(
                        rough,
                        inverse,
                        (rgba.shape[1], rgba.shape[0]),
                    )
                covered = repair & (reference[..., 3] > 160)
                fixed[covered] = reference[covered, :3]
                stats[f"{label}_reference"] = int(np.count_nonzero(covered))
        rgb[repair] = fixed[repair]
        repaired[..., :3] = rgb
        stats[f"{label}_core"] = int(np.count_nonzero(core))
        stats[f"{label}_repair"] = int(np.count_nonzero(repair))

    repaired[alpha == 0, :3] = 0
    return repaired, stats


def refine_reported_artifacts(
    name: str,
    rgba: np.ndarray,
    original_source_bgr: np.ndarray,
) -> tuple[np.ndarray, dict[str, int]]:
    repaired = rgba.copy()
    source_rgb = cv2.cvtColor(original_source_bgr, cv2.COLOR_BGR2RGB)
    stats: dict[str, int] = {}

    if name == "kisara":
        roi = np.zeros(repaired.shape[:2], dtype=bool)
        roi[190:440, 840:1090] = True
        key_rgb = np.array([0.0, 240.0, 90.0], dtype=np.float32)
        distance = np.linalg.norm(source_rgb.astype(np.float32) - key_rgb[None, None, :], axis=2)
        chroma_alpha = smoothstep(24.0, 66.0, distance) * 255.0
        previous_alpha = repaired[..., 3].copy()
        repaired[..., 3][roi] = np.minimum(repaired[..., 3][roi], chroma_alpha[roi]).astype(np.uint8)
        source = source_rgb.astype(np.int16)
        certain_background = (
            roi
            & (source[..., 1] > source[..., 0] + 35)
            & (source[..., 1] > source[..., 2] + 25)
            & (source[..., 1] > 120)
        )
        repaired[..., 3][certain_background] = 0

        alpha = repaired[..., 3]
        green_edge = (
            roi
            & (alpha > 0)
            & (alpha < 245)
            & (source[..., 1] > source[..., 0] + 18)
            & (source[..., 1] > source[..., 2] + 10)
        )
        safe = roi & (alpha > 248) & ~green_edge
        if np.any(safe) and np.any(green_edge):
            _, nearest = distance_transform_edt(~safe, return_indices=True)
            repaired[green_edge, :3] = repaired[nearest[0][green_edge], nearest[1][green_edge], :3]

        stats["false_fill_removed"] = int(np.count_nonzero(previous_alpha > repaired[..., 3]))
        stats["green_edge_decontaminated"] = int(np.count_nonzero(green_edge))

    elif name == "ayano":
        # The reference-color repair can make key-colored pixels beside Ayano's
        # cheek opaque. Clear only the confirmed floating component while
        # preserving the real blue strand that crosses the same small region.
        face_roi = np.zeros(repaired.shape[:2], dtype=bool)
        face_roi[150:235, 900:980] = True
        key_rgb = np.array([255.0, 0.0, 184.0], dtype=np.float32)
        key_distance = np.linalg.norm(source_rgb.astype(np.float32) - key_rgb[None, None, :], axis=2)
        false_face_fill = face_roi & (key_distance < 42.0) & (repaired[..., 3] > 20)
        component_count, labels, component_stats, _ = cv2.connectedComponentsWithStats(
            false_face_fill.astype(np.uint8),
            8,
        )
        removed_face_fill = np.zeros(false_face_fill.shape, dtype=bool)
        for label in range(1, component_count):
            x = int(component_stats[label, cv2.CC_STAT_LEFT])
            y = int(component_stats[label, cv2.CC_STAT_TOP])
            width = int(component_stats[label, cv2.CC_STAT_WIDTH])
            height = int(component_stats[label, cv2.CC_STAT_HEIGHT])
            area = int(component_stats[label, cv2.CC_STAT_AREA])
            if area >= 120 and x >= 910 and y >= 155 and width >= 18 and height >= 24:
                removed_face_fill |= labels == label
        repaired[removed_face_fill] = 0
        stats["false_face_fill_removed"] = int(np.count_nonzero(removed_face_fill))

        roi = np.zeros(repaired.shape[:2], dtype=bool)
        roi[57:315, 560:824] = True
        source = source_rgb.astype(np.float32)
        key_rgb = np.array([255.0, 0.0, 184.0], dtype=np.float32)
        distance = np.linalg.norm(source - key_rgb[None, None, :], axis=2)
        blue_score = source[..., 2] - source[..., 0]
        chroma_alpha = smoothstep(28.0, 74.0, distance) * smoothstep(-12.0, 32.0, blue_score) * 255.0
        candidate = roi & (chroma_alpha > 2)
        component_count, labels, component_stats, _ = cv2.connectedComponentsWithStats(
            candidate.astype(np.uint8),
            8,
        )
        near_existing = cv2.dilate(
            (repaired[..., 3] > 12).astype(np.uint8),
            np.ones((5, 5), dtype=np.uint8),
            iterations=1,
        ) > 0
        keep = np.zeros(candidate.shape, dtype=bool)
        for label in range(1, component_count):
            component = labels == label
            area = int(component_stats[label, cv2.CC_STAT_AREA])
            if area >= 4 and np.any(component & near_existing):
                keep |= component

        add_alpha = np.where(keep, chroma_alpha, 0).astype(np.uint8)
        added = keep & (add_alpha > repaired[..., 3])
        repaired[..., 3] = np.maximum(repaired[..., 3], add_alpha)
        repaired[added, :3] = source_rgb[added]
        edge_added = added & (add_alpha < 220)
        if np.any(edge_added):
            edge_rgb = repaired[..., :3].astype(np.int16)
            red_cap = (edge_rgb[..., 2] * 0.58 + edge_rgb[..., 1] * 0.22).astype(np.int16)
            edge_rgb[..., 0][edge_added] = np.minimum(edge_rgb[..., 0][edge_added], red_cap[edge_added])
            repaired[..., :3] = np.clip(edge_rgb, 0, 255).astype(np.uint8)

        stats["hair_pixels_restored"] = int(np.count_nonzero(added))
        stats["restored_edge_despill"] = int(np.count_nonzero(edge_added))

    elif name == "sharon":
        source_hsv = cv2.cvtColor(source_rgb, cv2.COLOR_RGB2HSV)
        region = np.zeros(repaired.shape[:2], dtype=bool)
        region[235:305, 860:950] = True
        cyan = (
            region
            & (repaired[..., 3] > 20)
            & (source_hsv[..., 0] >= 72)
            & (source_hsv[..., 0] <= 105)
            & (source_hsv[..., 1] > 90)
            & (source_hsv[..., 2] > 85)
        )
        repair = cv2.morphologyEx(
            cyan.astype(np.uint8),
            cv2.MORPH_CLOSE,
            np.ones((3, 3), dtype=np.uint8),
        ) > 0
        repair = cv2.dilate(
            repair.astype(np.uint8),
            np.ones((3, 3), dtype=np.uint8),
            iterations=1,
        ) > 0
        replacement = repaired[..., :3].copy()
        replacement[:-30] = repaired[30:, :, :3]
        feather = cv2.GaussianBlur(repair.astype(np.float32), (0, 0), 0.95)
        feather = np.clip(
            np.maximum(repair.astype(np.float32), feather * 0.66),
            0.0,
            1.0,
        )[..., None]
        repaired[..., :3] = np.clip(
            repaired[..., :3] * (1.0 - feather) + replacement * feather,
            0,
            255,
        ).astype(np.uint8)
        stats["cyan_thigh_pixels_repaired"] = int(np.count_nonzero(repair))

    repaired[repaired[..., 3] == 0, :3] = 0
    return repaired, stats


def warp_premultiplied(rgba: np.ndarray, matrix: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    alpha = rgba[..., 3:4].astype(np.float32) / 255.0
    premultiplied = rgba[..., :3].astype(np.float32) * alpha
    warped_alpha = cv2.warpAffine(alpha, matrix, size, flags=cv2.INTER_LANCZOS4, borderValue=0)
    warped_color = cv2.warpAffine(premultiplied, matrix, size, flags=cv2.INTER_LANCZOS4, borderValue=0)
    if warped_alpha.ndim == 2:
        warped_alpha = warped_alpha[..., None]
    color = np.divide(
        warped_color,
        np.maximum(warped_alpha, 1e-6),
        out=np.zeros_like(warped_color),
        where=warped_alpha > 1e-6,
    )
    return np.dstack((np.clip(color, 0, 255), np.clip(warped_alpha[..., 0] * 255.0, 0, 255))).astype(np.uint8)


def resize_premultiplied(rgba: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    alpha = rgba[..., 3:4].astype(np.float32) / 255.0
    premultiplied = rgba[..., :3].astype(np.float32) * alpha
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


def align_runtime(rgba: np.ndarray, matrix: np.ndarray) -> np.ndarray:
    work = warp_premultiplied(rgba, matrix, WORK_SIZE)
    canvas = np.zeros((SOURCE_FIT_SIZE[1], SOURCE_FIT_SIZE[0], 4), dtype=np.uint8)
    canvas[SOURCE_CROP_TOP : SOURCE_CROP_TOP + WORK_SIZE[1], :, :] = work
    return resize_premultiplied(canvas, RUNTIME_SIZE)


def place_runtime(
    rgba: np.ndarray,
    target_bbox: tuple[int, int, int, int],
) -> np.ndarray:
    source_alpha = rgba[..., 3]
    source_y, source_x = np.where(source_alpha > 0)
    source_bbox = (
        int(source_x.min()),
        int(source_y.min()),
        int(source_x.max()) + 1,
        int(source_y.max()) + 1,
    )
    left, top, right, bottom = target_bbox
    source_left, source_top, source_right, source_bottom = source_bbox
    cropped = rgba[source_top:source_bottom, source_left:source_right]
    available_width = right - left
    available_height = bottom - top
    scale = min(available_width / cropped.shape[1], available_height / cropped.shape[0])
    target_width = max(1, int(round(cropped.shape[1] * scale)))
    target_height = max(1, int(round(cropped.shape[0] * scale)))
    resized = resize_premultiplied(cropped, (target_width, target_height))

    target_left = left + (available_width - target_width) // 2
    target_top = top + (available_height - target_height) // 2
    canvas = np.zeros((RUNTIME_SIZE[1], RUNTIME_SIZE[0], 4), dtype=np.uint8)
    canvas[target_top : target_top + target_height, target_left : target_left + target_width] = resized
    return canvas


def repair_kisara_runtime_ribbon_edges(
    rgba: np.ndarray,
) -> tuple[np.ndarray, dict[str, int]]:
    repaired = rgba.copy()
    alpha = repaired[..., 3]
    upper_roi = np.zeros(alpha.shape, dtype=bool)
    upper_roi[451:507, 919:1045] = True
    target_roi = upper_roi.copy()
    target_roi[493:545, 932:988] = True

    component_count, labels, component_stats, _ = cv2.connectedComponentsWithStats(
        (alpha >= 3).astype(np.uint8),
        8,
    )
    main_label = 1 + int(np.argmax(component_stats[1:, cv2.CC_STAT_AREA]))
    remove = np.zeros(alpha.shape, dtype=bool)
    removed_components = 0
    for label in range(1, component_count):
        if label == main_label:
            continue
        component = labels == label
        area = int(component_stats[label, cv2.CC_STAT_AREA])
        max_alpha = int(alpha[component].max()) if np.any(component) else 0
        remove_low_alpha_noise = area <= 4 and max_alpha <= 12
        remove_marked_floating_fragment = area <= 15 and np.all(target_roi[component])
        if (
            (remove_low_alpha_noise or remove_marked_floating_fragment)
            and np.any(component & upper_roi)
        ):
            remove |= component
            removed_components += 1
    repaired[remove] = 0

    red = repaired[..., 0].astype(np.int16)
    green = repaired[..., 1].astype(np.int16)
    blue = repaired[..., 2].astype(np.int16)
    alpha = repaired[..., 3]
    red_edge = (red > green + 24) & (red > blue + 8) & (red > 88)
    dark_edge = np.maximum(np.maximum(red, green), blue) < 112
    partial_edge = (
        target_roi
        & (labels == main_label)
        & (alpha >= 3)
        & (alpha <= 128)
    )
    decontaminated = np.zeros(alpha.shape, dtype=bool)
    for color_family in (red_edge, dark_edge):
        safe = (alpha >= 220) & color_family
        target = partial_edge & color_family
        if not np.any(safe) or not np.any(target):
            continue
        _, nearest = distance_transform_edt(~safe, return_indices=True)
        nearest_rgb = repaired[nearest[0][target], nearest[1][target], :3].astype(np.float32)
        current_rgb = repaired[target, :3].astype(np.float32)
        replace = np.linalg.norm(current_rgb - nearest_rgb, axis=1) > 48.0
        target_y, target_x = np.where(target)
        target_y = target_y[replace]
        target_x = target_x[replace]
        repaired[target_y, target_x, :3] = np.clip(
            nearest_rgb[replace] * 0.72 + current_rgb[replace] * 0.28,
            0,
            255,
        ).astype(np.uint8)
        decontaminated[target_y, target_x] = True

    red = repaired[..., 0].astype(np.int16)
    green = repaired[..., 1].astype(np.int16)
    blue = repaired[..., 2].astype(np.int16)
    alpha = repaired[..., 3]
    ribbon_seed = (
        target_roi
        & (alpha >= 12)
        & (red > green + 40)
        & (red > blue + 32)
        & (red > 105)
    )
    seed_count, seed_labels, seed_stats, _ = cv2.connectedComponentsWithStats(
        ribbon_seed.astype(np.uint8),
        8,
    )
    ribbon_seed.fill(False)
    for label in range(1, seed_count):
        if int(seed_stats[label, cv2.CC_STAT_AREA]) >= 6:
            ribbon_seed |= seed_labels == label

    support_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    ribbon_support = cv2.dilate(ribbon_seed.astype(np.uint8), support_kernel) > 0
    solid_alpha = ribbon_support & (alpha >= 96)
    edge_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    rebuilt_solid = cv2.morphologyEx(
        solid_alpha.astype(np.uint8),
        cv2.MORPH_CLOSE,
        edge_kernel,
    )
    rebuilt_solid = cv2.morphologyEx(rebuilt_solid, cv2.MORPH_OPEN, edge_kernel) > 0
    rebuilt_alpha = cv2.GaussianBlur(
        rebuilt_solid.astype(np.float32) * 255.0,
        (0, 0),
        sigmaX=0.48,
        sigmaY=0.48,
    )
    inner_distance = distance_transform_edt(solid_alpha)
    outer_distance = distance_transform_edt(~solid_alpha)
    contour_band = (
        (solid_alpha & (inner_distance <= 2.2))
        | (~solid_alpha & (outer_distance <= 2.2))
    )
    alpha_edit = (
        target_roi
        & ribbon_support
        & (contour_band | (solid_alpha != rebuilt_solid))
    )
    old_alpha = alpha.copy()
    alpha[alpha_edit] = np.clip(rebuilt_alpha[alpha_edit], 0, 255).astype(np.uint8)

    new_edge = alpha_edit & (old_alpha < 12) & (alpha >= 12)
    safe_red = (
        (alpha >= 220)
        & (red > green + 40)
        & (red > blue + 32)
        & (red > 105)
    )
    if np.any(new_edge) and np.any(safe_red):
        _, nearest = distance_transform_edt(~safe_red, return_indices=True)
        repaired[new_edge, :3] = repaired[
            nearest[0][new_edge],
            nearest[1][new_edge],
            :3,
        ]

    return repaired, {
        "floating_components_removed": removed_components,
        "floating_pixels_removed": int(np.count_nonzero(remove)),
        "edge_rgb_pixels_repaired": int(np.count_nonzero(decontaminated)),
        "ribbon_alpha_pixels_repaired": int(np.count_nonzero(alpha_edit)),
        "ribbon_alpha_pixels_added": int(np.count_nonzero(alpha > old_alpha)),
        "ribbon_alpha_pixels_removed": int(np.count_nonzero(alpha < old_alpha)),
    }


def repair_kisara_runtime_hair_and_ribbon(
    rgba: np.ndarray,
    source_bgr: np.ndarray,
    source_rgba: np.ndarray,
    target_bbox: tuple[int, int, int, int],
) -> tuple[np.ndarray, dict[str, int]]:
    repaired = rgba.copy()
    original_alpha = repaired[..., 3].copy()
    hair_mask = np.zeros(original_alpha.shape, dtype=np.uint8)
    ribbon_mask = np.zeros(original_alpha.shape, dtype=np.uint8)
    for left, top, right, bottom in (
        (991, 470, 1004, 486),
        (1009, 473, 1021, 488),
        (1004, 485, 1014, 501),
        (1027, 498, 1037, 511),
        (1036, 503, 1045, 516),
    ):
        hair_mask[top:bottom, left:right] = 255
    for left, top, right, bottom in (
        (931, 498, 942, 510),
        (944, 510, 955, 521),
        (954, 517, 967, 533),
    ):
        ribbon_mask[top:bottom, left:right] = 255

    source_alpha = source_rgba[..., 3]
    source_y, source_x = np.where(source_alpha > 0)
    source_left = int(source_x.min())
    source_top = int(source_y.min())
    source_right = int(source_x.max()) + 1
    source_bottom = int(source_y.max()) + 1
    source_crop = np.s_[source_top:source_bottom, source_left:source_right]
    left, top, right, bottom = target_bbox
    available_width = right - left
    available_height = bottom - top
    scale = min(
        available_width / (source_right - source_left),
        available_height / (source_bottom - source_top),
    )
    target_width = max(1, int(round((source_right - source_left) * scale)))
    target_height = max(1, int(round((source_bottom - source_top) * scale)))
    target_left = left + (available_width - target_width) // 2
    target_top = top + (available_height - target_height) // 2

    source_rgb = cv2.cvtColor(source_bgr, cv2.COLOR_BGR2RGB)
    red = source_rgb[..., 0].astype(np.int16)
    green = source_rgb[..., 1].astype(np.int16)
    blue = source_rgb[..., 2].astype(np.int16)
    clean_green = (
        (green > red + 55)
        & (green > blue + 45)
        & (green > 145)
        & (red < 95)
    )
    _, nearest_background = distance_transform_edt(~clean_green, return_indices=True)
    background = source_rgb[
        nearest_background[0],
        nearest_background[1],
    ].astype(np.float32)
    color_distance = np.linalg.norm(source_rgb.astype(np.float32) - background, axis=2)
    chroma_alpha = smoothstep(10.0, 72.0, color_distance) * 255.0

    runtime_source = np.zeros(repaired.shape[:2] + (3,), dtype=np.uint8)
    runtime_chroma = np.zeros(repaired.shape[:2], dtype=np.float32)
    runtime_solo_rgb = np.zeros(repaired.shape[:2] + (3,), dtype=np.uint8)
    runtime_solo_alpha = np.zeros(repaired.shape[:2], dtype=np.float32)
    placement = np.s_[
        target_top : target_top + target_height,
        target_left : target_left + target_width,
    ]
    runtime_source[placement] = cv2.resize(
        source_rgb[source_crop],
        (target_width, target_height),
        interpolation=cv2.INTER_LANCZOS4,
    )
    runtime_chroma[placement] = cv2.resize(
        chroma_alpha[source_crop].astype(np.float32),
        (target_width, target_height),
        interpolation=cv2.INTER_LANCZOS4,
    )
    solo_crop = source_rgba[source_crop]
    solo_alpha = solo_crop[..., 3:4].astype(np.float32) / 255.0
    solo_premultiplied = solo_crop[..., :3].astype(np.float32) * solo_alpha
    resized_solo_alpha = cv2.resize(
        solo_alpha,
        (target_width, target_height),
        interpolation=cv2.INTER_LANCZOS4,
    )
    resized_solo_premultiplied = cv2.resize(
        solo_premultiplied,
        (target_width, target_height),
        interpolation=cv2.INTER_LANCZOS4,
    )
    if resized_solo_alpha.ndim == 2:
        resized_solo_alpha = resized_solo_alpha[..., None]
    resized_solo_rgb = np.divide(
        resized_solo_premultiplied,
        np.maximum(resized_solo_alpha, 1e-6),
        out=np.zeros_like(resized_solo_premultiplied),
        where=resized_solo_alpha > 1e-6,
    )
    runtime_solo_rgb[placement] = np.clip(resized_solo_rgb, 0, 255).astype(np.uint8)
    runtime_solo_alpha[placement] = np.clip(resized_solo_alpha[..., 0] * 255.0, 0, 255)
    runtime_chroma = np.clip(runtime_chroma, 0, 255)

    runtime_red = runtime_source[..., 0].astype(np.int16)
    runtime_green = runtime_source[..., 1].astype(np.int16)
    runtime_blue = runtime_source[..., 2].astype(np.int16)
    red_ribbon = (
        (runtime_red > runtime_green + 34)
        & (runtime_red > runtime_blue + 16)
        & (runtime_red > 105)
    )
    hair_family = (
        (runtime_red > 30)
        & (runtime_green > 45)
        & (runtime_blue > 62)
        & (runtime_blue * 2 > runtime_red)
        & ~red_ribbon
    )

    def feather_marked(mask: np.ndarray) -> np.ndarray:
        softened = cv2.GaussianBlur(
            mask.astype(np.float32) / 255.0,
            (0, 0),
            sigmaX=0.58,
            sigmaY=0.58,
        )
        return np.clip(softened, 0.0, 1.0) * (mask > 0)

    current_alpha = repaired[..., 3].astype(np.float32)
    desired_hair = np.where(hair_family, runtime_chroma, 0.0)
    hair_weight = feather_marked(hair_mask)
    hair_target = np.maximum(current_alpha, desired_hair)
    repaired[..., 3] = np.clip(
        current_alpha * (1.0 - hair_weight) + hair_target * hair_weight,
        0,
        255,
    ).astype(np.uint8)
    hair_added = repaired[..., 3] > original_alpha

    hair_neighborhood = cv2.dilate(
        hair_mask,
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25)),
    ) > 0
    strong_hair = hair_family & (runtime_solo_alpha >= 160) & hair_neighborhood
    if np.any(strong_hair) and np.any(hair_added):
        _, nearest_hair = distance_transform_edt(~strong_hair, return_indices=True)
        repaired[hair_added, :3] = runtime_solo_rgb[
            nearest_hair[0][hair_added],
            nearest_hair[1][hair_added],
        ]

    red_support = cv2.dilate(
        (red_ribbon & (runtime_chroma >= 72)).astype(np.uint8),
        cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)),
    ) > 0
    desired_ribbon = np.where(red_support, runtime_chroma, 0.0)
    current_alpha = repaired[..., 3].astype(np.float32)
    inside_distance = distance_transform_edt(current_alpha >= 16)
    ribbon_contour = (inside_distance <= 3.4) | (current_alpha < 230)
    ribbon_weight = feather_marked((ribbon_mask > 0) & ribbon_contour)
    ribbon_target = np.minimum(current_alpha, desired_ribbon)
    repaired[..., 3] = np.clip(
        current_alpha * (1.0 - ribbon_weight) + ribbon_target * ribbon_weight,
        0,
        255,
    ).astype(np.uint8)
    ribbon_removed = repaired[..., 3] < original_alpha
    repaired[ribbon_removed & (repaired[..., 3] == 0), :3] = 0

    changed = np.any(repaired != rgba, axis=2)
    allowed = (hair_mask > 0) | (ribbon_mask > 0)
    return repaired, {
        "hair_alpha_pixels_added": int(np.count_nonzero(hair_added)),
        "ribbon_alpha_pixels_removed": int(np.count_nonzero(ribbon_removed)),
        "source_guided_pixels_changed": int(np.count_nonzero(changed)),
        "source_guided_pixels_outside_rois": int(np.count_nonzero(changed & ~allowed)),
    }


def save_webp(path: Path, rgba: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, mode="RGBA").save(path, "WEBP", quality=94, method=6, exact=True)


def save_qa(path: Path, rgba: np.ndarray) -> None:
    colors = ((0, 0, 0), (255, 255, 255), (0, 220, 220), (220, 28, 58))
    panel_width, panel_height = 720, 488
    alpha_image = Image.fromarray(rgba, mode="RGBA")
    alpha_image.thumbnail((panel_width, panel_height), Image.Resampling.LANCZOS)
    sheet = Image.new("RGB", (panel_width * 2, panel_height * 2))
    for index, color in enumerate(colors):
        panel = Image.new("RGBA", (panel_width, panel_height), (*color, 255))
        panel.alpha_composite(alpha_image, ((panel_width - alpha_image.width) // 2, (panel_height - alpha_image.height) // 2))
        sheet.paste(panel.convert("RGB"), ((index % 2) * panel_width, (index // 2) * panel_height))
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path, "WEBP", quality=90, method=6)


def quality_metrics(rgba: np.ndarray, key_rgb: np.ndarray) -> dict[str, object]:
    alpha = rgba[..., 3].astype(np.float64) / 255.0
    border_nonzero = int(
        np.count_nonzero(alpha[0, :])
        + np.count_nonzero(alpha[-1, :])
        + np.count_nonzero(alpha[:, 0])
        + np.count_nonzero(alpha[:, -1])
    )
    interior_distance = distance_transform_edt(alpha > 0.01)
    core = interior_distance >= 3.0
    core_opaque = float(np.mean(alpha[core] >= 254.0 / 255.0)) if np.any(core) else 0.0
    partial = (alpha > 0.0) & (alpha < 254.0 / 255.0)
    near_edge = interior_distance <= 7.0
    partial_near_edge = float(np.mean(near_edge[partial])) if np.any(partial) else 1.0
    rgb = rgba[..., :3].astype(np.float64)
    color_distance = np.linalg.norm(rgb - key_rgb[None, None, :], axis=2)
    edge = (alpha > 0.01) & (interior_distance <= 6.0)
    key_residual = float(np.mean(color_distance[edge] < 90.0)) if np.any(edge) else 0.0
    return {
        "border_nonzero": border_nonzero,
        "core_opaque_ratio": round(core_opaque, 6),
        "partial_pixels": int(np.count_nonzero(partial)),
        "partial_near_edge_ratio": round(partial_near_edge, 6),
        "edge_key_residual_ratio": round(key_residual, 6),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract four complete transparent Kisara Blog characters.")
    parser.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--rough", type=Path, default=DEFAULT_ROUGH)
    parser.add_argument("--final", type=Path, default=DEFAULT_FINAL)
    parser.add_argument("--public", type=Path, default=DEFAULT_PUBLIC)
    args = parser.parse_args()

    input_dir = args.input.resolve()
    rough_dir = args.rough.resolve()
    final_dir = args.final.resolve()
    public_dir = args.public.resolve()
    final_dir.mkdir(parents=True, exist_ok=True)
    session = new_session("isnet-anime")
    summary: dict[str, dict[str, object]] = {}

    for config in CHARACTERS:
        character_id = str(config["id"])
        layer_name = str(config["layer"])
        source_path = input_dir / str(config["source"])
        rough_path = rough_dir / str(config["rough"])
        original_source_bgr = read_cv(source_path, cv2.IMREAD_COLOR)
        source_bgr = original_source_bgr.copy()
        source_bgr, pre_repair_stats = pre_repair_source(character_id, source_bgr)
        key_rgb = parse_hex(str(config["key"]))

        rgba, model_alpha, matte_stats = matte_character(source_bgr, key_rgb, session, config)
        rough = fit_rough_layer(read_cv(rough_path))
        alignment, alignment_stats = estimate_alignment(
            source_bgr,
            np.clip(model_alpha * 255.0, 0, 255).astype(np.uint8),
            rough,
            key_rgb,
        )
        rgba, repair_stats = repair_rgba(character_id, rgba, alignment)
        rgba, artifact_repair_stats = repair_internal_artifacts(
            character_id,
            rgba,
            rough,
            alignment,
        )
        rgba, reported_repair_stats = refine_reported_artifacts(
            character_id,
            rgba,
            original_source_bgr,
        )
        edge_repair_stats: dict[str, int] = {}
        shoulder_repair_stats: dict[str, int] = {}
        if character_id == "kisara":
            rgba, edge_repair_stats = repair_kisara_edges(rgba)
            rgba, shoulder_repair_stats = repair_kisara_shoulder_pollution(
                rgba,
                original_source_bgr,
            )
        stage_bbox = tuple(int(value) for value in config["stage_bbox"])
        runtime = place_runtime(rgba, stage_bbox)
        runtime_edge_repair_stats: dict[str, int] = {}
        runtime_source_repair_stats: dict[str, int] = {}
        if character_id == "kisara":
            runtime, runtime_edge_repair_stats = repair_kisara_runtime_ribbon_edges(runtime)
            runtime, runtime_source_repair_stats = repair_kisara_runtime_hair_and_ribbon(
                runtime,
                original_source_bgr,
                rgba,
                stage_bbox,
            )

        solo_path = final_dir / f"{character_id}-solo.png"
        aligned_path = final_dir / f"{layer_name}-solo-v1.png"
        qa_path = final_dir / f"{character_id}-solo-qa.webp"
        public_path = public_dir / f"{layer_name}-solo-v1.webp"
        write_cv(solo_path, cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGRA))
        write_cv(aligned_path, cv2.cvtColor(runtime, cv2.COLOR_RGBA2BGRA))
        save_qa(qa_path, runtime)
        save_webp(public_path, runtime)

        summary[character_id] = {
            "source": str(source_path),
            "solo": str(solo_path),
            "aligned": str(aligned_path),
            "qa": str(qa_path),
            "public": str(public_path),
            "pre_repairs": pre_repair_stats,
            "matting": matte_stats,
            "repairs": repair_stats,
            "artifact_repairs": artifact_repair_stats,
            "reported_repairs": reported_repair_stats,
            "edge_repairs": edge_repair_stats,
            "shoulder_repairs": shoulder_repair_stats,
            "runtime_edge_repairs": runtime_edge_repair_stats,
            "runtime_source_repairs": runtime_source_repair_stats,
            "alignment": alignment_stats,
            "stage_bbox": list(stage_bbox),
            "quality": quality_metrics(rgba, key_rgb),
        }

    summary_path = final_dir / "summary.json"
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Extracted {len(CHARACTERS)} complete transparent characters.")
    print(summary_path)


if __name__ == "__main__":
    main()
