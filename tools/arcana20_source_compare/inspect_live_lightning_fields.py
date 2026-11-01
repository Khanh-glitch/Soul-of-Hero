"""Quantify captured full A source fields and registered on-screen samples.

Input is genuine moving-world capture. Replayed current-connector float field
is optional and has no authority over the live frame. Screen samples are
actual RGB, not a contrast estimate: live terrain, actors, bloom and other
strokes are mixed there, and no same-frame no-FX image is available.
"""
import json
import pathlib
import sys
import numpy as np
from PIL import Image

root = pathlib.Path(sys.argv[1]); timeline = json.loads((root/'timeline.json').read_text())
results = []
for file in sorted(root.glob('r17_*.json')):
    r = json.loads(file.read_text()); tick = r['source_tick']
    rgb = np.fromfile(file.with_suffix('.rgb32f'), '<f4').reshape(234,416,3)
    coverage = np.fromfile(file.with_suffix('.coverage32f'), '<f4').reshape(234,416)
    influence = np.fromfile(file.with_suffix('.influence8'), np.uint8).reshape(234,416)
    info = {'skill':r['skill'], 'source_tick':tick, 'frame_index':r['frame_index'],
            'source_scale':r['source_scale'], 'camera_zoom':r['camera_zoom'],
            'influence_pixels':int(np.count_nonzero(influence)),
            'coverage_nonzero_pixels':int(np.count_nonzero(coverage)),
            'coverage_min':float(coverage.min()), 'coverage_max':float(coverage.max()),
            'rgb_min':rgb.min(axis=(0,1)).tolist(), 'rgb_max':rgb.max(axis=(0,1)).tolist(),
            'rgb_sum':rgb.astype('float64').sum(axis=(0,1)).tolist(),
            'exposure':r['exposure'], 'bloom':r['bloom'],
            'scope':'full A source field; sampled framebuffer is after world composition and HUD'}
    replay = file.with_suffix('.current-connector.rgb32f')
    if replay.exists():
        bolt = np.fromfile(replay, '<f4').reshape(234,416,3)
        # This is exact nonzero support for inspection, not a display key.
        y,x = np.nonzero(np.any(bolt != 0, axis=2))
        info['connector_support_source_pixels'] = int(len(x))
        info['connector_rgb_max'] = bolt.max(axis=(0,1)).tolist()
        if len(x):
            # Native source texels -> live world -> canvas -> 1280x720 capture.
            m=r['source_to_world']; c=r['canvas_transform']
            wx=m[0]*(x+.5)+m[2]*(y+.5)+m[4]; wy=m[1]*(x+.5)+m[3]*(y+.5)+m[5]
            sx=np.floor(2*(c[0]*wx+c[2]*wy+c[4])).astype(int)
            sy=np.floor(2*(c[1]*wx+c[3]*wy+c[5])).astype(int)
            image = np.asarray(Image.open(root/timeline['frames'][r['frame_index']]['file']).convert('RGB'))
            inside=(sx>=0)&(sy>=0)&(sx<image.shape[1])&(sy<image.shape[0])
            samples=image[sy[inside],sx[inside]]
            info['projected_connector_samples_on_screen']=int(len(samples))
            if len(samples):
                info['screen_rgb_median']=np.median(samples,axis=0).tolist()
                info['screen_rgb_p10']=np.percentile(samples,10,axis=0).tolist()
                info['screen_rgb_p90']=np.percentile(samples,90,axis=0).tolist()
                info['screen_sampling_caveat']='pixel-aligned projection approximation; other content and occlusion included; NOT isolated contrast'
    results.append(info)
    print('::notice title=R17_FIELD_METRICS::'+json.dumps(info,separators=(',',':')))
(root/'lightning-field-metrics.json').write_text(json.dumps(results,indent=2)+'\n')
if not results: raise SystemExit('no captured lightning fields')
