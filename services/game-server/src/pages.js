'use strict';
// What each game address says about itself before any script runs: the tab title, the search and
// sharing description, the canonical link, and a short readable page for anything that does not
// run the 3D game (search engines, link previews, text-only readers, screen readers without
// JavaScript). The game itself still opens the screen the address names.
//
// The game page (apps/web-prototype/dist/chackmate.html) is read once and kept as two halves around
// the part this file rewrites: its <title> and description, and the <!--ROUTE-->...<!--/ROUTE-->
// block. The page also gets <meta name="chackmate-routes" content="path">, which tells the game
// that this server answers every clean game address, so it may write links like /learn/forks.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const CONTENT = path.join(ROOT, 'packages/content');
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(path.join(CONTENT, f), 'utf8')); } catch (e) { return null; } };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// router.js slug() and tail(), kept in step by the tests
const slug = (s) => String(s == null ? '' : s).toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
const tail = (id) => String(id).split('.').pop();

const SITE = 'Chackmate';
const INTRO = 'Chess for every age. Learn with Rooky, your chess coach, travel through nine eras of history, solve puzzles and collect sculpted 3D chess sets.';

// The main sections, in the order of the game's own menu. `title` is the tab title, `d` the description.
const SECTIONS = {
  home: { name: 'Home', title: 'Chackmate · Chess through the ages', d: INTRO },
  play: { name: 'Play', title: 'Play chess', d: 'Play 3D chess against eight computer opponents, from a first game to a real challenge, or with a friend on the same device. Variations include Chess960, King of the Hill, Three-check, Chaturanga and Xiangqi.' },
  journey: { name: 'Journey', title: 'Journey through the ages', d: 'Nine eras of chess history, from Ancient Egypt to New York. Each era has a story, a lesson, puzzles and a champion to beat.' },
  learn: { name: 'Learn', title: 'Learn chess', d: 'Step-by-step chess lessons read aloud by Rooky, from the board and its squares to checkmates, tactics and endgames, each with exercises on the board.' },
  trainers: { name: 'Trainers', title: 'Skill trainers', d: 'Short practice rounds for one skill at a time: openings, tactics, defence, endgames, blunder checks and more.' },
  puzzles: { name: 'Puzzles', title: 'Chess puzzles', d: 'A daily chess puzzle, mates in one to five, and puzzles by theme such as forks, pins and skewers.' },
  training: { name: 'Training', title: 'Chess training', d: 'The opening lab, endgame practice and charts of your progress over time.' },
  collection: { name: 'Collection', title: 'Collection', d: 'Chess sets, boards, rooms and effects from every era. What you collect changes how the game looks, never how it plays.' },
  club: { name: 'Club', title: 'Club', d: 'Leagues and rankings for your city, your country and your friends.' },
  profile: { name: 'Profile', title: 'Your profile', d: 'Your games, rating, achievements and account.' },
  store: { name: 'Store', title: 'Premium', d: 'What Premium adds to Chackmate. Nothing you buy changes your games or your rating.' },
  season: { name: 'Season', title: 'Season', d: 'This season\'s rewards and missions.' },
  settings: { name: 'Settings', title: 'Settings', d: 'Language, sound, voice, graphics and game settings.' },
};
// Sub-pages with names of their own
const SUB = {
  'play/mini-games': { title: 'Chess mini-games', d: 'Quick chess games for one skill: Knight\'s Tour, Pawn Race, Mate Rush, Memory Board and more.' },
  'play/variations': { title: 'Chess variations', d: 'Chess960, King of the Hill, Three-check, Chaturanga from ancient India and Xiangqi from China, each with its own lesson.' },
  'play/game': { title: 'Your game', d: 'Your game in progress. A saved game opens where you left it.' },
  'puzzles/daily': { title: 'Daily chess puzzle', d: 'One new chess puzzle every day.' },
  'training/openings': { title: 'Opening lab', d: 'Learn chess openings move by move, as White and as Black.' },
  'training/endgames': { title: 'Endgame practice', d: 'Practise the endgames every player needs, against the computer.' },
  'training/progress': { title: 'Your progress', d: 'Charts of your rating, accuracy and practice over time.' },
};

let content = null;
function names() {
  if (content) return content;
  const camp = readJson('campaign.json') || { eras: [] };
  const lessons = readJson('lessons.json') || { lessons: [] };
  content = {
    eras: Object.fromEntries((camp.eras || []).map((e) => [slug(e.id), e])),
    lessons: Object.fromEntries((lessons.lessons || []).map((l) => [slug(tail(l.id)), l])),
  };
  return content;
}

