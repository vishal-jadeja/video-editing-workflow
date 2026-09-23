import {readFile,writeFile,rename} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
const timeline=JSON.parse(await readFile('src/generated/timeline.json','utf8'));
if(!timeline.ready)throw Error('Run voice generation first.');
execFileSync('.venv/bin/python',['scripts/sfx.py'],{stdio:'inherit'});
const args=['-hide_banner','-y'];
for(const s of timeline.scenes)args.push('-i',`public/audio/${s.id}.wav`);
const filter=timeline.scenes.map((s,i)=>`[${i}:a]aresample=48000,apad,atrim=duration=${s.duration},asetpts=PTS-STARTPTS[a${i}]`).join(';')+';'+timeline.scenes.map((_,i)=>`[a${i}]`).join('')+`concat=n=${timeline.scenes.length}:v=0:a=1[vo]`;
execFileSync('ffmpeg',[...args,'-filter_complex',filter,'-map','[vo]','-ac','1','public/audio/voice.wav'],{stdio:['ignore','ignore','pipe']});
const base=['-hide_banner','-y','-i','public/audio/voice.wav','-i','public/audio/sfx.wav'];
// Voice normalization before mixing preserves low SFX levels regardless of provider.
const premix='[0:a]loudnorm=I=-16:TP=-2:LRA=7,aresample=48000[v];[v][1:a]amix=inputs=2:normalize=0:duration=first';
execFileSync('ffmpeg',[...base,'-filter_complex',premix,'-ar','48000','public/audio/premix.wav'],{stdio:['ignore','ignore','pipe']});
const measure=spawnSync('ffmpeg',['-hide_banner','-i','public/audio/premix.wav','-af','loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json','-f','null','-'],{encoding:'utf8'});
if(measure.status!==0)throw Error(measure.stderr);
const stats=JSON.parse(measure.stderr.slice(measure.stderr.lastIndexOf('{'),measure.stderr.lastIndexOf('}')+1));
const normalize=`loudnorm=I=-14:TP=-1.5:LRA=7:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`;
execFileSync('ffmpeg',['-v','error','-y','-i','public/audio/premix.wav','-af',normalize,'-ar','48000','-ac','2','-c:a','pcm_s24le','public/audio/mix.wav']);
await writeFile('out/audio-loudness.json',JSON.stringify(stats,null,2));
// Verify the stereo result: channel conversion and limiting can affect loudness.
const verify=()=>{
  const r=spawnSync('ffmpeg',['-hide_banner','-i','public/audio/mix.wav','-af','loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json','-f','null','-'],{encoding:'utf8'});
  if(r.status!==0)throw Error(r.stderr);
  return JSON.parse(r.stderr.slice(r.stderr.lastIndexOf('{'),r.stderr.lastIndexOf('}')+1));
};
let final=verify();
const correction=Math.min(-14-Number(final.input_i),-1.5-Number(final.input_tp));
if(Math.abs(correction)>.1){
  execFileSync('ffmpeg',['-v','error','-y','-i','public/audio/mix.wav','-af',`volume=${correction}dB`,'-c:a','pcm_s24le','public/audio/mix-corrected.wav']);
  await rename('public/audio/mix-corrected.wav','public/audio/mix.wav');final=verify();
}
await writeFile('out/audio-final-loudness.json',JSON.stringify(final,null,2));
console.log('Mixed voice + original SFX, two-pass -14 LUFS normalization.');
