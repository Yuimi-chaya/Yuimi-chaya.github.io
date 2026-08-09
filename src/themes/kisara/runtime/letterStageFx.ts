type CanvasPair = {
  back: HTMLCanvasElement;
  front: HTMLCanvasElement;
};

type ChainRecord = {
  x: number;
  y: number;
  angle: number;
  depth: number;
  index: number;
  alpha: number;
  heat: number;
  scale: number;
};

type ChainSprite = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
};

type LiquidRenderer = {
  canvas: HTMLCanvasElement;
  draw: (time: number, progress: number, opacity: number) => void;
  resize: () => void;
  clear: () => void;
  destroy: () => void;
};

const ACTION_MS: Record<string, number> = {
  request: 620,
  contract: 520,
  transformation: 1320
};

const clamp = (value: number, minimum = 0, maximum = 1) => Math.min(maximum, Math.max(minimum, value));
const smoothstep = (value: number) => {
  const unit = clamp(value);
  return unit * unit * (3 - 2 * unit);
};
const smootherstep = (value: number) => {
  const unit = clamp(value);
  return unit * unit * unit * (unit * (unit * 6 - 15) + 10);
};
const easeOutCubic = (value: number) => 1 - (1 - clamp(value)) ** 3;
const randomSeed = (seed: number) => {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
};

const resizeCanvas = (canvas: HTMLCanvasElement, maximumDpr = 1.3) => {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const dpr = Math.min(window.devicePixelRatio || 1, maximumDpr, 1280 / width, 720 / height);
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  const changed = canvas.width !== pixelWidth || canvas.height !== pixelHeight;
  if (changed) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  return { width, height, dpr, changed };
};

const clearCanvasPair = (pair: CanvasPair) => {
  for (const canvas of [pair.back, pair.front]) {
    const context = canvas.getContext("2d");
    context?.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.opacity = "0";
  }
};

const glyphBaseline = (
  context: CanvasRenderingContext2D,
  glyph: string,
  width: number,
  height: number
) => {
  const metrics = context.measureText(glyph);
  const ascent = metrics.actualBoundingBoxAscent || height * 0.72;
  const descent = metrics.actualBoundingBoxDescent || height * 0.16;
  return {
    x: width * 0.5,
    y: (height + ascent - descent) * 0.5
  };
};

class ChainRenderer {
  private readonly sprites = new Map<string, ChainSprite>();

  draw(pair: CanvasPair, progress: number, settled: boolean) {
    const backSize = resizeCanvas(pair.back);
    const frontSize = resizeCanvas(pair.front);
    const back = pair.back.getContext("2d", { alpha: true });
    const front = pair.front.getContext("2d", { alpha: true });
    if (!back || !front) return;
    const width = Math.min(backSize.width, frontSize.width);
    const height = Math.min(backSize.height, frontSize.height);
    const dpr = Math.min(backSize.dpr, frontSize.dpr);
    for (const [canvas, context] of [[pair.back, back], [pair.front, front]] as const) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.imageSmoothingEnabled = true;
    }

    const unit = smoothstep(progress);
    const tighten = easeOutCubic(clamp((unit - 0.44) / 0.56));
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const records: ChainRecord[] = [];
    const addRecord = (record: ChainRecord, order: number, start: number, end: number) => {
      const reveal = smoothstep((unit - (start + order * (end - start))) / 0.11);
      if (reveal <= 0.002) return;
      records.push({
        ...record,
        alpha: reveal * (settled ? 0.9 : 1),
        heat: clamp(unit * 1.18 - order * 0.24)
      });
    };

    const addWeave = (
      phase: number,
      direction: number,
      count: number,
      turns: number,
      amplitudeUnit: number,
      start: number,
      end: number
    ) => {
      const amplitude = width * (amplitudeUnit - tighten * 0.012);
      for (let index = 0; index < count; index += 1) {
        const order = index / Math.max(1, count - 1);
        const travel = direction > 0 ? order : 1 - order;
        const wave = travel * Math.PI * turns + phase;
        const y = height * (0.09 + travel * 0.82);
        const x = centerX + Math.sin(wave) * amplitude;
        const tangentX = Math.cos(wave) * amplitude * Math.PI * turns;
        const tangentY = height * 0.82;
        addRecord({
          x,
          y,
          angle: Math.atan2(tangentY, tangentX),
          depth: Math.cos(wave),
          index: index + Math.round((phase + Math.PI * 2) * 13),
          alpha: 0,
          heat: 0,
          scale: 0.76
        }, order, start, end);
      }
    };
    addWeave(-0.62, 1, 28, 4.8, 0.118, 0.02, 0.72);
    addWeave(Math.PI * 0.76, -1, 25, 4.35, 0.098, 0.28, 0.96);

