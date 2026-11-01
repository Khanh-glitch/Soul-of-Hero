"""Unscaled player-centered crop from an otherwise unmodified controlled frame.
The full native PNGs are in the capture artifact; these are only quicklooks.
"""
import json,pathlib,subprocess,sys
root=pathlib.Path(sys.argv[1]);tick=int(sys.argv[2]);variant=int(sys.argv[3]);label=sys.argv[4]
t=json.loads((root/'timeline.json').read_text());frames=[f for f in t['frames'] if 'controlled_files' in f];f=min(frames,key=lambda x:abs(x['controlled_tick']-tick));player,camera=f['player'],f['camera'];cx=max(192,min(1088,round(640+2*(player[0]-camera[0]))));cy=max(108,min(612,round(360+2*(player[1]-camera[1]))))
print(f'REVIEW crop=384x216 center={cx},{cy} recorded_tick={f["controlled_tick"]} variant={variant}; full native PNGs in artifact',flush=True)
subprocess.run(['python3','prototypes/arcana_fusion20/renderer/native_review_surface.py',str(root/f['controlled_files'][variant]),f'{tick}_{label}',str(cx),str(cy)],check=True)
