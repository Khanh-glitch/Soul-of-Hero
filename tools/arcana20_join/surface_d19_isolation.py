#!/usr/bin/env python3
"""Extract matched 1:1 world crops and metrics; no effect-derived render key."""
import json, pathlib, re, sys
import numpy as np
from PIL import Image
src=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
log=pathlib.Path(sys.argv[3]).read_text(errors='replace')
rows=[json.loads(x) for x in re.findall(r'D19_ISOLATION (\{[^\n]*\})',log)]
assert len(rows)==2 and {r['tick'] for r in rows}=={489,516}, rows
baseline=np.asarray(Image.open(src/'phase_baseline.png').convert('RGB'),dtype=np.int16)
lum=lambda a:(a[:,:,0]*0.2126+a[:,:,1]*0.7152+a[:,:,2]*0.0722)
for row in rows:
    tick=row['tick']; names=['source_formula','shimmer_off','bounded','layered','warp_only','source_light','star_only','body_only','source_restored']
    images={name:np.asarray(Image.open(src/f'd19_{tick}_{name}.png').convert('RGB'),dtype=np.int16) for name in names}
    assert np.array_equal(images['source_formula'],images['source_restored'])
    diff=np.any(images['source_formula']!=images['shimmer_off'],axis=2)
    ys,xs=np.nonzero(diff);assert len(xs)>100
    cx=int((xs.min()+xs.max())/2);cy=int((ys.min()+ys.max())/2)
    h,w=baseline.shape[:2]; cw,ch=640,440;x0=max(0,min(w-cw,cx-cw//2));y0=max(0,min(h-ch,cy-ch//2))
    crop=lambda im: Image.fromarray(np.uint8(im[y0:y0+ch,x0:x0+cw]))
    crop(baseline).save(out/f'{tick}-world-base.png',optimize=True)
    for name in names:crop(images[name]).save(out/f'{tick}-{name}.png',optimize=True)
    Image.open(src/f'd19_native_source_{tick}.png').save(out/f'{tick}-native-source.png',optimize=True)
    area=diff
    row.update({'crop':[x0,y0,cw,ch],'changed_pixels_on_vs_off':int(diff.sum()),
        'world_base_mean_luma_in_changed_pixels':float(lum(baseline)[area].mean()),
        'states':{name:{'luma_min':float(lum(a)[area].min()),'luma_max':float(lum(a)[area].max()),'luma_mean':float(lum(a)[area].mean()),'clipped_white_pixels':int(np.all(a[area]>=250,axis=1).sum()),'diff_from_world_sum_abs_rgb':int(np.abs(a-baseline).sum())} for name,a in images.items()},
        'scope':'native 1x crop of matched, frozen real overworld; no GPU, HDR or art approval'})
(out/'metrics.json').write_text(json.dumps(rows,indent=2)+'\n')
print('D19_MATCHED_METRICS '+json.dumps(rows,separators=(',',':')))
