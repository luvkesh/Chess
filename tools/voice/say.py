"""How Kokoro should say words it gets wrong, shared by every recorder.

Each word or name maps to misaki phoneme markup ([shown](/phonemes/)), so the clip says it right
while captions and subtitles keep the normal spelling. Check a new entry with
KPipeline(lang_code='a')(text).phonemes before recording.
"""
import re

SAY = {
    # Names of places
    'Machu Picchu': '[Machu Picchu](/mˈɑʧu pˈikʧu/)',          # MAH-choo PEEK-choo, not "Pikku"
    'Mohenjo-daro': '[Mohenjo-daro](/mOhˈɛnʤO dˈɑɹO/)',        # mo-HEN-jo DAH-ro
    'Sounion': '[Sounion](/sˈuniɑn/)',                        # SOO-nee-on, not "Sow-nion"
    'Xiangqi': '[Xiangqi](/ʃjˈɑŋʧi/)',                         # shyang-chee
    'Chaturanga': '[Chaturanga](/ʧˌʌtəɹˈʌŋɡə/)',               # chuh-tuh-RUNG-guh
    # Sounds that are not words: Kokoro spells these out as letters
    'Brrr': '[Brrr](/bɹɹˈɜɹ/)',
    'Brr': '[Brr](/bɹˈɜɹ/)',
}
_PATTERN = re.compile(r'(?<![\w\[])(%s)(?![\w\]])' % '|'.join(re.escape(w) for w in sorted(SAY, key=len, reverse=True)))


def voiced(text):
    """The text as Kokoro should read it."""
    return _PATTERN.sub(lambda m: SAY[m.group(1)], text)
