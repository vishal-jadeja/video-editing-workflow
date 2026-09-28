import {useEffect,type RefObject} from 'react';
import {cancelRender,continueRender,delayRender} from 'remotion';
/** Measures real loaded-font layout during holds; animation edges are visually reviewed. */
export function useLayoutAudit(ref:RefObject<HTMLElement|null>,enabled:boolean,id:string,frame:number){
 useEffect(()=>{if(!enabled)return;const handle=delayRender(`Check text bounds: ${id}`);let active=true;
 document.fonts.ready.then(()=>{
  if(!active){continueRender(handle);return;}const root=ref.current;if(!root){continueRender(handle);return;}const box=root.getBoundingClientRect();
  for(const el of root.querySelectorAll<HTMLElement>('[data-text]')){const r=el.getBoundingClientRect();if(r.left<box.left-1||r.top<box.top-1||r.right>box.right+1||r.bottom>box.bottom+1||el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1){cancelRender(new Error(`${id}: rendered text overflows its approved box at frame ${frame} ("${(el.textContent??'').slice(0,40)}" rect ${Math.round(r.left-box.left)},${Math.round(r.top-box.top)},${Math.round(r.right-box.right)},${Math.round(r.bottom-box.bottom)} scroll ${el.scrollWidth}/${el.clientWidth}x${el.scrollHeight}/${el.clientHeight})`));return;}}
  continueRender(handle);
 }).catch(cancelRender);return()=>{active=false;continueRender(handle);};
 },[ref,enabled,id,frame]);
}
