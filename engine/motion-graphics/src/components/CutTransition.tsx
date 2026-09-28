import React from 'react';
import {AbsoluteFill,random} from 'remotion';
import {easing} from '../tokens';
import type {CueOf} from '../../schemas/graphics-plan';
import {alpha,useMotion,type GraphicProps} from './shared';
/** Photographic, not graphic: warm film burn, blurred ink whip, ink wipe and faint scan tears. Never the accent colour. */
const burn=['#FF7A2E','#FFC46B'];
export const CutTransition:React.FC<GraphicProps<CueOf<'transition'>>>=({cue,tokens:t,plan})=>{
 const m=useMotion(cue,t),hit=cue.props.cutFrame-cue.startFrame;const strength=m.frame<=hit?easing(t.motion.entry)(Math.max(0,Math.min(1,m.frame/Math.max(1,hit)))):1-easing(t.motion.exit)(Math.max(0,Math.min(1,(m.frame-hit)/Math.max(1,m.duration-hit-1))));
 const travel=easing(t.motion.entry)(m.frame/Math.max(1,m.duration-1)),v=cue.props.variant;
 return <AbsoluteFill style={{opacity:strength*t.vignette,overflow:'hidden'}}>{v==='light-leak'?<AbsoluteFill style={{background:`radial-gradient(ellipse 60% 90% at ${15+travel*70}% 40%, ${burn[1]}, ${alpha(burn[0],.7)} 45%, ${alpha(burn[0],0)} 80%)`}}/>
  :v==='glitch'?Array.from({length:3},(_,i)=><div key={i} style={{position:'absolute',left:0,right:0,top:`${random(`${plan.seed}-${m.frame}-${i}`)*100}%`,height:Math.max(1,t.stroke*m.u),background:alpha(t.color.text,.6)}}/>)
  :<div style={{position:'absolute',top:0,bottom:0,left:0,width:`${v==='whip'?t.space.lg*300:100}%`,background:t.color.panel,filter:v==='whip'?`blur(${t.space.md*m.u}px)`:undefined,transform:`translateX(${(v==='whip'?travel*1.2-.2:travel*2-1)*m.width}px)`}}/>}</AbsoluteFill>;
};
