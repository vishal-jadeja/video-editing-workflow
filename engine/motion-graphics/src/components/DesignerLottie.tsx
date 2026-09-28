import React,{useEffect,useState} from 'react';
import {Lottie,type LottieAnimationData} from '@remotion/lottie';
import {cancelRender,continueRender,delayRender,staticFile} from 'remotion';
import type {CueOf} from '../../schemas/graphics-plan';
import type {GraphicProps} from './shared';
export const DesignerLottie:React.FC<GraphicProps<CueOf<'lottie'>>>=({cue,plan})=>{
 const [handle]=useState(()=>delayRender('Load local Lottie'));
 const [data,setData]=useState<LottieAnimationData|null>(null);
 const path=plan.assets.find(a=>a.id===cue.props.assetId)!.path;
 useEffect(()=>{let active=true;fetch(staticFile(`projects/${plan.slug}/${path}`)).then(r=>{if(!r.ok)throw new Error(`Missing Lottie ${path}`);return r.json();}).then(json=>{if(active){setData(json);continueRender(handle);}}).catch(cancelRender);return()=>{active=false;};},[path,plan.slug,handle]);
 return data?<Lottie animationData={data} loop={cue.props.loop} style={{width:'100%',height:'100%'}}/>:null;
};
