import React from 'react';
import {interpolate,useCurrentFrame,useVideoConfig} from 'remotion';
import {designUnit,easing,frames,type Tokens} from '../tokens';
import type {Cue,GraphicsPlan} from '../../schemas/graphics-plan';
export type GraphicProps<C extends Cue=Cue>={cue:C;tokens:Tokens;plan:GraphicsPlan};
export function useMotion(cue:Cue,t:Tokens){
 const frame=useCurrentFrame(),{fps,width,height}=useVideoConfig();const duration=cue.endFrame-cue.startFrame;
 const enter=frames(t.motion.in30,fps),exit=frames(t.motion.out30,fps);
 const progress=duration===1?1:interpolate(frame,[0,enter],[0,1],{easing:easing(t.motion.entry),extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 const leave=duration===1?0:interpolate(frame,[Math.min(duration-2,Math.max(enter,duration-exit-1)),duration-1],[0,1],{easing:easing(t.motion.exit),extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 return {frame,fps,width,height,u:designUnit(width,height),enter,exit,progress,opacity:progress*(1-leave),remaining:1-leave,duration};
}
type Kind='title'|'body'|'caption'|'small'|'counter'|'label';
/** 8-digit hex with alpha; tokens are 6-digit hex. */
export const alpha=(hex:string,a:number)=>`${hex}${Math.round(Math.max(0,Math.min(1,a))*255).toString(16).padStart(2,'0')}`;
/** Eased 0→1 entry for one element, starting `delay30` frames (at 30 fps) after the cue. */
export function useReveal(t:Tokens,delay30=0){
 const frame=useCurrentFrame(),{fps}=useVideoConfig();const start=Math.round(delay30*fps/30);
 return interpolate(frame,[start,start+frames(t.motion.in30,fps)],[0,1],{easing:easing(t.motion.entry),extrapolateLeft:'clamp',extrapolateRight:'clamp'});
}
/** Bare surfaces keep type legible with a glyph-hugging soft shadow, not a visible box or blob. */
export const legibility=(t:Tokens)=>t.surface==='bare'?`0 0 .5em ${alpha(t.color.panel,.5)}, 0 .02em .08em ${alpha(t.color.panel,.65)}`:undefined;
/** Text rises out of a line mask (clipped only while it moves), so holds never clip glyphs. */
export const Text:React.FC<{children:React.ReactNode;t:Tokens;u:number;kind?:Kind;muted?:boolean;accent?:boolean;face?:'display'|'body'|'mono';delay?:number;style?:React.CSSProperties}>=({children,t,u,kind='body',muted=false,accent=false,face,delay=0,style})=>{
 const p=useReveal(t,delay);const f=face??(kind==='label'?'mono':['title','counter'].includes(kind)?'display':'body');
 // Tight display leading lets glyph boxes hang below the line; the bottom pad keeps them inside the measured box.
 const font=f==='display'?{fontFamily:t.fonts.display,fontWeight:t.fonts.displayWeight,fontStyle:t.fonts.displayStyle,lineHeight:t.type.displayLineHeight,letterSpacing:`${t.type.displayTracking}em`,paddingBottom:'.2em',marginBottom:'-.2em'}
  :f==='mono'?{fontFamily:t.fonts.mono,fontWeight:400,fontStyle:'normal' as const,lineHeight:1.3,letterSpacing:`${kind==='label'?t.type.labelTracking:0}em`,textTransform:kind==='label'?'uppercase' as const:undefined}
  :{fontFamily:t.fonts.body,fontWeight:t.fonts.weight,fontStyle:t.fonts.bodyStyle,lineHeight:t.type.lineHeight,letterSpacing:`${t.type.tracking}em`};
 return <div style={{fontSize:t.type[kind]*u,overflow:p<1?'hidden':'visible',padding:'.12em 0',margin:'-.12em 0'}}><div data-text style={{...font,fontVariantNumeric:kind==='counter'?'tabular-nums':undefined,color:accent?t.color.accent:muted||(kind==='label'&&t.surface==='solid')?t.color.muted:t.color.text,opacity:kind==='label'&&t.surface==='bare'?.88:undefined,textShadow:legibility(t),overflowWrap:'anywhere',transform:p<1?`translateY(${(1-p)*110}%)`:undefined,...style}}>{children}</div></div>;
};
/** Hairline that draws left to right. */
export const Rule:React.FC<{t:Tokens;u:number;delay?:number;accent?:boolean}>=({t,u,delay=0,accent=false})=>{const p=useReveal(t,delay);return <div style={{height:Math.max(1,t.stroke*u),width:`${p*100}%`,background:accent?t.color.accentFill:alpha(t.color.text,.5)}}/>;};
/** `solid`: flat square ink strip hugging its content. `bare`: bare type on footage (legibility comes from the glyph shadow). */
export const Panel:React.FC<{children:React.ReactNode;t:Tokens;u:number;align?:'start'|'center';solid?:boolean;style?:React.CSSProperties}>=({children,t,u,align='start',solid,style})=>{
 const center=align==='center',flat=solid??t.surface==='solid';
 return <div data-panel style={{boxSizing:'border-box',display:'flex',flexDirection:'column',justifyContent:'center',alignItems:center?'center':'flex-start',textAlign:center?'center':'left',gap:t.space.sm*u,
  ...(flat?{width:'fit-content',maxWidth:'100%',alignSelf:center?'center':'flex-start',padding:`${t.space.sm*u}px ${t.space.md*u}px`,background:t.color.panel}
   :{width:'100%',padding:t.space.sm*u}),...style}}>{children}</div>;
};
export function cueText(c:Cue):string{
 switch(c.component){
 case 'kinetic-caption':return c.props.words.map(w=>w.text).join(' ');
 case 'lower-third':return [c.props.name,c.props.title].filter(Boolean).join(' ');
 case 'chapter-title':return [c.props.kicker,c.props.title].filter(Boolean).join(' ');
 case 'callout':return c.props.label;
 case 'counter':return `${c.props.to}${c.props.suffix} ${c.props.label}`;
 case 'data-viz':return [c.props.title,...c.props.items.map(i=>`${i.label} ${i.value}${c.props.unit}`)].join(' ');
 case 'list':return [c.props.title,...c.props.items].join(' ');
 case 'quote':return `${c.props.quote} ${c.props.attribution}`;
 case 'code':return `${c.props.title} ${c.props.code}`;
 case 'cta':return [c.props.text,c.props.secondary].filter(Boolean).join(' ');
 default:return '';
 }
}
