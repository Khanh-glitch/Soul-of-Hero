"""Spatial comparison of the diagnostic A-only path and original A field.

Linear source RGB only; A original reference has no arena/base/trail/post. No
threshold is used to hide pixels or to declare the complete fusion acceptable.
"""
import json,pathlib,sys
import numpy as np
from PIL import Image
root=pathlib.Path(sys.argv[1]); w,h=416,234
for tick in (87,183,247,327):
 a=np.fromfile(root/f'a11_original_{tick}.rgb32f','<f4').reshape(h,w,3).astype(np.float64)
 b=np.fromfile(root/f'a11_restored_{tick}.rgb32f','<f4').reshape(h,w,3).astype(np.float64)
 diff=np.abs(a-b); aa=np.any(a!=0,axis=2);bb=np.any(b!=0,axis=2)
 union=np.count_nonzero(aa|bb); iou=np.count_nonzero(aa&bb)/union if union else 1.0
 regions={}
 for name,x0,y0,x1,y1 in [('full',0,0,w,h),('rotor',100,35,360,220),('outside',0,0,w,35)]:
  d=diff[y0:y1,x0:x1];regions[name]={'mae':float(d.mean()),'max':float(d.max())}
 report={'tick':tick,'support_iou':iou,'regions':regions,'sum_original':a.sum(axis=(0,1)).tolist(),'sum_restored':b.sum(axis=(0,1)).tolist(),'scope':'A-only raw linear source, no arena/trail/post, not fusion/world parity'}
 (root/f'a11_restored_{tick}.json').write_text(json.dumps(report,indent=2)+'\n')
 # Linear absolute error heatmap, common fixed mapping; dark values are not
 # discarded from either source. It is diagnostic, not an acceptance mask.
 heat=np.rint(np.clip(diff.max(axis=2),0,1)*255).astype('uint8');Image.fromarray(heat,'L').save(root/f'a11_restored_{tick}_error.png')
 print('::notice title=A11_A_SOURCE_SPATIAL::'+json.dumps(report,separators=(',',':')))
