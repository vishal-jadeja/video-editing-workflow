import React from 'react';
import {OffthreadVideo,staticFile,useCurrentFrame} from 'remotion';
import camera from './generated/camera.json';
import episode from './generated/episode.json';
import {C,mono,sans,label,Scene,move} from './theme';
import {ApproachLabel,ComplexityLine,ArrayTiles,Tile,CodePanel,SetBox} from './components';
import {SceneContent} from './scenes';

export type LayoutMode='facecam'|'overlay'|'split'|'graphics';
type Clip={available:boolean;src:string|null;trimBefore:number;zoom:number;objectPosition:string;splitObjectPosition:string};
type Beat={scene:string;mode:LayoutMode;startFrame:number;endFrame:number;localFrame:number};
const clips=camera.scenes as Record<string,Clip>;
const beats=camera.layouts as Beat[];
export const layoutAt=(s:Scene,frame:number)=>beats.find(b=>b.scene===s.id&&s.startFrame+frame>=b.startFrame&&s.startFrame+frame<b.endFrame)!;

// Video time is scene-local + the scene's source offset. Layout cuts never restart it.
export const FaceCam:React.FC<{scene:Scene;split:boolean}>=({scene,split})=>{
  const clip=clips[scene.id];
  const box=split?{left:60,top:320,width:860,height:390}:{left:0,top:0,width:1080,height:1920};
  return <div style={{position:'absolute',...box,overflow:'hidden',background:split?C.panel:'transparent',border:split?`1px solid ${C.line}`:undefined,boxSizing:'border-box'}}>
    {clip.available&&clip.src?<OffthreadVideo src={staticFile(clip.src)} trimBefore={clip.trimBefore} muted style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:split?clip.splitObjectPosition:clip.objectPosition,transform:`scale(${clip.zoom})`}}/>:<>
      <svg viewBox={split?'0 0 860 390':'0 0 1080 1920'} width="100%" height="100%" style={{position:'absolute'}}>
        {split?<><ellipse cx="430" cy="150" rx="72" ry="86" fill="#313640"/><path d="M235 390 Q242 262 355 245 Q430 288 505 245 Q618 262 625 390" fill="#282D36"/></>:<><ellipse cx="490" cy="615" rx="153" ry="188" fill="#292E38"/><path d="M110 1370 Q108 930 332 853 Q490 936 648 853 Q885 927 896 1370" fill="#20252E"/></>}
      </svg>
      <div style={{position:'absolute',left:split?24:60,top:split?24:326,fontFamily:mono,fontSize:split?21:25,color:C.muted,letterSpacing:2}}>FACE CAM</div>
      <div style={{position:'absolute',left:split?24:60,top:split?62:365,fontFamily:mono,fontSize:split?17:20,color:'#626A77'}}>placeholder</div>
    </>}
  </div>;
};

const Text:React.FC<{children:React.ReactNode;top:number;color?:string;size?:number}>=({children,top,color=C.text,size=32})=><div style={{position:'absolute',left:60,top,width:860,textAlign:'center',fontFamily:mono,fontSize:size,color}}>{children}</div>;

