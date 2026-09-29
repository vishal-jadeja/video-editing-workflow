import React,{useEffect,useState} from 'react';
import {AbsoluteFill,Composition,Sequence,Audio,staticFile,useCurrentFrame,delayRender,continueRender,cancelRender} from 'remotion';
import timeline from './generated/timeline.json';
import episode from './generated/episode.json';
import {Background,ProblemCard,Captions} from './components';
import {EditorialScene,layoutAt} from './facecam';
import {C,mono,sans,label,Scene} from './theme';

const data=timeline as unknown as {ready:boolean;frames:number;part:number;title:string;scenes:Scene[]};
const Fonts:React.FC=()=>{
 const [handle]=useState(()=>delayRender('Loading cached Google Fonts'));
 useEffect(()=>{
   Promise.all(['inter','jetbrains'].map(name=>new Promise<void>((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href=staticFile(`fonts/${name}.css`);link.onload=()=>resolve();link.onerror=reject;document.head.appendChild(link);}))).then(()=>Promise.all([document.fonts.load('900 50px Inter'),document.fonts.load('700 64px Inter'),document.fonts.load('400 30px "JetBrains Mono"')])).then(()=>continueRender(handle)).catch(cancelRender);
 },[handle]);return null;
};
const SceneCaptions:React.FC<{s:Scene}>=({s})=>{const f=useCurrentFrame();return <Captions scene={s} t={f/30} backdrop={layoutAt(s,f).mode!=='graphics'}/>;};
const Video:React.FC=()=>{
 if(!data.ready)throw Error('Generate and align narration before rendering the video. Cover is available independently.');
 return <AbsoluteFill style={{color:C.text,fontFamily:sans}}><Fonts/><Background/>
   {data.scenes.map(s=><Sequence key={s.id} from={s.startFrame} durationInFrames={s.frames}><EditorialScene s={s}/></Sequence>)}
   <ProblemCard part={data.part} title={data.title}/>
   {data.scenes.map(s=><Sequence key={`captions-${s.id}`} from={s.startFrame} durationInFrames={s.frames}><SceneCaptions s={s}/></Sequence>)}
   <Audio src={staticFile('audio/mix.wav')}/>
 </AbsoluteFill>;
};
const Cover:React.FC=()=> <AbsoluteFill style={{color:C.text,fontFamily:sans}}><Fonts/><Background/>
  <div style={{position:'absolute',left:60,top:230,width:960,display:'flex',justifyContent:'space-between',...label,fontSize:28}}><span>NeetCode 150</span><span style={{color:C.muted}}>Part {String(episode.part).padStart(2,'0')}</span></div>
  <div style={{position:'absolute',left:60,top:290,width:960,height:1,background:C.line}}/>
  <div style={{position:'absolute',left:54,top:620,width:960,fontSize:150,fontWeight:700,lineHeight:.95,letterSpacing:'-.05em'}}>{episode.title.split(' ').map((word,i)=><React.Fragment key={i}>{i>0&&<br/>}{word}</React.Fragment>)}</div>
  <div style={{position:'absolute',left:60,top:1010,...label,fontSize:26,color:C.muted}}>{episode.difficulty} · Arrays &amp; Hashing</div>
  <div style={{position:'absolute',left:60,top:1090,fontSize:120,fontFamily:mono,color:C.violetText,letterSpacing:'-.04em'}}>O(n)</div>
  <div style={{position:'absolute',left:60,top:1430,...label,fontSize:26,color:C.muted}}>One problem at a time</div>
</AbsoluteFill>;
export const Root:React.FC=()=> <><Composition id="Part01" component={Video} width={1080} height={1920} fps={30} durationInFrames={data.frames||30}/><Composition id="Cover" component={Cover} width={1080} height={1920} fps={30} durationInFrames={1}/></>;
