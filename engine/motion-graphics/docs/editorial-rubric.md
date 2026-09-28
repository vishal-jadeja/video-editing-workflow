# Editorial decision rules

Prefer no graphic when the footage and narration already make the point. A shot with no safe negative space, an emotional close-up, rapid UI detail, or uncertain facts earns clean footage. Analysis tags are candidates, not creative authority. Write each cue's job, evidence and one-sentence reason before selecting its component.

| Trigger | Preferred treatment | Collision priority |
| --- | --- | --- |
| Verified first speaker identity | Lower third, once | 90 |
| Main hook or consequential claim | One chapter-title or key-phrase caption | 95 |
| Verified number, comparison or process | Counter, proportional bars, list | 85 |
| Hard-to-find UI detail | Small label and annotation adjacent to target | 80 |
| Structural change | Chapter title with exact topic wording | 70 |
| Strong quote | Quote card with attribution | 70 |
| Mentioned product/tool/source | Tool/source lower third when useful | 55 |
| Explicit closing action | One CTA | 90 |
| Punchline or emotional beat | Usually add nothing; leave the performance readable | 40 |
| Decorative opportunity alone | Add nothing | 0 |

When triggers collide, choose the more useful/verified cue, then the higher priority. Move the lower priority cue only if it remains semantically correct and the reading/gap rules still pass. Never create a different spoken meaning to fill a convenient slot. The draft planner keeps exact excerpts and conservative chapter/CTA treatments; the human/agent semantic edit composes richer existing components from verified evidence. No LLM service is required, and no transcript is uploaded automatically. An agent may perform the optional semantic pass directly in the local JSON, preserving exact evidence references and using the same schema and QA gate.

Hook (first 3–5 seconds): one memorable idea; do not stack an ident, title, speaker name and statistic. Body: lower density and repeat the same component for the same type of information. CTA: one action, then leave end-screen areas empty. Shorts: shorter phrases, larger caption tokens and safe middle band; default max three non-caption starts per rolling 10 seconds, still with three-second clean gaps. Long-form: default max two starts per rolling 10 seconds, three-second gaps, two simultaneous information elements (a caption plus a graphic is usually enough). Full subtitles are an explicit choice, not an automatic output.

## Motion rules

| Rule | Enforcement / reason |
| --- | --- |
| Use the named cubic-bezier entry and exit tokens; no linear motion except mechanical progress. | Shared easing keeps separate components feeling related. |
| Entry 12 frames, exit 8 at 30 fps (preset variations in tokens); scale by actual fps. | Enough time to perceive the entrance without delaying comprehension. |
| No anticipation, bounce or tilt. Text rises out of a line mask, labels lead the headline by one stagger, hairlines draw last; exits are short fades with no movement. | Masked reveals and fast exits read as edited; float-up fades, springs and 3D tilts read as templates. Spring config is reserved for tested extensions. |
| One accent per preset, used on one element per cue (emphasis word, suffix, rule). No accent gradients or glows. | Restraint is what separates editorial graphics from generated ones. |
| Stagger 4 frames per row at 30 fps; finish the last entry before the reading hold. | Establishes a hierarchy while keeping the list readable. |
| Primary title leads, subordinate text follows the same direction; default small upward lift. | Avoids competing motion vectors. For directional B-roll, prefer a static cue if the standard lift conflicts with the shot. |
| Reading hold ≥ max(1.5, words / 3 + 1) seconds, excluding entry, exit and final stagger. | Guarantees time to read the final state. |
| Kinetic-caption edges and word reveals use transcript frames; each word settles on its onset frame. | Avoids captions that chase speech. |
| Other cue entries settle at the declared word/cut/beat `sync.frame` within two frames. Counter reaches its target there. | Makes the accent sound intentional. Use manually marked stressed words where needed. |
| Ends snap to a word end or cut; reject edges inside words. | Prevents abrupt truncation of a thought. |
| Do not straddle cuts unless the cue is intentionally persistent and `allowAcrossCuts` is justified in `reason`. | Prevents labels drifting onto unrelated imagery. |
| Transition peak must sit on an existing cut; do not offset, shorten or overlap source clips. | Keeps the edit locked. |
| Seed all randomness from plan seed and frame; pause and explicitly seek GSAP. | Any frame can render independently or in reverse order. |

Beat detection on a mixed soundtrack also detects speech/transients. Listen before choosing beat sync; it is not reliable downbeat or stress detection. Semantic identity, sarcasm, emotional tone and fact verification remain review tasks.

Protected regions use normalized coordinates and half-open frame intervals `[startFrame,endFrame)`. The detector samples at 0.25-second intervals and unions proposals per shot to protect motion. This can overprotect or miss short appearances. Inspect first/middle/last keyframes, A-roll samples and the complete moving shot; add human face, subject, UI and text regions with confidence 1. Split region intervals when motion makes a full-shot union unnecessarily restrictive. Set `reviewed: true` only after that review. `analysis/analysis.json` is canonical for shots/regions; `analysis/transcript.json` is canonical for words. `shots.json` is an initial detector export for reference.
