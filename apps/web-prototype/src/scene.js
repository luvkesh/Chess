// Chackmate table scene (three.js). Same API as the old hand-written renderer, so the game
// logic drives it unchanged: setBoard, setHighlights, setArrows, animateMove, celebrate,
// setView, setShift, setClock and friends. The scene is a lit room around a round table:
// an inlaid board, sculpted pieces with real reflections and shadows, velvet trays for
// captures, a chess clock, candles, a chandelier, and a gentle glow on bright highlights.
function ChacklateScene(canvas, options) {
  'use strict';
  const THREE = window.THREE;
  if (!THREE) return null;
  const opts = Object.assign({ onSquare() {}, canDrag() { return false; }, onDrop() { return false; }, onContextLost() {}, onContextRestored() {}, onPerf() {} }, options);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__SHOT });
  } catch (e) { return null; }
  if (!renderer.getContext()) return null;
  const K = ChacklateKit(THREE), P = ChacklatePieces(THREE, K), W = ChacklateWorld(THREE, K);
  const TAU = Math.PI * 2;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Shadows only change when something on the table moves, not when the camera does, so the
  // shadow map is redrawn on demand (dirtyShadows) instead of on every frame.
  renderer.shadowMap.autoUpdate = false;
  let shadowDirty = true;
  const dirtyShadows = () => { shadowDirty = true; };
  renderer.setClearColor('#120a07');

  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  const sqX = (sq) => (sq & 7) - 3.5;
  const sqZ = (sq) => 3.5 - (sq >> 3);
  const TYPE = { 1: 'p', 2: 'n', 3: 'b', 4: 'r', 5: 'q', 6: 'k' };
  const kindOf = (p) => Math.abs(p);

  // ------------------------------------------------------------------ scene graph
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  const roomGroup = new THREE.Group(), boardGroup = new THREE.Group(), pieceGroup = new THREE.Group(), fxGroup = new THREE.Group();
  scene.add(roomGroup, boardGroup, pieceGroup, fxGroup);
  const key = new THREE.DirectionalLight('#ffeedd', 2.0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -7.5, right: 7.5, top: 7.5, bottom: -7.5, near: 2, far: 40 });
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.025; key.shadow.radius = 3;
  scene.add(key, key.target);
  // The rim light sits low behind the board and well off to one side, so its mirror image on
  // the polished table stays out of the low home-screen view; both lights turn with the
  // player's side.
  const rim = new THREE.DirectionalLight('#ffd6a0', 0.6); scene.add(rim);
  function placeLights(side) {
    const k = side === 'black' ? -1 : 1;
    key.position.set(-6 * k, 14, 7 * k); rim.position.set(8 * k, 3, -8 * k);
    dirtyShadows();
  }
  placeLights('white');
  const hemi = new THREE.HemisphereLight('#ffe2c0', '#1a0d08', 0.35); scene.add(hemi);
  const chandLight = new THREE.PointLight('#ffc480', 14, 40, 2); chandLight.position.set(0, 7.2, 0); scene.add(chandLight);

  // ------------------------------------------------------------------ performance level
  // 0 is full detail. When frames keep arriving late the level steps up (see govern) and the
  // table gives up detail in this order: resolution, MSAA, the piece reflections, then bloom
  // and the dust motes. Phones and small machines start a step or two in. 'low' quality
  // starts at 1x resolution and only lowers it further.
  const PERF_DPR = { high: [1.75, 1.5, 1.25, 1, 1, 0.85], low: [1, 1, 0.85, 0.75, 0.75, 0.75] };
  const MAX_PERF = 5;
  let perf = (() => {
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 8;
    if (mem <= 2 || cores <= 2) return 3;
    if (coarse && (mem <= 4 || cores <= 4)) return 2;
    if (coarse || mem <= 4) return 1;
    return 0;
  })();
  if (window.__SHOT) perf = 0;   // screenshots always show full detail
  if (perf >= 1) K.setTextureBudget(1024, perf >= 3 ? 2 : 4);
  // While a collection item is being shown off on the table ("Try it on the table") the
  // table draws at full detail and up to 2x resolution, whatever level it has fallen to:
  // the view is mostly still, and a soft, blocky preview sells the item short.
  let fullDetail = false;
  const lvl = () => (fullDetail ? 0 : perf);
  const hq = () => fullDetail || quality === 'high';
  const reflectOn = () => hq() && lvl() < 3;
  const bloomOn = () => hq() && lvl() < 4;

  // ------------------------------------------------------------------ post-processing
  let composer = null, bloom = null, quality = 'high', animations = true;
  function disposeComposer() {
    if (!composer) return;
    composer.passes.forEach((p) => { if (p.dispose) p.dispose(); });
    composer.dispose();
    composer = null; bloom = null;
  }
  function buildComposer() {
    disposeComposer();
    if (!bloomOn()) return;
    // The scene is drawn into the composer's second target (its read buffer), so only that
    // one needs MSAA; the first only ever holds the graded copy.
    const rt = new THREE.WebGLRenderTarget(1, 1, { samples: lvl() >= 2 ? 2 : 4, type: THREE.HalfFloatType });
    composer = new THREE.EffectComposer(renderer, rt);
    composer.renderTarget1.samples = 0;
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.55, 1.25);
    composer.addPass(bloom);
    composer.addPass(new THREE.ShaderPass(GRADE));
    composer.addPass(new THREE.OutputPass());
    sizeComposer();
  }
  // Render targets are resized in place: making new ones on every resize (and browser zoom
  // fires lots of them) leaked the old bloom buffers until the GPU ran out of memory.
  const sizeV = new THREE.Vector2();
  function sizeComposer() {
    if (!composer) return;
    renderer.getSize(sizeV);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(sizeV.x, sizeV.y);
  }
  // Warm grade and vignette, in linear light before tone mapping.
  const GRADE = {
    uniforms: { tDiffuse: { value: null }, vignette: { value: 0.42 }, warmth: { value: new THREE.Vector3(1.03, 1.0, 0.95) } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float vignette; uniform vec3 warmth; varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        vec2 d = vUv - 0.5; float v = 1.0 - vignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
        gl_FragColor = vec4(c.rgb * warmth * v, c.a);
      }`,
  };

  // ------------------------------------------------------------------ planar reflection of the pieces
  const REFLECT = 2;
  let reflRT = null;
  const mirrorCam = new THREE.PerspectiveCamera();
  const texMat = new THREE.Matrix4();
  const reflMat = new THREE.ShaderMaterial({
    uniforms: { tRefl: { value: null }, texMat: { value: texMat }, strength: { value: 0.3 }, camPos: { value: new THREE.Vector3() } },
    vertexShader: 'uniform mat4 texMat; varying vec4 vUv; varying vec3 vW; void main() { vUv = texMat * vec4(position, 1.0); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform sampler2D tRefl; uniform float strength; uniform vec3 camPos; varying vec4 vUv; varying vec3 vW;
      void main() {
        vec2 uv = vUv.xy / vUv.w; vec2 o = vec2(0.0018, 0.0026);
        vec3 c = texture2D(tRefl, uv).rgb * 0.36 + (texture2D(tRefl, uv + vec2(o.x, 0.0)).rgb + texture2D(tRefl, uv - vec2(o.x, 0.0)).rgb + texture2D(tRefl, uv + vec2(0.0, o.y)).rgb + texture2D(tRefl, uv - vec2(0.0, o.y)).rgb) * 0.16;
        vec3 v = normalize(camPos - vW); float fres = 0.3 + 0.7 * pow(1.0 - max(v.y, 0.0), 2.5);
        gl_FragColor = vec4(c * strength * fres, 1.0);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const reflPlane = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), reflMat);
  reflPlane.rotation.x = -Math.PI / 2; reflPlane.position.y = 0.0015; reflPlane.renderOrder = 1;
  scene.add(reflPlane);
  function renderReflection() {
    if (!reflRT || !reflectOn() || !reflPlane.visible) return;
    reflPlane.updateMatrixWorld();
    const n = new THREE.Vector3(0, 1, 0), mp = new THREE.Vector3(0, 0, 0), cp = camera.position;
    const view = new THREE.Vector3().subVectors(mp, cp).reflect(n).negate().add(mp);
    const rot = new THREE.Matrix4().extractRotation(camera.matrixWorld);
    const look = new THREE.Vector3(0, 0, -1).applyMatrix4(rot).add(cp);
    const target = new THREE.Vector3().subVectors(mp, look).reflect(n).negate().add(mp);
    mirrorCam.position.copy(view);
    mirrorCam.up.set(0, 1, 0).applyMatrix4(rot).reflect(n);
    mirrorCam.lookAt(target);
    mirrorCam.far = camera.far; mirrorCam.near = camera.near;
    mirrorCam.updateMatrixWorld();
    mirrorCam.projectionMatrix.copy(camera.projectionMatrix);
    mirrorCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    mirrorCam.layers.set(REFLECT);
    texMat.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    texMat.multiply(mirrorCam.projectionMatrix).multiply(mirrorCam.matrixWorldInverse).multiply(reflPlane.matrixWorld);
    reflMat.uniforms.camPos.value.copy(camera.position);
    const bg = scene.background, fog = scene.fog;
    scene.background = null; scene.fog = null;
    reflPlane.visible = false;
    renderer.setRenderTarget(reflRT);
    renderer.setClearColor(0x000000, 1); renderer.clear();
    renderer.render(scene, mirrorCam);
    renderer.setRenderTarget(null);
    renderer.setClearColor('#120a07');
    reflPlane.visible = true;
    scene.background = bg; scene.fog = fog;
  }

  // ------------------------------------------------------------------ themes
  let boardId = 'walnut', setId = 'regency', roomId = 'salon', labelSide = 'white';
  let room = null, boardMesh = null;
  function loadRoom(id) {
    if (room && room.def && id === roomId && roomGroup.children.length) return;
    roomId = id;
    while (roomGroup.children.length) roomGroup.children.pop();
    if (room && room.dispose) room.dispose();
    room = W.room(id);
    roomGroup.add(room.group);
    scene.fog = new THREE.FogExp2(room.fog, 0.022);
    scene.background = new THREE.Color(room.fog);
    hemi.color.set(room.hemi[0]); hemi.groundColor.set(room.hemi[1]); hemi.intensity = room.lights.hemi;
    chandLight.intensity = room.lights.chand; chandLight.color.set(room.lights.color);
    scene.environment = W.environment(renderer, room.env);
    scene.environmentIntensity = 0.9;
    // flames are reflected in the board too
    room.flames.forEach((f) => { f.m.layers.enable(REFLECT); f.halo.layers.enable(REFLECT); });
    placeTrays();
    dirtyShadows();
  }
  function loadBoard(id) {
    if (boardMesh && id === boardId) return;
    boardId = id;
    if (boardMesh) { boardGroup.remove(boardMesh); boardMesh.userData.dispose(); }
    boardMesh = W.board(id, labelSide);
    boardGroup.add(boardMesh);
    dirtyShadows();
  }
  function loadSet(id) {
    if (id === setId && sprites.length && sprites[0].obj && sprites[0].obj.userData.set === id) return;
    setId = P.SETS[id] ? id : 'regency';
    for (const s of sprites.concat(graveyard)) rebuildSprite(s);
  }

  // ------------------------------------------------------------------ trays and clock
  // Captured pieces rest on velvet in walnut trays: beside the board on wide screens, in
  // front of each player on tall ones.
  const TABLE_Y = -0.46;
  let trays = null, layoutPortrait = false;
  const trayParts = (() => {
    const wood = new THREE.MeshPhysicalMaterial({ color: '#2a170e', roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08 });
    const pile = K.canvasTex('tray-velvet', 256, 1024, (g, w, h) => {
      g.fillStyle = '#3c0d18'; g.fillRect(0, 0, w, h);
      const R = K.rng(17);
      for (let i = 0; i < 26000; i++) { g.fillStyle = R() > 0.5 ? 'rgba(255,190,200,0.05)' : 'rgba(0,0,0,0.09)'; g.fillRect(R() * w, R() * h, 1, 2); }
      // a soft inner shadow where the velvet meets the rails
      const edge = (x0, y0, x1, y1) => { const grd = g.createLinearGradient(x0, y0, x1, y1); grd.addColorStop(0, 'rgba(0,0,0,0.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grd; g.fillRect(0, 0, w, h); };
      edge(0, 0, 26, 0); edge(w, 0, w - 26, 0); edge(0, 0, 0, 26); edge(0, h, 0, h - 26);
    });
    const velvet = new THREE.MeshPhysicalMaterial({ map: pile, color: '#ffffff', roughness: 0.9, sheen: 1, sheenRoughness: 0.32, sheenColor: new THREE.Color('#c86478') });
    const frameG = W.slab(W.roundedSquare(1, 0.1), 0, 0.15, 0.025); frameG.scale(0.8, 1, 2.8);
    const bedG = new THREE.PlaneGeometry(1.38, 5.36); bedG.rotateX(-Math.PI / 2); bedG.translate(0, 0.152, 0);
    const rimG = K.merge([-1, 1].map((k) => { const b = new THREE.BoxGeometry(1.5, 0.028, 0.028); b.translate(0, 0.158, k * 2.7); return b; })
      .concat([-1, 1].map((k) => { const b = new THREE.BoxGeometry(0.028, 0.028, 5.4); b.translate(k * 0.72, 0.158, 0); return b; })));
    return { wood, velvet, frameG, bedG, rimG };
  })();
  function placeTrays() {
    if (trays) scene.remove(trays);
    trays = new THREE.Group();
    for (const s of [-1, 1]) {
      const t = new THREE.Group();
      const frame = new THREE.Mesh(trayParts.frameG, trayParts.wood); frame.castShadow = true; frame.receiveShadow = true;
      const bed = new THREE.Mesh(trayParts.bedG, trayParts.velvet); bed.receiveShadow = true;
      t.add(frame, bed, new THREE.Mesh(trayParts.rimG, K.MAT.gold()));
      if (layoutPortrait) { t.rotation.y = Math.PI / 2; t.position.set(0, TABLE_Y, s * 6.3); } else t.position.set(s * 6.1, TABLE_Y, 0);
      trays.add(t);
    }
    scene.add(trays);
    dirtyShadows();
  }
  const TRAY_Y = TABLE_Y + 0.152;
  function gravePos(capturer, i) {
    const col = Math.floor(i / 8), row = i % 8;
    if (layoutPortrait) return capturer > 0 ? [-2.31 + row * 0.66, 5.98 + col * 0.64] : [2.31 - row * 0.66, -5.98 - col * 0.64];
    return capturer > 0 ? [5.78 + col * 0.64, 2.31 - row * 0.66] : [-5.78 - col * 0.64, -2.31 + row * 0.66];
  }
  const graveYaw = (capturer) => (layoutPortrait ? (capturer > 0 ? 0 : Math.PI) : capturer > 0 ? -Math.PI / 2 : Math.PI / 2);
  function relayoutGrave() {
    for (const s of graveyard) {
      if (s.cap === undefined) continue;
      const [x, z] = gravePos(s.cap, s.gi); s.x = x; s.z = z; s.yaw = graveYaw(s.cap); placeSprite(s);
    }
  }
  function placeClock() {
    if (!clock) return;
    const black = labelSide === 'black';
    clock.rotation.y = black ? Math.PI - 0.35 : -0.35;
    clock.position.set(black ? -6.1 : 6.1, TABLE_Y, black ? -3.7 : 3.7);
    clock.visible = !!clockState && !layoutPortrait;
    dirtyShadows();
  }
  // Chess clock: a walnut case with two brass-rimmed faces and plungers.
  let clock = null, clockState = null, clockSkin = null, clockKey = '';
  const clockCanvas = document.createElement('canvas'); clockCanvas.width = 1024; clockCanvas.height = 384;
  const clockTex = new THREE.CanvasTexture(clockCanvas); clockTex.colorSpace = THREE.SRGBColorSpace;
  function buildClock() {
    const g = new THREE.Group();
    const wood = new THREE.MeshPhysicalMaterial({ color: '#3a1f12', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 0.7), wood); body.position.y = 0.45; body.castShadow = true; body.receiveShadow = true; g.add(body);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.75), new THREE.MeshBasicMaterial({ map: clockTex, toneMapped: false }));
    face.position.set(0, 0.47, 0.352); g.add(face);
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.16, 20), K.MAT.brass()); b.position.set(s * 0.6, 0.98, 0); b.castShadow = true; g.add(b);
      b.userData.side = s; g.userData['btn' + s] = b;
      const bez = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.03, 8, 40), K.MAT.gold()); bez.position.set(s * 0.5, 0.47, 0.36); g.add(bez);
    }
    g.visible = false;
    return g;
  }
  function drawClock() {
    if (!clockState) return;
    const fmt = (ms) => { const s = Math.max(0, ms) / 1000; if (s < 10) return s.toFixed(1); const m = Math.floor(s / 60); return m + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
    const left = clockState.blackMs, right = clockState.whiteMs;
    const k = fmt(left) + '|' + fmt(right) + '|' + clockState.active + '|' + (clockSkin && clockSkin.id);
    if (k === clockKey) return;
    clockKey = k;
    const g = clockCanvas.getContext('2d');
    const sk = clockSkin || { face: '#f4ead8', ink: '#2a1a10', glow: '#b8862e', accent: '#d2466f' };
    g.fillStyle = '#1a0e08'; g.fillRect(0, 0, 1024, 384);
    for (let i = 0; i < 2; i++) {
      const cx = 256 + i * 512, on = clockState.active === (i === 0 ? 'b' : 'w');
      const grd = g.createRadialGradient(cx, 170, 20, cx, 192, 170);
      grd.addColorStop(0, sk.face); grd.addColorStop(1, W.shade(sk.face, -0.18));
      g.fillStyle = grd; g.beginPath(); g.arc(cx, 192, 150, 0, TAU); g.fill();
      g.fillStyle = on ? sk.glow : sk.ink; g.globalAlpha = on ? 1 : 0.7;
      g.font = '600 92px "Cinzel", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(fmt(i === 0 ? left : right), cx, 196);
      g.globalAlpha = 1;
      if (on) { g.fillStyle = sk.accent; g.beginPath(); g.arc(cx, 292, 10, 0, TAU); g.fill(); }
    }
    clockTex.needsUpdate = true;
  }
  clock = buildClock(); scene.add(clock); placeClock();

  // ------------------------------------------------------------------ sprites (pieces)
  let sprites = [], graveyard = [], particles = [], arrows = [];
  let highlights = {}, selectedSq = -1, hoverSq = -1, dragging = null, attract = false, captureFxOn = true;
  let fx = { capture: { kind: 'dust', colors: ['#c8a27a', '#8a5a3a'] }, victory: { kind: 'confetti', colors: ['#e3b25a', '#d2466f', '#f4ebe3'] }, trail: null };
  const shadowTex = K.canvasTex('contact', 128, 128, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(0,0,0,0.75)'); grd.addColorStop(0.45, 'rgba(0,0,0,0.42)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, w);
  });
  const contactGeo = new THREE.PlaneGeometry(1, 1); contactGeo.rotateX(-Math.PI / 2);
  const contactMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.8 });
  function baseYaw(piece, sq) {
    if (kindOf(piece) === 2) return piece > 0 ? Math.PI - 0.95 : -0.95;   // knights look ahead, turned to show their profile
    if (kindOf(piece) === 3) return piece > 0 ? Math.PI * 0.75 : -Math.PI * 0.25;
    return piece > 0 ? Math.PI : 0;
  }
  function makeSprite(piece, sq) {
    const s = { piece, sq, x: sqX(sq), z: sqZ(sq), y: 0, scale: 1, tilt: 0, yaw: baseYaw(piece, sq), anim: null, lift: 0, glow: 0, obj: null, contact: null };
    rebuildSprite(s);
    return s;
  }
  function rebuildSprite(s) {
    if (s.obj) pieceGroup.remove(s.obj);
    // table pieces use the lighter build, except while an item is shown off close up
    const obj = P.make(setId, TYPE[kindOf(s.piece)], s.piece > 0 ? 'w' : 'b', fullDetail ? 'show' : 'play');
    obj.traverse((m) => { m.layers.enable(REFLECT); });
    s.obj = obj;
    pieceGroup.add(obj);
    if (!s.contact) { s.contact = new THREE.Mesh(contactGeo, contactMat); s.contact.renderOrder = 2; fxGroup.add(s.contact); }
    s.placed = '';
    placeSprite(s);
  }
  function dropSprite(s) { if (s.obj) pieceGroup.remove(s.obj); if (s.contact) fxGroup.remove(s.contact); s.obj = null; s.contact = null; dirtyShadows(); }
  function placeSprite(s) {
    const o = s.obj;
    if (!o) return;
    const base = s.grave ? TRAY_Y : 0;
    const lift = s.y + s.lift;
    // every sprite is placed on every frame; only a real change redraws the shadows
    const at = s.x + ',' + s.z + ',' + (base + lift) + ',' + s.yaw + ',' + s.tilt + ',' + s.scale;
    if (at !== s.placed) { s.placed = at; dirtyShadows(); }
    o.position.set(s.x, base + lift + Math.sin(Math.abs(s.tilt)) * 0.3 * s.scale, s.z);
    o.rotation.set(0, s.yaw, 0);
    if (s.tilt) { o.rotation.z = s.tilt; }
    o.scale.setScalar(s.scale);
    if (s.contact) {
      const r = (kindOf(s.piece) === 1 ? 0.62 : 0.78) * s.scale * (1 + lift * 0.8);
      s.contact.scale.set(r, 1, r);
      s.contact.position.set(s.x, base + 0.004, s.z);
      s.contact.visible = !s.tilt;
      s.contact.material = contactMat;
    }
  }

  // ------------------------------------------------------------------ highlights and arrows
  const SHAPES = ['fill', 'frame', 'dot', 'ring', 'glow', 'rim'].map((name) => K.canvasTex('hl-' + name, 256, 256, (g, w) => {
    g.clearRect(0, 0, w, w);
    if (name === 'fill') { g.fillStyle = '#fff'; W.roundRect(g, 10, 10, w - 20, w - 20, 26); g.fill(); }
    if (name === 'frame') { g.strokeStyle = '#fff'; g.lineWidth = 14; W.roundRect(g, 14, 14, w - 28, w - 28, 24); g.stroke(); }
    if (name === 'dot') { const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w * 0.17); grd.addColorStop(0, '#fff'); grd.addColorStop(0.7, 'rgba(255,255,255,0.9)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, w, w); }
    if (name === 'ring') { g.strokeStyle = '#fff'; g.lineWidth = 16; g.beginPath(); g.arc(w / 2, w / 2, w * 0.4, 0, TAU); g.stroke(); }
    if (name === 'glow') { const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.5, 'rgba(255,255,255,0.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = grd; g.fillRect(0, 0, w, w); }
    if (name === 'rim') { g.strokeStyle = '#fff'; g.lineWidth = 34; W.roundRect(g, 22, 22, w - 44, w - 44, 30); g.stroke(); }
  }));
  const hlGeo = new THREE.PlaneGeometry(1, 1); hlGeo.rotateX(-Math.PI / 2);
  const hlPool = [];
  let hlUsed = 0;
  function hl(sq, color, alpha, shape, scale, glowy) {
    let m = hlPool[hlUsed];
    if (!m) { m = new THREE.Mesh(hlGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false })); m.renderOrder = 3; hlPool.push(m); fxGroup.add(m); }
    hlUsed++;
    m.visible = true;
    m.material.map = SHAPES[shape];
    m.material.color.set(color).multiplyScalar(glowy ? 1.6 : 1);
    m.material.opacity = alpha;
    m.material.blending = glowy ? THREE.AdditiveBlending : THREE.NormalBlending;
    m.scale.set(scale || 1, 1, scale || 1);
    m.position.set(sqX(sq), 0.004 + hlUsed * 0.0002, sqZ(sq));
    m.userData.pulse = shape === 4 ? { base: 0.65, amp: 0.3 } : null;
    m.userData.ripple = null;
    return m;
  }
  // A square the coach points at ("this glowing square is e4"). Light and dark squares on
  // every era board need it to read at a glance, so it never relies on adding light alone
  // (additive gold on a cream square just turns white): a dark rim, a saturated tint and a
  // solid bright frame carry it on light squares, the halo carries it on dark ones, and a
  // ripple keeps drawing the eye while animations are on.
  function spot(sq, color, pulse) {
    hl(sq, '#0b0603', 0.7, 5, 1.04);
    hl(sq, color, 0.62, 0, 0.9);
    const frame = hl(sq, color, 1, 5, 0.94);
    if (!pulse) return;
    hl(sq, color, 0.55, 4, 1.9, true).userData.pulse = { base: 0.45, amp: 0.25 };
    frame.userData.pulse = { base: 0.85, amp: 0.15 };
    hl(sq, color, 0.9, 3, 1, true).userData.ripple = true;
  }
  function drawHighlights() {
    hlUsed = 0;
    const h = highlights;
    if (h.lastFrom >= 0) hl(h.lastFrom, '#f0c26a', 0.22, 0);
    if (h.lastTo >= 0) { hl(h.lastTo, '#f0c26a', 0.28, 0); hl(h.lastTo, '#f6d58a', 0.7, 1); }
    if (h.hintFrom >= 0) spot(h.hintFrom, '#2fd8ff', true);
    if (h.hintTo >= 0) spot(h.hintTo, '#2fd8ff', h.hintFrom < 0 || h.hintFrom === undefined);
    for (const s of h.marks || []) hl(s.sq, s.color || '#3fe0c8', s.alpha || 0.45, s.shape === undefined ? 0 : s.shape);
    for (const s of h.spots || []) spot(s.sq, s.color || '#2fd8ff', s.pulse !== false);
    if (h.check >= 0) hl(h.check, '#ff3b30', 0.95, 4, 1.35, true);
    if (h.selected >= 0) { hl(h.selected, '#e9b65c', 0.32, 0); hl(h.selected, '#ffd27a', 0.9, 1, 1, true); }
    const cursor = dragging && dragging.moved ? dragging.over : hoverSq;
    if (cursor >= 0 && cursor !== h.selected) hl(cursor, '#fff1d6', 0.55, 1);
    // move dots: a soft dark well with a gold glint, readable on light and dark squares
    for (const t of h.targets || []) { hl(t, '#1a0d04', 0.55, 2, 1.1); hl(t, '#ffd27a', 0.9, 2, 0.52, true); }
    for (const t of h.captures || []) { hl(t, '#1a0d04', 0.35, 3, 1.02); hl(t, '#ff8aa0', 0.85, 3, 0.96, true); }
    for (let i = hlUsed; i < hlPool.length; i++) hlPool[i].visible = false;
  }
  const arrowMeshes = [];
  function drawArrows() {
    arrowMeshes.forEach((m) => { fxGroup.remove(m); m.geometry.dispose(); m.material.dispose(); });
    arrowMeshes.length = 0;
    for (const a of arrows) {
      const x0 = sqX(a.from), z0 = sqZ(a.from), x1 = sqX(a.to), z1 = sqZ(a.to);
      const knight = Math.abs((a.from & 7) - (a.to & 7)) * Math.abs((a.from >> 3) - (a.to >> 3)) === 2;
      const pts = knight ? [[x0, z0], Math.abs(x1 - x0) > Math.abs(z1 - z0) ? [x1, z0] : [x0, z1], [x1, z1]] : [[x0, z0], [x1, z1]];
      // drawn twice: a wider dark outline first, so a bright arrow still reads on cream squares
      for (const [k, col, op] of [[1.9, '#0b0603', 0.55], [1, null, a.alpha || 0.92]]) {
        const w = 0.085 * k * (a.width || 1), hw = 0.24 * (1 + (k - 1) * 0.35) * (a.width || 1), hlen = 0.36 + (k - 1) * 0.06;
        const pos = [];
        const tri = (ax, az, bx, bz, cx, cz) => pos.push(ax, 0, az, bx, 0, bz, cx, 0, cz);
        for (let i = 0; i < pts.length - 1; i++) {
          let [ax, az] = pts[i]; let [bx, bz] = pts[i + 1];
          const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l, nx = -uz, nz = ux;
          if (i === 0) { ax += ux * (0.25 - (k - 1) * 0.04); az += uz * (0.25 - (k - 1) * 0.04); }
          const last = i === pts.length - 2;
          if (last) { bx -= ux * 0.36; bz -= uz * 0.36; } else { bx += ux * w; bz += uz * w; }
          tri(ax + nx * w, az + nz * w, ax - nx * w, az - nz * w, bx - nx * w, bz - nz * w);
          tri(ax + nx * w, az + nz * w, bx - nx * w, bz - nz * w, bx + nx * w, bz + nz * w);
          if (last) tri(bx + nx * hw, bz + nz * hw, bx - nx * hw, bz - nz * hw, bx + ux * hlen, bz + uz * hlen);
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        const color = col ? new THREE.Color(col) : new THREE.Color(a.color || '#2fd8ff').multiplyScalar(1.15);
        const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
        m.position.y = col ? 0.011 : 0.012; m.renderOrder = col ? 3.5 : 4;
        fxGroup.add(m); arrowMeshes.push(m);
      }
    }
  }

  // ------------------------------------------------------------------ particles
  const MAXP = 900;
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 4), pSize = new Float32Array(MAXP), pShape = new Float32Array(MAXP);
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 4));
  pGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
  pGeo.setAttribute('shape', new THREE.BufferAttribute(pShape, 1));
  const pMat = (additive) => new THREE.ShaderMaterial({
    uniforms: { scale: { value: 600 } },
    vertexShader: `attribute vec4 color; attribute float size; attribute float shape; uniform float scale; varying vec4 vC; varying float vS;
      void main() { vC = color; vS = shape; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = size * scale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec4 vC; varying float vS;
      void main() { vec2 d = gl_PointCoord - 0.5; float a = vS > 0.5 ? step(max(abs(d.x), abs(d.y) * 1.6), 0.45) : smoothstep(0.5, 0.0, length(d)); if (a < 0.01) discard; gl_FragColor = vec4(vC.rgb, vC.a * a); }`,
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false,
  });
  const pAdd = new THREE.Points(pGeo, pMat(true)), pNorm = new THREE.Points(pGeo.clone(), pMat(false));
  pAdd.frustumCulled = false; pNorm.frustumCulled = false; pAdd.renderOrder = 6; pNorm.renderOrder = 5;
  scene.add(pAdd, pNorm);
  const lin = (h) => new THREE.Color(h);
  function spawn(kind, x, y, z, colors, count) {
    if (!animations) return;
    const cols = (colors || ['#ffffff']).map(lin);
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      if (particles.length >= MAXP - 2) break;
      const a = Math.random() * TAU, sp = Math.random();
      const c = cols[i % cols.length];
      const p = { x, y, z, vx: Math.cos(a) * sp, vy: 0, vz: Math.sin(a) * sp, born: now, life: 700, size: 0.06, color: c, alpha: 1, kind, square: false, add: true, g: 0, drag: 0.9 };
      if (kind === 'dust') { p.vx *= 1.3; p.vz *= 1.3; p.vy = 0.4 + Math.random() * 0.7; p.g = 2.2; p.life = 650; p.size = 0.05 + Math.random() * 0.05; p.add = false; p.alpha = 0.7; }
      else if (kind === 'sparks') { p.vx *= 3.2; p.vz *= 3.2; p.vy = 1.5 + Math.random() * 2.2; p.g = 6; p.life = 560; p.size = 0.035 + Math.random() * 0.03; }
      else if (kind === 'petals') { p.vx *= 1.2; p.vz *= 1.2; p.vy = 1.2 + Math.random() * 1.2; p.g = 1.4; p.life = 1300; p.size = 0.08; p.square = true; p.add = false; p.drag = 0.6; }
      else if (kind === 'ink') { p.vx *= 0.6; p.vz *= 0.6; p.vy = 0.5 + Math.random() * 0.6; p.g = -0.2; p.life = 900; p.size = 0.14 + Math.random() * 0.1; p.add = false; p.alpha = 0.5; p.grow = 1.8; }
      else if (kind === 'frost') { p.vx *= 1.6; p.vz *= 1.6; p.vy = 0.8 + Math.random(); p.g = 1.0; p.life = 900; p.size = 0.045 + Math.random() * 0.03; }
      else if (kind === 'confetti') { p.vx *= 2.5; p.vz *= 2.5; p.vy = 3.5 + Math.random() * 3; p.g = 4.2; p.life = 2800; p.size = 0.08; p.square = true; p.add = false; p.drag = 0.5; p.flutter = Math.random() * 6; }
      else if (kind === 'firework') { const e = Math.random() * Math.PI - Math.PI / 2; p.vx = Math.cos(a) * Math.cos(e) * 3; p.vz = Math.sin(a) * Math.cos(e) * 3; p.vy = Math.sin(e) * 3 + 0.6; p.g = 1.6; p.life = 1600; p.size = 0.06; }
      else if (kind === 'mote') { p.vx = (Math.random() - 0.5) * 0.05; p.vz = (Math.random() - 0.5) * 0.05; p.vy = 0.02 + Math.random() * 0.04; p.g = 0; p.life = 9000 + Math.random() * 6000; p.size = 0.03 + Math.random() * 0.03; p.alpha = 0.3; p.drag = 1; p.born = now - Math.random() * 4000; }
      else if (kind === 'trail') { p.vx *= 0.15; p.vz *= 0.15; p.vy = 0.15; p.g = 0; p.life = 450; p.size = 0.07; p.alpha = 0.7; }
      particles.push(p);
    }
    requestRender();
  }
  function stepParticles(now, dt) {
    particles = particles.filter((p) => now - p.born < p.life);
    for (const p of particles) {
      if (now < p.born) continue;
      p.vy -= p.g * dt;
      const d = Math.pow(p.drag, dt * 4);
      p.vx *= d; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.flutter) p.x += Math.sin(now / 200 + p.flutter) * dt * 0.4;
      if (p.y < 0.01 && p.kind !== 'mote') { p.y = 0.01; p.vy *= -0.25; p.vx *= 0.6; p.vz *= 0.6; }
    }
    if (motesOn() && particles.filter((p) => p.kind === 'mote').length < 80) {
      const n = 80 - particles.filter((p) => p.kind === 'mote').length;
      for (let i = 0; i < n; i++) spawn('mote', (Math.random() - 0.5) * 14, 0.3 + Math.random() * 6, (Math.random() - 0.5) * 14, ['#ffd8a8'], 1);
    }
  }
  function uploadParticles(now) {
    const A = pAdd.geometry, N = pNorm.geometry;
    const fill = (geo, list) => {
      const pos = geo.attributes.position.array, col = geo.attributes.color.array, size = geo.attributes.size.array, shape = geo.attributes.shape.array;
      let n = 0;
      for (const p of list) {
        if (now < p.born) continue;
        const t = (now - p.born) / p.life, fade = p.kind === 'mote' ? Math.sin(Math.PI * t) : 1 - t * t;
        pos[n * 3] = p.x; pos[n * 3 + 1] = p.y; pos[n * 3 + 2] = p.z;
        const boost = p.add ? 2.2 : 1;
        col[n * 4] = p.color.r * boost; col[n * 4 + 1] = p.color.g * boost; col[n * 4 + 2] = p.color.b * boost; col[n * 4 + 3] = p.alpha * fade;
        size[n] = p.size * (p.grow ? 1 + t * p.grow : 1); shape[n] = p.square ? 1 : 0;
        n++;
      }
      geo.setDrawRange(0, n);
      ['position', 'color', 'size', 'shape'].forEach((k) => { geo.attributes[k].needsUpdate = true; });
    };
    fill(A, particles.filter((p) => p.add));
    fill(N, particles.filter((p) => !p.add));
  }
  const motesOn = () => hq() && lvl() < 4 && animations && !window.__SHOT;

  // ------------------------------------------------------------------ camera
  // The camera orbits the table. Its distance is fitted so the board, and the tallest pieces
  // on the far rank, fill the free part of the screen (what the HUD leaves, as insets in CSS
  // px), and the view is offset so the board sits in the middle of that space. On tall phone
  // screens the lens widens rather than backing the camera out of the room.
  const cam = { yaw: 0, pitch: 0.8, zoom: 1, lookY: 0, lookZ: 0, tYaw: 0, tPitch: 0.8, tZoom: 1, tLookY: 0, tLookZ: 0, intro: null,
    ins: { top: 0, right: 0, bottom: 0, left: 0 }, tIns: { top: 0, right: 0, bottom: 0, left: 0 } };
  if (window.__SHOT) { window.__cam = cam; window.__scene = scene; }   // screenshot tooling reads the camera and scene
  const FIT = [], FIT_TALL = [];
  for (const x of [-5.05, 5.05]) for (const z of [-5.05, 5.05]) FIT.push([x, 0.06, z], [x, -0.46, z]);
  for (const z of [-3.5, 3.5]) FIT.push([-0.5, 1.62, z], [0.5, 1.62, z], [-3.5, 0.97, z], [3.5, 0.97, z]);
  // on tall screens the capture trays in front of each player belong in the frame too
  FIT_TALL.push(...FIT);
  for (const x of [-2.75, 2.75]) for (const z of [-7.0, 7.0]) FIT_TALL.push([x, -0.3, z]);
  const fitCam = new THREE.PerspectiveCamera(), fitV = new THREE.Vector3(), fitCache = new Map();
  function extent(pitch, d, lookY) {
    fitCam.position.set(0, Math.sin(pitch) * d + lookY, Math.cos(pitch) * d);
    fitCam.lookAt(0, lookY, 0); fitCam.updateMatrixWorld();
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (const p of layoutPortrait ? FIT_TALL : FIT) {
      fitV.set(p[0], p[1], p[2]).project(fitCam);
      if (fitV.x < x0) x0 = fitV.x; if (fitV.x > x1) x1 = fitV.x; if (fitV.y < y0) y0 = fitV.y; if (fitV.y > y1) y1 = fitV.y;
    }
    return [x0, x1, y0, y1];
  }
  function fitView(pitch, lookY, ins, W, H) {
    const k = [layoutPortrait, Math.round(pitch * 500), Math.round(lookY * 100), Math.round(ins.top), Math.round(ins.right), Math.round(ins.bottom), Math.round(ins.left), W, H].join();
    let f = fitCache.get(k);
    if (f) return f;
    const fw = Math.max(60, W - ins.left - ins.right), fh = Math.max(60, H - ins.top - ins.bottom);
    const m = Math.min(fw, fh) * 0.03;
    const ax = (fw / 2 - m) / (W / 2), ay = (fh / 2 - m) / (H / 2);
    fitCam.aspect = W / H;
    let fov = 34, dist = 0;
    for (;;) {
      fitCam.fov = fov; fitCam.updateProjectionMatrix();
      let lo = 3, hi = 90;
      for (let i = 0; i < 22; i++) {
        const mid = (lo + hi) / 2, e = extent(pitch, mid, lookY);
        if (e[1] - e[0] <= 2 * ax && e[3] - e[2] <= 2 * ay) hi = mid; else lo = mid;
      }
      dist = hi;
      // steep views may rise above the ceiling (it is only drawn from below); low ones stay inside
      if (dist <= (pitch > 0.9 ? 23 : 16) || fov >= 70) break;
      fov += 4;
    }
    const e = extent(pitch, dist, lookY);
    const fcx = ((ins.left + fw / 2) / W) * 2 - 1, fcy = 1 - ((ins.top + fh / 2) / H) * 2;
    f = { dist, fov, ox: (e[0] + e[1]) / 2 - fcx, oy: (e[2] + e[3]) / 2 - fcy };
    if (fitCache.size > 500) fitCache.clear();
    fitCache.set(k, f);
    return f;
  }
  function applyCamera() {
    const W = canvas.clientWidth || 1, H = canvas.clientHeight || 1;
    const f = fitView(cam.pitch, cam.lookY, cam.ins, W, H);
    const d = f.dist * cam.zoom, cp = Math.cos(cam.pitch);
    // lookZ slides the point the camera turns around toward the near side of the table
    const tx = Math.sin(cam.yaw) * cam.lookZ, tz = Math.cos(cam.yaw) * cam.lookZ;
    camera.position.set(tx + Math.sin(cam.yaw) * cp * d, Math.sin(cam.pitch) * d + cam.lookY, tz + Math.cos(cam.yaw) * cp * d);
    camera.lookAt(tx, cam.lookY, tz);
    camera.fov = f.fov; camera.aspect = W / H;
    camera.setViewOffset(W, H, (f.ox * W) / 2, (-f.oy * H) / 2, W, H);
    camera.updateProjectionMatrix();
    // the chandelier steps aside when it would hang between the camera and the board
    if (room && room.chandelier) {
      const c = camera.position, cy = room.chandelierY;
      let hide = false;
      if (c.y > cy - 1.2) {
        for (const [x, z] of [[0, 0], [4, 4], [-4, 4], [4, -4], [-4, -4], [0, 6.6], [0, -6.6], [2.7, 6.6], [-2.7, -6.6]]) {
          for (const h of [cy - 0.9, cy + 1]) {
            if (c.y <= h) continue;
            const t = (c.y - h) / c.y, px = c.x + (x - c.x) * t, pz = c.z + (z - c.z) * t;
            if (px * px + pz * pz < 3.0 * 3.0) { hide = true; break; }
          }
          if (hide) break;
        }
      }
      if (room.chandelier.visible === hide) { room.chandelier.visible = !hide; dirtyShadows(); }
    }
  }
  const portraitNow = () => (canvas.clientWidth || 1) / (canvas.clientHeight || 1) < 0.8;

  // ------------------------------------------------------------------ animation loop
  let raf = 0, lastFrame = 0, ambientTimer = 0, paused = false, glLost = false;
  function step(now) {
    const dt = Math.min(0.05, (now - (lastFrame || now)) / 1000);
    lastFrame = now;
    let busy = false;
    if (cam.intro) {
      const t = clamp01((now - cam.intro.start) / cam.intro.dur), e = easeInOut(t);
      cam.yaw = cam.intro.fYaw + (cam.tYaw - cam.intro.fYaw) * e;
      cam.pitch = cam.intro.fPitch + (cam.tPitch - cam.intro.fPitch) * e;
      cam.zoom = cam.intro.fZoom + (cam.tZoom - cam.intro.fZoom) * e;
      if (t >= 1) cam.intro = null;
      busy = true;
    } else {
      // the idle orbit turns the camera directly, so it runs on the calm ambient timer
      if (attract && !window.__SHOT && !paused) { cam.tYaw += dt * 0.06; cam.yaw += dt * 0.06; }
      for (const k of ['yaw', 'pitch', 'zoom', 'lookY', 'lookZ']) {
        const t = 't' + k[0].toUpperCase() + k.slice(1);
        const d = cam[t] - cam[k];
        if (Math.abs(d) > 0.0005) { cam[k] += d * Math.min(1, dt * 7); busy = true; } else cam[k] = cam[t];
      }
    }
    for (const k of ['top', 'right', 'bottom', 'left']) {
      const d = cam.tIns[k] - cam.ins[k];
      if (Math.abs(d) > 0.5) { cam.ins[k] += d * Math.min(1, dt * 7); busy = true; } else cam.ins[k] = cam.tIns[k];
    }
    for (const s of sprites.concat(graveyard)) {
      const target = s.selected ? 0.16 : s.hover ? 0.06 : 0;
      if (Math.abs(s.lift - target) > 0.002) { s.lift += (target - s.lift) * Math.min(1, dt * 14); busy = true; } else s.lift = target;
      const a = s.anim;
      if (a) {
        if (now < a.start) { busy = true; placeSprite(s); continue; }
        const t = clamp01((now - a.start) / a.dur);
        if (a.type === 'move') {
          const e = easeOut(t);
          s.x = a.fx + (a.tx - a.fx) * e; s.z = a.fz + (a.tz - a.fz) * e;
          s.y = a.fy * (1 - e) + Math.sin(Math.PI * Math.min(1, t * 1.08)) * a.arc;
          if (fx.trail && t < 0.9 && Math.random() < 0.6) spawn('trail', s.x, s.y + 0.15, s.z, fx.trail.colors, 1);
          if (t >= 1 && a.promoteTo) { s.piece = a.promoteTo; rebuildSprite(s); spawn('sparks', s.x, 0.6, s.z, ['#ffe28a', '#ffffff'], 46); }
          if (t >= 1 && a.land) a.land();
        } else if (a.type === 'grave') {
          const e = easeInOut(t);
          s.x = a.fx + (a.tx - a.fx) * e; s.z = a.fz + (a.tz - a.fz) * e;
          s.y = Math.sin(Math.PI * t) * 1.2 + (TRAY_Y) * e * 0; s.grave = t > 0.5;
          if (s.grave) s.y -= 0;
          s.scale = 1 - 0.28 * e; s.yaw = a.fyaw + e * Math.PI * 1.5;
        } else if (a.type === 'topple') {
          s.tilt = a.to * (1 - Math.pow(1 - t, 3)) + Math.sin(t * Math.PI * 3) * 0.04 * (1 - t);
        } else if (a.type === 'glow') {
          s.glow = Math.sin(Math.PI * Math.min(1, t * 2));
        } else if (a.type === 'hop') {
          s.y = Math.sin(Math.PI * t) * 0.35;
        } else if (a.type === 'back') {
          const e = easeOut(t);
          s.x = a.fx + (a.tx - a.fx) * e; s.z = a.fz + (a.tz - a.fz) * e; s.y = a.fy * (1 - e);
        }
        if (t < 1) busy = true;
        else { s.anim = null; if (a.done) a.done(); }
      }
      placeSprite(s);
    }
    if (particles.length || motesOn()) { stepParticles(now, dt); busy = busy || particles.some((p) => p.kind !== 'mote'); }
    if (clockState && clockState.running) busy = true;
    return busy;
  }
  const pulsing = () => (highlights.spots && highlights.spots.some((s) => s.pulse !== false)) || highlights.hintFrom >= 0 || highlights.hintTo >= 0;
  const ambient = () => !paused && !window.__SHOT && (attract || motesOn() || particles.length > 0 || ((highlights.check >= 0 || pulsing()) && animations) || (room && room.flames.length && animations && quality === 'high'));
  function render(now) {
    applyCamera();
    if (room && animations) room.update(now / 1000);
    for (const m of hlPool) {
      if (!m.visible) continue;
      const p = m.userData.pulse;
      if (p) m.material.opacity = p.base + p.amp * Math.sin(now / 160);
      if (m.userData.ripple) {
        // one ring every 1.4 s, growing from inside the square out past its edge as it fades
        const t = animations ? (now % 1400) / 1400 : 0.35;
        m.scale.set(0.7 + t * 0.9, 1, 0.7 + t * 0.9); m.material.opacity = 0.95 * (1 - t);
      }
    }
    drawClock();
    uploadParticles(now);
    renderReflection();
    // set after the reflection pass: that one only sees the pieces' layer, and a shadow map
    // drawn there would be missing the board and the clock
    if (shadowDirty) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
    if (composer) composer.render(); else renderer.render(scene, camera);
  }
  // the idle frame gap: 30 fps on full detail, 20 fps on phones and slower machines, 15 at the
  // bottom levels (candle flicker and the slow orbit don't need more)
  const ambientMs = () => (lvl() >= 3 ? 66 : lvl() >= 1 ? 50 : 33);
  function frame(now) {
    raf = 0;
    if (glLost) return;
    const t0 = performance.now();
    const busy = step(now);
    render(now);
    govern(t0 - reqAt, performance.now() - t0);
    if (busy) requestRender();
    else if (ambient() && !ambientTimer && !document.hidden) {
      // Candle flicker, dust in the light and the idle orbit run on a calm timer.
      ambientTimer = setTimeout(() => { ambientTimer = 0; requestRender(); }, ambientMs());
    }
  }
  let reqAt = 0;
  function requestRender() { if (!raf && !glLost) { reqAt = performance.now(); raf = requestAnimationFrame(frame); } }
  // Watches what each frame costs: how long the browser held it back after it was asked for
  // (that grows when the GPU falls behind) plus the time spent drawing it. When the average
  // stays more than ~22 ms over one display frame for 40 frames, the performance level steps
  // up. Single slow frames (shaders compiling for a new room) are capped so they can't do it
  // alone, and the level never steps back down in a session, so the view doesn't flicker.
  let govLate = 0, govN = 0;
  function govern(waitMs, drawMs) {
    if (window.__SHOT || fullDetail || document.hidden || perf >= MAX_PERF) { govN = 0; return; }
    const late = Math.min(80, Math.max(0, waitMs + drawMs - 17));
    govLate = govN ? govLate * 0.94 + late * 0.06 : late;
    if (++govN >= 40 && govLate > 22) { setPerf(perf + 1); govN = 0; }
  }
  function shadowQuality() {
    const full = hq() && lvl() < 3;
    renderer.shadowMap.type = full ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    const size = full ? 2048 : 1024;
    if (key.shadow.mapSize.x !== size) {
      key.shadow.mapSize.set(size, size);
      if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
    }
    dirtyShadows();
  }
  function setPerf(level) {
    level = Math.max(0, Math.min(MAX_PERF, level));
    if (level === perf) return;
    const hadBloom = bloomOn(), hadLvl = lvl();
    perf = level;
    detailChanged(hadBloom, hadLvl);
  }
  function setFullDetail(on) {
    on = !!on;
    if (on === fullDetail) return;
    const hadBloom = bloomOn(), hadLvl = lvl();
    fullDetail = on;
    govN = 0;
    for (const sp of sprites.concat(graveyard)) if (sp.obj) rebuildSprite(sp);
    detailChanged(hadBloom, hadLvl);
  }
  function detailChanged(hadBloom, hadLvl) {
    // MSAA changes between levels 1 and 2, and the composer's target has to be rebuilt for it
    if (bloomOn() !== hadBloom || (composer && (hadLvl >= 2) !== (lvl() >= 2))) buildComposer();
    if (!motesOn()) particles = particles.filter((p) => p.kind !== 'mote');
    shadowQuality();
    lastW = 0; resize();
    opts.onPerf(perf);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) requestRender(); });

  // ------------------------------------------------------------------ input
  const raycaster = new THREE.Raycaster();
  const pointers = new Map();
  let drag = null, pinch = 0;
  const ZOOM_MIN = 0.42;   // close enough to look a piece in the eye, still outside it
  function ndc(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, 1 - ((clientY - r.top) / r.height) * 2);
  }
  function groundPoint(clientX, clientY, y) {
    applyCamera(); camera.updateMatrixWorld();
    raycaster.setFromCamera(ndc(clientX, clientY), camera);
    const ray = raycaster.ray;
    if (ray.direction.y >= -1e-4) return null;
    const k = ((y || 0) - ray.origin.y) / ray.direction.y;
    return [ray.origin.x + ray.direction.x * k, ray.origin.z + ray.direction.z * k];
  }
  const sqAt = (x, z) => { const file = Math.floor(x + 4), rank = Math.floor(4 - z); return file >= 0 && file < 8 && rank >= 0 && rank < 8 ? rank * 8 + file : -1; };
  function pick(clientX, clientY) {
    applyCamera(); camera.updateMatrixWorld();
    raycaster.setFromCamera(ndc(clientX, clientY), camera);
    const live = sprites.filter((s) => s.obj && !s.dead);
    const hits = raycaster.intersectObjects(live.map((s) => s.obj), true);
    if (hits.length) {
      let o = hits[0].object; while (o && !live.some((s) => s.obj === o)) o = o.parent;
      const s = live.find((x) => x.obj === o);
      if (s) return s.sq;
    }
    const g = groundPoint(clientX, clientY, 0);
    return g ? sqAt(g[0], g[1]) : -1;
  }
  function setHover(sq) {
    if (sq === hoverSq) return;
    hoverSq = sq;
    for (const s of sprites) s.hover = s.sq === sq && opts.canDrag(sq);
    drawHighlights();
    canvas.style.cursor = sq >= 0 && opts.canDrag(sq) ? 'grab' : '';
    requestRender();
  }
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1) {
      const sq = pick(e.clientX, e.clientY);
      const sprite = sq >= 0 ? sprites.find((s) => s.sq === sq && !s.dead && !s.anim) : null;
      if (sprite && opts.canDrag(sq)) {
        dragging = { sq, sprite, x: e.clientX, y: e.clientY, moved: false, over: sq };
        opts.onSquare(sq, 'down');
      } else drag = { x: e.clientX, y: e.clientY, moved: false };
    }
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); drag = null; if (dragging) cancelDrag(); }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) {
      if (e.pointerType === 'mouse') setHover(pick(e.clientX, e.clientY));
      return;
    }
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) cam.tZoom = Math.min(1.6, Math.max(ZOOM_MIN, cam.tZoom * (pinch / d)));
      pinch = d; requestRender();
      return;
    }
    if (dragging) {
      if (!dragging.moved && Math.hypot(e.clientX - dragging.x, e.clientY - dragging.y) < 6) return;
      dragging.moved = true;
      canvas.style.cursor = 'grabbing';
      const g = groundPoint(e.clientX, e.clientY, 0.35);
      if (g) {
        dragging.sprite.x = Math.max(-4.4, Math.min(4.4, g[0])); dragging.sprite.z = Math.max(-4.4, Math.min(4.4, g[1]));
        dragging.sprite.y = 0.35;
        dragging.over = sqAt(dragging.sprite.x, dragging.sprite.z);
        drawHighlights();
      }
      requestRender();
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 7) return;
    drag.moved = true;
    cam.intro = null;
    cam.tYaw -= dx * 0.008; cam.tPitch = Math.min(1.54, Math.max(0.3, cam.tPitch + dy * 0.006));
    cam.yaw = cam.tYaw; cam.pitch = cam.tPitch;
    drag.x = e.clientX; drag.y = e.clientY;
    requestRender();
  });
  function cancelDrag() {
    if (!dragging) return;
    const s = dragging.sprite;
    s.anim = { type: 'back', start: performance.now(), dur: 170, fx: s.x, fz: s.z, fy: s.y, tx: sqX(s.sq), tz: sqZ(s.sq) };
    dragging = null;
    drawHighlights();
    requestRender();
  }
  const end = (e) => {
    pointers.delete(e.pointerId);
    if (dragging && pointers.size === 0) {
      const d = dragging;
      if (d.moved) {
        const to = d.over;
        dragging = null;
        if (!(to >= 0 && to !== d.sq && opts.onDrop(d.sq, to))) { dragging = d; cancelDrag(); }
      } else dragging = null;
      canvas.style.cursor = '';
    } else if (drag && !drag.moved && pointers.size === 0) {
      const sq = pick(e.clientX, e.clientY);
      if (sq >= 0) opts.onSquare(sq, 'click');
    }
    if (pointers.size === 0) { drag = null; pinch = 0; }
    requestRender();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); drag = null; pinch = 0; cancelDrag(); });
  canvas.addEventListener('pointerleave', () => setHover(-1));
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    // Trackpads (and their pinch, which arrives as ctrl+wheel) send many small steps, a mouse
    // wheel a few big ones: zoom by how far it scrolled, not by how many events came.
    const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1) * (e.ctrlKey ? 4 : 1);
    cam.tZoom = Math.min(1.6, Math.max(ZOOM_MIN, cam.tZoom * Math.exp(Math.max(-120, Math.min(120, px)) * 0.0012)));
    requestRender();
  }, { passive: false });
  // Safari's own pinch gesture would zoom the page under the table.
  canvas.addEventListener('gesturestart', (e) => e.preventDefault());
  // If the GPU drops the context (memory pressure, a driver reset, the tab in the background),
  // three.js rebuilds its state when the browser gives it back. What lived only in GPU memory
  // is drawn again here: the room's reflection map and the shadows. The table then steps
  // down a performance level, since running out of memory is the usual cause.
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    glLost = true;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (ambientTimer) { clearTimeout(ambientTimer); ambientTimer = 0; }
    // let go of what belonged to the old context now, while deleting it is still a no-op
    W.resetEnvironments(renderer);
    if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
    disposeComposer();
    if (reflRT) { reflRT.dispose(); reflRT = null; }
    opts.onContextLost();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    glLost = false;
    if (room) scene.environment = W.environment(renderer, room.env);
    clockKey = '';
    if (!window.__SHOT) perf = Math.min(MAX_PERF, perf + 1);
    buildComposer();
    shadowQuality();
    lastW = 0; resize();
    opts.onContextRestored();
    opts.onPerf(perf);
    requestRender();
  });

  // ------------------------------------------------------------------ sizing
  let lastW = 0, lastH = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, fullDetail ? 2 : PERF_DPR[quality][perf]);
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    if (w !== lastW || h !== lastH || renderer.getPixelRatio() !== dpr) {
      lastW = w; lastH = h;
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      if (composer) sizeComposer(); else if (bloomOn()) buildComposer();
      const rw = Math.max(1, Math.round(w * dpr / 2)), rh = Math.max(1, Math.round(h * dpr / 2));
      if (!reflectOn()) { if (reflRT) { reflRT.dispose(); reflRT = null; } }
      else if (reflRT) reflRT.setSize(rw, rh);
      else reflRT = new THREE.WebGLRenderTarget(rw, rh, { type: THREE.HalfFloatType });
      reflMat.uniforms.tRefl.value = reflRT ? reflRT.texture : null;
      reflPlane.visible = !!reflRT;
      pAdd.material.uniforms.scale.value = pNorm.material.uniforms.scale.value = h * dpr * 0.9;
    }
    // Tall screens put the capture trays in front of each player instead of beside the board.
    const portrait = portraitNow();
    if (portrait !== layoutPortrait) { layoutPortrait = portrait; placeTrays(); relayoutGrave(); placeClock(); }
    requestRender();
  }
  new ResizeObserver(resize).observe(canvas);

  // ------------------------------------------------------------------ captured pieces
  function settleGrave(captured) {
    graveyard.forEach(dropSprite);
    graveyard = [];
    for (const capturer of [1, -1]) {
      const list = (captured && captured[capturer > 0 ? 'byWhite' : 'byBlack']) || [];
      list.forEach((piece, i) => {
        const [x, z] = gravePos(capturer, i);
        const s = makeSprite(piece, -1);
        s.x = x; s.z = z; s.scale = 0.72; s.grave = true; s.yaw = graveYaw(capturer); s.cap = capturer; s.gi = i;
        placeSprite(s);
        graveyard.push(s);
      });
    }
  }

  // ------------------------------------------------------------------ snapshots for menus
  // Renders a set, board or room into an image (data URL) for cards and the collection.
  // Pictures are kept in memory and, between visits, in the browser's IndexedDB under the look
  // of the 3D code (CHACKLATE_LOOK_ID, made by the build from the 3D sources, so a change to a
  // piece, board or room draws them again). New ones are drawn one at a time with a pause
  // between them, so the menu keeps answering; one nobody waits for any more (its card was
  // closed or its tab left) is skipped. wanted() says whether it is still waited for.
  const LOOK_ID = typeof CHACKLATE_LOOK_ID !== 'undefined' ? CHACKLATE_LOOK_ID : 'dev';
  const snapCache = new Map(), snapPending = new Map();
  let snapQueue = Promise.resolve(), snapDB = null;
  function snapshot(spec, w, h, wanted) {
    const keyS = JSON.stringify([spec, w, h]);
    if (snapCache.has(keyS)) return Promise.resolve(snapCache.get(keyS));
    if (snapPending.has(keyS)) return snapPending.get(keyS);
    const keep = (blob) => { const url = URL.createObjectURL(blob); snapCache.set(keyS, url); return url; };
    const p = snapGet(keyS).then((blob) => {
      if (blob) return keep(blob);
      const turn = snapQueue.then(() => (wanted && !wanted() ? null : new Promise((res) => {
        let made;
        try { made = renderSnapshot(spec, w, h); } catch (e) { made = Promise.resolve(null); }
        made.then((b) => { if (b) snapPut(keyS, b); res(b ? keep(b) : null); }, () => res(null));
      })));
      snapQueue = turn.then(breath, breath);
      return turn;
    });
    snapPending.set(keyS, p);
    p.then(() => snapPending.delete(keyS), () => snapPending.delete(keyS));
    return p;
  }
  const breath = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 150 }) : setTimeout(r, 40)));
  function openSnapDB() {
    if (snapDB) return snapDB;
    snapDB = new Promise((res) => {
      if (!window.indexedDB) return res(null);
      try {
        const rq = indexedDB.open('chacklate-pictures', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('snaps');
        rq.onerror = rq.onblocked = () => res(null);
        rq.onsuccess = () => {
          const db = rq.result, tx = db.transaction('snaps', 'readwrite'), st = tx.objectStore('snaps');
          // pictures of an older look are thrown away
          const look = st.get('__look');
          look.onsuccess = () => { if (look.result !== LOOK_ID) { st.clear(); st.put(LOOK_ID, '__look'); } };
          tx.oncomplete = () => res(db);
          tx.onerror = tx.onabort = () => res(null);
        };
      } catch (e) { res(null); }
    });
    return snapDB;
  }
  const snapGet = (k) => openSnapDB().then((db) => (db ? new Promise((res) => {
    try { const r = db.transaction('snaps').objectStore('snaps').get(k); r.onsuccess = () => res(r.result instanceof Blob ? r.result : null); r.onerror = () => res(null); } catch (e) { res(null); }
  }) : null));
  const snapPut = (k, blob) => openSnapDB().then((db) => { try { if (db) db.transaction('snaps', 'readwrite').objectStore('snaps').put(blob, k); } catch (e) { /* storage full or private mode */ } });
  // The tone curve (ACES, graded 10% brighter) and sRGB encoding, for each 8-bit value.
  const SNAP_LUT = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * 1.1, t = Math.max(0, Math.min(1, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)));
    SNAP_LUT[i] = Math.round((t <= 0.0031308 ? 12.92 * t : 1.055 * Math.pow(t, 1 / 2.4) - 0.055) * 255);
  }
  // Builds the little scene for a set, a piece, a board or a room. envFor(style) gives the
  // reflection map for the renderer that will draw it (each GPU context needs its own).
  function buildSpec(spec, w, h, envFor) {
    const s2 = new THREE.Scene();
    s2.environment = envFor((W.ROOMS[roomId] || W.ROOMS.salon).env);
    s2.environmentIntensity = 0.95;
    const c2 = new THREE.PerspectiveCamera(spec.fov || 24, w / h, 0.05, 100);
    const l = new THREE.DirectionalLight('#fff0dd', 2.2); l.position.set(-3, 6, 5); s2.add(l);
    const r2 = new THREE.DirectionalLight('#ffd9a8', 1.1); r2.position.set(4, 3, -5); s2.add(r2);
    s2.add(new THREE.HemisphereLight('#ffe8d0', '#20120a', 0.4));
    const disposeList = [], look = new THREE.Vector3();
    if (spec.kind === 'pieces' || spec.kind === 'piece') {
      const types = spec.kind === 'piece' ? [spec.type || 'k'] : ['r', 'n', 'b', 'q', 'k', 'p'];
      const sides = spec.kind === 'piece' ? [spec.side || 'w'] : ['w', 'b'];
      sides.forEach((side, row) => types.forEach((t, i) => {
        const g = P.make(spec.set, t, side, spec.detail);
        g.position.set((i - (types.length - 1) / 2) * 0.78, 0, row ? -0.85 : 0.2);
        g.rotation.y = t === 'n' ? (side === 'w' ? -1.2 : -1.9) : t === 'b' ? 0.6 : 0;
        s2.add(g);
      }));
      if (spec.kind === 'piece') { const ht = P.HEIGHT[types[0]] || 1; c2.position.set(0.25 * ht, ht * 0.75, ht * 2.9 + 0.5); look.set(0, ht * 0.48, 0); }
      else { c2.position.set(0, 1.9, 6.0); look.set(0, 0.55, -0.3); }
      const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshPhysicalMaterial({ color: '#1e130d', roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.15 }));
      floor.rotation.x = -Math.PI / 2; s2.add(floor); disposeList.push(floor);
      s2.background = null;
    } else if (spec.kind === 'vignette') {
      // A few pieces on a velvet plinth with a gold rim, for menu cards.
      const gold = new THREE.MeshPhysicalMaterial({ color: '#e2b35e', metalness: 1, roughness: 0.24, clearcoat: 0.4 });
      const felt = new THREE.MeshPhysicalMaterial({ color: spec.felt || '#5c1428', roughness: 0.9, sheen: 1, sheenColor: new THREE.Color(spec.sheen || '#ff9cb8'), sheenRoughness: 0.45 });
      const R = spec.r || 1.3;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.12, 72), felt); top.position.y = -0.06;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.055, 18, 120), gold); rim.rotation.x = Math.PI / 2;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.06, R * 0.86, 0.22, 72), gold); base.position.y = -0.23;
      const foot = new THREE.Mesh(new THREE.TorusGeometry(R * 0.86, 0.04, 14, 96), gold); foot.rotation.x = Math.PI / 2; foot.position.y = -0.34;
      for (const m of [top, rim, base, foot]) { s2.add(m); disposeList.push(m); }
      (spec.items || []).forEach((it) => {
        const g = P.make(it.set || setId, it.type || 'k', it.side || 'w', spec.detail);
        g.position.set(it.x || 0, it.y || 0, it.z || 0);
        g.rotation.set(0, it.rot || 0, it.tilt || 0, 'YXZ');
        if (it.scale) g.scale.setScalar(it.scale);
        s2.add(g);
      });
      const tall = Math.max(0.8, ...(spec.items || []).map((it) => (P.HEIGHT[it.type || 'k'] || 1) * (it.scale || 1)));
      c2.fov = spec.fov || 23;
      c2.position.set(0, 1.3 + tall * 0.55, 6.8);
      look.set(0, tall * 0.45 - 0.1, 0);
      s2.background = null;
    } else if (spec.kind === 'room') {
      // The room from a seat at the table, with the board set up, for the collection.
      const rm = W.room(spec.room);
      s2.add(rm.group); disposeList.push({ userData: { dispose: rm.dispose } });
      s2.environment = envFor(rm.env);
      s2.background = new THREE.Color(rm.fog);
      s2.fog = new THREE.FogExp2(rm.fog, 0.018);
      const cl = new THREE.PointLight(rm.lights.color, rm.lights.chand, 40, 2); cl.position.set(0, 7.2, 0); s2.add(cl);
      s2.add(new THREE.HemisphereLight(rm.hemi[0], rm.hemi[1], Math.max(0, rm.lights.hemi - 0.4)));
      const b = W.board(spec.board || boardId, 'white'); s2.add(b); disposeList.push(b);
      [['r', 'w', -3.5, 3.5], ['k', 'w', 0.5, 3.5], ['q', 'w', -0.5, 3.5], ['n', 'w', 1.5, 1.5], ['k', 'b', 0.5, -3.5], ['q', 'b', -0.5, -3.5], ['r', 'b', 3.5, -3.5], ['b', 'b', -1.5, -2.5]].forEach(([t, side, x, z]) => {
        const g = P.make(setId, t, side, 'play'); g.position.set(x, 0, z); if (side === 'b') g.rotation.y = Math.PI; s2.add(g);
      });
      c2.fov = spec.fov || 46;
      c2.position.set(5.5, 5.2, 12.5);
      look.set(0, 1.6, -2);
    } else if (spec.kind === 'board') {
      const b = W.board(spec.board, 'white'); s2.add(b); disposeList.push(b);
      const g = P.make(setId, 'k', 'w', 'play'); g.position.set(-0.5, 0, 0.5); s2.add(g);
      const g2 = P.make(setId, 'n', 'b', 'play'); g2.position.set(0.5, 0, -0.5); g2.rotation.y = -0.9; s2.add(g2);
      // back far enough that both pieces fit, with the frame and its letters in front
      c2.position.set(3.0, 5.6, 11.2); look.set(0, 0.35, 1.6);
    }
    c2.lookAt(look);
    c2.aspect = w / h; c2.updateProjectionMatrix();
    // everything but the lights turns together on the live stage
    const spin = new THREE.Group();
    s2.children.filter((o) => !o.isLight).forEach((o) => spin.add(o));
    s2.add(spin);
    const dispose = () => disposeList.forEach((o) => {
      if (o.userData && o.userData.dispose) o.userData.dispose();
      else o.traverse((m) => { if (m.geometry) m.geometry.dispose(); });
    });
    return { scene: s2, camera: c2, look, spin, dispose };
  }
  // The scene's shaders are compiled first without holding up the page (where the browser can
  // compile in the background), then it is drawn on the next frame.
  function renderSnapshot(spec, w, h) {
    const built = buildSpec(spec, w, h, (style) => W.environment(renderer, style));
    const ready = renderer.compileAsync ? renderer.compileAsync(built.scene, built.camera).catch(() => {}) : Promise.resolve();
    return ready.then(() => new Promise((res) => requestAnimationFrame(() => {
      if (glLost) { built.dispose(); res(null); return; }
      try { drawSnapshot(built, w, h).then(res, () => res(null)); } catch (e) { res(null); }
    })));
  }
  function drawSnapshot({ scene: s2, camera: c2, dispose }, w, h) {
    const rt = new THREE.WebGLRenderTarget(w, h, { samples: 4 });
    const prevT = renderer.toneMapping;
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0); renderer.clear();
    renderer.render(s2, c2);
    const px = new Uint8Array(w * h * 4);
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
    renderer.setRenderTarget(null);
    renderer.setClearColor('#120a07', 1);
    renderer.toneMapping = prevT;
    rt.dispose();
    dispose();
    // render targets are linear: tone map and encode in the copy, rows flipped
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const g = cv.getContext('2d'), img = g.createImageData(w, h), out = img.data, row = w * 4;
    for (let y = 0; y < h; y++) {
      for (let si = (h - 1 - y) * row, di = y * row, end = di + row; di < end; si += 4, di += 4) {
        out[di] = SNAP_LUT[px[si]]; out[di + 1] = SNAP_LUT[px[si + 1]]; out[di + 2] = SNAP_LUT[px[si + 2]]; out[di + 3] = px[si + 3];
      }
    }
    g.putImageData(img, 0, 0);
    // encoded off the main thread; WebP where the browser can write it, PNG elsewhere
    return new Promise((res) => cv.toBlob((b) => res(b), 'image/webp', 0.92));
  }

  // ------------------------------------------------------------------ live stage
  // The museum card's model: the same little scene as the card picture, drawn live by a
  // second, small renderer at up to 2x resolution and turning slowly. Dragging turns it, a
  // pinch or the wheel brings it closer. One renderer is kept and moved from card to card: a
  // new GPU context for every card would leave the old ones' state on the shared piece meshes.
  let stageR = null, stageOn = null;
  function stageRenderer() {
    if (stageR) return stageR;
    let r;
    try {
      r = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!window.__SHOT });
    } catch (e) { return null; }
    if (!r.getContext()) return null;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.1;   // the card pictures are graded 10% brighter too
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.setClearColor(0x000000, 0);
    r.domElement.className = 'live3d';
    r.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      if (stageOn) stageOn.stop();
      W.resetEnvironments(r);
      if (stageR === r) stageR = null;   // the next card makes a fresh one
    });
    stageR = r;
    return r;
  }
  // host: the element to fill; spec: as for snapshot; aspect: the width/height the spec's
  // camera was framed for, so a narrower stage backs off instead of cropping the sides.
  function stage(host, spec, aspect) {
    const r = stageRenderer();
    if (!r) return null;
    if (stageOn) stageOn.stop();
    const cv = r.domElement;
    host.appendChild(cv);
    let built = null, base = null, fitK = 1, yaw = 0, zoom = 1, idleAt = 0, last = 0, loop = 0, pinchD = 0, drag = null, shown = false;
    const pts = new Map();
    function size() {
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      r.setSize(w, h, false);
      fitK = Math.max(1, (aspect || w / h) / (w / h));
      if (built) { built.camera.aspect = w / h; built.camera.updateProjectionMatrix(); }
    }
    function show(sp, asp) {
      if (asp) aspect = asp;
      if (built) built.dispose();
      const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
      built = buildSpec(sp, w, h, (style) => W.environment(r, style));
      base = built.camera.position.clone();
      // a soft contact shadow under the pieces; rooms are lit by their own lamps
      const keyL = built.scene.children.find((o) => o.isDirectionalLight);
      if (keyL && sp.kind !== 'room') {
        keyL.castShadow = true;
        keyL.shadow.mapSize.set(1024, 1024);
        Object.assign(keyL.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 20 });
        keyL.shadow.bias = -0.0004; keyL.shadow.normalBias = 0.02; keyL.shadow.radius = 4;
        built.spin.traverse((m) => { if (m.isMesh) m.receiveShadow = true; });
      }
      yaw = 0; zoom = 1; idleAt = 0;
      size();
      if (!loop) loop = requestAnimationFrame(tick);
    }
    function tick(now) {
      loop = 0;
      if (!cv.isConnected || stageR !== r) { stop(); return; }
      const dt = Math.min(0.05, (now - (last || now)) / 1000);
      last = now;
      if (!drag && pts.size === 0 && now > idleAt && animations && !window.__SHOT) yaw += dt * 0.35;
      built.spin.rotation.y = yaw;
      built.camera.position.copy(built.look).addScaledVector(base.clone().sub(built.look), zoom * fitK);
      built.camera.lookAt(built.look);
      r.render(built.scene, built.camera);
      if (!shown) { shown = true; host.classList.add('live'); }
      loop = requestAnimationFrame(tick);
    }
    const hold = () => { idleAt = performance.now() + 3500; };   // auto-turn waits after a touch
    const down = (e) => {
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      cv.setPointerCapture(e.pointerId);
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinchD = Math.hypot(a[0] - b[0], a[1] - b[1]); drag = null; } else drag = { x: e.clientX };
      hold();
    };
    const move = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 2 && pinchD) {
        const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        zoom = Math.min(1.5, Math.max(0.5, zoom * (pinchD / d))); pinchD = d;
      } else if (drag) { yaw += (e.clientX - drag.x) * 0.012; drag.x = e.clientX; }
      hold();
    };
    const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinchD = 0; if (!pts.size) drag = null; hold(); };
    const wheel = (e) => {
      e.preventDefault();
      const px = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1) * (e.ctrlKey ? 4 : 1);
      zoom = Math.min(1.5, Math.max(0.5, zoom * Math.exp(Math.max(-120, Math.min(120, px)) * 0.0015)));
      hold();
    };
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', wheel, { passive: false });
    const ro = new ResizeObserver(size); ro.observe(host);
    let stopped = false;
    function stop() {
      if (stopped) return;
      stopped = true;
      if (loop) cancelAnimationFrame(loop);
      loop = 0;
      ro.disconnect();
      cv.removeEventListener('pointerdown', down);
      cv.removeEventListener('pointermove', move);
      cv.removeEventListener('pointerup', up);
      cv.removeEventListener('pointercancel', up);
      cv.removeEventListener('wheel', wheel);
      if (built) { built.dispose(); built = null; }
      if (cv.parentNode === host) host.removeChild(cv);
      host.classList.remove('live');
      if (stageOn === api) stageOn = null;
    }
    const api = { show, stop };
    stageOn = api;
    show(spec);
    return api;
  }

  // ------------------------------------------------------------------ boot
  loadRoom('salon');
  loadBoard('walnut');
  shadowQuality();
  resize();
  applyCamera();

  // ------------------------------------------------------------------- API
  return {
    three: { renderer, scene, camera },
    setBoard(pieces, captured) {
      sprites.forEach(dropSprite);
      sprites = pieces.map(([sq, piece]) => makeSprite(piece, sq));
      for (const s of sprites) s.selected = s.sq === selectedSq;
      settleGrave(captured);
      dragging = null;
      requestRender();
    },
    setHighlights(h) {
      highlights = h || {};
      selectedSq = highlights.selected === undefined ? -1 : highlights.selected;
      for (const s of sprites) s.selected = s.sq === selectedSq && !s.anim;
      drawHighlights();
      requestRender();
    },
    setArrows(list) { arrows = list || []; drawArrows(); requestRender(); },
    // board and piece items from the catalog: { board: id } and { set: id }
    setTheme(board, pieces) {
      if (board) loadBoard(board.board || 'walnut');
      if (pieces) loadSet(pieces.set || 'regency');
      requestRender();
    },
    setRoom(r) { if (r) loadRoom(r.room || 'salon'); particles = particles.filter((p) => p.kind !== 'mote'); requestRender(); },
    setFx(f) { fx = Object.assign({}, fx, f); },
    setCaptureEffects(on) { captureFxOn = on; },
    setQuality(q) {
      q = q === 'low' ? 'low' : 'high';
      if (q === quality && (composer || !bloomOn())) return;   // settings are re-applied on every change
      quality = q;
      buildComposer();
      shadowQuality();
      lastW = 0; resize();
    },
    // 0 (full detail) to 5; the table also changes it by itself when frames run late
    perf: () => perf,
    setPerf,
    setFullDetail,
    setAnimations(on) { animations = on; if (!on) particles = []; requestRender(); },
    // Home-screen showcase: a low, slowly circling view across the board.
    setAttract(on, instant) {
      attract = on;
      if (on) { cam.tPitch = 0.36; cam.tLookY = 0.9; cam.tZoom = 1; }
      else cam.tLookY = 0;
      cam.tLookZ = 0;
      if (instant || !animations) { cam.pitch = cam.tPitch; cam.lookY = cam.tLookY; cam.lookZ = 0; cam.zoom = cam.tZoom; }
      requestRender();
    },
    // Screen space the HUD covers, in CSS px; the board is fitted into what is left.
    setInsets(ins, instant) {
      Object.assign(cam.tIns, { top: 0, right: 0, bottom: 0, left: 0 }, ins || {});
      if (instant || !animations) Object.assign(cam.ins, cam.tIns);
      requestRender();
    },
    // side: 'white' | 'black'; preset: 'player' | 'top' | 'low'
    setView(side, preset, instant) {
      if (side !== labelSide) { labelSide = side; if (boardMesh) boardMesh.userData.relabel(side); placeClock(); placeLights(side); }
      attract = false; cam.tLookY = 0; cam.tLookZ = 0; cam.tZoom = 1;
      let yaw = side === 'black' ? Math.PI : 0;
      while (yaw - cam.yaw > Math.PI) yaw -= TAU;
      while (cam.yaw - yaw > Math.PI) yaw += TAU;
      cam.tYaw = yaw;
      cam.tPitch = preset === 'top' ? 1.5 : preset === 'low' ? 0.58 : portraitNow() ? 1.08 : 0.8;
      if (instant || !animations) { cam.yaw = cam.tYaw; cam.pitch = cam.tPitch; cam.zoom = 1; cam.lookY = 0; cam.lookZ = 0; cam.intro = null; }
      requestRender();
    },
    // A closer camera for showing an item off: { pitch, zoom, lookY, lookZ }, each optional.
    // Pitch, zoom and height are what the player can still change by dragging and pinching.
    setFocus(f, instant) {
      f = f || {};
      if (f.pitch !== undefined) cam.tPitch = f.pitch;
      if (f.zoom !== undefined) cam.tZoom = Math.max(ZOOM_MIN, f.zoom);
      if (f.lookY !== undefined) cam.tLookY = f.lookY;
      if (f.lookZ !== undefined) cam.tLookZ = f.lookZ;
      if (instant || !animations) { cam.pitch = cam.tPitch; cam.zoom = cam.tZoom; cam.lookY = cam.tLookY; cam.lookZ = cam.tLookZ; }
      requestRender();
    },
    // Sweeping camera move into the player's seat at the start of a game.
    intro() {
      if (!animations) return;
      cam.intro = { start: performance.now(), dur: 1700, fYaw: cam.tYaw + 0.9, fPitch: 0.42, fZoom: 1.25 };
      requestRender();
    },
    animateMove(info, done, o) {
      const now = performance.now();
      const quick = o && o.quick;
      const mover = sprites.find((s) => s.sq === info.from && !s.dead);
      const victim = info.capturedSq >= 0 ? sprites.find((s) => s.sq === info.capturedSq && s !== mover && !s.dead) : null;
      const finish = () => { if (done) done(); };
      const capturer = info.mover > 0 ? 1 : -1;
      const graveIdx = graveyard.filter((g) => g.cap === capturer).length;
      if (mover) mover.selected = false;
      const toGrave = (v) => {
        sprites = sprites.filter((s) => s !== v);
        const [gx, gz] = gravePos(capturer, graveIdx);
        v.x = gx; v.z = gz; v.scale = 0.72; v.yaw = graveYaw(capturer); v.sq = -1; v.grave = true; v.y = 0; v.dead = false; v.cap = capturer; v.gi = graveIdx;
        graveyard.push(v); placeSprite(v);
      };
      if (!animations || !mover) {
        if (victim) toGrave(victim);
        if (mover) { mover.sq = info.to; mover.x = sqX(info.to); mover.z = sqZ(info.to); mover.y = 0; if (info.promo) { mover.piece = info.promo; rebuildSprite(mover); } placeSprite(mover); }
        if (info.rook) { const r = sprites.find((s) => s.sq === info.rook[0] && !s.dead); if (r) { r.sq = info.rook[1]; r.x = sqX(r.sq); r.z = sqZ(r.sq); placeSprite(r); } }
        requestRender(); finish();
        return;
      }
      const knight = kindOf(info.mover) === 2;
      const dist = Math.hypot(sqX(info.to) - mover.x, sqZ(info.to) - mover.z);
      const dur = dist < 0.6 ? 130 : Math.min(300, 200 + dist * 14) + (knight ? 50 : 0);
      const landX = sqX(info.to), landZ = sqZ(info.to);
      mover.anim = { type: 'move', start: now, dur, fx: mover.x, fz: mover.z, fy: mover.y, tx: landX, tz: landZ,
        arc: dist < 0.6 ? 0 : knight ? 0.6 : 0.16, promoteTo: info.promo || 0, done: finish,
        land: () => { if (!victim && !quick) spawn('dust', landX, 0.02, landZ, ['#fff2dc'], 7); } };
      mover.sq = info.to;
      if (victim) {
        victim.dead = true;
        const [gx, gz] = gravePos(capturer, graveIdx);
        const vx = victim.x, vz = victim.z;
        const impact = now + dur * 0.8;
        if (!quick && captureFxOn && fx.capture && fx.capture.kind !== 'none') {
          setTimeout(() => spawn(fx.capture.kind, vx, 0.4, vz, fx.capture.colors, fx.capture.kind === 'sparks' ? 46 : 30), Math.max(0, impact - performance.now()));
        }
        victim.anim = { type: 'grave', start: impact, dur: quick ? 220 : 560, fx: vx, fz: vz, tx: gx, tz: gz, fyaw: victim.yaw, done: () => toGrave(victim) };
      }
      if (info.rook) {
        const r = sprites.find((s) => s.sq === info.rook[0] && !s.dead);
        if (r) { r.anim = { type: 'move', start: now + 80, dur, fx: r.x, fz: r.z, fy: 0, tx: sqX(info.rook[1]), tz: sqZ(info.rook[1]), arc: 0.34 }; r.sq = info.rook[1]; }
      }
      requestRender();
    },
    celebrate(kind, loserSq, kingSqs, winnerSq) {
      const now = performance.now();
      if (kind === 'win') {
        const k = loserSq >= 0 ? sprites.find((s) => s.sq === loserSq && !s.dead) : null;
        if (k) k.anim = { type: 'topple', start: now + 150, dur: animations ? 1100 : 1, to: 1.45 };
        const w = winnerSq >= 0 ? sprites.find((s) => s.sq === winnerSq && !s.dead) : null;
        if (w && animations) w.anim = { type: 'hop', start: now + 300, dur: 520 };
        if (animations && fx.victory && fx.victory.kind !== 'none') {
          const v = fx.victory;
          const at = w ? [w.x, 1.4, w.z] : [0, 1.2, 0];
          const burst = (dx, dz, delay) => setTimeout(() => spawn(v.kind === 'fireworks' ? 'firework' : v.kind === 'petals' ? 'petals' : v.kind === 'sparks' ? 'sparks' : 'confetti', at[0] + dx, at[1] + (v.kind === 'fireworks' ? 2 : 0), at[2] + dz, v.colors, v.kind === 'fireworks' ? 80 : 100), delay);
          burst(0, 0, 500);
          if (v.kind === 'fireworks') { burst(-2, -1, 900); burst(2, 1, 1300); }
          if (v.kind === 'confetti') burst(0, 0, 900);
        }
      } else if (kind === 'draw') {
        for (const sq of kingSqs || []) {
          const k = sprites.find((s) => s.sq === sq && !s.dead);
          if (k) { k.anim = { type: 'glow', start: now, dur: animations ? 1800 : 1 }; spawn('sparks', k.x, 1.2, k.z, ['#ffe6a8', '#ffffff'], 30); }
        }
      }
      requestRender();
    },
    setClock(state, skin) {
      clockState = state; if (skin) clockSkin = skin;
      placeClock();
      clockKey = '';
      requestRender();
    },
    showcase(on) { attract = !!on; requestRender(); },
    // Menu pages blur the room behind them; nothing there needs to move, so the idle frames stop.
    setPaused(on) { paused = !!on; if (!paused) requestRender(); },
    snapshot,
    stage,
    sets: P.list,
    boards: () => W.BOARDS,
    rooms: () => W.ROOMS,
    cancelDrag,
    requestRender,
    resize,
  };
}
if (typeof module !== 'undefined') module.exports = ChacklateScene;
