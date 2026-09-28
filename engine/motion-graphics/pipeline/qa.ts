import {planSchema,type Cue,type GraphicsPlan} from '../schemas/graphics-plan';
import {analysisSchema,type Analysis} from '../schemas/analysis';
import {presets,resolveTokens,frames,readingFrames,safeBox,type Box} from '../src/tokens';
import {cueText} from '../src/components/shared';
import {captionLines} from '../src/components/KineticCaption';
export type Finding={severity:'error'|'warning';code:string;cue?:string;message:string};
export function overlaps(a:Box,b:Box,pad=0){return a.x<b.x+b.w+pad&&a.x+a.w>b.x-pad&&a.y<b.y+b.h+pad&&a.y+a.h>b.y-pad;}
export const contains=(outer:Box,inner:Box)=>inner.x>=outer.x-1e-6&&inner.y>=outer.y-1e-6&&inner.x+inner.w<=outer.x+outer.w+1e-6&&inner.y+inner.h<=outer.y+outer.h+1e-6;
export function contrast(a:string,b:string){const lum=(hex:string)=>{const rgb=hex.replace('#','').match(/../g)!.map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};const l1=lum(a),l2=lum(b);return(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);}
export const ambient=(c:Cue)=>['finishing','progress'].includes(c.component);
export function qaPlan(input:unknown,rawAnalysis?:unknown):Finding[]{
 const parsed=planSchema.safeParse(input);if(!parsed.success)return parsed.error.issues.map(i=>({severity:'error',code:'schema',message:`${i.path.join('.')}: ${i.message}`}));
 const p=parsed.data,t=resolveTokens(p.preset,p.fontPairing),r={...t.rules,...p.rules},findings:Finding[]=[];
 const add=(code:string,message:string,cue?:string,severity:Finding['severity']='error')=>findings.push({severity,code,cue,message});
 let a:Analysis|undefined;if(rawAnalysis){const check=analysisSchema.safeParse(rawAnalysis);if(!check.success){add('analysis-schema',check.error.message);return findings;}a=check.data;}
 if(p.needsInput.length)add('needs-input',p.needsInput.join('; '));
 if(!a)add('analysis-missing','Real footage requires analysis and reviewed shot regions.');
 if(a){
  if(a.source.width!==p.width||a.source.height!==p.height||Math.abs(a.source.fps-p.fps)>1e-8||a.source.durationFrames!==p.durationFrames)add('source-mismatch','Plan must match source resolution, frame rate and frame count exactly.');
  for(const w of a.source.warnings)add('source-contract',w);
  if(a.needsInput.length)add('analysis-input',a.needsInput.join('; '));
  if(a.shots.some(s=>!s.reviewed))add('shot-review','Review every shot, add protected UI/text regions, then set reviewed=true.');
  if(a.shots.length===0||a.shots[0].startFrame!==0||a.shots.at(-1)!.endFrame!==p.durationFrames||a.shots.some((s,i)=>s.endFrame<=s.startFrame||(i>0&&s.startFrame!==a!.shots[i-1].endFrame)))add('shot-coverage','Shots must partition the full source timeline without gaps.');
  if(a.loudness.truePeak!==null&&a.loudness.truePeak>0)add('source-clipping','Source true peak exceeds 0 dBTP; audio preservation cannot repair clipping.');
  if(p.audio.mode==='preserve'&&a.loudness.integrated!==null&&Math.abs(a.loudness.integrated-p.audio.targetLufs)>2)add('loudness','Preserved mix differs from requested loudness target; optional normalization changes the mix.',undefined,'warning');
 }
 for(const color of [t.color.text,t.color.muted,t.color.accent,t.color.keyword,t.color.string])if(contrast(color,t.color.panel)<r.minContrast)add('contrast',`${color} fails ${r.minContrast}:1 on the ink surface.`);
 if(t.surface==='bare'&&p.cues.some(c=>cueText(c)))add('bare-contrast',`${t.name} sets type directly on footage; check every text cue frame against the actual shot, or use clean-tech solid strips.`,undefined,'warning');
 const sorted=[...p.cues].sort((x,y)=>x.startFrame-y.startFrame);const editorial=sorted.filter(c=>!ambient(c)&&c.component!=='kinetic-caption');
 for(const c of sorted){
  const duration=c.endFrame-c.startFrame,enter=frames(t.motion.in30,p.fps),exit=frames(t.motion.out30,p.fps);
  if(!['finishing','transition'].includes(c.component)&&!contains(safeBox(t,p.platform),c.box))add('safe-area','Cue lies outside the platform title-safe rectangle.',c.id);
  if(c.component!=='kinetic-caption'&&duration<=enter+exit)add('motion-duration','Cue must accommodate both entry and shorter exit.',c.id);
  const text=cueText(c),words=text.trim().split(/\s+/).filter(Boolean).length;
  if(text&&c.component!=='kinetic-caption'){
   const stagger=c.component==='list'?(c.props.items.length-1)*frames(t.motion.stagger30,p.fps):0;
   if(duration-enter-exit-stagger<readingFrames(words,p.fps,t))add('reading-time',`Allow at least ${readingFrames(words,p.fps,t)+enter+exit+stagger} frames including motion.`,c.id);
  }
  if(c.component==='kinetic-caption'){
   try{if(captionLines(c.props.words.map(w=>w.text),r.maxCaptionChars).length>r.maxCaptionLines)add('caption-wrap','Too many caption lines.',c.id);}catch(e){add('caption-wrap',String(e),c.id);}
   if(words/(duration/p.fps)>r.wordsPerSecond*2)add('caption-speed','Caption pace exceeds the configured speech-reading ceiling.',c.id);
  }
  if(c.component==='transition'){
   if(!a?.cuts.includes(c.props.cutFrame)||c.props.cutFrame===0||c.props.cutFrame===p.durationFrames)add('transition-cut','Transition must land on an existing internal cut.',c.id);
   if(duration>frames(t.motion.in30+t.motion.out30,p.fps))add('transition-duration','Keep transitions within one entry-plus-exit duration.',c.id);
   if(c.box.x!==0||c.box.y!==0||c.box.w!==1||c.box.h!==1)add('full-frame','Transition box must describe the full frame.',c.id);
  }
  if(c.component==='finishing'&&(c.box.x!==0||c.box.y!==0||c.box.w!==1||c.box.h!==1))add('full-frame','Finishing box must describe the full frame.',c.id);
  if(a){
   for(const region of a.regions.filter(b=>b.startFrame<c.endFrame&&b.endFrame>c.startFrame)){
    if(c.component==='finishing'){
     if(c.props.letterbox&& (overlaps(region.box,{x:0,y:0,w:1,h:t.letterbox})||overlaps(region.box,{x:0,y:1-t.letterbox,w:1,h:t.letterbox})))add('letterbox-overlap','Letterbox covers a protected region.',c.id);
    }else if(c.component==='transition'){
     if(region.kind==='face')add('transition-face','Avoid decorative cut transitions over faces.',c.id);
    }else if(overlaps(c.box,region.box,r.facePadding))add('protected-region',`Overlaps ${region.kind} in ${region.shotId}.`,c.id);
   }
   if(!ambient(c)&&c.component!=='transition'&&!c.allowAcrossCuts&&a.cuts.some(f=>f>c.startFrame&&f<c.endFrame))add('straddles-cut','Split cue at the cut or explicitly justify allowAcrossCuts.',c.id);
   if(!ambient(c)&&c.component!=='transition')for(const edge of [c.startFrame,c.endFrame])if(a.words.some(w=>edge>w.startFrame+r.snapToleranceFrames&&edge<w.endFrame-r.snapToleranceFrames))add('mid-word','A graphic edge splits a spoken word.',c.id);
   if(c.component==='kinetic-caption')for(const w of c.props.words)if(!a.words.some(x=>x.text===w.text&&Math.abs(x.startFrame-w.startFrame)<=r.snapToleranceFrames&&Math.abs(x.endFrame-w.endFrame)<=r.snapToleranceFrames))add('caption-source',`Caption word does not match transcript: ${w.text}`,c.id);
   if(c.source.kind==='transcript'&&!a.words.map(w=>w.text).join(' ').includes(c.source.reference))add('source-evidence','Transcript reference must be a verbatim contiguous excerpt.',c.id);
   if(c.sync.kind!=='none'){
    const targets=c.sync.kind==='cut'?a.cuts:c.sync.kind==='beat'?a.beats:a.words.map(w=>w.startFrame);
    if(!targets.some(f=>Math.abs(f-c.sync.frame)<=r.snapToleranceFrames))add('sync-target','Sync frame does not match its declared source.',c.id);
    if(!['kinetic-caption','transition'].includes(c.component)&&Math.abs(c.startFrame+enter-c.sync.frame)>r.snapToleranceFrames)add('sync-landing','Entry must settle within ±2 frames of the target.',c.id);
   }
  }
  if(p.platform==='youtube'&&c.endFrame>p.durationFrames-20*p.fps&&!['finishing','transition'].includes(c.component)&&t.endScreen.some(b=>overlaps(b,c.box)))add('end-screen','Reserve YouTube end-screen element areas in the final 20 seconds.',c.id);
 }
 for(let i=0;i<editorial.length;i++){
  const c=editorial[i];if(i&&c.startFrame-editorial[i-1].endFrame<r.minGapSeconds*p.fps)add('density-gap',`Leave ${r.minGapSeconds}s clean between non-caption graphics.`,c.id);
  if(editorial.filter(x=>x.startFrame>=c.startFrame&&x.startFrame<c.startFrame+10*p.fps).length>r.maxPer10s)add('density-window',`More than ${r.maxPer10s} starts in 10 seconds.`,c.id);
 }
 for(const c of sorted){const active=sorted.filter(x=>x.startFrame<=c.startFrame&&x.endFrame>c.startFrame&&!['finishing'].includes(x.component));if(active.length>r.maxSimultaneous)add('concurrency','More than two simultaneous information elements.',c.id);
  for(const x of active)if(x.id!==c.id&&!ambient(c)&&!ambient(x)&&c.component!=='transition'&&x.component!=='transition'&&overlaps(c.box,x.box))add('graphic-overlap',`Overlaps ${x.id}.`,c.id);
 }
 for(const c of sorted.filter(c=>c.component==='transition'))if(sorted.filter(x=>x.component==='transition'&&x.startFrame>=c.startFrame&&x.startFrame<c.startFrame+60*p.fps).length>r.maxTransitionsPerMinute)add('transition-density','Transition cap exceeded.',c.id);
 const firstNames=new Set<string>();for(const c of sorted)if(c.component==='lower-third'&&c.props.variant==='speaker'){if(firstNames.has(c.props.name))add('repeated-identity','Identify each speaker only once.',c.id);firstNames.add(c.props.name);}
 return findings;
}
export function assertQa(p:GraphicsPlan,a:Analysis){const findings=qaPlan(p,a);const errors=findings.filter(f=>f.severity==='error');if(errors.length)throw new Error(errors.map(f=>`${f.code} ${f.cue??''}: ${f.message}`).join('\n'));return findings;}
