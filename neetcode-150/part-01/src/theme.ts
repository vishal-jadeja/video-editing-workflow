export const C={bg:'#0F1115',panel:'#1A1D24',text:'#E6E8EB',muted:'#818793',violet:'#7B4DFF',red:'#F2555A',amber:'#F5B942',green:'#3DDC84'};
export const mono='"JetBrains Mono", monospace';
export const sans='"Inter", sans-serif';
export const SAFE={left:60,width:860,right:920,bottom:1536};
export const clamp=(x:number)=>Math.max(0,Math.min(1,x));
export const ease=(x:number)=>1-Math.pow(1-clamp(x),3);
export const move=(t:number,start:number,duration=.24)=>ease((t-start)/duration);
export type Word={word:string;start:number;end:number};
export type Scene={id:string;voice:string;start:number;startFrame:number;frames:number;duration:number;words:Word[];cues:Record<string,number>;label?:string;color?:string;time?:string;space?:string;code?:string};
