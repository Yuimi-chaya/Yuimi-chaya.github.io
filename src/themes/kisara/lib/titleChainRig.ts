import type { GlyphBox, GlyphCounter } from "./titleChainCounter.ts";

export const titleChainDefinitions = [
  {
    id: 0, type: "weave", route: "left-upper",
    buildStart: 0.025, buildEnd: 0.78, direction: 1,
    planePhase: 0, xInset: 0.13,
    breakT: 0.55, desktopLinksPerSegment: 3, mobileLinksPerSegment: 2,
    linkScale: 0.9, entryOverscan: 0.42, entryBend: -0.035
  },
  {
    id: 1, type: "weave", route: "left-lower",
    buildStart: 0.1, buildEnd: 0.86, direction: 1,
    planePhase: 1, xInset: 0.075,
    breakT: 0.5, desktopLinksPerSegment: 3, mobileLinksPerSegment: 2,
    linkScale: 0.88, entryOverscan: 0.4, entryBend: 0.025
  },
  {
    id: 2, type: "weave", route: "right-clasp",
    buildStart: 0.24, buildEnd: 0.96, direction: -1,
    planePhase: 0, xInset: 0.075,
    breakT: 0.5, desktopLinksPerSegment: 3, mobileLinksPerSegment: 2,
    linkScale: 0.88, entryOverscan: 0.4, entryBend: 0.025
  }
] as const;

type Bounds = { top: number; bottom: number };
type Box = { left: number; top: number; width: number; height: number };
type Layout = {
  textLeft: number; textRight: number; top?: number; bottom?: number;
  gaps: number[]; anchorBounds: Bounds[];
  glyphBounds?: GlyphBox[]; counter?: GlyphCounter | null;
};
type Point = { x: number; y: number };
type Curve = [Point, Point, Point, Point];
type Knot = [number, number, number, number];
type DepthCut = Point & { unit: number; nx: number; ny: number; frontBefore: boolean; frontAfter: boolean };
type ChainPath = {
  type: "weave"; points: Point[]; segmentCount: number; curves: Curve[];
  route: "left-upper" | "left-lower" | "right-clasp";
  glyphBackZones: { from: number; to: number; left: number; right: number }[];
  depthCuts: DepthCut[];
  counter?: GlyphCounter; counterUnit?: number;
};

