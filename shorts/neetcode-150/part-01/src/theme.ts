// Print-editorial palette: paper-white type on ink, hairlines instead of cards, one brand accent.
// `violet` (#7B4DFF) marks the duplicate/match only; `violetText` is its 4.5:1 tint for small type.
// red/amber/green identify an approach (a dot and its highlighted code line), nothing else.
export const C={bg:'#0E0F11',panel:'#15171A',line:'rgba(244,242,237,.16)',faint:'rgba(244,242,237,.05)',text:'#F4F2ED',muted:'#9C9A94',violet:'#7B4DFF',violetText:'#8F6BFF',red:'#E5534B',amber:'#E3B26B',green:'#5BC98A'};
/** Tracked mono label (kickers, indices, metadata). */
export const label={fontFamily:'"JetBrains Mono", monospace',textTransform:'uppercase' as const,letterSpacing:'.14em'};
/** Legibility for type set directly over face cam: a glyph-hugging shadow, not a box. */
export const glyphShadow='0 0 .45em rgba(0,0,0,.55), 0 .03em .1em rgba(0,0,0,.6)';
export const mono='"JetBrains Mono", monospace';
export const sans='"Inter", sans-serif';
export const SAFE={left:60,width:860,right:920,bottom:1536};
export const clamp=(x:number)=>Math.max(0,Math.min(1,x));
export const ease=(x:number)=>1-Math.pow(1-clamp(x),3);
export const move=(t:number,start:number,duration=.24)=>ease((t-start)/duration);
export type Word={word:string;start:number;end:number};
export type Scene={id:string;voice:string;start:number;startFrame:number;frames:number;duration:number;words:Word[];cues:Record<string,number>;label?:string;color?:string;time?:string;space?:string;code?:string};
