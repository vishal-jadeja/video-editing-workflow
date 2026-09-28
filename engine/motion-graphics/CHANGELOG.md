# Changelog

## Unreleased

- Restyled the component library from UI cards to print-editorial graphics: large display type, tracked mono labels, drawn hairlines and a single accent, with no rounded cards, drop shadows or glows.
- Added a preset `surface`: Clean Tech keeps flat square ink strips (guaranteed contrast); Cinematic Doc and High-Energy Shorts set type bare on footage with a soft glyph shadow, and QA emits a `bare-contrast` warning for manual review.
- Replaced float-up fades with masked line reveals, staggered label → headline → rule entries, shorter exits and a focus-pull `depth` variant for chapter titles (no 3D tilt).
- Kinetic captions now reveal words on their transcript onsets without reflow and set emphasis words in the pairing's accent face and colour instead of karaoke highlighting.
- Replaced mint/lime palettes with paper-on-ink palettes: brand purple for Clean Tech and Shorts, amber for Cinematic Doc. Colours gain `accentFill` (exact brand `#7B4DFF` for rules, bars, strokes; checked at 3:1) beside the text-safe `accent` tint (`#8F6BFF`, 4.5:1). A test rejects purple ink, text or code colours.
- Added Instrument Serif (OFL) with `swiss-grotesk`, `editorial-serif`, `cinema-serif` and `grotesk-serif-accent` pairings, plus `poster-grotesk` (Inter Bold + Inter Medium, no serif), now the Shorts default. Serif is opt-in: `cinema-serif` for Cinematic Doc and `grotesk-serif-accent` for serif caption emphasis (new pairing `accent` face; same-family emphasis changes weight and colour only, not size); list rows use the body face; transitions use film burn, blurred ink whip and ink wipe instead of the accent colour.
- Layout-audit failures now report the offending text and its overflow metrics.

## 0.1.0 — 2026-09-19

- Added a Remotion finishing engine with fifteen typed graphics components, three shared presets and local OFL fonts.
- Added a strict graphics-plan schema and a fictional 60-second tech-explainer example.
- Added frame-seeked GSAP, local-font render blocking, safe boxes, seeded finishing and Lottie asset constraints.
- Added ingest, local scene/ASR/onset/face proposals, evidence-preserving draft planning, Studio preview and hash-bound human approval.
- Added H.264 composite and ProRes 4444 alpha rendering, audio packet preservation, explicit SFX/normalization modes and separate stems.
- Added editorial/media QA, actual rendered text-bound checks, cache integrity, project locks and visual regression fixtures.
- Added root agent skill, contribution contract, operator runbook, component specifications and license register.
- Tightened panels around content after visual review; retained transparent annotation canvases and solid text labels.
- Pinned compatible SciPy/Numba versions after testing Python analysis on macOS ARM.
- Added five selectable typography pairings from the requested visual directions, local OFL assets, explicit proprietary-font substitutions and pairing snapshots.
