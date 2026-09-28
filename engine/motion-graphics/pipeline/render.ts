import path from 'node:path';
import config from './config.json';
import {copyFile,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {bundle} from '@remotion/bundler';
import {renderMedia,renderStill,selectComposition} from '@remotion/renderer';
import type {GraphicsPlan} from '../schemas/graphics-plan';
import type {Analysis,Source} from '../schemas/analysis';
import {presets} from '../src/tokens';
import {atomic,exists,fileHash,hash,json,python,run} from './io';
import {assertQa} from './qa';
export type Project={slug:string;source:Source};
export const approvalDigest=(plan:GraphicsPlan,analysis:Analysis,engine:string,assets:Record<string,string>)=>hash({plan,analysis,engine,assets});
export async function assetHashes(project:string,plan:GraphicsPlan){const result:Record<string,string>={};for(const a of plan.assets){const root=path.resolve(project),file=path.resolve(project,a.path);if(!file.startsWith(root+path.sep))throw new Error('Asset escapes project');result[a.id]=await fileHash(file);if(a.kind==='lottie'){const data=await readFile(file,'utf8');const parsed=JSON.parse(data);if(!Array.isArray(parsed.layers)||typeof parsed.fr!=='number')throw new Error('Invalid Lottie document');if((parsed.assets??[]).some((x:{p?:string;u?:string})=>x.p&&!x.p.startsWith('data:')))throw new Error('Lottie must embed image assets; external assets break offline determinism');if(/"x"\s*:\s*"/i.test(data))throw new Error('Lottie expressions must be baked into keyframes');if(parsed.fonts)throw new Error('Convert Lottie text to outlines for offline font consistency');}}
 return result;
}
export async function stage(project:string,plan:GraphicsPlan,source?:Source){const publicDir=path.resolve('public/projects',plan.slug);await mkdir(publicDir,{recursive:true});for(const a of plan.assets){const dest=path.join(publicDir,a.path);await mkdir(path.dirname(dest),{recursive:true});await copyFile(path.resolve(project,a.path),dest);}let sourceUrl:string|undefined;if(source){const name=`source${path.extname(source.path)}`;sourceUrl=`projects/${plan.slug}/${name}`;const dest=path.join(publicDir,name);if(!await exists(dest)||await fileHash(dest)!==source.sha256)await copyFile(source.path,dest);}const props={plan,sourceUrl};await atomic(path.join(project,'render-props.json'),props);return props;}
export async function renderOverlay(project:string,plan:GraphicsPlan){await stage(project,plan);const serveUrl=await bundle({entryPoint:path.resolve('src/index.ts'),publicDir:path.resolve('public')});const inputProps={plan,overlayOnly:true,auditLayout:true};const composition=await selectComposition({serveUrl,id:'Overlay',inputProps});const output=path.join(project,'renders','overlay.mov');await mkdir(path.dirname(output),{recursive:true});await renderMedia({serveUrl,composition,inputProps,outputLocation:output,codec:'prores',proResProfile:'4444',pixelFormat:'yuva444p10le',imageFormat:'png',muted:true,concurrency:config.render.concurrency,logLevel:'warn'});return output;}
function colorArgs(s:Source){const args:string[]=[];for(const [key,value] of [['colorspace',s.colorSpace],['color_trc',s.colorTransfer],['color_primaries',s.colorPrimaries],['color_range',s.colorRange]])if(value!=='unknown')args.push(`-${key}`,value);return args;}
export async function makeAudio(project:string,plan:GraphicsPlan,source:Source){
 if(!source.audioStreams.length){if(plan.audio.mode==='normalize')throw new Error('Cannot normalize a silent source');if(plan.audio.mode==='preserve')return undefined;}
 if(source.audioStreams.length>1)throw new Error('Remix mode supports one mixed source audio stream. Preserve mode copies all streams.');
 if(source.audioStreams.some(s=>Math.abs(s.startTime-source.startTime)>.001))throw new Error('Remix requires aligned audio and video start timestamps.');
 const dir=path.join(project,'renders'),t=presets[plan.preset],mix=path.join(dir,'mix.wav');await mkdir(dir,{recursive:true});
 if(plan.audio.mode==='sfx'){
  const dry=path.join(dir,'sfx-dry.wav'),ducked=path.join(dir,'sfx-ducked.wav');await run(await python(),['pipeline/audio.py',path.join(project,'graphics-plan.json'),dry]);
  if(source.audioStreams.length){
   await run('ffmpeg',['-y','-v','error','-i',dry,'-i',source.path,'-filter_complex',`[0:a][1:a:0]sidechaincompress=threshold=${t.audio.duckThreshold}:ratio=${t.audio.duckRatio}:attack=${t.audio.attackMs}:release=${t.audio.releaseMs}[sfx]`,'-map','[sfx]','-c:a','pcm_s24le',ducked]);
   await run('ffmpeg',['-y','-v','error','-i',source.path,'-i',ducked,'-filter_complex','[0:a:0][1:a]amix=inputs=2:normalize=0:duration=first[mix]','-map','[mix]','-c:a','pcm_s24le',mix]);
  }else await copyFile(dry,mix);
 }else await run('ffmpeg',['-y','-v','error','-i',source.path,'-map','0:a:0','-c:a','pcm_s24le',mix]);
 const loudnorm=`loudnorm=I=${plan.audio.targetLufs}:TP=${t.audio.truePeak}:LRA=${t.audio.lra}`;
 const log=path.join(dir,'loudness-pass1.json');
 // Python captures FFmpeg stderr without shell redirection or quoting user paths.
 const script='import subprocess,json,sys; p=subprocess.run(sys.argv[2:],capture_output=True,text=True,check=True); s=p.stderr; open(sys.argv[1],"w").write(s[s.rfind("{"):s.rfind("}")+1])';
 await run(await python(),['-c',script,log,'ffmpeg','-hide_banner','-i',mix,'-af',`${loudnorm}:print_format=json`,'-f','null','-']);const measured=await json<Record<string,string>>(log);
 if(!Number.isFinite(Number(measured.input_i)))throw new Error('Cannot normalize silent or unmeasurable audio');
 const second=`${loudnorm}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true:print_format=json`;
 const out=path.join(dir,'mix-normalized.wav');await run('ffmpeg',['-y','-v','error','-i',mix,'-af',second,'-ar','48000','-c:a','pcm_s24le',out]);return out;
}
export function compositeArgs(source:Source,overlay:string,output:string,audio?:string):string[]{
 const args=['-y','-v','error','-i',source.path,'-i',overlay];if(audio)args.push('-i',audio);
 args.push('-filter_complex','[0:v:0][1:v:0]overlay=0:0:format=auto:eof_action=pass:repeatlast=0[v]','-map','[v]','-map',audio?'2:a:0':'0:a?','-map_metadata','0','-c:v','libx264','-profile:v','high','-crf',String(config.render.crf),'-pix_fmt','yuv420p','-fps_mode','passthrough','-frames:v',String(source.durationFrames),...colorArgs(source),'-c:a','copy','-movflags','+faststart',output);return args;
}
export async function renderProject(project:string,plan:GraphicsPlan,a:Analysis){assertQa(plan,a);const overlay=await renderOverlay(project,plan);const audio=plan.audio.mode==='preserve'?undefined:await makeAudio(project,plan,a.source);await run('ffmpeg',compositeArgs(a.source,overlay,path.join(project,'renders','composite.mov'),audio));}
export async function qaFrames(project:string,plan:GraphicsPlan,source:Source){
 const inputProps={...await stage(project,plan,source),auditLayout:true},serveUrl=await bundle({entryPoint:path.resolve('src/index.ts'),publicDir:path.resolve('public')});const composition=await selectComposition({serveUrl,id:'Composite',inputProps});const dir=path.join(project,'qa-frames');await mkdir(dir,{recursive:true});
 const frames=[...new Set(plan.cues.flatMap(c=>[Math.max(0,c.startFrame-1),c.startFrame,Math.floor((c.startFrame+c.endFrame-1)/2),c.endFrame-1,Math.min(plan.durationFrames-1,c.endFrame)]))].sort((a,b)=>a-b);
 for(const frame of frames)await renderStill({serveUrl,composition,inputProps,frame,output:path.join(dir,`${frame}.png`),imageFormat:'png',logLevel:'warn'});
 return frames;
}
export async function mediaQa(project:string,plan:GraphicsPlan,source:Source){
 const output=path.join(project,'renders','composite.mov');if(!await exists(output))return {status:'not-rendered',checks:[]};const probeOut=path.join(project,'.cache','output-probe.json');await run(await python(),['pipeline/probe.py',output,probeOut]);const result=await json<Source>(probeOut);const checks:{name:string;pass:boolean;details:string}[]=[];
 checks.push({name:'frame-count',pass:result.durationFrames===source.durationFrames,details:`${result.durationFrames} / ${source.durationFrames}`},{name:'fps',pass:Math.abs(result.fps-source.fps)<1e-8&&!result.vfr,details:result.fpsRational},{name:'duration',pass:Math.abs(result.durationSeconds-source.durationSeconds)<config.qa.durationToleranceSeconds,details:`${result.durationSeconds} / ${source.durationSeconds}`},{name:'resolution',pass:result.width===source.width&&result.height===source.height,details:`${result.width}x${result.height}`});
 if(plan.audio.mode==='preserve'){
  checks.push({name:'audio-stream-count',pass:result.audioStreams.length===source.audioStreams.length,details:String(result.audioStreams.length)});
  for(let i=0;i<source.audioStreams.length;i++){
   const packetHash=async(file:string)=>run('ffmpeg',['-v','error','-i',file,'-map',`0:a:${i}`,'-c:a','copy','-f','hash','-hash','sha256','-'],{capture:true});const input=await packetHash(source.path),out=await packetHash(output);
   checks.push({name:`audio-${i}-bytes`,pass:input.trim()===out.trim(),details:out.trim()},{name:`audio-${i}-sync`,pass:Math.abs((result.audioStreams[i]?.startTime??Infinity)-source.audioStreams[i].startTime)<config.qa.audioStartToleranceSeconds,details:'First audio presentation timestamp must match.'});
  }
 }
 const alphaInfo=JSON.parse(await run('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=pix_fmt,codec_name,nb_frames','-of','json',path.join(project,'renders','overlay.mov')],{capture:true})).streams[0];
 checks.push({name:'alpha-format',pass:alphaInfo.codec_name==='prores'&&alphaInfo.pix_fmt.startsWith('yuva'),details:alphaInfo.pix_fmt});
 if(result.audioStreams.length){const log=await run(await python(),['-c','import sys,json;sys.path.insert(0,"pipeline");from analyze import loudness;print(json.dumps(loudness(sys.argv[1])))',output],{capture:true});const l=JSON.parse(log);checks.push({name:'audio-clipping',pass:l.truePeak===null||l.truePeak<=0,details:JSON.stringify(l)});if(plan.audio.mode!=='preserve')checks.push({name:'loudness-target',pass:l.integrated!==null&&Math.abs(l.integrated-plan.audio.targetLufs)<=config.qa.loudnessToleranceLu&&l.truePeak<=presets[plan.preset].audio.truePeak+.2,details:JSON.stringify(l)});}
 return {status:checks.every(c=>c.pass)?'passed':'failed',checks};
}
