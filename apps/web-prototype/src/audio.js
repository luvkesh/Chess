// Chacklate sound: every effect and the ambient score are synthesised with the
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
  // Slow suspended chords on a warm pad with a sparse electric piano. A new
  // voicing every eight seconds; nothing repeats exactly.
  const CHORDS = [[48, 55, 62, 64, 71], [45, 52, 59, 60, 67], [41, 48, 55, 57, 64], [43, 50, 57, 59, 66], [40, 47, 54, 55, 62], [41, 48, 53, 57, 64]];
  const SCALE = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81];
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function startMusic() {
    if (music || !ready()) return;
    const out = ctx.createGain(); out.gain.value = 1; out.connect(musicBus);
    const wet = ctx.createGain(); wet.gain.value = 1.6; out.connect(wet).connect(verbSend);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.4; lp.connect(out);
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.05; lfoG.gain.value = 350; lfo.connect(lfoG).connect(lp.frequency); lfo.start();
    music = { out, lp, lfo, timer: 0, step: 0 };
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(musicVol * 0.5, ctx.currentTime, 1.5);
    const chord = () => {
      if (!music) return;
      const t = ctx.currentTime + 0.05;
      const c = CHORDS[music.step % CHORDS.length];
      music.step += 1 + (Math.random() < 0.3 ? 1 : 0);
      for (const n of c) {
        for (const det of [-6, 6]) {
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(n); o.detune.value = det + (Math.random() - 0.5) * 4;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.018, t + 2.5); g.gain.setValueAtTime(0.018, t + 6.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 10);
          o.connect(g).connect(music.lp); o.start(t); o.stop(t + 10.2);
        }
      }
      // Sparse melody on the electric piano.
      const notes = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < notes; i++) {
        const when = t + 1 + Math.random() * 6;
        bell(when, midi(SCALE[Math.floor(Math.random() * SCALE.length)]), 3, 0.05 + Math.random() * 0.03, 1, 0.9, out);
      }
      music.timer = setTimeout(chord, 8000);
    };
    chord();
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
  function device(text, rate, lang) {
    if (!('speechSynthesis' in window)) return false;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = lang === 'hi' ? pickVoice('hi') : (deviceVoice = deviceVoice || pickVoice('en'));
    if (v) u.voice = v;
    if (lang === 'hi') u.lang = 'hi-IN';
    u.rate = rate || 1; u.pitch = 1;
    if (music) { duck(true); u.onend = () => duck(false); }
    speechSynthesis.speak(u);
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
  function moveWords(san, lang) {
    const M = V.moves[lang] || V.moves.en;
    if (!M) return [];
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
  async function announce(san) {
    if (!announceOn || callVoice === 'off') return false;
    const v = voiceInfo(callVoice);
    const lang = v ? v.lang : 'en';
    const words = moveWords(san, lang).filter(Boolean);
    if (!words.length) return false;
    stopSpeech();
    if (v && await playKeys(v.id, words.map(voiceKey), 0.02)) return true;
    return deviceFallback ? device(words.join(' '), 1.1, lang) : false;
  }
  function hush() { stopSpeech(); duck(false); }

  return {
    play,
    setPack(p) { if (PACKS[p]) pack = p; },
    setSfx(on, vol) { sfxOn = on; if (vol !== undefined) sfxVol = vol; if (sfxBus) sfxBus.gain.value = sfxVol; },
    setMusic(on, vol) {
      musicOn = on; if (vol !== undefined) musicVol = vol;
      if (!ctx) return;
      if (on) { if (music) musicBus.gain.setTargetAtTime(musicVol * 0.5, ctx.currentTime, 0.4); else startMusic(); } else stopMusic();
    },
    // Browsers only allow sound after a user gesture; call this from one.
    unlock() { if (ready() && musicOn && !music) startMusic(); },
    say, hush, event, announce, voiceKey, moveWords,
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