// Curves and crossing ownership are rebuilt only with the measured title layout.
export function buildTitleChainRig(box: Box, layout: Layout, linkWidths: number[]) {
  const textLeft = layout.textRight > layout.textLeft ? layout.textLeft : box.left;
  const textRight = layout.textRight > layout.textLeft ? layout.textRight : box.left + box.width;
  const width = textRight - textLeft;
  const gaps = layout.gaps.length === 5
    ? layout.gaps
    : [0.19, 0.31, 0.47, 0.64, 0.81].map(unit => textLeft + width * unit);
  const measuredHeight = (layout.bottom ?? 0) > (layout.top ?? 0);
  const fallback = {
    top: measuredHeight ? layout.top! : box.top,
    bottom: measuredHeight ? layout.bottom! : box.top + box.height
  };
  const top = fallback.top, height = fallback.bottom - top;
  const glyphAt = (index: number): GlyphBox => layout.glyphBounds?.[index] ?? {
    left: index === 0 ? textLeft : gaps[index - 1],
    right: index === 5 ? textRight : gaps[index],
    ...(layout.anchorBounds[index] ?? { top: top + height * .28, bottom: fallback.bottom })
  };
  const glyph = glyphAt(3), sGlyph = glyphAt(2), rGlyph = glyphAt(4), lastGlyph = glyphAt(5);
  const kGlyph = glyphAt(0), iGlyph = glyphAt(1);
  const glyphWidth = glyph.right - glyph.left;
  const glyphHeight = glyph.bottom - glyph.top;
  const counter = layout.counter ?? {
    x: glyph.left + glyphWidth * 0.39, y: glyph.top + glyphHeight * 0.7,
    radiusX: glyphWidth * 0.13, radiusY: glyphHeight * 0.15
  };
  const counterX = (counter.x - textLeft) / width;
  const counterY = (counter.y - top) / height;
  const letterX = (letter: GlyphBox, ratio: number) => (letter.left - textLeft + (letter.right - letter.left) * ratio) / width;
  const letterY = (letter: GlyphBox, ratio: number) => (letter.top - top + (letter.bottom - letter.top) * ratio) / height;
  const letterSlope = (letter: GlyphBox, ratio: number) => (letter.bottom - letter.top) * ratio / height;
  const leftReturnPull = .1;
  const rightShoulder = .13;
  // The clasp reads as a tight overlap, not two strands surrounding an empty pocket.
  const claspScale = Math.min(1, Math.max(...linkWidths) * 1.9 / Math.max(1, glyphHeight));
  const claspY = (ratio: number) => Math.max(.04, .44 + (ratio - .44) * claspScale);
  const claspSlope = (ratio: number) => letterSlope(glyph, ratio * claspScale);
  const paths: ChainPath[] = titleChainDefinitions.map(definition => {
    // Each knot includes its own tangent: unequal sweeps, not a repeating wave.
    const knots: Knot[] = definition.route === "left-upper"
      ? [[-definition.xInset, .1, .1, .26], [.205, .83, .09, .01],
        [letterX(sGlyph, .68), letterY(sGlyph, .12), .068, -letterSlope(sGlyph, .04)],
        [letterX(glyph, .28 - leftReturnPull), letterY(glyph, claspY(.23)), .018, claspSlope(.09)],
        [letterX(glyph, .34 - leftReturnPull), letterY(glyph, claspY(.58)), 0, claspSlope(.12)],
        [letterX(sGlyph, .7), letterY(sGlyph, .9), -.045, letterSlope(sGlyph, .025)]]
      : definition.route === "left-lower"
        ? [[-definition.xInset, .88, .13, -.1], [.265, .22, .078, .015],
          [.4, .79, .045, .025], [letterX(sGlyph, .9), letterY(sGlyph, .57), .025, -letterSlope(sGlyph, .1)]]
        : [[letterX(lastGlyph, .42), letterY(lastGlyph, .33), -.08, letterSlope(lastGlyph, .12)],
          [letterX(rGlyph, .44), letterY(rGlyph, .5), -.07, -letterSlope(rGlyph, .15)],
          [letterX(glyph, .31), letterY(glyph, claspY(.08)), -glyphWidth / width * .1, -claspSlope(.018)],
          [letterX(glyph, rightShoulder), letterY(glyph, claspY(.46)), 0, claspSlope(.16)],
          [counterX, counterY, Math.max(.009, Math.min(.024, (counterX - letterX(glyph, rightShoulder)) * .45)), letterSlope(glyph, .015)],
          [1 + box.width * definition.xInset / width, .93, .13, .13]];
    const points = knots.map(([x, y]) => ({ x: textLeft + width * x, y: top + height * y }));
    const curves: Curve[] = knots.slice(0, -1).map((knot, index) => {
      const end = knots[index + 1];
      return [
        points[index],
        { x: points[index].x + knot[2] * width, y: points[index].y + knot[3] * height },
        { x: points[index + 1].x - end[2] * width, y: points[index + 1].y - end[3] * height },
        points[index + 1]
      ];
    });
    const glyphBackZones = definition.route === "left-upper"
      ? [{ from: 0, to: .4, left: kGlyph.left, right: kGlyph.right }]
      : definition.route === "left-lower"
        ? [{ from: 0, to: 1, left: iGlyph.left, right: sGlyph.right }]
        : [{ from: 0, to: .4, left: glyph.right, right: Infinity }];
    return {
      type: "weave", curves, points, segmentCount: curves.length,
      route: definition.route, glyphBackZones, depthCuts: [],
      ...(definition.route === "right-clasp" ? {
        counter, counterUnit: 4 / 5
      } : {})
    };
  });
  const samples = paths.map(path => Array.from({ length: 129 }, (_, index) => sampleTitleChainCurve(path, index / 128)));
  const crossingRadius = Math.max(...linkWidths) * 2.4;
  const crossings: { x: number; y: number; ids: number[]; units: number[]; overId: number; overIndex: number; radius: number }[] = [];
  for (let first = 0; first < paths.length; first++) {
    for (let second = first; second < paths.length; second++) {
      const pair: typeof crossings = [];
      for (let i = 0; i < 128; i++) {
        const a = samples[first][i], b = samples[first][i + 1];
        const rx = b.x - a.x, ry = b.y - a.y;
        for (let j = first === second ? i + 2 : 0; j < 128; j++) {
          const c = samples[second][j], d = samples[second][j + 1];
          const sx = d.x - c.x, sy = d.y - c.y;
          const denominator = rx * sy - ry * sx;
          if (Math.abs(denominator) < 0.00001) continue;
          const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denominator;
          const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / denominator;
          if (t < 0 || t > 1 || u < 0 || u > 1) continue;
          const x = a.x + rx * t, y = a.y + ry * t;
          if (pair.some(point => Math.hypot(point.x - x, point.y - y) < 2)) continue;
          pair.push({ x, y, ids: [first, second], units: [(i + t) / 128, (j + u) / 128], overId: 0, overIndex: 0, radius: crossingRadius });
        }
      }
      pair.sort((a, b) => a.x - b.x);
      pair.forEach((crossing, index) => {
        crossing.overIndex = index % 2 === 0 ? 1 : 0;
        const front = crossing.ids.map((id, arm) => sampleTitleChainCurve(paths[id], crossing.units[arm]).plane === "front");
        if (front[0] !== front[1]) crossing.overIndex = front[0] ? 0 : 1;
        crossing.overId = crossing.ids[crossing.overIndex];
      });
      crossings.push(...pair);
    }
  }
  // Separate repaint windows so one crossing cannot overwrite its neighbor's ordering.
  for (const crossing of crossings) {
    for (const other of crossings) {
      if (other === crossing) continue;
      crossing.radius = Math.min(crossing.radius,
        Math.max(Math.abs(crossing.x - other.x), Math.abs(crossing.y - other.y)) * .45);
    }
  }
  for (const path of paths) {
    let previousUnit = 0;
    let previousFront = sampleTitleChainCurve(path, 0).plane === "front";
    for (let index = 1; index <= 512; index++) {
      const unit = index / 512;
      const front = sampleTitleChainCurve(path, unit).plane === "front";
      if (front !== previousFront) {
        let low = previousUnit, high = unit;
        for (let iteration = 0; iteration < 12; iteration++) {
          const middle = (low + high) * .5;
          if ((sampleTitleChainCurve(path, middle).plane === "front") === previousFront) low = middle;
          else high = middle;
        }
        const boundary = (low + high) * .5;
        const sample = sampleTitleChainCurve(path, boundary);
        const length = Math.max(.001, Math.hypot(sample.tangentX, sample.tangentY));
        const atGlyphEdge = path.glyphBackZones.some(zone =>
          Math.abs(sample.x - zone.left) < .05 || Math.abs(sample.x - zone.right) < .05);
        path.depthCuts.push({
          unit: boundary, x: sample.x, y: sample.y,
          nx: atGlyphEdge ? Math.sign(sample.tangentX) : sample.tangentX / length,
          ny: atGlyphEdge ? 0 : sample.tangentY / length,
          frontBefore: previousFront, frontAfter: front
        });
      }
      previousUnit = unit;
      previousFront = front;
    }
  }
  return { paths, counter, crossings };
}

