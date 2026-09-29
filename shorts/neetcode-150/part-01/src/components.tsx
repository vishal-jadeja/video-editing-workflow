import React from 'react';
import {AbsoluteFill,Img,staticFile,useCurrentFrame} from 'remotion';
import {C,mono,sans,label,glyphShadow,move,Scene,Word} from './theme';
import assets from './generated/assets.json';
import episode from './generated/episode.json';

// Static print texture: light falloff, embossed paper relief, faint two-scale grid on the 60px layout grid, vignette.
// SVG turbulence is seeded and frame-independent, so every frame renders identically.
export const Background:React.FC=()=> <AbsoluteFill style={{background:`radial-gradient(120% 70% at 20% 0%, #1B1C1E 0%, ${C.bg} 55%, #08090A 100%)`,color:C.text,fontFamily:sans}}>
  <svg width="1080" height="1920" style={{position:'absolute',mixBlendMode:'soft-light',opacity:.5}}><filter id="paper" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="5" seed="4"/><feDiffuseLighting lightingColor="#fff" surfaceScale="2.2"><feDistantLight azimuth="45" elevation="58"/></feDiffuseLighting></filter><rect width="1080" height="1920" filter="url(#paper)"/></svg>
  <svg width="1080" height="1920" style={{position:'absolute'}}><filter id="mottle"><feTurbulence type="fractalNoise" baseFrequency=".004" numOctaves="3" seed="3"/><feColorMatrix type="matrix" values="0 0 0 0 .96  0 0 0 0 .95  0 0 0 0 .93  1 0 0 0 -.42"/></filter><rect width="1080" height="1920" filter="url(#mottle)" opacity=".1"/></svg>
  <AbsoluteFill style={{backgroundImage:'linear-gradient(to right,rgba(244,242,237,.07) 1px,transparent 1px),linear-gradient(to bottom,rgba(244,242,237,.07) 1px,transparent 1px),linear-gradient(to right,rgba(244,242,237,.03) 1px,transparent 1px),linear-gradient(to bottom,rgba(244,242,237,.03) 1px,transparent 1px)',backgroundSize:'120px 120px,120px 120px,60px 60px,60px 60px',backgroundPosition:'60px 0,60px 0,60px 0,60px 0'}}/>
  <AbsoluteFill style={{background:'radial-gradient(140% 90% at 50% 40%, transparent 60%, rgba(0,0,0,.5) 100%)'}}/>
</AbsoluteFill>;

/** Text rises out of a line mask; the mask only clips while it moves. */
export const Reveal:React.FC<{p:number;children:React.ReactNode}>=({p,children})=><div style={{overflow:p<1?'hidden':'visible',padding:'.1em 0',margin:'-.1em 0'}}><div style={{transform:p<1?`translateY(${(1-p)*110}%)`:undefined}}>{children}</div></div>;

export const ProblemCard:React.FC<{part:number;title:string}>=({part,title})=> {
  const t=useCurrentFrame()/30;const kicker=move(t,3),head=move(t,3.08),rule=move(t,3.16,.4);
  return <div style={{position:'absolute',left:60,top:86,width:860}}>
    <Reveal p={kicker}><div style={{display:'flex',justifyContent:'space-between',...label,fontSize:24}}><span>NeetCode 150 · Part {String(part).padStart(2,'0')}</span><span style={{color:C.muted}}>{episode.difficulty}</span></div></Reveal>
    <div style={{height:1,marginTop:18,width:`${rule*100}%`,background:C.line}}/>
    <div style={{marginTop:22}}><Reveal p={head}><div style={{fontSize:76,fontWeight:700,letterSpacing:'-.045em',lineHeight:1}}>{title}</div></Reveal></div>
  </div>;
};
export const ApproachLabel:React.FC<{label:string;color:string}>=({label:text,color})=><div style={{display:'flex',alignItems:'center',gap:16,...label,fontSize:30,lineHeight:1.3,color:C.text}}><span style={{width:14,height:14,background:color,flexShrink:0}}/>{text}</div>;
export const ComplexityLine:React.FC<{time:string;space:string;color:string}>=({time,space})=><div style={{fontFamily:mono,fontSize:28,marginTop:18,whiteSpace:'nowrap',color:C.muted}}><span style={{color:C.text}}>{time}</span> time · <span style={{color:C.text}}>{space}</span> space</div>;
export const ApproachHeader:React.FC<{scene:Scene}>=({scene})=><div style={{position:'absolute',left:60,top:346}}><ApproachLabel label={scene.label!} color={scene.color!}/><ComplexityLine time={scene.time!} space={scene.space!} color={scene.color!}/></div>;

export const Tile:React.FC<{value:number|string;index?:number|string;size?:number;duplicate?:boolean;active?:boolean;style?:React.CSSProperties}>=({value,index,size=132,duplicate=false,active=false,style})=><div style={{position:'absolute',width:size,height:size,...style}}>
  <div style={{width:size,height:size,boxSizing:'border-box',background:duplicate?'rgba(123,77,255,.14)':C.faint,border:duplicate?`3px solid ${C.violet}`:active?`2px solid ${C.text}`:`1.5px solid ${C.line}`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:sans,fontSize:typeof value==='number'&&value>999?30:Math.round(size*.46),fontWeight:400,letterSpacing:'-.02em',fontVariantNumeric:'tabular-nums'}}>{value}</div>
  {index!==undefined&&<div style={{textAlign:'center',fontFamily:mono,fontSize:21,color:C.muted,marginTop:12}}>{index}</div>}
