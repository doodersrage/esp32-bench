// A small WebGL viewer for a printable part: flat-shaded triangles on a bed,
// drag to orbit, wheel or pinch to zoom. No library: the part maker is the only
// page that needs 3D, and this is all it needs.

export interface Triangles {
  positions: Float32Array;
  normals: Float32Array;
}

type Mat4 = Float32Array;

const VERT = `
attribute vec3 position;
attribute vec3 normal;
uniform mat4 view;
uniform mat4 proj;
varying vec3 vNormal;
void main() {
  vNormal = normal;
  gl_Position = proj * view * vec4(position, 1.0);
}`;

const FRAG = `
precision mediump float;
uniform vec3 colour;
uniform vec3 light;
varying vec3 vNormal;
void main() {
  float d = max(dot(normalize(vNormal), light), 0.0);
  float fill = max(dot(normalize(vNormal), vec3(0.4, 0.3, -0.5)), 0.0) * 0.15;
  gl_FragColor = vec4(colour * (0.38 + 0.6 * d + fill), 1.0);
}`;

export class PartViewer {
  private gl: WebGLRenderingContext;
  private prog: WebGLProgram;
  private part?: { buf: WebGLBuffer; nbuf: WebGLBuffer; count: number };
  private bed?: { buf: WebGLBuffer; nbuf: WebGLBuffer; count: number };
  private centre: [number, number, number] = [0, 0, 0];
  private radius = 50;
  private yaw = -0.6;
  private pitch = 0.55;
  private zoom = 1;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch = 0;
  private frame = 0;

  /** Throws if the browser has no WebGL. */
  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl", { antialias: true });
    if (!gl) throw new Error("no WebGL");
    this.gl = gl;
    this.prog = program(gl, VERT, FRAG);
    gl.enable(gl.DEPTH_TEST);
    this.listen();
    new ResizeObserver(() => this.draw()).observe(canvas);
  }

  /** Show a part, framed to fit; keeps the current angle. */
  show(tris: Triangles): void {
    const gl = this.gl;
    const p = tris.positions;
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.length; i += 3) {
      for (let a = 0; a < 3; a++) {
        if (p[i + a] < min[a]) min[a] = p[i + a];
        if (p[i + a] > max[a]) max[a] = p[i + a];
      }
    }
    this.centre = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
    this.radius = Math.max(10, Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2);
    this.part = upload(gl, this.part, tris.positions, tris.normals);
    // The bed: a thin plate a little larger than the part, just under it.
    const m = 8, z = min[2] - 0.05;
    const x0 = min[0] - m, x1 = max[0] + m, y0 = min[1] - m, y1 = max[1] + m;
    const bed = new Float32Array([x0, y0, z, x1, y0, z, x1, y1, z, x0, y0, z, x1, y1, z, x0, y1, z]);
    const up = new Float32Array(18);
    for (let i = 2; i < 18; i += 3) up[i] = 1;
    this.bed = upload(gl, this.bed, bed, up);
    this.draw();
  }

  draw(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.render());
  }

  private render(): void {
    const gl = this.gl, c = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.clearColor(0.949, 0.961, 0.945, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!this.part) return;
    const fov = 0.6;
    const dist = (this.radius / Math.sin(fov / 2)) * 1.05 * this.zoom;
    const eye: [number, number, number] = [
      this.centre[0] + dist * Math.cos(this.pitch) * Math.cos(this.yaw),
      this.centre[1] + dist * Math.cos(this.pitch) * Math.sin(this.yaw),
      this.centre[2] + dist * Math.sin(this.pitch),
    ];
    const view = lookAt(eye, this.centre, [0, 0, 1]);
    const proj = perspective(fov, w / h, dist / 50, dist * 4);
    gl.useProgram(this.prog);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.prog, "view"), false, view);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.prog, "proj"), false, proj);
    // Light from over the viewer's left shoulder, in world space.
    const lx = Math.cos(this.yaw + 0.7), ly = Math.sin(this.yaw + 0.7);
    const l = [lx * 0.6, ly * 0.6, 0.75];
    const ll = Math.hypot(l[0], l[1], l[2]);
    gl.uniform3f(gl.getUniformLocation(this.prog, "light"), l[0] / ll, l[1] / ll, l[2] / ll);
    if (this.bed) {
      gl.uniform3f(gl.getUniformLocation(this.prog, "colour"), 0.78, 0.8, 0.77);
      this.drawBuffers(this.bed);
    }
    gl.uniform3f(gl.getUniformLocation(this.prog, "colour"), 0.2, 0.55, 0.4);
    this.drawBuffers(this.part);
  }

  private drawBuffers(b: { buf: WebGLBuffer; nbuf: WebGLBuffer; count: number }): void {
    const gl = this.gl;
    for (const [name, buf] of [["position", b.buf], ["normal", b.nbuf]] as const) {
      const loc = gl.getAttribLocation(this.prog, name);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    }
    gl.drawArrays(gl.TRIANGLES, 0, b.count);
  }

  private listen(): void {
    const c = this.canvas;
    c.style.touchAction = "none";
    c.addEventListener("pointerdown", (e) => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) this.pinch = this.spread();
    });
    c.addEventListener("pointermove", (e) => {
      const last = this.pointers.get(e.pointerId);
      if (!last) return;
      if (this.pointers.size === 1) {
        this.yaw -= (e.clientX - last.x) * 0.01;
        this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch + (e.clientY - last.y) * 0.01));
      }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const s = this.spread();
        if (this.pinch > 0 && s > 0) this.setZoom(this.zoom * (this.pinch / s));
        this.pinch = s;
      }
      this.draw();
    });
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      this.pinch = 0;
    };
    c.addEventListener("pointerup", up);
    c.addEventListener("pointercancel", up);
    c.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.setZoom(this.zoom * Math.exp(e.deltaY * 0.001));
      },
      { passive: false },
    );
    // Keyboard: arrows turn, + and - zoom.
    c.tabIndex = 0;
    c.addEventListener("keydown", (e) => {
      const turn: Record<string, () => void> = {
        ArrowLeft: () => (this.yaw += 0.15),
        ArrowRight: () => (this.yaw -= 0.15),
        ArrowUp: () => (this.pitch = Math.min(1.45, this.pitch + 0.1)),
        ArrowDown: () => (this.pitch = Math.max(-1.45, this.pitch - 0.1)),
        "+": () => this.setZoom(this.zoom / 1.15),
        "=": () => this.setZoom(this.zoom / 1.15),
        "-": () => this.setZoom(this.zoom * 1.15),
      };
      if (turn[e.key]) {
        e.preventDefault();
        turn[e.key]();
        this.draw();
      }
    });
  }

  private setZoom(z: number): void {
    this.zoom = Math.max(0.3, Math.min(4, z));
    this.draw();
  }

  private spread(): number {
    const [a, b] = [...this.pointers.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }
}

function upload(gl: WebGLRenderingContext, old: { buf: WebGLBuffer; nbuf: WebGLBuffer } | undefined, pos: Float32Array, nor: Float32Array) {
  const buf = old?.buf ?? gl.createBuffer()!;
  const nbuf = old?.nbuf ?? gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, nbuf);
  gl.bufferData(gl.ARRAY_BUFFER, nor, gl.STATIC_DRAW);
  return { buf, nbuf, count: pos.length / 3 };
}

function program(gl: WebGLRenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
  return p;
}

function perspective(fov: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}

function lookAt(eye: number[], at: number[], up: number[]): Mat4 {
  const z = norm([eye[0] - at[0], eye[1] - at[1], eye[2] - at[2]]);
  const x = norm(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ]);
}

const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v: number[]) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