export function sampleTitleChainCurve(path: Pick<ChainPath, "curves" | "glyphBackZones">, unit: number) {
  const position = Math.max(0, Math.min(1, unit)) * path.curves.length;
  const index = Math.min(path.curves.length - 1, Math.floor(position));
  const u = position - index, v = 1 - u;
  const [a, b, c, d] = path.curves[index];
  const x = v ** 3 * a.x + 3 * v * v * u * b.x + 3 * v * u * u * c.x + u ** 3 * d.x;
  const y = v ** 3 * a.y + 3 * v * v * u * b.y + 3 * v * u * u * c.y + u ** 3 * d.y;
  const tangentX = 3 * v * v * (b.x - a.x) + 6 * v * u * (c.x - b.x) + 3 * u * u * (d.x - c.x);
  const tangentY = 3 * v * v * (b.y - a.y) + 6 * v * u * (c.y - b.y) + 3 * u * u * (d.y - c.y);
  const back = path.glyphBackZones.some(zone => unit >= zone.from && unit <= zone.to && x >= zone.left && x <= zone.right);
  return { x, y, tangentX, tangentY, plane: back ? "back" : "front", depth: back ? -1 : 1 };
}

type OrientedPoint = Point & { angle: number; tangentX?: number; tangentY?: number; normalX?: number; normalY?: number };

