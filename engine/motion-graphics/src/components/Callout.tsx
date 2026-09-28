import React from 'react';
import type {CueOf} from '../../schemas/graphics-plan';
import {Text,useMotion,type GraphicProps} from './shared';
export const Callout:React.FC<GraphicProps<CueOf<'callout'>>>=({cue,tokens:t})=>{
 const m=useMotion(cue,t),{points,shape}=cue.props;
 const w=cue.box.w*m.width,h=cue.box.h*m.height;
 const coords=points.map(([x,y])=>[x*w,y*h]);const [a,b]=coords;
 const d=coords.map(([x,y],i)=>`${i?'L':'M'} ${x} ${y}`).join(' ');
 const props={fill:'none',stroke:t.color.accentFill,strokeWidth:Math.max(1.5,t.stroke*1.2*m.u),strokeLinecap:'square' as const,pathLength:1,strokeDasharray:1,strokeDashoffset:1-m.progress};
 return <div style={{width:'100%',height:'100%'}}><div style={{position:'absolute',left:t.space.sm*m.u,top:t.space.sm*m.u,maxWidth:`calc(100% - ${t.space.sm*2*m.u}px)`,boxSizing:'border-box',background:t.color.panel,padding:`${t.space.xs*m.u}px ${t.space.sm*m.u}px`}}><Text t={t} u={m.u} kind="label" style={{color:t.color.text,textShadow:'none'}}>{cue.props.label}</Text></div><svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`}><defs><marker id={`arrow-${cue.id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10" fill="none" stroke={t.color.accentFill} strokeWidth={1.5}/></marker></defs>{shape==='circle'?<ellipse {...props} cx={(a[0]+b[0])/2} cy={(a[1]+b[1])/2} rx={Math.abs(b[0]-a[0])/2} ry={Math.abs(b[1]-a[1])/2}/>:shape==='box'?<rect {...props} x={Math.min(a[0],b[0])} y={Math.min(a[1],b[1])} width={Math.abs(b[0]-a[0])} height={Math.abs(b[1]-a[1])}/>:<path {...props} d={d} markerEnd={shape==='arrow'?`url(#arrow-${cue.id})`:undefined}/>}</svg></div>;
};
