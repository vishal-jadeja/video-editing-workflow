# Glass edit: NeetCode 150 Part 1 (Python compositor)

A standalone alternative to the Remotion workflow: it edits a recorded face-cam take directly. It adds frosted-glass cards over the torso, word-by-word captions from an SRT, algorithm visuals, gentle eased zoom-ins and quiet synthesized sound effects. Optional split scenes put the graphics in a frosted band across the top 38% and drop the face cam into the bottom 62%.

macOS only as written: it uses SF Pro (`/System/Library/Fonts/SFNS.ttf`) and JetBrains Mono Nerd Font from `~/Library/Fonts`.

## Inputs

Put these in `MEDIA_DIR` (default: the parent of this folder):

- `Neetcode 150 part 1.mov`: the face-cam take (2160 × 3840, 30 fps, BT.709)
- `Neetcode150 part 1.srt`: captions timed to the take

## Run

```sh
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
MEDIA_DIR=/path/to/media .venv/bin/python sfx.py            # sound effects + loudness-normalized mix
MEDIA_DIR=/path/to/media .venv/bin/python edit.py stills 12 47   # preview frames -> stills/
MEDIA_DIR=/path/to/media .venv/bin/python edit.py render         # -> "Neetcode 150 part 1 - edit v3.mp4"
```

## Layout

- `SPLITS`: (start, end) seconds of each split scene. Set `SPLITS = []` for the all-card layout of the original edit.
- `SPLIT_H`: graphics band height (1460 px = 38%).
- `ZOOM_KEYS`: punch-in beats. They only apply while the face cam fills the frame.

Scene timings are hand-placed against this take's narration, so a new take needs them re-timed.

## Colour

Decoding and encoding use BT.709 TV range explicitly, and the output carries BT.709 tags (`setparams`, `+write_colr`). An untagged render makes players guess a profile and shift skin tones.
