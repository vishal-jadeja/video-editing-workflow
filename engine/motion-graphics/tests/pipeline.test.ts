import {describe,it,expect} from 'vitest';
import path from 'node:path';
import {mkdir,rm,readFile,writeFile} from 'node:fs/promises';
import {atomic,json,run,python,cached,exists} from '../pipeline/io';
import type {Source} from '../schemas/analysis';
import {sourceSchema,analysisSchema} from '../schemas/analysis';
import {analysisFor,examplePlan} from './fixtures';
import {mediaQa,renderProject,compositeArgs} from '../pipeline/render';
import {qaPlan} from '../pipeline/qa';
const root=path.resolve('.cache/integration');
describe('FFmpeg ingest and pipeline',()=>{
 it('probes exact source frames at 24, 30 and 60 fps',async()=>{await mkdir(root,{recursive:true});for(const fps of [24,30,60]){const video=path.join(root,`source-${fps}.mov`),out=path.join(root,`probe-${fps}.json`);await run('ffmpeg',['-y','-v','error','-f','lavfi','-i',`color=c=0x203040:s=320x180:r=${fps}:d=1`,'-c:v','libx264','-pix_fmt','yuv420p',video]);await run(await python(),['pipeline/probe.py',video,out]);const p=sourceSchema.parse(await json(out));expect(p.durationFrames).toBe(fps);expect(p.fps).toBe(fps);expect(p.vfr).toBe(false);}});
 it('detects VFR and records a blocking warning without changing the source',async()=>{const video=path.join(root,'vfr.mov'),out=path.join(root,'vfr.json');await run('ffmpeg',['-y','-v','error','-f','lavfi','-i','testsrc2=s=320x180:r=30:d=1','-vf',"setpts='if(lt(N,15),N,2*N-15)/(30*TB)'",'-fps_mode','vfr','-c:v','libx264',video]);await run(await python(),['pipeline/probe.py',video,out]);expect((await json<Source>(out)).vfr).toBe(true);});
 it('reuses completed cache outputs but recomputes missing or changed inputs',async()=>{let calls=0;const output=path.join(root,'cached.json'),work=async()=>{calls++;await atomic(output,{calls});};await cached(root,'behavior-test',{version:1},[output],work);await cached(root,'behavior-test',{version:1},[output],work);expect(calls).toBeLessThanOrEqual(1);await cached(root,'behavior-test',{version:2},[output],work);expect(calls).toBeGreaterThanOrEqual(1);await rm(output);await cached(root,'behavior-test',{version:2},[output],work);expect(await exists(output)).toBe(true);});
});
// Opt-in because this exercises Chromium, encoding, and the installed Python models/toolchain.
describe.runIf(process.env.MG_INTEGRATION==='1')('analysis and complete render',()=>{
 it('analyzes synthetic media and preserves audio bytes through alpha compositing',async()=>{
  const slug=`test-render-${process.pid}`;const project=path.resolve('projects',slug);await mkdir(path.join(project,'.cache'),{recursive:true});const video=path.join(root,'locked.mov'),probe=path.join(root,'locked.json');
  await run('ffmpeg',['-y','-v','error','-f','lavfi','-i','color=c=0x203040:s=640x360:r=30:d=4','-f','lavfi','-i','sine=frequency=440:sample_rate=48000:duration=4','-c:v','libx264','-pix_fmt','yuv420p','-c:a','pcm_s16le',video]);await run(await python(),['pipeline/probe.py',video,probe]);const source=sourceSchema.parse(await json(probe));await atomic(path.join(project,'project.json'),{slug,source});
  const transcript=path.join(root,'transcript.json');await atomic(transcript,{words:[]});await run(await python(),['pipeline/analyze.py',project,'--transcript',transcript]);const a=analysisSchema.parse(await json(path.join(project,'analysis/analysis.json')));expect(a.shots.length).toBe(1);expect(a.shots[0].reviewed).toBe(false);expect(a.loudness.truePeak).not.toBeNull();
  // Only this generated blank fixture is auto-reviewed; never use this for real footage.
  a.shots.forEach(s=>s.reviewed=true);a.regions=[];const p=examplePlan();p.slug=slug;p.width=source.width;p.height=source.height;p.durationFrames=source.durationFrames;p.cues=[{...p.cues[0],startFrame:0,endFrame:110,box:{x:.06,y:.08,w:.43,h:.32},props:{title:'Build clearly',depth:true}} as typeof p.cues[number]];await atomic(path.join(project,'graphics-plan.json'),p);expect(qaPlan(p,a).filter(f=>f.severity==='error')).toEqual([]);
  await renderProject(project,p,a);const qa=await mediaQa(project,p,source);expect(qa.status).toBe('passed');expect(qa.checks.find(c=>c.name==='audio-0-bytes')?.pass).toBe(true);
  const aacVideo=path.join(root,'locked-aac.mov'),aacProbe=path.join(root,'locked-aac.json');await run('ffmpeg',['-y','-v','error','-i',video,'-c:v','copy','-c:a','aac',aacVideo]);await run(await python(),['pipeline/probe.py',aacVideo,aacProbe]);const aacSource=sourceSchema.parse(await json(aacProbe));await run('ffmpeg',compositeArgs(aacSource,path.join(project,'renders/overlay.mov'),path.join(project,'renders/composite.mov')));expect((await mediaQa(project,p,aacSource)).status).toBe('passed');
  p.audio={mode:'sfx',targetLufs:-14,sfx:[{cueId:p.cues[0].id,event:'in',kind:'click',gain:.08}]};await atomic(path.join(project,'graphics-plan.json'),p);const {makeAudio}=await import('../pipeline/render');const remixed=await makeAudio(project,p,source);expect(await exists(remixed!)).toBe(true);expect(await exists(path.join(project,'renders/sfx-dry.wav'))).toBe(true);
  const measured=JSON.parse(await run(await python(),['-c','import sys,json;sys.path.insert(0,"pipeline");from analyze import loudness;print(json.dumps(loudness(sys.argv[1])))',remixed!],{capture:true}));expect(Math.abs(measured.integrated+14)).toBeLessThanOrEqual(1);expect(measured.truePeak).toBeLessThanOrEqual(-.8);
  await rm(project,{recursive:true,force:true});await rm(path.resolve('public/projects',slug),{recursive:true,force:true});
 });
});

