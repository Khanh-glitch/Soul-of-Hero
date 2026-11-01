"""Surface an unscaled gameplay detail from a lossless native recording.
The crop is centered on the real captured enemy position; full video is in the
same-run build artifact. A few stills are not a complete-motion approval.
"""
import json,pathlib,subprocess,sys
root=pathlib.Path(sys.argv[1]); fraction=float(sys.argv[2]); label=sys.argv[3]
records=list(root.rglob('timeline.json')); videos=list(root.rglob('native-lossless.mkv'))
if len(records)!=1 or len(videos)!=1: raise SystemExit('expected one native timeline and one lossless video')
data=json.loads(records[0].read_text()); frames=data['frames']; target=data['last_tick']*fraction
index=min(range(len(frames)),key=lambda i:abs(frames[i]['source_tick_last_observed']-target)); frame=frames[index]
output=pathlib.Path('/tmp')/f'{label}.png'
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(videos[0]),'-vf',f'select=eq(n\\,{index})','-fps_mode','vfr','-frames:v','1',str(output)],check=True)
enemy=frame['enemy']; camera=frame['camera']; cx=max(192,min(1088,round(640+2*(enemy[0]-camera[0])))); cy=max(108,min(612,round(360+2*(enemy[1]-camera[1]))))
print(f'R17_REDESIGN_FRAME skill={data["skill"]} label={label} index={index} observed_tick={frame["source_tick_last_observed"]} center={cx},{cy}',flush=True)
subprocess.run(['python3','prototypes/arcana_fusion20/renderer/native_review_surface.py',str(output),label,str(cx),str(cy)],check=True)
