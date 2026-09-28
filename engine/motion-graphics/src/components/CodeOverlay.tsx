import React from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import type {CueOf} from '../../schemas/graphics-plan';
import {Panel,Rule,Text,useMotion,type GraphicProps} from './shared';
export const CodeOverlay:React.FC<GraphicProps<CueOf<'code'>>>=({cue,tokens:t})=>{
 const m=useMotion(cue,t);const count=Math.floor(cue.props.code.length*m.progress);let offset=0;
 const render=(node:string|Prism.Token,index:number):React.ReactNode=>{
  if(typeof node==='string'){const start=offset;offset+=node.length;return <span key={index} style={{visibility:start<count?'visible':'hidden'}}>{node.slice(0,Math.max(0,count-start))}<span style={{visibility:'hidden'}}>{node.slice(Math.max(0,count-start))}</span></span>;}
  const children=typeof node.content==='string'?[node.content]:Array.isArray(node.content)?node.content:[node.content];
  return <span key={index} style={{color:['keyword','boolean','number'].includes(node.type)?t.color.keyword:['string','comment'].includes(node.type)?t.color.string:t.color.code}}>{children.map(render)}</span>;
 };
 return <Panel t={t} u={m.u} solid style={{width:'100%',padding:t.space.md*m.u}}><Text t={t} u={m.u} kind="label">{cue.props.title}</Text><Rule t={t} u={m.u}/><pre data-text style={{margin:0,fontFamily:t.fonts.mono,fontWeight:400,fontSize:t.type.small*m.u,lineHeight:t.type.lineHeight,whiteSpace:'pre-wrap',overflowWrap:'anywhere',color:t.color.code}}>{Prism.tokenize(cue.props.code,Prism.languages[cue.props.language]).map(render)}</pre></Panel>;
};
