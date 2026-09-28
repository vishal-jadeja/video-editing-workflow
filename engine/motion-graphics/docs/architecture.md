# Architecture decision record

Use Remotion. React props and frame-based rendering fit a reusable, typed component registry and parallel still rendering. FFmpeg performs the final overlay so the source remains the reference for timing, color metadata and audio. No second renderer offers enough benefit to justify a second layout and testing system here.

| Folder | Purpose |
| --- | --- |
| src/components | Reusable visual vocabulary; all art direction comes from tokens. |
| src/tokens | Typed design and motion system; shared measurement and safe areas. |
| src/hooks | Frame-seeked GSAP lifecycle and local font readiness. |
| src/compositions | Validated plan dispatcher, transparent overlay and source preview. |
| pipeline | CLI, content-addressed caching, analysis, plan, render and QA. |
| schemas | Strict Zod contracts for plans and analysis. |
| presets | Three named token selections; no per-video styling code. |
| projects/<slug> | Portable plan and analysis JSON; media, caches and renders ignored. |
| tests | Behavioral unit, integration, pixel determinism and visual baselines. |
| public | Local OFL fonts and staged project assets for the renderer. |
| docs | Component specifications, editorial rubric, licenses and operation details. |

The pipeline is ingest → analysis → draft → human edit → preflight → approve → render → final QA. Approval hashes the plan and analysis; rendering also keys on engine sources, fonts, dependencies and source bytes. A changed input invalidates its cache. Draft planning never overwrites an existing human-edited plan. Analysis never silently fabricates a transcript or speaker identity.

Source contract: SDR, square pixels, progressive, constant frame rate and zero rotation. 24/30/60 and rational rates are preserved. VFR, HDR, interlace and rotated footage are detected and blocked with a concrete explanation; create and approve a new finishing master outside this locked-edit pipeline. Silent source is valid. Source audio is copied into a MOV delivery container by default; normalization and synthesized SFX explicitly select a remix mode and produce separate stems. Camera motion applies only to a supplied still overlay, never to the locked background.

Automated face and saliency detection are proposals, not proof of safety. Every shot needs a human-confirmed protected-region review (including screen UI/text), and every final needs a watch-through. Do not report the detector as a certified face tracker. Unknown subjects and semantics are recorded for review. Local faster-whisper is the default ASR; a supplied timestamped transcript is the offline alternative.

Dependency rationale and licenses are maintained in [licenses.md](licenses.md). Component scope and temporal contracts are in [components.md](components.md). Tune defaults centrally; reject invented per-project CSS, clocks, tickers, unseeded noise and scene retiming.
