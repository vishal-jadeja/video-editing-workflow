"""Original, deterministic sound synthesis. No external sound assets."""
import json, math, wave
from pathlib import Path
import numpy as np

SR=48000
data=json.loads(Path('src/generated/timeline.json').read_text())
audio=np.zeros(math.ceil(data['duration']*SR),dtype=np.float32)
rng=np.random.default_rng(150)
events=[]
def sound(kind):
    length={'tick':.055,'whoosh':.25,'error':.19,'chime':.38}[kind]
    t=np.arange(round(length*SR))/SR
    if kind=='tick':
        y=np.sin(2*np.pi*1500*t)*np.exp(-t*100)*.018
    elif kind=='whoosh':
        noise=rng.normal(size=len(t))
        smooth=np.convolve(noise,np.ones(15)/15,mode='same')
        y=smooth*np.sin(np.pi*t/length)**2*.036
    elif kind=='error':
        y=(np.sin(2*np.pi*185*t)+.35*np.sin(2*np.pi*240*t))*np.exp(-t*22)*.034
    else:
        y=np.zeros_like(t)
        for delay,freq in [(0,660),(.065,880),(.13,1100)]:
            u=np.maximum(0,t-delay)
            y+=np.sin(2*np.pi*freq*u)*np.exp(-u*16)*(t>=delay)*.026
    return y.astype(np.float32)
def add(kind,at):
    wave_data=sound(kind);i=round(at*SR)
    n=min(len(wave_data),len(audio)-i)
    if n>0:audio[i:i+n]+=wave_data[:n]
    events.append({'type':kind,'time':round(at,3)})
for scene in data['scenes']:
    start=scene['start'];c=scene['cues']
    if start:add('whoosh',start)
    if scene['id']=='hook':
        add('tick',start+c['duplicate']);add('whoosh',start+c['wall'])
    if scene['id']=='brute':
        for i in range(3):add('tick',start+c['compare']+i*(c['found']-c['compare'])/3)
        add('error',start+c['found'])
    if scene['id']=='better':
        add('whoosh',start+c['sort']);add('error',start+c['duplicate'])
    if scene['id']=='one':
        add('tick',start+c['set']);add('tick',start+c['early'])
        for at in np.arange(c['scan'],c['end'],.85):add('tick',start+at)
    if scene['id']=='optimal':
        add('tick',start+c['first']);add('tick',start+c['second']);add('chime',start+c['return'])
with wave.open('public/audio/sfx.wav','wb') as out:
    out.setnchannels(1);out.setsampwidth(2);out.setframerate(SR)
    out.writeframes((np.clip(audio,-1,1)*32767).astype('<i2').tobytes())
Path('assets/sfx/events.json').write_text(json.dumps(events,indent=2))
