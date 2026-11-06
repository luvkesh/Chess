// Chackmate billboards: the adverts on the LED screens and neon signs of Times Square.
//
// Four brands, each drawn crisp in code at full resolution: Chackmate, Jong Club, Nibbland and
// Aertrip. Every advert has a landscape (16:9) and a portrait (9:16) layout, so a screen of
// either shape gets a picture made for it and nothing is ever stretched. Each advert is its own
// texture with mipmaps and anisotropic filtering, shared by every screen that shows it, and a
// screen moves to its next advert by swapping the texture, so frames never bleed into each other.
//
// The brands' own artwork (the Nibbland logo, the Jong Club wordmark, the Chackmate crest) comes
// in as CHACKLATE_ADS, built from src/ads/ by build.py. Aertrip has no logo file here, so its
// name is set in type. Until the pictures and fonts have loaded an advert shows its plain
// layout, then it is painted again.
function ChacklateBillboards(THREE, K, H) {
  'use strict';
  const { TAU, rng } = K;
  const { canvas, texFrom } = H;

  // ------------------------------------------------------------------ pictures and fonts
  const SRC = Object.assign({}, typeof CHACKLATE_ADS !== 'undefined' ? CHACKLATE_ADS : {});
  if (!SRC.crest && typeof CHACKLATE_CREST !== 'undefined') SRC.crest = CHACKLATE_CREST;
  const IMG = {};
  const waiting = [];
  let ready = false;
  function whenReady(fn) { if (ready) return; waiting.push(fn); start(); }
  let started = false;
  function start() {
    if (started || typeof document === 'undefined') return;
    started = true;
    const jobs = Object.keys(SRC).map((k) => new Promise((res) => {
      const im = new Image();
      im.onload = () => { IMG[k] = im; res(); };
      im.onerror = () => res();
      im.src = SRC[k];
    }));
    if (document.fonts && document.fonts.load) {
      for (const f of ['700 80px "Cinzel"', '600 80px "Cinzel"', 'italic 600 40px "Cormorant Garamond"', 'italic 500 40px "Cormorant Garamond"', '600 40px "Cormorant Garamond"', '400 40px "Jost"', '500 40px "Jost"', '600 40px "Jost"'])
        jobs.push(document.fonts.load(f).catch(() => null));
    }
    Promise.all(jobs).then(() => { ready = true; waiting.splice(0).forEach((fn) => fn()); });
  }

  // ------------------------------------------------------------------ drawing helpers
  const CINZEL = '"Cinzel", "Cormorant Garamond", Georgia, serif';
  const CORM = '"Cormorant Garamond", Georgia, serif';
  const JOST = '"Jost", "Helvetica Neue", Arial, sans-serif';
  function lgrad(g, x0, y0, x1, y1, stops) { const r = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => r.addColorStop(o, c)); return r; }
  function rgrad(g, x, y, r0, r1, stops) { const r = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, c]) => r.addColorStop(o, c)); return r; }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  // letter-spaced text (canvas letterSpacing where the browser has it, else drawn by hand)
  function spaced(g, text, x, y, sp) {
    if ('letterSpacing' in g) { g.letterSpacing = sp + 'px'; const a = g.textAlign; if (a === 'center') x += sp / 2; g.fillText(text, x, y); g.letterSpacing = '0px'; return; }
    const widths = [...text].map((ch) => g.measureText(ch).width), total = widths.reduce((a, b) => a + b, 0) + sp * (text.length - 1);
    const align = g.textAlign; let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    g.textAlign = 'left'; [...text].forEach((ch, i) => { g.fillText(ch, cx, y); cx += widths[i] + sp; }); g.textAlign = align;
  }
  // text shrunk to fit a width
  function fit(g, font, size, text, maxW, sp) {
    let s = size;
    for (; s > 8; s -= 2) { g.font = font.replace('#', s); const w = g.measureText(text).width + (sp || 0) * (text.length - 1) * (s / size); if (w <= maxW) break; }
    return s;
  }
  const GOLD = (g, y0, y1) => lgrad(g, 0, y0, 0, y1, [[0, '#fff3cf'], [0.3, '#f0d48e'], [0.55, '#c99a4a'], [0.8, '#a87a34'], [1, '#e2c27a']]);
  function goldRule(g, cx, y, w) {
    g.fillStyle = lgrad(g, cx - w / 2, 0, cx + w / 2, 0, [[0, 'rgba(226,190,120,0)'], [0.5, 'rgba(240,212,142,1)'], [1, 'rgba(226,190,120,0)']]);
    g.fillRect(cx - w / 2, y - 1.5, w, 3);
  }
  function vignette(g, w, h, a) { g.fillStyle = rgrad(g, w / 2, h / 2, Math.min(w, h) * 0.35, Math.hypot(w, h) * 0.62, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,' + a + ')']]); g.fillRect(0, 0, w, h); }

  // ------------------------------------------------------------------ the adverts
  // Each one draws into a w x h canvas; `land` says which way round it is.
  const ADS = {
    // Chackmate: the gold knight crest on plum, the name in Cinzel and the homepage line.
    chackmate(g, w, h) {
      const land = w >= h;
      g.fillStyle = rgrad(g, w * (land ? 0.3 : 0.5), h * (land ? 0.5 : 0.34), 0, Math.max(w, h) * 0.9, [[0, '#7a2450'], [0.45, '#3e0f2a'], [1, '#14050e']]);
      g.fillRect(0, 0, w, h);
      // a faint chequer, fading out towards the top
      const sq = land ? 64 : 48;
      for (let y = 0; y < h; y += sq) for (let x = 0; x < w; x += sq) if (((x + y) / sq) % 2 === 0) { g.fillStyle = 'rgba(255,214,150,' + (0.035 * y / h).toFixed(3) + ')'; g.fillRect(x, y, sq, sq); }
      // the crest with a warm halo
      const cr = land ? h * 0.35 : w * 0.38, cx = land ? w * 0.235 : w / 2, cy = land ? h / 2 : h * 0.34;
      g.fillStyle = rgrad(g, cx, cy, cr * 0.6, cr * 1.7, [[0, 'rgba(255,200,110,0.35)'], [1, 'rgba(255,200,110,0)']]);
      g.fillRect(0, 0, w, h);
      if (IMG.crest) { g.save(); g.beginPath(); g.arc(cx, cy, cr, 0, TAU); g.clip(); g.drawImage(IMG.crest, cx - cr * 1.02, cy - cr * 1.02, cr * 2.04, cr * 2.04); g.restore(); }
      else { g.fillStyle = '#5a1838'; g.beginPath(); g.arc(cx, cy, cr, 0, TAU); g.fill(); }
      g.strokeStyle = GOLD(g, cy - cr, cy + cr); g.lineWidth = Math.max(4, cr * 0.035); g.beginPath(); g.arc(cx, cy, cr + g.lineWidth / 2, 0, TAU); g.stroke();
      // the words
      const tx = land ? w * 0.7 : w / 2, ty = land ? h * 0.44 : h * 0.72, maxW = land ? w * 0.47 : w * 0.88;
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      const s = fit(g, '700 #px ' + CINZEL, land ? 92 : 78, 'CHACKMATE', maxW, land ? 10 : 6);
      g.font = '700 ' + s + 'px ' + CINZEL;
      g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 12; g.shadowOffsetY = 3;
      g.fillStyle = GOLD(g, ty - s * 0.8, ty);
      spaced(g, 'CHACKMATE', tx, ty, land ? 10 : 6);
      g.shadowColor = 'transparent';
      goldRule(g, tx, ty + s * 0.42, maxW * 0.55);
      g.font = 'italic 600 ' + Math.round(s * 0.56) + 'px ' + CORM; g.fillStyle = '#f6e8cc';
      g.fillText('Chess, through the ages.', tx, ty + s * 1.12);
      vignette(g, w, h, 0.45);
    },

    // Jong Club: its gold wordmark on deep jade felt, three tiles fanned above, "The Table Awaits."
    jongclub(g, w, h) {
      const land = w >= h;
      g.fillStyle = rgrad(g, w / 2, h * 0.45, 0, Math.max(w, h) * 0.8, [[0, '#17402f'], [0.55, '#0b2219'], [1, '#040b08']]);
      g.fillRect(0, 0, w, h);
      // felt grain
      const R = rng(7);
      for (let i = 0; i < (w * h) / 220; i++) { g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.05)'; g.fillRect(R() * w, R() * h, 2, 2); }
      // a fine gold frame inside the edge
      const m = Math.min(w, h) * 0.05;
      g.strokeStyle = 'rgba(224,190,120,0.55)'; g.lineWidth = 2; g.strokeRect(m, m, w - m * 2, h - m * 2);
      g.strokeStyle = 'rgba(224,190,120,0.25)'; g.lineWidth = 1; g.strokeRect(m + 8, m + 8, w - m * 2 - 16, h - m * 2 - 16);
      // three tiles, fanned
      const tw = land ? h * 0.2 : w * 0.26, th = tw * 1.36, fx = w / 2, fy = land ? h * 0.33 : h * 0.36;
      [[-1, -0.2, 'dots'], [0, 0, 'east'], [1, 0.2, 'bam']].forEach(([i, a, face]) => {
        g.save(); g.translate(fx + i * tw * 0.98, fy + Math.abs(i) * th * 0.06); g.rotate(a);
        tile(g, -tw / 2, -th / 2, tw, th, face);
        g.restore();
      });
      // the wordmark
      const ww = land ? w * 0.62 : w * 0.84, wh = ww * 152 / 979, wy = land ? h * 0.6 : h * 0.6;
      if (IMG.jongclub) g.drawImage(IMG.jongclub, w / 2 - ww / 2, wy - wh / 2, ww, wh);
      else { g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '600 ' + Math.round(wh * 0.8) + 'px ' + CINZEL; g.fillStyle = GOLD(g, wy - wh / 2, wy + wh / 2); spaced(g, 'JONGCLUB', w / 2, wy, wh * 0.4); }
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      const ts = land ? 50 : 54;
      g.font = 'italic 500 ' + ts + 'px ' + CORM; g.fillStyle = '#f3ead6';
      g.fillText('The Table Awaits.', w / 2, wy + wh / 2 + ts * 1.25);
      g.font = '500 ' + (land ? 20 : 22) + 'px ' + JOST; g.fillStyle = '#d8b878';
      spaced(g, 'LEARN \u00b7 PLAY \u00b7 MASTER', w / 2, wy + wh / 2 + ts * 2.15, land ? 7 : 6);
      vignette(g, w, h, 0.4);
    },

    // Nibbland: its own logo over a bright little world of sky, clouds and hills.
    nibbland(g, w, h) {
      const land = w >= h;
      g.fillStyle = lgrad(g, 0, 0, 0, h, [[0, '#5ec4ff'], [0.55, '#b9e8ff'], [1, '#e9f9ff']]);
      g.fillRect(0, 0, w, h);
      // sun glow
      g.fillStyle = rgrad(g, w * 0.82, h * 0.16, 0, Math.max(w, h) * 0.45, [[0, 'rgba(255,248,210,0.9)'], [0.25, 'rgba(255,240,190,0.35)'], [1, 'rgba(255,240,190,0)']]);
      g.fillRect(0, 0, w, h);
      // clouds
      const R = rng(5);
      const cloud = (x, y, s) => { g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); for (const [dx, dy, r] of [[-1, 0.15, 0.55], [-0.35, -0.2, 0.7], [0.35, -0.05, 0.6], [0.95, 0.2, 0.45]]) g.arc(x + dx * s, y + dy * s, r * s, 0, TAU); g.fill(); rr(g, x - s * 1.0, y + 0.05 * s, s * 2.1, s * 0.62, s * 0.31); g.fill(); };
      for (let i = 0; i < (land ? 5 : 6); i++) cloud(w * (0.08 + 0.2 * i + R() * 0.06) % w, h * (0.1 + R() * (land ? 0.18 : 0.12)), (land ? 34 : 30) + R() * 18);
      // rolling hills, back to front
      [['#9fdc7a', land ? 0.74 : 0.8, 0.05, 1.3], ['#77c95a', land ? 0.8 : 0.86, 0.045, 2.1], ['#5ab348', land ? 0.88 : 0.92, 0.035, 2.8]].forEach(([c, y0, amp, f], i) => {
        g.fillStyle = c; g.beginPath(); g.moveTo(0, h);
        for (let x = 0; x <= w; x += 8) g.lineTo(x, h * y0 + Math.sin(x / w * TAU * f / 2 + i * 1.7) * h * amp);
        g.lineTo(w, h); g.closePath(); g.fill();
      });
      // little flowers on the front hill
      for (let i = 0; i < 26; i++) { const x = R() * w, y = h * ((land ? 0.9 : 0.94) + R() * (land ? 0.08 : 0.05)); g.fillStyle = ['#ff8fb8', '#ffe066', '#ffffff', '#b896ff'][i % 4]; g.beginPath(); g.arc(x, y, 3 + R() * 3, 0, TAU); g.fill(); }
      // the logo
      const lw = land ? w * 0.74 : w * 0.92, lh = lw * 419 / 1200, ly = land ? h * 0.42 : h * 0.46;
      if (IMG.nibbland) { g.shadowColor = 'rgba(30,60,90,0.35)'; g.shadowBlur = 24; g.shadowOffsetY = 8; g.drawImage(IMG.nibbland, w / 2 - lw / 2, ly - lh / 2, lw, lh); g.shadowColor = 'transparent'; }
      else { g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '600 ' + Math.round(lh * 0.6) + 'px ' + JOST; g.fillStyle = '#ff8a3a'; g.fillText('NIBBLAND', w / 2, ly); }
      // the line, in a white pill
      const ts = land ? 34 : 36, label = 'A tiny 3D pet world';
      g.font = '600 ' + ts + 'px ' + JOST; const pw = g.measureText(label).width + ts * 1.6, ph = ts * 1.7, py = ly + lh / 2 + (land ? h * 0.05 : h * 0.06);
      g.shadowColor = 'rgba(30,60,90,0.25)'; g.shadowBlur = 12; g.shadowOffsetY = 4;
      g.fillStyle = '#ffffff'; rr(g, w / 2 - pw / 2, py, pw, ph, ph / 2); g.fill(); g.shadowColor = 'transparent';
      g.fillStyle = '#2a5a6a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, w / 2, py + ph / 2 + 1);
    },

    // Aertrip: a dusk sky in its teal, a flight path arcing over a lit horizon and the name in type.
    aertrip(g, w, h) {
      const land = w >= h;
      g.fillStyle = lgrad(g, 0, 0, 0, h, [[0, '#062b33'], [0.45, '#0b5a5c'], [0.78, '#13867c'], [1, '#f2b880']]);
      g.fillRect(0, 0, w, h);
      g.fillStyle = rgrad(g, w * 0.5, h * 1.05, 0, Math.max(w, h) * 0.7, [[0, 'rgba(255,196,130,0.75)'], [0.4, 'rgba(255,170,110,0.18)'], [1, 'rgba(255,170,110,0)']]);
      g.fillRect(0, 0, w, h);
      // stars in the upper sky
      const R = rng(11);
      for (let i = 0; i < 70; i++) { const y = R() * h * 0.45; g.fillStyle = 'rgba(255,255,255,' + (0.25 + R() * 0.55) * (1 - y / (h * 0.45)) + ')'; g.beginPath(); g.arc(R() * w, y, 0.8 + R() * 1.4, 0, TAU); g.fill(); }
      // a faint globe of meridians rising from the horizon
      g.save(); g.strokeStyle = 'rgba(190,240,230,0.13)'; g.lineWidth = 2;
      const gx = w / 2, gy = h * 1.18, gr = Math.max(w, h) * (land ? 0.62 : 0.5);
      g.beginPath(); g.arc(gx, gy, gr, 0, TAU); g.stroke();
      for (let i = 1; i < 6; i++) { g.beginPath(); g.ellipse(gx, gy, gr * i / 6, gr, 0, 0, TAU); g.stroke(); }
      for (let i = 1; i < 5; i++) { const y = gy - gr * i / 5, hw = Math.sqrt(gr * gr - (gy - y) ** 2); g.beginPath(); g.moveTo(gx - hw, y); g.lineTo(gx + hw, y); g.stroke(); }
      g.restore();
      // a city's lights along the horizon
      for (let x = -4; x < w;) { const bw = 10 + R() * 22, bh = (R() < 0.2 ? 34 : 12) + R() * 22; g.fillStyle = '#05262b'; g.fillRect(x, h - bh, bw, bh); g.fillStyle = 'rgba(255,214,150,0.8)'; for (let yy = h - bh + 5; yy < h - 3; yy += 6) for (let xx = x + 3; xx < x + bw - 3; xx += 5) if (R() < 0.28) g.fillRect(xx, yy, 2, 2); x += bw + 1; }
      // the flight path and the plane
      const ax = w * 0.1, ay = land ? h * 0.78 : h * 0.86, bx = w * 0.9, by = land ? h * 0.3 : h * 0.18, cx = w * (land ? 0.42 : 0.2), cy = land ? h * 0.06 : h * 0.1;
      g.save(); g.setLineDash([2, 14]); g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo(cx, cy, bx, by); g.stroke(); g.restore();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(ax, ay, 7, 0, TAU); g.fill();
      const tx = 2 * (bx - cx), ty = 2 * (by - cy);
      g.save(); g.translate(bx, by); g.rotate(Math.atan2(ty, tx)); g.scale(land ? 1.25 : 1.1, land ? 1.25 : 1.1);
      g.fillStyle = '#ffffff'; g.shadowColor = 'rgba(255,255,255,0.6)'; g.shadowBlur = 12;
      g.beginPath();   // a jet seen from above, nose pointing along the path
      g.moveTo(26, 0); g.quadraticCurveTo(24, -4, 16, -4); g.lineTo(2, -4); g.lineTo(-10, -26); g.lineTo(-16, -26); g.lineTo(-8, -4); g.lineTo(-20, -4); g.lineTo(-26, -12); g.lineTo(-30, -12); g.lineTo(-27, 0);
      g.lineTo(-30, 12); g.lineTo(-26, 12); g.lineTo(-20, 4); g.lineTo(-8, 4); g.lineTo(-16, 26); g.lineTo(-10, 26); g.lineTo(2, 4); g.lineTo(16, 4); g.quadraticCurveTo(24, 4, 26, 0); g.closePath(); g.fill();
      g.restore();
      // the name and the line
      g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      const nx = w / 2, ny = land ? h * 0.56 : h * 0.55;
      const s = land ? 168 : 150;
      g.font = '600 ' + s + 'px ' + JOST; g.shadowColor = 'rgba(0,20,24,0.45)'; g.shadowBlur = 18; g.shadowOffsetY = 4;
      g.fillStyle = '#ffffff'; spaced(g, 'aertrip', nx, ny, -2); g.shadowColor = 'transparent';
      g.font = '400 ' + (land ? 38 : 40) + 'px ' + JOST; g.fillStyle = '#d9f6f0';
      spaced(g, 'Where to next?', nx, ny + (land ? 70 : 76), 2);
    },
  };

  // A mahjong tile, drawn: ivory face, jade back, a carved face of dots, bamboo or the East wind.
  function tile(g, x, y, w, h, face) {
    const r = w * 0.12, d = w * 0.1;
    g.save();
    g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = w * 0.18; g.shadowOffsetY = w * 0.08;
    g.fillStyle = '#0f5a42'; rr(g, x, y + d, w, h, r); g.fill();
    g.shadowColor = 'transparent';
    g.fillStyle = lgrad(g, x, y, x + w, y + h, [[0, '#fffaf0'], [0.6, '#f1e6cf'], [1, '#d9c9a8']]); rr(g, x, y, w, h, r); g.fill();
    g.strokeStyle = 'rgba(120,90,40,0.35)'; g.lineWidth = 1.5; rr(g, x + w * 0.07, y + w * 0.07, w * 0.86, h - w * 0.14, r * 0.7); g.stroke();
    const cx = x + w / 2, cy = y + h / 2;
    if (face === 'dots') {
      const p = [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], s = w * 0.23;
      p.forEach(([i, j], n) => { const px = cx + i * s, py = cy + j * s * 1.3, rad = w * 0.11;
        g.fillStyle = n === 2 ? '#c0392b' : '#1d6b4f'; g.beginPath(); g.arc(px, py, rad, 0, TAU); g.fill();
        g.strokeStyle = '#fbf3e2'; g.lineWidth = rad * 0.28; g.beginPath(); g.arc(px, py, rad * 0.55, 0, TAU); g.stroke(); });
    } else if (face === 'bam') {
      for (const [i, j, c] of [[-1, -1, '#1d6b4f'], [1, -1, '#1d6b4f'], [0, 0, '#c0392b'], [-1, 1, '#1d6b4f'], [1, 1, '#1d6b4f']]) {
        const px = cx + i * w * 0.22, py = cy + j * h * 0.24, bw = w * 0.1, bh = h * 0.2;
        g.fillStyle = c; rr(g, px - bw / 2, py - bh / 2, bw, bh, bw / 2); g.fill();
        g.fillStyle = '#fbf3e2'; g.fillRect(px - bw / 2, py - 1, bw, 2);
      }
    } else {
      // the East wind: a bold compass rose in jade with a gold heart
      g.fillStyle = '#1d6b4f'; g.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8 - TAU / 4, rad = i % 2 ? w * 0.13 : w * 0.36; g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); }
      g.closePath(); g.fill();
      g.fillStyle = '#c99a4a'; g.beginPath(); g.arc(cx, cy, w * 0.07, 0, TAU); g.fill();
      g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(cx + w * 0.36, cy); g.lineTo(cx + w * 0.12, cy - w * 0.06); g.lineTo(cx + w * 0.12, cy + w * 0.06); g.closePath(); g.fill();
    }
    g.restore();
  }

  // The LED feel: a fine diode grid, barely there, and a soft sheen down from the top. Kept
  // faint so the picture stays clean; the mipmaps blend it away at a distance.
  function led(g, w, h) {
    g.fillStyle = 'rgba(0,0,0,0.07)';
    for (let x = 2; x < w; x += 3) g.fillRect(x, 0, 1, h);
    for (let y = 2; y < h; y += 3) g.fillRect(0, y, w, 1);
    g.fillStyle = lgrad(g, 0, 0, 0, h * 0.5, [[0, 'rgba(255,255,255,0.06)'], [1, 'rgba(255,255,255,0)']]);
    g.fillRect(0, 0, w, h * 0.5);
  }

  function paint(name, g, w, h) {
    g.save(); g.clearRect(0, 0, w, h);
    ADS[name](g, w, h);
    led(g, w, h);
    g.restore();
  }

  // One texture per advert and shape, shared by every screen in the room. 1024 px on the
  // long side: sharp at the table, and a phone's texture budget scales it down if needed.
  const LONG = 1024, SHORT = 576;
  function adTex(k, name, portrait) {
    const w = portrait ? SHORT : LONG, h = portrait ? LONG : SHORT;
    const c = canvas(w, h); paint(name, c.getContext('2d'), w, h);
    const t = k.own(texFrom(c));
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    whenReady(() => {
      const img = t.image; paint(name, img.getContext('2d'), img.width, img.height);
      if (img !== c) { /* scaled copy for a phone: the original is no longer needed */ }
      t.needsUpdate = true;
    });
    return t;
  }

  // A screen: one material whose picture steps through `names` every `every` seconds.
  // Returns { mat, anim } for the vista's update loop.
  function screen(k, names, o) {
    const maps = names.map((n) => (o.cache[n + (o.portrait ? ':p' : ':l')] = o.cache[n + (o.portrait ? ':p' : ':l')] || adTex(k, n, o.portrait)));
    const mat = k.own(new THREE.MeshBasicMaterial({ map: maps[0], toneMapped: false, color: new THREE.Color('#ffffff').multiplyScalar(o.bright || 1.08) }));
    return { mat, anim: { mat, maps, every: o.every, phase: o.phase || 0 } };
  }

  // A neon sign: a word in glowing tube on a dark board with a border of bulbs, drawn at
  // 1024 x 512 (the 2:1 of the board it hangs on).
  function neonTex(k, o) {
    const W = 1024, Hh = 512;
    const draw = (g, w, h) => {
      g.save(); g.scale(w / W, h / Hh);
      g.fillStyle = o.board || '#0c0a14'; g.fillRect(0, 0, W, Hh);
      g.fillStyle = rgrad(g, W / 2, Hh / 2, 0, W * 0.6, [[0, 'rgba(255,255,255,0.05)'], [1, 'rgba(0,0,0,0.3)']]); g.fillRect(0, 0, W, Hh);
      const glow = (col, width, fn) => { g.save(); g.shadowColor = col; g.shadowBlur = 30; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = width; fn(); g.shadowBlur = 10; fn(); g.restore(); };
      glow(o.edge || o.color, 8, () => { rr(g, 26, 26, W - 52, Hh - 52, 18); g.stroke(); });
      for (let x = 56; x < W - 40; x += 40) for (const y of [52, Hh - 52]) {
        g.fillStyle = rgrad(g, x, y, 0, 12, [[0, '#fffbe8'], [0.5, '#ffe9a8'], [1, 'rgba(255,220,140,0)']]); g.beginPath(); g.arc(x, y, 12, 0, TAU); g.fill();
      }
      const tx = W / 2 + (o.icon ? 90 : 0), maxW = W - (o.icon ? 420 : 200);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const font = o.font || ('600 #px ' + JOST);
      const s = fit(g, font, o.size || 150, o.text, maxW, o.sp || 0);
      glow(o.color, 6, () => { g.font = font.replace('#', s); if (o.sp) spaced(g, o.text, tx, Hh / 2 + (o.sub ? -34 : 6), o.sp); else g.fillText(o.text, tx, Hh / 2 + (o.sub ? -34 : 6)); });
      // the tube's white-hot core
      g.save(); g.globalAlpha = 0.55; g.fillStyle = '#ffffff'; g.font = font.replace('#', s); if (o.sp) spaced(g, o.text, tx, Hh / 2 + (o.sub ? -34 : 6), o.sp); else g.fillText(o.text, tx, Hh / 2 + (o.sub ? -34 : 6)); g.restore();
      if (o.sub) glow(o.edge || o.color, 3, () => { g.font = (o.subFont || '500 #px ' + JOST).replace('#', fit(g, o.subFont || '500 #px ' + JOST, 54, o.sub, maxW, 0)); g.fillText(o.sub, tx, Hh / 2 + 92); });
      if (o.icon) glow(o.edge || o.color, 5, () => { g.save(); g.translate(190, Hh / 2); g.scale(1.9, 1.9); o.icon(g, 0, 0); g.restore(); });
      g.restore();
    };
    const c = canvas(W, Hh); draw(c.getContext('2d'), W, Hh);
    const t = k.own(texFrom(c)); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    whenReady(() => { const img = t.image; draw(img.getContext('2d'), img.width, img.height); t.needsUpdate = true; });
    return t;
  }

  // Swaps each screen to its advert for time t.
  function step(anims, t) { for (const a of anims) { const f = Math.floor((t + a.phase) / a.every) % a.maps.length; if (a.mat.map !== a.maps[f]) a.mat.map = a.maps[f]; } }

  return { ADS, NAMES: Object.keys(ADS), adTex, screen, neonTex, step, whenReady, paint };
}
if (typeof module !== 'undefined') module.exports = ChacklateBillboards;
