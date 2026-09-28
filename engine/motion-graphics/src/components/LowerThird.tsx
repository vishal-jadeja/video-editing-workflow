import React from 'react';
import type {CueOf} from '../../schemas/graphics-plan';
import {Panel,Rule,Text,useMotion,type GraphicProps} from './shared';
const prefix={speaker:'',tool:'Tool — ',source:'Source — '} as const;
export const LowerThird:React.FC<GraphicProps<CueOf<'lower-third'>>>=({cue,tokens:t})=>{
 const m=useMotion(cue,t),s=t.motion.stagger30;return <Panel t={t} u={m.u}><Text t={t} u={m.u} face="display" style={{fontSize:t.type.body*1.35*m.u}}>{cue.props.name}</Text><Rule t={t} u={m.u} delay={s}/>{cue.props.title&&<Text t={t} u={m.u} kind="label" delay={s*2}>{prefix[cue.props.variant]}{cue.props.title}</Text>}</Panel>;
};
