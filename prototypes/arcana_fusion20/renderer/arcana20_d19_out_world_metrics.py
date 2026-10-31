"""Image-space output deltas on the real frozen overworld, diagnostic only.
These are measurements against the identical no-cast world, not a render key.
"""
import json,math,pathlib,sys
import numpy as np
from PIL import Image
p=next(pathlib.Path(sys.argv[1]).rglob('phase_baseline.png')).parent
base=np.asarray(Image.open(p/'phase_baseline.png').convert('RGB'),dtype=np.int16)
rows={}
for label,tick in [('out_start',516),('out_withdraw',540),('out_converge',564),('late',582),('out_last',587),('cleared',None)]:
 name=f'phase_19_{label}_tick{tick}.png' if tick is not None else 'phase_19_cleared.png'
 im=np.asarray(Image.open(p/name).convert('RGB'),dtype=np.int16)
 diff=np.abs(im-base);change=np.any(diff!=0,axis=2)
 row={'label':label,'tick':tick,'changed_pixels':int(change.sum()),'sum_abs_rgb':int(diff.sum()),'max_abs_rgb':int(diff.max()),'mean_abs_rgb_per_pixel':float(diff.mean()),'scope':'actual frozen e552 overworld, no HUD post isolation or Gold comparison'}
 print('D19_WORLD_OUT_METRICS '+json.dumps(row),flush=True)
 rows[label]=row

if '--check-fade-bound' in sys.argv[2:]:
 # The final OUT step is 1/72 of a normalized RGB delta. Even if the
 # underlying tone result differs by the full [0,1] range, quantization to
 # eight bits can change a channel by at most ceil(255/72). This is a
 # mathematical bound for this fixture, not a Gold-acceptance tolerance.
 max_channel=math.ceil(255.0/(588-516))
 if rows['out_last']['max_abs_rgb'] > max_channel or rows['cleared']['changed_pixels'] != 0:
  raise SystemExit('D19 world OUT exceeded the normalized one-tick fade bound or failed to restore baseline')
 print(f'D19_WORLD_OUT_FADE_BOUND max_allowed={max_channel} actual={rows["out_last"]["max_abs_rgb"]} cleared=0',flush=True)
