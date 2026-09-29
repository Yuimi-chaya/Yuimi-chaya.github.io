type GlyphLayout = { font: string; textLeft: number; baseline: number; widthScale: number };

export function createTitleChainComposite(signal: AbortSignal) {
  let mask: HTMLCanvasElement | null = null;
  let maskLayout: GlyphLayout | null = null;
  let maskRatio = 0;
  signal.addEventListener("abort", () => {
    if (mask) mask.width = mask.height = 0;
    mask = null;
    maskLayout = null;
  }, { once: true });

  return (
    front: CanvasRenderingContext2D, back: CanvasRenderingContext2D,
    layout: GlyphLayout, pixelRatio: number, sourceOpacity: number
  ) => {
    if (signal.aborted || !layout.font || !(layout.widthScale > 0)) return false;
    mask ??= document.createElement("canvas");
    const context = mask.getContext("2d", { alpha: true });
    if (!context) return false;
    if (maskLayout !== layout || maskRatio !== pixelRatio
      || mask.width !== back.canvas.width || mask.height !== back.canvas.height) {
      mask.width = back.canvas.width;
      mask.height = back.canvas.height;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.translate(layout.textLeft, layout.baseline);
      context.scale(layout.widthScale, layout.widthScale);
      context.font = layout.font;
      context.textBaseline = "alphabetic";
      context.fillStyle = "#fff";
      context.fillText("Kisara", 0, 0);
      maskLayout = layout;
      maskRatio = pixelRatio;
    }

    // Remove ink-covered back wires while retaining the measured glyph holes.
    back.save();
    back.setTransform(1, 0, 0, 1, 0, 0);
    back.globalAlpha = Math.max(0, Math.min(1, sourceOpacity));
    back.globalCompositeOperation = "destination-out";
    back.drawImage(mask, 0, 0);
    back.restore();

    // Resample complementary fragments together, not on two independent CSS layers.
    front.save();
    front.setTransform(1, 0, 0, 1, 0, 0);
    front.globalAlpha = 1;
    front.globalCompositeOperation = "destination-over";
    front.drawImage(back.canvas, 0, 0);
    front.restore();
    return true;
  };
}
