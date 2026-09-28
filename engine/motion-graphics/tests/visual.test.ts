import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {bundle} from '@remotion/bundler';
import {renderStill,selectComposition,openBrowser} from '@remotion/renderer';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';
import {componentNames,componentPlan} from './fixtures';
import {exists} from '../pipeline/io';
import {fontPairingNames} from '../src/tokens/typography';
import type {GraphicsPlan} from '../schemas/graphics-plan';
let serveUrl:string;
let browser:Awaited<ReturnType<typeof openBrowser>>;
beforeAll(async()=>{
 const dir='public/projects/visual-fixture/media';await mkdir(dir,{recursive:true});
 await writeFile(`${dir}/still.svg`,'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="#142A38"/><circle cx="400" cy="400" r="220" fill="#8DF0CC"/><circle cx="400" cy="400" r="130" fill="#142A38"/></svg>');
 await writeFile(`${dir}/orbit.json`,JSON.stringify({v:'5.7.0',fr:30,ip:0,op:120,w:200,h:200,nm:'Original test dot',ddd:0,assets:[],layers:[{ddd:0,ind:1,ty:4,nm:'dot',sr:1,ks:{o:{a:0,k:100},r:{a:0,k:0},p:{a:0,k:[100,100,0]},a:{a:0,k:[0,0,0]},s:{a:0,k:[100,100,100]}},shapes:[{ty:'el',p:{a:0,k:[0,0]},s:{a:0,k:[80,80]},nm:'circle'},{ty:'fl',c:{a:0,k:[.55,.94,.8,1]},o:{a:0,k:100},r:1}],ip:0,op:120,st:0,bm:0}]}));
 await mkdir('tests/actual',{recursive:true});await mkdir('tests/snapshots',{recursive:true});serveUrl=await bundle({entryPoint:path.resolve('src/index.ts'),publicDir:path.resolve('public')});browser=await openBrowser('chrome',{logLevel:'error'});
});
afterAll(async()=>{await browser?.close({silent:true});});
async function still(plan:GraphicsPlan,frame:number,name:string,isolated=false){const inputProps={plan,overlayOnly:true,auditLayout:true};const composition=await selectComposition({serveUrl,id:'Overlay',inputProps,puppeteerInstance:isolated?undefined:browser});const output=path.resolve('tests/actual',`${name}.png`);await renderStill({serveUrl,composition,inputProps,frame,output,imageFormat:'png',logLevel:'error',puppeteerInstance:isolated?undefined:browser});return readFile(output);}
describe('isolated out-of-order frame rendering',()=>{
 it('renders identical GSAP and seeded-grain pixels without relying on prior frames',async()=>{
  const plan=componentPlan('chapter-title');const finishing=componentPlan('finishing').cues[0];finishing.id='grain';finishing.layer=2;plan.cues.push(finishing);
  const first=await still(plan,8,'determinism-first',true);const future=await still(plan,90,'determinism-future',true);expect(PNG.sync.read(first).data.equals(PNG.sync.read(future).data)).toBe(false);await still(plan,2,'determinism-past',true);const second=await still(plan,8,'determinism-isolated',true);
  expect(PNG.sync.read(first).data.equals(PNG.sync.read(second).data)).toBe(true);
 });
});
describe('every component × preset × aspect ratio',()=>{
 for(const preset of ['clean-tech','cinematic-doc','high-energy-shorts'] as const)for(const portrait of [false,true])for(const component of componentNames)it(`${preset}/${portrait?'portrait':'wide'}/${component}`,async()=>{
  const plan=componentPlan(component,preset,portrait);const name=`${preset}-${portrait?'portrait':'wide'}-${component}`,actual=await still(plan,60,name),baseline=`tests/snapshots/${name}.png`;
  if(process.env.UPDATE_SNAPSHOTS==='1'){await writeFile(baseline,actual);return;}
  expect(await exists(baseline),`Missing baseline: npm run test:visual:update (${name})`).toBe(true);const a=PNG.sync.read(actual),b=PNG.sync.read(await readFile(baseline));expect([a.width,a.height]).toEqual([b.width,b.height]);const diff=new PNG({width:a.width,height:a.height});const changed=pixelmatch(a.data,b.data,diff.data,a.width,a.height,{threshold:.08});if(changed)await writeFile(`tests/actual/${name}-diff.png`,PNG.sync.write(diff));expect(changed/(a.width*a.height)).toBeLessThan(.001);
 });
});

describe('requested typography pairings',()=>{
 for(const pairing of fontPairingNames)for(const portrait of [false,true])it(`${pairing}/${portrait?'portrait':'wide'}`,async()=>{
  const plan=componentPlan('chapter-title','clean-tech',portrait);plan.fontPairing=pairing;
  if(plan.cues[0].component==='chapter-title')plan.cues[0].props.kicker='MAKE SOMETHING MEANINGFUL';
  const name=`typography-${pairing}-${portrait?'portrait':'wide'}`,actual=await still(plan,60,name),baseline=`tests/snapshots/${name}.png`;
  if(process.env.UPDATE_SNAPSHOTS==='1'){await writeFile(baseline,actual);return;}
  const a=PNG.sync.read(actual),b=PNG.sync.read(await readFile(baseline));expect(pixelmatch(a.data,b.data,undefined,a.width,a.height,{threshold:.08})/(a.width*a.height)).toBeLessThan(.001);
 });
});
