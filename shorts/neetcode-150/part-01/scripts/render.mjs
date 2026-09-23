import {bundle} from '@remotion/bundler';
import {selectComposition,renderMedia,renderStill,openBrowser} from '@remotion/renderer';
import {mkdir,readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {prepareFacecam} from './facecam.mjs';
const mode=process.argv[2]||'video';
if(!['video','cover','stills','camera-test'].includes(mode))throw Error(`Unknown render mode: ${mode}`);
const camera=await prepareFacecam();
const timeline=JSON.parse(await readFile('src/generated/timeline.json','utf8'));
const episode=JSON.parse(await readFile('src/generated/episode.json','utf8'));
await mkdir('out/qa',{recursive:true});
const serveUrl=await bundle({entryPoint:path.resolve('src/index.ts'),publicDir:path.resolve('public')});
const executable=process.env.REMOTION_BROWSER_EXECUTABLE||'/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const browser=await openBrowser('chrome',{browserExecutable:executable,chromiumOptions:{disableWebSecurity:false}});
try {
 const id=mode==='cover'?'Cover':'Part01';
 const composition=await selectComposition({serveUrl,id,puppeteerInstance:browser});
 if(mode==='cover'){
   await renderStill({serveUrl,composition,puppeteerInstance:browser,output:`out/${episode.slug}-cover.png`,imageFormat:'png'});
   console.log('Cover rendered.');
 }else if(mode==='stills'||mode==='camera-test'){
   const shots=mode==='camera-test'?[1,6.3,10.03,25.23]:[...new Set([2,15,25,34,45,51,...timeline.scenes.map(s=>Math.min(timeline.duration-.1,s.start+s.duration*.62)),...camera.layouts.map(b=>(b.startFrame+Math.min(30,Math.floor((b.endFrame-b.startFrame)/2)))/30)])];
   for(const t of shots){
     const frame=Math.min(composition.durationInFrames-1,Math.max(0,Math.round(t*30)));
     await renderStill({serveUrl,composition,puppeteerInstance:browser,frame,output:`out/qa/${mode==='camera-test'?'camera-test':'frame'}-${(frame/30).toFixed(2)}s.png`,imageFormat:'png'});
     console.log('Still:',t.toFixed(2));
   }
 }else{
   let last=-1;
   await renderMedia({serveUrl,composition,puppeteerInstance:browser,outputLocation:`out/${episode.slug}.mp4`,codec:'h264',audioCodec:'aac',audioBitrate:'192k',pixelFormat:'yuv420p',crf:18,x264Preset:'fast',concurrency:3,onProgress:({progress})=>{const p=Math.floor(progress*10);if(p!==last){console.log(`Render ${p*10}%`);last=p;}}});
   execFileSync(process.execPath,['scripts/finalize.mjs'],{stdio:'inherit'});
   console.log('Final MP4 rendered.');
 }
}finally{await browser.close({silent:true});}
