import {useLayoutEffect, useRef, type RefObject} from 'react';
import {gsap} from 'gsap';
import {CustomEase} from 'gsap/CustomEase';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import type {Tokens} from '../tokens';

gsap.registerPlugin(CustomEase);
/** The builder must use explicit fromTo values and be memoized with useCallback.
 * No callbacks, repeatRefresh, random(), asynchronous work, or nested playing tweens. */
export function useGsapTimeline<T extends HTMLElement>(scope: RefObject<T | null>, build: (timeline: gsap.core.Timeline) => void) {
  const frame=useCurrentFrame(); const {fps}=useVideoConfig();
  const timeline=useRef<gsap.core.Timeline|null>(null);
  const latest=useRef({frame,fps}); latest.current={frame,fps};
  useLayoutEffect(()=>{
    let tl:gsap.core.Timeline|undefined;
    const context=gsap.context(()=>{
      tl=gsap.timeline({paused:true}); build(tl); tl.pause();
      tl.totalTime(Math.max(0,latest.current.frame/latest.current.fps),true);
    },scope);
    timeline.current=tl!;
    return ()=>{timeline.current=null; context.revert(); tl?.kill();};
  },[scope,build]);
  useLayoutEffect(()=>{timeline.current?.totalTime(Math.max(0,frame/fps),true);},[frame,fps,build]);
}
export function customEase(t:Tokens) {
  return CustomEase.create(`entry-${t.name}`,`M0,0 C${t.motion.entry[0]},${t.motion.entry[1]} ${t.motion.entry[2]},${t.motion.entry[3]} 1,1`);
}
