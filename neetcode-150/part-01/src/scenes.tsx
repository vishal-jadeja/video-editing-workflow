import React from 'react';
import {useCurrentFrame} from 'remotion';
import {C,mono,move,clamp,Scene} from './theme';
import {ApproachHeader,ArrayTiles,Tile,Pointer,CodePanel,SetBox,EndCard} from './components';
import episode from './generated/episode.json';

const Note:React.FC<{children:React.ReactNode;top?:number;color?:string;size?:number}>=({children,top=825,color=C.text,size=31})=><div style={{position:'absolute',left:60,top,width:860,textAlign:'center',fontFamily:mono,fontSize:size,color,lineHeight:1.5}}>{children}</div>;

export const Hook:React.FC<{s:Scene;t:number}>=({s,t})=>{
  const duplicate=t>=s.cues.duplicate;const wall=move(t,s.cues.wall,.28);
  return <>
    <div style={{position:'absolute',left:60,top:358,fontSize:70,fontWeight:900,letterSpacing:-2,lineHeight:1.1}}>Spot the<br/><span style={{color:duplicate?C.red:C.text}}>duplicate.</span></div>
    <div style={{opacity:1-wall}}><ArrayTiles values={episode.array} top={657} duplicate={duplicate?[0,3]:[]}/><Note top={890} color={C.muted}>four numbers. one repeat.</Note></div>
    <div style={{position:'absolute',left:60,top:594,width:860,height:610,overflow:'hidden',opacity:wall}}>
      {Array.from({length:90},(_,i)=>{const row=Math.floor(i/9);return <div key={i} style={{position:'absolute',left:(i%9)*97,top:row*89-((t-s.cues.wall)*95)%89,width:79,height:69,borderRadius:4,background:C.panel,fontFamily:mono,fontSize:23,color:i%13===0?C.violet:C.muted,display:'flex',alignItems:'center',justifyContent:'center'}}>{(i*7919+Math.floor(t*8)*17)%100000}</div>;})}
      <div style={{position:'absolute',left:90,right:90,top:190,padding:'30px 10px',background:C.bg,textAlign:'center',fontFamily:mono,fontSize:76,fontWeight:600}}>100,000<div style={{fontSize:28,color:C.muted,marginTop:12}}>numbers. fast.</div></div>
    </div>
  </>;
};

export const Problem:React.FC<{s:Scene;t:number}>=({s,t})=>{
  const unique=t>=s.cues.false;const found=t>=s.cues.true;
  return <>
    <div style={{position:'absolute',left:60,top:370,fontFamily:mono,fontSize:30,color:C.muted}}>// the problem</div>
    <div style={{position:'absolute',left:60,top:441,fontSize:59,fontWeight:900,letterSpacing:-2}}>Any number twice?</div>
    <ArrayTiles values={unique?[1,2,3,4]:episode.array} top={611} duplicate={found&&!unique?[0,3]:[]}/>
    <Note top={835} size={32}>nums = {unique?'[1,2,3,4]':'[1,2,3,1]'} <span style={{color:unique?C.red:C.green}}>→ {unique?'false':'true'}</span></Note>
    <div style={{position:'absolute',left:60,top:1020,width:860,borderTop:'1px solid #363A45',paddingTop:30,display:'flex',justifyContent:'space-between',fontFamily:mono,fontSize:28}}><span style={{color:C.muted}}>{unique?'every number unique':'at least one repeat'}</span><span style={{color:unique?C.red:C.green}}>return {unique?'False':'True'}</span></div>
  </>;
};

export const Brute:React.FC<{s:Scene;t:number}>=({s,t})=>{
  const start=s.cues.compare,finish=s.cues.found;const interval=(finish-start)/3;
  const j=1+Math.min(2,Math.max(0,Math.floor((t-start)/interval)));
  const lastJ=1+Math.min(2,Math.max(0,Math.floor((t-start-.24)/interval)));
  const phaseStart=start+Math.max(0,j-1)*interval;
  const xpos=328+(lastJ-1)*152+(j-lastJ)*152*move(t,phaseStart);
  const found=t>=finish,scale=t>=s.cues.scale,spin=move(t,s.cues.billions,.65);
  const count=scale?Math.round(3+(4999950000-3)*spin):Math.max(0,t<start?0:j);
  return <><ApproachHeader scene={s}/>
    <ArrayTiles values={episode.array} duplicate={found?[0,3]:[]} active={t>=start&&!found?[0,j]:[]}/>
    <Pointer x={262} y={480} label="i" color={C.violet}/><Pointer x={xpos+86} y={480} label="j" color={C.text}/>
    <Note top={785} color={C.muted} size={25}>{scale?'worst case · n(n − 1) / 2':'pair comparisons'}</Note>
    <Note top={828} size={scale?65:67} color={scale?C.red:C.text}>{count.toLocaleString('en-US')}</Note>
    <CodePanel code={s.code!} line={found?5:t>=start?4:2} color={C.red}/>
  </>;
};

