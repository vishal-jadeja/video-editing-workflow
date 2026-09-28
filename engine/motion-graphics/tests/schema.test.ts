import {describe,it,expect} from 'vitest';
import {planSchema} from '../schemas/graphics-plan';
import {examplePlan,analysisFor,componentNames,componentPlan} from './fixtures';
import {qaPlan,contrast} from '../pipeline/qa';
import {presets} from '../src/tokens';
import {draftPlan,semanticPass} from '../pipeline/plan';
import {compositeArgs,approvalDigest} from '../pipeline/render';
describe('plan contract',()=>{
 it('accepts the fictional 60 second example and every registered vocabulary item',()=>{expect(planSchema.parse(examplePlan()).durationFrames).toBe(1800);for(const c of componentNames)expect(planSchema.safeParse(componentPlan(c)).success).toBe(true);});
 it('rejects malformed timing, unknown styling, duplicate IDs and missing assets',()=>{
  for(const mutate of [(p:ReturnType<typeof examplePlan>)=>p.cues[0].endFrame=0,(p:ReturnType<typeof examplePlan>)=>p.cues.push(p.cues[0]),(p:ReturnType<typeof examplePlan>)=>(p.cues[0].props as Record<string,unknown>).color='red',(p:ReturnType<typeof examplePlan>)=>p.cues[0].box.x=.99]){const p=examplePlan();mutate(p);expect(planSchema.safeParse(p).success).toBe(false);}
  const p=componentPlan('lottie');p.assets=[];expect(planSchema.safeParse(p).success).toBe(false);
 });
 it('rejects transcript words outside cue intervals',()=>{const p=componentPlan('kinetic-caption');if(p.cues[0].component==='kinetic-caption')p.cues[0].props.words[0].startFrame=200;expect(planSchema.safeParse(p).success).toBe(false);});
 it('allows no arbitrary CSS or side effects in JSON',()=>{const p=examplePlan();expect(planSchema.safeParse({...p,style:{fontSize:80}}).success).toBe(false);});
});
describe('editorial QA',()=>{
 it('catches faces, subject UI and unsafe portrait placement',()=>{const p=examplePlan(),a=analysisFor(p);a.regions.push({shotId:'s1',startFrame:0,endFrame:1800,kind:'face',box:p.cues[0].box,confidence:1,origin:'human'});expect(qaPlan(p,a).some(f=>f.code==='protected-region')).toBe(true);p.platform='shorts';p.cues[0].box.y=.01;expect(qaPlan(p,a).some(f=>f.code==='safe-area')).toBe(true);});
 it('requires review and detects mid-word, cuts and unreadably brief graphics',()=>{const p=examplePlan(),a=analysisFor(p);a.shots[0].reviewed=false;a.cuts=[0,100,1800];a.words=[{text:'workflow',startFrame:20,endFrame:40}];p.cues[0].endFrame=110;const codes=qaPlan(p,a).map(f=>f.code);expect(codes).toEqual(expect.arrayContaining(['shot-review','mid-word','straddles-cut','reading-time']));});
 it('detects density collisions and absent sync evidence',()=>{const p=examplePlan(),a=analysisFor(p);p.cues[1].startFrame=40;p.cues[1].sync={kind:'beat',frame:50};expect(qaPlan(p,a).map(f=>f.code)).toEqual(expect.arrayContaining(['density-gap','sync-target']));});
 it('uses purple only as the single accent, never for ink, text or code',()=>{const hue=(hex:string)=>{const [r,g,b]=hex.replace('#','').match(/../g)!.map(x=>parseInt(x,16)/255),max=Math.max(r,g,b),d=max-Math.min(r,g,b);if(d<.08)return -1;const h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;return (h*60+360)%360;};const purple=(c:string)=>hue(c)>=250&&hue(c)<=330;for(const t of Object.values(presets))for(const [k,c] of Object.entries(t.color))if(!['accent','accentFill'].includes(k))expect(purple(c),`${t.name} ${k} ${c}`).toBe(false);});
 it('keeps accent fills visible as non-text graphics (3:1)',()=>{for(const t of Object.values(presets))expect(contrast(t.color.accentFill,t.color.panel)).toBeGreaterThanOrEqual(3);});
 it('keeps every preset text and accent above 4.5:1',()=>{for(const t of Object.values(presets))for(const c of [t.color.text,t.color.muted,t.color.accent,t.color.keyword,t.color.string])expect(contrast(c,t.color.panel)).toBeGreaterThanOrEqual(4.5);});
 it('invalidates approvals when source analysis or engine changes',()=>{const p=examplePlan(),a=analysisFor(p),d=approvalDigest(p,a,'engine',{});p.cues[0].reason='Changed review rationale';expect(approvalDigest(p,a,'engine',{})).not.toBe(d);expect(approvalDigest(p,a,'v2',{})).not.toBe(d);});
 it('never invents a semantic quote or identity',()=>{const p=examplePlan(),a=analysisFor(p);a.words='Next try TypeScript for 3 steps.'.split(' ').map((text,i)=>({text,startFrame:300+i*30,endFrame:320+i*30}));const candidates=semanticPass(a);expect(candidates.map(c=>c.kind)).toEqual(expect.arrayContaining(['chapter','tool','number','list']));for(const c of draftPlan(a,'demo').plan.cues)expect(a.words.map(w=>w.text).join(' ')).toContain(c.source.reference);});
 it('preserves source audio and avoids retiming options in final encode',()=>{const p=examplePlan(),s=analysisFor(p).source,args=compositeArgs(s,'overlay.mov','out.mov');expect(args).toEqual(expect.arrayContaining(['-c:a','copy','-fps_mode','passthrough']));expect(args).not.toContain('-r');expect(args).not.toContain('-shortest');});
});

describe('typography selection',()=>{
 it('accepts only registered pairings and keeps the plan free of arbitrary font CSS',()=>{
  const p=examplePlan();expect(planSchema.safeParse({...p,fontPairing:'script-humanist'}).success).toBe(true);expect(planSchema.safeParse({...p,fontPairing:'unlicensed-download'}).success).toBe(false);
 });
});
