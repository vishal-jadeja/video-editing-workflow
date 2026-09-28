import React from 'react';
import {Img,interpolate,staticFile} from 'remotion';
import type {CueOf} from '../../schemas/graphics-plan';
import {easing} from '../tokens';
import {useMotion,type GraphicProps} from './shared';
export const CameraMove:React.FC<GraphicProps<CueOf<'camera-move'>>>=({cue,tokens:t,plan})=>{
 const m=useMotion(cue,t);const asset=plan.assets.find(a=>a.id===cue.props.assetId)!;
 const p=interpolate(m.frame,[0,cue.props.mode==='punch'?m.enter:m.duration-1],[0,1],{easing:easing(t.motion.entry),extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 return <div style={{width:'100%',height:'100%',overflow:'hidden'}}><Img src={staticFile(`projects/${plan.slug}/${asset.path}`)} style={{width:'100%',height:'100%',objectFit:'cover',transformOrigin:`${cue.props.focus[0]*100}% ${cue.props.focus[1]*100}%`,transform:`scale(${1+(t.stillScale-1)*p}) translateX(${cue.props.mode==='ken-burns'?t.motion.distance*m.u*p:0}px)`}}/></div>;
};
