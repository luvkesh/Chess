"""Natural pauses for Kokoro speech: a breath after every comma and a longer one after every full stop.

Kokoro reads a line almost without stopping at its punctuation (a comma is about 40 ms), which runs a
child's instructions together. Kokoro reports when each word and mark is spoken, so the line is cut
just after each mark, at the quietest moment near it, and silence is laid in between. The line is
still spoken in one go, so its tune stays natural.
"""
import numpy as np

RATE = 24000
FADE = int(0.008 * RATE)


def quietest(audio, at, reach=0.06, win=0.01):
    """The sample near `at` (seconds) where the sound is softest, so a cut never clips a word."""
    w = int(win * RATE)
    lo, hi = max(w, int((at - reach) * RATE)), min(len(audio) - w, int((at + reach) * RATE))
    if hi <= lo:
        return min(max(int(at * RATE), 0), len(audio))
    energy = np.convolve(np.asarray(audio, dtype=np.float32) ** 2, np.ones(w), 'same')[lo:hi]
    return lo + int(np.argmin(energy))


def trim(audio, floor=0.006, keep=0.02):
    """Drops the near-silence at both ends of a piece, so each pause is exactly as long as set."""
    loud = np.flatnonzero(np.abs(audio) > floor)
    if not len(loud):
        return audio[:0]
    k = int(keep * RATE)
    return audio[max(0, loud[0] - k):min(len(audio), loud[-1] + k)]


def speak(pipe, text, voice, speed=1.0, comma=0.3, stop=0.65):
    """Speaks `text` and returns 24 kHz float audio with pauses after its punctuation."""
    pieces = []
    for r in pipe(text, voice=voice, speed=speed):
        audio = np.asarray(r.audio, dtype=np.float32)
        start = 0
        for t in r.tokens or []:
            mark = t.text.strip()
            if t.end_ts is None or not mark or mark[-1] not in ',;:.!?' or t.end_ts * RATE >= len(audio) - RATE * 0.05:
                continue
            cut = quietest(audio, t.end_ts)
            if cut <= start:
                continue
            pieces.append((audio[start:cut], comma if mark[-1] in ',;:' else stop))
            start = cut
        pieces.append((audio[start:], stop))
    pieces = [(trim(a), gap) for a, gap in pieces]
    pieces = [(a, gap) for a, gap in pieces if len(a)]
    out = []
    for i, (a, gap) in enumerate(pieces):
        a = a.copy()
        if len(a) > 2 * FADE:
            a[:FADE] *= np.linspace(0, 1, FADE)
            a[-FADE:] *= np.linspace(1, 0, FADE)
        out.append(a)
        if i < len(pieces) - 1:
            out.append(np.zeros(int(gap * RATE), dtype=np.float32))
    return np.concatenate(out) if out else np.zeros(0, dtype=np.float32)
