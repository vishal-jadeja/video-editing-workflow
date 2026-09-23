import {readFile,writeFile,mkdir,access,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const provider=process.argv[2]||'openai';
if (!['local','openai'].includes(provider)) throw Error('Choose local or openai');
if(provider==='openai'&&!process.env.OPENAI_API_KEY) throw Error('OPENAI_API_KEY is missing. Set it in your environment; never commit it.');
const data=JSON.parse(await readFile(process.env.PART_DATA||'data/part-01.json','utf8'));
await mkdir('public/audio',{recursive:true}); await mkdir('src/generated',{recursive:true});
for(const scene of data.scenes) {
  const prefix=`public/audio/${scene.id}`;
  const identity=createHash('sha256').update(JSON.stringify({provider,text:scene.voice,voice:provider==='local'?'Daniel':process.env.OPENAI_VOICE||'cedar',rate:205,model:process.env.OPENAI_TTS_MODEL||'gpt-4o-mini-tts'})).digest('hex');
  try {if((await readFile(prefix+'.sha','utf8'))===identity&&(await stat(prefix+'.wav')).size>10000){console.log('Cached',scene.id);continue;}}catch{}
  await writeFile(prefix+'.txt',scene.voice);
  if(provider==='local') {
    execFileSync('say',['-v','Daniel','-r','205','-f',prefix+'.txt','-o',prefix+'.aiff']);
    execFileSync('ffmpeg',['-v','error','-y','-i',prefix+'.aiff','-ar','48000','-ac','1',prefix+'.wav']);
  } else {
    const res=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_TTS_MODEL||'gpt-4o-mini-tts',voice:process.env.OPENAI_VOICE||'cedar',input:scene.voice,response_format:'wav',instructions:'Calm, confident, conversational male delivery. Clear, lightly brisk, around 190 to 205 words per minute. No hype, no dramatic emphasis. Read precisely. O of n is pronounced oh of en; O of n squared is oh of en squared; NeetCode is neet code.'})});
    if(!res.ok)throw Error(`Speech API ${res.status}: ${await res.text()}`);
    await writeFile(prefix+'.wav',Buffer.from(await res.arrayBuffer()));
  }
  if((await stat(prefix+'.wav')).size<10000)throw Error('Speech produced empty audio. Run with access to macOS speech services.');
  await writeFile(prefix+'.sha',identity);
  console.log('Generated',scene.id,provider);
}
await writeFile('public/audio/provider.json',JSON.stringify({provider,voice:provider==='local'?'Daniel':process.env.OPENAI_VOICE||'cedar'}));
// Forced alignment uses the exact script for BOTH providers, avoiding ASR spelling errors.
execFileSync('.venv/bin/python',['scripts/align.py'],{stdio:'inherit',env:process.env});