// Reflow the teaching elements at full width; never scale an entire code panel down.
const SplitGraphics:React.FC<{s:Scene;t:number}>=({s,t})=>{
  if(s.id==='problem'){
    const unique=t>=s.cues.false;const found=t>=s.cues.true;
    return <><div style={{position:'absolute',left:60,top:758,fontSize:56,fontWeight:700,letterSpacing:'-.045em'}}>Any number twice?</div><ArrayTiles values={unique?[1,2,3,4]:episode.array} top={890} duplicate={found&&!unique?[0,3]:[]}/><Text top={1112}>nums = {unique?'[1,2,3,4]':'[1,2,3,1]'} <span style={{color:C.text}}>→ {unique?'false':'true'}</span></Text><Text top={1234} color={C.muted} size={26}>{unique?'every number unique':'at least one repeat'}</Text></>;
  }
  if(s.id==='better'){
    const p=move(t,s.cues.sort,.3),positions=[0,2,3,1],dup=t>=s.cues.duplicate;
    return <><div style={{position:'absolute',left:60,top:750}}><ApproachLabel label={s.label!} color={s.color!}/><ComplexityLine time={s.time!} space={s.space!} color={s.color!}/></div>{episode.array.map((v,i)=><Tile key={i} value={v} index={p===1?positions[i]:i} duplicate={dup&&(i===0||i===3)} style={{left:196+(i+(positions[i]-i)*p)*152,top:943-Math.sin(p*Math.PI)*(i===3?48:0)}}/>)}<Text top={1153} color={dup?C.violetText:C.muted}>{dup?'1 == 1 → return True':'sorted(nums)'}</Text><Text top={1245} color={C.muted} size={25}>compare adjacent values</Text></>;
  }
  if(s.id==='optimal')return <><div style={{position:'absolute',left:60,top:750}}><ApproachLabel label={s.label!} color={s.color!}/><ComplexityLine time={s.time!} space={s.space!} color={s.color!}/></div><ArrayTiles values={episode.earlyArray} size={120} top={932}/><SetBox top={1140}/></>;
  if(s.id==='cta')return <><Text top={900} size={54}>Follow for <span style={{color:C.violetText}}>Part {episode.part+1}</span></Text><Text top={1040} size={24} color={C.muted}><span style={label}>NeetCode 150 · one problem at a time</span></Text></>;
  const duplicate=s.id==='brute'?t>=s.cues.found:t>=s.cues.duplicate;
  return <><div style={{position:'absolute',left:60,top:750}}>{s.label?<><ApproachLabel label={s.label} color={s.color!}/><ComplexityLine time={s.time!} space={s.space!} color={s.color!}/></>:<div style={{fontSize:56,fontWeight:700,letterSpacing:'-.045em'}}>Spot the duplicate.</div>}</div><ArrayTiles values={s.id==='one'?episode.earlyArray:episode.array} size={s.id==='one'?120:132} top={943} duplicate={duplicate?[0,3]:[]}/><Text top={1160} color={C.muted}>{s.id==='one'?'a set keeps unique values':duplicate?'duplicate found':'compare the numbers'}</Text></>;
};

const OverlayGraphics:React.FC<{s:Scene;t:number}>=({s,t})=>{
  if(s.id==='hook')return <><div style={{position:'absolute',left:60,top:920,width:860,background:C.bg,padding:'25px 0',textAlign:'center',fontSize:56,fontWeight:700,letterSpacing:'-.045em'}}>Spot the <span style={{color:t>=s.cues.duplicate?C.violetText:C.text}}>duplicate.</span></div><ArrayTiles values={episode.array} top={1040} duplicate={t>=s.cues.duplicate?[0,3]:[]}/></>;
  if(s.id==='one')return <><div style={{position:'absolute',left:60,top:926,width:860,background:C.bg,padding:'20px 24px',boxSizing:'border-box'}}><ApproachLabel label="the one-liner" color={C.text}/></div><CodePanel code={s.code!} line={1} top={1028}/><div style={{position:'absolute',left:60,top:1215,width:860,background:C.bg,padding:'15px 0',textAlign:'center',fontFamily:mono,fontSize:30}}>{t>=s.cues.shrinks?<><span style={{color:C.violetText}}>99,999</span> != 100,000 → True</>:t>=s.cues.drops?'a set keeps unique values':'len(set(nums)) != len(nums)'}</div></>;
  return <><div style={{position:'absolute',left:60,top:730,width:860,height:590,background:C.bg}}/><SplitGraphics s={s} t={t}/></>;
};

export const EditorialScene:React.FC<{s:Scene}>=({s})=>{
  const frame=useCurrentFrame(),t=frame/30;
  const beat=layoutAt(s,frame);
  if(beat.mode==='graphics')return <SceneContent s={s}/>;
  const enter=move((frame-beat.localFrame)/30,0,.2);
  return <><FaceCam scene={s} split={beat.mode==='split'}/>
    <div style={{position:'absolute',inset:0,opacity:enter}}>
      {beat.mode==='split'&&<SplitGraphics s={s} t={t}/>}
      {beat.mode==='overlay'&&<OverlayGraphics s={s} t={t}/>}
      {beat.mode==='facecam'&&s.id==='cta'&&<div style={{position:'absolute',left:60,top:1080,width:860,textAlign:'center',background:C.bg,padding:'30px 0'}}><div style={{fontSize:72,fontWeight:700,letterSpacing:'-.045em'}}>Follow for <span style={{color:C.violetText}}>Part {episode.part+1}</span></div><div style={{...label,fontSize:24,color:C.muted,marginTop:24}}>NeetCode 150 · one problem at a time</div></div>}
    </div>
  </>;
};