    const backRecords = records.filter((record) => record.depth < -0.06);
    const frontRecords = records.filter((record) => record.depth >= -0.06);
    this.drawLayer(back, backRecords, false, height);
    this.drawLayer(front, frontRecords, true, height);

    pair.back.style.opacity = records.length ? "0.88" : "0";
    pair.front.style.opacity = records.length ? "1" : "0";
  }

  clear(pair: CanvasPair) {
    clearCanvasPair(pair);
  }

  private drawLayer(context: CanvasRenderingContext2D, records: ChainRecord[], front: boolean, height: number) {
    for (const pass of [0, 1]) {
      for (const record of records) {
        if (record.index % 2 !== pass) continue;
        this.drawLink(context, record, front, height);
      }
    }
  }

  private drawLink(context: CanvasRenderingContext2D, record: ChainRecord, front: boolean, height: number) {
    const edgeOn = record.index % 2 === 1;
    const linkHeight = clamp(height * 0.044, 8.2, 14.8);
    const linkWidth = linkHeight * 1.82;
    const variant = Math.min(2, Math.floor(randomSeed(record.index * 73.7 + 19.1) * 3));
    const cold = this.getSprite(linkWidth, linkHeight, front, false, edgeOn, variant);
    const hot = this.getSprite(linkWidth, linkHeight, front, true, edgeOn, variant);
    const heat = smoothstep(record.heat) * (front ? 0.84 : 0.7);
    const verticalScale = edgeOn ? 0.38 : 1;
    context.save();
    context.translate(record.x, record.y);
    context.rotate(record.angle + (edgeOn ? 0.045 : -0.035));
    context.scale(record.scale, record.scale * verticalScale);
    context.globalAlpha = record.alpha * (front ? 1 : 0.72);
    if (heat < 0.99) {
      context.globalAlpha *= 1 - heat;
      context.drawImage(cold.canvas, -cold.width * 0.5, -cold.height * 0.5, cold.width, cold.height);
      context.globalAlpha = record.alpha * (front ? 1 : 0.72);
    }
    if (heat > 0.01) {
      context.globalAlpha *= heat;
      context.drawImage(hot.canvas, -hot.width * 0.5, -hot.height * 0.5, hot.width, hot.height);
    }
    context.restore();
  }

  private getSprite(width: number, height: number, front: boolean, hot: boolean, edgeOn: boolean, variant: number) {
    const key = [Math.round(width * 10), Math.round(height * 10), front ? 1 : 0, hot ? 1 : 0, edgeOn ? 1 : 0, variant].join(":");
    const cached = this.sprites.get(key);
    if (cached) return cached;
    const scale = 2.2;
    const padding = front ? 12 : 10;
    const cssWidth = width + padding * 2;
    const cssHeight = height + padding * 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(cssWidth * scale);
    canvas.height = Math.ceil(cssHeight * scale);
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return { canvas, width: cssWidth, height: cssHeight };
    context.setTransform(scale, 0, 0, scale, cssWidth * scale * 0.5, cssHeight * scale * 0.5);
    context.lineCap = "round";
    context.lineJoin = "round";
    const tone = variant / 2 - 0.5;
    const metal = context.createLinearGradient(0, -height * 0.62, 0, height * 0.62);
    if (hot) {
      metal.addColorStop(0, `hsla(${337 + tone * 5},28%,7%,.99)`);
      metal.addColorStop(0.16, `hsla(${342 + tone * 6},30%,18%,.99)`);
      metal.addColorStop(0.3, `hsla(${350 + tone * 4},24%,68%,.99)`);
      metal.addColorStop(0.48, `hsla(${344 + tone * 5},48%,31%,.99)`);
      metal.addColorStop(0.68, `hsla(${336 + tone * 4},34%,10%,.99)`);
      metal.addColorStop(0.86, `hsla(${349 + tone * 5},50%,38%,.99)`);
      metal.addColorStop(1, `hsla(${354 + tone * 4},40%,58%,.98)`);
    } else {
      metal.addColorStop(0, `hsla(${220 + tone * 5},28%,6%,.99)`);
      metal.addColorStop(0.15, `hsla(${218 + tone * 6},24%,19%,.99)`);
      metal.addColorStop(0.29, `hsla(${215 + tone * 4},14%,76%,.99)`);
      metal.addColorStop(0.46, `hsla(${217 + tone * 5},22%,38%,.99)`);
      metal.addColorStop(0.66, `hsla(${221 + tone * 5},28%,10%,.99)`);
      metal.addColorStop(0.84, `hsla(${214 + tone * 5},20%,46%,.99)`);
      metal.addColorStop(1, `hsla(${212 + tone * 4},14%,68%,.98)`);
    }
    context.globalAlpha = front ? 0.98 : 0.78;
    context.strokeStyle = "rgba(3,4,13,.98)";
    context.lineWidth = front ? 5.7 : 5.05;
    context.shadowColor = "rgba(1,2,11,.9)";
    context.shadowBlur = front ? 2.4 : 0;
    context.beginPath();
    context.ellipse(0, 0, width * 0.5, height * 0.5, 0, 0, Math.PI * 2);
    context.stroke();
    context.globalAlpha = front ? 1 : 0.82;
    context.strokeStyle = metal;
    context.lineWidth = front ? 3.45 : 3;
    context.shadowColor = hot ? "rgba(255,76,122,.28)" : "rgba(124,157,211,.18)";
    context.shadowBlur = front ? 2 : 0;
    context.beginPath();
    context.ellipse(0, 0, width * 0.5, height * 0.5, 0, 0, Math.PI * 2);
    context.stroke();
    context.globalCompositeOperation = "screen";
    context.globalAlpha = front ? 0.5 : 0.24;
    context.strokeStyle = hot ? "rgba(255,224,232,.9)" : "rgba(226,235,248,.88)";
    context.lineWidth = 0.68;
    context.shadowBlur = 0;
    context.beginPath();
    context.ellipse(0, -height * 0.04, width * 0.438, height * 0.39, 0, Math.PI * 1.08, Math.PI * 1.86);
    context.stroke();
    const sprite = { canvas, width: cssWidth, height: cssHeight };
    this.sprites.set(key, sprite);
    return sprite;
  }
}

