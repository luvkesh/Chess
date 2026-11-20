// Chackmate live portraits: the animal friends breathe, sway and blink, and Rooky moves his
// head and jaw while he talks. Each face is the same picture as the still portrait (art.js),
// bent a little by one small WebGL program: nothing is redrawn, so the look never changes.
//
// How it fits in: the page keeps writing ordinary <img class="portrait"> tags. start() watches
// the page; a portrait that is big enough to read gets a canvas beside it that takes the image's
// own classes (so every size and shadow rule still applies) and the image itself is hidden.
// One shared WebGL canvas paints every face in turn, about thirty times a second, and only the
// faces on screen. With reduced motion, or without WebGL, the portraits simply stay still.
const ChacklateLive = (() => {
  'use strict';

  // Where each face's eyes are (centre x, y, half width, half height), where its eyelids take their
  // colour from when the fur just under the eye is the wrong one (lids), the point its head turns
  // about, how much its ears, crest or plume lag behind, and its mouth (x, y, reach) for talking.
  // All in the 480 px portrait's own pixels (tools/characters/from-refs.py cuts them).
  const FACE = {
    bunny: { eyes: [[183, 262, 34, 30], [295, 262, 34, 30]], pivot: [240, 400], ears: 1, mouth: [240, 322, 46] },
    beaver: { eyes: [[187, 170, 23, 22], [300, 170, 23, 22]], pivot: [240, 365], ears: 0, mouth: [240, 272, 60] },
    squirrel: { eyes: [[160, 223, 26, 29], [283, 248, 30, 29]], pivot: [215, 395], ears: 0.6, mouth: [200, 318, 52] },
    tortoise: { eyes: [[200, 187, 30, 29], [330, 187, 27, 28]], pivot: [255, 385], ears: 0, mouth: [265, 250, 46] },
    raccoon: { eyes: [[217, 227, 27, 25], [327, 220, 24, 24]], lids: [[197, 240], [363, 222]], pivot: [240, 375], ears: 0, mouth: [290, 300, 52] },
    giraffe: { eyes: [[233, 190, 30, 28], [337, 173, 21, 25]], pivot: [245, 405], ears: 0.3, mouth: [320, 255, 44] },
    raven: { eyes: [[257, 117, 17, 14]], pivot: [230, 335], ears: 0.3, mouth: [380, 188, 40] },
    dragon: { eyes: [[243, 163, 30, 28], [353, 148, 18, 20]], pivot: [300, 400], ears: 0, mouth: [340, 226, 50] },
    horse: { eyes: [[253, 160, 17, 16], [325, 142, 9, 10]], pivot: [280, 365], ears: 0.4, mouth: [352, 242, 58] },
    cat: { eyes: [[247, 193, 24, 20], [350, 217, 16, 16]], lids: [[245, 163], [352, 196]], pivot: [300, 385], ears: 0.5, mouth: [318, 250, 40] },
    owl: { eyes: [[240, 180, 34, 34], [350, 217, 22, 26]], pivot: [240, 365], ears: 0.2, mouth: [310, 246, 30] },
    wolf: { eyes: [[273, 167, 22, 16], [367, 183, 10, 10]], lids: [[285, 147], [372, 168]], pivot: [270, 365], ears: 0.5, mouth: [330, 240, 50] },
    elephant: { eyes: [[270, 187, 18, 16], [353, 210, 8, 12]], pivot: [220, 345], ears: 0.3, mouth: [245, 240, 40] },
    panda: { eyes: [[263, 180, 20, 20], [367, 220, 12, 16]], lids: [[232, 202], [349, 196]], pivot: [260, 335], ears: 0, mouth: [330, 255, 44] },
    lion: { eyes: [[287, 167, 14, 12]], pivot: [240, 335], ears: 0.4, mouth: [310, 226, 44] },
    rooster: { eyes: [[240, 167, 18, 14]], pivot: [230, 335], ears: 0.5, mouth: [292, 206, 36] },
    bear: { eyes: [[263, 130, 12, 10], [343, 143, 9, 8]], lids: [[263, 112], [343, 128]], pivot: [240, 315], ears: 0.3, mouth: [300, 212, 50] },
    eagle: { eyes: [[240, 120, 18, 12]], pivot: [220, 305], ears: 0.3, mouth: [322, 172, 40] },
  };
  const MIN = 52;            // css px: smaller portraits stay still (the movement would not read)
  const MOST = 6;            // faces moving at once; the biggest on screen win (two during a game)
  const BUDGET = 4;          // ms of work a frame may cost on average before fewer faces move
  const FRAME = 1000 / 30;
  const SIZE = 320;          // the shared WebGL canvas

  const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;v.y=1.-v.y;gl_Position=vec4(p,0.,1.);}';
  const FS = [
    'precision highp float;varying vec2 v;uniform sampler2D T;',
    'uniform float t,blink,ears,talk;uniform vec2 pivot,l0,l1;uniform vec4 e0,e1;uniform vec3 mouth;',
    'vec2 rot(vec2 q,vec2 c,float a){q-=c;float s=sin(a),k=cos(a);return vec2(k*q.x-s*q.y,s*q.x+k*q.y)+c;}',
    // one eyelid: a patch of the fur beside the eye (l) is drawn down over it, with a dark lash line at its edge
    'vec4 eye(vec2 q,vec4 e,vec2 l,vec4 col){',
    '  if(e.z<1.||blink<.01)return col;vec2 c=e.xy,r=e.zw;vec2 d=(q-c)/r;if(abs(d.x)>=1.)return col;',
    '  float arc=sqrt(1.-d.x*d.x);float top=c.y-r.y*arc,bot=c.y+r.y*.72*arc;float lid=mix(top,bot,blink);',
    '  float k=r.y/30.;if(q.y<top-3.*k||q.y>lid+2.5*k)return col;',
    '  vec4 fur=texture2D(T,(l+(q-c)*vec2(.3,.12))/480.);fur.rgb*=mix(1.,.93,(q.y-top)/(r.y*1.7));',
    '  float edge=smoothstep(lid-3.2*k,lid-.6*k,q.y);',
    '  vec4 o=vec4(mix(fur.rgb,vec3(.16,.09,.08),edge*.9),1.);',
    '  float a=smoothstep(top-3.*k,top+2.*k,q.y)*(1.-smoothstep(lid+.5*k,lid+2.5*k,q.y))*smoothstep(1.,.86,abs(d.x));',
    '  return mix(col,o,a*smoothstep(0.,.12,blink));}',
    'void main(){',
    '  vec2 q=v*480.;',
    '  float m=1.-smoothstep(190.,228.,distance(q,vec2(240.,240.)));',          // the gold rim stays put
    '  float head=smoothstep(pivot.y+8.,pivot.y-70.,q.y)*m;',
    '  float top=smoothstep(pivot.y-185.,pivot.y-340.,q.y)*m;',
    '  float sway=.028*sin(t*.9)+.012*sin(t*.37+1.)+talk*(.022*sin(t*5.1)+.014*sin(t*2.3));',
    '  float lag=(.022*sin(t*.9-.9)+talk*.012*sin(t*5.1-1.))*ears;',
    '  vec2 s=rot(q,pivot,-(sway*head));',
    '  s=rot(s,vec2(pivot.x,pivot.y-210.),-(lag*top));',
    '  float br=sin(t*1.7);float body=smoothstep(pivot.y-50.,pivot.y+40.,q.y);',
    '  s=vec2(240.,480.)+(s-vec2(240.,480.))/(1.+.016*br*body*m);',
    '  s.y+=(1.6*br+talk*2.2*sin(t*5.1+.6))*head;',
    // talking: the jaw drops a little, in time with the nod
    '  float jaw=talk*(.5+.5*sin(t*9.3))*(.6+.4*sin(t*3.1));vec2 dm=(s-mouth.xy)/mouth.z;',
    '  float jf=smoothstep(1.,.25,length(dm*vec2(1.,.8)))*smoothstep(-.25,.35,dm.y);s.y-=jaw*mouth.z*.11*jf;',
    '  vec4 col=texture2D(T,s/480.);col=eye(s,e0,l0,col);col=eye(s,e1,l1,col);gl_FragColor=col;}',
  ].join('\n');

  let gl = null, glc = null, U = null, dead = false;
  const tex = new Map();     // animal -> { t: WebGLTexture, ready }
  function boot() {
    if (gl || dead) return !!gl;
    try {
      glc = document.createElement('canvas'); glc.width = glc.height = SIZE;
      gl = glc.getContext('webgl', { premultipliedAlpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
      if (!gl) throw new Error('no webgl');
      // a software renderer would spend the processor on this: the portraits stay still there
      const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
      const who = dbgInfo ? String(gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL)) : '';
      if (/swiftshader|llvmpipe|software|basic render/i.test(who) && !window.__liveSoft) throw new Error('software webgl');
      const sh = (k, s) => { const o = gl.createShader(k); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      gl.useProgram(pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const lp = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(lp); gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);
      U = {}; ['t', 'blink', 'ears', 'talk', 'pivot', 'e0', 'e1', 'l0', 'l1', 'mouth'].forEach((n) => { U[n] = gl.getUniformLocation(pr, n); });
      glc.addEventListener('webglcontextlost', (e) => { e.preventDefault(); dead = true; gl = null; stop(); for (const m of mounts) unmount(m); mounts.clear(); });
      return true;
    } catch (err) { dead = true; gl = null; return false; }
  }
  function texture(animal, src) {
    let x = tex.get(animal);
    if (x) return x;
    x = { t: gl.createTexture(), ready: false }; tex.set(animal, x);
    const im = new Image();
    im.onload = () => {
      if (!gl) return;
      gl.bindTexture(gl.TEXTURE_2D, x.t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im); x.ready = true;
    };
    im.src = src;
    return x;
  }

  // The style sheet speaks of "img" in many places (sizes, shadows, hover turns). Each such rule
  // gets a twin for the live canvas, with the same weight, so a live portrait is styled exactly
  // as the picture it stands in for.
  let twinned = false;
  function twinRules() {
    if (twinned) return; twinned = true;
    const IMG = /(^|[\s>+~,(])img(?![\w-])/g;
    const walk = (owner) => {
      let rules; try { rules = owner.cssRules; } catch (e) { return; }
      for (let i = 0; rules && i < rules.length; i++) {
        const r = rules[i];
        if (r.cssRules && r.type !== 1) { walk(r); continue; }
        if (r.type !== 1 || !r.selectorText || r.selectorText.indexOf('img') < 0 || r.selectorText.indexOf(':where(.pl)') >= 0) continue;
        IMG.lastIndex = 0; if (!IMG.test(r.selectorText)) continue;
        IMG.lastIndex = 0;
        const sel = r.selectorText.replace(IMG, '$1canvas:where(.pl)');
        try { owner.insertRule(sel + '{' + r.style.cssText + '}', i + 1); i++; } catch (e) { /* a selector this browser will not take: skip */ }
      }
    };
    for (const sheet of document.styleSheets) walk(sheet);
  }

  const mounts = new Set();
  let most = MOST, cost = 0, frames = 0, gap = 16, calls = 0, seenAt = 0;
  let lookup = null, talking = false, talkLevel = 0, raf = 0, last = 0, seen = null, scanQueued = false, seed = 0;
  const still = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function mount(img, info) {
    const box = { width: img.offsetWidth, height: img.offsetHeight };
    if (box.width < MIN || Math.abs(box.width - box.height) > 2) return;
    const face = FACE[info.animal]; if (!face) return;
    const c = document.createElement('canvas');
    const px = Math.min(SIZE, Math.round(box.width * Math.min(2, window.devicePixelRatio || 1)));
    c.width = c.height = px;
    c.className = img.className + ' pl';
    c.setAttribute('role', 'img'); c.setAttribute('aria-label', img.getAttribute('alt') || '');
    const base = document.createElement('canvas'); base.width = base.height = px;
    const m = { img, c, base, ok: false, info, face, src: img.getAttribute('src'), cls: img.className, on: true, w: box.width,
      ph: (seed++ * 2.399) % 6.283, sp: 0.88 + ((seed * 0.37) % 0.26), nextBlink: 0.8 + Math.random() * 3, bStart: -9 };
    img._live = m; c._live = m;
    img.insertAdjacentElement('afterend', c);
    img.style.setProperty('display', 'none', 'important');
    const now = { width: c.offsetWidth, height: c.offsetHeight };
    if (Math.abs(now.width - box.width) > 1 || Math.abs(now.height - box.height) > 1) { c.style.width = box.width + 'px'; c.style.height = box.height + 'px'; }
    paintBase(m);
    mounts.add(m);
    if (seen) seen.observe(c);
  }
  function paintBase(m) {
    const draw = () => { try { const g = m.base.getContext('2d'); g.clearRect(0, 0, m.base.width, m.base.height); g.drawImage(m.img, 0, 0, m.base.width, m.base.height); m.ok = true; m.c.getContext('2d').drawImage(m.base, 0, 0); } catch (e) { m.ok = false; } };
    if (m.img.complete && m.img.naturalWidth) draw(); else m.img.addEventListener('load', draw, { once: true });
  }
  function unmount(m) {
    if (seen) seen.unobserve(m.c);
    if (m.c.parentNode) m.c.parentNode.removeChild(m.c);
    if (m.img) { m.img.style.removeProperty('display'); m.img._live = null; }
  }

  function scan() {
    scanQueued = false;
    if (!lookup || dead || still()) return;
    const imgs = document.querySelectorAll('img');
    for (let i = 0; i < imgs.length; i++) {
      const img = imgs[i], m = img._live;
      const src = img.getAttribute('src');
      if (m) {
        if (m.src !== src) { const info = src ? who(src) : null; unmount(m); mounts.delete(m); if (info) tryMount(img, info); }
        else if (m.cls !== img.className) { m.cls = img.className; m.c.className = m.cls + ' pl'; }
        continue;
      }
      if (!src || src.length < 2000) continue;
      const info = who(src);
      if (info) tryMount(img, info);
    }
    if (mounts.size && !raf) raf = requestAnimationFrame(tick);
  }
  // A portrait's address is a long data URI; a short key (its length and a slice from the middle,
  // where the picture's own bytes are) finds it again without hashing the whole string each time.
  const known = new Map();
  function who(src) {
    const k = src.length + ':' + src.substr(src.length >> 1, 48);
    let info = known.get(k);
    if (info === undefined) { info = lookup(src) || null; known.set(k, info); }
    return info;
  }
  function tryMount(img, info) {
    if (img.closest('.duo, [data-still]')) return;
    if (!boot()) return;
    twinRules();
    mount(img, info);
  }
  function queue() { if (!scanQueued) { scanQueued = true; requestAnimationFrame(scan); } }

  function blinkAt(m, t) {
    if (t > m.nextBlink) { m.bStart = t; m.nextBlink = t + 2.4 + Math.random() * 3.4 + (Math.random() < 0.2 ? -2.1 : 0); }
    const x = (t - m.bStart) / 0.26; if (x < 0 || x > 1) return 0;
    return x < 0.4 ? x / 0.4 : 1 - (x - 0.4) / 0.6;
  }
  function tick(ms) {
    raf = 0;
    if (!gl || !mounts.size) return;
    raf = requestAnimationFrame(tick);
    // the page itself falling under about 35 frames a second counts as too slow as well
    const step = ms - seenAt; seenAt = ms;
    if (step > 0 && step < 250 && !window.__liveDbg) { gap += (step - gap) * 0.04; if (++calls > 120 && gap > 29) { calls = 0; gap = 16; fewer(); if (dead) return; } }
    if (ms - last < FRAME - 2 || document.hidden) return;
    const dt = Math.min(0.1, (ms - last) / 1000); last = ms;
    talkLevel += ((talking ? 1 : 0) - talkLevel) * Math.min(1, dt * 6);
    const live = [];
    for (const m of mounts) {
      if (!m.c.isConnected) { mounts.delete(m); if (seen) seen.unobserve(m.c); continue; }
      if (m.on && m.ok) live.push(m);
    }
    const t0 = ms / 1000, dbg = window.__liveDbg || null;   // tools/characters/live-check.js holds a pose still to photograph it
    const cap = dbg ? 99 : Math.min(most, document.body.classList.contains('ingame') ? 2 : MOST);
    if (live.length > cap) live.sort((a, b) => b.w - a.w).length = cap;
    const began = performance.now();
    for (const m of live) {
      const x = texture(m.info.animal, m.info.tex); if (!x.ready) continue;
      const f = m.face, t = t0 * m.sp + m.ph, e = f.eyes;
      gl.bindTexture(gl.TEXTURE_2D, x.t);
      gl.uniform1f(U.t, dbg ? dbg.t : t); gl.uniform1f(U.blink, dbg ? dbg.blink : blinkAt(m, t0)); gl.uniform1f(U.ears, f.ears);
      gl.uniform1f(U.talk, dbg ? dbg.talk : m.info.animal === 'horse' ? talkLevel : 0);
      gl.uniform2f(U.pivot, f.pivot[0], f.pivot[1]);
      gl.uniform4f(U.e0, e[0][0], e[0][1], e[0][2], e[0][3]);
      if (e[1]) gl.uniform4f(U.e1, e[1][0], e[1][1], e[1][2], e[1][3]); else gl.uniform4f(U.e1, 0, 0, 0, 0);
      const l = f.lids || [], la = l[0] || [e[0][0], e[0][1] + e[0][3] * 1.42], lb = l[1] || (e[1] ? [e[1][0], e[1][1] + e[1][3] * 1.42] : la);
      gl.uniform2f(U.l0, la[0], la[1]); gl.uniform2f(U.l1, lb[0], lb[1]);
      gl.uniform3f(U.mouth, f.mouth[0], f.mouth[1], f.mouth[2]);
      const g = m.c.getContext('2d'), W = m.c.width, r = W / 2 * m.info.inner;
      const side = Math.min(SIZE, Math.ceil(r * 2));          // paint only as many pixels as this portrait shows
      gl.viewport(0, SIZE - side, side, side);
      g.clearRect(0, 0, W, W); g.drawImage(m.base, 0, 0);
      g.save(); g.beginPath(); g.arc(W / 2, W / 2, r, 0, 6.2832); g.clip();
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      g.drawImage(glc, 0, 0, side, side, W / 2 - r, W / 2 - r, r * 2, r * 2);
      const sh = g.createRadialGradient(W / 2, W / 2, r * 0.72, W / 2, W / 2, r);
      sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.32)');
      g.fillStyle = sh; g.fillRect(W / 2 - r, W / 2 - r, r * 2, r * 2);
      g.restore();
    }
    // a slow device moves fewer faces, and none at all if even one costs too much
    if (!dbg && live.length) {
      cost += (performance.now() - began - cost) * 0.1;
      if (++frames > 45 && cost > BUDGET) {
        frames = 0; cost = 0; fewer();
      }
    }
  }
  function fewer() {
    if (most > 1) most = Math.max(1, most >> 1);
    else { dead = true; stop(); for (const m of mounts) unmount(m); mounts.clear(); }
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  // start(lookup): lookup(src) -> { animal, inner, tex } for a portrait address, or null
  function start(fn) {
    if (lookup || typeof document === 'undefined' || !window.requestAnimationFrame) return;
    lookup = fn;
    if ('IntersectionObserver' in window) seen = new IntersectionObserver((list) => { for (const it of list) if (it.target._live) it.target._live.on = it.isIntersecting; }, { rootMargin: '40px' });
    new MutationObserver(queue).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'class', 'hidden'] });
    window.addEventListener('resize', queue);
    if (window.matchMedia) { const q = window.matchMedia('(prefers-reduced-motion: reduce)'); const ch = () => { if (q.matches) { stop(); for (const m of mounts) unmount(m); mounts.clear(); } else queue(); }; if (q.addEventListener) q.addEventListener('change', ch); }
    queue();
  }
  return { start, talk: (on) => { talking = !!on; }, FACE, count: () => mounts.size };
})();
if (typeof module !== 'undefined') module.exports = ChacklateLive;
