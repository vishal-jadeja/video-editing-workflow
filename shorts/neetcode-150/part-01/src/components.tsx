import React from 'react';
import {AbsoluteFill,Img,staticFile,useCurrentFrame} from 'remotion';
import {C,mono,sans,move,Scene,Word} from './theme';
import assets from './generated/assets.json';
import episode from './generated/episode.json';

export const Background:React.FC=()=> <AbsoluteFill style={{background:C.bg,color:C.text,fontFamily:sans}}>
  <AbsoluteFill style={{background:'radial-gradient(ellipse 760px 720px at 50% 0%, rgba(42,15,92,0.36), transparent 80%)'}}/>
  <svg width="1080" height="1920" style={{position:'absolute',opacity:.15}}><defs><pattern id="dots" width="36" height="36" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#818793"/></pattern></defs><rect width="1080" height="1920" fill="url(#dots)"/></svg>
</AbsoluteFill>;

export const ProblemCard:React.FC<{part:number;title:string}>=({part,title})=> {
  const t=useCurrentFrame()/30;const p=move(t,3);
  return <div style={{position:'absolute',left:60,top:82,width:860,height:202,boxSizing:'border-box',padding:'30px 30px',background:C.panel,borderLeft:`5px solid ${C.violet}`,borderRadius:6,opacity:p,transform:`translateY(${(1-p)*-35}px)`}}>
    <div style={{fontSize:25,fontWeight:700,letterSpacing:2,color:C.violet}}>NEETCODE 150 · PART {part}</div>
    <div style={{fontSize:48,fontWeight:900,letterSpacing:-1.6,marginTop:22}}>{title}</div>
    <div style={{position:'absolute',right:28,top:31,fontFamily:mono,color:C.green,fontSize:24}}>EASY</div>
  </div>;
};
export const ApproachLabel:React.FC<{label:string;color:string}>=({label,color})=><div style={{borderLeft:`4px solid ${color}`,paddingLeft:20,fontFamily:mono,fontSize:40,lineHeight:1.3,color}}># {label}</div>;
export const ComplexityLine:React.FC<{time:string;space:string;color:string}>=({time,space,color})=><div style={{fontFamily:mono,fontSize:30,marginTop:20,whiteSpace:'nowrap'}}><span style={{color}}>{time}</span> time · <span style={{color}}>{space}</span> space</div>;
export const ApproachHeader:React.FC<{scene:Scene}>=({scene})=><div style={{position:'absolute',left:60,top:346}}><ApproachLabel label={scene.label!} color={scene.color!}/><ComplexityLine time={scene.time!} space={scene.space!} color={scene.color!}/></div>;

export const Tile:React.FC<{value:number|string;index?:number|string;size?:number;duplicate?:boolean;active?:boolean;style?:React.CSSProperties}>=({value,index,size=132,duplicate=false,active=false,style})=><div style={{position:'absolute',width:size,height:size,...style}}>
  <div style={{width:size,height:size,boxSizing:'border-box',borderRadius:5,background:C.panel,border:`${duplicate?4:2}px solid ${duplicate?C.red:active?C.violet:'transparent'}`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:mono,fontSize:typeof value==='number'&&value>999?25:50,fontWeight:600}}>{value}</div>
  {index!==undefined&&<div style={{textAlign:'center',fontFamily:mono,fontSize:21,color:C.muted,marginTop:12}}>{index}</div>}
