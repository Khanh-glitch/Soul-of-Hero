"""Inspect actual recorded live #09 source-window actor anchors, no fake actors."""
import json,pathlib,sys
root=pathlib.Path(sys.argv[1]); t=json.loads((root/'timeline.json').read_text()); rows=[f for f in t['frames'] if 'r17_uncontained_nodes' in f]
if len(rows)<10: raise SystemExit('insufficient recorded live source frames')
for target in (87,183,247,327):
 f=min(rows,key=lambda x:abs(x['r17_source_tick']-target)); print('::notice title=A09_WIDE_WORLD_TICK::'+json.dumps({k:f[k] for k in ('r17_source_tick','r17_source_size','r17_source_offset','r17_uncontained_nodes','r17_actor_nodes')},separators=(',',':')))
print('::notice title=A09_WIDE_WORLD_SUMMARY::'+json.dumps({'frames':len(rows),'frames_with_uncontained_nodes':sum(f['r17_uncontained_nodes']>0 for f in rows),'max_uncontained_nodes':max(f['r17_uncontained_nodes'] for f in rows),'scope':'recorded moving actor anchors only; branch/bloom clipping and world HDR not measured'},separators=(',',':')))
