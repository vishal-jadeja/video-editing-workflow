import {readFile,writeFile,mkdir,copyFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function resolveLayouts(episode,timeline){
  const allowed=['facecam','overlay','split','graphics'];
  return timeline.scenes.flatMap(s=>{
    const beats=episode.layouts?.[s.id]||[{at:'start',mode:'graphics'}];
    if(beats[0]?.at!=='start')throw Error(`${s.id}: first layout must be at start`);
    const resolved=beats.map(b=>{
      if(!allowed.includes(b.mode))throw Error(`Unknown layout: ${b.mode}`);
      const seconds=b.at==='start'?0:s.cues[b.at];
      if(!Number.isFinite(seconds))throw Error(`Unknown layout cue: ${s.id}.${b.at}`);
      return {scene:s.id,mode:b.mode,cue:b.at,localFrame:Math.round(seconds*30),startFrame:s.startFrame+Math.round(seconds*30)};
    });
    return resolved.map((b,i)=>{
      const endFrame=resolved[i+1]?.startFrame??s.startFrame+s.frames;
      if(endFrame<=b.startFrame)throw Error(`Layout beats must increase: ${s.id}.${b.cue}`);
      return {...b,endFrame};
    });
  });
}

export async function prepareFacecam(){
  const config=JSON.parse(await readFile(process.env.FACECAM_CONFIG||'data/facecam.json','utf8'));
  const episode=JSON.parse(await readFile(process.env.PART_DATA||'data/part-01.json','utf8'));
  const timeline=JSON.parse(await readFile('src/generated/timeline.json','utf8'));
  const layouts=resolveLayouts(episode,timeline);
  await mkdir('public/media',{recursive:true});
  const scenes={};const copies=new Map();
  for(const scene of timeline.scenes){
    const override=config.sceneOverrides?.[scene.id]||{};
    const file=override.file||config.file;
    // Default clip is a continuous take. An override's start is relative to its scene.
    const sourceStartSeconds=override.sourceStartSeconds??((config.sourceStartSeconds||0)+scene.start);
    const zoom=override.zoom??config.zoom??1;
    const objectPosition=override.objectPosition??config.objectPosition??'50% 42%';
    const splitObjectPosition=override.splitObjectPosition??config.splitObjectPosition??objectPosition;
    if(!Number.isFinite(sourceStartSeconds)||sourceStartSeconds<0)throw Error(`Invalid source start: ${scene.id}`);
    if(!Number.isFinite(zoom)||zoom<1||zoom>3)throw Error(`Zoom must be between 1 and 3: ${scene.id}`);
    if(!/^\d+(\.\d+)?% \d+(\.\d+)?%$/.test(objectPosition))throw Error('objectPosition must contain two percentage values');
    if(!/^\d+(\.\d+)?% \d+(\.\d+)?%$/.test(splitObjectPosition))throw Error('splitObjectPosition must contain two percentage values');
    let available=false;
    try{available=(await stat(file)).isFile();}catch(e){if(e.code!=='ENOENT')throw e;}
    const relevant=layouts.filter(b=>b.scene===scene.id&&b.mode!=='graphics');
    let src=null;
    if(available&&relevant.length){
      if(!copies.has(file)){
        const metadata=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8'}));
        const video=metadata.streams.find(s=>s.codec_type==='video');
        const duration=Number(video?.duration??metadata.format.duration);
        if(!video||!Number.isFinite(duration))throw Error(`Unreadable video: ${file}`);
        const name=`facecam-${copies.size}${path.extname(file)}`;
        await copyFile(file,`public/media/${name}`);
        copies.set(file,{src:`media/${name}`,duration});
      }
      const clip=copies.get(file);
      const needed=sourceStartSeconds+(Math.max(...relevant.map(b=>b.endFrame))-scene.startFrame)/30;
      if(clip.duration+1/30<needed)throw Error(`${scene.id}: ${file} is too short (${clip.duration.toFixed(2)}s). Need ${needed.toFixed(2)}s. Adjust sourceStartSeconds or use a longer take.`);
      src=clip.src;
    }
    if(override.file&&!available)throw Error(`Missing scene override video: ${file}`);
    scenes[scene.id]={available:available&&relevant.length>0,src,trimBefore:Math.round(sourceStartSeconds*30),zoom,objectPosition,splitObjectPosition};
  }
  const result={scenes,layouts};
  await writeFile('src/generated/camera.json',JSON.stringify(result,null,2));
  await writeFile('src/generated/episode.json',JSON.stringify(episode,null,2));
  await writeFile('out/facecam-edit-plan.json',JSON.stringify(layouts.map(b=>({...b,startSeconds:b.startFrame/30,endSeconds:b.endFrame/30})),null,2));
  console.log(`Face cam: ${copies.size?'loaded '+copies.size+' video file(s)':'placeholders (no video supplied)'}. ${layouts.length} editorial beats.`);
  return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await prepareFacecam();
