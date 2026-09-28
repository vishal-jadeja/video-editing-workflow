#!/usr/bin/env python3
"""Standard-library only ingest. Never conforms or modifies a locked source."""
import argparse, hashlib, json, subprocess
from fractions import Fraction
from pathlib import Path

def run(args):
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout

def probe(path):
    path = Path(path).resolve()
    info = json.loads(run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)]))
    videos = [s for s in info['streams'] if s['codec_type']=='video' and not s.get('disposition',{}).get('attached_pic')]
    if len(videos)!=1: raise ValueError('Expected exactly one primary video stream')
    v = videos[0]
    raw = json.loads(run(['ffprobe','-v','error','-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time,pkt_duration_time,duration_time','-of','json',str(path)]))['frames']
    pts = [float(f['best_effort_timestamp_time']) for f in raw if 'best_effort_timestamp_time' in f]
    if len(pts)!=len(raw) or not pts: raise ValueError('Every frame must have a presentation timestamp')
    rate = v.get('r_frame_rate','0/0')
    fps = float(Fraction(rate))
    delta = [b-a for a,b in zip(pts,pts[1:])]
    tick = float(Fraction(v.get('time_base','1/1000000')))
    vfr = any(abs(d-1/fps)>max(tick*1.2, .00001) for d in delta)
    duration = pts[-1]-pts[0]+float(raw[-1].get('duration_time',raw[-1].get('pkt_duration_time',1/fps)))
    rotation = next((float(s['rotation']) for s in v.get('side_data_list',[]) if 'rotation' in s),float(v.get('tags',{}).get('rotate',0)))
    warnings=[]
    if vfr: warnings.append('VFR detected: approve a CFR finishing master externally; this pipeline will not retime the locked edit.')
    if v.get('color_transfer') in ['smpte2084','arib-std-b67']: warnings.append('HDR input: approve an SDR finishing master or contribute a tested HDR pipeline.')
    if v.get('field_order','progressive') not in ['progressive','unknown']: warnings.append('Interlaced video is unsupported; provide a progressive master.')
    if rotation: warnings.append('Rotation metadata is unsupported; provide an orientation-baked master.')
    sar=v.get('sample_aspect_ratio','1:1')
    if sar not in ['1:1','N/A']: warnings.append('Non-square pixels: provide a square-pixel master.')
    digest=hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''): digest.update(block)
    audios=[{'index':s['index'],'codec':s['codec_name'],'channels':s['channels'],'sampleRate':int(s['sample_rate']),'startTime':float(s.get('start_time',0))} for s in info['streams'] if s['codec_type']=='audio']
    if abs(pts[0])>max(tick,1e-6): warnings.append('Nonzero video start PTS: provide a zero-origin finishing master to avoid timestamp shifts.')
    from analyze import loudness
    measured = loudness(path) if audios else {'integrated':None,'truePeak':None,'lra':None}
    return {'loudness':measured,'path':str(path),'sha256':digest.hexdigest(),'width':v['width'],'height':v['height'],'fps':fps,'fpsRational':rate,'durationFrames':len(pts),'durationSeconds':duration,'codec':v['codec_name'],'pixelFormat':v.get('pix_fmt','unknown'),'colorSpace':v.get('color_space','unknown'),'colorTransfer':v.get('color_transfer','unknown'),'colorPrimaries':v.get('color_primaries','unknown'),'colorRange':v.get('color_range','unknown'),'audioStreams':audios,'vfr':vfr,'rotation':rotation,'sampleAspectRatio':sar,'fieldOrder':v.get('field_order','unknown'),'startTime':pts[0],'warnings':warnings}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('video');parser.add_argument('output');args=parser.parse_args()
    Path(args.output).write_text(json.dumps(probe(args.video),indent=2)+'\n')
