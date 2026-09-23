import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const data=JSON.parse(await readFile(process.env.PART_DATA||'data/part-01.json','utf8'));
await writeFile('src/generated/episode.json',JSON.stringify(data,null,2));
const provider=JSON.parse(await readFile('public/audio/provider.json','utf8'));
const norm=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
let cursor=0;
const scenes=[];
for(const scene of data.scenes) {
  const {words}=JSON.parse(await readFile(`public/audio/${scene.id}.words.json`,'utf8'));
  const duration=Number(execFileSync('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',`public/audio/${scene.id}.wav`],{encoding:'utf8'}));
  const cues={};
  for(const [key,phrase] of Object.entries(scene.cues)) {
    const target=norm(phrase); let found=-1;
    for(let i=0;i<words.length;i++) {
      let joined='';
      for(let j=i;j<words.length&&joined.length<=target.length;j++){
        joined+=norm(words[j].word);
        if(joined===target){found=i;break;}
      }
      if(found>=0)break;
    }
    if(found<0)throw Error(`Unaligned cue ${scene.id}.${key}: ${phrase}`);
    cues[key]=words[found].start;
  }
  const frames=Math.ceil((duration+(scene.id==='cta'?0.75:0.12))*30);
  scenes.push({...scene,start:cursor/30,startFrame:cursor,frames,duration:frames/30,words,cues});
  cursor+=frames;
}
await writeFile('src/generated/timeline.json',JSON.stringify({ready:true,...data,...provider,duration:cursor/30,frames:cursor,scenes},null,2));
console.log('Timeline:',cursor/30,'seconds');
console.table(scenes.map(s=>({scene:s.id,start:s.start.toFixed(2),duration:s.duration.toFixed(2),words:s.words.length})));
