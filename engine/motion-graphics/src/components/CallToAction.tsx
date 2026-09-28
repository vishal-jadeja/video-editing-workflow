import React from 'react';
import type {CueOf} from '../../schemas/graphics-plan';
import {Panel,Text,useMotion,type GraphicProps} from './shared';
export const CallToAction:React.FC<GraphicProps<CueOf<'cta'>>>=({cue,tokens:t})=>{const m=useMotion(cue,t);return <Panel t={t} u={m.u}><Text t={t} u={m.u} kind="title">{cue.props.text}</Text>{cue.props.secondary&&<Text t={t} u={m.u} kind="label" delay={t.motion.stagger30*2}><span style={{color:t.color.accent}}>→ </span>{cue.props.secondary}</Text>}</Panel>;};
