// Records the details showcase's clips from the game's own 3D table: each extra plays the way the
// Collection's "Try on the table" preview plays it, frame by frame on a fake clock, so SwiftShader's
// slowness never shows. Needs Playwright with Chromium and ffmpeg; about 10 minutes a clip.
//   node apps/website/tools/record-fx.js capture.frost.v1 [more ids]   (default: every id in build.py's FX_DEMOS)
// Writes apps/website/fx/<id>.mp4, <id>.jpg (the poster) and, for sound packs, <id>.lands.json.
const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '../../..');
const CAT = require(path.join(root, 'packages/content/catalog.json'));
const FPS = 24, W = 960, H = 600, MAX = +process.env.FX_FRAMES || 0;   // FX_FRAMES=n: a quick look at the first n frames, nothing saved
const dest = path.join(root, 'apps/website/fx');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fx-'));
// the built game, with its table handed to this tool
const built = fs.readFileSync(path.join(root, 'apps/web-prototype/dist/chackmate.html'), 'utf8');
const hook = 'view = ChacklateScene(canvas, {';
if (!built.includes(hook)) throw new Error('the game no longer makes its table with ' + hook);
const camHook = 'if (window.__SHOT) { window.__cam = cam; window.__scene = scene; }';
if (!built.includes(camHook)) throw new Error('the table no longer hands out its camera with ' + camHook);
fs.writeFileSync(path.join(tmp, 'game.html'), built.replace(hook, 'view = window.__rv = ChacklateScene(canvas, {').replace(camHook, '{ window.__cam = cam; window.__scene = scene; }'));
const ids = process.argv.slice(2).length ? process.argv.slice(2)
  : [...fs.readFileSync(path.join(root, 'apps/website/build.py'), 'utf8').match(/FX_DEMOS = \{([\s\S]*?)\n\}/)[1].matchAll(/'([a-z]+\.[\w-]+\.v\d+)'/g)].map((m) => m[1]).filter((i) => !/^(avatar|frame)\./.test(i));