// An address -> { title, d, h1, top } (null for addresses that are not game pages)
function pageFor(p) {
  const parts = String(p || '').toLowerCase().split('/').filter(Boolean);
  const top = parts[0] || 'home';
  const sec = SECTIONS[top];
  if (!sec) return null;
  const c = names();
  let title = sec.title, d = sec.d, h1 = top === 'home' ? SITE : sec.title;
  const sub = SUB[parts.slice(0, 2).join('/')];
  if (sub) { title = h1 = sub.title; d = sub.d; }
  if (top === 'journey' && c.eras[parts[1]]) {
    const e = c.eras[parts[1]];
    h1 = e.name + ': ' + e.title;
    title = e.name + ' · Journey';
    d = e.place + ', ' + e.when + '. Hear the story, take the lesson, solve the puzzles and beat the champion to win this era\'s chess set.';
  }
  if (top === 'learn' && c.lessons[parts[1]]) {
    const l = c.lessons[parts[1]];
    const t = typeof l.title === 'string' ? l.title : (l.title && l.title.en) || '';
    if (t) { title = h1 = t; d = t + ': a chess lesson read aloud by Rooky, with exercises on the board.'; }
  }
  return { top, title: top === 'home' ? title : title + ' · ' + SITE, d, h1 };
}

// The readable page inside <noscript>: what this page is, and links to every section.
function noscript(pg, base) {
  const link = (k) => '<li><a href="' + (k === 'home' ? '/home' : '/' + k) + '">' + esc(SECTIONS[k].name) + '</a>: ' + esc(SECTIONS[k].d) + '</li>';
  return '<noscript><main class="noscript">\n<h1>' + esc(pg.h1) + '</h1>\n<p>' + esc(pg.d) + '</p>\n' +
    '<p>Chackmate runs in your browser and needs JavaScript turned on.</p>\n' +
    '<nav aria-label="Chackmate"><h2>In the game</h2>\n<ul>\n' + ['home', 'play', 'journey', 'learn', 'puzzles', 'training', 'collection', 'club'].map(link).join('\n') + '\n</ul></nav>\n' +
    '</main></noscript>';
}

// The game page split once around the parts each address rewrites; read again when the file changes.
let cache = null;
function split(file) {
  const st = fs.statSync(file);
  if (cache && cache.file === file && cache.mtime === st.mtimeMs && cache.size === st.size) return cache;
  const html = fs.readFileSync(file);
  const s = html.toString('latin1');   // byte offsets stay byte offsets
  const t0 = s.indexOf('<title>'), d1 = s.indexOf('>', s.indexOf('<meta name="description"', t0)) + 1;
  const r0 = s.indexOf('<!--ROUTE-->'), r1 = s.indexOf('<!--/ROUTE-->');
  const ok = t0 >= 0 && d1 > t0 && d1 - t0 < 2000 && r0 > d1 && r1 > r0;
  cache = ok
    ? { file, mtime: st.mtimeMs, size: st.size, a: html.subarray(0, t0), b: html.subarray(d1, r0), c: html.subarray(r1 + '<!--/ROUTE-->'.length), ok }
    : { file, mtime: st.mtimeMs, size: st.size, whole: html, ok };
  return cache;
}

// The game page for an address. `base` is the site's public address (for the canonical link), or null.
function gameHtml(file, p, base) {
  const parts = split(file);
  const pg = pageFor(p) || pageFor('/home');
  if (!parts.ok) return parts.whole;
  const url = base ? base.replace(/\/+$/, '') + (p === '/' ? '/home' : p) : null;
  const head = '<title>' + esc(pg.title) + '</title>\n' +
    '<meta name="description" content="' + esc(pg.d) + '">\n' +
    '<meta name="chackmate-routes" content="path">\n' +
    (url ? '<link rel="canonical" href="' + esc(url) + '">\n<meta property="og:url" content="' + esc(url) + '">\n' : '') +
    '<meta property="og:type" content="website">\n<meta property="og:site_name" content="' + SITE + '">\n' +
    '<meta property="og:title" content="' + esc(pg.title) + '">\n<meta property="og:description" content="' + esc(pg.d) + '">';
  return Buffer.concat([parts.a, Buffer.from(head), parts.b, Buffer.from(noscript(pg, base)), parts.c]);
}

// Public, indexable game pages for /sitemap.xml: the sections, their named sub-pages, each era and lesson.
function sitemapPaths() {
  const c = names();
  return ['/home', '/play', '/journey', '/learn', '/trainers', '/puzzles', '/training', '/collection', '/club', '/season']
    .concat(Object.keys(SUB).filter((k) => k !== 'play/game').map((k) => '/' + k))
    .concat(Object.keys(c.eras).map((e) => '/journey/' + e))
    .concat(Object.keys(c.lessons).map((l) => '/learn/' + l));
}

module.exports = { pageFor, gameHtml, sitemapPaths, SECTIONS, slug, tail };
