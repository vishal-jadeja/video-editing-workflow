import {useEffect,useState} from 'react';
import {cancelRender,continueRender,delayRender,staticFile} from 'remotion';
import type {Tokens} from '../tokens';
const loaded=new Map<string,Promise<void>>();
export function useFonts(tokens:Tokens){
 const [ready,setReady]=useState(false);
 const [handle]=useState(()=>delayRender('Loading local OFL font pairing'));
 const key=JSON.stringify(tokens.fonts.faces);
 useEffect(()=>{
  setReady(false);
  const updateHandle=delayRender('Apply selected font pairing');
  const promises=tokens.fonts.faces.map(spec=>{
   let promise=loaded.get(spec.file);if(!promise){promise=(async()=>{const face=new FontFace(spec.family,`url(${staticFile(`fonts/${spec.file}`)})`,{weight:String(spec.weight),style:spec.style});await face.load();document.fonts.add(face);})();loaded.set(spec.file,promise);}return promise;
  });Promise.all(promises).then(()=>{setReady(true);continueRender(handle);continueRender(updateHandle);}).catch(cancelRender);
 },[handle,key]);
 return ready;
}
