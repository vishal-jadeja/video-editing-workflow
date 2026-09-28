#!/usr/bin/env node
import path from 'node:path';
import {mkdir,readFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {planSchema} from '../schemas/graphics-plan';
import {analysisSchema,sourceSchema} from '../schemas/analysis';
import {atomic,cached,engineHash,exists,fileHash,hash,json,lock,python,run} from './io';
import {writeReviewArtifacts} from './report';
import {draftPlan} from './plan';
import {qaPlan,assertQa} from './qa';
import {approvalDigest,assetHashes,mediaQa,qaFrames,renderProject,stage,type Project} from './render';
import {fontPairingNames,type FontPairingName} from '../src/tokens/typography';
import type {Platform,PresetName} from '../src/tokens';
const help=`Motion Graphics Finishing
  npm run mg -- doctor
  npm run mg -- init /path/to/locked.mov [--slug my-video]
  npm run mg -- analyze [--project my-video] [--transcript words.json] [--model small] [--language en]
  npm run mg -- plan [--preset clean-tech] [--platform youtube] [--pairing modern-italic]
  npm run mg -- preview
  npm run mg -- qa [--frames] [--final]
  npm run mg -- approve --reviewer "Your name"
  npm run mg -- render
Project defaults to the most recently initialized project. Existing plans are never overwritten.
Approval belongs to the human editor and is invalidated by plan, analysis, asset or engine edits.`;
async function main(){
 const {positionals,values:v}=parseArgs({allowPositionals:true,options:{project:{type:'string'},slug:{type:'string'},preset:{type:'string'},platform:{type:'string'},pairing:{type:'string'},transcript:{type:'string'},model:{type:'string',default:'small'},language:{type:'string'},reviewer:{type:'string'},frames:{type:'boolean'},final:{type:'boolean'},help:{type:'boolean'}}});
 const command=positionals[0];if(!command||v.help){console.log(help);return;}
 if(!['doctor','init','analyze','plan','preview','qa','approve','render'].includes(command))throw new Error(`Unknown command ${command}\n${help}`);
 if(command==='doctor'){
  for(const [name,args] of [['ffmpeg',['-version']],['ffprobe',['-version']],['node',['--version']]] as const){try{console.log(`${name}: ${(await run(name,[...args],{capture:true})).split('\n')[0]}`);}catch(e){console.log(`${name}: MISSING (${String(e)})`);}}
  console.log(await run(await python(),['-c','import importlib.util,json;print(json.dumps({x:importlib.util.find_spec(x) is not None for x in ["cv2","scenedetect","librosa","faster_whisper"]},indent=2))'],{capture:true}));return;
 }
 if(command==='init'){
  const video=positionals[1];if(!video)throw new Error('init requires a source video path');const sourcePath=path.resolve(video);const slug=v.slug??path.basename(video,path.extname(video)).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');if(!/^[a-z0-9][a-z0-9_-]*$/.test(slug))throw new Error('Invalid slug');
  const project=path.resolve('projects',slug);await mkdir(project,{recursive:true});await lock(project,async()=>{
   const sourceHash=await fileHash(sourcePath),file=path.join(project,'project.json');if(await exists(file)){const old=await json<Project>(file);if(old.source.sha256!==sourceHash)throw new Error('Slug already belongs to another source. Use a new --slug.');}
   const probe=path.join(project,'.cache','probe.json');await cached(project,'ingest',{sourceHash,sourcePath,script:await fileHash('pipeline/probe.py')},[probe],async()=>run(await python(),['pipeline/probe.py',sourcePath,probe]).then(()=>undefined));
   const source=sourceSchema.parse(await json(probe));await atomic(file,{slug,source});await atomic('.cache/active-project.json',{slug});console.log(JSON.stringify({project,...source},null,2));if(source.warnings.length)console.log('Ingest recorded. Resolve source-contract warnings before analysis.');
  });return;
 }
 const slug=v.project??(await exists('.cache/active-project.json')?(await json<{slug:string}>('.cache/active-project.json')).slug:'');if(!/^[a-z0-9][a-z0-9_-]*$/.test(slug))throw new Error('Run init first or supply --project <slug>');const project=path.resolve('projects',slug);
 const meta=await json<Project>(path.join(project,'project.json'));if(await fileHash(meta.source.path)!==meta.source.sha256)throw new Error('Source media changed. Create a new project; the locked source is immutable.');
 await lock(project,async()=>{
  const analysisFile=path.join(project,'analysis','analysis.json'),planFile=path.join(project,'graphics-plan.json');
  if(command==='analyze'){
   if(meta.source.warnings.length)throw new Error(meta.source.warnings.join('\n'));
   const args=['pipeline/analyze.py',project,'--model',v.model!];if(v.transcript)args.push('--transcript',path.resolve(v.transcript));if(v.language)args.push('--language',v.language);
   await cached(project,'analyze',{source:meta.source.sha256,model:v.model,language:v.language,transcript:v.transcript?await fileHash(v.transcript):null,script:await fileHash('pipeline/analyze.py'),requirements:await fileHash('pipeline/requirements.txt'),config:await fileHash('pipeline/config.json')},[analysisFile,path.join(project,'analysis','transcript.json'),path.join(project,'analysis','shots.json')],async()=>{await run(await python(),args);analysisSchema.parse(await json(analysisFile));},true);return;
  }
  const rawAnalysis=await json<Record<string,unknown>>(analysisFile);const transcript=await json<{words:unknown[]}>(path.join(project,'analysis','transcript.json'));const analysis=analysisSchema.parse({...rawAnalysis,words:transcript.words});if(analysis.source.sha256!==meta.source.sha256)throw new Error('Analysis belongs to another source');
  if(command==='plan'){
   if(await exists(planFile)){planSchema.parse(await json(planFile));console.log('plan: existing plan preserved. Edit it directly; delete it deliberately to draft again.');return;}
   const preset=(v.preset??'clean-tech') as PresetName,platform=(v.platform??(meta.source.height>meta.source.width?'shorts':'youtube')) as Platform;
   if(!['clean-tech','cinematic-doc','high-energy-shorts'].includes(preset)||!['youtube','shorts','reels','tiktok'].includes(platform))throw new Error('Unknown preset or platform');
   const draft=draftPlan(analysis,slug,preset,platform);if(v.pairing){if(!fontPairingNames.includes(v.pairing as FontPairingName))throw new Error('Unknown font pairing');draft.plan.fontPairing=v.pairing as FontPairingName;}await atomic(planFile,draft.plan);await atomic(path.join(project,'analysis','semantic-candidates.json'),draft.candidates);console.log(`Drafted ${draft.plan.cues.length} cues. Review transcript, shots and graphics-plan.json; approval is required before final render.`);return;
  }
  const plan=planSchema.parse(await json(planFile));if(plan.slug!==slug)throw new Error('Plan slug does not match project');const assets=await assetHashes(project,plan),engine=await engineHash(),digest=approvalDigest(plan,analysis,engine,assets);
  if(command==='preview'){await stage(project,plan,meta.source);await run(process.execPath,['node_modules/@remotion/cli/remotion-cli.js','studio','src/index.ts',`--props=${path.join(project,'render-props.json')}`]);return;}
  if(command==='qa'){
   await writeReviewArtifacts(project,plan);
   const findings=qaPlan(plan,analysis),report:{planHash:string;findings:typeof findings;frames?:number[];media?:unknown;manualReview:string}={planHash:digest,findings,manualReview:'PENDING: watch source and output with audio; inspect all cue edge/midpoint frames and verify names, UI regions, contrast during motion, sync, and alpha in the target NLE.'};
   if(v.frames)report.frames=await qaFrames(project,plan,meta.source);
   if(v.final){const manifest=path.join(project,'renders','manifest.json');if(!await exists(manifest)||(await json<{approvalDigest:string}>(manifest)).approvalDigest!==digest)findings.push({severity:'error',code:'stale-render',message:'Final outputs do not match this approved plan and engine.'});if(await exists(manifest)){const m=await json<{composite:string;overlay:string}>(manifest);for(const [name,expected] of [['composite',m.composite],['overlay',m.overlay]]){const file=path.join(project,'renders',`${name}.mov`);if(!await exists(file)||await fileHash(file)!==expected)findings.push({severity:'error',code:'artifact-integrity',message:`${name} differs from the render manifest.`});}}report.media=await mediaQa(project,plan,meta.source);if((report.media as {status:string}).status!=='passed')findings.push({severity:'error',code:'media-qa',message:'Output media checks failed or render is missing.'});}
   await atomic(path.join(project,'qa-report.json'),report);console.log(JSON.stringify(report,null,2));if(findings.some(f=>f.severity==='error'))process.exitCode=1;return;
  }
  if(command==='approve'){
   if(!v.reviewer?.trim())throw new Error('Human reviewer name required: --reviewer "Your name"');assertQa(plan,analysis);await atomic(path.join(project,'approval.json'),{digest,reviewer:v.reviewer.trim(),approvedAt:new Date().toISOString()});console.log('Exact plan, shot review, assets and engine approved. Any change invalidates approval.');return;
  }
  if(command==='render'){
   const approvalFile=path.join(project,'approval.json');if(!await exists(approvalFile))throw new Error('Human approval required. Review the plan, then run approve --reviewer "Your name".');const approval=await json<{digest:string}>(approvalFile);if(approval.digest!==digest)throw new Error('Approval is stale: plan, analysis, assets or engine changed. Obtain human review again.');assertQa(plan,analysis);
   const composite=path.join(project,'renders','composite.mov'),overlay=path.join(project,'renders','overlay.mov');await cached(project,'render',{digest},[composite,overlay],async()=>renderProject(project,plan,analysis));
   const media=await mediaQa(project,plan,meta.source);await atomic(path.join(project,'renders','manifest.json'),{approvalDigest:digest,composite:await fileHash(composite),overlay:await fileHash(overlay),media});console.log(JSON.stringify(media,null,2));if(media.status!=='passed')throw new Error('Rendered media failed QA. Inspect renders/manifest.json.');console.log('Rendered composite.mov + ProRes 4444 overlay.mov. Run qa --frames --final and complete the manual watch-through.');
  }
 });
}
main().catch(e=>{console.error(e instanceof Error?e.message:String(e));process.exitCode=1;});
