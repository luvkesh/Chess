// Chacklate Chess 3D view: hand-written WebGL (no libraries).
// Draws the room, board and pieces with soft shadows, animates moves, and
// turns clicks into board squares.
function ChacklateRenderer(canvas, options) {
  'use strict';
  const opts = Object.assign({ onSquare() {}, onContextLost() {} }, options);
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: false });
  if (!gl) return null;

  // ------------------------------------------------------------ math helpers
  const V = {
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  };
  function mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }
  function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }
  function ortho(l, r, b, t, n, f) {
    const lr = 1 / (l - r), bt = 1 / (b - t), nf = 1 / (n - f);
    return new Float32Array([-2 * lr, 0, 0, 0, 0, -2 * bt, 0, 0, 0, 0, 2 * nf, 0, (l + r) * lr, (t + b) * bt, (f + n) * nf, 1]);
  }
  function lookAt(eye, center, up) {
    const z = V.norm(V.sub(eye, center)), x = V.norm(V.cross(up, z)), y = V.cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -V.dot(x, eye), -V.dot(y, eye), -V.dot(z, eye), 1]);
  }
  // Translate · rotateY(yaw) · rotateX(tilt) · uniform scale.
  function model(x, y, z, yaw, tilt, s) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cx = Math.cos(tilt), sx = Math.sin(tilt);
    return new Float32Array([
      cy * s, 0, -sy * s, 0,
      sy * sx * s, cx * s, cy * sx * s, 0,
      sy * cx * s, -sx * s, cy * cx * s, 0,
      x, y, z, 1,
    ]);
  }
  const normalMat = (m) => new Float32Array([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]);
  const lin = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.pow(c / 255, 2.2));
  };
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // --------------------------------------------------------------- geometry
  // Vertex layout: position(3) normal(3) uv(2).
  function lathe(profile, segs) {
    const out = [];
    const segN = [];
    for (let i = 0; i < profile.length - 1; i++) {
      const dr = profile[i + 1][0] - profile[i][0], dy = profile[i + 1][1] - profile[i][1];
      const l = Math.hypot(dr, dy) || 1;
      segN.push([dy / l, -dr / l]);
    }
    const smooth = Math.cos((42 * Math.PI) / 180);
    const vn = (seg, other) => {
      const n = segN[seg];
      if (other < 0 || other >= segN.length) return n;
      const o = segN[other];
      if (n[0] * o[0] + n[1] * o[1] < smooth) return n;
      const a = n[0] + o[0], b = n[1] + o[1], l = Math.hypot(a, b);
      return [a / l, b / l];
    };
    for (let s = 0; s < profile.length - 1; s++) {
      const p0 = profile[s], p1 = profile[s + 1];
      if (p0[0] === p1[0] && p0[1] === p1[1]) continue;
      const n0 = vn(s, s - 1), n1 = vn(s, s + 1);
      for (let j = 0; j < segs; j++) {
        const a0 = (j / segs) * Math.PI * 2, a1 = ((j + 1) / segs) * Math.PI * 2;
        const v = (p, n, a) => [p[0] * Math.cos(a), p[1], p[0] * Math.sin(a), n[0] * Math.cos(a), n[1], n[0] * Math.sin(a), j / segs, p[1]];
        out.push(...v(p0, n0, a0), ...v(p1, n1, a0), ...v(p1, n1, a1), ...v(p0, n0, a0), ...v(p1, n1, a1), ...v(p0, n0, a1));
      }
    }
    return out;
  }
  function sphereProfile(r, cy, from, to, steps) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const a = from + ((to - from) * i) / steps;
      pts.push([Math.max(0, r * Math.cos(a)), cy + r * Math.sin(a)]);
    }
    return pts;
  }
  function box(w, h, d, cx, cy, cz) {
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const faces = [
      [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0]],
      [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]],
      [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
      [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1]],
      [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0]],
      [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]],
    ];
    const out = [];
    for (const f of faces) {
      const n = f[4];
      const uv = (p) => [(p[0] - x0) / w, (p[2] - z0) / d];
      for (const i of [0, 1, 2, 0, 2, 3]) out.push(...f[i], ...n, ...uv(f[i]));
    }
    return out;
  }
  function triangulate(pts) {
    const idx = pts.map((_, i) => i), tris = [];
    const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const inside = (p, a, b, c) => cr(a, b, p) > 0 && cr(b, c, p) > 0 && cr(c, a, p) > 0;
    let guard = 0;
    while (idx.length > 3 && guard++ < 2000) {
      let clipped = false;
      for (let i = 0; i < idx.length; i++) {
        const a = idx[(i + idx.length - 1) % idx.length], b = idx[i], c = idx[(i + 1) % idx.length];
        if (cr(pts[a], pts[b], pts[c]) <= 0) continue;
        if (idx.some((j) => j !== a && j !== b && j !== c && inside(pts[j], pts[a], pts[b], pts[c]))) continue;
        tris.push([a, b, c]); idx.splice(i, 1); clipped = true; break;
      }
      if (!clipped) break;
    }
    if (idx.length === 3) tris.push(idx.slice());
    return tris;
  }
  // Extrudes a counter-clockwise outline in the x/y plane to thickness t (centred on z = 0).
  function extrude(pts, t) {
    const out = [], h = t / 2;
    for (const [a, b, c] of triangulate(pts)) {
      out.push(pts[a][0], pts[a][1], h, 0, 0, 1, 0, 0, pts[b][0], pts[b][1], h, 0, 0, 1, 0, 0, pts[c][0], pts[c][1], h, 0, 0, 1, 0, 0);
      out.push(pts[a][0], pts[a][1], -h, 0, 0, -1, 0, 0, pts[c][0], pts[c][1], -h, 0, 0, -1, 0, 0, pts[b][0], pts[b][1], -h, 0, 0, -1, 0, 0);
    }
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length];
      const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1;
      const n = [dy / l, -dx / l, 0];
      out.push(p[0], p[1], h, ...n, 0, 0, q[0], q[1], h, ...n, 0, 0, q[0], q[1], -h, ...n, 0, 0);
      out.push(p[0], p[1], h, ...n, 0, 0, q[0], q[1], -h, ...n, 0, 0, p[0], p[1], -h, ...n, 0, 0);
    }
    return out;
  }
  function transform(arr, yaw, dx, dy, dz) {
    const c = Math.cos(yaw), s = Math.sin(yaw), out = arr.slice();
    for (let i = 0; i < out.length; i += 8) {
      const x = arr[i], z = arr[i + 2], nx = arr[i + 3], nz = arr[i + 5];
      out[i] = c * x + s * z + dx; out[i + 1] = arr[i + 1] + dy; out[i + 2] = -s * x + c * z + dz;
      out[i + 3] = c * nx + s * nz; out[i + 5] = -s * nx + c * nz;
    }
    return out;
  }

  const SEG = 44;
  const BASE = [[0, 0], [0.36, 0], [0.37, 0.025], [0.37, 0.05], [0.35, 0.075], [0.31, 0.09], [0.32, 0.115], [0.29, 0.14], [0.26, 0.16]];
  const geo = {};
  geo[1] = lathe([...BASE, [0.22, 0.2], [0.15, 0.29], [0.11, 0.41], [0.17, 0.45], [0.17, 0.48], [0.1, 0.51],
    ...sphereProfile(0.155, 0.635, -1.15, Math.PI / 2, 14)], SEG);
  geo[4] = lathe([...BASE, [0.25, 0.22], [0.21, 0.32], [0.19, 0.66], [0.25, 0.7], [0.26, 0.74], [0.25, 0.77], [0.25, 0.9], [0.18, 0.9], [0.18, 0.84], [0, 0.84]], SEG)
    .concat(...[0, 1, 2, 3, 4, 5].map((i) => transform(box(0.1, 0.12, 0.13, 0.215, 0.95, 0), (i * Math.PI) / 3 + 0.26, 0, 0, 0)));
  geo[3] = lathe([...BASE, [0.22, 0.21], [0.14, 0.33], [0.1, 0.66], [0.2, 0.7], [0.2, 0.735], [0.12, 0.76], [0.11, 0.78],
    [0.15, 0.83], [0.172, 0.9], [0.165, 0.97], [0.13, 1.04], [0.075, 1.1], [0.03, 1.13], ...sphereProfile(0.058, 1.18, -1.0, Math.PI / 2, 8)], SEG);
  geo[5] = lathe([...BASE, [0.25, 0.22], [0.16, 0.35], [0.11, 0.74], [0.21, 0.8], [0.21, 0.845], [0.13, 0.87], [0.17, 0.98],
    [0.215, 1.08], [0.2, 1.11], [0.12, 1.13], [0.07, 1.17], ...sphereProfile(0.075, 1.235, -0.9, Math.PI / 2, 10)], SEG)
    .concat(...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => transform(lathe(sphereProfile(0.042, 0, -Math.PI / 2, Math.PI / 2, 8), 12), (i * Math.PI) / 4, 0.205 * Math.cos((i * Math.PI) / 4), 1.115, -0.205 * Math.sin((i * Math.PI) / 4))));
  geo[6] = lathe([...BASE, [0.26, 0.22], [0.17, 0.36], [0.12, 0.84], [0.225, 0.9], [0.225, 0.945], [0.14, 0.97], [0.185, 1.12], [0.2, 1.18], [0.13, 1.21], [0, 1.22]], SEG)
    .concat(box(0.065, 0.27, 0.065, 0, 1.33, 0), box(0.2, 0.065, 0.065, 0, 1.36, 0));
  const KNIGHT_OUTLINE = [[-0.22, 0.2], [0.2, 0.2], [0.22, 0.3], [0.17, 0.42], [0.2, 0.5], [0.3, 0.56], [0.38, 0.63], [0.4, 0.72],
    [0.35, 0.8], [0.25, 0.84], [0.2, 0.92], [0.16, 1.02], [0.1, 1.08], [0.05, 0.98], [-0.04, 1.0], [-0.13, 0.94],
    [-0.2, 0.82], [-0.25, 0.65], [-0.27, 0.45], [-0.26, 0.3]];
  geo[2] = lathe([...BASE, [0.27, 0.2], [0, 0.21]], SEG).concat(extrude(KNIGHT_OUTLINE, 0.25));

  geo.tile = box(1, 0.1, 1, 0, -0.05, 0);
  geo.frame = box(9.4, 0.24, 9.4, 0, -0.13, 0);
  geo.table = box(46, 0.2, 46, 0, -0.35, 0);
  geo.overlay = box(0.98, 0.012, 0.98, 0, 0.004, 0);
  geo.dot = lathe([[0, 0], [0.13, 0], [0.13, 0.02], [0, 0.02]], 24);
  geo.ring = lathe([[0.4, 0.01], [0.47, 0.01], [0.47, 0.03], [0.4, 0.03], [0.4, 0.01]], 40);

  const meshes = {};
  for (const k of Object.keys(geo)) {
    const data = new Float32Array(geo[k]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    meshes[k] = { buf, count: data.length / 8 };
  }

  // ---------------------------------------------------------------- shaders
  const VS = `
    attribute vec3 aPos; attribute vec3 aNrm; attribute vec2 aUV;
    uniform mat4 uModel, uViewProj, uLightVP; uniform mat3 uNormal;
    varying vec3 vWorld; varying vec3 vNrm; varying vec4 vLight; varying vec2 vUV;
    void main() {
      vec4 w = uModel * vec4(aPos, 1.0);
      vWorld = w.xyz; vNrm = uNormal * aNrm; vLight = uLightVP * w; vUV = aUV;
      gl_Position = uViewProj * w;
    }`;
  const FS = `
    precision mediump float;
    varying vec3 vWorld; varying vec3 vNrm; varying vec4 vLight; varying vec2 vUV;
    uniform vec3 uColor, uEmissive, uEye, uLightDir;
    uniform float uAlpha, uGloss, uSpec, uShadowOn, uTexel, uUseTex, uGrain, uGrainDir;
    uniform sampler2D uShadowMap, uTex;
    float unpack(vec4 c) { return dot(c, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0)); }
    float shadow() {
      if (uShadowOn < 0.5) return 1.0;
      vec3 p = vLight.xyz / vLight.w * 0.5 + 0.5;
      if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
      float s = 0.0;
      for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) {
        float d = unpack(texture2D(uShadowMap, p.xy + vec2(float(x), float(y)) * uTexel));
        s += (p.z - 0.002 > d) ? 0.0 : 1.0;
      }
      return mix(0.35, 1.0, s / 9.0);
    }
    void main() {
      vec3 n = normalize(vNrm);
      vec3 v = normalize(uEye - vWorld);
      if (dot(n, v) < 0.0) n = -n;
      vec3 base = uColor;
      if (uUseTex > 0.5) base = pow(texture2D(uTex, vUV).rgb, vec3(2.2));
      if (uGrain > 0.0) {
        float a = uGrainDir > 0.5 ? vWorld.x : vWorld.z, b = uGrainDir > 0.5 ? vWorld.z : vWorld.x;
        float g = sin(a * 2.0 + sin(b * 21.0) * 0.7 + sin(b * 57.0 + a) * 0.25);
        base *= 1.0 + g * 0.07 * uGrain;
      }
      vec3 L = normalize(uLightDir);
      float sh = shadow();
      float ndl = max(dot(n, L), 0.0);
      vec3 h = normalize(L + v);
      float spec = pow(max(dot(n, h), 0.0), uGloss) * uSpec;
      float fill = max(dot(n, normalize(vec3(0.7, 0.45, -0.6))), 0.0) * 0.28;
      vec3 amb = mix(vec3(0.09, 0.065, 0.055), vec3(0.34, 0.31, 0.33), n.y * 0.5 + 0.5);
      float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0) * uSpec;
      vec3 key = vec3(1.0, 0.92, 0.82) * 1.35;
      vec3 col = base * (amb + key * ndl * sh + vec3(0.7, 0.8, 1.0) * fill) + key * spec * sh + vec3(0.55, 0.5, 0.48) * fres * 0.35 + uEmissive;
      col = vec3(1.0) - exp(-col * 1.15);
      gl_FragColor = vec4(pow(col, vec3(1.0 / 2.2)), uAlpha);
    }`;
  const SVS = `
    attribute vec3 aPos; uniform mat4 uModel, uLightVP;
    void main() { gl_Position = uLightVP * uModel * vec4(aPos, 1.0); }`;
  const SFS = `
    precision highp float;
    void main() {
      vec4 e = fract(vec4(1.0, 255.0, 65025.0, 16581375.0) * gl_FragCoord.z);
      e -= e.yzww * vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0);
      gl_FragColor = e;
    }`;
  function program(vs, fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.bindAttribLocation(p, 0, 'aPos'); gl.bindAttribLocation(p, 1, 'aNrm'); gl.bindAttribLocation(p, 2, 'aUV');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  const main = program(VS, FS);
  const depth = program(SVS, SFS);

  // Shadow map (depth packed into RGBA; works on every WebGL1 device).
  const SHADOW = 2048;
  const shadowTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, shadowTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SHADOW, SHADOW, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const shadowFB = gl.createFramebuffer();
  const shadowRB = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, shadowRB);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, SHADOW, SHADOW);
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, shadowTex, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, shadowRB);
  const shadowOk = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  const LIGHT_DIR = V.norm([-0.5, 1.0, 0.42]);
  const lightVP = mul(ortho(-7.2, 7.2, -7.2, 7.2, 2, 40), lookAt(V.scale(LIGHT_DIR, 20), [0, 0, 0], [0, 1, 0]));

  // Frame texture with coordinates, redrawn per board theme.
  const frameTex = gl.createTexture();
  let labelSide = 'white';
  function drawFrameTexture(theme) {
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const g = c.getContext('2d');
    g.fillStyle = theme.frame; g.fillRect(0, 0, 1024, 1024);
    const px = (x) => (x / 9.4 + 0.5) * 1024;
    g.strokeStyle = theme.frameLine; g.lineWidth = 3;
    g.strokeRect(px(-4.62), px(-4.62), px(4.62) - px(-4.62), px(4.62) - px(-4.62));
    g.fillStyle = theme.label;
    g.font = '600 34px Georgia, "Times New Roman", serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const write = (text, x, z, rot) => { g.save(); g.translate(px(x), px(z)); g.rotate(rot); g.fillText(text, 0, 0); g.restore(); };
    const black = labelSide === 'black';
    for (let i = 0; i < 8; i++) {
      if (black) { write('abcdefgh'[i], i - 3.5, -4.36, Math.PI); write(String(i + 1), 4.36, 3.5 - i, Math.PI); }
      else { write('abcdefgh'[i], i - 3.5, 4.36, 0); write(String(i + 1), -4.36, 3.5 - i, 0); }
    }
    gl.bindTexture(gl.TEXTURE_2D, frameTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  // ------------------------------------------------------------------ state
  const BOARD_THEMES = {
    walnut: { name: 'Walnut & Maple', light: '#ddb98c', dark: '#6e4530', frame: '#3a2419', frameLine: '#8c6a4c', label: '#e8d3b4', table: '#1d1411', grain: 1 },
    cocoa: { name: 'Cocoa & Cream', light: '#ecdfca', dark: '#7a4a3a', frame: '#2c1b15', frameLine: '#a2705a', label: '#f2e3cb', table: '#181010', grain: 0.6 },
    marble: { name: 'Night Marble', light: '#d9d9dd', dark: '#4f5a66', frame: '#262a31', frameLine: '#7c8794', label: '#dfe3ea', table: '#121418', grain: 0 },
  };
  const PIECE_THEMES = {
    tempered: { name: 'Tempered', white: '#efe2cb', black: '#3a2218', wGloss: 50, bGloss: 90, wSpec: 0.45, bSpec: 0.8 },
    ruby: { name: 'Ruby & Pearl', white: '#f1ece6', black: '#7a1630', wGloss: 70, bGloss: 110, wSpec: 0.6, bSpec: 0.9 },
    classic: { name: 'Boxwood & Ebony', white: '#e2c896', black: '#1f1c1d', wGloss: 35, bGloss: 70, wSpec: 0.35, bSpec: 0.7 },
  };
  let boardTheme = BOARD_THEMES.walnut, pieceTheme = PIECE_THEMES.tempered;
  let quality = 'high', animations = true;
  let sprites = [];
  let highlights = {};
  let raf = 0;
  const cam = { yaw: 0, pitch: 0.95, dist: 13.2, tYaw: 0, tPitch: 0.95, tDist: 13.2 };
  const fov = (40 * Math.PI) / 180;
  const tileJitter = Array.from({ length: 64 }, (_, i) => 1 + (((i * 2654435761) >>> 0) % 1000 / 1000 - 0.5) * 0.06);

  const sqX = (sq) => (sq & 7) - 3.5;
  const sqZ = (sq) => 3.5 - (sq >> 3);

  function makeSprite(piece, sq) {
    return { piece, sq, x: sqX(sq), z: sqZ(sq), y: 0, scale: 1, alpha: 1, tilt: 0, yaw: baseYaw(piece, sq), anim: null };
  }
  function baseYaw(piece, sq) {
    if (Math.abs(piece) === 2) return piece > 0 ? Math.PI : 0;
    return ((sq * 37) % 11) * 0.12; // slight natural variation, never affects play
  }

  // ------------------------------------------------------------------ drawing
  function eyePos() {
    const cp = Math.cos(cam.pitch);
    return [Math.sin(cam.yaw) * cp * cam.dist, Math.sin(cam.pitch) * cam.dist, Math.cos(cam.yaw) * cp * cam.dist];
  }

  function bindMesh(mesh, withNormals) {
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buf);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(0);
    if (withNormals) {
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12); gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24); gl.enableVertexAttribArray(2);
    } else {
      gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2);
    }
  }

  function drawList() {
    const list = [];
    const tableC = lin(boardTheme.table);
    list.push({ mesh: 'table', m: model(0, 0, 0, 0, 0, 1), color: tableC, gloss: 20, spec: 0.08, caster: false });
    list.push({ mesh: 'frame', m: model(0, 0, 0, 0, 0, 1), tex: true, gloss: 60, spec: 0.35, caster: true });
    const light = lin(boardTheme.light), dark = lin(boardTheme.dark);
    for (let sq = 0; sq < 64; sq++) {
      const isLight = ((sq >> 3) + (sq & 7)) % 2 === 1;
      const base = isLight ? light : dark;
      const j = tileJitter[sq];
      list.push({ mesh: 'tile', m: model(sqX(sq), 0, sqZ(sq), 0, 0, 1), color: base.map((c) => c * j), gloss: 70, spec: boardTheme.grain ? 0.25 : 0.55,
        grain: boardTheme.grain, grainDir: (sq + (sq >> 3)) % 2, caster: false });
    }
    const pw = lin(pieceTheme.white), pb = lin(pieceTheme.black);
    for (const s of sprites) {
      if (s.alpha <= 0.01) continue;
      const white = s.piece > 0;
      list.push({ mesh: Math.abs(s.piece), m: model(s.x, s.y, s.z, s.yaw, s.tilt, s.scale), color: white ? pw : pb,
        gloss: white ? pieceTheme.wGloss : pieceTheme.bGloss, spec: white ? pieceTheme.wSpec : pieceTheme.bSpec,
        alpha: s.alpha, caster: true, emissive: s.glow ? [s.glow * 0.25, s.glow * 0.02, s.glow * 0.06] : null });
    }
    return list;
  }

  function overlayList() {
    const out = [];
    const h = highlights;
    const sq = (s, color, alpha) => out.push({ mesh: 'overlay', m: model(sqX(s), 0, sqZ(s), 0, 0, 1), color: lin(color), alpha, emissive: lin(color).map((c) => c * 0.35) });
    if (h.lastFrom >= 0) sq(h.lastFrom, '#e3b25a', 0.32);
    if (h.lastTo >= 0) sq(h.lastTo, '#e3b25a', 0.42);
    if (h.hintFrom >= 0) sq(h.hintFrom, '#3fc6b4', 0.5);
    if (h.hintTo >= 0) sq(h.hintTo, '#3fc6b4', 0.6);
    if (h.check >= 0) sq(h.check, '#ff3b30', 0.6);
    if (h.selected >= 0) sq(h.selected, '#c2335e', 0.6);
    if (h.cursor >= 0) sq(h.cursor, '#9ad0ff', 0.35);
    for (const t of h.targets || []) out.push({ mesh: 'dot', m: model(sqX(t), 0.004, sqZ(t), 0, 0, 1), color: lin('#c2335e'), alpha: 0.85, emissive: lin('#c2335e').map((c) => c * 0.4) });
    for (const t of h.captures || []) out.push({ mesh: 'ring', m: model(sqX(t), 0, sqZ(t), 0, 0, 1), color: lin('#c2335e'), alpha: 0.9, emissive: lin('#c2335e').map((c) => c * 0.4) });
    return out;
  }

  function render() {
    const w = canvas.width, h = canvas.height;
    const list = drawList();
    const shadowsOn = quality === 'high' && shadowOk;
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    if (shadowsOn) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB);
      gl.viewport(0, 0, SHADOW, SHADOW);
      gl.clearColor(1, 1, 1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(depth.p);
      gl.uniformMatrix4fv(depth.u.uLightVP, false, lightVP);
      for (const d of list) {
        if (!d.caster || (d.alpha !== undefined && d.alpha < 0.5)) continue;
        bindMesh(meshes[d.mesh], false);
        gl.uniformMatrix4fv(depth.u.uModel, false, d.m);
        gl.drawArrays(gl.TRIANGLES, 0, meshes[d.mesh].count);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    gl.viewport(0, 0, w, h);
    const bg = lin(boardTheme.table).map((c) => Math.pow(c * 0.55, 1 / 2.2));
    gl.clearColor(bg[0], bg[1], bg[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const eye = eyePos();
    const viewProj = mul(perspective(fov, w / Math.max(1, h), 0.5, 120), lookAt(eye, [0, 0, 0], [0, 1, 0]));
    const u = main.u;
    gl.useProgram(main.p);
    gl.uniformMatrix4fv(u.uViewProj, false, viewProj);
    gl.uniformMatrix4fv(u.uLightVP, false, lightVP);
    gl.uniform3fv(u.uEye, eye);
    gl.uniform3fv(u.uLightDir, LIGHT_DIR);
    gl.uniform1f(u.uShadowOn, shadowsOn ? 1 : 0);
    gl.uniform1f(u.uTexel, 1 / SHADOW);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, shadowTex); gl.uniform1i(u.uShadowMap, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, frameTex); gl.uniform1i(u.uTex, 1);

    const draw = (d) => {
      bindMesh(meshes[d.mesh], true);
      gl.uniformMatrix4fv(u.uModel, false, d.m);
      gl.uniformMatrix3fv(u.uNormal, false, normalMat(d.m));
      gl.uniform3fv(u.uColor, d.color || [1, 1, 1]);
      gl.uniform3fv(u.uEmissive, d.emissive || [0, 0, 0]);
      gl.uniform1f(u.uAlpha, d.alpha === undefined ? 1 : d.alpha);
      gl.uniform1f(u.uGloss, d.gloss || 40);
      gl.uniform1f(u.uSpec, d.spec === undefined ? 0.3 : d.spec);
      gl.uniform1f(u.uUseTex, d.tex ? 1 : 0);
      gl.uniform1f(u.uGrain, quality === 'high' ? d.grain || 0 : 0);
      gl.uniform1f(u.uGrainDir, d.grainDir || 0);
      gl.drawArrays(gl.TRIANGLES, 0, meshes[d.mesh].count);
    };
    const opaque = list.filter((d) => d.alpha === undefined || d.alpha >= 0.999);
    const faded = list.filter((d) => d.alpha !== undefined && d.alpha < 0.999);
    opaque.forEach(draw);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    overlayList().forEach(draw);
    gl.depthMask(true);
    faded.forEach(draw);
    gl.disable(gl.BLEND);
  }

  // --------------------------------------------------------------- animation
  function step(now) {
    let busy = false;
    for (const k of ['yaw', 'pitch', 'dist']) {
      const t = 't' + k[0].toUpperCase() + k.slice(1);
      const d = cam[t] - cam[k];
      if (Math.abs(d) > 0.0005) { cam[k] += d * 0.14; busy = true; } else cam[k] = cam[t];
    }
    for (const s of sprites) {
      const a = s.anim;
      if (!a) continue;
      const t = Math.min(1, Math.max(0, (now - a.start) / a.dur));
      const e = ease(t);
      if (a.type === 'move') {
        s.x = a.fx + (a.tx - a.fx) * e; s.z = a.fz + (a.tz - a.fz) * e;
        s.y = Math.sin(Math.PI * t) * a.arc;
        if (t >= 1 && a.promoteTo) s.piece = a.promoteTo;
      } else if (a.type === 'capture') {
        s.scale = 1 - 0.75 * e; s.alpha = 1 - e; s.y = -0.15 * e; s.yaw += 0.08;
      } else if (a.type === 'topple') {
        s.tilt = a.to * (1 - Math.pow(1 - t, 3));
      } else if (a.type === 'glow') {
        s.glow = Math.sin(Math.PI * Math.min(1, t * 2)) * 1.0;
      }
      if (t < 1) busy = true;
      else { s.anim = null; if (a.done) a.done(); }
    }
    sprites = sprites.filter((s) => !(s.dead && !s.anim));
    return busy;
  }

  function frame(now) {
    raf = 0;
    const busy = step(now);
    render();
    if (busy) requestRender();
  }
  function requestRender() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  // ----------------------------------------------------------------- input
  const pointers = new Map();
  let drag = null, pinch = 0;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1) drag = { x: e.clientX, y: e.clientY, moved: false };
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); drag = null; }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) cam.tDist = Math.min(22, Math.max(8, cam.tDist * (pinch / d)));
      pinch = d; requestRender();
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 7) return;
    drag.moved = true;
    cam.tYaw -= dx * 0.008; cam.tPitch = Math.min(1.54, Math.max(0.42, cam.tPitch + dy * 0.006));
    cam.yaw = cam.tYaw; cam.pitch = cam.tPitch;
    drag.x = e.clientX; drag.y = e.clientY;
    requestRender();
  });
  const end = (e) => {
    pointers.delete(e.pointerId);
    if (drag && !drag.moved && pointers.size === 0) {
      const sq = pick(e.clientX, e.clientY);
      if (sq >= 0) opts.onSquare(sq);
    }
    if (pointers.size === 0) { drag = null; pinch = 0; }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); drag = null; pinch = 0; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    cam.tDist = Math.min(22, Math.max(8, cam.tDist * (1 + Math.sign(e.deltaY) * 0.08)));
    requestRender();
  }, { passive: false });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); opts.onContextLost(); });

  function pick(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const nx = ((clientX - r.left) / r.width) * 2 - 1, ny = 1 - ((clientY - r.top) / r.height) * 2;
    const eye = eyePos();
    const f = V.norm(V.sub([0, 0, 0], eye)), right = V.norm(V.cross(f, [0, 1, 0])), up = V.cross(right, f);
    const t = Math.tan(fov / 2);
    const dir = V.add(f, V.add(V.scale(right, nx * t * (r.width / r.height)), V.scale(up, ny * t)));
    if (dir[1] >= 0) return -1;
    const k = -eye[1] / dir[1];
    const x = eye[0] + dir[0] * k, z = eye[2] + dir[2] * k;
    const file = Math.floor(x + 4), rank = Math.floor(4 - z);
    return file >= 0 && file < 8 && rank >= 0 && rank < 8 ? rank * 8 + file : -1;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    // Keep the whole board in view on narrow screens.
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    cam.minDist = aspect < 1 ? 14 / Math.max(0.62, aspect) : 13.2;
    if (cam.tDist < cam.minDist * 0.94) cam.tDist = cam.minDist;
    requestRender();
  }
  new ResizeObserver(resize).observe(canvas);

  drawFrameTexture(boardTheme);

  // ------------------------------------------------------------------- API
  return {
    BOARD_THEMES, PIECE_THEMES,
    setBoard(pieces) {
      sprites = pieces.map(([sq, piece]) => makeSprite(piece, sq));
      requestRender();
    },
    setHighlights(h) { highlights = h; requestRender(); },
    setTheme(board, piece) {
      if (BOARD_THEMES[board]) { boardTheme = BOARD_THEMES[board]; drawFrameTexture(boardTheme); }
      if (PIECE_THEMES[piece]) pieceTheme = PIECE_THEMES[piece];
      requestRender();
    },
    setQuality(q) { quality = q; resize(); },
    setAnimations(on) { animations = on; },
    // view: 'white' | 'black'; preset: 'player' | 'top'
    setView(side, preset, instant) {
      if (side !== labelSide) { labelSide = side; drawFrameTexture(boardTheme); }
      const narrow = (cam.minDist || 13.2) > 13.2;
      cam.tYaw = side === 'black' ? Math.PI : 0;
      cam.tPitch = preset === 'top' ? 1.54 : narrow ? 1.15 : 0.95;
      cam.tDist = preset === 'top' ? Math.max(12.5, (cam.minDist || 13.2) * 0.95) : (cam.minDist || 13.2);
      // Take the short way round.
      while (cam.tYaw - cam.yaw > Math.PI) cam.tYaw -= Math.PI * 2;
      while (cam.yaw - cam.tYaw > Math.PI) cam.tYaw += Math.PI * 2;
      if (instant || !animations) { cam.yaw = cam.tYaw; cam.pitch = cam.tPitch; cam.dist = cam.tDist; }
      requestRender();
    },
    // info from Game.play(). Calls done() once the pieces have settled.
    animateMove(info, done) {
      const now = performance.now();
      const mover = sprites.find((s) => s.sq === info.from && !s.dead);
      const victim = info.capturedSq >= 0 ? sprites.find((s) => s.sq === info.capturedSq && s !== mover && !s.dead) : null;
      const finish = () => { if (done) done(); };
      if (!animations || !mover) {
        if (victim) victim.dead = true;
        if (mover) { mover.sq = info.to; mover.x = sqX(info.to); mover.z = sqZ(info.to); if (info.promo) mover.piece = info.promo; }
        if (info.rook) { const r = sprites.find((s) => s.sq === info.rook[0] && !s.dead); if (r) { r.sq = info.rook[1]; r.x = sqX(r.sq); r.z = sqZ(r.sq); } }
        sprites = sprites.filter((s) => !s.dead);
        requestRender(); finish();
        return;
      }
      const knight = Math.abs(info.mover) === 2;
      const dist = Math.hypot(sqX(info.to) - mover.x, sqZ(info.to) - mover.z);
      const dur = 200 + Math.min(220, dist * 45) + (knight ? 80 : 0);
      mover.anim = { type: 'move', start: now, dur, fx: mover.x, fz: mover.z, tx: sqX(info.to), tz: sqZ(info.to),
        arc: knight ? 0.55 : 0.12, promoteTo: info.promo || 0, done: finish };
      mover.sq = info.to;
      if (victim) {
        victim.dead = true;
        victim.anim = { type: 'capture', start: now + dur * 0.55, dur: 320 };
      }
      if (info.rook) {
        const r = sprites.find((s) => s.sq === info.rook[0] && !s.dead);
        if (r) { r.anim = { type: 'move', start: now + 60, dur, fx: r.x, fz: r.z, tx: sqX(info.rook[1]), tz: sqZ(info.rook[1]), arc: 0.3 }; r.sq = info.rook[1]; }
      }
      requestRender();
    },
    // Result effects: the beaten king tips over; a draw makes both kings glow.
    celebrate(kind, loserSq, kingSqs) {
      const now = performance.now();
      if (kind === 'win' && loserSq >= 0) {
        const k = sprites.find((s) => s.sq === loserSq && !s.dead);
        if (k) { k.anim = { type: 'topple', start: now + 150, dur: animations ? 900 : 1, to: 1.42 }; }
      } else if (kind === 'draw') {
        for (const sq of kingSqs || []) {
          const k = sprites.find((s) => s.sq === sq && !s.dead);
          if (k) k.anim = { type: 'glow', start: now, dur: animations ? 1600 : 1 };
        }
      }
      requestRender();
    },
    requestRender,
    resize,
  };
}
