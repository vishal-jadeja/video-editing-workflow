import React from 'react';
import type {CueOf} from '../../schemas/graphics-plan';
import {Panel,Text,alpha,useMotion,type GraphicProps} from './shared';
export const ProgressIndicator:React.FC<GraphicProps<CueOf<'progress'>>>=({cue,tokens:t,plan})=>{
 const m=useMotion(cue,t),frame=m.frame+cue.startFrame;const chapter=[...cue.props.chapters].reverse().find(c=>c.frame<=frame);const index=cue.props.chapters.indexOf(chapter??cue.props.chapters[0]);
 return <Panel t={t} u={m.u} style={{width:'100%',gap:t.space.xs*m.u}}><Text t={t} u={m.u} kind="label">{String(index+1).padStart(2,'0')} / {String(cue.props.chapters.length).padStart(2,'0')} — {chapter?.label??cue.props.chapters[0].label}</Text><div style={{height:Math.max(1,t.stroke*m.u),width:'100%',background:alpha(t.color.text,.25)}}><div style={{height:'100%',width:`${100*frame/Math.max(1,plan.durationFrames-1)}%`,background:t.color.accentFill}}/></div></Panel>;
};
