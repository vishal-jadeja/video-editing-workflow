import React from 'react';
import type {CueOf} from '../../schemas/graphics-plan';
import {Panel,Text,useMotion,type GraphicProps} from './shared';
export const QuoteCard:React.FC<GraphicProps<CueOf<'quote'>>>=({cue,tokens:t})=>{const m=useMotion(cue,t);return <Panel t={t} u={m.u}><Text t={t} u={m.u} face="display" style={{fontSize:t.type.title*.8*m.u}}><span style={{color:t.color.accent}}>“</span>{cue.props.quote}<span style={{color:t.color.accent}}>”</span></Text><Text t={t} u={m.u} kind="label" delay={t.motion.stagger30*2}>— {cue.props.attribution}</Text></Panel>;};
