"""Records the coach's spoken website guide (guide.json) with Kokoro-82M, offline, into audio/.

    HF_HOME=... python3.12 apps/website/tools/record-guide.py

Needs the `kokoro` package, its weights and ffmpeg; see the setup in tools/voice/record.py. Each clip
is saved as audio/<section>.mp3, and audio/index.json keeps the exact words, so build.py can tell
when a line or the coach's name changed and the clip must be recorded again.
"""
import json
import os
import pathlib
import subprocess
import tempfile

os.environ['HF_HUB_OFFLINE'] = '1'
import sys

import soundfile as sf
from kokoro import KPipeline

here = pathlib.Path(__file__).parent.parent
sys.path.insert(0, str(here.parent.parent / 'tools' / 'voice'))
from pauses import speak   # a breath after each comma and full stop, as in the game's guide
guide = json.loads((here / 'guide.json').read_text())
coach = json.loads((here.parent.parent / 'packages' / 'content' / 'campaign.json').read_text())['coach']['name']
out = here / 'audio'
out.mkdir(exist_ok=True)
pipe = KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M')   # American English
index = {'voice': guide['voice'], 'lines': {}}
for key, line in guide['lines'].items():
    text = line.replace('{coach}', coach)
    audio = speak(pipe, text, guide['voice'], guide['speed'])
    with tempfile.NamedTemporaryFile(suffix='.wav') as wav:
        sf.write(wav.name, audio, 24000)
        # the same treatment as the game's clips: trimmed, even loudness, mono 24 kHz at 40 kb/s
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav.name, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-18:TP=-2:LRA=7',
                        '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '40k', str(out / (key + '.mp3'))], check=True)
    index['lines'][key] = text
    print(key, round(len(audio) / 24000, 1), 's')
(out / 'index.json').write_text(json.dumps(index, indent=2, ensure_ascii=False) + '\n')
