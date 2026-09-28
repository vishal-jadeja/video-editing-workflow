import React from 'react';
import {Composition} from 'remotion';
import example from '../../projects/example/graphics-plan.json';
import {planSchema} from '../../schemas/graphics-plan';
import {Composite} from './Composite';
const plan=planSchema.parse(example);
export const Root:React.FC=()=> <>{['Composite','Overlay'].map(id=><Composition key={id} id={id} component={Composite} width={plan.width} height={plan.height} fps={plan.fps} durationInFrames={plan.durationFrames} defaultProps={{plan,overlayOnly:id==='Overlay'}} calculateMetadata={({props})=>{const p=planSchema.parse(props.plan);return {width:p.width,height:p.height,fps:p.fps,durationInFrames:p.durationFrames,props:{...props,plan:p,overlayOnly:id==='Overlay'}};}}/>)}</>;
