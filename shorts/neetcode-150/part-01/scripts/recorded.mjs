// Recorded face-cam edition: turn a script + one face-cam take (video with audio) into the per-scene voice files,
// word alignment, timeline and camera config that the rest of the pipeline consumes. The take's own audio becomes
// the narration; video and audio are cut together so lip sync is preserved.
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {planEdit,FPS} from './edit-plan.mjs';

const recording=process.env.RECORDING;
if(!recording)throw Error('RECORDING is not set. Point the workflow config "recording" at your face-cam video.');
await access(recording).catch(()=>{throw Error(`Recording not found: ${recording}`);});
const data=JSON.parse(await readFile(process.env.PART_DATA||'data/part-01.json','utf8'));
const camera=JSON.parse(await readFile(process.env.FACECAM_CONFIG||'data/facecam.json','utf8'));
const options=JSON.parse(process.env.RECORDING_EDIT||'{}');
const dir='out/recording';
for(const d of [dir,'public/audio','src/generated'])await mkdir(d,{recursive:true});

const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',recording],{encoding:'utf8'}));
if(!probe.streams.some(s=>s.codec_type==='video'))throw Error('The recording has no video stream.');
if(!probe.streams.some(s=>s.codec_type==='audio'))throw Error('The recording has no audio stream; recorded mode uses the take\'s own voice.');
const duration=Number(probe.format.duration);

// 1. Transcribe (cached by recording bytes + model).
execFileSync('ffmpeg',['-v','error','-y','-i',recording,'-vn','-ac','1','-ar','16000',`${dir}/source-16k.wav`]);
const model=process.env.ASR_MODEL||'small.en';
const identity=createHash('sha256').update(await readFile(recording)).update(model).digest('hex');
let asr=null;
try{const cached=JSON.parse(await readFile(`${dir}/asr.json`,'utf8'));if(cached.identity===identity)asr=cached;}catch{}
if(!asr){
  execFileSync('.venv/bin/python',['scripts/transcribe.py',`${dir}/source-16k.wav`,`${dir}/asr.json`,`${data.title}. NeetCode 150.`],{stdio:'inherit'});
  asr={...JSON.parse(await readFile(`${dir}/asr.json`,'utf8')),identity};
  await writeFile(`${dir}/asr.json`,JSON.stringify(asr,null,1));
}else console.log('Transcription cached.');

