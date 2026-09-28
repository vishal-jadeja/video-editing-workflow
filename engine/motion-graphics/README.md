# Motion Graphics Finishing

A reusable finishing engine for a locked edit. Feed it finished footage, analyze locally, compose the existing motion library with a typed JSON plan, review that plan, and render a transparent graphics pass plus a finished composite. The source edit stays intact.

**Assumptions:** a local individual-creator workflow; Node 22+, Python 3.10+, FFmpeg/ffprobe; progressive SDR, square-pixel CFR source; English/Latin font coverage; one approved master per aspect ratio. Preserve source audio by default. Normalization and synthesized SFX require an explicit audio-mode change. There is a human graphics-plan approval gate before final rendering.

## Setup

```sh
npm ci
npm run setup:python
npm run mg -- doctor
npm run check
```

The Python packages live in `.venv`. `pipeline/requirements.txt` pins direct dependencies and compatibility constraints; `pipeline/requirements-lock.txt` records the exact tested Python 3.10/macOS ARM environment. To reproduce that environment use `.venv/bin/python -m pip install -r pipeline/requirements-lock.txt`. On other OS/Python combinations install the direct requirements and run the tests; binary wheels differ. Install FFmpeg separately if `doctor` reports it missing. The first Remotion render downloads its supported Chromium build; the first ASR run downloads its model. Rendering uses localhost ports and a headless browser. No video is sent to a remote rendering or transcription service.

