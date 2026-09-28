// @vitest-environment jsdom
import React,{StrictMode,useCallback,useRef,act} from 'react';
import {createRoot} from 'react-dom/client';
import {describe,it,expect,vi} from 'vitest';
import {gsap} from 'gsap';
const state=vi.hoisted(()=>({frame:0,fps:30}));
vi.mock('remotion',()=>({useCurrentFrame:()=>state.frame,useVideoConfig:()=>({fps:state.fps})}));
import {useGsapTimeline} from '../src/hooks/useGsapTimeline';
(globalThis as unknown as {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
function Test(){const ref=useRef<HTMLDivElement>(null);const build=useCallback((tl:gsap.core.Timeline)=>{tl.fromTo('[data-item]',{opacity:0,x:100},{opacity:1,x:0,duration:1,ease:'power3.out',immediateRender:true},0);},[]);useGsapTimeline(ref,build);return <div ref={ref}><div data-item style={{opacity:1}}>Title</div></div>;}
describe('GSAP lifecycle',()=>{
 it('seeks backwards and survives strict mount-cleanup-remount without leaking timelines',async()=>{
  const host=document.createElement('div');document.body.append(host);const before=gsap.globalTimeline.getChildren().length;const root=createRoot(host);
  const seek=async(frame:number)=>{state.frame=frame;await act(async()=>root.render(<StrictMode><Test/></StrictMode>));return host.querySelector<HTMLElement>('[data-item]')!.style.cssText;};
  const first=await seek(12);await seek(30);await seek(0);const repeated=await seek(12);expect(repeated).toBe(first);expect(gsap.globalTimeline.getChildren().filter(x=>x instanceof gsap.core.Timeline).every(x=>x.paused())).toBe(true);
  await act(async()=>root.unmount());expect(gsap.globalTimeline.getChildren().length).toBe(before);host.remove();
 });
});
