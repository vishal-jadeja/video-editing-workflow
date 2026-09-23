import {access, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

const requiredCues = {
  hook: ['duplicate', 'wall'],
  problem: ['example', 'true', 'twice', 'false', 'unique'],
  brute: ['compare', 'other', 'found', 'complexity', 'scale', 'billions'],
  better: ['sort', 'sorted', 'duplicate', 'neighbours', 'complexity'],
  one: ['set', 'lengths', 'drops', 'shrinks', 'repeat', 'complexity', 'scan', 'whole', 'early', 'end'],
  optimal: ['set', 'exit', 'first', 'second', 'return', 'immediately', 'add', 'complexity', 'worst', 'stop', 'duplicate'],
  cta: ['follow', 'part'],
};
const normalized = text => text.toLowerCase().replace(/[^a-z0-9]/g, '');
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateEpisode(episode) {
  requireThat(episode && typeof episode === 'object', 'Episode must be an object.');
  requireThat(Number.isInteger(episode.part) && episode.part > 0, 'part must be a positive integer.');
  requireThat(nonempty(episode.title), 'title is required.');
  requireThat(typeof episode.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(episode.slug), 'slug must be lowercase words separated by hyphens.');
  // The existing graphics contain fixed positions and algorithm-specific examples.
  requireThat(JSON.stringify(episode.array) === '[1,2,3,1]', 'This renderer requires array [1,2,3,1]; update its graphics before changing the example.');
  requireThat(JSON.stringify(episode.earlyArray) === '[1,1,2,3,"…",100000]', 'This renderer requires earlyArray [1,1,2,3,"…",100000].');
  requireThat(Array.isArray(episode.scenes), 'scenes must be an array.');
  requireThat(JSON.stringify(episode.scenes.map(s => s?.id)) === JSON.stringify(Object.keys(requiredCues)), 'Expected scenes in order: hook, problem, brute, better, one, optimal, cta.');
  for (const scene of episode.scenes) {
    requireThat(nonempty(scene.voice), `${scene.id}: voice is required.`);
    requireThat(scene.cues && typeof scene.cues === 'object' && !Array.isArray(scene.cues), `${scene.id}: cues must be an object.`);
    for (const key of requiredCues[scene.id]) {
      requireThat(nonempty(scene.cues[key]), `${scene.id}: missing cue ${key}.`);
    }
    for (const [key, phrase] of Object.entries(scene.cues)) {
      requireThat(nonempty(phrase) && normalized(phrase).length > 0 && normalized(scene.voice).includes(normalized(phrase)), `${scene.id}.${key}: cue phrase must occur in narration.`);
    }
    if (['brute', 'better', 'one', 'optimal'].includes(scene.id)) {
      for (const key of ['code', 'label', 'color', 'time', 'space']) {
        requireThat(nonempty(scene[key]), `${scene.id}: ${key} is required.`);
      }
    }
    const beats = episode.layouts?.[scene.id];
    if (beats !== undefined) {
      requireThat(Array.isArray(beats) && beats[0]?.at === 'start', `${scene.id}: first layout must be at start.`);
      const seen = new Set();
      for (const beat of beats) {
        requireThat(['facecam', 'overlay', 'split', 'graphics'].includes(beat.mode), `${scene.id}: unknown layout ${beat.mode}.`);
        requireThat(beat.at === 'start' || Object.hasOwn(scene.cues, beat.at), `${scene.id}: unknown layout cue ${beat.at}.`);
        requireThat(!seen.has(beat.at), `${scene.id}: repeated layout cue ${beat.at}.`);
        seen.add(beat.at);
      }
    }
  }
  for (const id of Object.keys(episode.layouts ?? {})) {
    requireThat(Object.hasOwn(requiredCues, id), `Unknown scene in layouts: ${id}.`);
  }
  return episode;
}

export async function loadWorkflow(configFile) {
  const configPath = path.resolve(configFile);
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const allowed = ['version', 'format', 'project', 'episode', 'facecam', 'provider', 'maxDurationSeconds', 'allowPlaceholderFacecam'];
  requireThat(config && typeof config === 'object' && !Array.isArray(config), 'Workflow config must be an object.');
  for (const key of Object.keys(config)) requireThat(allowed.includes(key), `Unknown workflow option: ${key}.`);
  requireThat(config.version === 1 && config.format === 'shorts', 'Expected version 1 and format shorts.');
  for (const key of ['project', 'episode', 'facecam']) requireThat(nonempty(config[key]), `${key} path is required.`);
  requireThat(['local', 'openai'].includes(config.provider), 'provider must be local or openai.');
  requireThat(Number.isFinite(config.maxDurationSeconds) && config.maxDurationSeconds > 0, 'maxDurationSeconds must be positive.');
  requireThat(typeof config.allowPlaceholderFacecam === 'boolean', 'allowPlaceholderFacecam must be boolean.');
  const project = path.resolve(path.dirname(configPath), config.project);
  const episodePath = path.resolve(project, config.episode);
  const facecamPath = path.resolve(project, config.facecam);
  const episode = validateEpisode(JSON.parse(await readFile(episodePath, 'utf8')));
  const facecam = JSON.parse(await readFile(facecamPath, 'utf8'));
  requireThat(facecam && nonempty(facecam.file), 'Facecam config must specify a file (it may be absent when placeholders are allowed).');
  for (const id of Object.keys(facecam.sceneOverrides ?? {})) requireThat(Object.hasOwn(requiredCues, id), `Unknown facecam scene: ${id}.`);
  return {config, configPath, project, episodePath, facecamPath, episode};
}

export function createPlan(workflow, command) {
  requireThat(['build', 'preview'].includes(command), `Unknown execution command: ${command}`);
  const node = (id, script, ...args) => ({id, executable: process.execPath, args: [script, ...args]});
  const steps = [
    node('prepare', 'scripts/prepare.mjs'),
    node('narration-and-alignment', 'scripts/voice.mjs', workflow.config.provider),
    {id: 'duration', gate: true},
    node('facecam', 'scripts/facecam.mjs'),
    {id: 'camera-policy', gate: true},
    node('typecheck', 'node_modules/typescript/bin/tsc', '--noEmit'),
    node('audio-mix', 'scripts/mix.mjs'),
    node('review-stills', 'scripts/render.mjs', 'stills'),
    node('cover', 'scripts/render.mjs', 'cover'),
  ];
  if (command === 'build') steps.push(node('video', 'scripts/render.mjs', 'video'), node('validate-export', 'scripts/validate.mjs'));
  return steps;
}

export function runProcess(executable, args, options) {
  const result = spawnSync(executable, args, {...options, stdio: 'inherit'});
  if (result.error) throw result.error;
  requireThat(result.status === 0, `${path.basename(executable)} failed (${result.signal ?? result.status}).`);
}

export async function doctor(workflow, env = process.env) {
  requireThat(Number(process.versions.node.split('.')[0]) >= 22, 'Node 22+ is required.');
  const failures = [];
  const check = async (name, fn) => {
    try { await fn(); console.log(`OK  ${name}`); }
    catch (error) { failures.push(`${name}: ${error.message}`); }
  };
  const probe = (command, args) => {
    const result = spawnSync(command, args, {cwd: workflow.project, env, encoding: 'utf8'});
    if (result.error) throw result.error;
    requireThat(result.status === 0, result.stderr?.trim() || `exit ${result.status}`);
    return result.stdout;
  };
  await check('Node dependencies', async () => {
    for (const file of ['node_modules/typescript/bin/tsc', 'node_modules/@remotion/renderer/package.json', 'node_modules/@remotion/bundler/package.json']) await access(path.join(workflow.project, file));
  });
  for (const tool of ['ffmpeg', 'ffprobe']) await check(tool, () => probe(tool, ['-version']));
  await check('Python alignment and audio dependencies', () => probe('.venv/bin/python', ['-c', 'import stable_whisper, numpy, torch']));
  await check('Chromium browser', () => access(env.REMOTION_BROWSER_EXECUTABLE || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', constants.X_OK));
  if (workflow.config.provider === 'local') {
    await check('macOS Daniel voice', () => {
      requireThat(process.platform === 'darwin', 'Local narration requires macOS; choose openai on other systems.');
      requireThat(/^Daniel\s/m.test(probe('say', ['-v', '?'])), 'Install Daniel in macOS speech settings.');
    });
  } else {
    await check('OpenAI credential', () => requireThat(nonempty(env.OPENAI_API_KEY), 'Set OPENAI_API_KEY in the environment.'));
  }
  requireThat(failures.length === 0, `Preflight failed:\n${failures.join('\n')}`);
}

export function validateDuration(timeline, maxDurationSeconds) {
  requireThat(timeline.ready && Number.isInteger(timeline.frames) && timeline.frames > 0 && Number.isFinite(timeline.duration) && timeline.duration > 0, 'Narration did not produce a ready timeline.');
  requireThat(Math.abs(timeline.frames / 30 - timeline.duration) < 1 / 30, 'Timeline duration does not match its frame count.');
  requireThat(timeline.duration <= maxDurationSeconds, `Narration is ${timeline.duration.toFixed(2)}s, above the ${maxDurationSeconds}s budget. Shorten the script or explicitly increase maxDurationSeconds.`);
}

async function runGate(step, workflow) {
  if (step.id === 'duration') {
    validateDuration(JSON.parse(await readFile(path.join(workflow.project, 'src/generated/timeline.json'), 'utf8')), workflow.config.maxDurationSeconds);
  } else {
    const camera = JSON.parse(await readFile(path.join(workflow.project, 'src/generated/camera.json'), 'utf8'));
    const missing = [...new Set(camera.layouts.filter(beat => beat.mode !== 'graphics' && !camera.scenes[beat.scene]?.available).map(beat => beat.scene))];
    requireThat(workflow.config.allowPlaceholderFacecam || missing.length === 0, `Facecam is missing for: ${missing.join(', ')}. Supply footage or explicitly allow placeholders.`);
    if (missing.length) console.log(`Preview placeholders enabled for: ${missing.join(', ')}`);
  }
}

export async function withProjectLock(project, task) {
  const lock = path.join(project, '.shorts-workflow.lock');
  try { await mkdir(lock); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Another workflow owns ${lock}. If a previous run was killed, verify it has stopped before removing that directory.`);
    throw error;
  }
  try {
    await writeFile(path.join(lock, 'owner.json'), JSON.stringify({pid: process.pid, startedAt: new Date().toISOString()}));
    return await task();
  } finally { await rm(lock, {recursive: true, force: true}); }
}

export async function executeWorkflow(workflow, command, {run = runProcess, gate = runGate, env = process.env} = {}) {
  return withProjectLock(workflow.project, async () => {
    const reportFile = path.join(workflow.project, 'out/shorts-workflow.json');
    await mkdir(path.dirname(reportFile), {recursive: true});
    const report = {
      format: 'shorts', command, episode: workflow.episode.slug, provider: workflow.config.provider,
      config: workflow.configPath, startedAt: new Date().toISOString(), status: 'running', steps: [],
    };
    const save = () => writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
    await save();
    try {
      for (const step of createPlan(workflow, command)) {
        const record = {id: step.id, status: 'running', startedAt: new Date().toISOString()};
        report.steps.push(record);
        await save();
        console.log(`\n[shorts] ${step.id}`);
        if (step.gate) await gate(step, workflow);
        else await run(step.executable, step.args, {cwd: workflow.project, env: {...env, PART_DATA: workflow.episodePath, FACECAM_CONFIG: workflow.facecamPath}});
        record.status = 'passed';
        record.finishedAt = new Date().toISOString();
        await save();
      }
      report.status = command === 'build' ? 'passed' : 'preview-ready';
    } catch (error) {
      report.status = 'failed';
      const active = report.steps.at(-1);
      if (active) { active.status = 'failed'; active.error = error.message; }
      throw error;
    } finally {
      report.finishedAt = new Date().toISOString();
      await save();
    }
    console.log(`\n${report.status}: ${reportFile}`);
    return report;
  });
}