export const Better:React.FC<{s:Scene;t:number}>=({s,t})=>{
  const p=move(t,s.cues.sort,.3);const positions=[0,2,3,1];const dup=t>=s.cues.duplicate;
  const neighbor=t>=s.cues.neighbours;const pair=Math.min(2,Math.floor(Math.max(0,t-s.cues.sorted)*3/(s.cues.duplicate-s.cues.sorted)));
  return <><ApproachHeader scene={s}/>
    {episode.array.map((v,i)=><Tile key={i} value={v} index={p===1?positions[i]:i} duplicate={dup&&(i===0||i===3)} active={!dup&&p===1&&(positions[i]===pair||positions[i]===pair+1)} style={{left:196+(i+(positions[i]-i)*p)*152,top:570-Math.sin(p*Math.PI)*(i===3?68:0)}}/>)}
    <div style={{position:'absolute',left:205,top:767,width:266,height:3,background:dup?C.red:C.amber,opacity:p}}/>
    <Note top={823} color={dup?C.red:C.muted}>{dup?'1 == 1  →  return True':p<1?'sort(nums)':'adjacent values'}</Note>
    <CodePanel code={s.code!} line={dup?4:p<1?1:neighbor?3:2} color={C.amber}/>
  </>;
};

export const OneLiner:React.FC<{s:Scene;t:number}>=({s,t})=>{
  const compression=move(t,s.cues.set,.28);const early=t>=s.cues.early;
  const scan=clamp((t-s.cues.scan)/(s.cues.end+1.3-s.cues.scan));
  const scanStarted=t>=s.cues.scan;
  const endLabel=scan>=.999?'100,000 / 100,000':`${Math.round(scan*100000).toLocaleString('en-US')} / 100,000`;
  return <><ApproachHeader scene={s}/>
    <div style={{position:'absolute',left:60,top:503,fontFamily:mono,fontSize:24,color:C.muted}}>nums</div>
    <ArrayTiles values={episode.earlyArray} top={555} size={120} duplicate={early?[0,1]:[]}/>
    {compression>0&&compression<1&&episode.earlyArray.map((v,i)=><Tile key={i} value={v} size={120} style={{left:80+i*140+(350+i*57-(80+i*140))*compression,top:555+282*compression,transform:`scale(${1-compression*.55})`,opacity:Math.sin(compression*Math.PI)*(i===1?1-compression:1)}}/>)}
    <div style={{position:'absolute',left:80,top:735,width:820,height:7,background:C.panel}}><div style={{height:7,width:`${scan*100}%`,background:C.violet}}/></div>
    <Note top={766} size={23} color={scanStarted?C.violet:C.muted}>{scanStarted?endLabel:'6 shown · 100,000 total'}</Note>
    <div style={{position:'absolute',left:60,top:837,width:860,textAlign:'center',opacity:compression,transform:`translateY(${(1-compression)*-35}px)`}}>
      <div style={{fontFamily:mono,fontSize:32}}>set(nums) = {'{'}<span style={{color:C.green}}>1, 2, 3, …, 100000</span>{'}'}</div>
      <div style={{fontFamily:mono,fontSize:25,color:C.muted,marginTop:24}}>{t>=s.cues.shrinks?'99,999 != 100,000 → True':'unique values only'}</div>
    </div>
    <CodePanel code={s.code!} line={1} top={1000}/>
    <Note top={1194} size={29} color={early?C.red:C.muted}>{early?'duplicate at index 1 — scan continues':scanStarted?'every element is processed':'compare the lengths'}</Note>
  </>;
};

export const Optimal:React.FC<{s:Scene;t:number}>=({s,t})=>{
  const first=move(t,s.cues.first,.3);const second=move(t,s.cues.second,.3);const done=t>=s.cues.return;
  const add=t>=s.cues.add&&t<s.cues.complexity;const worst=t>=s.cues.worst;
  return <><ApproachHeader scene={s}/>
    <ArrayTiles values={episode.earlyArray} top={545} size={120} duplicate={second>0?[1]:[]} opacity={[1-first,1-second,...Array(4).fill(done?.17:1)]}/>
    {first>0&&<Tile value={1} size={82} style={{left:80+(455-80)*first,top:545+(843-545)*first}}/>}
    {second>0&&!done&&<Tile value={1} size={82} duplicate style={{left:220+(557-220)*second,top:545+(843-545)*second}}/>}
    <SetBox error={second===1&&t<s.cues.second+.6} top={788}/>
    {done&&<div style={{position:'absolute',left:540,top:854,color:C.green,fontFamily:mono,fontSize:31}}>return True</div>}
    <CodePanel code={s.code!} line={add?5:done?4:second>0?3:first>0?5:1} color={C.green}/>
    {done&&<div style={{position:'absolute',left:60,top:723,width:860,textAlign:'center',fontFamily:mono,fontSize:25,color:worst?C.muted:C.green}}>{add?'otherwise → add to seen':worst?'worst case: O(n) · this input: 2 checks':'2 checks. done.'}</div>}
  </>;
};

export const SceneContent:React.FC<{s:Scene}>=({s})=>{
  const t=useCurrentFrame()/30;
  const component=({hook:Hook,problem:Problem,brute:Brute,better:Better,one:OneLiner,optimal:Optimal} as Record<string,React.FC<{s:Scene;t:number}>>)[s.id];
  return <div style={{position:'absolute',inset:0,opacity:move(t,0,.16),transform:`translateY(${(1-move(t,0,.22))*16}px)`}}>{component?React.createElement(component,{s,t}):<EndCard t={t}/>}</div>;
};
