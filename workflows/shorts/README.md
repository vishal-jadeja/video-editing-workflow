# Short-video creation workflow

The workflow connects the existing Remotion project into a repeatable pipeline:

`brief → script/cues → narration/alignment → duration check → camera → typecheck → audio mix → review stills/cover → MP4 → export validation`

## One-time setup

Use Node 22+, Python 3.10+, ffmpeg/ffprobe and a Chromium browser. Install the renderer and alignment dependencies from the repository root:

```sh
npm ci --prefix shorts/neetcode-150/part-01
cd shorts/neetcode-150/part-01
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd ../../..
npm run shorts -- doctor
```

The default narrator is the installed macOS Daniel voice. Other systems should select `openai` in the workflow config and set `OPENAI_API_KEY` in their environment. OpenAI narration makes paid API calls; `plan` and `doctor` never generate narration. Voice/model overrides use the existing `OPENAI_VOICE` and `OPENAI_TTS_MODEL` environment variables.

The existing renderer defaults to Brave on macOS. To use another installed Chromium browser, set its absolute executable path:

```sh
export REMOTION_BROWSER_EXECUTABLE="/absolute/path/to/chromium"
```

The first media build downloads Google Fonts and the Whisper alignment model. Subsequent builds reuse local fonts, narration and alignment caches. No account or browser session is needed for rendering.

## 1. Write the brief and script

Decide the problem, teaching outcome, example input, approach comparison and call to action. Edit the episode JSON in the renderer's `data/` directory. The current template has seven scenes: hook, problem, brute force, better, one-liner, optimal, CTA.

Keep code and complexity claims accurate. Each animation cue is a phrase from that scene's spoken script. Validation checks required fields, cue presence, scene order and layout references before narration. Forced alignment resolves actual cue timing; the existing camera code checks layout timing order afterward.

The current graphics assume Contains Duplicate, `[1,2,3,1]` and the early-exit example `[1,1,2,3,"…",100000]`. Copying JSON does **not** create animations for a different algorithm. Extend `src/scenes.tsx`, `src/facecam.tsx`, `scripts/sfx.py` and the workflow's renderer validation contract when implementing another problem. The cover currently displays `O(n)`.

## 2. Configure the job

Copy [default.json](default.json) beside it and edit its paths/settings, then pass `--config workflows/shorts/my-episode.json` to any command.

| Setting | Meaning |
| --- | --- |
| `version`, `format` | `1` and `shorts`; other formats have separate future workflows |
| `project` | Renderer directory, relative to the workflow config |
| `episode` | Episode JSON, relative to the renderer directory |
| `facecam` | Camera config, relative to the renderer directory |
| `provider` | `local` for macOS Daniel, or `openai` |
| `maxDurationSeconds` | Editorial limit checked against aligned narration; default 90 seconds |
| `allowPlaceholderFacecam` | Explicitly allow silhouettes for missing footage; default `true` for the existing example |

The 90-second budget is a project choice, not a platform eligibility claim. Shorten the narration if the duration gate fails, or deliberately change the budget. The workflow does not truncate speech.

For a camera edition, supply footage and set `allowPlaceholderFacecam` to `false` before the final build. See [FACECAM.md](../../shorts/neetcode-150/part-01/FACECAM.md) for takes, trimming and crops. Footage paths inside that JSON are relative to the renderer directory. Camera audio remains muted; generated narration is the master audio. For a graphics-only edit, set every scene's layout to `graphics`.

## 3. Plan and preview

From the repository root:

```sh
npm run shorts -- plan
npm run shorts -- doctor
npm run shorts -- preview
```

`plan` checks configuration and episode data without changing media. `doctor` also checks dependencies, the browser and the narration provider. `preview` prepares assets, generates and aligns narration, enforces duration and camera settings, typechecks the renderer, mixes audio and exports review images plus the cover.

Review `shorts/neetcode-150/part-01/out/qa/` and the cover for caption readability, code correctness, safe areas and camera crops. For motion and audio review, launch the existing studio after preview:

```sh
cd shorts/neetcode-150/part-01
npm run studio
```

For a custom episode, use the same absolute `PART_DATA` and `FACECAM_CONFIG` paths when launching studio. Review stills are samples; they cannot verify every frame or narration quality.

## 4. Build and review the export

```sh
npm run shorts -- build
```

Build repeats the pipeline using available caches, renders video and runs the existing export validator. Output remains in the renderer's `out/`:

- `<episode-slug>.mp4`: 1080 × 1920, 30 fps, H.264/AAC.
- `<episode-slug>-cover.png` and `qa/`: cover and sampled review frames.
- `validation.json`: encoded format, duration/frame count, decoding and measured loudness checks.
- `shorts-workflow.json`: stage statuses, timestamps and any failure.

Only a successful `build` report means this workflow completed export validation. A preview report says `preview-ready`, never `passed`. Watch the finished MP4 before uploading. Publishing is manual; include the existing suggested disclosure, “AI-generated narration,” when appropriate.

## 5. Clean intermediate files

After a successful build, preview cleanup and then apply it:

```sh
npm run shorts -- cleanup
npm run shorts -- cleanup --apply
```

This removes scene AIFF/text intermediates and temporary audio mixes, preserving final exports, covers, reports, narration/word caches, fonts, models, footage, and source files. Add `--include-review` to select generated review frames too. Use the same `--config` argument as the build for custom jobs.

Cleanup is separate from `build`. It requires the latest run to be a validated build of the selected episode and verifies that the exported MP4 still exists with the recorded size. It shares the build lock and writes `out/cleanup.json` when applied. See the [cleanup guide](../../README.md#cleanup-after-a-video) for exact targets, retained files, and behavior after a newer preview or failed run.

## Failures and repeat runs

The workflow stops at the first failed stage, exits nonzero and records the error. Fix the input or dependency, then rerun the command. There is no stage-skipping/resume flag: narration caching already avoids repeated synthesis for unchanged inputs, while all downstream outputs are rebuilt. OpenAI caches distinguish provider, script, voice and model.

A project lock prevents simultaneous workflow builds from mixing episodes in shared generated files. Do not run legacy mutation commands or edit input files during a build. Different episodes in one renderer share its audio cache, generated files and review folder; exports have episode-specific names, but reports describe the latest run. Old MP4s can remain after a failure, so check the workflow report before treating an output as current.

If a process is forcibly killed, inspect `.shorts-workflow.lock/owner.json` inside the renderer and confirm the process has stopped before removing the lock directory. Ordinary exceptions release the lock automatically.

## Adding long videos later

Add a sibling `workflows/long/` with an explicit format contract and a separate renderer/output directory. Keep its aspect ratio, chapter structure, duration policy and validation independent. Extract shared orchestration only when both pipelines have real requirements; this change implements short-video production only.