</div>;
export const ArrayTiles:React.FC<{values:(number|string)[];top?:number;duplicate?:number[];active?:number[];opacity?:number[];size?:number}>=({values,top=555,duplicate=[],active=[],opacity=[],size=132})=>{
  const gap=20;const start=60+(860-values.length*size-(values.length-1)*gap)/2;
  return <>{values.map((v,i)=><Tile key={i} value={v} index={v==='…'?'…':i===5?'99999':i} size={size} duplicate={duplicate.includes(i)} active={active.includes(i)} style={{left:start+i*(size+gap),top,opacity:opacity[i]??1}}/>)}</>;
};
export const Pointer:React.FC<{x:number;y:number;label:string;color:string}>=({x,y,label,color})=><div style={{position:'absolute',left:x-20,top:y,fontFamily:mono,fontSize:30,color,width:40,textAlign:'center'}}><div>{label}</div><div style={{width:2,height:23,background:color,margin:'7px auto 0'}}/></div>;
export const SetBox:React.FC<{children?:React.ReactNode;error?:boolean;top?:number}>=({children,error=false,top=790})=><div style={{position:'absolute',left:168,top,width:644,height:150,border:`3px dashed ${error?C.red:C.violet}`,borderRadius:5,boxSizing:'border-box',padding:22}}><div style={{fontFamily:mono,fontSize:27,color:C.violet}}>seen = set()</div>{children}</div>;

function tokens(line:string){return line.split(/(\b(?:def|return|for|in|if|True|False)\b|\b\d+\b|\b(?:len|range|set|sorted)\b)/g).map((s,i)=><span key={i} style={{color:/^(def|return|for|in|if|True|False)$/.test(s)?C.violet:/^\d+$/.test(s)?C.amber:C.text}}>{s}</span>);}
export const CodePanel:React.FC<{code:string;line:number;top?:number;color?:string}>=({code,line,top=980,color=C.violet})=><div style={{position:'absolute',left:60,top,width:860,background:C.panel,borderRadius:6,padding:'20px 14px 22px',boxSizing:'border-box'}}>
  <div style={{fontFamily:mono,color:C.muted,fontSize:18,margin:'0 0 14px 15px',letterSpacing:2}}>PYTHON</div>
  {code.split('\n').map((text,i)=><div key={i} style={{display:'flex',height:37,alignItems:'center',fontFamily:mono,fontSize:23,lineHeight:'37px',whiteSpace:'pre',background:line===i?'#252932':'transparent',borderLeft:`3px solid ${line===i?color:'transparent'}`}}><span style={{display:'inline-block',width:35,flexShrink:0,color:C.muted,fontSize:18,textAlign:'center',marginRight:10}}>{i+1}</span><span>{tokens(text)}</span></div>)}
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
export const Captions:React.FC<{scene:Scene;t:number;backdrop?:boolean}>=({scene,t,backdrop=false})=>{
  const groups=captionGroups(scene.words);
  const group=groups.find((g,i)=>t>=g[0].start&&t<(groups[i+1]?.[0].start??g.at(-1)!.end+.15));
  if(!group)return null;
  return <div style={{position:'absolute',left:60,top:1370,width:860,minHeight:140,background:backdrop?C.bg:undefined,borderRadius:6,display:'flex',alignItems:'flex-start',justifyContent:'center',alignContent:'flex-start',gap:'0 17px',flexWrap:'wrap',fontSize:62,fontWeight:700,lineHeight:1.17,textAlign:'center',letterSpacing:-1.5}}>{group.map((w,i)=><span key={i} style={{color:t>=w.start&&t<w.end?C.violet:C.text}}>{w.word}</span>)}</div>;
};

export const EndCard:React.FC<{t:number}>=({t})=><div style={{position:'absolute',left:60,top:440,width:860,textAlign:'center',opacity:move(t,0)}}>
  <div style={{width:240,height:240,border:`5px solid ${C.violet}`,borderRadius:'50%',margin:'0 auto 60px',overflow:'hidden',background:C.panel,display:'flex',alignItems:'center',justifyContent:'center'}}>{assets.avatar?<Img src={staticFile('avatar.png')} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontFamily:mono,color:C.muted,fontSize:26}}>your photo</span>}</div>
  <div style={{fontSize:72,fontWeight:900,lineHeight:1.08,letterSpacing:-3}}>Follow for <span style={{color:C.violet}}>Part {episode.part+1}</span></div>
  <div style={{marginTop:36,fontSize:31,color:C.text}}>NeetCode 150 · one problem at a time</div>
  <div style={{height:4,width:90,background:C.violet,margin:'55px auto'}}/>
</div>;
