import React from 'react';
import {AbsoluteFill,random} from 'remotion';
import type {CueOf} from '../../schemas/graphics-plan';
import {useMotion,type GraphicProps} from './shared';
export const FinishingLayer:React.FC<GraphicProps<CueOf<'finishing'>>>=({cue,tokens:t,plan})=>{
 const m=useMotion(cue,t);return <AbsoluteFill style={{opacity:m.opacity,pointerEvents:'none'}}>{cue.props.vignette&&<AbsoluteFill style={{background:`radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,${t.vignette}) 100%)`}}/>}{cue.props.grain&&<svg width="100%" height="100%" viewBox={`0 0 ${m.width} ${m.height}`} style={{opacity:t.grain.opacity}}>{Array.from({length:t.grain.count},(_,i)=><rect key={i} x={random(`${plan.seed}-${m.frame}-${i}-x`)*m.width} y={random(`${plan.seed}-${m.frame}-${i}-y`)*m.height} width={t.grain.size*m.u} height={t.grain.size*m.u} fill={i%2?t.color.text:t.color.panel}/>)}</svg>}{cue.props.letterbox&&<><div style={{position:'absolute',top:0,width:'100%',height:`${t.letterbox*100}%`,background:t.color.panel}}/><div style={{position:'absolute',bottom:0,width:'100%',height:`${t.letterbox*100}%`,background:t.color.panel}}/></>}</AbsoluteFill>;
};
