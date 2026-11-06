"""Natural pauses for Kokoro speech: a short breath after a comma and a longer one after a full stop.

Kokoro reads a line almost without stopping at its punctuation (a comma is about 40 ms), which runs a
child's instructions together. Kokoro reports when each word and mark is spoken, so the line is split
just after each mark, at its quietest moment, and a little time is laid in there. The line is still
spoken in one go, so its tune stays natural.

Nothing is trimmed off the words: the tail of each word and the breath before the next stay whole,
and each gap is a faint room tone (not digital silence) that the voice eases into, so a pause sounds
like a person taking a breath rather than the sound cutting out and starting again (user, 2026-10-31).
"""
import numpy as np

from say import voiced

RATE = 24000
EASE = int(0.03 * RATE)          # the voice eases down over 30 ms into each gap
ROOM = 10 ** (-66 / 20)          # a faint, steady room tone under the whole clip
END_MARKS = '.!?'


def quietest(audio, at, reach=0.06, win=0.01):
    """The sample near `at` (seconds) where the sound is softest, so a split never clips a word."""
    w = int(win * RATE)
    lo, hi = max(w, int((at - reach) * RATE)), min(len(audio) - w, int((at + reach) * RATE))
    if hi <= lo:
        return min(max(int(at * RATE), 0), len(audio))
    energy = np.convolve(np.asarray(audio, dtype=np.float32) ** 2, np.ones(w), 'same')[lo:hi]
    return lo + int(np.argmin(energy))


def _room(n, rng):
    """n samples of soft, low room tone (smoothed noise), so a pause is never dead air."""
    if n <= 0:
        return np.zeros(0, dtype=np.float32)
    noise = rng.standard_normal(n + 64).astype(np.float32)
    noise = np.convolve(noise, np.ones(64, dtype=np.float32) / 64, 'same')[:n]
    peak = float(np.max(np.abs(noise))) or 1.0
    return noise / peak * ROOM


def _breath(a, gap, rng):
    """`a` followed by `gap` seconds of breath: the sound eases down into the room tone."""
    a = np.array(a, dtype=np.float32)
    k = min(EASE, len(a) // 4)
    if k:
        a[-k:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, k, dtype=np.float32))
    return np.concatenate([a, _room(int(gap * RATE), rng)])


def speak(pipe, text, voice, speed=1.0, comma=0.12, stop=0.38, starts=False):
    """Speaks `text` and returns 24 kHz float audio with breaths after its punctuation.

    With starts=True it also returns the second each sentence starts (for captions)."""
    rng = np.random.default_rng(7)
    out, begins, n = [], [0.0], 0
    for r in pipe(voiced(text, getattr(pipe, 'lang_code', 'a')), voice=voice, speed=speed):
        audio = np.asarray(r.audio, dtype=np.float32)
        if out:   # between Kokoro's chunks (each ends a sentence): a full breath
            prev = out.pop()
            n -= len(prev)
            prev = _breath(prev, stop, rng)
            out.append(prev)
            n += len(prev)
            begins.append(n / RATE)
        start = 0
        for t in r.tokens or []:
            mark = t.text.strip()
            if t.end_ts is None or not mark or mark[-1] not in ',;:.!?' or t.end_ts * RATE >= len(audio) - RATE * 0.05:
                continue
            cut = quietest(audio, t.end_ts)
            if cut <= start:
                continue
            piece = _breath(audio[start:cut], comma if mark[-1] in ',;:' else stop, rng)
            out.append(piece)
            n += len(piece)
            if mark[-1] in END_MARKS:
                begins.append(n / RATE)
            start = cut
        out.append(audio[start:])
        n += len(audio) - start
    audio = np.concatenate(out) if out else np.zeros(0, dtype=np.float32)
    # the faint room tone runs under the speech too, so the gaps match what is around them
    audio = audio + _room(len(audio), rng) * 0.6
    # no dead air before the first word, so the clip speaks as soon as it is played
    loud = np.flatnonzero(np.abs(audio) > 10 ** (-45 / 20))
    lead = max(0, int(loud[0]) - int(0.02 * RATE)) if len(loud) else 0
    tail = min(len(audio), int(loud[-1]) + int(0.12 * RATE)) if len(loud) else len(audio)
    audio = audio[lead:tail]
    if not starts:
        return audio
    marks = []
    for b in begins:
        t = max(0.0, b - lead / RATE)
        if t < len(audio) / RATE - 0.1 and (not marks or t - marks[-1] > 0.15):
            marks.append(t)
    return audio, marks
