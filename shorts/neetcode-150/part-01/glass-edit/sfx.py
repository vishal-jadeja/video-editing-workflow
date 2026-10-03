"""Quiet synthesized UI sounds (pops on reveals, airy whooshes on scene changes) -> sfx.wav, then audio_mix.wav."""
import os
import subprocess
import wave
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MEDIA = os.environ.get("MEDIA_DIR", os.path.dirname(HERE))
SFX = os.path.join(HERE, "sfx.wav")

SR, DUR = 44100, 57.0
out = np.zeros(int(SR * DUR))
rng = np.random.default_rng(7)


def pop(t, f0=900, f1=520, gain=0.10, d=0.09):
    n = int(SR * d); x = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(np.geomspace(f0, f1, n)) / SR
    i = int(t * SR); out[i:i + n] += np.sin(ph) * (1 - np.exp(-x * 900)) * np.exp(-x * 45) * gain


def whoosh(t, d=0.38, gain=0.05):
    n = int(SR * d); x = np.linspace(0, 1, n); noise = rng.standard_normal(n)
    y = np.zeros(n); a = 0.0
    for k in range(n):   # one-pole lowpass sweeping upward: an airy swell
        a += (0.02 + 0.25 * x[k]) * (noise[k] - a); y[k] = a
    i = int(t * SR); out[i:i + n] += y * np.sin(np.pi * x) ** 2 * gain / np.abs(y).max()


for t in [1.3, 4.9, 15.75, 26.55, 35.1, 51.4]:
    pop(t)
pop(47.85, 700, 380, 0.11)            # duplicate hit
pop(48.95, 1100, 1500, 0.09, 0.12)    # return true (rising)
pop(55.05, 820, 1230, 0.09, 0.12)     # outro
for t in [1.7, 3.15, 10.7, 19.9, 27.95, 36.45, 41.9, 51.2, 54.9]:
    whoosh(t, 0.5 if t in (10.7, 19.9, 41.9, 54.9) else 0.38)

pcm = (np.clip(np.stack([out, out], 1), -1, 1) * 32767).astype("<i2")
with wave.open(SFX, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(MEDIA, "Neetcode 150 part 1.mov"), "-i", SFX, "-filter_complex",
                "[0:a]highpass=f=70,loudnorm=I=-14.5:TP=-1.5:LRA=7,aresample=48000[v];[1:a]aresample=48000[s];"
                "[v][s]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.89[a]",
                "-map", "[a]", "-ar", "48000", os.path.join(HERE, "audio_mix.wav")], check=True)
