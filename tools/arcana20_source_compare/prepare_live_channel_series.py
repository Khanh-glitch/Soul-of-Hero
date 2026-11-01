"""Extract the real connector recorded at each displayed capture frame."""
import json,pathlib,sys
root=pathlib.Path(sys.argv[1]); out=pathlib.Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=True)
timeline=json.loads((root/'timeline.json').read_text()); series=[]
for i,frame in enumerate(timeline['frames']):
    if 'r17_source_tick' not in frame: continue
    bolt=frame.get('r17_chosen_bolt',{})
    if not bolt: continue
    record={'skill':timeline['skill'],'source_tick':frame['r17_source_tick'], 'frame_index':i,'chosen_bolt':bolt}
    p=out/f'r17_{i:04}.json'; p.write_text(json.dumps(record)); series.append(record)
if len(series)<10: raise SystemExit(f'insufficient actually recorded connectors: {len(series)}')
(out/'series.json').write_text(json.dumps(series,indent=2)+'\n')
print(f'R17_SERIES_PREPARED {len(series)} real frame connectors')
