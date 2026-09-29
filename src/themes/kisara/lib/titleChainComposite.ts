type GlyphMask = {
  canvas: HTMLCanvasElement;
  left: number; top: number; width: number; height: number;
};

export function createTitleChainComposite(signal: AbortSignal) {
  let outside: HTMLCanvasElement | null = null;
  signal.addEventListener("abort", () => {
    if (outside) outside.width = outside.height = 0;
    outside = null;
  }, { once: true });

  return (
    front: CanvasRenderingContext2D, back: CanvasRenderingContext2D,
    glyph: GlyphMask, pixelRatio: number, sourceOpacity: number
  ) => {
    if (signal.aborted || !glyph.canvas.width || !glyph.canvas.height
      || !(glyph.width > 0) || !(glyph.height > 0) || !(pixelRatio > 0)) return false;
    outside ??= document.createElement("canvas");
    if (outside.width !== back.canvas.width || outside.height !== back.canvas.height) {
      outside.width = back.canvas.width;
      outside.height = back.canvas.height;
    }
    const context = outside.getContext("2d", { alpha: true });
    if (!context) return false;
    const opacity = Math.max(0, Math.min(1, sourceOpacity));

    // Use the title's own ink mask; its canvas has a different scale from the chain canvas.
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, outside.width, outside.height);
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.drawImage(back.canvas, 0, 0);
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.globalAlpha = opacity;
    context.globalCompositeOperation = "destination-out";
    context.drawImage(glyph.canvas, glyph.left, glyph.top, glyph.width, glyph.height);
    context.restore();

    // The ink-covered wire stays on the DOM layer below the real title.
    back.save();
    back.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    back.globalAlpha = opacity;
    back.globalCompositeOperation = "destination-in";
    back.drawImage(glyph.canvas, glyph.left, glyph.top, glyph.width, glyph.height);
    back.restore();

    // Outside the ink, both depth fragments share one surface before CSS resampling.
    front.save();
    front.setTransform(1, 0, 0, 1, 0, 0);
    front.globalAlpha = 1;
    front.globalCompositeOperation = "destination-over";
    front.drawImage(outside, 0, 0);
    front.restore();
    return true;
  };
}
