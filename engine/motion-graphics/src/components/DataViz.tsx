import React from 'react';
import type {CueOf} from '../../schemas/graphics-plan';
import {Panel,Text,alpha,useMotion,useReveal,type GraphicProps} from './shared';
import type {Tokens} from '../tokens';
const Bar:React.FC<{t:Tokens;u:number;share:number;delay:number}>=({t,u,share,delay})=>{const p=useReveal(t,delay);return <div style={{width:'100%',height:t.space.xs*u,background:alpha(t.color.text,.15)}}><div style={{height:'100%',width:`${100*share*p}%`,background:t.color.accentFill}}/></div>;};
export const DataViz:React.FC<GraphicProps<CueOf<'data-viz'>>>=({cue,tokens:t})=>{
 const m=useMotion(cue,t),max=Math.max(1,...cue.props.items.map(i=>i.value)),s=t.motion.stagger30;return <Panel t={t} u={m.u}><Text t={t} u={m.u} kind="label">{cue.props.title}</Text>{cue.props.items.map((item,i)=><div key={i} style={{width:'100%',display:'flex',flexDirection:'column',gap:t.space.xs*m.u}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:t.space.sm*m.u}}><Text t={t} u={m.u} kind="small" delay={(i+1)*s}>{item.label}</Text><Text t={t} u={m.u} face="display" delay={(i+1)*s} style={{fontSize:t.type.body*1.2*m.u,fontVariantNumeric:'tabular-nums'}}>{item.value}{cue.props.unit}</Text></div><Bar t={t} u={m.u} share={item.value/max} delay={(i+1)*s}/></div>)}</Panel>;
};