function clipDepthHalfPlane(polygon: Point[], cut: DepthCut, after: boolean) {
  const result: Point[] = [];
  if (!polygon.length) return result;
  const side = after ? 1 : -1;
  const distance = (point: Point) => ((point.x - cut.x) * cut.nx + (point.y - cut.y) * cut.ny) * side;
  let previous = polygon[polygon.length - 1], previousDistance = distance(previous);
  for (const point of polygon) {
    const currentDistance = distance(point);
    if ((currentDistance >= 0) !== (previousDistance >= 0)) {
      const mix = previousDistance / (previousDistance - currentDistance);
      result.push({ x: previous.x + (point.x - previous.x) * mix, y: previous.y + (point.y - previous.y) * mix });
    }
    if (currentDistance >= 0) result.push(point);
    previous = point;
    previousDistance = currentDistance;
  }
  return result;
}

export function partitionTitleChainRing(
  path: ChainPath, sample: OrientedPoint & { plane: string },
  width: number, lengthScale: number, fromUnit: number, toUnit: number, pixelRatio = 0
) {
  const cuts = path.depthCuts.filter(cut => cut.unit >= fromUnit && cut.unit <= toUnit).map(cut => {
    // Complementary antialiased clips leave an alpha crack unless glyph edges share a device-pixel boundary.
    if (pixelRatio > 0 && Math.abs(cut.ny) < 1e-8) return { ...cut, x: Math.round(cut.x * pixelRatio) / pixelRatio };
    if (pixelRatio > 0 && Math.abs(cut.nx) < 1e-8) return { ...cut, y: Math.round(cut.y * pixelRatio) / pixelRatio };
    return cut;
  });
  if (!cuts.length) return [{ plane: sample.plane, clip: null as Point[] | null }];
  const cosine = Math.cos(sample.angle), sine = Math.sin(sample.angle);
  const halfWidth = width * lengthScale * .7, halfHeight = width * .5;
  let remaining = [[-halfWidth, -halfHeight], [halfWidth, -halfHeight], [halfWidth, halfHeight], [-halfWidth, halfHeight]]
    .map(([x, y]) => ({ x: sample.x + x * cosine - y * sine, y: sample.y + x * sine + y * cosine }));
  const fragments: { plane: string; clip: Point[] | null }[] = [];
  for (const cut of cuts) {
    const before = clipDepthHalfPlane(remaining, cut, false);
    if (before.length >= 3) fragments.push({ plane: cut.frontBefore ? "front" : "back", clip: before });
    remaining = clipDepthHalfPlane(remaining, cut, true);
  }
  if (remaining.length >= 3) fragments.push({ plane: cuts[cuts.length - 1].frontAfter ? "front" : "back", clip: remaining });
  if (fragments.length === 1) fragments[0].clip = null;
  return fragments;
}

export function orientTitleChainRing(sample: OrientedPoint, before: Point, after: Point) {
  const dx = after.x - before.x, dy = after.y - before.y;
  const span = Math.max(.001, Math.hypot(dx, dy));
  sample.angle = Math.atan2(dy, dx);
  sample.tangentX = dx / span;
  sample.tangentY = dy / span;
  sample.normalX = -sample.tangentY;
  sample.normalY = sample.tangentX;
}

export function fitTitleChainConnector(
  sample: OrientedPoint,
  before: Point & { tangentX: number; tangentY: number },
  after: Point & { tangentX: number; tangentY: number },
  width: number
) {
  // Fit the connector's wire tips inside the adjacent apertures, not between ring centers.
  const inset = width * .34;
  const entryX = before.x + before.tangentX * inset;
  const entryY = before.y + before.tangentY * inset;
  const exitX = after.x - after.tangentX * inset;
  const exitY = after.y - after.tangentY * inset;
  const dx = exitX - entryX;
  const dy = exitY - entryY;
  const span = Math.max(0.001, Math.hypot(dx, dy));
  sample.x = (entryX + exitX) * 0.5;
  sample.y = (entryY + exitY) * 0.5;
  sample.angle = Math.atan2(dy, dx);
  sample.tangentX = dx / span;
  sample.tangentY = dy / span;
  sample.normalX = -sample.tangentY;
  sample.normalY = sample.tangentX;
  return span / (width * .9);
}
