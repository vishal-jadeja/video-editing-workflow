// Pure edit planning for a recorded face-cam take: which parts of the recording to keep so that it
// reads as the script, and where each scene starts in the edited result. No I/O; unit-tested.

export const FPS=30;
export const DEFAULT_EDIT={maxPauseSeconds:.5,keepPauseSeconds:.3,leadSeconds:.15,tailSeconds:.75,removeRetakes:true};
const FILLERS=new Set(['um','uh','umm','uhh','erm','er','ah','hmm','mm']);
const ONES=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const TENS=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];

/** 0 ≤ n < 1e9 as spoken words: 100000 → one hundred thousand. */
export function numberWords(n){
  if(n<20)return [ONES[n]];
  if(n<100)return [TENS[Math.floor(n/10)],...(n%10?[ONES[n%10]]:[])];
  if(n<1000)return [ONES[Math.floor(n/100)],'hundred',...(n%100?numberWords(n%100):[])];
  for(const [size,name] of [[1e6,'million'],[1e3,'thousand']])if(n>=size)return [...numberWords(Math.floor(n/size)),name,...(n%size?numberWords(n%size):[])];
  return [String(n)];
}

/** Lower-case alphanumeric tokens; digit groups become number words. `number` marks tokens that came from digits. */
export function tokenize(text){
  const out=[];
  for(const raw of String(text).split(/\s+/)){
    const digits=raw.replace(/[,_]/g,'');
    if(/^\d+(\.\d+)?[^a-z0-9]*$/i.test(digits)){
      const [whole,fraction]=digits.replace(/[^0-9.]/g,'').split('.');
      const n=Number(whole);
      if(Number.isSafeInteger(n)&&n<1e9){out.push(...numberWords(n).map(norm=>({norm,number:true})));if(fraction)out.push({norm:'point',number:true},...[...fraction].map(d=>({norm:ONES[+d],number:true})));continue;}
    }
    const norm=raw.toLowerCase().replace(/[^a-z0-9']/g,'').replace(/'/g,'');
    if(norm)out.push({norm,number:false});
  }
  return out;
}

/** LCS alignment of recognised tokens to script tokens. On ties it skips earlier recognised tokens,
 * so when a line is said twice the later (usually corrected) take is the one matched. */
export function alignTokens(heard,script){
  const n=heard.length,m=script.length;
  const L=Array.from({length:n+1},()=>new Int32Array(m+1));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)L[i][j]=heard[i].norm===script[j].norm?1+L[i+1][j+1]:Math.max(L[i+1][j],L[i][j+1]);
  const pairs=[];let i=0,j=0;
  while(i<n&&j<m){
    if(L[i+1][j]===L[i][j])i++;
    else if(heard[i].norm===script[j].norm){pairs.push([i,j]);i++;j++;}
    else j++;
  }
  return pairs;
}

const frame=t=>Math.round(t*FPS)/FPS;

/**
 * @param words recognised words with source times: {text,start,end}
 * @param scenes [{id,voice}] in script order
 * @param duration recording duration in seconds
 * @param silences optional [{start,end}] quiet intervals, used to confirm that a long gap is really a pause
 * @returns {segments,cuts,scenes,duration,unmatchedScript}
 */
