#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import {loadWorkflow, createPlan, doctor, executeWorkflow} from './workflow.mjs';
import {cleanupWorkflow} from './cleanup.mjs';

try {
  const {values, positionals} = parseArgs({options: {config: {type: 'string'}, help: {type: 'boolean', short: 'h'}, apply: {type: 'boolean'}, 'include-review': {type: 'boolean'}}, allowPositionals: true});
  if (values.help) {
    console.log('Usage: npm run shorts -- <plan|doctor|preview|build|cleanup> [--config path/to/config.json]\n\nplan: validate inputs and show steps without generating media\ndoctor: also check local dependencies\npreview: generate narration, audio, review stills and cover\nbuild: run preview steps, render MP4 and validate export\ncleanup: preview removable intermediates; --apply deletes after a successful build\n  --include-review also selects generated QA frames (cleanup only)\n\nConfig paths are relative to the shell; project is relative to the config; episode/facecam paths are relative to the project.');
  } else {
    const command = positionals[0] ?? 'plan';
    if (positionals.length > 1 || !['plan', 'doctor', 'preview', 'build', 'cleanup'].includes(command)) throw new Error('Choose plan, doctor, preview, build or cleanup. Use --help for usage.');
    if (command !== 'cleanup' && (values.apply || values['include-review'])) throw new Error('--apply and --include-review are only valid with cleanup.');
    const workflow = await loadWorkflow(values.config ?? fileURLToPath(new URL('./default.json', import.meta.url)));
    console.log(`Short video: ${workflow.episode.title} (${workflow.episode.slug})\nProject: ${workflow.project}\nNarration: ${workflow.config.provider}; duration budget: ${workflow.config.maxDurationSeconds}s`);
    if (command === 'plan') {
      for (const [index, step] of createPlan(workflow, 'build').entries()) console.log(`${index + 1}. ${step.id}`);
      console.log(`Outputs: ${workflow.project}/out/${workflow.episode.slug}{.mp4,-cover.png}, out/qa/, out/shorts-workflow.json`);
    } else if (command === 'cleanup') {
      await cleanupWorkflow(workflow, {apply: values.apply, includeReview: values['include-review']});
    } else {
      await doctor(workflow);
      if (command !== 'doctor') await executeWorkflow(workflow, command);
    }
  }
} catch (error) {
  console.error(`Short-video workflow: ${error.message}`);
  process.exitCode = 1;
}