const createHeartPath = (centerX: number, centerY: number, size: number, scale = 1) => {
  const radius = size * scale;
  const path = new Path2D();
  path.moveTo(centerX, centerY + radius * 0.74);
  path.bezierCurveTo(centerX - radius * 0.16, centerY + radius * 0.58, centerX - radius * 0.92, centerY + radius * 0.12, centerX - radius * 0.92, centerY - radius * 0.34);
  path.bezierCurveTo(centerX - radius * 0.92, centerY - radius * 0.73, centerX - radius * 0.48, centerY - radius * 0.92, centerX, centerY - radius * 0.47);
  path.bezierCurveTo(centerX + radius * 0.48, centerY - radius * 0.92, centerX + radius * 0.92, centerY - radius * 0.73, centerX + radius * 0.92, centerY - radius * 0.34);
  path.bezierCurveTo(centerX + radius * 0.92, centerY + radius * 0.12, centerX + radius * 0.16, centerY + radius * 0.58, centerX, centerY + radius * 0.74);
  path.closePath();
  return path;
};

const drawContractHeart = (pair: CanvasPair, progress: number, settled: boolean, timestamp: number) => {
  const backSize = resizeCanvas(pair.back);
  const frontSize = resizeCanvas(pair.front);
  const back = pair.back.getContext("2d", { alpha: true });
  const front = pair.front.getContext("2d", { alpha: true });
  if (!back || !front) return;
  const width = Math.min(backSize.width, frontSize.width);
  const height = Math.min(backSize.height, frontSize.height);
  const dpr = Math.min(backSize.dpr, frontSize.dpr);
  for (const [canvas, context] of [[pair.back, back], [pair.front, front]] as const) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  if (settled) {
    pair.back.style.opacity = "0";
    pair.front.style.opacity = "0";
    return;
  }
  const build = smootherstep((progress - 0.23) / 0.105);
  const collapse = smootherstep((progress - 0.68) / 0.105);
  const fade = 1 - smootherstep((progress - 0.84) / 0.11);
  const opacity = build * fade;
  if (opacity <= 0.002) {
    pair.back.style.opacity = "0";
    pair.front.style.opacity = "0";
    return;
  }
  const lockPulse = Math.exp(-Math.pow((progress - 0.36) / 0.042, 2));
  const heartbeat = 0.5 + Math.sin(timestamp * 0.016) * 0.5;
  const centerX = width * 0.5;
  const centerY = height * 0.535;
  const size = clamp(height * 0.19, 17, 32);
  const scale = (0.76 + build * 0.24 + lockPulse * 0.08) * (1 - collapse * 0.56);
  const heart = createHeartPath(centerX, centerY, size, scale);

  const thread = smoothstep((progress - 0.19) / 0.065)
    * (1 - smoothstep((progress - 0.39) / 0.11));
  if (thread > 0.002) {
    front.save();
    front.globalCompositeOperation = "screen";
    front.lineCap = "round";
    for (const side of [-1, 1]) {
      front.globalAlpha = thread * 0.72;
      front.strokeStyle = side < 0 ? "rgba(255,75,138,.94)" : "rgba(151,216,172,.9)";
      front.lineWidth = 1.05;
      front.beginPath();
      front.moveTo(centerX + side * width * 0.47, centerY + side * height * 0.075);
      front.quadraticCurveTo(centerX + side * width * 0.2, centerY - height * 0.17, centerX, centerY);
      front.stroke();
    }
    front.restore();
  }

  back.save();
  back.globalAlpha = opacity * (0.3 + lockPulse * 0.08);
  back.fillStyle = "rgba(66,7,43,.8)";
  back.shadowColor = "rgba(255,43,115,.3)";
  back.shadowBlur = 4 + lockPulse * 3;
  back.fill(heart);
  back.globalAlpha = opacity * 0.78;
  back.strokeStyle = "rgba(24,5,28,.96)";
  back.lineWidth = 4.2;
  back.stroke(heart);
  back.restore();

  front.save();
  front.globalCompositeOperation = "screen";
  front.globalAlpha = opacity * (0.24 + lockPulse * 0.16);
  front.fillStyle = "rgba(255,53,121,.9)";
  front.shadowColor = "rgba(255,47,117,.56)";
  front.shadowBlur = 4 + lockPulse * 6;
  front.fill(heart);
  front.globalAlpha = opacity * (0.82 + heartbeat * 0.1);
  front.strokeStyle = "rgba(255,72,137,.99)";
  front.lineWidth = 2.1 + lockPulse * 0.42;
  front.stroke(heart);
  front.globalAlpha = opacity * (0.58 + lockPulse * 0.24);
  front.strokeStyle = "rgba(255,247,251,.98)";
  front.lineWidth = 0.68 + lockPulse * 0.28;
  front.shadowBlur = 1.4;
  front.stroke(heart);

  if (lockPulse > 0.002) {
    const pulseHeart = createHeartPath(centerX, centerY, size, scale * (1 + lockPulse * 0.34));
    front.globalAlpha = opacity * lockPulse * 0.3;
    front.strokeStyle = "rgba(255,229,241,.96)";
    front.lineWidth = 0.82;
    front.shadowBlur = 5;
    front.stroke(pulseHeart);
  }

  const burst = smoothstep((progress - 0.695) / 0.245);
  if (burst > 0.002) {
    for (let index = 0; index < 15; index += 1) {
      const seedA = randomSeed(52021 + index * 73.7);
      const seedB = randomSeed(62003 + index * 97.1);
      const age = clamp((burst - seedA * 0.13) / (1 - seedA * 0.13));
      if (age <= 0.001 || age >= 0.999) continue;
      const angle = seedB * Math.PI * 2 - Math.PI * 0.5;
      const travel = size * (0.5 + seedA * 2) * easeOutCubic(age);
      const x = centerX + Math.cos(angle) * travel;
      const y = centerY + Math.sin(angle) * travel * 0.78;
      front.globalAlpha = (1 - age) ** 1.45 * (0.46 + seedA * 0.5);
      front.strokeStyle = index % 3 === 0 ? "rgba(226,239,255,.96)" : "rgba(255,81,143,.96)";
      front.lineWidth = 0.55 + seedA * 0.62;
      front.beginPath();
      front.moveTo(x - Math.cos(angle) * 3, y - Math.sin(angle) * 3);
      front.lineTo(x, y);
      front.stroke();
    }
  }
  front.restore();
  pair.back.style.opacity = "1";
  pair.front.style.opacity = "1";
};

