"""Local word-timestamped transcription of a face-cam recording (no network after the model download).
Usage: transcribe.py <audio.wav> <out.json> <prompt>"""
import json, os, sys
import torch
import stable_whisper

torch.set_num_threads(4)
audio, out, prompt = sys.argv[1], sys.argv[2], sys.argv[3]
model = stable_whisper.load_model(os.environ.get('ASR_MODEL', 'small.en'), device='cpu', download_root='.cache/whisper')
# The prompt carries vocabulary only (title, series name). Prompting with the whole script would make the model
# "hear" the script and hide flubs that the edit is supposed to remove.
result = model.transcribe(audio, language='en', word_timestamps=True, vad=False, initial_prompt=prompt, verbose=None)
words = [{'text': w.word.strip(), 'start': round(w.start, 3), 'end': round(w.end, 3)} for s in result.segments for w in s.words if w.word.strip()]
if not words:
    raise SystemExit('No speech recognised in the recording.')
with open(out, 'w') as f:
    json.dump({'model': os.environ.get('ASR_MODEL', 'small.en'), 'words': words}, f, indent=1)
print(f'Transcribed {len(words)} words.')
