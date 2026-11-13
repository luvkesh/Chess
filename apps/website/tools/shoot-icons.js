// Renders the website's feature icons (tools/icons3d.js) with the game's own renderer: each icon
// is a small 3D object lit in a studio and saved on a transparent background.
//   node apps/website/tools/shoot-icons.js [names]      e.g. node apps/website/tools/shoot-icons.js coach,trophy
// Writes img/ic-<name>.webp (440 px) and a contact sheet, tools/out/icons/sheet.png, to look over.
// Needs Playwright with Chromium (WebGL on SwiftShader, about 15 seconds an icon) and Pillow.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../../..');
const game = path.join(root, 'apps/web-prototype');
const out = path.join(__dirname, 'out', 'icons');
const img = path.join(root, 'apps/website/img');
const S = 960, FINAL = 440;   // rendered at 960 px, then shrunk to 440 px for the page
const only = process.argv[2] ? process.argv[2].split(',') : null;

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-'));
  const scripts = [path.join(game, 'vendor/three.bundle.js'), ...['kit3d.js', 'pieces3d.js', 'billboards.js', 'landmarks3d.js', 'suites3d.js', 'world3d.js'].map((n) => path.join(game, 'src', n)), path.join(__dirname, 'icons3d.js')];
  fs.writeFileSync(path.join(tmp, 'icons.html'), '<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000">'
    + `<canvas id="c" width="${S}" height="${S}"></canvas>` + scripts.map((s) => `<script src="file://${s}"></script>`).join('') + `<script>${studio.toString()}; window.__studio = studio(${S});</script>`);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: S, height: S } });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('console:', m.text()); });
  await page.goto('file://' + path.join(tmp, 'icons.html'), { waitUntil: 'load', timeout: 0 });
  const names = await page.evaluate(() => Object.keys(window.__studio.icons));
  const todo = only ? only.filter((n) => names.includes(n) || console.error('no icon called', n)) : names;
  const t0 = Date.now();
  for (const name of todo) {
    // Icons the owner's mock-ups show are that artwork itself (tools/hero/ic-<name>.png), not renders.
    const master = path.join(__dirname, 'hero', 'ic-' + name + '.png');
    if (fs.existsSync(master)) { fs.copyFileSync(master, path.join(out, name + '.png')); console.log('hero artwork', name); continue; }
    const url = await page.evaluate((n) => window.__studio.shoot(n), name);
    fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    console.log(((Date.now() - t0) / 1000).toFixed(0) + 's', name);
  }
  await browser.close();
  // shrink to the page's size, save as WebP with its transparency, and lay out a contact sheet
  execFileSync('python3', ['-c', `
import sys, glob, os
from PIL import Image, ImageDraw
out, img, final, todo = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4].split(',') if sys.argv[4] else None
names = sorted(os.path.basename(p)[:-4] for p in glob.glob(os.path.join(out, '*.png')) if os.path.basename(p) != 'sheet.png')
for n in names:
    if todo and n not in todo: continue
    im = Image.open(os.path.join(out, n + '.png')).convert('RGBA')
    im.resize((final, final), Image.LANCZOS).save(os.path.join(img, 'ic-' + n + '.webp'), 'WEBP', quality=90, method=6)
cols, cell = 6, 300
rows = (len(names) + cols - 1) // cols
sheet = Image.new('RGBA', (cols * cell, rows * (cell + 34)), '#120c0a')
d = ImageDraw.Draw(sheet)
for i, n in enumerate(names):
    im = Image.open(os.path.join(out, n + '.png')).convert('RGBA').resize((cell - 20, cell - 20), Image.LANCZOS)
    x, y = (i % cols) * cell, (i // cols) * (cell + 34)
    sheet.alpha_composite(im, (x + 10, y + 10))
    d.text((x + 12, y + cell + 8), n, fill='#e8c070')
sheet.convert('RGB').save(os.path.join(out, 'sheet.png'))
print('sheet', os.path.join(out, 'sheet.png'))
`, out, img, String(FINAL), todo.join(',')], { stdio: 'inherit' });
})();

// Runs in the page: the studio that lights and frames each icon.
function studio(S) {
  const THREE = window.THREE, K = ChacklateKit(THREE), P = ChacklatePieces(THREE, K), W = ChacklateWorld(THREE, K);
  const I = ChacklateIcons(THREE, K, P);
  const canvas = document.getElementById('c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(S, S, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // the game's room reflections, a touch brighter and cooler than a chess room, like a photo studio
  const env = W.environment(renderer, { wall: '#7a6454', floor: '#3a2a1e', ceiling: '#6a5a50', fill: 1.8, keyI: 13, windowI: 6, rimI: 7, lampI: 10 });
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  function shoot(name) {
    const scene = new THREE.Scene();
    scene.environment = env;
    const { group, up, yaw, pitch, flat, fit } = I.build(name);
    scene.add(group);
    const box = new THREE.Box3().setFromObject(group), size = box.getSize(new THREE.Vector3()), R = Math.max(size.x, size.y, size.z);
    const look = new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y + size.y * (up === undefined ? 0.5 : up), (box.min.z + box.max.z) / 2);
    const ya = yaw === undefined ? (flat ? 0 : -0.5) : yaw, pa = pitch === undefined ? (flat ? 0.08 : 0.38) : pitch;
    const light = (color, i, x, y, z, shadow) => {
      const l = new THREE.DirectionalLight(color, i); l.position.set(look.x + x * R, look.y + y * R, look.z + z * R); l.target.position.copy(look); scene.add(l, l.target);
      if (shadow) { l.castShadow = true; l.shadow.mapSize.set(2048, 2048); l.shadow.radius = 9; l.shadow.bias = -0.0004; l.shadow.normalBias = 0.02; const c = l.shadow.camera; c.left = c.bottom = -R * 2.2; c.right = c.top = R * 2.2; c.near = 0.1; c.far = R * 14; }
      return l;
    };
    light('#fff3e2', 3.0, -1.5, 2.2, 2.6, true);   // key, upper left, in front
    light('#dce8ff', 1.0, 2.2, 1.2, 1.6, false);   // fill from the right
    light('#ffd8a8', 1.8, 0.8, 2.0, -2.4, false);  // rim from behind
    scene.add(new THREE.HemisphereLight('#fff6ea', '#4a3020', 0.8));
    // fit: every vertex must land inside FIT of the frame
    const FIT = fit || 0.88;
    const pts = [], v = new THREE.Vector3();
    group.traverse((o) => { if (!o.isMesh) return; const a = o.geometry.attributes.position, step = Math.max(1, Math.floor(a.count / 4000)); for (let i = 0; i < a.count; i += step) pts.push(v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld).clone()); });
    let d = R * 2.2;
    for (let pass = 0; pass < 5; pass++) {
      camera.position.set(look.x + Math.sin(ya) * Math.cos(pa) * d, look.y + Math.sin(pa) * d, look.z + Math.cos(ya) * Math.cos(pa) * d);
      camera.lookAt(look); camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
      let m = 0;
      for (const c of pts) { const p = c.clone().project(camera); m = Math.max(m, Math.abs(p.x), Math.abs(p.y)); }
      d *= m / FIT;
    }
    // the floor: catches the icon's soft shadow and nothing else
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R * 3, 64), new THREE.ShadowMaterial({ opacity: 0.26, transparent: true }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = box.min.y - 0.002; floor.receiveShadow = true; scene.add(floor);
    renderer.render(scene, camera);
    const url = canvas.toDataURL('image/png');
    scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); });
    return url;
  }
  return { icons: I.ICONS, shoot };
}
