import React,{useCallback,useRef} from 'react';
import type {CueOf} from '../../schemas/graphics-plan';
import {useGsapTimeline,customEase} from '../hooks/useGsapTimeline';
import {Panel,Rule,Text,useMotion,type GraphicProps} from './shared';
/** `depth` adds a focus pull: the title settles from a slight blur and scale, like a lens racking in. */
export const ChapterTitle:React.FC<GraphicProps<CueOf<'chapter-title'>>>=({cue,tokens:t})=>{
 const m=useMotion(cue,t); const ref=useRef<HTMLDivElement>(null);const s=t.motion.stagger30;
 const build=useCallback((tl:gsap.core.Timeline)=>{tl.fromTo('[data-title]',{filter:`blur(${cue.props.depth?t.motion.focusBlur*m.u:0}px)`,scale:cue.props.depth?1.04:1},{filter:'blur(0px)',scale:1,duration:m.enter*1.5/m.fps,ease:customEase(t),immediateRender:true},0);},[t,m.u,m.enter,m.fps,cue.props.depth]);
 useGsapTimeline(ref,build);
 return <div ref={ref} style={{width:'100%'}}><Panel t={t} u={m.u}>{cue.props.kicker&&<Text t={t} u={m.u} kind="label">{cue.props.kicker}</Text>}<div data-title style={{transformOrigin:'0% 100%'}}><Text t={t} u={m.u} kind="title" delay={s}>{cue.props.title}</Text></div><Rule t={t} u={m.u} delay={s*2} accent/></Panel></div>;
};