Remotion is the default renderer because the typed React component model, frame API and headless orchestration fit this workflow. Installed Remotion 4 qualifies individual creators for free commercial video creation under its [license](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md). GSAP uses its own [no-charge commercial license](https://gsap.com/community/standard-license/), not MIT. See [the complete dependency and asset register](docs/licenses.md) before changing organizational use or redistributing dependencies.

## New video in 10 minutes

This is an operator runbook, not a promise that transcription, human review or a 4K render finishes in ten minutes. Initial model downloads and analysis of long edits take longer.

1. Initialize the source and inspect the probe summary:

   ```sh
   npm run mg -- init '/absolute/path/to/locked.mov' --slug my-video
   ```

2. Analyze and draft:

   ```sh
   npm run mg -- analyze --project my-video --model small --language en
   npm run mg -- plan --project my-video --preset clean-tech --platform youtube
   ```

   For a supplied transcript, add `--transcript '/path/to/transcript.json'`. Its shape is `{"words":[{"text":"Build","startFrame":30,"endFrame":42}]}`. Silent footage works without ASR. Model names or a local faster-whisper model directory are accepted by `--model`.

3. Correct `projects/my-video/analysis/transcript.json`. Inspect the extracted images and the full moving shots. In `analysis/analysis.json`, edit protected regions for faces, subjects and important UI/text; then set each reviewed shot's `reviewed` flag to `true`. Resolve the analysis `needsInput` list. `shots.json` is a reference export; the CLI uses shots/regions from `analysis.json` and words from `transcript.json`.

4. Edit `graphics-plan.json` using the [component catalog](docs/components.md) and [editorial rubric](docs/editorial-rubric.md). Every cue needs an editorial purpose, verified source, normalized position box and frame interval. Start with fewer cues. The draft planner does not invent speaker names or extract reliable emotional tone. The optional semantic pass is performed by an agent editing this JSON, with no external LLM dependency.

5. Preview and preflight:

   ```sh
   npm run mg -- preview --project my-video
   npm run mg -- qa --project my-video --frames
   ```

   Inspect `qa-report.json` and `qa-frames/*.png`. `preview` opens Remotion Studio with source and plan. Use `npm run studio` to explore the fictional example overlay without source footage. Never approve merely because the detector returned no faces.

6. Human review, then render:

   ```sh
   npm run mg -- approve --project my-video --reviewer 'Your name'
   npm run mg -- render --project my-video
   npm run mg -- qa --project my-video --frames --final
   ```

   Approval hashes the exact plan, reviewed analysis, asset bytes and engine. Changes invalidate it. Final QA includes a manual watch-through; the automated report deliberately leaves that review pending.

## Outputs

- `renders/composite.mov`: H.264 High, CRF 17, source dimensions/fps and original audio packets by default. MOV preserves codecs such as PCM that cannot simply be copied into every MP4 workflow.
- `renders/overlay.mov`: graphics-only ProRes 4444 with alpha, identical frame dimensions and duration. Place at source frame zero in the NLE.
- `renders/manifest.json`: approval digest, output hashes and media QA results.
- `style-spec.json`, `cue-sheet.md`, `asset-report.json`: review-ready typography/tokens, cue timing/reasons, and font/asset licenses.
- `qa-report.json` and `qa-frames/`: machine findings, cue edges/midpoints and manual-review reminder.
- With `audio.mode=sfx`: `sfx-dry.wav`, `sfx-ducked.wav` for audio-bearing sources, `mix.wav`, `mix-normalized.wav`, and loudness measurement JSON. `audio.mode=normalize` emits the normalized mix without effects.

SFX events declare `{cueId,event:"in"|"out",kind:"whoosh"|"click"|"pop"|"riser",gain}`. Gain is capped at 0.25. Effects use original deterministic synthesis and a separate stem. Ducking is keyed from the provided mixed soundtrack; no dialogue separator is claimed. Remix modes currently accept one mixed audio stream and aligned zero-origin timestamps. Preserve mode copies all source audio streams. Loudness targets are configurable defaults, not asserted platform mandates.

## Design system and project structure

| Folder / entry | Responsibility |
| --- | --- |
| `src/components` | Fifteen reusable graphic types, one file per type and an exhaustive dispatcher. |
| `src/tokens` | Typography, colors, spacing, safety, motion, density, audio defaults and three presets. |
| `src/hooks` | Strict-mode-safe frame-seeked GSAP, local font readiness and rendered text-bound checks. |
| `src/compositions` | Transparent Overlay and source Composite preview. |
| `pipeline` | Probe, scene/ASR/beat/region analysis, CLI, caches, approvals, synthesis, render, QA. |
| `schemas` | Strict Zod plan and analysis contracts; TypeScript props are inferred. |
| `presets` | Named preset exports and editorial descriptions. |
| `projects/<slug>` | Source reference, analysis, editable plan, local assets and delivery artifacts. Media/renders are gitignored. |
| `projects/example/graphics-plan.json` | Fully populated fictional 60-second tech-explainer plan; its name and numbers are demo content. |
| `public/fonts` | Local OFL WOFF2 families for the five typography profiles, plus mono code text. |
| `tests` | Schema, editorial QA, GSAP lifecycle, FFmpeg, integration, determinism and pixel baselines. |
| `docs` | Architecture decisions, component specs, editorial rubric, FFmpeg/export reference and licenses. |
| `SKILL.md` | Instructions for an AI agent operating future videos without rebuilding the engine. |

Your five typography directions are selectable token profiles; see [the exact faces, substitutions and usage](docs/typography.md). Great Vibes + Anek Latin is bundled exactly. SF Pro, Gilroy, the ambiguous Collvetica style and Headliner use explicitly named OFL substitutes until suitable exact files/rights are available.

Clean Tech: Swiss grotesk on flat square ink strips, brand-purple accent. Cinematic Doc: roman editorial serif set bare on footage, amber accent, slower reveals. High-Energy Shorts: bold grotesk headlines and medium grotesk captions with no serif, the brand-purple accent kept to one rule, bar or word per cue, poster-scale type and tight timing. All presets use mono metadata labels, hairline rules and masked text reveals. The brand purple `#7B4DFF` (`accentFill`) is used only for rules, bars and strokes; purple text uses the lighter `#8F6BFF` tint (`accent`), which clears 4.5:1 on ink. Presets swap tokens without changing component code. See [architecture](docs/architecture.md) and [component contracts](docs/components.md). Clean Tech keeps solid strips for measurable contrast; the bare presets need per-shot contrast review. Camera moves are licensed still insets only; cut transitions are decorative overlays at existing boundaries.

Tune design/motion/density in `src/tokens/index.ts`, pipeline sampling/encoding/SFX durations in `pipeline/config.json`, and per-video density overrides in `plan.rules`. No per-video CSS or component implementation belongs under `projects`. The complete schema is exported as `planSchema`; validate imported plans with `planSchema.parse(value)`.

## Testing and QA

```sh
npm run check                 # TypeScript + schema, QA, GSAP lifecycle and FFmpeg tests
npm run test:visual           # 100 pixel baselines + isolated out-of-order determinism
npm run test:integration      # Python analysis + real alpha/composite + audio-byte test
npm run test:visual:update    # Only after inspecting an intentional visual change
```

Visual regression renders every component in three presets and both aspect ratios, plus all five typography pairings in both aspects. Baselines use the pinned Remotion Chromium on macOS ARM; a different renderer/OS can change antialiasing. Inspect diff images before accepting a platform-specific rebaseline. Pixel determinism renders frame 8, then 90, then 2, then frame 8 again in isolated browser renders and compares decoded pixels. The GSAP lifecycle test also seeks backward on a mounted StrictMode component and checks cleanup.

Automated preflight checks schema, safe areas, protected regions, contrast of actual token panel/text pairs, read time, caption wrapping, collision/density caps, source dimensions/fps, word/cut boundaries, sync landings, source evidence and end-screen areas. Frame QA uses loaded-font DOM measurements during holds to detect actual overflow. Final media QA checks frame count, frame rate, video duration, resolution, alpha format, preserved audio payload hashes and initial timing, clipping, remix loudness and artifact hashes. These checks do not certify semantic correctness, complete face detection, every tracking interval or visual taste.

Manual final watch-through:

- Verify names, numbers, quotes, code and meaning against the source; remove unsupported details.
- Watch every face and subject across complete shots, including appearances between detector samples.
- Inspect cue entries, holds and exits on the actual footage for legibility, clipped descenders and flashes.
- Confirm emphasis lands with the intended word/beat, transitions remain on cuts and the edit is unchanged.
- Listen at normal volume: dialogue stays clear, SFX are restrained, sync holds at both beginning and end.
- Drop the alpha pass into the target NLE; confirm transparency, frame-zero alignment, edge treatment and end-screen space.

See [docs/verification.md](docs/verification.md) for what was run during repository creation. [docs/ffmpeg.md](docs/ffmpeg.md) contains the exact command patterns and export specs.

## Failure handling and scope

Commands are repeatable. Content-addressed caches include source bytes, analysis inputs or engine/assets as appropriate. Ingest/analysis outputs are reused; deliberate human edits to analysis are preserved and approval is invalidated. `plan` never overwrites an existing plan. Preview restages cached local assets; it intentionally remains open. Render caches validate output bytes before reuse. QA recomputes inexpensive current findings; requested frame captures render again for explicit inspection. Project locks prevent simultaneous mutation.

VFR/HDR/interlaced/rotated/non-square/nonzero-origin source stops rather than silently changing the locked edit. Unknown source color tags are preserved as unknown; confirm the master is SDR before approving. No scene classifier, face detector or beat detector is treated as ground truth. Automatic object tracking, OCR, diarization, emotion recognition, hosted LLM calls and full 3D scene rendering are intentionally outside this version's implemented scope. Static annotations, manually reviewed protection intervals, CSS depth and licensed baked Lottie cover the current vocabulary. Avoid motion blur because current movements are restrained; add it only through a tested engine contribution if faster motion needs it.

To add a component, follow **spec → tokens → schema/registry → behavioral and visual tests → licensing → changelog**. Do not fork a style for a single video. Read [SKILL.md](SKILL.md) when operating this repository through an AI agent.

## Five amateur mistakes this engine prevents

1. **Too many graphics:** rolling density caps, clean gaps and mandatory editorial reasons.
2. **Inconsistent type and motion:** three token presets, one vocabulary and no arbitrary styling in plans.
3. **Unreadable or obstructive placement:** safe zones, human-reviewed face/UI regions, opaque labels and rendered text-bound QA.
4. **Late, floaty or abrupt animation:** source-frame timing, speech/beat landing checks, shorter exits and read-time holds.
5. **Damaging the finished edit:** separate alpha layers, unchanged frame counts, source-audio byte checks and explicit opt-in remixing.
