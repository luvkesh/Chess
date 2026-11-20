"""Coach pieces said the way they sound in the middle of a sentence.

The game says a coach line by playing recorded pieces back to back ("Your pawn" + "takes the pawn on"
+ "e four" + ...). Said on its own, every piece ends the way a sentence ends: the voice falls and
stops, so the joined line sounds like a list of separate words (user, 2026-11-19: "less computery,
more fluent"). So a piece that the line goes on after is spoken inside a carrier sentence, with a few
words before and after it, and only the piece is cut out, using Kokoro's own word timings: its tune
runs on into the next piece, and it starts the way a word in mid-sentence starts.

    piece_audio(pipe, spoken, voice, speed, mode)   mode: 'end' | 'mid' (lines.js carryOf picks it)

'end' keeps the piece's natural ending (a square or name that ends the line); 'mid' carries on.
A piece that is a whole sentence (it ends in . ! or ?) or has a comma inside is recorded on its own.
"""
import re

import numpy as np

from pauses import RATE, quietest

# Words a piece can end on that always run on into the next piece (the same list as lines.js).
RUNS_ON = set('on to from the a an and of with by at for in it its is your his her their than up because '
              'into onto toward towards near behind next who which that this these those or but so as can'.split())
FADE = int(0.008 * RATE)
SQUARE = re.compile(r'^(?:ay|bee|see|dee|ee|eff|jee|aitch) (?:one|two|three|four|five|six|seven|eight)$')


def carrier(spoken, mode):
    """(before, after): the words said around the piece. Only the piece is kept."""
    first = spoken.split()[0]
    if SQUARE.match(spoken):
        before = 'the knight on'
    elif first.lower() == 'and':
        before = 'Your pawn takes on e four'
    elif first[0].islower():
        before = 'Your knight'
    else:
        before = ''
    after = ('e four, and wins.' if spoken.split()[-1].lower() in RUNS_ON else 'and wins.') if mode == 'mid' else '.'
    return before, after


def words(text):
    return [w for w in re.split(r'\s+', re.sub(r'\[([^\]]+)\]\(/[^)]*/\)', lambda m: m[1].replace(' ', '_'), text)) if re.search(r'\w', w)]


def piece_audio(pipe, spoken, voice, speed, mode):
    """24 kHz audio of `spoken` cut from a carrier sentence, or None if the cut can't be made safely."""
    before, after = carrier(re.sub(r'\[([^\]]+)\]\(/[^)]*/\)', r'\1', spoken), mode)
    text = ' '.join(x for x in (before, spoken) if x) + (' ' + after if after != '.' else '.')
    nb, np_ = len(words(before)), len(words(spoken))
    audio, toks = [], []
    for r in pipe(text, voice=voice, speed=speed):
        off = sum(len(a) for a in audio) / RATE
        audio.append(np.asarray(r.audio, dtype=np.float32))
        toks += [(t.text, None if t.start_ts is None else t.start_ts + off, None if t.end_ts is None else t.end_ts + off) for t in (r.tokens or [])]
    a = np.concatenate(audio) if audio else np.zeros(0, dtype=np.float32)
    said = [t for t in toks if re.search(r'\w', t[0])]
    if len(said) < nb + np_ or any(t[1] is None or t[2] is None for t in said[:nb + np_]):
        return None
    piece = said[nb:nb + np_]
    if [w.lower() for w in words(spoken)] != [re.sub(r'[^\w\'-]', '', t[0]).lower() or t[0].lower() for t in piece]:
        # Kokoro split or merged a word differently: no safe cut
        if len(piece) != np_:
            return None
    start = quietest(a, piece[0][1], reach=0.035, win=0.006) if nb else max(0, int(piece[0][1] * RATE) - int(0.02 * RATE))
    if mode == 'mid':
        end = quietest(a, piece[-1][2], reach=0.035, win=0.006)
    else:
        # the piece ends the line: keep its natural fall and a little of its tail
        end = int(min(len(a) / RATE, piece[-1][2] + 0.12) * RATE)
        loud = np.flatnonzero(np.abs(a[start:end]) > 10 ** (-45 / 20))
        if len(loud):
            end = start + int(loud[-1]) + int(0.03 * RATE)
    out = np.array(a[start:end], dtype=np.float32)
    if len(out) < int(0.08 * RATE):
        return None
    k = min(FADE, len(out) // 4)
    out[:k] *= np.linspace(0, 1, k, dtype=np.float32)
    out[-k:] *= np.linspace(1, 0, k, dtype=np.float32)
    return out
