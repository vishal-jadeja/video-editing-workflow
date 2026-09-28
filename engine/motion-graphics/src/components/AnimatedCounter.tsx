import React from 'react';
import {interpolate} from 'remotion';
import type {CueOf} from '../../schemas/graphics-plan';
import {easing} from '../tokens';
import {Panel,Text,useMotion,type GraphicProps} from './shared';
export const AnimatedCounter:React.FC<GraphicProps<CueOf<'counter'>>>=({cue,tokens:t})=>{
 const m=useMotion(cue,t);const hit=cue.sync.kind==='none'?m.enter:cue.sync.frame-cue.startFrame;
 const value=interpolate(m.frame,[0,Math.max(1,hit)],[cue.props.from,cue.props.to],{easing:easing(t.motion.entry),extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 return <Panel t={t} u={m.u} style={{gap:t.space.xs*m.u}}><Text t={t} u={m.u} kind="label">{cue.props.label}</Text><Text t={t} u={m.u} kind="counter" delay={t.motion.stagger30}>{cue.props.prefix}{value.toFixed(cue.props.decimals)}<span style={{color:t.color.accent}}>{cue.props.suffix}</span></Text></Panel>;
};
