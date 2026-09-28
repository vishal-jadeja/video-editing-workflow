import React from 'react';
import type {CueOf} from '../../schemas/graphics-plan';
import {Panel,Rule,Text,useMotion,type GraphicProps} from './shared';
export const ListReveal:React.FC<GraphicProps<CueOf<'list'>>>=({cue,tokens:t})=>{
 const m=useMotion(cue,t),s=t.motion.stagger30;return <Panel t={t} u={m.u} style={{gap:t.space.xs*m.u}}><Text t={t} u={m.u} kind="label">{cue.props.title}</Text>{cue.props.items.map((item,i)=><div key={i} style={{width:'100%',display:'flex',flexDirection:'column',gap:t.space.xs*m.u}}><Rule t={t} u={m.u} delay={(i+1)*s}/><div style={{display:'flex',alignItems:'baseline',gap:t.space.sm*m.u}}><Text t={t} u={m.u} kind="label" delay={(i+1)*s}>{String(i+1).padStart(2,'0')}</Text><Text t={t} u={m.u} face="body" delay={(i+1)*s} style={{fontSize:t.type.body*1.25*m.u}}>{item}</Text></div></div>)}</Panel>;
};
