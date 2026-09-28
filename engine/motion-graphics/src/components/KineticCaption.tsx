import React from 'react';
import {interpolate} from 'remotion';
import {Panel,legibility,useMotion,type GraphicProps} from './shared';
import type {CueOf} from '../../schemas/graphics-plan';
import {easing} from '../tokens';
export function captionLines(words:string[],max:number):number[][]{
 const lines:number[][]=[[]];let length=0;
 words.forEach((w,i)=>{if(w.length>max)throw new Error(`Caption word exceeds ${max} characters: ${w}`);if(length+w.length+(length?1:0)>max){lines.push([]);length=0;}lines.at(-1)!.push(i);length+=w.length+(length?1:0);});return lines;
}
/** Words land as they are spoken (a 4-frame rise that settles on the word's first frame); layout never reflows.
 * Emphasis words switch to the pairing's accent face in the accent colour instead of karaoke highlighting; a contrasting
 * accent face (serif) also steps up in size, a same-family accent changes only weight and colour. */
export const KineticCaption:React.FC<GraphicProps<CueOf<'kinetic-caption'>>>=({cue,tokens:t})=>{
 const m=useMotion(cue,t),abs=m.frame+cue.startFrame;const lines=captionLines(cue.props.words.map(w=>w.text),t.rules.maxCaptionChars);
 if(lines.length>t.rules.maxCaptionLines)throw new Error('Split captions into shorter cues; maximum line count exceeded');
 return <Panel t={t} u={m.u} align="center"><div data-text style={{fontFamily:t.fonts.body,fontSize:t.type.caption*m.u,fontWeight:t.fonts.weight,fontStyle:t.fonts.bodyStyle,lineHeight:1.18,letterSpacing:`${t.type.tracking}em`,color:t.color.text,textShadow:legibility(t),textAlign:'center',paddingBottom:'.2em',marginBottom:'-.2em'}}>{lines.map((line,i)=><div key={i}>{line.map((index,j)=>{
  const w=cue.props.words[index],p=w.startFrame<=cue.startFrame?1:interpolate(abs,[w.startFrame-3,w.startFrame+1],[0,1],{easing:easing(t.motion.entry),extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const em=cue.props.emphasis.includes(index);
  return <React.Fragment key={index}>{j>0?' ':null}<span style={{display:'inline-block',opacity:p,transform:`translateY(${(1-p)*.25}em)`,...(em?{fontFamily:t.fonts.accent,fontWeight:t.fonts.accentWeight,fontStyle:t.fonts.accentStyle,letterSpacing:0,fontSize:t.fonts.accent===t.fonts.body?'1em':'1.3em',lineHeight:.9,color:t.color.accent}:{})}}>{w.text}</span></React.Fragment>;
 })}</div>)}</div></Panel>;
};
