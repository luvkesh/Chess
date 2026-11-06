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


# Other languages: Kokoro reads them through espeak, which takes no phoneme markup, so names it gets
# wrong are written in that language's own script instead. Each sentence goes on its own line, so
# Kokoro reads it as one piece and pauses.speak() puts a full breath between sentences.
SAY_IN = {
    'h': {   # Hindi
        'Chackmate': 'चैकमेट',
        'Machu Picchu': 'माचू पिच्चू',
        'Mohenjo-daro': 'मोहनजोदड़ो',
        'Sounion': 'सूनियन',
        'Xiangqi': 'श्यांगची',
        'Chaturanga': 'चतुरंग',
        "J'adoube": 'झा डूब',
        "j'adoube": 'झा डूब',
    },
}
_STOPS = re.compile(r'(?<=[।.!?])\s+')


def voiced(text, lang='a'):
    """The text as Kokoro should read it (lang is Kokoro's language code: a, b, h...)."""
    if lang in 'ab':
        return _PATTERN.sub(lambda m: SAY[m.group(1)], text)
    for word, said in sorted(SAY_IN.get(lang, {}).items(), key=lambda x: -len(x[0])):
        text = re.sub(r'(?<![\w])%s(?![\w])' % re.escape(word), said, text)
    # the Devanagari full stop is dropped by espeak, so it would run sentences together
    return '\n'.join(p.strip() for p in _STOPS.split(text.replace('।', '.')) if p.strip())
