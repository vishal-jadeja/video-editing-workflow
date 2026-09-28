import {planSchema,type Cue, type GraphicsPlan} from '../schemas/graphics-plan';
import type {Analysis} from '../schemas/analysis';
import example from '../projects/example/graphics-plan.json';
export const examplePlan=()=>planSchema.parse(structuredClone(example));
export function analysisFor(p:GraphicsPlan):Analysis{return{version:1,source:{path:'synthetic.mov',sha256:'test',width:p.width,height:p.height,fps:p.fps,fpsRational:`${p.fps}/1`,durationFrames:p.durationFrames,durationSeconds:p.durationFrames/p.fps,codec:'h264',pixelFormat:'yuv420p',colorSpace:'bt709',colorTransfer:'bt709',colorPrimaries:'bt709',colorRange:'tv',audioStreams:[],vfr:false,rotation:0,sampleAspectRatio:'1:1',fieldOrder:'progressive',startTime:0,warnings:[]},words:[],cuts:[0,p.durationFrames],beats:[],onsets:[],shots:[{id:'s1',startFrame:0,endFrame:p.durationFrames,classification:'b-roll',reviewed:true,motion:0,brightness:.5,dominantColor:'#101827',negativeSpace:'left',keyframes:[]}],regions:[],loudness:{integrated:null,truePeak:null,lra:null},needsInput:[]};}
const specifications:Record<Cue['component'],unknown>={
 'kinetic-caption':{words:[{text:'Ship',startFrame:0,endFrame:30},{text:'with',startFrame:30,endFrame:60},{text:'confidence',startFrame:60,endFrame:120}],emphasis:[2]},
 'lower-third':{name:'Alex Morgan',title:'Developer',variant:'speaker'},
 'chapter-title':{title:'A smaller loop',kicker:'BUILD IN PUBLIC',depth:true},
 'callout':{label:'Inspect this result',shape:'arrow',points:[[.1,.55],[.55,.55],[.85,.85]]},
 'counter':{from:0,to:42,decimals:0,prefix:'',suffix:'%',label:'Fictional demo statistic'},
 'data-viz':{title:'Build time',items:[{label:'Before',value:30},{label:'After',value:12}],unit:'s'},
 'list':{title:'Three steps',items:['Build','Check','Learn']},
 'quote':{quote:'Make the next step clear.',attribution:'Fictional narrator'},
 'code':{title:'terminal.ts',code:'const ready = true;\nconsole.log(ready);',language:'typescript'},
 'camera-move':{assetId:'still',mode:'ken-burns',focus:[.5,.5]},
 'transition':{variant:'glitch',cutFrame:60},
 'progress':{chapters:[{frame:0,label:'Build'},{frame:60,label:'Learn'}]},
 'cta':{text:'Build your next idea',secondary:'One small step.',endScreen:false},
 'finishing':{grain:true,vignette:true,letterbox:false},
 'lottie':{assetId:'lottie',loop:false},
};
export const componentNames=Object.keys(specifications) as Cue['component'][];
export function componentPlan(component:Cue['component'],preset:GraphicsPlan['preset']='clean-tech',portrait=false):GraphicsPlan{
 const p=examplePlan();p.slug='visual-fixture';p.preset=preset;p.width=portrait?270:480;p.height=portrait?480:270;p.platform=portrait?'shorts':'youtube';p.durationFrames=120;
 p.assets=[{id:'still',path:'media/still.svg',kind:'image',license:'CC0-1.0',credit:'Repository original test image'},{id:'lottie',path:'media/orbit.json',kind:'lottie',license:'CC0-1.0',credit:'Repository original test animation'}];
 p.cues=[{...p.cues[0],id:'visual',component,props:specifications[component],startFrame:0,endFrame:120,box:['transition','finishing'].includes(component)?{x:0,y:0,w:1,h:1}:portrait?{x:.07,y:.2,w:.7,h:.5}:{x:.08,y:.12,w:.8,h:.74},sync:{kind:'none',frame:0}} as Cue];return planSchema.parse(p);
}
