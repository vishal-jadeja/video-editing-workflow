#!/usr/bin/env python3
"""Sampled conservative region proposals. Human shot review is mandatory."""
import argparse, json, math, subprocess
from pathlib import Path

def checked(args):
    return subprocess.run(args,check=True,capture_output=True,text=True)

def loudness(video):
    p=checked(['ffmpeg','-hide_banner','-i',str(video),'-map','0:a:0','-af','loudnorm=I=-14:TP=-1:LRA=11:print_format=json','-f','null','-'])
    raw=json.loads(p.stderr[p.stderr.rfind('{'):p.stderr.rfind('}')+1])
    def finite(key):
        value=float(raw[key]);return value if math.isfinite(value) else None
    return {'integrated':finite('input_i'),'truePeak':finite('input_tp'),'lra':finite('input_lra')}

def main():
    config=json.loads((Path(__file__).parent/'config.json').read_text())['analysis']
    p=argparse.ArgumentParser();p.add_argument('project');p.add_argument('--transcript');p.add_argument('--model',default='small');p.add_argument('--language');p.add_argument('--sample-seconds',type=float,default=config['sampleSeconds']);args=p.parse_args()
    import cv2
    import librosa
    import numpy as np
    from scenedetect import open_video, SceneManager, ContentDetector
    project=Path(args.project);source=json.loads((project/'project.json').read_text())['source'];video=source['path'];fps=source['fps'];n=source['durationFrames'];out=project/'analysis';out.mkdir(exist_ok=True);keydir=out/'keyframes';keydir.mkdir(exist_ok=True)
    if source['warnings']: raise ValueError('; '.join(source['warnings']))
    audio=project/'.cache'/'analysis.wav';audio.parent.mkdir(exist_ok=True)
    needs=[];words=[];beats=[];onsets=[]
    if source['audioStreams']:
        checked(['ffmpeg','-y','-v','error','-i',video,'-map','0:a:0','-ac','1','-ar','16000',str(audio)])
        if args.transcript:
            words=json.loads(Path(args.transcript).read_text())['words']
        else:
            from faster_whisper import WhisperModel
            model=WhisperModel(args.model,device='cpu',compute_type='int8',download_root=str(Path('.cache/models')))
            segments,_=model.transcribe(str(audio),word_timestamps=True,vad_filter=True,language=args.language)
            for segment in segments:
                for w in segment.words or []:
                    start=max(0,round(w.start*fps));end=min(n,max(start+1,round(w.end*fps)))
                    if start<n:words.append({'text':w.word.strip(),'startFrame':start,'endFrame':end,'confidence':w.probability})
        y,sr=librosa.load(str(audio),sr=22050)
        onset_env=librosa.onset.onset_strength(y=y,sr=sr)
        _,beat_times=librosa.beat.beat_track(onset_envelope=onset_env,sr=sr,units='time')
        onset_times=librosa.onset.onset_detect(onset_envelope=onset_env,sr=sr,units='time')
        beats=sorted(set(min(n-1,round(float(t)*fps)) for t in beat_times));onsets=sorted(set(min(n-1,round(float(t)*fps)) for t in onset_times))
        loud=source.get('loudness') or loudness(video)
    else:
        if args.transcript:words=json.loads(Path(args.transcript).read_text())['words']
        loud={'integrated':None,'truePeak':None,'lra':None}
    (out/'transcript.json').write_text(json.dumps({'words':words},indent=2)+'\n')
    manager=SceneManager();manager.add_detector(ContentDetector(threshold=config['sceneThreshold']));stream=open_video(video);manager.detect_scenes(stream,show_progress=False)
    detected=manager.get_scene_list(start_in_scene=True);cuts=sorted(set([0]+[a.get_frames() for a,_ in detected]+[n]))
    cap=cv2.VideoCapture(video);cascade=cv2.CascadeClassifier(cv2.data.haarcascades+'haarcascade_frontalface_default.xml')
    shots=[];regions=[]
    for i,(start,end) in enumerate(zip(cuts,cuts[1:])):
        if end<=start:continue
        sid=f'shot-{i:04d}';samples=sorted(set([start,(start+end-1)//2,end-1]+list(range(start,end,max(1,round(fps*args.sample_seconds))))))
        boxes=[];subject=[];brightness=[];colors=[];motions=[];thirds=[];previous=None;files=[]
        # Dense samples protect movement; union proposals persist for the whole shot.
        for f in samples:
            cap.set(cv2.CAP_PROP_POS_FRAMES,f);ok,bgr=cap.read()
            if not ok:raise RuntimeError(f'Cannot decode frame {f}')
            small=cv2.resize(bgr,(config['analysisWidth'],round(config['analysisWidth']*source['height']/source['width'])));gray=cv2.cvtColor(small,cv2.COLOR_BGR2GRAY);h,w=gray.shape
            faces=cascade.detectMultiScale(gray,scaleFactor=config['faceScaleFactor'],minNeighbors=config['faceMinNeighbors'],minSize=(config['faceMinSize'],config['faceMinSize']))
            for x,y,bw,bh in faces:boxes.append((x/w,y/h,(x+bw)/w,(y+bh)/h))
            edge=cv2.Canny(gray,80,160);thirds.append([float(np.mean(a)) for a in np.array_split(edge,3,axis=1)])
            brightness.append(float(gray.mean()/255));colors.append(np.mean(small,axis=(0,1)))
            if previous is not None:
                diff=cv2.absdiff(gray,previous);motions.append(float(diff.mean()/255))
                yy,xx=np.where(diff>35)
                if len(xx)>w*h*.015:
                    subject.append((float(np.quantile(xx,.1)/w),float(np.quantile(yy,.1)/h),float(np.quantile(xx,.9)/w),float(np.quantile(yy,.9)/h)))
            previous=gray
            if f in [start,(start+end-1)//2,end-1] or (len(faces)>0 and (f-start)%max(1,round(fps))<max(1,round(fps*args.sample_seconds))):
                name=f'{sid}-{f:08d}.jpg';cv2.imwrite(str(keydir/name),bgr);files.append(f'analysis/keyframes/{name}')
        def region(values,kind,confidence):
            if not values:return
            x=min(b[0] for b in values);y=min(b[1] for b in values);right=max(b[2] for b in values);bottom=max(b[3] for b in values)
            if right>x and bottom>y:regions.append({'shotId':sid,'startFrame':start,'endFrame':end,'kind':kind,'box':{'x':x,'y':y,'w':right-x,'h':bottom-y},'confidence':confidence,'origin':'detector'})
        region(boxes,'face',.65)
        if not boxes:region(subject,'subject',.25)
        color=np.mean(colors,axis=0).astype(int)[::-1]
        shots.append({'id':sid,'startFrame':start,'endFrame':end,'classification':'a-roll' if boxes else 'unknown','reviewed':False,'motion':float(np.mean(motions)) if motions else 0,'brightness':float(np.mean(brightness)),'dominantColor':'#'+''.join(f'{c:02x}' for c in color),'negativeSpace':['left','center','right'][int(np.argmin(np.mean(thirds,axis=0)))],'keyframes':files})
    cap.release()
    if any(w.get('confidence',1)<.6 for w in words):needs.append('Correct low-confidence transcript words, names and numbers against the audio.')
    result={'version':1,'source':source,'words':words,'cuts':cuts,'beats':beats,'onsets':onsets,'shots':shots,'regions':regions,'loudness':loud,'needsInput':needs}
    (out/'shots.json').write_text(json.dumps(shots,indent=2)+'\n');(out/'analysis.json').write_text(json.dumps(result,indent=2)+'\n')
    print(f'Analyzed {n} frames, {len(shots)} shots, {len(words)} words. Review all shots and add protected UI/text boxes. Beat candidates from mixed audio need listening review.')
if __name__=='__main__':main()
