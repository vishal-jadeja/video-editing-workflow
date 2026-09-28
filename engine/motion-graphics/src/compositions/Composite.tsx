import React from 'react';
import {AbsoluteFill,OffthreadVideo,staticFile} from 'remotion';
import type {GraphicsPlan} from '../../schemas/graphics-plan';
import {Overlay,LayoutAuditContext} from './Overlay';
export type CompositionProps={plan:GraphicsPlan;sourceUrl?:string;overlayOnly?:boolean;auditLayout?:boolean};
export const Composite:React.FC<CompositionProps>=({plan,sourceUrl,overlayOnly=false,auditLayout=false})=><AbsoluteFill>{!overlayOnly&&sourceUrl&&<OffthreadVideo src={staticFile(sourceUrl)} style={{width:'100%',height:'100%'}}/>}<LayoutAuditContext.Provider value={auditLayout}><Overlay plan={plan}/></LayoutAuditContext.Provider></AbsoluteFill>;
