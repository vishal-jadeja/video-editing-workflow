import React from 'react';
import {KineticCaption} from './KineticCaption';
import {LowerThird} from './LowerThird';
import {ChapterTitle} from './ChapterTitle';
import {Callout} from './Callout';
import {AnimatedCounter} from './AnimatedCounter';
import {DataViz} from './DataViz';
import {ListReveal} from './ListReveal';
import {QuoteCard} from './QuoteCard';
import {CodeOverlay} from './CodeOverlay';
import {CameraMove} from './CameraMove';
import {CutTransition} from './CutTransition';
import {ProgressIndicator} from './ProgressIndicator';
import {CallToAction} from './CallToAction';
import {FinishingLayer} from './FinishingLayer';
import {DesignerLottie} from './DesignerLottie';
import type {GraphicProps} from './shared';
export const Graphic:React.FC<GraphicProps>=({cue,tokens,plan})=>{
 const p={tokens,plan};switch(cue.component){
 case 'kinetic-caption':return <KineticCaption {...p} cue={cue}/>;
 case 'lower-third':return <LowerThird {...p} cue={cue}/>;
 case 'chapter-title':return <ChapterTitle {...p} cue={cue}/>;
 case 'callout':return <Callout {...p} cue={cue}/>;
 case 'counter':return <AnimatedCounter {...p} cue={cue}/>;
 case 'data-viz':return <DataViz {...p} cue={cue}/>;
 case 'list':return <ListReveal {...p} cue={cue}/>;
 case 'quote':return <QuoteCard {...p} cue={cue}/>;
 case 'code':return <CodeOverlay {...p} cue={cue}/>;
 case 'camera-move':return <CameraMove {...p} cue={cue}/>;
 case 'transition':return <CutTransition {...p} cue={cue}/>;
 case 'progress':return <ProgressIndicator {...p} cue={cue}/>;
 case 'cta':return <CallToAction {...p} cue={cue}/>;
 case 'finishing':return <FinishingLayer {...p} cue={cue}/>;
 case 'lottie':return <DesignerLottie {...p} cue={cue}/>;
 }
};
