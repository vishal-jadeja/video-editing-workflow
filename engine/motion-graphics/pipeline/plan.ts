import type {Analysis} from '../schemas/analysis';
import {planSchema,type Cue,type GraphicsPlan} from '../schemas/graphics-plan';
import {anchorBox,frames,presets,readingFrames,type PresetName,type Platform} from '../src/tokens';
import {overlaps} from './qa';
export type SemanticCandidate={kind:string;startFrame:number;endFrame:number;text:string;priority:number};
/** Evidence-preserving candidate tags; speaker identity and implied claims remain human tasks. */
export function semanticPass(a:Analysis):SemanticCandidate[]{
 const groups:typeof a.words[]=[];let group:typeof a.words=[];
 for(const w of a.words){group.push(w);if(/[.!?]$/.test(w.text)||group.length>=16){groups.push(group);group=[];}}if(group.length)groups.push(group);
 return groups.flatMap(words=>{
  const text=words.map(w=>w.text).join(' '),tags:[string,RegExp,number][]=[['number',/\b\d+(?:\.\d+)?%?\b/,85],['list',/\b(first|second|third|steps|reasons)\b/i,65],['comparison',/\b(versus|compared|instead|faster|slower)\b/i,80],['quote',/\b(remember|the point|the key|what matters)\b/i,70],['chapter',/\b(next|finally|moving on|let.s talk)\b/i,70],['tool',/\b(React|Next\.js|TypeScript|Python|Docker|GitHub|ChatGPT|Claude|FFmpeg)\b/i,55],['cta',/\b(subscribe|follow|try it|comment below|check out)\b/i,90],['punchline',/\b(plot twist|turns out|surprise)\b/i,40],['identity',/\b(my name is|I.m called|I am called)\b/i,80]];
  const found=tags.filter(([,r])=>r.test(text)).map(([kind,,priority])=>({kind,startFrame:words[0].startFrame,endFrame:words.at(-1)!.endFrame,text,priority}));
  if(words[0].startFrame<5*a.source.fps)found.push({kind:'hook',startFrame:words[0].startFrame,endFrame:words.at(-1)!.endFrame,text,priority:95});return found;
 });
}
export function draftPlan(a:Analysis,slug:string,preset:PresetName='clean-tech',platform:Platform='youtube'):{plan:GraphicsPlan;candidates:SemanticCandidate[]}{
 const t=presets[preset],fps=a.source.fps,enter=frames(t.motion.in30,fps),exit=frames(t.motion.out30,fps);const candidates=semanticPass(a);const cues:Cue[]=[];
 for(const candidate of [...candidates].sort((x,y)=>y.priority-x.priority)){
  if(candidate.kind==='identity'||candidate.kind==='punchline')continue;
  const words=a.words.filter(w=>w.startFrame>=candidate.startFrame&&w.endFrame<=candidate.endFrame);const phrase=words.slice(0,6).map(w=>w.text).join(' ');if(!phrase)continue;
  const shot=a.shots.find(s=>s.startFrame<=candidate.startFrame&&s.endFrame>candidate.startFrame);if(!shot)continue;
  const target=words.find(w=>w.startFrame>=shot.startFrame+enter);if(!target)continue;
  const start=target.startFrame-enter;let end=start+enter+readingFrames(phrase.split(/\s+/).length,fps,t)+exit;
  const split=a.words.find(w=>end>w.startFrame&&end<w.endFrame);if(split)end=split.endFrame;
  if(end>shot.endFrame||cues.some(c=>start<c.endFrame+t.rules.minGapSeconds*fps&&end>c.startFrame-t.rules.minGapSeconds*fps))continue;
  const positions=(['top-left','top-right','bottom-left','center'] as const).map(anchor=>({anchor,box:anchorBox(anchor,a.source.height>a.source.width,t,platform)}));
  const position=positions.find(({box})=>!a.regions.some(r=>r.startFrame<end&&r.endFrame>start&&overlaps(box,r.box,t.rules.facePadding))&&!(platform==='youtube'&&end>a.source.durationFrames-20*fps&&t.endScreen.some(b=>overlaps(box,b))));if(!position)continue;
  const common={id:`cue-${candidate.startFrame}`,startFrame:start,endFrame:end,job:candidate.kind==='cta'?'convert' as const:'emphasize' as const,...position,layer:1,reason:`${candidate.kind} candidate: preserve the exact spoken wording; review the semantic choice.`,priority:candidate.priority,source:{kind:'transcript' as const,reference:phrase},sync:{kind:'word' as const,frame:target.startFrame},allowAcrossCuts:false};
  const cue:Cue=candidate.kind==='cta'?{...common,component:'cta',props:{text:phrase,endScreen:false}}:{...common,component:'chapter-title',props:{title:phrase,depth:false}};
  if(cues.some(c=>c.id===cue.id))continue;
  const trial=[...cues,cue];if(trial.some(c=>trial.filter(x=>x.startFrame>=c.startFrame&&x.startFrame<c.startFrame+10*fps).length>t.rules.maxPer10s))continue;cues.push(cue);
 }
 const plan=planSchema.parse({version:1,slug,preset,platform,width:a.source.width,height:a.source.height,fps,durationFrames:a.source.durationFrames,seed:slug,audio:{mode:'preserve',targetLufs:t.audio.lufs,sfx:[]},assets:[],rules:{},needsInput:[],cues:cues.sort((a,b)=>a.startFrame-b.startFrame)});return{plan,candidates};
}