// 2. Plan the edit: drop speech outside the script (retakes, flubs, chatter) and tighten long pauses.
const quiet=spawnSync('ffmpeg',['-hide_banner','-i',`${dir}/source-16k.wav`,'-af','silencedetect=noise=-35dB:d=0.2','-f','null','-'],{encoding:'utf8'}).stderr;
const silences=[...quiet.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map(m=>({start:+m[1],end:+m[2]}));
const plan=planEdit({words:asr.words,scenes:data.scenes,duration,silences,options});
if(plan.unmatchedScript/plan.scriptTokens>.25)throw Error(`Only ${plan.scriptTokens-plan.unmatchedScript}/${plan.scriptTokens} script words were heard. Is this the right recording for "${data.title}"?`);

// 3. Render the locked edit: every kept segment, video and audio together, with 12 ms fades at each splice.
const filters=[],labels=[];
plan.segments.forEach((s,i)=>{
  const d=s.frames/FPS;
  filters.push(`[0:v]trim=start=${s.start}:end=${s.end},setpts=PTS-STARTPTS,fps=${FPS},tpad=stop_mode=clone:stop=2,trim=end_frame=${s.frames}[v${i}]`,
    `[0:a]atrim=start=${s.start}:end=${s.end},asetpts=PTS-STARTPTS,aresample=48000,apad,atrim=end=${d},afade=t=in:d=0.012,afade=t=out:st=${Math.max(0,d-.012)}:d=0.012[a${i}]`);
  labels.push(`[v${i}][a${i}]`);
});
// PCM audio in a MOV: no AAC encoder delay, so scene audio stays sample-aligned with the video.
const edited=`${dir}/edited.mov`;
execFileSync('ffmpeg',['-v','error','-y','-i',recording,'-filter_complex',`${filters.join(';')};${labels.join('')}concat=n=${plan.segments.length}:v=1:a=1[v][a]`,'-map','[v]','-map','[a]','-c:v','libx264','-preset','slow','-crf','16','-pix_fmt','yuv420p','-r',String(FPS),'-c:a','pcm_s24le','-ar','48000',edited]);
const frames=Number(JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-select_streams','v:0','-show_entries','stream=nb_read_frames','-of','json',edited],{encoding:'utf8'})).streams[0].nb_read_frames);
if(frames!==plan.frames)throw Error(`Edited recording has ${frames} frames, expected ${plan.frames}.`);

// 4. Per-scene narration from the edited audio: exact scene lengths, light cleanup (rumble filter, gentle denoise).
const cleanup=options.denoise===false?'highpass=f=80':'highpass=f=80,afftdn=nf=-30';
for(const [i,scene] of plan.scenes.entries()){
  const prefix=`public/audio/${scene.id}`;
  // Input-side seek: the filter chain only sees this scene's audio, so atrim/apad count from the scene start.
  execFileSync('ffmpeg',['-v','error','-y','-ss',String(scene.startFrame/FPS),'-t',String(scene.frames/FPS),'-i',edited,'-vn','-af',`asetpts=PTS-STARTPTS,${cleanup},apad,atrim=end=${scene.frames/FPS}`,'-ac','1','-ar','48000',`${prefix}.wav`]);
  await writeFile(`${prefix}.txt`,data.scenes[i].voice);
  await writeFile(`${prefix}.sha`,createHash('sha256').update(await readFile(`${prefix}.wav`)).update(data.scenes[i].voice).digest('hex'));
}
await writeFile('public/audio/provider.json',JSON.stringify({provider:'recorded',voice:'face-cam recording'}));

// 5. Camera: the edited take plays continuously from 0; keep only the user's crop settings.
const crop=o=>Object.fromEntries(Object.entries(o).filter(([k])=>['objectPosition','splitObjectPosition','zoom'].includes(k)));
await writeFile('src/generated/facecam-recorded.json',JSON.stringify({file:edited,sourceStartSeconds:0,...crop(camera),sceneOverrides:Object.fromEntries(Object.entries(camera.sceneOverrides??{}).map(([id,o])=>[id,crop(o)]))},null,2));

// 6. Review report: every cut with its reason and the words it removed.
const report={recording,sourceSeconds:+duration.toFixed(3),editedSeconds:+plan.duration.toFixed(3),frames:plan.frames,asrModel:model,
  heardScriptWords:`${plan.scriptTokens-plan.unmatchedScript}/${plan.scriptTokens}`,cuts:plan.cuts.map(c=>({...c,start:+c.start.toFixed(3),end:+c.end.toFixed(3)})),
  scenes:plan.scenes.map(s=>({...s,startSeconds:+(s.startFrame/FPS).toFixed(3),seconds:+(s.frames/FPS).toFixed(3)})),segments:plan.segments};
await writeFile('out/recording-edit.json',JSON.stringify(report,null,2));
console.log(`Recording: ${duration.toFixed(2)}s → ${plan.duration.toFixed(2)}s. Heard ${report.heardScriptWords} script words.`);
for(const c of plan.cuts.filter(c=>c.reason!=='pause'))console.log(`  cut ${c.reason} ${c.start.toFixed(2)}–${c.end.toFixed(2)}s: "${c.text}"`);
console.log(`  ${plan.cuts.filter(c=>c.reason==='pause').length} long pause(s) tightened. Review out/recording-edit.json.`);

// 7. Word timings from the script itself (forced alignment on each scene), then the timeline.
execFileSync('.venv/bin/python',['scripts/align.py'],{stdio:'inherit',env:process.env});
console.log('Recorded narration ready:',path.resolve(edited));
