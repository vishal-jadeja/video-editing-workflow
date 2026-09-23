import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPlan, executeWorkflow, loadWorkflow, validateDuration, validateEpisode, withProjectLock} from '../workflow.mjs';

const defaultConfig = fileURLToPath(new URL('../default.json', import.meta.url));
const current = await loadWorkflow(defaultConfig);
const copyEpisode = () => structuredClone(current.episode);
async function tempProject(t) {
  const project = await mkdtemp(path.join(tmpdir(), 'shorts-test-'));
  t.after(() => rm(project, {recursive: true, force: true}));
  return {...current, project};
}

test('default workflow resolves paths independently of caller directory', () => {
  assert.equal(current.episode.slug, 'part-01-contains-duplicate');
  assert.equal(current.episodePath, path.join(current.project, 'data/part-01.json'));
});

test('rejects malformed or unsupported scene data before narration', () => {
  for (const [mutate, expected] of [
    [e => { e.slug = '../../escape'; }, /slug/],
    [e => { e.scenes[0].id = '../hook'; }, /Expected scenes/],
    [e => { delete e.scenes[0].cues.wall; }, /missing cue wall/],
    [e => { e.scenes[0].cues.wall = 'not in this narration'; }, /cue phrase/],
    [e => { e.scenes[0].cues.wall = '!!!'; }, /cue phrase/],
    [e => { e.array = [2, 3]; }, /renderer requires array/],
    [e => { e.layouts.hook[1].mode = 'unknown'; }, /unknown layout/],
    [e => { e.layouts.hook[1].at = 'missing'; }, /unknown layout cue/],
    [e => { e.layouts.hook.push(e.layouts.hook[0]); }, /repeated layout cue/],
    [e => { e.scenes[2].code = ''; }, /code is required/],
  ]) {
    const episode = copyEpisode(); mutate(episode);
    assert.throws(() => validateEpisode(episode), expected);
  }
});

test('rejects config typos instead of silently falling back', async t => {
  const {project} = await tempProject(t);
  const file = path.join(project, 'config.json');
  await writeFile(file, JSON.stringify({...current.config, project: current.project, maxDurationSecond: 50}));
  await assert.rejects(loadWorkflow(file), /Unknown workflow option/);
});

test('preview omits video and export validation, build orders gates before rendering', () => {
  const build = createPlan(current, 'build').map(s => s.id);
  const preview = createPlan(current, 'preview').map(s => s.id);
  assert.deepEqual(build.slice(-2), ['video', 'validate-export']);
  assert.deepEqual(preview, build.slice(0, -2));
  assert.ok(build.indexOf('duration') < build.indexOf('audio-mix'));
  assert.ok(build.indexOf('camera-policy') < build.indexOf('review-stills'));
});

test('duration gate rejects over-budget and invalid timelines', () => {
  validateDuration({ready: true, frames: 1800, duration: 60}, 60);
  assert.throws(() => validateDuration({ready: true, frames: 1801, duration: 1801 / 30}, 60), /above/);
  assert.throws(() => validateDuration({ready: false, frames: 30, duration: 1}, 90), /ready timeline/);
  assert.throws(() => validateDuration({ready: true, frames: 30, duration: 60}, 90), /frame count/);
});

test('project lock rejects concurrent runs and releases after failure', async t => {
  const {project} = await tempProject(t);
  await assert.rejects(withProjectLock(project, async () => {
    await assert.rejects(withProjectLock(project, () => {}), /Another workflow owns/);
    throw new Error('failed build');
  }), /failed build/);
  await withProjectLock(project, async () => {});
});

test('failure stops downstream stages and persists a failed report', async t => {
  const workflow = await tempProject(t);
  const calls = [];
  await assert.rejects(executeWorkflow(workflow, 'build', {
    run: async (_executable, args, options) => {
      calls.push(args[0]);
      assert.equal(options.cwd, workflow.project);
      assert.equal(options.env.PART_DATA, workflow.episodePath);
      assert.equal(options.env.FACECAM_CONFIG, workflow.facecamPath);
      if (args[0] === 'scripts/voice.mjs') throw new Error('alignment failed');
    },
    gate: async () => assert.fail('Must not reach gates after narration failure'),
  }), /alignment failed/);
  assert.deepEqual(calls, ['scripts/prepare.mjs', 'scripts/voice.mjs']);
  const report = JSON.parse(await readFile(path.join(workflow.project, 'out/shorts-workflow.json'), 'utf8'));
  assert.equal(report.status, 'failed');
  assert.equal(report.steps.at(-1).status, 'failed');
  assert.equal(report.steps.at(-1).error, 'alignment failed');
  await withProjectLock(workflow.project, async () => {});
});

test('preview success is distinct from validated export success', async t => {
  const workflow = await tempProject(t);
  const report = await executeWorkflow(workflow, 'preview', {run: async () => {}, gate: async () => {}});
  assert.equal(report.status, 'preview-ready');
  assert.ok(report.steps.every(step => step.status === 'passed'));
  assert.ok(report.finishedAt);
});

test('camera policy blocks missing footage unless placeholders are explicit', async t => {
  const workflow = await tempProject(t);
  workflow.config = {...workflow.config, allowPlaceholderFacecam: false};
  const {mkdir} = await import('node:fs/promises');
  await mkdir(path.join(workflow.project, 'src/generated'), {recursive: true});
  await writeFile(path.join(workflow.project, 'src/generated/timeline.json'), JSON.stringify({ready: true, frames: 30, duration: 1}));
  await writeFile(path.join(workflow.project, 'src/generated/camera.json'), JSON.stringify({layouts: [{scene: 'hook', mode: 'overlay'}], scenes: {hook: {available: false}}}));
  await assert.rejects(executeWorkflow(workflow, 'build', {run: async () => {}}), /Facecam is missing for: hook/);
});