const dataBuffers = new WeakMap<HTMLCanvasElement, { mask: HTMLCanvasElement; width: number; height: number }>();

const drawReconstruction = (
  canvas: HTMLCanvasElement,
  letter: HTMLElement,
  progress: number,
  timestamp: number,
  opacity: number
) => {
  const size = resizeCanvas(canvas, 1.2);
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) return;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (opacity <= 0.002) {
    canvas.style.opacity = "0";
    return;
  }
  const width = canvas.width;
  const height = canvas.height;
  let buffer = dataBuffers.get(canvas);
  if (!buffer || buffer.width !== width || buffer.height !== height) {
    const mask = document.createElement("canvas");
    mask.width = width;
    mask.height = height;
    const maskContext = mask.getContext("2d");
    if (!maskContext) return;
    const style = window.getComputedStyle(letter);
    const fontSize = Math.max(1, Number.parseFloat(style.fontSize) * size.dpr);
    maskContext.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
    maskContext.textAlign = "center";
    maskContext.textBaseline = "alphabetic";
    maskContext.lineJoin = "round";
    maskContext.fillStyle = "#fff";
    maskContext.strokeStyle = "#fff";
    maskContext.lineWidth = Math.max(1, 1.8 * size.dpr);
    const baseline = glyphBaseline(maskContext, "R", width, height);
    maskContext.strokeText("R", baseline.x, baseline.y);
    maskContext.fillText("R", baseline.x, baseline.y);
    buffer = { mask, width, height };
    dataBuffers.set(canvas, buffer);
  }
  const unit = smoothstep(progress);
  const pressure = Math.sin(unit * Math.PI);
  context.save();
  const base = context.createLinearGradient(0, height * 0.12, 0, height * 0.9);
  base.addColorStop(0, "rgba(255,239,246,.94)");
  base.addColorStop(0.34, "rgba(255,91,151,.92)");
  base.addColorStop(0.68, "rgba(142,61,132,.9)");
  base.addColorStop(1, "rgba(66,37,91,.92)");
  context.globalAlpha = 0.35 + unit * 0.44;
  context.fillStyle = base;
  context.fillRect(0, 0, width, height);
  const columns = 13;
  const rows = 18;
  const front = unit * (columns + rows + 7);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const order = x * 0.72 + (rows - y) * 0.56 + randomSeed(x * 31 + y * 97) * 3.2;
      const reveal = smoothstep((front - order) / 3.4);
      if (reveal <= 0.002) continue;
      const cellWidth = width / columns;
      const cellHeight = height / rows;
      const drift = (1 - reveal) * (8 + randomSeed(x * 13 + y * 41) * 22) * size.dpr;
      context.globalCompositeOperation = x % 3 === 0 ? "screen" : "source-over";
      context.globalAlpha = reveal * (0.12 + pressure * 0.18);
      context.fillStyle = x % 4 === 0 ? "rgba(164,201,255,.86)" : "rgba(255,93,153,.88)";
      context.fillRect(x * cellWidth + drift, y * cellHeight - drift * 0.3, cellWidth * 0.74, cellHeight * 0.48);
    }
  }
  context.globalCompositeOperation = "screen";
  context.lineCap = "round";
  for (let line = 0; line < 7; line += 1) {
    const seed = randomSeed(713 + line * 91.7);
    const y = height * (0.16 + seed * 0.7);
    const wave = Math.sin(timestamp * 0.002 + line) * width * 0.02;
    context.globalAlpha = (0.12 + pressure * 0.22) * unit;
    context.strokeStyle = line % 2 ? "rgba(255,244,249,.92)" : "rgba(137,181,255,.88)";
    context.lineWidth = (0.6 + seed * 1.1) * size.dpr;
    context.beginPath();
    context.moveTo(width * 0.08, y);
    context.bezierCurveTo(width * 0.3, y - wave, width * 0.66, y + wave, width * 0.92, y - wave * 0.4);
    context.stroke();
  }
  context.restore();
  context.globalCompositeOperation = "destination-in";
  context.drawImage(buffer.mask, 0, 0);
  context.globalCompositeOperation = "source-over";

  if (progress < 0.999) {
    context.save();
    context.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    const cssWidth = size.width;
    const cssHeight = size.height;
    for (let index = 0; index < 18; index += 1) {
      const seedA = randomSeed(index * 43.7 + 811);
      const seedB = randomSeed(index * 71.1 + 431);
      const local = clamp((unit - seedA * 0.42) / 0.58);
      if (local <= 0.001 || local >= 0.999) continue;
      const side = index % 2 ? -1 : 1;
      const x = cssWidth * (0.5 + side * (0.58 - local * 0.36));
      const y = cssHeight * (0.1 + seedB * 0.8 + (0.5 - seedB) * local * 0.18);
      context.globalAlpha = Math.sin(local * Math.PI) * 0.7;
      context.fillStyle = index % 3 ? "rgba(255,82,145,.88)" : "rgba(153,193,255,.9)";
      context.fillRect(x, y, 2 + seedA * 5, 1 + seedB * 3);
    }
    context.restore();
  }
  canvas.style.opacity = opacity.toFixed(3);
};