const t0 = Date.now();
let id = '';
const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', id, ...a);
(async () => {
  for (id of ids) await record(id);
})();
async function record(id) {
  const it = CAT.items.find((i) => i.id === id);
  const out = path.join(tmp, id);
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.setDefaultTimeout(0);
  p.on('pageerror', (e) => log('ERR', e.message));
  await p.addInitScript(() => {
    const g = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (k, o) { if (/webgl/.test(k)) o = Object.assign({}, o, { preserveDrawingBuffer: true }); return g.call(this, k, o); };
  });
  await p.goto('file://' + path.join(tmp, 'game.html'));
  await p.waitForFunction(() => window.__rv && window.__rv.ready, null, { polling: 1000 });
  await p.evaluate(() => window.__rv.ready());
  await p.waitForTimeout(8000);
  await p.clock.install();
  await p.clock.pauseAt(Date.now() + 2000);
  await p.clock.runFor(1000);
  // hide the menus so the app leaves the table alone, then set up the table the way the preview does
  const plan = await p.evaluate((it) => {
    const v = window.__rv, cam = window.__cam, cat = it.category;
    document.body.classList.add('peeking');
    v.setPaused(false); v.setAttract(false, true); v.setInsets({ top: 0, bottom: 0, left: 0, right: 0 }, true);
    v.setFullDetail(true); v.setAnimations(true); v.setElements(true); v.setCaptureEffects(true); v.setView('white', 'player', true);
    const FOCUS = { move: { pitch: 0.68, zoom: 0.72, lookY: 0.3, lookZ: 0.3 }, win: { pitch: 0.6, zoom: 0.8, lookY: 0.4, lookZ: -0.6 } };
    v.setFocus(cat === 'victory' ? FOCUS.win : FOCUS.move, true);
    window.__done = false; window.__lands = [];
    const land = (t) => window.__lands.push([performance.now(), t]);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    // a move as a real game plays it: the capture scene, the room's element strike, the trail
    const mv = (from, to, mover, taken) => new Promise((r) => v.animateMove({ from, to, mover, capturedSq: taken ? to : -1 }, r, { skipHint: false }));
    const K = [4, 6], k = [60, -6];
    const full = [];
    [4, 2, 3, 5, 6, 3, 2, 4].forEach((t, f) => full.push([f, t], [8 + f, 1], [48 + f, -1], [56 + f, -t]));
    let run;
    if (cat === 'capture') {
      v.setFx({ capture: it.data });
      // the queen's long sequence for the showiest effects, a knight taking a rook for the rest
      const queen = it.data.strike || it.data.art;
      if (queen) { v.setBoard([K, k, [3, 5], [59, -5], [12, 1], [51, -1], [53, -1]], null); run = async () => { await wait(900); await mv(3, 59, 5, true); await wait(1200); }; }
      else { v.setBoard([K, k, [21, 2], [36, -4], [12, 1], [51, -1], [52, -1]], null); run = async () => { await wait(900); await mv(21, 36, 2, true); await wait(1000); }; }
    } else if (cat === 'trail') {
      v.setFx({ trail: it.data });
      v.setBoard([K, k, [3, 5], [1, 2], [12, 1], [51, -1], [52, -1]], null);
      // the three trail levels, one after the other: the queen, a knight, a pawn
      run = async () => { await wait(700); await mv(3, 39, 5); await wait(450); await mv(1, 18, 2); await wait(450); await mv(12, 28, 1); await wait(1000); };
    } else if (cat === 'sound') {
      // the pack's own material on the table: marble pieces on marble, crystal pieces on glass
      if (it.data.pack === 'marble') v.setTheme({ board: 'marble' }, { set: 'marble' });
      if (it.data.pack === 'glass') v.setTheme({ board: 'marble' }, { set: 'crystal' });
      v.setBoard(full, null);
      run = async () => { await wait(700); await mv(12, 28, 1); land('p'); await wait(450); await mv(52, 36, -1); land('p'); await wait(450); await mv(6, 21, 2); land('n'); await wait(450); await mv(57, 42, -2); land('n'); await wait(800); };
    } else if (cat === 'victory') {
      // a real checkmate (7k/1pp5/6K1/3n4/8/8/Q4PP1/8 w, then Qa8#): the queen runs up the a-file,
      // the king on h8 is in check with g7 and h7 covered by the white king and nothing can block,
      // the check glow shows, the beaten king falls, and the win plays
      v.setFx({ victory: it.data });
      v.setBoard([[46, 6], [63, -6], [8, 5], [13, 1], [14, 1], [49, -1], [50, -1], [35, -2]], null);
      run = async () => { await wait(700); await mv(8, 56, 5); v.setHighlights({ lastFrom: 8, lastTo: 56, check: 63 }); await wait(500); v.celebrate('win', 63, null, 46, { storm: true, reason: 'checkmate' }); await wait(9000); };
    } else if (cat === 'clock') {
      v.setBoard(full, null);
      let ms = 300000;
      const tick = () => { v.setClock({ whiteMs: ms, blackMs: 300000, active: 'w', running: true }, it.data); ms -= 1000; };
      tick(); setInterval(tick, 1000);
      // the camera comes round to the chess clock beside the board
      let c = null;
      window.__scene.traverse((o) => { if (!c && o.isGroup && Math.abs(Math.abs(o.position.x) - 6.1) < 0.01 && Math.abs(o.position.z) < 0.01) c = o; });
      if (c) {
        const yaw = Math.atan2(Math.sin(c.rotation.y), Math.cos(c.rotation.y));
        cam.panX = cam.tPanX = c.position.x; cam.panZ = cam.tPanZ = c.position.z;
        cam.yaw = cam.tYaw = yaw; cam.lookZ = cam.tLookZ = 0;
        cam.pitch = cam.tPitch = 0.42; cam.zoom = cam.tZoom = 0.3; cam.lookY = cam.tLookY = c.position.y + 0.42;
      }
      run = async () => { await wait(3600); };
    }
    run().then(() => { window.__done = true; });
    return cat;
  }, it);
  log('plan', plan);
  for (let i = 0; i < 8; i++) await p.clock.runFor(60);
  const grab = () => p.evaluate(() => { const c = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]; return c.toDataURL('image/jpeg', 0.93); });
  const t0v = await p.evaluate(() => performance.now());
  for (let i = 0; ; i++) {
    await p.clock.runFor(1000 / FPS);
    const d = await grab();
    fs.writeFileSync(out + '/f' + String(i).padStart(4, '0') + '.jpg', Buffer.from(d.split(',')[1], 'base64'));
    if (i % 12 === 0) log('frame', i);
    if ((MAX && i + 1 >= MAX) || i > FPS * 12 || await p.evaluate(() => window.__done)) break;
  }
  const lands = await p.evaluate(() => window.__lands);
  await b.close();
  if (MAX) { log('frames in', out); return; }
  fs.mkdirSync(dest, { recursive: true });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(out, 'f%04d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '25', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(dest, id + '.mp4')]);
  // the poster: the moment the effect is at its height, about two thirds through
  const frames = fs.readdirSync(out).filter((f) => f.endsWith('.jpg')).sort();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(out, frames[Math.floor(frames.length * 0.6)]), '-q:v', '4', path.join(dest, id + '.jpg')]);
  if (lands.length) fs.writeFileSync(path.join(dest, id + '.lands.json'), JSON.stringify(lands.map(([t, k]) => [+((t - t0v) / 1000 - 1 / FPS).toFixed(3), k])) + '\n');
  log('done');
}
