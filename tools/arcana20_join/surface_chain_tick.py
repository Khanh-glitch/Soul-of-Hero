"""Disclosed 1x player-centered detail of an actual recorded world frame."""
import json,pathlib,subprocess,sys
root=pathlib.Path(sys.argv[1]); target=int(sys.argv[2]); label=sys.argv[3]
data=json.loads((root/'timeline.json').read_text()); frames=data['frames']; f=min(frames,key=lambda r:abs(r['source_tick_last_observed']-target))
# Current capture uses camera zoom 1 and a 640x360 logical viewport at 2x.
# This crop is informational; full 1280x720 recorded video is retained.
player,camera=f['player'],f['camera']; cx=max(192,min(1088,round(640+2*(player[0]-camera[0]))));cy=max(108,min(612,round(360+2*(player[1]-camera[1]))))
print(f'CHAIN_NATIVE_CROP requested_tick={target} observed_tick={f["source_tick_last_observed"]} center={cx},{cy}; full world in video',flush=True)
subprocess.run(['python3','prototypes/arcana_fusion20/renderer/native_review_surface.py',str(root/f['file']),label,str(cx),str(cy)],check=True)
