# NeetCode 150 — Part 1

For the automated plan/preflight/preview/build commands, start with the [short-video workflow](../../../workflows/shorts/README.md). The commands below remain available for individual production steps.

**Current export: face-cam edition.** Four cue-driven layouts combine full face cam, face cam with overlays, stacked split screens and full motion graphics. See [FACECAM.md](FACECAM.md) to add a recording, trim/crop it, use separate takes, or change the scene layouts. With no recording the camera uses silhouette placeholders. The preceding full-graphics export is preserved at `out/part-01-contains-duplicate-graphics-only.mp4`.

1080 × 1920, 30 fps, H.264 / AAC. Remotion + React + TypeScript. All important content stays at x=60…920 and y<1536. The only glow is the subtle top background radial. No element shadows, tinted badges, pills or icon assets.

## Outputs

- `out/part-01-contains-duplicate.mp4`
- `out/part-01-contains-duplicate-cover.png`
- `out/qa/`: requested 2s, 15s, 25s, 34s, 45s and 51s frames, plus actual scene frames. The complete spoken script determines the timeline, so those requested seconds do not necessarily correspond to the original scene estimates.
- `src/generated/timeline.json`: word timestamps and resolved animation cues.

## Re-render

Use Node 22+, Python 3.10+, ffmpeg and a local Chromium browser. By default the render script uses the installed Brave browser, with a separate headless profile; it does not touch your browsing session. Set `REMOTION_BROWSER_EXECUTABLE` to use another Chromium executable.

```sh
npm install
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
node scripts/prepare.mjs
npm run voice:local
npm run mix
npm run check
npm run stills
npm run cover
npm run render
npm run validate
```

After editing only visuals: `npm run check && npm run stills && npm run render`.
Preview interactively with `npm run studio`.

## Narration and alignment

The user approved macOS Daniel as a substitute because no OpenAI key was available. This export uses Daniel at 205 words per minute, with separate scene WAV files. It preserves the whole script, normalizing spoken numerals and Big O pronunciation. Consequently the runtime exceeds the approximate 53-second outline. Local speech generation needs access to macOS speech services.

For OpenAI narration, set `OPENAI_API_KEY` in your shell or load a private `.env` via Node's `--env-file` option. No key is stored in code. Run:

```sh
npm run voice:openai
npm run mix
npm run stills
npm run render
```

The OpenAI mode uses `gpt-4o-mini-tts` and `cedar`, with calm conversational instructions. Override `OPENAI_VOICE` or `OPENAI_TTS_MODEL` if needed. Both providers use local Stable-ts / Whisper `base.en` forced alignment of the exact script, not estimated word spacing. This requires a one-time official Whisper model download (~139 MB), cached in `.cache/whisper` and hash-verified by Whisper. Keep TLS verification enabled; use your system's trusted CA configuration if Python needs it.

Each cue in the data file is an exact spoken phrase. The build resolves that phrase to aligned word onset and fails on missing cues. Transitions last 160–300 ms. Captions contain small groups with the spoken word in violet. Content captions and scan progress keep the long explanations active. The brute-force large count is explicitly a **worst case** (4,999,950,000 comparisons at n=100,000); the demonstrated input returns after 3 comparisons. The optimal input returns after 2 checks.

## Series reuse

Copy `data/part-01.json` to a new part file and edit problem metadata, arrays, exact code, script lines and cue phrases. Set `PART_DATA=data/part-02.json` for preparation and voice generation. Output filenames, cover title/part, problem card and CTA part number derive from that file. `ProblemCard`, `ApproachLabel`, `ComplexityLine`, `ArrayTiles`, `Pointer`, `SetBox`, `CodePanel`, `Captions`, and `EndCard` are reusable. Existing scene renderers illustrate the Contains Duplicate algorithm; different problem mechanics can be added to the scene registry in `src/scenes.tsx` while retaining the same visual system, captions, audio, alignment and export pipeline.

## Assets and audio

Place your photo at `assets/avatar.png` and run `node scripts/prepare.mjs`; without it the violet-ring placeholder remains. Fonts are fetched from Google Fonts once and cached locally. Code remains exact Python from the brief, with syntax colors and active-line highlighting.

SFX are original deterministic synthesis documented in `assets/sfx/CREDITS.md`. No downloaded music or sound samples are used. The mix normalizes voice first, layers effects quietly, then uses two-pass ffmpeg normalization and a measured stereo correction targeting -14 LUFS, with a -1.5 dBTP ceiling. `out/audio-loudness.json` stores first-pass measurements, `out/audio-final-loudness.json` stores the mixed WAV measurements, and `out/validation.json` stores final MP4 codec, dimensions, frame count, duration and encoded-audio measurements.

Suggested upload disclosure: “AI-generated narration.”

## References

- OpenAI speech generation: https://developers.openai.com/api/docs/guides/text-to-speech
- Forced alignment: https://github.com/jianfch/stable-ts
- Remotion render: https://www.remotion.dev/docs/render
