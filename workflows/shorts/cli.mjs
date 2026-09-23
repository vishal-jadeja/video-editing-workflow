#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {fileURLToPath} from 'node:url';
import {loadWorkflow, createPlan, doctor, executeWorkflow} from './workflow.mjs';

try {
  const {values, positionals} = parseArgs({options: {config: {type: 'string'}, help: {type: 'boolean', short: 'h'}}, allowPositionals: true});
  if (values.help) {
    console.log('Usage: npm run shorts -- <plan|doctor|preview|build> [--config path/to/config.json]\n\nplan: validate inputs and show steps without generating media\ndoctor: also check local dependencies\npreview: generate narration, audio, review stills and cover\nbuild: run preview steps, render MP4 and validate export\n\nConfig paths are relative to the shell; project is relative to the config; episode/facecam paths are relative to the project.');
  } else {
    const command = positionals[0] ?? 'plan';
    if (positionals.length > 1 || !['plan', 'doctor', 'preview', 'build'].includes(command)) throw new Error('Choose plan, doctor, preview or build. Use --help for usage.');
    const workflow = await loadWorkflow(values.config ?? fileURLToPath(new URL('./default.json', import.meta.url)));
    console.log(`Short video: ${workflow.episode.title} (${workflow.episode.slug})\nProject: ${workflow.project}\nNarration: ${workflow.config.provider}; duration budget: ${workflow.config.maxDurationSeconds}s`);
    if (command === 'plan') {
      for (const [index, step] of createPlan(workflow, 'build').entries()) console.log(`${index + 1}. ${step.id}`);
      console.log(`Outputs: ${workflow.project}/out/${workflow.episode.slug}{.mp4,-cover.png}, out/qa/, out/shorts-workflow.json`);
    } else {
      await doctor(workflow);
      if (command !== 'doctor') await executeWorkflow(workflow, command);
    }
  }
} catch (error) {
  console.error(`Short-video workflow: ${error.message}`);
  process.exitCode = 1;
}
