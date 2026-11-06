'use strict';
// Every line Rooky and his friends say, in another language, for tools/voice/record-lang.py:
//   node tools/voice/lang-lines.js hi > /tmp/voice/hi.json
// Each line is translated the way the game and website translate it on screen (src/i18n.js for the
// game; the website's own i18n/<lang>.json first, then the game's tables), and keyed the way they
// look the recording up:
//   game guide       guide/<lang>/<key>.mp3                 text: t('guide.<key>')
//   Collection item  pitch/<lang>/<voiceKey(said)>.mp3
//   era stories      tale/<lang>/<era>/<voiceKey(said)>.mp3
//   own-speaker lessons (Rooky's part)  words/<lang>/rooky/<voiceKey(said)>.mp3
//   website          apps/website/audio/<lang>/<key>.mp3, one cue per sentence
// A line with no translation is left out: the game and site read it with the device's voice.
const fs = require('fs');
const path = require('path');
const { voiceKey, wordLines, translator } = require('./lines');

const lang = process.argv[2];
if (!lang || lang === 'en') throw new Error('usage: node tools/voice/lang-lines.js <lang>');
const root = path.join(__dirname, '..', '..');
const content = path.join(root, 'packages', 'content');
const load = (...p) => JSON.parse(fs.readFileSync(path.join(...p), 'utf8'));

const tr = translator(lang);
const I18N = tr.I18N;

const out = { lang, guide: [], pitch: [], tale: [], words: [], site: [] };
const guide = load(content, 'guide.json');
const campaign = load(content, 'campaign.json');
const coach = campaign.coach.name;

// The game's audio guide, each line in its speaker's voice.
for (const [key, line] of Object.entries(guide.lines)) {
  if (!I18N.has('guide.' + key)) continue;
  const said = I18N.t('guide.' + key);
  if (said && said !== line.text && said !== 'guide.' + key) out.guide.push({ key, who: line.who, text: said });
}

// Rooky's word on each Collection item; a set from an era says the website's line.
const site = load(root, 'apps', 'website', 'guide.json').lines;
const seen = new Set();
for (const line of Object.values(load(content, 'pitches.json').lines)) {
  const en = typeof line === 'string' ? line : site[line.site].replace('{coach}', coach);
  const said = tr(en);
  if (said && !seen.has(said)) { seen.add(said); out.pitch.push({ key: voiceKey(said), who: 'rooky', text: said }); }
}

// Each era's story, read by that era's friend.
for (const era of campaign.eras) {
  for (const s of era.stages) {
    if (s.kind !== 'tale') continue;
    for (const en of s.pages.concat([s.quiz.q, s.quiz.explain])) {
      const said = tr(en);
      if (said) out.tale.push({ key: era.id + '/' + voiceKey(said), who: era.coach.id, text: said });
    }
  }
}

// Lessons with their own speakers: Rooky's part in this language (Priya's Hindi words stay as they are).
for (const w of wordLines()) {
  if (w.who !== 'rooky') continue;
  const said = tr(w.text);
  if (said && !out.words.some((x) => x.text === said)) out.words.push({ key: 'rooky/' + voiceKey(said), who: 'rooky', text: said });
}

// The website: its own translations win over the game's.
const siteText = (() => { try { return load(root, 'apps', 'website', 'i18n', lang + '.json'); } catch (e) { return {}; } })();
const siteTr = (en) => (typeof siteText[en] === 'string' && siteText[en] ? siteText[en] : tr(en));
const cues = load(root, 'apps', 'website', 'audio', 'index.json').lines;
for (const [key, rec] of Object.entries(cues)) {
  const whole = siteText[rec.text];
  const parts = rec.cues.map((c) => siteTr(c.text));
  if (parts.every(Boolean)) out.site.push({ key, who: 'rooky', cues: parts });
  else if (whole) out.site.push({ key, who: 'rooky', cues: [whole] });
}

process.stdout.write(JSON.stringify(out, null, 1));
