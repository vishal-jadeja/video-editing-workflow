# Face-cam edition

The edit uses four layouts selected by cue words in `data/part-01.json` under `layouts`:

| Section | Layout |
| --- | --- |
| Hook | Full-frame camera + array overlay; switches to graphics on “one hundred thousand” |
| Problem | Full-frame camera intro; switches to split (graphics top, camera bottom) on “Given an array” |
| Brute force | Full motion graphics and exact code |
| Better | Split: sorting animation top, camera bottom; full graphics/code on “neighbours” |
| One-liner | Full-frame camera + code overlay; full graphics on “always processes” |
| Optimal | Split: set introduction top, camera bottom; full graphics on “one number at a time” |
| CTA | Full-frame camera + follow text |

All layouts retain the persistent title after 3 seconds and synchronized captions. Full code demonstrations receive the whole graphics area so code isn't squeezed beside a face. Captions over footage use a soft glyph shadow, not a box. The video still reserves the bottom 20% and rightmost 120px for platform UI.

### The four layouts

Every moment of the video uses exactly one of these:

| Mode | Geometry |
| --- | --- |
| `facecam` | Camera fills the whole 1080 × 1920 frame. Header and captions sit on top. |
| `graphics` | Motion graphics fill the whole frame on the textured background. |
| `split` | Motion graphics on the **top 55%** (y 0–1056, below the header); the camera runs **full width across the bottom 45%** (y 1056–1920, edge to edge, no border). Captions sit on the seam at y 990 so they never cover the face. |
| `overlay` | Camera fills the frame; a scene-specific graphic sits on top of it. Only scenes with an overlay design (`hook`, `one`) accept it; any other scene fails at layout resolution. |

The camera is never an inset box with graphics above and below it. The geometry lives in `LAYOUT` in `src/theme.ts`.

## Add your recording later

1. Place your recording at **`assets/facecam.mp4`** inside this project.
2. Run `npm run studio` to preview, or `npm run stills` to export review frames.
3. Run `npm run render` and `npm run validate` for the final MP4.

No React edits, API key, new narration or re-alignment are required to replace the placeholder. Each command detects the file and copies it into `public/media/`. If it is absent, a neutral silhouette placeholder is shown. A malformed or too-short supplied file produces an explicit error rather than silently looping or freezing.

The default is **one continuous recording aligned with the 66.47-second edit**, including the sections where your camera is hidden. Its playback continues through cuts instead of restarting at every appearance. Record while listening to the existing narration if you want matching mouth movements. Arbitrary new speech is not automatically lip-synced or retimed. The camera's audio is muted; the existing narration/SFX mix is preserved. Using your recorded speech as the narration would require a new alignment and audio mix.

## Trim and crop

Edit `data/facecam.json`:

```json
{
  "file": "assets/facecam.mp4",
  "sourceStartSeconds": 1.5,
  "objectPosition": "50% 42%",
  "splitObjectPosition": "50% 30%",
  "zoom": 1,
  "sceneOverrides": {}
}
```

`sourceStartSeconds` skips a lead-in before the master edit begins. `objectPosition` sets the full-frame horizontal/vertical focal point; `splitObjectPosition` controls the bottom split panel (1080 × 864) independently; a larger vertical percentage moves the face up the panel. Aim for eyes about a third of the way down the panel and the mouth above y 1536 (platform UI starts there). `zoom` can be 1…3. Both portrait and landscape recordings are cropped to fill the relevant panel. A close arm's-length selfie is too tight for split: at full width the face is taller than the panel, so record split scenes chest-up (or landscape) with headroom. Inspect the split crop as well as the full-frame crop.

For separately recorded takes, specify source timing for that scene:

```json
"sceneOverrides": {
  "better": {
    "file": "assets/better-facecam.mp4",
    "sourceStartSeconds": 0.4,
    "objectPosition": "50% 35%",
    "zoom": 1.05
  }
}
```

Here 0.4 seconds into the source corresponds to the beginning of the better scene, even if a layout change occurs later. An override inherits the master source file if `file` is omitted. Set `sourceStartSeconds` explicitly for a separate take. Overrides can use any scene ID: `hook`, `problem`, `brute`, `better`, `one`, `optimal`, `cta`.

## Change the edit

Modes are `facecam`, `overlay`, `split`, `graphics`. Every scene begins with an `at: "start"` entry. Additional entries reference a cue name already present in that scene's data, in increasing time order:

```json
"hook": [
  {"at": "start", "mode": "overlay"},
  {"at": "wall", "mode": "graphics"}
]
```

Changing `layouts` takes effect at the next preview/render; it does not regenerate narration. The current split/overlay arrangements are composed specifically for this problem. New algorithm-specific graphics belong in `src/facecam.tsx`/`src/scenes.tsx`; camera playback, cropping, captions, cue resolution and export remain reusable.

The frame-accurate resolved edit is exported to `out/facecam-edit-plan.json`. The face-cam media manifest is `src/generated/camera.json`; it is generated, so edit the data files instead.
