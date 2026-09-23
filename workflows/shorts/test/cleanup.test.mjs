import test from 'node:test';
import assert from 'node:assert/strict';
import {access, mkdir, mkdtemp, readFile, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {cleanupWorkflow} from '../cleanup.mjs';
import {withProjectLock} from '../workflow.mjs';

async function fixture(t) {
  const project = await mkdtemp(path.join(tmpdir(), 'shorts-cleanup-'));
  t.after(() => rm(project, {recursive: true, force: true}));
  const put = async (file, content = 'keep') => {
    await mkdir(path.dirname(path.join(project, file)), {recursive: true});
    await writeFile(path.join(project, file), content);
  };
  await put('data/facecam.json', JSON.stringify({file: 'assets/facecam.mp4'}));
  await put('out/shorts-workflow.json', JSON.stringify({command: 'build', status: 'passed', episode: 'demo', steps: [{id: 'validate-export', status: 'passed'}]}));
  await put('out/validation.json', JSON.stringify({passed: true, file: 'out/demo.mp4', size: '4'}));
  const preserved = ['out/demo.mp4', 'out/demo-cover.png', 'assets/facecam.mp4', 'public/audio/hook.wav', 'public/audio/hook.sha', 'public/audio/hook.words.json', 'public/audio/mix.wav', 'public/media/facecam-0.mp4', 'public/fonts/inter.css', '.cache/whisper/base.en.pt', 'src/generated/timeline.json', 'out/qa/custom.png', 'public/audio/custom.wav'];
  const disposable = ['public/audio/hook.aiff', 'public/audio/hook.txt', 'public/audio/voice.wav', 'public/audio/premix.wav', 'public/audio/sfx.wav'];
  for (const file of [...preserved, ...disposable, 'out/qa/frame-2.00s.png']) await put(file);
  const workflow = {project, episode: {slug: 'demo', scenes: [{id: 'hook'}]}, configPath: path.join(project, 'job.json'), episodePath: path.join(project, 'data/demo.json'), facecamPath: path.join(project, 'data/facecam.json')};
  return {project, workflow, put, preserved, disposable};
}

test('dry run lists intermediates without deleting or writing a cleanup report', async t => {
  const {project, workflow, disposable} = await fixture(t);
  const report = await cleanupWorkflow(workflow);
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.eligible, true);
  assert.deepEqual(report.files.map(f => f.file), disposable);
  for (const file of disposable) await access(path.join(project, file));
  await assert.rejects(access(path.join(project, 'out/cleanup.json')), {code: 'ENOENT'});
});

test('apply deletes only selected intermediates, preserves reusable assets, and is repeatable', async t => {
  const {project, workflow, preserved, disposable} = await fixture(t);
  await cleanupWorkflow(workflow, {apply: true});
  for (const file of disposable) await assert.rejects(access(path.join(project, file)), {code: 'ENOENT'});
  for (const file of [...preserved, 'out/qa/frame-2.00s.png']) assert.equal(await readFile(path.join(project, file), 'utf8'), 'keep');
  const saved = JSON.parse(await readFile(path.join(project, 'out/cleanup.json'), 'utf8'));
  assert.equal(saved.status, 'passed');
  assert.deepEqual(saved.removed, disposable);
  assert.equal((await cleanupWorkflow(workflow, {apply: true})).removed.length, 0);
});

test('review cleanup is explicit and preserves non-generated images and cover', async t => {
  const {project, workflow} = await fixture(t);
  await cleanupWorkflow(workflow, {apply: true, includeReview: true});
  await assert.rejects(access(path.join(project, 'out/qa/frame-2.00s.png')), {code: 'ENOENT'});
  await access(path.join(project, 'out/qa/custom.png'));
  await access(path.join(project, 'out/demo-cover.png'));
});

test('preview, failed, and different-episode reports block deletion', async t => {
  const {project, workflow, put} = await fixture(t);
  for (const report of [
    {command: 'preview', status: 'preview-ready', episode: 'demo'},
    {command: 'build', status: 'failed', episode: 'demo'},
    {command: 'build', status: 'passed', episode: 'another'},
  ]) {
    await put('out/shorts-workflow.json', JSON.stringify(report));
    assert.equal((await cleanupWorkflow(workflow)).eligible, false);
    await assert.rejects(cleanupWorkflow(workflow, {apply: true}), /successful build/);
    await access(path.join(project, 'public/audio/premix.wav'));
  }
});

test('missing or changed final export blocks deletion', async t => {
  const {project, workflow, put} = await fixture(t);
  await put('out/demo.mp4', 'changed size');
  await assert.rejects(cleanupWorkflow(workflow, {apply: true}), /size has changed/);
  await rm(path.join(project, 'out/demo.mp4'));
  await assert.rejects(cleanupWorkflow(workflow, {apply: true}), /missing/);
  await access(path.join(project, 'public/audio/premix.wav'));
});

test('symlinked files or parent directories are rejected before deleting anything', async t => {
  const {project, workflow} = await fixture(t);
  await rm(path.join(project, 'public/audio/premix.wav'));
  await symlink(path.join(project, 'assets/facecam.mp4'), path.join(project, 'public/audio/premix.wav'));
  await assert.rejects(cleanupWorkflow(workflow, {apply: true}), /symbolic links/);
  await access(path.join(project, 'public/audio/hook.aiff'));
  await rm(path.join(project, 'out/qa'), {recursive: true});
  await symlink(path.join(project, 'assets'), path.join(project, 'out/qa'));
  await assert.rejects(cleanupWorkflow(workflow, {apply: true, includeReview: true}), /symbolic links/);
  assert.equal(await readFile(path.join(project, 'assets/facecam.mp4'), 'utf8'), 'keep');
});

test('cleanup respects build locks and configured camera source paths', async t => {
  const {project, workflow, put} = await fixture(t);
  await withProjectLock(project, async () => {
    await assert.rejects(cleanupWorkflow(workflow, {apply: true}), /Another workflow owns/);
  });
  await put('data/facecam.json', JSON.stringify({file: 'public/audio/premix.wav'}));
  await cleanupWorkflow(workflow, {apply: true});
  await access(path.join(project, 'public/audio/premix.wav'));
});
