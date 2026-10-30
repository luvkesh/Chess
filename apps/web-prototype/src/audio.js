// Chackmate sound: every effect and the ambient score are synthesised with the
// Web Audio API. Four sound packs change the material (wood, marble, glass, soft)
// of the piece sounds. The only audio files are the recorded voices.
function ChacklateAudio() {
  'use strict';
  let ctx = null, master = null, sfxBus = null, musicBus = null, verb = null, verbSend = null;
  let sfxVol = 0.8, musicVol = 0.35, sfxOn = true, musicOn = true, pack = 'wood';
  let music = null;

  function init() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
    master = ctx.createGain(); master.gain.value = 0.9;
    master.connect(comp).connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    // Small hall made from decaying stereo noise.
    verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < 200 ? i / 200 : 1);
    }
    verb.buffer = ir;
    const verbOut = ctx.createGain(); verbOut.gain.value = 0.5;
    verb.connect(verbOut).connect(master);
    verbSend = ctx.createGain(); verbSend.gain.value = 0.18; verbSend.connect(verb);
    return ctx;
  }
  function ready() {
    if (!init()) return false;
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  // ------------------------------------------------------------- primitives
  function noiseBuf(sec) {
    const b = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * sec)), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  let nb = null;
  function noise(t, dur, f, q, gain, type, out) {
    nb = nb || noiseBuf(1);
    const s = ctx.createBufferSource(); s.buffer = nb;
    const filt = ctx.createBiquadFilter(); filt.type = type || 'bandpass'; filt.frequency.value = f; filt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(filt).connect(g).connect(out || sfxBus);
    s.start(t, Math.random() * 0.5, dur + 0.05);
    return g;
  }
  function partial(t, hz, dur, gain, type, out, attack) {
    const o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.value = hz;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + (attack || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out || sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
    return g;
  }
  // FM bell / electric piano voice.
  function bell(t, hz, dur, gain, ratio, index, out) {
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    car.frequency.value = hz; mod.frequency.value = hz * (ratio || 3.5);
    mg.gain.setValueAtTime(hz * (index || 2), t); mg.gain.exponentialRampToValueAtTime(hz * 0.05, t + dur * 0.6);
    mod.connect(mg).connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(g);
    g.connect(out || sfxBus);
    const send = ctx.createGain(); send.gain.value = 0.6; g.connect(send).connect(verbSend);
    car.start(t); mod.start(t); car.stop(t + dur + 0.1); mod.stop(t + dur + 0.1);
  }

  // Material models for a piece meeting the board.
  const PACKS = {
    wood: { click: [2400, 1.2], body: [[190, 0.5, 0.09], [420, 0.25, 0.06], [930, 0.12, 0.035]], felt: 2600, gain: 0.9 },
    marble: { click: [4200, 2.5], body: [[520, 0.35, 0.18], [1210, 0.22, 0.14], [2650, 0.12, 0.1]], felt: 7000, gain: 0.75 },
    glass: { click: [6200, 4], body: [[1320, 0.3, 0.45], [2960, 0.2, 0.35], [4410, 0.12, 0.3]], felt: 9000, gain: 0.55 },
    soft: { click: [1200, 0.8], body: [[160, 0.4, 0.07], [320, 0.15, 0.05]], felt: 1100, gain: 0.5 },
  };
  function knock(t, weight, pitch) {
    const p = PACKS[pack] || PACKS.wood;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = p.felt; lp.connect(sfxBus);
    const send = ctx.createGain(); send.gain.value = 0.35; lp.connect(send).connect(verbSend);
    const k = (pitch || 1) * (0.96 + Math.random() * 0.08);
    noise(t, 0.025 + weight * 0.02, p.click[0] * k, p.click[1], 0.55 * p.gain * weight, 'bandpass', lp);
    for (const [hz, g, d] of p.body) partial(t, hz * k, d * (0.8 + weight * 0.4), g * p.gain * weight, 'sine', lp, 0.0015);
  }

  // ----------------------------------------------------------------- effects
  const FX = {
    move(t) { knock(t, 0.9, 1); },
    capture(t) { knock(t, 0.6, 1.25); knock(t + 0.07, 1.25, 0.85); noise(t + 0.07, 0.12, 300, 0.7, 0.18, 'lowpass'); },
    castle(t) { knock(t, 0.8, 1); knock(t + 0.11, 0.8, 0.92); },
    check(t) { this.move(t); bell(t + 0.05, 1046.5, 0.9, 0.09, 3.5, 1.5); bell(t + 0.05, 1568, 0.7, 0.04, 2, 1); },
    promote(t) { this.move(t); [1046.5, 1318.5, 1568, 2093].forEach((hz, i) => bell(t + 0.06 + i * 0.07, hz, 0.8, 0.07, 3, 1.2)); },
    select(t) { noise(t, 0.018, 5200, 2, 0.12, 'bandpass'); },
    illegal(t) { partial(t, 110, 0.18, 0.25, 'sine'); noise(t, 0.05, 400, 1, 0.12, 'lowpass'); },
    tap(t) { noise(t, 0.012, 3800, 1.5, 0.15, 'bandpass'); partial(t, 1800, 0.03, 0.04, 'sine'); },
    open(t) {
      nb = nb || noiseBuf(1);
      const s = ctx.createBufferSource(); s.buffer = nb;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
      f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.22);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      s.connect(f).connect(g).connect(sfxBus); s.start(t, 0, 0.3);
    },
    tick(t) { noise(t, 0.01, 6000, 3, 0.1, 'bandpass'); },
    correct(t) { bell(t, 1318.5, 0.5, 0.08, 3, 1); bell(t + 0.08, 1975.5, 0.6, 0.07, 3, 1); },
    wrong(t) { bell(t, 392, 0.35, 0.07, 1.5, 1.5); bell(t + 0.1, 370, 0.4, 0.06, 1.5, 1.5); },
    win(t) { [523.25, 659.25, 783.99, 987.77, 1174.66].forEach((hz, i) => bell(t + i * 0.09, hz, 1.8, 0.09, 1, 1.1)); bell(t + 0.5, 261.63, 2.2, 0.08, 1, 0.8); },
    loss(t) { [440, 392, 349.23, 329.63].forEach((hz, i) => bell(t + i * 0.16, hz, 1.4, 0.07, 1, 0.9)); },
    draw(t) { bell(t, 523.25, 1.2, 0.08, 1, 1); bell(t + 0.18, 659.25, 1.3, 0.07, 1, 1); },
    levelUp(t) { [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((hz, i) => bell(t + i * 0.06, hz, 1.2, 0.08, 3, 1.4)); },
    achievement(t) { bell(t, 1567.98, 1.1, 0.09, 3.5, 2); bell(t + 0.12, 2093, 1.2, 0.08, 3.5, 2); bell(t + 0.24, 2637, 1.4, 0.07, 3.5, 2); },
    coach(t) { bell(t, 880, 0.5, 0.05, 2, 1); bell(t + 0.07, 1318.5, 0.6, 0.045, 2, 1); },
    low(t) { partial(t, 1760, 0.06, 0.08, 'square'); },
  };

  function play(kind) {
    if (!sfxOn || !ready() || !FX[kind]) return;
    try { FX[kind].call(FX, ctx.currentTime + 0.005); } catch (e) { /* audio is optional */ }
  }

  // ---------------------------------------------------------- ambient score
  // Slow chords on a warm pad with a sparse melody over them. Each era room has its own
  // mood: the mode it is written in and the instrument that carries the tune (a harp on
  // the Nile, a sitar by the Taj, a guzheng in the Ming palace, a harpsichord in Venice).
  // A new voicing every few seconds; the melody wanders the scale, so nothing repeats exactly.
  const MOODS = {
    salon: { chords: [[48, 55, 62, 64, 71], [45, 52, 59, 60, 67], [41, 48, 55, 57, 64], [43, 50, 57, 59, 66], [40, 47, 54, 55, 62], [41, 48, 53, 57, 64]],
      scale: [60, 62, 64, 67, 69, 72, 74, 76, 79, 81], voice: 'ep', every: 8000 },
    library: { chords: [[45, 52, 57, 60, 64], [41, 48, 53, 57, 64], [43, 50, 55, 59, 62], [40, 47, 52, 55, 59]],
      scale: [57, 59, 60, 62, 64, 65, 67, 69, 71, 72], voice: 'ep', every: 9000 },
    marble: { chords: [[36, 48, 52, 55, 64], [41, 48, 53, 57, 65], [43, 50, 55, 59, 67], [45, 52, 57, 60, 64]],
      scale: [72, 74, 76, 77, 79, 81, 83, 84, 86, 88], voice: 'harp', every: 8000 },
    harvest: { chords: [[43, 50, 55, 59, 62], [36, 48, 52, 55, 64], [38, 50, 54, 57, 62], [40, 52, 55, 59, 64]],
      scale: [67, 69, 71, 74, 76, 79, 81, 83, 86, 88], voice: 'lyre', every: 7000 },
    // D hijaz, over a held D
    nile: { chords: [[38, 45, 50, 54, 57], [38, 46, 51, 55, 58], [38, 46, 50, 55, 58], [38, 48, 51, 55, 60]],
      scale: [62, 63, 66, 67, 69, 70, 72, 74, 75, 78], voice: 'harp', every: 8000 },
    // D dorian, open and bright
    athens: { chords: [[38, 50, 53, 57, 64], [43, 50, 55, 59, 62], [45, 52, 57, 60, 64], [36, 48, 52, 55, 62]],
      scale: [62, 64, 65, 67, 69, 71, 72, 74, 76, 77], voice: 'lyre', every: 8000 },
    // G mixolydian, stately
    roma: { chords: [[43, 50, 55, 59, 62], [41, 48, 53, 57, 60], [36, 48, 52, 55, 60], [43, 50, 55, 57, 62]],
      scale: [67, 69, 71, 72, 74, 76, 77, 79, 81, 83], voice: 'horn', every: 8000 },
    // an evening raga (yaman) over a drone of C and G
    mughal: { chords: [[36, 43, 48, 55, 64], [36, 43, 48, 54, 59], [36, 43, 47, 55, 62], [36, 43, 48, 57, 64]],
      scale: [59, 62, 64, 66, 69, 71, 72, 74, 76, 78], voice: 'sitar', every: 9000 },
    // the five-note scale, in open fifths
    ming: { chords: [[36, 43, 50, 55, 62], [33, 40, 45, 52, 57], [31, 38, 43, 50, 55], [36, 43, 45, 52, 57]],
      scale: [67, 69, 72, 74, 76, 79, 81, 84, 86, 88], voice: 'guzheng', every: 8000 },
    // D minor, as Vivaldi might have it
    venice: { chords: [[38, 50, 53, 57, 62], [34, 46, 50, 53, 58], [31, 43, 50, 55, 58], [33, 45, 49, 52, 57]],
      scale: [62, 64, 65, 67, 69, 70, 73, 74, 76, 77], voice: 'harpsichord', every: 7000 },
    // E minor, a ballet in the snow
    winter: { chords: [[40, 52, 55, 59, 64], [36, 48, 52, 55, 64], [33, 45, 52, 57, 60], [35, 47, 51, 54, 57]],
      scale: [64, 66, 67, 69, 71, 72, 75, 76, 78, 79], voice: 'celesta', every: 8000 },
    // a musette waltz in G, as on the Champ de Mars in 1889
    paris: { chords: [[31, 43, 47, 50, 55], [36, 43, 48, 52, 57], [38, 45, 50, 54, 60], [31, 43, 47, 50, 59]],
      scale: [67, 69, 71, 72, 74, 76, 78, 79, 81, 83], voice: 'harp', every: 7500 },
    // ninth chords and a blue note, late at night
    deco: { chords: [[36, 47, 52, 55, 62], [33, 43, 48, 52, 59], [38, 48, 53, 57, 64], [31, 41, 47, 52, 57]],
      scale: [60, 62, 63, 64, 67, 69, 72, 74, 75, 76], voice: 'ep', every: 7000 },
  };
  let mood = MOODS.salon;
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  // A plucked string: a bright tone whose filter closes as it rings. bend (in semitones)
  // slides into the note, vib adds a late vibrato, as on a guzheng or a sitar.
  function pluck(t, hz, dur, gain, bright, out, o) {
    o = o || {};
    const a = ctx.createOscillator(), b = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    a.type = 'sawtooth'; b.type = 'triangle';
    for (const [osc, k] of [[a, 1], [b, 2.003]]) {
      if (o.bend) { osc.frequency.setValueAtTime(hz * k * Math.pow(2, -o.bend / 12), t); osc.frequency.exponentialRampToValueAtTime(hz * k, t + 0.09); } else osc.frequency.value = hz * k;
    }
    if (o.vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.2;
      lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(hz * 0.012, t + 0.5);
      l.connect(lg); lg.connect(a.frequency); lg.connect(b.frequency); l.start(t); l.stop(t + dur + 0.1);
    }
    f.type = 'lowpass'; f.Q.value = o.buzz ? 6 : 1.5;
    f.frequency.setValueAtTime(Math.min(16000, hz * bright), t); f.frequency.exponentialRampToValueAtTime(hz * 1.1, t + dur * 0.55);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    a.connect(f); b.connect(f); f.connect(g).connect(out);
    const send = ctx.createGain(); send.gain.value = 0.7; g.connect(send).connect(verbSend);
    a.start(t); b.start(t); a.stop(t + dur + 0.1); b.stop(t + dur + 0.1);
  }
  // A soft brass voice: the filter opens with the breath and closes again.
  function horn(t, hz, dur, gain, out) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = hz;
    f.type = 'lowpass'; f.Q.value = 0.7;
    f.frequency.setValueAtTime(hz * 1.2, t); f.frequency.linearRampToValueAtTime(hz * 3.2, t + 0.25); f.frequency.exponentialRampToValueAtTime(hz * 1.4, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.18); g.gain.setValueAtTime(gain, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(out);
    const send = ctx.createGain(); send.gain.value = 0.8; g.connect(send).connect(verbSend);
    o.start(t); o.stop(t + dur + 0.1);
  }
  function note(voice, t, hz, gain, out) {
    switch (voice) {
      case 'harp': return pluck(t, hz, 2.8, gain * 1.3, 7, out);
      case 'lyre': return pluck(t, hz, 3.4, gain * 1.2, 4, out);
      case 'sitar': return pluck(t, hz, 3.2, gain * 1.1, 14, out, { bend: 1, buzz: true, vib: true });
      case 'guzheng': return pluck(t, hz, 2.6, gain * 1.2, 9, out, { vib: true });
      case 'harpsichord': pluck(t, hz, 1.4, gain * 1.1, 16, out); return pluck(t, hz * 2, 1.0, gain * 0.4, 12, out);
      case 'celesta': bell(t, hz * 2, 2.4, gain, 4, 0.6, out); return bell(t, hz * 4, 1.2, gain * 0.25, 4, 0.4, out);
      case 'horn': return horn(t, hz / 2, 2.6, gain * 0.9, out);
      default: return bell(t, hz, 3, gain, 1, 0.9, out);
    }
  }
  function startMusic() {
    if (music || !ready()) return;
    const out = ctx.createGain(); out.gain.value = 1; out.connect(musicBus);
    const wet = ctx.createGain(); wet.gain.value = 1.6; out.connect(wet).connect(verbSend);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.4; lp.connect(out);
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.05; lfoG.gain.value = 350; lfo.connect(lfoG).connect(lp.frequency); lfo.start();
    music = { out, lp, lfo, timer: 0, step: 0, at: 4, mood: null };
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(musicVol * 0.5, ctx.currentTime, 1.5);
    const chord = () => {
      if (!music) return;
      const m = mood, t = ctx.currentTime + 0.05;
      if (music.mood !== m) { music.mood = m; music.step = 0; music.at = 3 + Math.floor(Math.random() * 4); }
      const c = m.chords[music.step % m.chords.length];
      music.step += 1 + (Math.random() < 0.3 ? 1 : 0);
      const len = m.every / 1000 + 2;
      for (const n of c) {
        for (const det of [-6, 6]) {
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(n); o.detune.value = det + (Math.random() - 0.5) * 4;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.018, t + 2.5); g.gain.setValueAtTime(0.018, t + len - 3.5); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
          o.connect(g).connect(music.lp); o.start(t); o.stop(t + len + 0.2);
        }
      }
      // The melody wanders up and down the scale, mostly by step, on a slow beat.
      const notes = 2 + Math.floor(Math.random() * 3), beat = m.voice === 'harpsichord' ? 0.2 : 0.75;
      let when = t + 1 + Math.random();
      for (let i = 0; i < notes; i++) {
        music.at = Math.max(0, Math.min(m.scale.length - 1, music.at + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
        note(m.voice, when, midi(m.scale[music.at]), 0.05 + Math.random() * 0.03, out);
        when += beat * (1 + Math.floor(Math.random() * (m.voice === 'harpsichord' ? 2 : 3)));
      }
      music.timer = setTimeout(chord, m.every);
    };
    music.next = chord;
    chord();
  }
  // The room on the table sets the mood; a new one comes in on the next chord, soon after.
  function setMood(id) {
    const m = MOODS[id] || MOODS.salon;
    if (m === mood) return;
    mood = m;
    if (music) { clearTimeout(music.timer); music.timer = setTimeout(music.next, 1500); }
  }
  function stopMusic() {
    if (!music) return;
    const m = music; music = null;
    clearTimeout(m.timer);
    if (ctx) {
      musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.6);
      setTimeout(() => { try { m.lfo.stop(); m.out.disconnect(); } catch (e) { /* already stopped */ } }, 3000);
    }
  }

  // Recorded voices (voice/<id>/<key>.mp3, made by tools/voice). When the game runs from the
  // single offline file there are no recordings, and lessons fall back to the device's speech engine.
  const V = (typeof CHACKLATE_VOICE !== 'undefined') ? CHACKLATE_VOICE : { voices: [], events: {}, moves: {} };
  let coachVoice = 'mira', callVoice = 'mira', announceOn = false, deviceFallback = true;
  let index = null, indexLoad = null, current = null, queueId = 0;
  const clips = new Map();
  function voiceKey(text) {
    let h = 0x811c9dc5;
    for (const ch of String(text).normalize('NFC')) {
      const c = ch.codePointAt(0);
      h ^= c & 0xff; h = Math.imul(h, 0x01000193);
      if (c > 0xff) { h ^= (c >>> 8) & 0xff; h = Math.imul(h, 0x01000193); }
      if (c > 0xffff) { h ^= (c >>> 16) & 0xff; h = Math.imul(h, 0x01000193); }
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
  function loadIndex() {
    if (indexLoad) return indexLoad;
    if (typeof fetch === 'undefined' || location.protocol === 'file:') { index = {}; return (indexLoad = Promise.resolve(index)); }
    indexLoad = fetch('voice/index.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((j) => {
      index = {};
      for (const id of Object.keys(j.voices || {})) index[id] = new Set(j.voices[id]);
      return index;
    });
    return indexLoad;
  }
  function has(id, key) { return !!(index && index[id] && index[id].has(key)); }
  function clip(id, key) {
    const k = id + '/' + key;
    if (!clips.has(k)) {
      clips.set(k, fetch('voice/' + k + '.mp3').then((r) => { if (!r.ok) throw new Error('missing'); return r.arrayBuffer(); })
        .then((b) => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej))).catch((e) => { clips.delete(k); throw e; }));
    }
    return clips.get(k);
  }
  function duck(on) {
    if (music && ctx) musicBus.gain.setTargetAtTime(musicVol * (on ? 0.2 : 0.5), ctx.currentTime, on ? 0.3 : 0.8);
  }
  function stopSpeech() {
    queueId++;
    if (current) { try { current.stop(); } catch (e) { /* already ended */ } current = null; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }
  // Plays recordings back to back with a short breath between them. Resolves false if any is missing.
  async function playKeys(id, keys, gap) {
    if (!ready()) return false;
    await loadIndex();
    if (!keys.every((k) => has(id, k))) return false;
    const my = ++queueId;
    let bufs;
    try { bufs = await Promise.all(keys.map((k) => clip(id, k))); } catch (e) { return false; }
    if (my !== queueId) return true;
    if (current) { try { current.stop(); } catch (e) { /* already ended */ } }
    const voiceBus = ctx.createGain(); voiceBus.gain.value = 1; voiceBus.connect(master);
    let t = ctx.currentTime + 0.03, last = null;
    for (const b of bufs) {
      const s = ctx.createBufferSource(); s.buffer = b; s.connect(voiceBus); s.start(t);
      t += b.duration + (gap || 0.06); last = s;
    }
    current = last;
    duck(true);
    last.onended = () => { if (current === last) { current = null; duck(false); } };
    return true;
  }

  // Device speech engine, used only when there is no recording.
  let deviceVoice = null;
  function pickVoice(lang) {
    if (!('speechSynthesis' in window)) return null;
    const vs = speechSynthesis.getVoices();
    if (lang === 'hi') return vs.find((v) => /^hi/i.test(v.lang)) || null;
    return vs.find((v) => /en-(IN|GB)/i.test(v.lang) && /female|natural|neural|samantha|serena|veena/i.test(v.name)) || vs.find((v) => /^en/i.test(v.lang)) || null;
  }
  // Sentences and clauses are spoken one at a time with a breath between them (longer after a full
  // stop than after a comma), because device voices tend to run a whole paragraph together.
  function phrases(text) {
    return (String(text).match(/[^,;:.!?]+(?:[,;:]|[.!?]+["”’)]*|$)/g) || []).map((p) => p.trim()).filter(Boolean);
  }
  function device(text, rate, lang, onEnd) {
    if (!('speechSynthesis' in window)) return false;
    speechSynthesis.cancel();
    const v = lang === 'hi' ? pickVoice('hi') : (deviceVoice = deviceVoice || pickVoice('en'));
    const parts = phrases(text), my = queueId;
    if (music) duck(true);
    const next = (i) => {
      if (my !== queueId) { if (onEnd) onEnd(); return; }   // cut short by something else: still finished
      if (i >= parts.length) { duck(false); if (onEnd) onEnd(); return; }
      const u = new SpeechSynthesisUtterance(parts[i]);
      if (v) u.voice = v;
      if (lang === 'hi') u.lang = 'hi-IN';
      u.rate = rate || 1; u.pitch = 1;
      u.onend = () => setTimeout(() => next(i + 1), /[,;:]$/.test(parts[i]) ? PAUSE.comma : PAUSE.stop);
      u.onerror = () => { if (my !== queueId && onEnd) onEnd(); };
      speechSynthesis.speak(u);
    };
    next(0);
    return true;
  }
  const voiceInfo = (id) => V.voices.find((v) => v.id === id) || null;
  // Lesson and coach lines (English text from the content files).
  async function say(text, rate) {
    stopSpeech();
    const id = coachVoice;
    if (id !== 'device' && await playKeys(id, [voiceKey(text)])) return true;
    return deviceFallback ? device(text, rate, 'en') : false;
  }
  // A game call such as "check" or "mate.win", in the language of the chosen call voice.
  async function event(key) {
    if (callVoice === 'off') return false;
    const v = voiceInfo(callVoice);
    const lang = v ? v.lang : 'en';
    const text = (V.events[lang] || {})[key] || (V.events.en || {})[key];
    if (!text) return false;
    stopSpeech();
    if (v && await playKeys(v.id, [voiceKey(text)])) return true;
    return deviceFallback ? device(text, 1, lang) : false;
  }
  // The words for a move in SAN, e.g. "Nxe5+" becomes Knight, takes, ee five, check.
  // old: an old variation (Chaturanga), whose pieces keep their old names (Mantri, Gaja...).
  function moveWords(san, lang, old) {
    const B = V.moves[lang] || V.moves.en;
    if (!B) return [];
    const M = old && B.old ? Object.assign({}, B, { piece: B.old.piece, promote: Object.assign({}, B.promote, B.old.promote) }) : B;
    const s = String(san).replace(/[!?]+$/, '');
    const tail = /#$/.test(s) ? [M.mate] : /\+$/.test(s) ? [M.check] : [];
    if (/^O-O-O/.test(s)) return [M.castleQ].concat(tail);
    if (/^O-O/.test(s)) return [M.castleK].concat(tail);
    const m = s.match(/^([KQRBN])?([a-h])?([1-8])?(x)?([a-h])([1-8])(?:=([QRBN]))?/);
    if (!m) return [];
    const words = [M.piece[m[1] || 'P']];
    if (m[4]) words.push(M.takes);
    words.push(M.file[m[5]] + ' ' + M.rank[m[6]]);
    if (m[7]) words.push(M.promote[m[7]]);
    return words.concat(tail);
  }
  async function announce(san, old) {
    if (!announceOn || callVoice === 'off') return false;
    const v = voiceInfo(callVoice);
    const lang = v ? v.lang : 'en';
    const words = moveWords(san, lang, old).filter(Boolean);
    if (!words.length) return false;
    stopSpeech();
    if (v && await playKeys(v.id, words.map(voiceKey), 0.02)) return true;
    return deviceFallback ? device(words.join(' '), 1.1, lang) : false;
  }
  // The audio guide (guide/<key>.mp3, recorded by tools/voice/record-guide.py in the voice of whoever
  // says the line) and Rooky's word on each Collection item (pitch/...). onTalk(fn) hears
  // fn(true, what) when someone starts talking ('guide' or 'pitch') and fn(false, what) when they stop.
  const PAUSE = { comma: 280, stop: 550 };
  const lineClips = new Map();
  const talkers = [];
  function talking(on, what) { for (const fn of talkers) fn(on, what); }
  function lineClip(url) {
    if (!lineClips.has(url)) {
      lineClips.set(url, fetch(url).then((r) => { if (!r.ok) throw new Error('missing'); return r.arrayBuffer(); })
        .then((b) => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej))).catch((e) => { lineClips.delete(url); throw e; }));
    }
    return lineClips.get(url);
  }
  // Says one recorded line; falls back to the device's voice where the recording can't be fetched
  // (the single offline file). Resolves when the line has finished or was cut short, or at once if nothing was said.
  function line(url, text, what, lang) {
    stopSpeech();
    const my = queueId;
    return new Promise((done) => {
      const end = () => { if (my === queueId) talking(false, what); done(); };
      if (!canTalk() || !ready()) return done();
      talking(true, what);
      const viaDevice = () => { if (my !== queueId) return done(); if (!(deviceFallback && device(text, 0.95, lang || 'en', end))) end(); };
      if (typeof fetch === 'undefined' || location.protocol === 'file:' || !url) return viaDevice();
      lineClip(url).then((b) => {
        if (my !== queueId) return done();
        const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(master);
        const s = ctx.createBufferSource(); s.buffer = b; s.connect(bus); s.start(ctx.currentTime + 0.03);
        current = s;
        duck(true);
        s.onended = () => { if (current === s) { current = null; duck(false); } end(); };
      }, viaDevice);
    });
  }
  const guide = (key, text) => line('guide/' + key + '.mp3', text, 'guide', 'en');
  const pitch = (url, text) => line(url, text, 'pitch', 'en');
  // Lessons with their own speakers (words/<who>/<key>.mp3, recorded by tools/voice/record-words.py):
  // Rooky in English, Priya in Hindi.
  const words = (who, text) => line('words/' + who + '/' + voiceKey(text) + '.mp3', text, 'words', who === 'priya' ? 'hi' : 'en');
  // An era's story, read by that era's friend (tale/<era>/<key>.mp3, recorded by tools/voice/record-tales.py).
  const tale = (era, text) => line('tale/' + era + '/' + voiceKey(text) + '.mp3', text, 'tale', 'en');
  // True once the browser lets the game make sound (from the first tap on).
  let tapped = false;
  const canTalk = () => tapped || !!(ctx && ctx.state === 'running');
  function hush() { stopSpeech(); duck(false); talking(false, null); }

  return {
    play,
    setPack(p) { if (PACKS[p]) pack = p; },
    setMood,
    setSfx(on, vol) { sfxOn = on; if (vol !== undefined) sfxVol = vol; if (sfxBus) sfxBus.gain.value = sfxVol; },
    setMusic(on, vol) {
      musicOn = on; if (vol !== undefined) musicVol = vol;
      if (!ctx) return;
      if (on) { if (music) musicBus.gain.setTargetAtTime(musicVol * 0.5, ctx.currentTime, 0.4); else startMusic(); } else stopMusic();
    },
    // Browsers only allow sound after a user gesture; call this from one.
    unlock() { if (ready()) { tapped = true; if (musicOn && !music) startMusic(); } },
    say, hush, event, announce, voiceKey, moveWords, guide, pitch, words, tale, canTalk, phrases,
    onTalk(fn) { talkers.push(fn); },
    voices: () => V.voices.slice(),
    setVoices(o) {
      if (o.coach) coachVoice = o.coach;
      if (o.calls) callVoice = o.calls;
      if (o.announce !== undefined) announceOn = !!o.announce;
      if (o.deviceFallback !== undefined) deviceFallback = !!o.deviceFallback;
    },
    // Plays a short sample of a voice, for the settings screen.
    async preview(id) {
      const v = voiceInfo(id);
      if (!v) return device((V.events.en || {}).welcome || 'Hello', 1, 'en');
      stopSpeech();
      return playKeys(id, [voiceKey(V.events[v.lang].welcome)]);
    },
    get musicOn() { return musicOn; },
  };
}