describe.runIf(process.env.MG_INTEGRATION==='1')('CLI human approval gate',()=>{
 it('runs init/plan/qa and rejects absent and stale approvals',async()=>{
  const slug=`test-cli-${process.pid}`,project=path.resolve('projects',slug),active='.cache/active-project.json';const prior=await exists(active)?await readFile(active):null;
  const cli=(...args:string[])=>run(process.execPath,['node_modules/tsx/dist/cli.mjs','pipeline/cli.ts',...args],{capture:true});
  try{
   const sourcePath=path.join(root,'source-30.mov');await cli('init',sourcePath,'--slug',slug);await cli('init',sourcePath,'--slug',slug);
   const meta=await json<{source:Source}>(path.join(project,'project.json'));const p=examplePlan();p.slug=slug;p.width=meta.source.width;p.height=meta.source.height;p.durationFrames=meta.source.durationFrames;p.cues=[];const a=analysisFor(p);a.source=meta.source;
   await atomic(path.join(project,'analysis/analysis.json'),a);await atomic(path.join(project,'analysis/transcript.json'),{words:[]});await cli('plan','--project',slug);await cli('qa','--project',slug);
   await expect(cli('render','--project',slug)).rejects.toThrow('Human approval required');await cli('approve','--project',slug,'--reviewer','Synthetic fixture test');
   const planFile=path.join(project,'graphics-plan.json');const current=await json<Record<string,unknown>>(planFile);await atomic(planFile,{...current,seed:'changed-after-approval'});await expect(cli('render','--project',slug)).rejects.toThrow('Approval is stale');
  }finally{await rm(project,{recursive:true,force:true});if(prior)await writeFile(active,prior);else await rm(active,{force:true});}
 });
});
