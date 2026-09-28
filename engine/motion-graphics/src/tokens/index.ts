import {Easing} from 'remotion';
import {fontPairings,defaultPairing,monoFace,type FontPairingName,type FontFaceSpec} from './typography';

export type PresetName = 'clean-tech' | 'cinematic-doc' | 'high-energy-shorts';
export type Platform = 'youtube' | 'shorts' | 'reels' | 'tiktok';
export type Box = {x: number; y: number; w: number; h: number};
export interface Tokens {
  name: PresetName;
  fonts: {display: string; body: string; mono: string; weight: number; strong: number; displayWeight: number; displayStyle: 'normal'|'italic'; bodyStyle: 'normal'|'italic'; accent: string; accentWeight: number; accentStyle: 'normal'|'italic'; faces: FontFaceSpec[]};
  /** `panel` is the ink colour: label strips on `solid`, the glyph shadow on `bare`. */
  color: {primary: string; accent: string; accentFill: string; text: string; muted: string; panel: string; code: string; keyword: string; string: string};
  /** `solid`: flat square ink strips sized to their text (contrast guaranteed). `bare`: type directly on footage with a soft glyph shadow (verify contrast per shot). */
  surface: 'solid' | 'bare';
  type: {title: number; body: number; caption: number; small: number; counter: number; label: number; lineHeight: number; displayLineHeight: number; tracking: number; displayTracking: number; labelTracking: number};
  space: {xs: number; sm: number; md: number; lg: number};
  radius: number; stroke: number; shadow: string;
  motion: {in30: number; out30: number; stagger30: number; distance: number; overshoot: number; focusBlur: number; spring: {damping: number; stiffness: number; mass: number}; entry: [number, number, number, number]; exit: [number, number, number, number]};
  grain: {opacity: number; count: number; size: number};
  vignette: number; letterbox: number; stillScale: number;
  safe: Record<Platform, {left: number; right: number; top: number; bottom: number}>;
  actionMargin: number;
  rules: {maxPer10s: number; minGapSeconds: number; maxSimultaneous: number; wordsPerSecond: number; readPaddingSeconds: number; minReadSeconds: number; maxCaptionChars: number; maxCaptionLines: number; maxTransitionsPerMinute: number; minContrast: number; snapToleranceFrames: number; facePadding: number; maxSfxGain: number};
  audio: {lufs: number; truePeak: number; lra: number; sfxGain: number; duckThreshold: number; duckRatio: number; attackMs: number; releaseMs: number};
  endScreen: Box[];
}
const base: Tokens = {
  name: 'clean-tech',
  fonts: {display: 'Inter, sans-serif', body: 'Inter, sans-serif', mono: 'IBM Plex Mono, monospace', weight: 500, strong: 700, displayWeight:700,displayStyle:'normal',bodyStyle:'normal',accent:'Inter, sans-serif',accentWeight:700,accentStyle:'normal',faces:[]},
  // Print palette: paper on ink with one brand accent. `accentFill` is the exact brand purple for rules, bars and strokes;
  // `accent` is a lighter tint of the same hue so accent text clears 4.5:1. Purple never tints ink, text or code colours.
  color: {primary: '#F4F2ED', accent: '#8F6BFF', accentFill: '#7B4DFF', text: '#F4F2ED', muted: '#A8A59E', panel: '#0F0F0E', code: '#F4F2ED', keyword: '#F2C38B', string: '#B9D8A6'},
  surface: 'solid',
  type: {title: .058, body: .032, caption: .044, small: .023, counter: .11, label: .019, lineHeight: 1.25, displayLineHeight: 1.02, tracking: -.01, displayTracking: -.035, labelTracking: .14},
  space: {xs: .007, sm: .014, md: .022, lg: .035}, radius: 0, stroke: .0022, shadow: 'none',
  motion: {in30: 12, out30: 6, stagger30: 3, distance: .02, overshoot: .035, focusBlur: .01, spring: {damping: 18, stiffness: 130, mass: 1}, entry: [.16, 1, .3, 1], exit: [.7, 0, .84, 0]},
  grain: {opacity: .035, count: 200, size: .0015}, vignette: .16, letterbox: .075, stillScale: 1.045,
  safe: {youtube: {left: .05, right: .05, top: .05, bottom: .05}, shorts: {left: .06, right: .18, top: .14, bottom: .20}, reels: {left: .06, right: .18, top: .14, bottom: .20}, tiktok: {left: .06, right: .20, top: .14, bottom: .22}}, actionMargin: .035,
  rules: {maxPer10s: 2, minGapSeconds: 3, maxSimultaneous: 2, wordsPerSecond: 3, readPaddingSeconds: 1, minReadSeconds: 1.5, maxCaptionChars: 30, maxCaptionLines: 2, maxTransitionsPerMinute: 1, minContrast: 4.5, snapToleranceFrames: 2, facePadding: .02, maxSfxGain: .25},
  audio: {lufs: -14, truePeak: -1, lra: 11, sfxGain: .08, duckThreshold: .025, duckRatio: 8, attackMs: 8, releaseMs: 180},
  endScreen: [{x: .56, y: .55, w: .38, h: .38}, {x: .75, y: .15, w: .16, h: .28}],
};
const basePresets: Record<PresetName, Tokens> = {
  'clean-tech': base,
  'cinematic-doc': {...base, name: 'cinematic-doc', color: {...base.color, primary: '#EFE8DC', text: '#EFE8DC', accent: '#E3B26B', accentFill: '#E3B26B', panel: '#12100D', muted: '#B3AA9B', code: '#EFE8DC', keyword: '#E3B26B', string: '#CDBFA6'}, surface: 'bare', type: {...base.type, title: .066, tracking: -.005}, motion: {...base.motion, in30: 15, out30: 8, stagger30: 4, distance: .012, focusBlur: .014}, grain: {...base.grain, opacity: .045}},
  'high-energy-shorts': {...base, name: 'high-energy-shorts', color: {...base.color, primary: '#F7F4EE', text: '#F7F4EE', accent: '#8F6BFF', accentFill: '#7B4DFF', panel: '#0C0C0C', muted: '#BDB8AE', code: '#F7F4EE', keyword: '#F2C38B', string: '#B9D8A6'}, surface: 'bare', type: {...base.type, caption: .06, title: .1, counter: .15, body: .036, label: .024}, motion: {...base.motion, in30: 9, out30: 5, stagger30: 2}, rules: {...base.rules, maxPer10s: 3, minGapSeconds: 3, maxCaptionChars: 22}},
};
export const frames = (at30: number, fps: number) => Math.max(1, Math.round(at30 * fps / 30));
export const easing = (curve: Tokens['motion']['entry']) => Easing.bezier(...curve);
export const designUnit = (width: number, height: number) => Math.min(width, height);
export const readingFrames = (words: number, fps: number, t: Tokens) => Math.ceil(Math.max(t.rules.minReadSeconds, words / t.rules.wordsPerSecond + t.rules.readPaddingSeconds) * fps);
export function safeBox(t: Tokens, platform: Platform): Box {
  const s = t.safe[platform]; return {x: s.left, y: s.top, w: 1-s.left-s.right, h: 1-s.top-s.bottom};
}
export function anchorBox(anchor: 'top-left'|'bottom-left'|'center'|'top-right', portrait: boolean, t: Tokens, platform: Platform): Box {
  const safe = safeBox(t, platform); const w = Math.min(safe.w, portrait ? .7 : .43); const h = portrait ? .19 : .27;
  return {x: anchor==='top-right' ? safe.x+safe.w-w : anchor==='center' ? safe.x+(safe.w-w)/2 : safe.x,
    y: anchor==='bottom-left' ? safe.y+safe.h-h : anchor==='center' ? safe.y+(safe.h-h)/2 : safe.y, w, h};
}

export function resolveTokens(name:PresetName,pairing?:FontPairingName):Tokens {
 const base=basePresets[name],profile=pairing??defaultPairing[name],p=fontPairings[profile];
 return {...base,fonts:{...base.fonts,display:`"${p.display.family}", sans-serif`,body:`"${p.body.family}", sans-serif`,mono:'"IBM Plex Mono", monospace',weight:p.body.weight,strong:p.body.weight,displayWeight:p.display.weight,displayStyle:p.display.style,bodyStyle:p.body.style,accent:`"${(p.accent??p.display).family}", sans-serif`,accentWeight:(p.accent??p.display).weight,accentStyle:(p.accent??p.display).style,faces:[p.display,p.body,...(p.accent?[p.accent]:[]),monoFace]},type:{...base.type,...p.type,title:base.type.title*(p.displayScale??1),counter:base.type.counter*(p.displayScale??1),...(profile==='script-humanist'?{title:.068,lineHeight:1.4,tracking:0}:profile==='condensed-light'?{lineHeight:1.5}:{})}};
}

export const presets:Record<PresetName,Tokens>=Object.fromEntries((Object.keys(basePresets) as PresetName[]).map(name=>[name,resolveTokens(name)])) as Record<PresetName,Tokens>;
