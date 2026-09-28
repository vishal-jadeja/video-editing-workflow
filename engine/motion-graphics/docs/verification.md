# Verification record

Environment: macOS ARM, Node 22.20.0, Python 3.10, system FFmpeg, Remotion 4.0.526 and its pinned Chrome Headless Shell. No user video was supplied; validation uses original synthetic footage and fictional graphic content.

Completed during implementation:

- TypeScript strict checking and Python syntax compilation.
- Schema, unknown-property, frame bounds, missing-asset and evidence checks.
- Editorial QA checks covering protected faces/UI, safe areas, read time, cuts, word boundaries, density and sync.
- Actual React StrictMode GSAP mount/cleanup/remount and backward-seek behavior.
- 100 rendered baselines (15 component types × 3 presets × 2 aspect ratios, plus 5 font pairings × 2 aspects), inspected with contact sheets; exact isolated frame-repeat pixel determinism.
- FFmpeg ingest probes at 24, 30 and 60 fps, plus a deliberately variable-rate fixture detected without modifying it.
- Four-second synthetic source through Python scene/beat/loudness/region analysis, ProRes 4444 alpha rendering and H.264 final compositing.
- Final source/composite frame count, fps, dimensions and duration equality; ProRes alpha pixel format; source PCM and AAC audio payload hash equality and initial timestamp equality.
- Optional original SFX synthesis, ducked stem and two-pass normalization, with measured target loudness and peak assertions.
- Local faster-whisper tiny.en inference on generated speech: fourteen words returned with ordered word timestamps. This is a functional smoke test, not an ASR accuracy benchmark.

Issues found and fixed: sandbox localhost restrictions required running browser tests with appropriate local permissions; a VFR test expression needed FFmpeg filter quoting; a SciPy wheel could not load on this host and was replaced with compatible pinned versions; visual review found oversized panel backgrounds, which were tightened around content. Annotation canvases were made transparent while retaining a solid label backing.

Limits: synthetic analysis does not prove accuracy on actual faces, music, accents or speech. The ASR smoke test used a tiny English model and synthetic speech; other models, accents and real-footage word timing still need review. The detector deliberately leaves shot review pending. Baselines do not guarantee pixel identity across OS/browser/GPU changes. Only tested environments should update baselines, and only after inspection. Final human watch-through and target-NLE alpha verification remain mandatory for every actual video.

The initial parallel typography/integration run exceeded a three-minute test timeout. Ordinary snapshot cases now share a Chromium process; the determinism cases remain isolated. The integration test passed when rerun with a realistic test timeout.

Actual font-layout checks caught Anton counter glyphs extending past the default line box in both aspects. The condensed pairing now uses a shared 1.5 line-height token; the overflow check was retained.

Final checks passed: `npm run check` (16 tests; 2 opt-in integration cases skipped), `npm run test:integration` (5 tests, including PCM/AAC preservation and absent/stale approval rejection), and `npm run test:visual` (101 tests, including 100 visual baselines and isolated out-of-order pixel determinism). The targeted Anton rerun passed all 32 affected cases.
