import React,{createContext,useContext,useRef} from 'react';
import {AbsoluteFill,Sequence} from 'remotion';
import {planSchema,type GraphicsPlan} from '../../schemas/graphics-plan';
import {resolveTokens} from '../tokens';
import {Graphic} from '../components/Graphic';
import {useMotion,type GraphicProps} from '../components/shared';
import {useLayoutAudit} from '../hooks/useLayoutAudit';
export const LayoutAuditContext=createContext(false);
import {useFonts} from '../hooks/useFonts';
const CueShell:React.FC<GraphicProps>=(p)=>{
 const {cue,tokens:t}=p;const m=useMotion(cue,t);const ref=useRef<HTMLDivElement>(null);const audit=useContext(LayoutAuditContext);useLayoutAudit(ref,audit&&m.frame>=m.enter&&m.frame<m.duration-m.exit,cue.id,m.frame);
 if(cue.component==='finishing'||cue.component==='transition')return <AbsoluteFill data-cue={cue.id} style={{zIndex:cue.layer}}><Graphic {...p}/></AbsoluteFill>;
 return <div ref={ref} data-cue={cue.id} style={{position:'absolute',left:cue.box.x*m.width,top:cue.box.y*m.height,width:cue.box.w*m.width,height:cue.box.h*m.height,overflow:'hidden',zIndex:cue.layer}}><div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:cue.anchor==='bottom-left'?'flex-end':'flex-start',opacity:cue.component==='kinetic-caption'?m.remaining:m.opacity}}><Graphic {...p}/></div></div>;
};
export const Overlay:React.FC<{plan:GraphicsPlan}>=({plan:input})=>{
 const plan=planSchema.parse(input),tokens=resolveTokens(plan.preset,plan.fontPairing);const ready=useFonts(tokens);if(!ready)return null;return <AbsoluteFill>{[...plan.cues].sort((a,b)=>a.layer-b.layer).map(cue=><Sequence key={cue.id} from={cue.startFrame} durationInFrames={cue.endFrame-cue.startFrame} layout="none"><CueShell cue={cue} tokens={tokens} plan={plan}/></Sequence>)}</AbsoluteFill>;
};