const createLiquidRenderer = (canvas: HTMLCanvasElement, letter: HTMLElement): LiquidRenderer | null => {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance"
  });
  if (!gl) return null;
  const source = document.createElement("canvas");
  const sourceContext = source.getContext("2d");
  if (!sourceContext) return null;
  const vertexSource = `#version 300 es
    precision highp float;
    const vec2 POSITIONS[3] = vec2[3](vec2(-1.0,-1.0),vec2(3.0,-1.0),vec2(-1.0,3.0));
    out vec2 vUv;
    void main(){vec2 p=POSITIONS[gl_VertexID];vUv=p*.5+.5;gl_Position=vec4(p,0.,1.);}
  `;
  const fragmentSource = `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 outputColor;
    uniform sampler2D uTexture;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uProgress;
    uniform float uOpacity;
    void main(){
      vec2 p=vUv-.5;
      float pressure=sin(clamp(uProgress,0.,1.)*3.14159265);
      float settled=smoothstep(.86,1.,uProgress);
      float phase=uTime*(.72+settled*.38);
      float waveA=sin(p.y*18.+phase*1.7+sin(p.x*8.-phase*.5)*1.4);
      float waveB=sin(p.x*14.-p.y*9.-phase*1.15);
      float curl=cos((p.x+p.y*.72)*22.+phase*1.9);
      float strength=.0035+pressure*.012+settled*.005;
      vec2 offset=vec2(waveA*1.15+waveB*.52,waveB*.7+curl*.34)*strength;
      offset.x+=sin(p.y*11.-phase)*pressure*.006;
      vec2 uv=clamp(vUv+offset,vec2(.001),vec2(.999));
      vec2 chroma=vec2(.0018+pressure*.0022,-.0005);
      vec4 base=texture(uTexture,uv);
      vec4 rose=texture(uTexture,clamp(uv+chroma,vec2(.001),vec2(.999)));
      vec4 blue=texture(uTexture,clamp(uv-chroma,vec2(.001),vec2(.999)));
      base.r=mix(base.r,rose.r,.24+pressure*.16);
      base.b=mix(base.b,blue.b,.18+pressure*.12);
      float caustic=pow(max(0.,.5+.5*sin((uv.y+sin(uv.x*7.-phase*.4)*.08)*32.+phase*2.2)),7.);
      base.rgb+=base.a*vec3(.22,.04,.13)*caustic*(.22+pressure*.32);
      float edge=smoothstep(0.,.018,uv.x)*smoothstep(0.,.018,uv.y)*smoothstep(0.,.018,1.-uv.x)*smoothstep(0.,.018,1.-uv.y);
      outputColor=vec4(base.rgb*edge*uOpacity,base.a*edge*uOpacity);
    }
  `;
  const compile = (type: number, sourceCode: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, sourceCode);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };
  const vertex = compile(gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  const vao = gl.createVertexArray();
  const texture = gl.createTexture();
  if (!vao || !texture) return null;
  const uniforms = {
    texture: gl.getUniformLocation(program, "uTexture"),
    resolution: gl.getUniformLocation(program, "uResolution"),
    time: gl.getUniformLocation(program, "uTime"),
    progress: gl.getUniformLocation(program, "uProgress"),
    opacity: gl.getUniformLocation(program, "uOpacity")
  };
  let dirty = true;
  const resize = () => {
    if (!dirty) return;
    dirty = false;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.15, 960 / Math.max(1, rect.width));
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      source.width = width;
      source.height = height;
    }
    const style = window.getComputedStyle(letter);
    const fontSize = Math.max(1, Number.parseFloat(style.fontSize) * dpr);
    sourceContext.clearRect(0, 0, width, height);
    sourceContext.save();
    sourceContext.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
    sourceContext.textAlign = "center";
    sourceContext.textBaseline = "alphabetic";
    sourceContext.lineJoin = "round";
    const gradient = sourceContext.createLinearGradient(0, height * 0.16, 0, height * 0.86);
    gradient.addColorStop(0, "#fff2f7");
    gradient.addColorStop(0.3, "#ff8cab");
    gradient.addColorStop(0.62, "#ff356e");
    gradient.addColorStop(1, "#704686");
    sourceContext.shadowColor = "rgba(255,45,96,.38)";
    sourceContext.shadowBlur = Math.max(4, 10 * dpr);
    sourceContext.strokeStyle = "rgba(255,235,242,.84)";
    sourceContext.lineWidth = Math.max(1.2, 1.8 * dpr);
    const baseline = glyphBaseline(sourceContext, "R", width, height);
    sourceContext.strokeText("R", baseline.x, baseline.y);
    sourceContext.fillStyle = gradient;
    sourceContext.fillText("R", baseline.x, baseline.y);
    sourceContext.restore();
    gl.viewport(0, 0, width, height);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  };
  const clear = () => {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    canvas.style.opacity = "0";
  };
  const draw = (time: number, progress: number, opacity: number) => {
    resize();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniforms.texture, 0);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.time, time / 1000);
    gl.uniform1f(uniforms.progress, progress);
    gl.uniform1f(uniforms.opacity, opacity);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    canvas.style.opacity = opacity > 0.01 ? "1" : "0";
  };
  const destroy = () => {
    gl.deleteTexture(texture);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
    clear();
  };
  resize();
  clear();
  return {
    canvas,
    draw,
    resize: () => {
      dirty = true;
      resize();
    },
    clear,
    destroy
  };
};