export function planEdit({words,scenes,duration,silences=[],options={}}){
  const o={...DEFAULT_EDIT,...options};
  // Recognised tokens remember which word (and therefore which time span) they came from.
  const heard=words.flatMap((w,index)=>tokenize(w.text).map(t=>({...t,index})));
  const script=scenes.flatMap((s,scene)=>tokenize(s.voice).map(t=>({...t,scene})));
  if(!heard.length)throw Error('No speech was recognised in the recording.');
  const pairs=alignTokens(heard,script);
  const matchedWord=new Map();// word index → scene index
  for(const [h,s] of pairs)matchedWord.set(heard[h].index,script[s].scene);
  for(let k=0;k<scenes.length;k++)if(![...matchedWord.values()].includes(k))throw Error(`Scene "${scenes[k].id}" was not found in the recording. Check that the take covers the whole script.`);

  // A recognised word is dropped when it is outside the script: before/after the script, or a run between two matched
  // words with no script words in between (flub, restart, ad-lib). Number words and single non-filler words are kept,
  // because they are more likely recognition noise than a retake.
  const keep=words.map(()=>true),cuts=[];
  const matchedIdx=[...matchedWord.keys()].sort((a,b)=>a-b);
  const dropRun=(from,to,reason)=>{for(let k=from;k<=to;k++)keep[k]=false;cuts.push({reason,start:words[from].start,end:words[to].end,text:words.slice(from,to+1).map(w=>w.text).join(' ')});};
  // Outside the script: a false start (its words are script words) or chatter (they are not).
  const scriptNorms=new Set(script.map(t=>t.norm));
  const outside=(from,to,label)=>words.slice(from,to+1).flatMap(w=>tokenize(w.text)).every(t=>scriptNorms.has(t.norm))?'retake':label;
  if(o.removeRetakes&&matchedIdx[0]>0)dropRun(0,matchedIdx[0]-1,outside(0,matchedIdx[0]-1,'before script'));
  if(o.removeRetakes&&matchedIdx.at(-1)<words.length-1)dropRun(matchedIdx.at(-1)+1,words.length-1,outside(matchedIdx.at(-1)+1,words.length-1,'after script'));
  const scriptPos=new Map(pairs.map(([h,s])=>[heard[h].index,s]));
  for(let k=0;k+1<matchedIdx.length;k++){
    const a=matchedIdx[k],b=matchedIdx[k+1];
    if(b-a<2||!o.removeRetakes)continue;
    // Script words skipped between the two matches mean this is a misrecognition, not an extra phrase.
    if(scriptPos.get(b)-scriptPos.get(a)>1)continue;
    const run=words.slice(a+1,b),tokens=run.flatMap(w=>tokenize(w.text));
    const filler=tokens.length>0&&tokens.every(t=>FILLERS.has(t.norm));
    const onlyNumbers=tokens.length>0&&tokens.every(t=>t.number);
    if(onlyNumbers||(!filler&&tokens.length<2))continue;
    dropRun(a+1,b-1,filler?'filler':'retake');
  }

  // Build kept source segments: split wherever words were dropped or a real pause is longer than maxPause.
  const kept=words.map((w,index)=>({...w,index})).filter(w=>keep[w.index]);
  // Merge touching quiet intervals, then use the longest quiet stretch inside a gap. Word end times often stop before
  // the audible tail of a word, so a pause is cut inside detected silence, never merely between recognised words.
  const quiet=[...silences].sort((x,y)=>x.start-y.start).reduce((all,s)=>{const last=all.at(-1);if(last&&s.start-last.end<.05)last.end=Math.max(last.end,s.end);else all.push({...s});return all;},[]);
  const silentPart=(from,to)=>{
    if(!quiet.length)return [from,to];
    let best=null;
    for(const s of quiet){const a=Math.max(from,s.start),b=Math.min(to,s.end);if(b>a&&(!best||b-a>best[1]-best[0]))best=[a,b];}
    return best;
  };
  const half=o.keepPauseSeconds/2,segments=[];
  let start=Math.max(0,kept[0].start-o.leadSeconds);
  for(let k=0;k+1<kept.length;k++){
    const a=kept[k],b=kept[k+1],gap=b.start-a.end;
    if(b.index-a.index>1){
      // Dropped words in between: join the neighbours with a short natural pause.
      const end=a.end+Math.min(half,Math.max(0,gap/2)),next=b.start-Math.min(half,Math.max(0,gap/2));
      segments.push({start,end});start=next;continue;
    }
    if(gap<=o.maxPauseSeconds)continue;
    const silent=silentPart(a.end,b.start);
    if(!silent||silent[1]-silent[0]<=o.maxPauseSeconds)continue;
    const end=silent[0]+half,next=silent[1]-half;
    segments.push({start,end});
    cuts.push({reason:'pause',start:end,end:next,text:''});
    start=next;
  }
  segments.push({start,end:Math.min(duration,kept.at(-1).end+o.tailSeconds)});

  // Snap to the output frame grid: each segment keeps a whole number of frames so scene durations are exact.
  const snapped=[];let cursor=0;
  for(const s of segments){
    const from=frame(s.start),frames=Math.floor((s.end-from)*FPS+1e-6);
    if(frames<=0)continue;
    snapped.push({start:from,end:from+frames/FPS,outputStart:cursor/FPS,frames});cursor+=frames;
  }
  const toOutput=t=>{const s=snapped.find(x=>t>=x.start-1e-6&&t<=x.end+1e-6)??snapped.findLast(x=>x.start<=t)??snapped[0];return s.outputStart+Math.min(Math.max(0,t-s.start),s.frames/FPS);};

  // A scene starts at the pause before its first matched word: midway between the previous kept word and it.
  const firstWord=scenes.map((_,k)=>kept.find(w=>matchedWord.get(w.index)===k));
  const boundaries=firstWord.map((w,k)=>{
    if(k===0)return 0;
    const before=kept.filter(x=>x.index<w.index).at(-1);
    const t=before?(toOutput(before.end)+toOutput(w.start))/2:toOutput(w.start);
    return Math.round(t*FPS);
  });
  for(let k=1;k<boundaries.length;k++)if(boundaries[k]<=boundaries[k-1])throw Error(`Scenes "${scenes[k-1].id}" and "${scenes[k].id}" overlap in the recording; were they recorded out of order?`);
  const sceneFrames=boundaries.map((b,k)=>({id:scenes[k].id,startFrame:b,frames:(boundaries[k+1]??cursor)-b}));
  const unmatchedScript=script.length-pairs.length;
  return {segments:snapped,cuts,scenes:sceneFrames,frames:cursor,duration:cursor/FPS,unmatchedScript,scriptTokens:script.length};
}