</div>;
export const ArrayTiles:React.FC<{values:(number|string)[];top?:number;duplicate?:number[];active?:number[];opacity?:number[];size?:number}>=({values,top=555,duplicate=[],active=[],opacity=[],size=132})=>{
  const gap=20;const start=60+(860-values.length*size-(values.length-1)*gap)/2;
  return <>{values.map((v,i)=><Tile key={i} value={v} index={v==='…'?'…':i===5?'99999':i} size={size} duplicate={duplicate.includes(i)} active={active.includes(i)} style={{left:start+i*(size+gap),top,opacity:opacity[i]??1}}/>)}</>;
};
export const Pointer:React.FC<{x:number;y:number;label:string;color:string}>=({x,y,label,color})=><div style={{position:'absolute',left:x-20,top:y,fontFamily:mono,fontSize:30,color,width:40,textAlign:'center'}}><div>{label}</div><div style={{width:2,height:23,background:color,margin:'7px auto 0'}}/></div>;
export const SetBox:React.FC<{children?:React.ReactNode;error?:boolean;top?:number}>=({children,error=false,top=790})=><div style={{position:'absolute',left:168,top,width:644,height:150,border:error?`3px solid ${C.violet}`:`1.5px solid ${C.line}`,background:C.faint,boxSizing:'border-box',padding:22}}><div style={{fontFamily:mono,fontSize:27,color:C.muted}}>seen = set()</div>{children}</div>;

// Monochrome syntax: keywords recede, the approach colour marks only the active line.
function tokens(line:string){return line.split(/(\b(?:def|return|for|in|if|True|False)\b)/g).map((s,i)=><span key={i} style={{color:/^(def|return|for|in|if)$/.test(s)?C.muted:C.text}}>{s}</span>);}
export const CodePanel:React.FC<{code:string;line:number;top?:number;color?:string}>=({code,line,top=980,color=C.violet})=><div style={{position:'absolute',left:60,top,width:860,background:C.panel,border:`1px solid ${C.line}`,padding:'20px 14px 22px',boxSizing:'border-box'}}>
  <div style={{...label,color:C.muted,fontSize:18,margin:'0 0 14px 15px'}}>Python</div>
  {code.split('\n').map((text,i)=><div key={i} style={{display:'flex',height:37,alignItems:'center',fontFamily:mono,fontSize:23,lineHeight:'37px',whiteSpace:'pre',background:line===i?'rgba(244,242,237,.06)':'transparent',borderLeft:`3px solid ${line===i?color:'transparent'}`}}><span style={{display:'inline-block',width:35,flexShrink:0,color:C.muted,fontSize:18,textAlign:'center',marginRight:10}}>{i+1}</span><span>{tokens(text)}</span></div>)}
</div>;

export function captionGroups(words:Word[]){
  const groups:Word[][]=[];let group:Word[]=[];
  for(let i=0;i<words.length;i++){
    group.push(words[i]);
    const chars=group.map(w=>w.word).join(' ').length;
    if(group.length>=4||(group.length>=2&&(/[.!?:,]$/.test(words[i].word)||chars>20))){groups.push(group);group=[];}
  }
  if(group.length===1&&groups.length&&groups.at(-1)!.length<4)groups.at(-1)!.push(...group);else if(group.length)groups.push(group);
  return groups;
}
// Words land on their spoken onset (short rise) and never change colour; no karaoke highlight, no backdrop box.
export const Captions:React.FC<{scene:Scene;t:number;backdrop?:boolean}>=({scene,t,backdrop=false})=>{
  const groups=captionGroups(scene.words);
  const group=groups.find((g,i)=>t>=g[0].start&&t<(groups[i+1]?.[0].start??g.at(-1)!.end+.15));
  if(!group)return null;
  return <div style={{position:'absolute',left:60,top:1370,width:860,minHeight:140,display:'flex',alignItems:'flex-start',justifyContent:'center',alignContent:'flex-start',gap:'0 17px',flexWrap:'wrap',fontSize:62,fontWeight:700,lineHeight:1.17,textAlign:'center',letterSpacing:'-.03em',textShadow:backdrop?glyphShadow:undefined}}>{group.map((w,i)=>{const p=i===0?1:move(t,w.start-.1,.13);return <span key={i} style={{display:'inline-block',opacity:p,transform:`translateY(${(1-p)*.2}em)`}}>{w.word}</span>;})}</div>;
};

export const EndCard:React.FC<{t:number}>=({t})=><div style={{position:'absolute',left:60,top:440,width:860,textAlign:'center',opacity:move(t,0)}}>
  <div style={{width:240,height:240,border:`1.5px solid ${C.line}`,borderRadius:'50%',margin:'0 auto 60px',overflow:'hidden',background:C.panel,display:'flex',alignItems:'center',justifyContent:'center'}}>{assets.avatar?<Img src={staticFile('avatar.png')} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontFamily:mono,color:C.muted,fontSize:26}}>your photo</span>}</div>
  <div style={{fontSize:76,fontWeight:700,lineHeight:1.05,letterSpacing:'-.045em'}}>Follow for <span style={{color:C.violetText}}>Part {episode.part+1}</span></div>
  <div style={{height:1,width:120,background:C.line,margin:'40px auto'}}/>
  <div style={{...label,fontSize:24,color:C.muted}}>NeetCode 150 · one problem at a time</div>
</div>;
