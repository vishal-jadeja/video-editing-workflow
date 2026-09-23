import {readFile,rename} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const episode=JSON.parse(await readFile('src/generated/episode.json','utf8'));
const target=`out/${episode.slug}.mp4`;
const temp=`out/${episode.slug}-compatible.mp4`;
const info=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=pix_fmt,color_range','-of','json',target],{encoding:'utf8'}));
if(info.streams[0].pix_fmt==='yuvj420p'||info.streams[0].color_range==='pc'){
  // Convert actual sample range, not just the tag. Preserve the existing AAC bitstream.
  execFileSync('ffmpeg',['-v','error','-y','-i',target,'-vf','scale=in_range=full:out_range=limited:out_color_matrix=bt709,format=yuv420p','-c:v','libx264','-preset','fast','-crf','18','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-c:a','copy','-movflags','+faststart',temp],{stdio:'inherit'});
  await rename(temp,target);
  console.log('Finalized standard-range BT.709 H.264 / AAC.');
}
