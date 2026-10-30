// Element effects for the 3D table. Each room has an element: when a piece is taken, a burst
// of fire, a lightning strike or a stone shatter plays on its square (3 s); when a game is
// won, a petal, fire or lightning storm sweeps the table (10 s). They play on top of the
// capture scenes and the equipped victory effect, and never change them.
//
// Kid-gentle by design: nothing is hurt or broken. The taken piece still bows and goes to
// its tray; the fire is a festival burst, the lightning a crown of light for the winner.
// Lightning flashes are spaced so the screen never brightens more than twice a second
// (well under the three-flashes-a-second photosensitivity limit).
//
// Cost: two point clouds, one ribbon mesh for bolts, a few flat rings, a crack decal and
// two instanced meshes (stone chips and petals). Every part is created once, up front, so
// its shader compiles with the room's and nothing is allocated while an effect plays.
// Counts scale with the table's performance level; Low graphics plays a lighter version.
function ChacklateElements(THREE, o) {
  const TAU = Math.PI * 2;
  const { scene, camera } = o;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const col = (h) => new THREE.Color(h);
  // how much of each effect to draw: 1 at full detail, about 0.4 on Low or a slow phone
  const amount = () => { const l = o.level(), r = o.rich(); return (r ? 1 : 0.5) * (l >= 4 ? 0.45 : l >= 3 ? 0.6 : l >= 1 ? 0.8 : 1); };
  const n = (v) => Math.max(1, Math.round(v * amount()));
  const group = new THREE.Group(); group.name = 'elements';
  scene.add(group);

  // ------------------------------------------------------------------ particles
  // shapes: 0 glow, 1 flame tongue, 2 smoke puff, 3 streak (turned along its motion), 4 chip
  const MAX = 1600;
  const parts = [];
  function cloud(additive, order) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX * 4), 4));
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(MAX), 1));
    g.setAttribute('shape', new THREE.BufferAttribute(new Float32Array(MAX), 1));
    g.setAttribute('rot', new THREE.BufferAttribute(new Float32Array(MAX), 1));
    g.setAttribute('vel', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    g.setDrawRange(0, 0);
    const m = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 600 }, aspect: { value: 1 } },
      vertexShader: `attribute vec4 color; attribute float size; attribute float shape; attribute float rot; attribute vec3 vel;
        uniform float scale; uniform float aspect; varying vec4 vC; varying float vS; varying float vR; varying float vSeed;
        void main() {
          vC = color; vS = shape; vSeed = rot * 7.13; vR = rot;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * scale / -mv.z;
          gl_Position = projectionMatrix * mv;
          if (shape > 2.5 && shape < 3.5) {
            vec4 q = projectionMatrix * modelViewMatrix * vec4(position + vel * 0.05, 1.0);
            vec2 d = (q.xy / q.w - gl_Position.xy / gl_Position.w) * vec2(aspect, 1.0);
            vR = atan(d.y, d.x);
          }
        }`,
      fragmentShader: `varying vec4 vC; varying float vS; varying float vR; varying float vSeed;
        void main() {
          vec2 d = gl_PointCoord - 0.5; d.y = -d.y;
          float c = cos(vR), s = sin(vR); d = vec2(c * d.x + s * d.y, -s * d.x + c * d.y);
          float a;
          if (vS < 0.5) { float l = length(d) * 2.0; a = exp(-l * l * 4.0); }
          else if (vS < 1.5) { vec2 q = d; q.x *= 1.0 + 3.2 * max(0.0, q.y + 0.12); a = smoothstep(0.42, 0.0, length(q + vec2(0.0, 0.08))); a *= a; }
          else if (vS < 2.5) { float k = sin(d.x * 14.0 + vSeed) * sin(d.y * 12.0 - vSeed * 1.3) * 0.07 + sin(d.x * 31.0 - vSeed * 2.0) * sin(d.y * 27.0 + vSeed) * 0.03; a = smoothstep(0.5, 0.1, length(d) + k); }
          else if (vS < 3.5) { a = smoothstep(0.5, 0.0, abs(d.x)) * smoothstep(0.07, 0.0, abs(d.y)); }
          else { a = step(abs(d.x) * 1.25 + abs(d.y) * 0.9 + sin(atan(d.y, d.x) * 3.0 + vSeed) * 0.05, 0.33); }
          if (a < 0.01) discard;
          gl_FragColor = vec4(vC.rgb, vC.a * a);
        }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false,
    });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false; p.renderOrder = order;
    group.add(p);
    return p;
  }
  const glowPts = cloud(true, 8), mattePts = cloud(false, 7);
  // A particle: position and velocity, born/life in ms, size from s0 to s1, colour through
  // c0 > c1 > c2, alpha a, g gravity (negative rises), drag per second, orb (circles a centre).
  function emit(p) {
    if (parts.length >= MAX) return null;
    const q = Object.assign({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, born: clock, life: 1000, s0: 0.1, s1: 0.1, a: 1, add: true, shape: 0, rot: 0, spin: 0, g: 0, drag: 1, floor: false, fadeIn: 0.06, flutter: 0 }, p);
    q.c0 = q.c0 || col('#ffffff'); q.c1 = q.c1 || q.c0; q.c2 = q.c2 || q.c1;
    parts.push(q);
    return q;
  }
  const C = {};
  const tone = (h) => C[h] || (C[h] = col(h));
  const tmpC = new THREE.Color();
  function stepParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (clock - p.born >= p.life) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      if (clock < p.born) continue;
      if (p.orb) {
        const b = p.orb;
        b.th += b.w * dt; b.r = Math.max(0.05, b.r + b.vr * dt);
        const nx = b.cx + Math.cos(b.th) * b.r, nz = b.cz + Math.sin(b.th) * b.r;
        p.vx = (nx - p.x) / Math.max(dt, 0.001); p.vz = (nz - p.z) / Math.max(dt, 0.001);
        p.x = nx; p.z = nz; p.vy -= p.g * dt; p.y += p.vy * dt;
      } else {
        p.vy -= p.g * dt;
        const d = Math.pow(p.drag, dt);
        p.vx *= d; p.vz *= d; if (p.g <= 0) p.vy *= d;
        if (p.flutter) { p.vx += Math.sin(clock / 260 + p.rot * 9) * p.flutter * dt; p.vz += Math.cos(clock / 310 + p.rot * 5) * p.flutter * dt; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.floor) {
          const fy = o.floorY(p.x, p.z) + 0.01;
          if (p.y < fy) { p.y = fy; p.vy *= -0.3; p.vx *= 0.55; p.vz *= 0.55; }
        }
      }
      p.rot += p.spin * dt;
    }
  }
  function upload() {
    const fill = (pts, add) => {
      const g = pts.geometry, A = g.attributes;
      const pos = A.position.array, cl = A.color.array, sz = A.size.array, sh = A.shape.array, rt = A.rot.array, vl = A.vel.array;
      let k = 0;
      for (const p of parts) {
        if (p.add !== add || clock < p.born) continue;
        const t = (clock - p.born) / p.life;
        const fade = Math.min(1, t / p.fadeIn) * (1 - t * t);
        if (t < 0.4) tmpC.copy(p.c0).lerp(p.c1, t / 0.4); else tmpC.copy(p.c1).lerp(p.c2, (t - 0.4) / 0.6);
        const boost = add ? 1.6 : p.hdr || 1;
        pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
        vl[k * 3] = p.vx; vl[k * 3 + 1] = p.vy; vl[k * 3 + 2] = p.vz;
        cl[k * 4] = tmpC.r * boost; cl[k * 4 + 1] = tmpC.g * boost; cl[k * 4 + 2] = tmpC.b * boost; cl[k * 4 + 3] = p.a * fade;
        sz[k] = p.s0 + (p.s1 - p.s0) * Math.sqrt(t); sh[k] = p.shape; rt[k] = p.rot;
        k++;
      }
      g.setDrawRange(0, k);
      for (const key of ['position', 'color', 'size', 'shape', 'rot', 'vel']) A[key].needsUpdate = true;
    };
    fill(glowPts, true); fill(mattePts, false);
  }

  // ------------------------------------------------------------------ lightning bolts
  // Each bolt is a jagged path (midpoint displacement) with a few branches, drawn as
  // camera-facing ribbons: a wide blue glow and a thin white core.
  const QUADS = 900;
  const boltGeo = new THREE.BufferGeometry();
  boltGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(QUADS * 12), 3));
  boltGeo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(QUADS * 8), 2));
  boltGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(QUADS * 16), 4));
  const idx = new Uint16Array(QUADS * 6);
  for (let i = 0; i < QUADS; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
  boltGeo.setIndex(new THREE.BufferAttribute(idx, 1));
  boltGeo.setDrawRange(0, 0);
  const boltMesh = new THREE.Mesh(boltGeo, new THREE.ShaderMaterial({
    vertexShader: `attribute vec4 color; varying vec4 vC; varying vec2 vUv; void main() { vC = color; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec4 vC; varying vec2 vUv; void main() { float k = 1.0 - vUv.x * vUv.x; gl_FragColor = vec4(vC.rgb, vC.a * k * k); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
  }));
  boltMesh.frustumCulled = false; boltMesh.renderOrder = 9;
  group.add(boltMesh);
  const bolts = [];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  function zig(a, b, rough, depth) {
    let pts = [a, b];
    for (let d = 0; d < depth; d++) {
      const next = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i - 1], q = pts[i], len = p.distanceTo(q);
        const m = p.clone().lerp(q, rnd(0.4, 0.6));
        m.x += rnd(-1, 1) * len * rough; m.z += rnd(-1, 1) * len * rough; m.y += rnd(-0.5, 0.5) * len * rough * 0.4;
        next.push(m, q);
      }
      pts = next;
    }
    return pts;
  }
  function shapeBolt(b) {
    b.paths = [{ pts: zig(b.from, b.to, 0.22, b.depth), w: 1 }];
    const main = b.paths[0].pts;
    for (let i = 0; i < b.branches; i++) {
      const at = main[Math.floor(rnd(0.15, 0.7) * main.length)];
      const len = at.distanceTo(b.to) * rnd(0.25, 0.5);
      const dir = V(rnd(-1, 1), -rnd(0.4, 1.2), rnd(-1, 1)).normalize();
      b.paths.push({ pts: zig(at, at.clone().addScaledVector(dir, len), 0.3, Math.max(2, b.depth - 2)), w: 0.45 });
    }
  }
  // from, to: Vector3; o.life ms, o.width, o.branches, o.color (glow), o.depth
  function bolt(from, to, opt) {
    opt = opt || {};
    const b = { from, to, born: clock, life: opt.life || 450, width: opt.width || 1, branches: opt.branches === undefined ? 3 : opt.branches,
      depth: opt.depth || 6, glow: tone(opt.color || '#4a7cff'), seed: Math.random() * 100, reshape: 0 };
    shapeBolt(b);
    bolts.push(b);
    return b;
  }
  const side = new THREE.Vector3(), seg = new THREE.Vector3(), eye = new THREE.Vector3();
  function drawBolts() {
    const A = boltGeo.attributes, pos = A.position.array, uv = A.uv.array, cl = A.color.array;
    let q = 0;
    for (let i = bolts.length - 1; i >= 0; i--) if (clock - bolts[i].born > bolts[i].life) bolts.splice(i, 1);
    for (const b of bolts) {
      const t = (clock - b.born) / b.life;
      if (t < 0) continue;
      // a quick re-shape keeps it crackling; it flickers bright-dim-bright and fades
      if (clock - b.reshape > 70) { b.reshape = clock; if (t > 0.2) shapeBolt(b); }
      const flick = t < 0.12 ? 1 : 0.55 + 0.45 * Math.abs(Math.sin(t * 31 + b.seed));
      const fade = flick * (1 - t * t);
      for (const path of b.paths) {
        for (const layer of [{ w: 0.36, c: b.glow, a: 0.6 }, { w: 0.07, c: tone('#dce8ff'), a: 1 }]) {
          const w = layer.w * b.width * path.w, P = path.pts;
          for (let s = 1; s < P.length && q < QUADS; s++) {
            const p0 = P[s - 1], p1 = P[s];
            seg.subVectors(p1, p0); eye.subVectors(camera.position, p0);
            side.crossVectors(seg, eye).normalize().multiplyScalar(w);
            const v = q * 12;
            pos[v] = p0.x - side.x; pos[v + 1] = p0.y - side.y; pos[v + 2] = p0.z - side.z;
            pos[v + 3] = p0.x + side.x; pos[v + 4] = p0.y + side.y; pos[v + 5] = p0.z + side.z;
            pos[v + 6] = p1.x - side.x; pos[v + 7] = p1.y - side.y; pos[v + 8] = p1.z - side.z;
            pos[v + 9] = p1.x + side.x; pos[v + 10] = p1.y + side.y; pos[v + 11] = p1.z + side.z;
            uv.set([-1, 0, 1, 0, -1, 1, 1, 1], q * 8);
            const boost = layer.c === b.glow ? 2.2 : 3;
            for (let j = 0; j < 4; j++) { cl[q * 16 + j * 4] = layer.c.r * boost; cl[q * 16 + j * 4 + 1] = layer.c.g * boost; cl[q * 16 + j * 4 + 2] = layer.c.b * boost; cl[q * 16 + j * 4 + 3] = layer.a * fade; }
            q++;
          }
        }
      }
    }
    boltGeo.setDrawRange(0, q * 6);
    A.position.needsUpdate = A.uv.needsUpdate = A.color.needsUpdate = true;
  }

  // ------------------------------------------------------------------ rings and the crack decal
  const flatGeo = new THREE.PlaneGeometry(1, 1); flatGeo.rotateX(-Math.PI / 2);
  const rings = [0, 1, 2, 3, 4].map(() => {
    const m = new THREE.Mesh(flatGeo, new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color() }, alpha: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 color; uniform float alpha; varying vec2 vUv; void main() { float r = length(vUv - 0.5) * 2.0; float a = smoothstep(0.45, 0.86, r) * smoothstep(1.0, 0.88, r); gl_FragColor = vec4(color * 2.0, a * alpha); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    }));
    m.visible = false; m.renderOrder = 7; m.userData = { born: 0, life: 0, R: 1 };
    group.add(m);
    return m;
  });
  function ring(x, y, z, color, R, life) {
    const m = rings.find((r) => !r.visible) || rings[0];
    m.position.set(x, y, z); m.material.uniforms.color.value.set(color);
    m.userData = { born: clock, life, R };
    m.visible = true;
  }
  function stepRings() {
    for (const m of rings) {
      if (!m.visible) continue;
      const t = (clock - m.userData.born) / m.userData.life;
      if (t >= 1) { m.visible = false; continue; }
      const s = 0.2 + m.userData.R * (1 - Math.pow(1 - t, 3));
      m.scale.set(s, 1, s);
      m.material.uniforms.alpha.value = 0.9 * (1 - t);
    }
  }
  // Cracks spread out from the square and fade: glowing at first, then dark.
  let crackTex = null;
  function cracks() {
    if (crackTex) return crackTex;
    const c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d');
    g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
    const line = (x, y, a, len, w, depth) => {
      g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
      let px = x, py = y;
      for (let s = 0; s < 8; s++) { a += rnd(-0.45, 0.45); px += Math.cos(a) * len / 8; py += Math.sin(a) * len / 8; g.lineTo(px, py); if (depth && Math.random() < 0.22) line(px, py, a + rnd(-1, 1), len * 0.45, w * 0.6, depth - 1); }
      g.stroke();
    };
    for (let i = 0; i < 11; i++) line(256, 256, (i / 11) * TAU + rnd(-0.2, 0.2), rnd(150, 240), rnd(4, 7), 2);
    const grd = g.createRadialGradient(256, 256, 0, 256, 256, 70);
    grd.addColorStop(0, 'rgba(255,255,255,0.85)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
    crackTex = new THREE.CanvasTexture(c);
    return crackTex;
  }
  const crack = new THREE.Mesh(flatGeo, new THREE.ShaderMaterial({
    uniforms: { map: { value: null }, glow: { value: new THREE.Color() }, dark: { value: new THREE.Color() }, k: { value: 0 }, alpha: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler2D map; uniform vec3 glow; uniform vec3 dark; uniform float k; uniform float alpha; varying vec2 vUv;
      void main() { float a = texture2D(map, vUv).r; if (a < 0.02) discard; gl_FragColor = vec4(mix(glow * 3.0, dark, k), a * alpha); }`,
    transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2,
  }));
  crack.visible = false; crack.renderOrder = 6; crack.userData = { born: 0, life: 0 };
  group.add(crack);
  function crackAt(x, z, glow, dark, size, life) {
    const u = crack.material.uniforms;
    if (!u.map.value) u.map.value = cracks();
    u.glow.value.set(glow); u.dark.value.set(dark);
    crack.position.set(x, o.floorY(x, z) + 0.03, z); crack.rotation.y = rnd(0, TAU);
    crack.userData = { born: clock, life, size };
    crack.visible = true;
  }
  function stepCrack() {
    if (!crack.visible) return;
    const d = crack.userData, t = (clock - d.born) / d.life;
    if (t >= 1) { crack.visible = false; return; }
    const s = d.size * (0.3 + 0.7 * smooth(0, 0.05, t));
    crack.scale.set(s, 1, s);
    const u = crack.material.uniforms;
    u.k.value = smooth(0.02, 0.3, t); u.alpha.value = 0.85 * (1 - smooth(0.6, 1, t));
  }

  // ------------------------------------------------------------------ stone chips and petals
  const chipMax = 70, petalMax = 600;
  const chips = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, flatShading: true }), chipMax);
  chips.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  chips.setColorAt(0, col('#ffffff'));
  chips.count = 0; chips.frustumCulled = false;
  const petalGeo = (() => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.5); s.quadraticCurveTo(0.55, -0.15, 0.32, 0.3); s.quadraticCurveTo(0.12, 0.55, 0, 0.42); s.quadraticCurveTo(-0.12, 0.55, -0.32, 0.3); s.quadraticCurveTo(-0.55, -0.15, 0, -0.5);
    const g = new THREE.ShapeGeometry(s, 3);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, (p.getX(i) * p.getX(i)) * 0.5 - p.getY(i) * 0.12);   // cupped
    g.computeVertexNormals();
    return g;
  })();
  const petals = new THREE.InstancedMesh(petalGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, side: THREE.DoubleSide, emissive: '#3a1a22' }), petalMax);
  petals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  petals.setColorAt(0, col('#ffffff'));
  petals.count = 0; petals.frustumCulled = false;
  group.add(chips, petals);
  const chipList = [], petalList = [];
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), Pv = new THREE.Vector3();
  function chip(x, y, z, vx, vy, vz, size, color, life) {
    if (chipList.length >= chipMax) return;
    chipList.push({ x, y, z, vx, vy, vz, size, color: tone(color), born: clock, life, rx: rnd(0, TAU), ry: rnd(0, TAU), rz: 0, sx: rnd(-9, 9), sy: rnd(-9, 9), rest: false });
  }
  function stepChips(dt) {
    let k = 0;
    for (let i = chipList.length - 1; i >= 0; i--) if (clock - chipList[i].born > chipList[i].life) chipList.splice(i, 1);
    for (const c of chipList) {
      const t = (clock - c.born) / c.life;
      if (!c.rest) {
        c.vy -= 9.8 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.rx += c.sx * dt; c.ry += c.sy * dt;
        const fy = o.floorY(c.x, c.z) + c.size * 0.7;
        if (c.y < fy) { c.y = fy; c.vy *= -0.35; c.vx *= 0.6; c.vz *= 0.6; c.sx *= 0.6; c.sy *= 0.6; if (Math.abs(c.vy) < 0.4) c.rest = Math.hypot(c.vx, c.vz) < 0.3; }
      }
      const s = c.size * (1 - smooth(0.75, 1, t));
      E.set(c.rx, c.ry, c.rz); Q.setFromEuler(E); S.set(s, s * 0.8, s); Pv.set(c.x, c.y, c.z);
      M.compose(Pv, Q, S); chips.setMatrixAt(k, M); chips.setColorAt(k, c.color); k++;
    }
    chips.count = k;
    if (k) { chips.instanceMatrix.needsUpdate = true; chips.instanceColor.needsUpdate = true; }
  }
  // A petal rides the storm's wind (wind(p) fills p.wx, p.wy, p.wz), fluttering and tumbling,
  // and rests where it lands until the storm ends.
  function petal(x, y, z, vx, vy, vz, color, size, life) {
    if (petalList.length >= petalMax) return;
    const c = tone(color).clone().offsetHSL(rnd(-0.01, 0.01), 0, rnd(-0.06, 0.06));
    petalList.push({ x, y, z, vx, vy, vz, wx: 0, wy: 0, wz: 0, color: c, size, born: clock, life, rx: rnd(0, TAU), ry: rnd(0, TAU), rz: rnd(0, TAU),
      sx: rnd(-4, 4), sy: rnd(-3, 3), sz: rnd(-5, 5), seed: rnd(0, 100), rest: false, landY: 0 });
  }
  function stepPetals(dt, wind) {
    let k = 0;
    for (let i = petalList.length - 1; i >= 0; i--) if (clock - petalList[i].born > petalList[i].life) petalList.splice(i, 1);
    for (const p of petalList) {
      const t = (clock - p.born) / p.life;
      if (!p.rest) {
        if (wind) wind(p); else { p.wx = 0; p.wy = -0.5; p.wz = 0; }
        const k2 = Math.min(1, dt * 2.4);
        p.vx += (p.wx - p.vx) * k2; p.vz += (p.wz - p.vz) * k2; p.vy += (p.wy - p.vy) * k2 - 0.7 * dt;
        p.vx += Math.sin(clock / 240 + p.seed) * 1.4 * dt; p.vz += Math.cos(clock / 300 + p.seed) * 1.4 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.rx += p.sx * dt; p.ry += p.sy * dt; p.rz += p.sz * dt;
        const fy = o.floorY(p.x, p.z) + 0.015;
        if (p.y < fy) {
          if (p.wy > 0.6) { p.y = fy; p.vy = Math.abs(p.vy) * 0.3; }
          else { p.y = fy; p.rest = true; p.rx = -Math.PI / 2 + rnd(-0.25, 0.25); p.rz = 0; }
        }
      }
      const s = p.size * (1 - smooth(0.88, 1, t)) * Math.min(1, (clock - p.born) / 150);
      E.set(p.rx, p.ry, p.rz); Q.setFromEuler(E); S.set(s, s, s); Pv.set(p.x, p.y, p.z);
      M.compose(Pv, Q, S); petals.setMatrixAt(k, M); petals.setColorAt(k, p.color); k++;
    }
    petals.count = k;
    if (k) { petals.instanceMatrix.needsUpdate = true; petals.instanceColor.needsUpdate = true; }
  }

  // ------------------------------------------------------------------ the effects
  // An effect is { kind, start, dur, run(e, t, dt) } and lights the table through e.light:
  // { point: [x, y, z], color, power, expo (sharp flash), dim (0..1, the storm's darkness), tint }.
  let clock = 0;
  const effects = [];
  const once = (e, key, at, t, fn) => { if (t >= at && !e.fired.has(key)) { e.fired.add(key); fn(); } };
  // emitting n per second, carried over between frames
  const rate = (e, key, perSec, dt) => { e.acc[key] = (e.acc[key] || 0) + perSec * amount() * dt; const k = Math.floor(e.acc[key]); e.acc[key] -= k; return k; };
  // a tongue of flame: a vivid body that holds its colour on a bright board, and now and then
  // a hot glowing heart
  const flame = (x, y, z, vy, sz, life) => {
    sz *= 2;   // the tongue fills the middle of its sprite
    const vx = rnd(-0.3, 0.3), vz = rnd(-0.3, 0.3);
    const f = emit({ x, y, z, vx, vy, vz, life, s0: sz, s1: sz * rnd(1.6, 2.4), shape: 1, add: false, a: 0.95, hdr: 1.25,
      c0: tone('#ffd860'), c1: tone('#ff6a10'), c2: tone('#5a1004'), g: -0.9, drag: 0.45, rot: rnd(-0.25, 0.25), fadeIn: 0.1 });
    if (Math.random() < 0.4) emit({ x, y, z, vx, vy, vz, life: life * 0.7, s0: sz * 0.7, s1: sz, shape: 1, a: 0.55, c0: tone('#fff0a0'), c1: tone('#ffb040'), c2: tone('#ff6010'), g: -1.2, drag: 0.45, rot: rnd(-0.2, 0.2), fadeIn: 0.1 });
    return f;
  };
  const ember = (x, y, z, sp, up, life, far) => {
    const a = rnd(0, TAU);
    return emit({ x, y, z, vx: Math.cos(a) * sp, vy: up, vz: Math.sin(a) * sp, life, s0: far ? 0.14 : 0.32, s1: 0.1, shape: far ? 0 : 3,
      c0: tone('#fff2b8'), c1: tone('#ffab40'), c2: tone('#ff5a14'), g: far ? -0.25 : 3.2, drag: far ? 0.5 : 0.55, floor: !far, flutter: far ? 2.2 : 0, rot: rnd(0, 1) });
  };
  const smoke = (x, y, z, color, a, s0, s1, life, spread) => emit({ x, y, z, vx: rnd(-1, 1) * (spread || 0.3), vy: rnd(0.4, 1.1), vz: rnd(-1, 1) * (spread || 0.3), life, s0, s1, shape: 2,
    add: false, a, c0: tone(color), c1: tone(color), c2: tone(color), drag: 0.6, g: 0, rot: rnd(0, 6), spin: rnd(-0.6, 0.6), fadeIn: 0.15 });
  const spark = (x, y, z, sp, up, color, life) => {
    const a = rnd(0, TAU), s = rnd(0.3, 1) * sp;
    return emit({ x, y, z, vx: Math.cos(a) * s, vy: rnd(0.3, 1) * up, vz: Math.sin(a) * s, life, s0: 0.14, s1: 0.06, shape: 3,
      c0: tone('#ffffff'), c1: tone(color), c2: tone(color), g: 6, drag: 0.5, floor: true, rot: rnd(0, 1) });
  };

  const STRIKES = {
    // A festival burst of fire: a fireball, a column of flame, embers flying wide, a wisp of smoke.
    fire: { dur: 3000, run(e, t, dt) {
      const { x, z } = e;
      once(e, 'boom', 0, t, () => {
        ring(x, 0.03, z, '#ffb050', 2.8, 700);
        for (let i = 0; i < n(56); i++) { const a = rnd(0, TAU), s = rnd(0.3, 1.3); const f = flame(x + rnd(-0.2, 0.2), rnd(0.1, 0.5), z + rnd(-0.2, 0.2), rnd(0.5, 2.2), rnd(0.7, 1.1), rnd(700, 1200)); if (f) { f.vx = Math.cos(a) * s; f.vz = Math.sin(a) * s; } }
        emit({ x, y: 0.6, z, life: 450, s0: 1.6, s1: 2.6, c0: tone('#ffb060'), c1: tone('#ff7a20'), c2: tone('#ff4a10'), a: 0.4 });
        for (let i = 0; i < n(140); i++) ember(x, 0.35, z, rnd(2.5, 7.5), rnd(1, 5.5), rnd(900, 2200));
        for (let i = 0; i < n(50); i++) ember(x, rnd(0.3, 1), z, rnd(3, 8), rnd(0.5, 2.5), rnd(2200, 2900), true);
      });
      if (t < 1400) for (let i = rate(e, 'col', 90 * (1 - t / 1400), dt); i > 0; i--) flame(x + rnd(-0.25, 0.25), 0.05, z + rnd(-0.25, 0.25), rnd(0.8, 1.9), rnd(0.45, 0.75), rnd(550, 900));
      once(e, 'smoke', 350, t, () => { for (let i = 0; i < n(16); i++) smoke(x + rnd(-0.3, 0.3), rnd(0.4, 1), z + rnd(-0.3, 0.3), '#3d2c22', 0.38, 0.5, 2.2, rnd(1700, 2500)); });
      e.light = { point: [x, 1.7, z], color: '#ff8a30', power: t < 1800 ? 30 * Math.exp(-t / 500) * (0.85 + 0.15 * Math.sin(t * 0.05)) : 0, expo: 0.12 * Math.exp(-t / 160), dim: 0.18 * (1 - smooth(600, 1800, t)), tint: '#ff9a50' };
      e.shake = 0.035 * Math.exp(-t / 220);
    } },
    // A bolt from the sky: a moment of gathering light, the strike, a ring of sparks, crackling
    // arcs on the square and a glowing crack that cools.
    lightning: { dur: 3000, run(e, t, dt) {
      const { x, z } = e, hit = V(x, 0.03, z);
      if (t < 200) for (let i = rate(e, 'charge', 260, dt); i > 0; i--) emit({ x, y: 0.4, z, life: 260, s0: 0.12, s1: 0.04, c0: tone('#cfe0ff'), c1: tone('#7aa4ff'), c2: tone('#5a7aff'), orb: { cx: x, cz: z, th: rnd(0, TAU), r: rnd(0.8, 1.4), w: 7, vr: -4.2 }, vy: rnd(-0.3, 0.6) });
      const strike = (key, at, opt, big) => once(e, key, at, t, () => {
        bolt(V(x + rnd(-1.6, 1.6), 10, z + rnd(-1.6, 1.6)), hit.clone(), opt);
        if (big) {
          ring(x, 0.03, z, '#bcd2ff', 3, 650);
          crackAt(x, z, '#8ab4ff', '#1c1a22', 2.4, 2700);
          for (let i = 0; i < n(130); i++) spark(x, 0.12, z, 7, 5, i % 3 ? '#8fb4ff' : '#e8f0ff', rnd(500, 1300));
          for (let i = 0; i < n(28); i++) emit({ x: x + rnd(-0.3, 0.3), y: rnd(0.1, 0.6), z: z + rnd(-0.3, 0.3), vx: rnd(-0.6, 0.6), vy: rnd(0.3, 1.4), vz: rnd(-0.6, 0.6), life: rnd(800, 1600), s0: rnd(0.12, 0.3), s1: 0.05, c0: tone('#e0ecff'), c1: tone('#7aa4ff'), c2: tone('#4a6aff'), drag: 0.5 });
        }
        e.flashAt = clock; e.flashBig = big ? 1 : 0.55;
      });
      strike('b1', 200, { life: 520, branches: 4, width: 1.2 }, true);
      strike('b2', 760, { life: 360, branches: 2, width: 0.8 }, false);
      once(e, 'b3', 1400, t, () => bolt(V(x + rnd(-1, 1), 8, z + rnd(-1, 1)), hit.clone(), { life: 300, branches: 1, width: 0.55 }));
      if (t > 450 && t < 2000 && t - (e.arcAt || 0) > 140) {
        e.arcAt = t;
        const a = rnd(0, TAU), r = rnd(0.3, 0.9);
        bolt(V(x + Math.cos(a) * 0.15, rnd(0.05, 0.3), z + Math.sin(a) * 0.15), V(x + Math.cos(a + rnd(-0.8, 0.8)) * r, 0.03, z + Math.sin(a + rnd(-0.8, 0.8)) * r), { life: 130, branches: 0, width: 0.35, depth: 4 });
      }
      once(e, 'smoke', 300, t, () => { for (let i = 0; i < n(14); i++) smoke(x + rnd(-0.3, 0.3), rnd(0.2, 0.6), z + rnd(-0.3, 0.3), '#7a8090', 0.3, 0.4, 1.8, rnd(1500, 2300), 0.6); });
      const f = e.flashAt ? Math.exp(-(clock - e.flashAt) / 110) * e.flashBig : 0;
      // the room darkens as the bolt gathers and stays dim while it crackles, so it reads
      e.light = { point: [x, 1.4, z], color: '#6f9cff', power: t > 180 ? 45 * f + 10 * Math.exp(-(t - 200) / 700) : 0, expo: 0.3 * f, dim: 0.42 * smooth(0, 180, t) * (1 - smooth(1500, 2600, t)), tint: '#5a70c0' };
      e.shake = 0.06 * f;
    } },
    // The square's stone gives way: cracks run out, chips leap and tumble, a cloud of dust
    // rolls across the board with a few golden glints in it.
    stone: { dur: 3000, run(e, t) {
      const { x, z } = e, dust = e.dust || '#c8b08a';
      once(e, 'boom', 0, t, () => {
        crackAt(x, z, '#ffd890', '#241a12', 2.2, 2900);
        ring(x, 0.03, z, '#e8cc90', 2.4, 600);
        for (let i = 0; i < n(42); i++) { const a = rnd(0, TAU), s = rnd(0.8, 3); chip(x + rnd(-0.2, 0.2), 0.15, z + rnd(-0.2, 0.2), Math.cos(a) * s, rnd(2.5, 6), Math.sin(a) * s, rnd(0.06, 0.15), i % 3 ? e.stone || '#bfb2a0' : '#8a7c6a', rnd(2400, 3000)); }
        for (let i = 0; i < n(70); i++) { const a = rnd(0, TAU), s = rnd(1.5, 4); emit({ x, y: 0.1, z, vx: Math.cos(a) * s, vy: rnd(1, 4), vz: Math.sin(a) * s, life: rnd(900, 1800), s0: rnd(0.05, 0.1), s1: 0.04, shape: 4, add: false, c0: tone('#d8ccb8'), c1: tone('#a89a86'), c2: tone('#8a7c6a'), g: 9, drag: 0.7, floor: true, rot: rnd(0, 6), spin: rnd(-8, 8), fadeIn: 0.01 }); }
        for (let i = 0; i < n(40); i++) { const a = rnd(0, TAU), s = rnd(0.6, 2); emit({ x, y: rnd(0.1, 0.5), z, vx: Math.cos(a) * s, vy: rnd(0.3, 0.9), vz: Math.sin(a) * s, life: rnd(1700, 2800), s0: 0.6, s1: rnd(2, 3), shape: 2, add: false, a: 0.72, c0: tone(dust), c1: tone(dust), c2: tone(dust), drag: 0.45, rot: rnd(0, 6), spin: rnd(-0.5, 0.5), fadeIn: 0.1 }); }
        for (let i = 0; i < n(16); i++) spark(x, 0.2, z, 4, 4, '#f0c060', rnd(600, 1400));
      });
      once(e, 'puff2', 260, t, () => ring(x, 0.03, z, '#c8b08a', 1.6, 500));
      e.light = { point: [x, 0.8, z], color: '#ffc880', power: 10 * Math.exp(-t / 300), expo: 0.04 * Math.exp(-t / 140) };
      e.shake = 0.09 * Math.exp(-t / 260) * Math.abs(Math.cos(t / 28));
    } },
  };

  const STORMS = {
    // A gust of petals blows across the table, whirls into a ring around the board, bursts up
    // from the winner's king and drifts down into a wreath.
    petals: { dur: 10000, run(e, t, dt) {
      const pal = e.petals || ['#ff9fb8', '#ffc4d4', '#ffe4ec', '#e86a8a'];
      if (t < 1800) for (let i = rate(e, 'gust', 340, dt); i > 0; i--) petal(rnd(-11, -8), rnd(0.4, 4), rnd(-6, 6), rnd(5, 7), 0, rnd(-1, 1), pal[i % pal.length], rnd(0.16, 0.26), 10000 - t);
      if (t > 1500 && t < 6000) for (let i = rate(e, 'rise', 70, dt); i > 0; i--) { const a = rnd(0, TAU); petal(Math.cos(a) * 4.8, 0.1, Math.sin(a) * 4.8, 0, 2, 0, pal[i % pal.length], rnd(0.15, 0.24), 10000 - t); }
      once(e, 'burst', 6000, t, () => {
        for (let i = 0; i < n(130); i++) { const a = rnd(0, TAU), s = rnd(0.8, 2.6); petal(e.x, 1.3, e.z, Math.cos(a) * s, rnd(4, 7), Math.sin(a) * s, pal[i % pal.length], rnd(0.16, 0.26), 4000); }
        for (let i = 0; i < n(50); i++) emit({ x: e.x, y: 1.3, z: e.z, vx: rnd(-2, 2), vy: rnd(1, 4), vz: rnd(-2, 2), life: rnd(1200, 2200), s0: 0.14, s1: 0.04, c0: tone('#fff4d8'), c1: tone('#ffd0e0'), c2: tone('#ff9ab8'), g: 0.8, drag: 0.5 });
        ring(e.x, 0.05, e.z, '#ffc0d0', 3.2, 900);
      });
      if (t < 8000) for (let i = rate(e, 'glint', 24, dt); i > 0; i--) { const a = rnd(0, TAU), r = rnd(3, 5.5); emit({ x: Math.cos(a) * r, y: rnd(0.3, 3.5), z: Math.sin(a) * r, life: rnd(600, 1200), s0: 0.08, s1: 0.02, c0: tone('#fff2d0'), c1: tone('#ffd6e4'), c2: tone('#ffb0c8') }); }
      // the air: a gust from one side, then a whirl that pulls petals onto a ring and lifts them
      const gust = 6.5 * (1 - smooth(800, 2600, t)), whirl = smooth(1000, 2400, t) * (1 - smooth(6800, 8200, t));
      e.wind = (p) => {
        const r = Math.hypot(p.x, p.z) || 0.001, ux = p.x / r, uz = p.z / r;
        const ring = 4.6 + Math.sin(t / 900 + p.seed) * 0.8;
        p.wx = gust + whirl * (-uz * 4.2 + ux * (ring - r) * 1.1);
        p.wz = whirl * (ux * 4.2 + uz * (ring - r) * 1.1);
        p.wy = whirl * (0.8 + 0.9 * Math.sin(Math.atan2(uz, ux) * 3 + t / 500 + p.seed)) - (1 - whirl) * 0.5 * (1 - gust / 6.5);
      };
      e.light = { expo: 0.06 * whirl, tint: '#ffb8c8', dim: 0 };
    } },
    // A ring of fire runs round the board, a whirl of flame rises from the winner's king and
    // three fire-flowers bloom overhead, raining embers.
    fire: { dur: 10000, run(e, t, dt) {
      const H = 4.7, live = t < 8000;
      const edge = (u) => { u = ((u % 1) + 1) % 1; const s = Math.floor(u * 4), f = (u * 4 - s) * 2 - 1; return s === 0 ? [f * H, H] : s === 1 ? [H, -f * H] : s === 2 ? [-f * H, -H] : [-H, f * H]; };
      if (live) for (let i = rate(e, 'ring', 190, dt); i > 0; i--) { const [px, pz] = edge(rnd(0, Math.min(1, t / 900))); flame(px + rnd(-0.12, 0.12), 0.02, pz + rnd(-0.12, 0.12), rnd(0.9, 2.2), rnd(0.4, 0.65), rnd(500, 900)); }
      if (t > 600 && live) for (let i = rate(e, 'whirl', 110, dt); i > 0; i--) emit({ x: e.x, y: rnd(0, 0.4), z: e.z, vy: rnd(1.2, 2.4), life: rnd(1300, 1900), s0: rnd(0.45, 0.7), s1: rnd(0.9, 1.4), shape: 1,
        c0: tone('#fff6d0'), c1: tone('#ffb040'), c2: tone('#d0400c'), g: -0.4, rot: rnd(-0.2, 0.2), fadeIn: 0.1, orb: { cx: e.x, cz: e.z, th: rnd(0, TAU), r: rnd(0.35, 0.8), w: rnd(3, 4.2), vr: 0.25 } });
      if (live) for (let i = rate(e, 'swirl', 55, dt); i > 0; i--) emit({ y: rnd(0.2, 1.5), vy: rnd(0.4, 1), life: rnd(2800, 3800), s0: 0.08, s1: 0.05, c0: tone('#fff2b8'), c1: tone('#ffab40'), c2: tone('#ff6a20'), orb: { cx: 0, cz: 0, th: rnd(0, TAU), r: rnd(3, 7), w: rnd(0.6, 1.1), vr: rnd(-0.3, 0.2) } });
      for (const [key, at] of [['f1', 3000], ['f2', 5200], ['f3', 7400]]) once(e, key, at, t, () => {
        const bx = rnd(-3, 3), by = rnd(4.2, 5.6), bz = rnd(-3, 1);
        for (let i = 0; i < n(30); i++) { const a = rnd(0, TAU), b = rnd(-1, 1); emit({ x: bx, y: by, z: bz, vx: Math.cos(a) * 2.2, vy: b * 2.2, vz: Math.sin(a) * 2.2, life: rnd(600, 1000), s0: 0.45, s1: 0.9, shape: 1, c0: tone('#fff4c8'), c1: tone('#ffa236'), c2: tone('#b0240a'), drag: 0.3, rot: rnd(-0.3, 0.3) }); }
        for (let i = 0; i < n(70); i++) ember(bx, by, bz, rnd(2, 5), rnd(-1, 3), rnd(1400, 2400));
        e.boom = { at: clock, p: [bx, by, bz] };
      });
      if (t > 8000) once(e, 'smoke', 8000, t, () => { for (let i = 0; i < n(18); i++) { const a = rnd(0, TAU); smoke(Math.cos(a) * 4.6, 0.3, Math.sin(a) * 4.6, '#4a382c', 0.3, 0.6, 2.4, rnd(1600, 2000)); } });
      const glow = smooth(0, 900, t) * (1 - smooth(7600, 9400, t)), boom = e.boom ? Math.exp(-(clock - e.boom.at) / 260) : 0;
      e.light = boom > 0.15 ? { point: e.boom.p, color: '#ffb050', power: 120 * boom, expo: 0.25 * boom, tint: '#ff9a50', dim: 0.15 * glow }
        : { point: [e.x, 1.8, e.z], color: '#ff8a30', power: glow * (34 + 8 * Math.sin(t * 0.04) + 5 * Math.sin(t * 0.11)), expo: 0.08 * glow, tint: '#ff9a50', dim: 0.15 * glow };
    } },
    // The sky darkens and a cloud wheels above the table, lit from inside; bolts fork down
    // around the board, and the last one gives the winner's king a crown of light.
    lightning: { dur: 10000, run(e, t, dt) {
      const dark = smooth(0, 1300, t) * (1 - smooth(8700, 10000, t));
      once(e, 'cloud', 0, t, () => {
        for (let i = 0; i < n(80); i++) {
          const r = rnd(2.6, 6.6), shade = ['#2e3850', '#3c4864', '#4a5878', '#5a6888'][i % 4];
          emit({ born: clock + rnd(0, 1300), y: rnd(5.4, 6.6) + r * 0.12, life: 9600, s0: rnd(2, 3.4), s1: rnd(2.6, 4), shape: 2, add: false, a: 0.7, c0: tone(shade), c1: tone(shade), c2: tone(shade),
            rot: rnd(0, 6), spin: rnd(-0.3, 0.3), fadeIn: 0.12, orb: { cx: 0, cz: 0, th: rnd(0, TAU), r, w: 0.9 / (0.4 + r * 0.35), vr: 0 } });
        }
      });
      if (t > 900 && t < 8800) for (let i = rate(e, 'inner', 22, dt); i > 0; i--) { const a = rnd(0, TAU), r = rnd(2.6, 6); emit({ x: Math.cos(a) * r, y: rnd(5.6, 6.6), z: Math.sin(a) * r, life: rnd(200, 380), s0: rnd(1.6, 3), s1: 2, c0: tone('#86a8ff'), c1: tone('#6a8cff'), c2: tone('#4a6aff'), a: 0.4 }); }
      if (t > 1200 && t < 8400 && t - (e.arcAt || 0) > 200) {
        e.arcAt = t;
        const a = rnd(0, TAU), r = rnd(2.8, 5.5);
        bolt(V(Math.cos(a) * r, rnd(5.6, 6.2), Math.sin(a) * r), V(Math.cos(a + rnd(0.4, 1)) * rnd(2.8, 5.5), rnd(5.6, 6.2), Math.sin(a + rnd(0.4, 1)) * rnd(2.8, 5.5)), { life: 170, branches: 1, width: 0.5, depth: 5 });
      }
      // forks down to the table around the board, never more than about one flash a second
      for (const [key, at] of [['s1', 1700], ['s2', 2700], ['s3', 3500], ['s4', 4500], ['s5', 5300], ['s6', 6300], ['s7', 7200]]) once(e, key, at, t, () => {
        const a = rnd(0, TAU), r = rnd(5.2, 6.4), hx = Math.cos(a) * r, hz = Math.sin(a) * r, hy = o.floorY(hx, hz) + 0.02;
        bolt(V(hx * 0.7 + rnd(-0.8, 0.8), 5.8, hz * 0.7 + rnd(-0.8, 0.8)), V(hx, hy, hz), { life: 420, branches: 3, width: 1.1 });
        for (let i = 0; i < n(50); i++) spark(hx, hy + 0.1, hz, 5, 4, '#8fb4ff', rnd(400, 1100));
        ring(hx, hy + 0.02, hz, '#bcd2ff', 1.6, 500);
        e.flash = { at: clock, k: 0.6, p: [hx, 1.2, hz] };
      });
      // the finale: the winner's king is crowned
      once(e, 'crown', 8200, t, () => {
        const top = V(e.x, 1.35, e.z);
        bolt(V(e.x + rnd(-0.6, 0.6), 7, e.z + rnd(-0.6, 0.6)), top, { life: 650, branches: 5, width: 1.5 });
        ring(e.x, 0.04, e.z, '#cfe0ff', 4, 900);
        for (let i = 0; i < n(110); i++) spark(e.x, 1.2, e.z, 6, 6, i % 2 ? '#a8c4ff' : '#fff2c0', rnd(600, 1500));
        for (let i = 0; i < n(36); i++) emit({ x: e.x, y: 1.5, z: e.z, vy: rnd(0.2, 0.8), life: rnd(1200, 1700), s0: 0.16, s1: 0.06, c0: tone('#ffffff'), c1: tone('#fff0b0'), c2: tone('#ffd060'), orb: { cx: e.x, cz: e.z, th: (i / 36) * TAU, r: 0.42, w: 2.4, vr: 0.1 } });
        e.flash = { at: clock, k: 1, p: [e.x, 1.6, e.z] };
        if (e.onCrown) e.onCrown();
      });
      if (t > 1000 && t < 8600) for (let i = rate(e, 'mote', 30, dt); i > 0; i--) emit({ x: rnd(-6, 6), y: rnd(3, 5.5), z: rnd(-6, 6), vy: -rnd(0.4, 0.9), life: rnd(2000, 3000), s0: 0.05, s1: 0.03, c0: tone('#bcd2ff'), c1: tone('#8fb4ff'), c2: tone('#6a8cff'), flutter: 0.8 });
      const f = e.flash ? Math.exp(-(clock - e.flash.at) / 120) * e.flash.k : 0;
      e.light = { point: e.flash ? e.flash.p : [0, 5, 0], color: '#9ab8ff', power: 140 * f, expo: 0.8 * f, dim: 0.42 * dark, tint: '#5a70c0' };
      e.shake = 0.03 * f;
    } },
  };

  // ------------------------------------------------------------------ lighting the table
  // The table's lights are lent to the effect for a frame: scene.js asks light() before it
  // draws and puts everything back after. The storm's darkness eases in and out; flashes are sharp.
  const lit = { dim: 0, tint: new THREE.Color('#ffffff'), tintK: 0 };
  function light(dt) {
    let dim = 0, expo = 0, tintK = 0, point = null, tint = null;
    for (const e of effects) {
      const l = e.light; if (!l) continue;
      dim = Math.max(dim, l.dim || 0); expo += l.expo || 0;
      if (l.tint && (l.dim || l.expo)) { tint = l.tint; tintK = Math.max(tintK, (l.dim || 0) + (l.expo || 0) * 0.5); }
      if (l.point && l.power > 0 && (!point || l.power > point.power)) point = l;
    }
    const k = Math.min(1, dt * 5);
    lit.dim += (dim - lit.dim) * k;
    if (tint) lit.tint.lerp(tone(tint), k);
    lit.tintK += (Math.min(0.7, tintK) - lit.tintK) * k;
    if (lit.dim < 0.002 && expo < 0.002 && !point && lit.tintK < 0.002) return null;
    return { expo: (1 - lit.dim) * (1 + expo), key: 1 - lit.dim * 0.8, tint: lit.tint, tintK: lit.tintK, point: point && { x: point.point[0], y: point.point[1], z: point.point[2], color: tone(point.color), power: point.power } };
  }
  let shakeNow = 0;
  const shakeV = { x: 0, y: 0, z: 0 };

  // ------------------------------------------------------------------ driving it
  let lastLight = null;
  function start(table, kind, x, z, opt) {
    const S = table[kind];
    if (!S) return null;
    clock = performance.now();
    const e = Object.assign({ kind, S, start: clock, x: x || 0, z: z || 0, fired: new Set(), acc: {}, light: null, shake: 0 }, opt || {});
    effects.push(e);
    o.wake();
    return e;
  }
  return {
    // a capture: 'fire', 'lightning' or 'stone' on square (x, z); o.dust, o.stone recolour the stone shatter
    strike(kind, x, z, opt) { return start(STRIKES, kind, x, z, opt); },
    // a win: 'petals', 'fire' or 'lightning', centred on the winner's king (x, z);
    // o.petals: colours; o.onCrown: called when the lightning storm crowns the king
    storm(kind, x, z, opt) {
      for (const e of effects) if (STORMS[e.kind] && e.S === STORMS[e.kind]) e.calm = clock;
      return start(STORMS, kind, x, z, opt);
    },
    // Calms a storm early (a tap on the table): nothing new is made and what is there fades
    // within half a second.
    calm() {
      let any = false;
      for (const e of effects) if (e.S.dur > 3000 && e.calm === undefined) { e.calm = clock; any = true; }
      if (!any) return false;
      for (const p of parts) { const left = p.born + p.life - clock; if (left > 500) { p.life = clock - p.born + 500; } }
      for (const p of petalList) p.life = Math.min(p.life, clock - p.born + 500);
      for (const b of bolts) b.life = Math.min(b.life, clock - b.born);
      return true;
    },
    // Everything gone at once (a new game, the home screen).
    clear() {
      effects.length = 0; parts.length = 0; bolts.length = 0; chipList.length = 0; petalList.length = 0;
      rings.forEach((r) => { r.visible = false; }); crack.visible = false;
      chips.count = 0; petals.count = 0; glowPts.geometry.setDrawRange(0, 0); mattePts.geometry.setDrawRange(0, 0); boltGeo.setDrawRange(0, 0);
      lit.dim = 0; lit.tintK = 0; lastLight = null;
    },
    storming: () => effects.some((e) => e.S.dur > 3000 && e.calm === undefined),
    active: () => effects.length > 0 || parts.length > 0 || bolts.length > 0 || chipList.length > 0 || petalList.length > 0 || crack.visible || rings.some((r) => r.visible) || lit.dim > 0.002 || lit.tintK > 0.002,
    // one frame: returns true while anything is still moving
    step(now, dt) {
      clock = now;
      const wind = [];
      for (let i = effects.length - 1; i >= 0; i--) {
        const e = effects[i], t = clock - e.start;
        const done = t >= e.S.dur || (e.calm !== undefined && clock - e.calm > 500);
        if (done) { effects.splice(i, 1); continue; }
        if (e.calm !== undefined) {
          const k = 1 - (clock - e.calm) / 500;
          if (e.light) e.light = Object.assign({}, e.light, { power: (e.light.power || 0) * k, expo: (e.light.expo || 0) * k, dim: (e.light.dim || 0) * k });
          e.shake = 0;
          continue;
        }
        e.S.run(e, t, dt);
        if (e.wind) wind.push(e.wind);
      }
      shakeNow = 0;
      for (const e of effects) shakeNow = Math.max(shakeNow, e.shake || 0);
      stepParts(dt); stepChips(dt);
      stepPetals(dt, wind.length ? wind[wind.length - 1] : null);
      stepRings(); stepCrack();
      lastLight = light(dt);
      if (!parts.length) { glowPts.geometry.setDrawRange(0, 0); mattePts.geometry.setDrawRange(0, 0); }
      if (!bolts.length) boltGeo.setDrawRange(0, 0);
      return this.active();
    },
    // per frame, before drawing
    draw(pointScale, aspect) {
      glowPts.material.uniforms.scale.value = mattePts.material.uniforms.scale.value = pointScale;
      glowPts.material.uniforms.aspect.value = mattePts.material.uniforms.aspect.value = aspect;
      upload(); drawBolts();
    },
    light: () => lastLight,
    shake() {
      if (shakeNow < 0.001) { shakeV.x = shakeV.y = shakeV.z = 0; return shakeV; }
      shakeV.x = (Math.random() - 0.5) * 2 * shakeNow; shakeV.y = (Math.random() - 0.5) * shakeNow; shakeV.z = (Math.random() - 0.5) * 2 * shakeNow;
      return shakeV;
    },
  };
}
// Each room's element: the capture strike, the win storm and their colours.
ChacklateElements.ROOMS = {
  salon: { strike: 'fire', storm: 'petals', petals: ['#d2466f', '#ff8fb0', '#ffd9e4', '#f4c08a'] },
  library: { strike: 'lightning', storm: 'lightning' },
  marble: { strike: 'stone', storm: 'petals', petals: ['#ffffff', '#ffe8ee', '#f8d0dc', '#e8c06a'], dust: '#d8d2c8', stone: '#e4e0d8' },
  harvest: { strike: 'fire', storm: 'fire' },
  nile: { strike: 'stone', storm: 'fire', dust: '#d8b880', stone: '#d0b080' },
  athens: { strike: 'lightning', storm: 'lightning' },
  roma: { strike: 'fire', storm: 'fire' },
  mughal: { strike: 'stone', storm: 'petals', petals: ['#c8203a', '#e8506a', '#ff9aa8', '#ffd0d8'], dust: '#e8dcd0', stone: '#f0ece4' },
  ming: { strike: 'fire', storm: 'petals', petals: ['#ffb7c8', '#ffd4de', '#fff0f4', '#f290aa'] },
  venice: { strike: 'fire', storm: 'petals', petals: ['#f4d27a', '#ffe8b0', '#e89a6a', '#fff4dc'] },
  winter: { strike: 'lightning', storm: 'lightning' },
  deco: { strike: 'lightning', storm: 'fire' },
  paris: { strike: 'stone', storm: 'petals', petals: ['#c8a0e0', '#e8c8f4', '#ffd4e4', '#f4e8ff'], dust: '#d8ccb8', stone: '#ddd2c0' },
};
ChacklateElements.STRIKE_MS = 3000;
ChacklateElements.STORM_MS = 10000;
if (typeof module !== 'undefined') module.exports = ChacklateElements;
