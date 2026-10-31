"""Camera translation diagnostics on live-world paired captures, never alpha.
Change masks measure cast-vs-same-camera-baseline differences; no mask is fed
back to rendering. IoU is a measurement, not approval or a tolerance gate."""
import json, pathlib, sys
import numpy as np
from PIL import Image
p=pathlib.Path(sys.argv[1]); report=json.loads((p/'all20_sweep.json').read_text())
def image(name): return np.asarray(Image.open(p/name).convert('RGB'),dtype=np.int16)
base=image('sweep_baseline.png'); shifted_base=image('sweep_baseline_shifted.png'); H,W=base.shape[:2]
for row in report['records']:
    if 'camera_pixel_delta' not in row: continue
    n=row['id']; delta=row['camera_pixel_delta']; dx,dy=map(lambda v:int(round(v)),delta)
    if abs(delta[0]-dx)>0.01 or abs(delta[1]-dy)>0.01:
        row['camera_pixel_metrics']={'not_measured':'noninteger screen displacement'}; continue
    original=image(f'sweep_{n:02d}.png')-base
    moved=image(f'sweep_{n:02d}_shifted.png')-shifted_base
    x0=max(0,-dx); x1=min(W,W-dx); y0=max(0,-dy); y1=min(H,H-dy)
    a=original[y0:y1,x0:x1]; b=moved[y0+dy:y1+dy,x0+dx:x1+dx]
    am=np.any(a!=0,axis=2); bm=np.any(b!=0,axis=2)
    union=np.count_nonzero(am|bm); intersect=np.count_nonzero(am&bm)
    dif=np.abs(a-b); heat=np.clip(np.max(dif,axis=2),0,255).astype(np.uint8)
    Image.fromarray(heat,'L').save(p/f'sweep_{n:02d}_camera_heat.png')
    row['camera_pixel_metrics']={'shift_pixels':[dx,dy], 'intersection':int(intersect), 'union':int(union),
        'change_mask_iou':float(intersect/union) if union else None,
        'difference_rgb_mae':float(dif.mean()),'difference_rgb_max':int(dif.max())}
    print('SWEEP_CAMERA',json.dumps({'id':n,**row['camera_pixel_metrics']}),flush=True)
(p/'all20_camera_comparison.json').write_text(json.dumps(report,indent=2))
