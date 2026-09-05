export const chainAtlas = {
  url: "/themes/kisara/assets/title-chain-steel.webp",
  steps: 17,
  cellWidth: 144,
  cellHeight: 96,
  width: 48,
  height: 32,
  linkWidth: 36,
  linkHeight: 20,
  wire: 3.6,
  connectorProjection: 0.32
} as const;

export type ChainArc = "near" | "far" | "full";

export function chainMaterialCell(heat: number, edgeOn: boolean, arc: Exclude<ChainArc, "full">) {
  const step = Math.round(Math.max(0, Math.min(1, Number.isFinite(heat) ? heat : 0)) * (chainAtlas.steps - 1));
  return {
    x: step * chainAtlas.cellWidth,
    y: ((edgeOn ? 2 : 0) + (arc === "near" ? 1 : 0)) * chainAtlas.cellHeight,
    width: chainAtlas.cellWidth,
    height: chainAtlas.cellHeight
  };
}

export function chainLinkPitch(width: number, compact: boolean) {
  return width * (compact ? 1.04 : 0.92);
}

export function createTitleChainMaterial(signal: AbortSignal) {
  const image = new Image();
  image.decoding = "async";
  let ready = false;
  let failed = false;
  let requested = false;
  let fadeStarted = -1;
  let timeout = 0;
  const onLoad = () => {
    window.clearTimeout(timeout);
    ready = !signal.aborted && image.naturalWidth > 0;
  };
  const onError = () => {
    window.clearTimeout(timeout);
    failed = true;
  };
  image.addEventListener("load", onLoad, { signal });
  image.addEventListener("error", onError, { signal });
  signal.addEventListener("abort", () => {
    window.clearTimeout(timeout);
    ready = false;
    image.removeAttribute("src");
  }, { once: true });

  const prepare = () => {
    if (requested || signal.aborted) return;
    requested = true;
    timeout = window.setTimeout(onError, 1800);
    image.src = chainAtlas.url;
  };

  // The fallback and atlas share the same solid wire, including edge-on links.
  const drawFallback = (context: CanvasRenderingContext2D, edgeOn: boolean, arc: Exclude<ChainArc, "full">, heat: number) => {
    const radius = (chainAtlas.linkHeight - chainAtlas.wire) * 0.5;
    const straight = (chainAtlas.linkWidth - chainAtlas.linkHeight) * 0.5;
    const projection = edgeOn ? chainAtlas.connectorProjection : 1;
    const lower = (arc === "near") !== edgeOn;
    context.beginPath();
    context.ellipse(straight, 0, radius, radius * projection, 0, 0, lower ? Math.PI * 0.5 : -Math.PI * 0.5, !lower);
    context.lineTo(-straight, (lower ? 1 : -1) * radius * projection);
    context.ellipse(-straight, 0, radius, radius * projection, 0, lower ? Math.PI * 0.5 : -Math.PI * 0.5, lower ? Math.PI : -Math.PI, !lower);
    context.lineWidth = chainAtlas.wire;
    context.lineCap = "butt";
    context.strokeStyle = `rgb(${83 + Math.round(heat * 12)},${89 - Math.round(heat * 47)},${97 - Math.round(heat * 45)})`;
    context.stroke();
  };

  const draw = (
    context: CanvasRenderingContext2D,
    width: number,
    edgeOn: boolean,
    arc: ChainArc,
    heat: number
  ) => {
    if (signal.aborted) return;
    const part = (value: Exclude<ChainArc, "full">) => {
      if (!ready || failed) {
        drawFallback(context, edgeOn, value, heat);
        return;
      }
      const cell = chainMaterialCell(heat, edgeOn, value);
      context.drawImage(image, cell.x, cell.y, cell.width, cell.height,
        -chainAtlas.width * 0.5, -chainAtlas.height * 0.5, chainAtlas.width, chainAtlas.height);
    };
    context.save();
    const scale = width / chainAtlas.linkWidth;
    context.scale(scale, scale);
    if (arc === "full") {
      part("far");
      part("near");
    } else part(arc);
    context.restore();
  };

  const visibility = (timestamp: number) => {
    if (signal.aborted) return 0;
    if (!ready && !failed) return 0;
    if (fadeStarted < 0) fadeStarted = timestamp;
    return Math.min(1, Math.max(0, (timestamp - fadeStarted) / 120));
  };
  return { prepare, draw, visibility };
}
