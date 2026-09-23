import json, os, hashlib, subprocess
from pathlib import Path
import torch
import stable_whisper

torch.set_num_threads(4)
data=json.loads(Path(os.environ.get('PART_DATA','data/part-01.json')).read_text())
model=None
for scene in data['scenes']:
    prefix=Path('public/audio')/scene['id']
    signature=prefix.with_suffix('.sha').read_text()
    result_path=prefix.with_suffix('.words.json')
    if result_path.exists() and json.loads(result_path.read_text()).get('signature')==signature:
        print('Alignment cached:',scene['id'],flush=True)
        continue
    if model is None:
        model=stable_whisper.load_model('base.en',device='cpu',download_root='.cache/whisper')
    print('Aligning:',scene['id'],flush=True)
    result=model.align(str(prefix.with_suffix('.wav')),scene['voice'],language='en',vad=False,verbose=False)
    words=[{'word':w.word.strip(),'start':round(w.start,3),'end':round(w.end,3)} for s in result.segments for w in s.words]
    if not words or any(w['end']<w['start'] for w in words):
        raise RuntimeError('Invalid alignment: '+scene['id'])
    result_path.write_text(json.dumps({'signature':signature,'words':words},indent=2))
subprocess.run(['node','scripts/timeline.mjs'],check=True)
