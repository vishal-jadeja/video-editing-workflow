# DSA video workflows

Reusable production commands for the existing NeetCode short-video renderer. Long-video production can be added under `workflows/long/` later, with its own configuration, steps and output checks.

```sh
npm run shorts -- plan
npm run shorts -- doctor
npm run shorts -- preview
npm run shorts -- build
```

Start with the [short-video workflow](workflows/shorts/README.md) for setup, scripting, narration, review and export. The default episode is [Contains Duplicate](neetcode-150/part-01/data/part-01.json). The existing React animations are specific to that problem; new algorithm demonstrations require changes to the scene renderers.

Run `npm test` for workflow tests. The root commands use Node's standard library; install rendering dependencies inside `neetcode-150/part-01`.
