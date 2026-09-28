#!/usr/bin/env python3
"""Original procedural SFX; deterministic and delivered as a separate dry stem."""
import argparse, array, hashlib, json, math, random, wave
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('plan');p.add_argument('output');args=p.parse_args();plan=json.loads(Path(args.plan).read_text());config=json.loads((Path(__file__).parent/'config.json').read_text())['sfx'];sr=config['sampleRate']
samples=array.array('f',[0])*math.ceil(plan['durationFrames']/plan['fps']*sr)
lengths=config['durations']
for event in plan['audio']['sfx']:
    cue=next(c for c in plan['cues'] if c['id']==event['cueId']);hit=cue['startFrame'] if event['event']=='in' else cue['endFrame']-1
    count=round(lengths[event['kind']]*sr);start=max(0,round(hit/plan['fps']*sr)-(count-1 if event['kind']=='riser' else 0))
    seed=int(hashlib.sha256(f"{plan['seed']}:{cue['id']}:{event['event']}:{event['kind']}".encode()).hexdigest(),16);rng=random.Random(seed);last=0
    for i in range(count):
        if start+i>=len(samples):break
        progress=i/max(1,count-1);noise=rng.uniform(-1,1);last=last*.85+noise*.15
        if event['kind']=='click':value=noise*math.exp(-progress*12)
        elif event['kind']=='pop':value=math.sin(2*math.pi*(190*i/sr-120*(i/sr)**2))*math.exp(-progress*7)
        elif event['kind']=='whoosh':value=last*math.sin(math.pi*progress)**2
        else:value=last*progress**2*math.sin(math.pi*progress)
        samples[start+i]+=value*event['gain']
pcm=array.array('h',(round(max(-1,min(1,x))*32767) for x in samples))
with wave.open(args.output,'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(sr);f.writeframes(pcm.tobytes())
