import {lstat, readFile, readdir, unlink, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {withProjectLock} from './workflow.mjs';

// Only producer-owned intermediate files are eligible. Never delete directories.
function audioCandidates(episode) {
  return [
    ...episode.scenes.flatMap(({id}) => [`${id}.aiff`, `${id}.txt`]),
    'voice.wav', 'premix.wav', 'sfx.wav', 'mix-corrected.wav',
  ].map(name => `public/audio/${name}`);
}

async function inspect(project, relative) {
  const parts = relative.split('/');
  if (parts.some(part => !part || part === '.' || part === '..') || path.isAbsolute(relative)) {
    throw new Error(`Unsafe cleanup path: ${relative}`);
  }
  let target = project;
  for (const [index, part] of parts.entries()) {
    target = path.join(target, part);
    let info;
    try { info = await lstat(target); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    if (info.isSymbolicLink()) throw new Error(`Cleanup refuses symbolic links: ${relative}`);
    if (index < parts.length - 1 && !info.isDirectory()) throw new Error(`Expected directory: ${target}`);
    if (index === parts.length - 1) return info;
  }
}

async function readJson(project, relative) {
  const info = await inspect(project, relative);
  if (!info?.isFile()) throw new Error(`Missing cleanup prerequisite: ${relative}`);
  return JSON.parse(await readFile(path.join(project, relative), 'utf8'));
}

async function requireSuccessfulExport(workflow) {
  const report = await readJson(workflow.project, 'out/shorts-workflow.json');
  if (report.command !== 'build' || report.status !== 'passed' || report.episode !== workflow.episode.slug ||
      !report.steps?.some(step => step.id === 'validate-export' && step.status === 'passed')) {
    throw new Error('Cleanup requires the latest run to be a successful build of this episode. Run build first.');
  }
  const validation = await readJson(workflow.project, 'out/validation.json');
  const video = `out/${workflow.episode.slug}.mp4`;
  const info = await inspect(workflow.project, video);
  if (!validation.passed || validation.file !== video || !info?.isFile() || info.size === 0 || info.size !== Number(validation.size)) {
    throw new Error('The validated MP4 is missing or its size has changed. Run build again before cleanup.');
  }
}

export async function cleanupWorkflow(workflow, {apply = false, includeReview = false} = {}) {
  return withProjectLock(workflow.project, async () => {
    let blockedReason = null;
    try { await requireSuccessfulExport(workflow); }
    catch (error) { blockedReason = error.message; }
    if (apply && blockedReason) throw new Error(blockedReason);

    const protectedPaths = new Set([workflow.configPath, workflow.episodePath, workflow.facecamPath].map(p => path.resolve(p)));
    const camera = JSON.parse(await readFile(workflow.facecamPath, 'utf8'));
    for (const file of [camera.file, ...Object.values(camera.sceneOverrides ?? {}).map(scene => scene.file)]) {
      if (file) protectedPaths.add(path.resolve(workflow.project, file));
    }
    const candidates = audioCandidates(workflow.episode);
    if (includeReview) {
      const qa = await inspect(workflow.project, 'out/qa');
      if (qa && !qa.isDirectory()) throw new Error('Expected directory: out/qa');
      if (qa) {
        const names = await readdir(path.join(workflow.project, 'out/qa'));
        for (const name of names.sort()) {
          if (/^(frame|camera-test)-\d+\.\d{2}s\.png$/.test(name)) candidates.push(`out/qa/${name}`);
        }
      }
    }

    const files = [];
    for (const file of candidates) {
      if (protectedPaths.has(path.resolve(workflow.project, file))) continue;
      const info = await inspect(workflow.project, file);
      if (!info) continue;
      if (!info.isFile()) throw new Error(`Expected intermediate file: ${file}`);
      files.push({file, bytes: info.size});
    }
    const report = {
      episode: workflow.episode.slug, mode: apply ? 'apply' : 'dry-run', includeReview,
      eligible: !blockedReason, blockedReason, files,
      bytes: files.reduce((sum, file) => sum + file.bytes, 0), removed: [],
    };
    console.log(`\nCleanup ${report.mode}: ${files.length} files, ${(report.bytes / 1024 / 1024).toFixed(2)} MiB`);
    for (const {file} of files) console.log(`  ${file}`);
    if (blockedReason) console.log(`Deletion blocked: ${blockedReason}`);
    if (!apply) {
      console.log('No media deleted. Use cleanup --apply after a successful build to remove these files.');
      return report;
    }

    // Validate every target, including the report destination, before any deletion.
    const destination = 'out/cleanup.json';
    const previous = await inspect(workflow.project, destination);
    if (previous && !previous.isFile()) throw new Error(`Expected report file: ${destination}`);
    const save = () => writeFile(path.join(workflow.project, destination), JSON.stringify(report, null, 2) + '\n');
    report.status = 'running';
    await save();
    try {
      for (const {file} of files) {
        const current = await inspect(workflow.project, file);
        if (!current) continue;
        if (!current.isFile()) throw new Error(`Expected intermediate file: ${file}`);
        await unlink(path.join(workflow.project, file));
        report.removed.push(file);
        await save();
      }
      report.status = 'passed';
    } catch (error) {
      report.status = 'failed';
      report.error = error.message;
      throw error;
    } finally {
      report.finishedAt = new Date().toISOString();
      await save();
    }
    console.log(`Cleanup passed: ${report.removed.length} files removed. Final exports and reusable caches preserved.`);
    return report;
  });
}
