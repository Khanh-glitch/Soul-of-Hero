"""Image-space output deltas on the real frozen overworld, diagnostic only.
These are measurements against the identical no-cast world, not a render key.
"""
import json,pathlib,sys
import numpy as np
from PIL import Image
p=next(pathlib.Path(sys.argv[1]).rglob('phase_baseline.png')).parent
base=np.asarray(Image.open(p/'phase_baseline.png').convert('RGB'),dtype=np.int16)
for label,tick in [('out_start',516),('out_withdraw',540),('out_converge',564),('late',582),('out_last',587),('cleared',None)]:
 name=f'phase_19_{label}_tick{tick}.png' if tick is not None else 'phase_19_cleared.png'
 im=np.asarray(Image.open(p/name).convert('RGB'),dtype=np.int16)
 diff=np.abs(im-base);change=np.any(diff!=0,axis=2)
 row={'label':label,'tick':tick,'changed_pixels':int(change.sum()),'sum_abs_rgb':int(diff.sum()),'max_abs_rgb':int(diff.max()),'mean_abs_rgb_per_pixel':float(diff.mean()),'scope':'actual frozen e552 overworld, no HUD post isolation or Gold comparison'}
 print('D19_WORLD_OUT_METRICS '+json.dumps(row),flush=True)