export class KisaraLetterFxController {
  private readonly root: HTMLElement;
  private readonly reducedMotion: boolean;
  private readonly staticOnly: boolean;
  private readonly chainRenderer = new ChainRenderer();
  private readonly observer: MutationObserver;
  private readonly resizeObserver: ResizeObserver;
  private frame = 0;
  private actionStartedAt = 0;
  private actionRunning = false;
  private activeScene = "";
  private disposed = false;
  private liquid: LiquidRenderer | null = null;

  constructor(root: HTMLElement) {
    this.root = root;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.staticOnly = this.reducedMotion || window.matchMedia("(max-width: 720px)").matches;
    this.observer = new MutationObserver(() => this.sync());
    this.resizeObserver = new ResizeObserver(() => {
      this.liquid?.resize();
      this.draw(performance.now());
    });
  }

  start() {
    if (this.staticOnly || this.disposed) return;
    this.observer.observe(this.root, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-wordmark-scene", "data-wordmark-active", "data-wordmark-action"]
    });
    this.resizeObserver.observe(this.root);
    document.addEventListener("visibilitychange", this.handleVisibility);
    this.sync(true);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.observer.disconnect();
    this.resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", this.handleVisibility);
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.liquid?.destroy();
    this.liquid = null;
  }

  private readonly handleVisibility = () => {
    if (document.hidden) {
      if (this.frame) cancelAnimationFrame(this.frame);
      this.frame = 0;
      return;
    }
    this.sync(true);
  };

  private currentWordmark() {
    return this.root.querySelector<HTMLElement>("[data-wordmark-scene]");
  }

  private sync(force = false) {
    if (this.disposed || document.hidden) return;
    const wordmark = this.currentWordmark();
    if (!wordmark) return;
    const scene = wordmark.dataset.wordmarkScene ?? "rescue";
    const running = wordmark.dataset.wordmarkAction === "running";
    if (force || scene !== this.activeScene || (running && !this.actionRunning)) {
      this.actionStartedAt = performance.now();
    }
    this.activeScene = scene;
    this.actionRunning = running;
    this.draw(performance.now());
    this.schedule();
  }

  private schedule() {
    if (this.frame || this.disposed || document.hidden) return;
    const ambient = this.activeScene === "transformation" && !this.actionRunning;
    if (!this.actionRunning && !ambient) return;
    this.frame = requestAnimationFrame(this.tick);
  }

  private readonly tick = (timestamp: number) => {
    this.frame = 0;
    if (this.disposed || document.hidden) return;
    this.draw(timestamp);
    this.schedule();
  };

  private draw(timestamp: number) {
    const wordmark = this.currentWordmark();
    if (!wordmark) return;
    const scene = wordmark.dataset.wordmarkScene ?? "rescue";
    const duration = ACTION_MS[scene] ?? 1;
    const actionProgress = this.actionRunning
      ? clamp((timestamp - this.actionStartedAt) / duration)
      : wordmark.dataset.wordmarkAction === "settled" ? 1 : 0;

    const chainBack = wordmark.querySelector<HTMLCanvasElement>("[data-letter-chain-back]");
    const chainFront = wordmark.querySelector<HTMLCanvasElement>("[data-letter-chain-front]");
    if (chainBack && chainFront) {
      if (scene === "request") {
        this.chainRenderer.draw({ back: chainBack, front: chainFront }, actionProgress, !this.actionRunning);
      } else {
        this.chainRenderer.clear({ back: chainBack, front: chainFront });
      }
    }

    const heartBack = wordmark.querySelector<HTMLCanvasElement>("[data-letter-contract-back]");
    const heartFront = wordmark.querySelector<HTMLCanvasElement>("[data-letter-contract-front]");
    if (heartBack && heartFront) {
      if (scene === "contract") {
        drawContractHeart(
          { back: heartBack, front: heartFront },
          actionProgress,
          !this.actionRunning,
          timestamp
        );
      } else {
        clearCanvasPair({ back: heartBack, front: heartFront });
      }
    }

    const dataCanvas = wordmark.querySelector<HTMLCanvasElement>("[data-letter-data]");
    const lensCanvas = wordmark.querySelector<HTMLCanvasElement>("[data-letter-lens]");
    const rLetter = wordmark.querySelector<HTMLElement>('[data-wordmark-letter="4"]');
    if (dataCanvas && lensCanvas && rLetter && scene === "transformation") {
      const progress = actionProgress;
      const reconstructionOpacity = smoothstep((progress - 0.02) / 0.16)
        * (1 - smoothstep((progress - 0.72) / 0.22));
      if (!this.liquid || this.liquid.canvas !== lensCanvas) {
        this.liquid?.destroy();
        this.liquid = createLiquidRenderer(lensCanvas, rLetter);
      }
      const liquidOpacity = this.liquid ? smoothstep((progress - 0.34) / 0.58) : 0;
      const sourceOpacity = this.liquid ? 1 - liquidOpacity : 1;
      rLetter.style.setProperty("--kisara-r-glass-opacity", (sourceOpacity * 0.34).toFixed(3));
      rLetter.style.setProperty("--kisara-r-material-opacity", (sourceOpacity * 0.16).toFixed(3));
      rLetter.style.setProperty("--kisara-r-enchant-opacity", (sourceOpacity * 0.82).toFixed(3));
      drawReconstruction(dataCanvas, rLetter, progress, timestamp, reconstructionOpacity);
      this.liquid?.draw(timestamp, progress, liquidOpacity * 0.96);
    } else {
      if (dataCanvas) {
        const context = dataCanvas.getContext("2d");
        context?.clearRect(0, 0, dataCanvas.width, dataCanvas.height);
        dataCanvas.style.opacity = "0";
      }
      this.liquid?.clear();
    }
  }
}
