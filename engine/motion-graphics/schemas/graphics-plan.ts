import {z} from 'zod';
import {fontPairingNames} from '../src/tokens/typography';
import {boxSchema, frame, wordSchema} from './analysis';
const text=z.string().trim().min(1).max(400);
const asset=z.string().regex(/^[a-z0-9][a-z0-9_-]*$/);
const point=z.tuple([z.number().min(0).max(1),z.number().min(0).max(1)]);
const common={id:asset,startFrame:frame,endFrame:frame,job:z.enum(['identify','clarify','emphasize','navigate','convert','rhythm']),anchor:z.enum(['top-left','top-right','bottom-left','center','full']),box:boxSchema,layer:z.number().int().min(0).max(10),reason:text,priority:z.number().int().min(0).max(100),source:z.object({kind:z.enum(['transcript','brief']),reference:text}).strict(),sync:z.object({kind:z.enum(['word','cut','beat','none']),frame:frame}).strict(),allowAcrossCuts:z.boolean().default(false)};
const cue=<K extends string,T extends z.ZodRawShape>(component:K,props:T)=>z.object({...common,component:z.literal(component),props:z.object(props).strict()}).strict();
export const cueSchema=z.discriminatedUnion('component',[
 cue('kinetic-caption',{words:z.array(wordSchema).min(1).max(30),emphasis:z.array(z.number().int().nonnegative()).default([])}),
 cue('lower-third',{name:text,title:text.optional(),variant:z.enum(['speaker','tool','source']).default('speaker')}),
 cue('chapter-title',{title:text,kicker:text.optional(),depth:z.boolean().default(false)}),
 cue('callout',{label:text,shape:z.enum(['arrow','circle','box','line']),points:z.array(point).min(2).max(20)}),
 cue('counter',{from:z.number().default(0),to:z.number(),decimals:z.number().int().min(0).max(3).default(0),prefix:z.string().max(12).default(''),suffix:z.string().max(20).default(''),label:text}),
 cue('data-viz',{title:text,items:z.array(z.object({label:text,value:z.number().nonnegative()})).min(2).max(5),unit:z.string().max(15).default('')}),
 cue('list',{title:text,items:z.array(text).min(1).max(5)}),
 cue('quote',{quote:text,attribution:text}),
 cue('code',{code:z.string().min(1).max(1500),language:z.enum(['javascript','typescript','json','bash']),title:text}),
 cue('camera-move',{assetId:asset,mode:z.enum(['push','ken-burns','punch']),focus:point}),
 cue('transition',{variant:z.enum(['light-leak','whip','match','glitch']),cutFrame:frame}),
 cue('progress',{chapters:z.array(z.object({frame:frame,label:text})).min(1)}),
 cue('cta',{text,secondary:text.optional(),endScreen:z.boolean().default(false)}),
 cue('finishing',{grain:z.boolean().default(true),vignette:z.boolean().default(true),letterbox:z.boolean().default(false)}),
 cue('lottie',{assetId:asset,loop:z.boolean().default(false)}),
]);
export const planSchema=z.object({version:z.literal(1),slug:asset,fontPairing:z.enum(fontPairingNames).optional(),preset:z.enum(['clean-tech','cinematic-doc','high-energy-shorts']),platform:z.enum(['youtube','shorts','reels','tiktok']),width:z.number().int().min(64),height:z.number().int().min(64),fps:z.number().positive().max(120),durationFrames:z.number().int().positive(),seed:z.string().min(1),audio:z.object({mode:z.enum(['preserve','normalize','sfx']),targetLufs:z.number().min(-24).max(-9).default(-14),sfx:z.array(z.object({cueId:asset,event:z.enum(['in','out']),kind:z.enum(['whoosh','click','pop','riser']),gain:z.number().min(0).max(.25)})).default([])}).strict(),assets:z.array(z.object({id:asset,path:z.string().min(1).refine(p=>!p.startsWith('/')&&!p.includes('..')&&!p.includes('://'),'Use a project-relative path'),kind:z.enum(['image','lottie']),license:text,credit:text})),rules:z.object({maxPer10s:z.number().int().positive().optional(),minGapSeconds:z.number().min(0).optional(),maxSimultaneous:z.number().int().min(1).max(2).optional()}).strict().default({}),needsInput:z.array(text),cues:z.array(cueSchema)}).strict().superRefine((p,ctx)=>{
 const issue=(message:string)=>ctx.addIssue({code:'custom',message});
 const ids=new Set<string>(); const assets=new Set(p.assets.map(a=>a.id));
 if(assets.size!==p.assets.length)issue('Duplicate asset IDs');
 if(p.width%2||p.height%2)issue('Delivery dimensions must be even');
 if(p.audio.mode!=='sfx'&&p.audio.sfx.length)issue('SFX events require audio.mode=sfx');
 for(const c of p.cues){
  if(ids.has(c.id))issue(`Duplicate cue ${c.id}`);ids.add(c.id);
  if(c.endFrame<=c.startFrame||c.endFrame>p.durationFrames)issue(`${c.id}: invalid frame interval`);
  if(c.sync.kind!=='none'&&(c.sync.frame<c.startFrame||c.sync.frame>=c.endFrame))issue(`${c.id}: sync outside cue`);
  if(c.component==='kinetic-caption')for(const [i,w] of c.props.words.entries()){
   if(w.startFrame<c.startFrame||w.endFrame>c.endFrame)issue(`${c.id}: word outside cue`);
   if(i&&w.startFrame<c.props.words[i-1].endFrame)issue(`${c.id}: overlapping or unordered words`);
  }
  if(c.component==='kinetic-caption'&&c.props.emphasis.some(i=>i>=c.props.words.length))issue(`${c.id}: emphasis index outside words`);
  if(c.component==='transition'&&(c.props.cutFrame<c.startFrame||c.props.cutFrame>=c.endFrame))issue(`${c.id}: cut outside transition`);
  if((c.component==='lottie'||c.component==='camera-move')&&!assets.has(c.props.assetId))issue(`${c.id}: missing asset`);
  if(c.component==='lottie'||c.component==='camera-move'){
   const a=p.assets.find(a=>a.id===c.props.assetId);if(a&&a.kind!==(c.component==='lottie'?'lottie':'image'))issue(`${c.id}: wrong asset kind`);
  }
  if(c.component==='progress'&&c.props.chapters.some((x,i)=>x.frame>=p.durationFrames||(i>0&&x.frame<=c.props.chapters[i-1].frame)))issue(`${c.id}: invalid chapter frames`);
 }
 for(const e of p.audio.sfx)if(!ids.has(e.cueId))issue(`SFX references missing cue ${e.cueId}`);
});
export type GraphicsPlan=z.infer<typeof planSchema>;
export type Cue=z.infer<typeof cueSchema>;
export type CueOf<K extends Cue['component']>=Extract<Cue,{component:K}>;
