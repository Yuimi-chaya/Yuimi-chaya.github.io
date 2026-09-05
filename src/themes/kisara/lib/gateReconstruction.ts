type Warmup = (gl: WebGL2RenderingContext, canvas: HTMLCanvasElement,
  draw: () => void, clear: () => void) => { warm: () => Promise<boolean>; destroy: () => void };
type Parameters = { reconstruction: number; opacity: number; centerX: number; centerY: number; time: number };
type Options = {
  canvas: HTMLCanvasElement | null;
  reducedMotion: boolean;
  mobile: boolean;
  lite: boolean;
  signal: AbortSignal;
  warmup: Warmup;
};

export const reconstructionFragment = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outputColor;
uniform sampler2D uFight;
uniform vec2 uResolution;
uniform vec2 uImageSize;
uniform vec2 uCenter;
uniform float uProgress;
uniform float uOpacity;
uniform float uCellSize;
uniform float uTime;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec2 coverUv(vec2 uv) {
  // Match the DOM background's 24px overscan, including its cover crop.
  vec2 box = uResolution + 48.0;
  vec2 mapped = (uv * uResolution + 24.0) / box;
  float scale = max(box.x / uImageSize.x, box.y / uImageSize.y);
  mapped = (mapped - 0.5) * box / (uImageSize * scale) + 0.5;
  return clamp(mapped, vec2(0.001), vec2(0.999));
}
void main() {
  vec2 pixel = vUv * uResolution;
  vec2 cell = floor(pixel / uCellSize);
  vec2 center = (cell + 0.5) * uCellSize / uResolution;
  vec2 origin = uCenter * uResolution;
  float farthest = length(max(origin, uResolution - origin)) / uResolution.y;
  float radius = length(center * uResolution - origin) / uResolution.y;
  float front = (1.0 - pow(1.0 - clamp(uProgress, 0.0, 1.0), 2.35)) * farthest;
  float band = max(0.055, farthest * 0.085);
  float radialProgress = clamp((front - radius) / band + 0.5, 0.0, 1.0);
  float noise = mix(hash21(cell),
    0.5 + 0.5 * sin(cell.x * 0.31 - cell.y * 0.47 + uTime * 4.2), 0.42);
  float mask = smoothstep(noise - 0.16, noise + 0.16, radialProgress);
  float settle = smoothstep(noise + 0.04, noise + 0.62, radialProgress);
  float dataFront = exp(-pow((radialProgress - noise) / 0.17, 2.0));
  vec2 cellUv = fract(pixel / uCellSize);
  float edgeDistance = min(min(cellUv.x, 1.0 - cellUv.x), min(cellUv.y, 1.0 - cellUv.y));
  float edge = 1.0 - smoothstep(0.035, 0.14, edgeDistance);
  vec3 color = mix(texture(uFight, coverUv(center)).rgb, texture(uFight, coverUv(vUv)).rgb, settle);
  color += vec3(0.26, 0.035, 0.12) * dataFront * (0.38 + edge * 0.62);
  color += vec3(0.075, 0.13, 0.28) * dataFront * edge * (0.28 + 0.22 * sin(cell.x + cell.y));
  float alpha = mask * uOpacity * (0.72 + dataFront * 0.28);
  outputColor = vec4(color * alpha, alpha);
}`;

export async function createGateReconstructionRenderer(options: Options) {
  const { canvas, reducedMotion, mobile, lite, signal, warmup } = options;
  if (!canvas || reducedMotion || signal.aborted || !canvas.dataset.fightSrc) return null;
  const gl = canvas.getContext("webgl2", {
    alpha: true, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: "high-performance"
  });
  if (!gl) return null;
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
    gl.deleteShader(shader);
    return null;
  };
  const vertex = compile(gl.VERTEX_SHADER, `#version 300 es
    precision highp float;
    out vec2 vUv;
    void main() {
      vec2 positions[3] = vec2[3](vec2(-1.0,-1.0),vec2(3.0,-1.0),vec2(-1.0,3.0));
      vec2 p = positions[gl_VertexID];
      vUv = p * 0.5 + 0.5;
      gl_Position = vec4(p,0.0,1.0);
    }`);
  const fragment = compile(gl.FRAGMENT_SHADER, reconstructionFragment);
  const program = gl.createProgram();
  const vao = gl.createVertexArray();
  let texture: WebGLTexture | null = null;
  let destroyed = false;
  let transparentWarmup: ReturnType<Warmup> | null = null;
  const clear = () => {
    canvas.style.opacity = "0";
    canvas.dataset.active = "false";
    if (gl.isContextLost()) return;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  };
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    signal.removeEventListener("abort", destroy);
    transparentWarmup?.destroy();
    if (texture) gl.deleteTexture(texture);
    if (vao) gl.deleteVertexArray(vao);
    if (program) gl.deleteProgram(program);
    clear();
  };
  if (!vertex || !fragment || !program || !vao) {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    destroy();
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    destroy();
    return null;
  }
  signal.addEventListener("abort", destroy, { once: true });
  const image = await new Promise<HTMLImageElement | null>((resolve) => {
    const candidate = new Image();
    candidate.decoding = "async";
    let finished = false;
    const finish = (loaded: boolean) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      candidate.onload = candidate.onerror = null;
      signal.removeEventListener("abort", cancel);
      resolve(loaded && candidate.naturalWidth > 0 ? candidate : null);
      if (!loaded) candidate.src = "";
    };
    const cancel = () => finish(false);
    const timer = window.setTimeout(cancel, 1800);
    signal.addEventListener("abort", cancel, { once: true });
    candidate.onload = () => finish(true);
    candidate.onerror = cancel;
    candidate.src = canvas.dataset.fightSrc!;
  });
  if (!image || destroyed || gl.isContextLost()) {
    destroy();
    return null;
  }
  try {
    texture = gl.createTexture();
    if (!texture) throw new Error("Missing reconstruction texture");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  } catch {
    destroy();
    return null;
  }
  const uniform = Object.fromEntries(["Fight", "Resolution", "ImageSize", "Center", "Progress", "Opacity", "CellSize", "Time"]
    .map((name) => [name, gl.getUniformLocation(program, `u${name}`)]));
  let width = 1;
  let height = 1;
  let dirty = true;
  const resize = () => { dirty = true; };
  const draw = (parameters: Parameters) => {
    if (destroyed || gl.isContextLost()) { clear(); return; }
    if (dirty) {
      dirty = false;
      width = Math.max(1, canvas.clientWidth);
      height = Math.max(1, canvas.clientHeight);
      const scale = Math.min(1, Math.sqrt((lite ? 210000 : mobile ? 290000 : 1300000) / (width * height)));
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(uniform.Fight, 0);
    gl.uniform2f(uniform.Resolution, width, height);
    gl.uniform2f(uniform.ImageSize, image.naturalWidth, image.naturalHeight);
    gl.uniform2f(uniform.Center, parameters.centerX, parameters.centerY);
    gl.uniform1f(uniform.Progress, parameters.reconstruction);
    gl.uniform1f(uniform.Opacity, parameters.opacity);
    gl.uniform1f(uniform.CellSize, 9);
    gl.uniform1f(uniform.Time, parameters.time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    canvas.style.opacity = "1";
    canvas.dataset.active = "true";
  };
  transparentWarmup = warmup(gl, canvas,
    () => draw({ reconstruction: 0.5, opacity: 0, centerX: 0.5, centerY: 0.5, time: 0 }), clear);
  clear();
  return { draw, clear, resize, destroy, warm: transparentWarmup.warm };
}
