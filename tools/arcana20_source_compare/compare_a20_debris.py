"""Original A20 vs native motion/particle ledger, same A path and ticks.
Actual fusion contour mapping and live-world pixels are separate JOIN gates.
"""
import json, math, pathlib, sys
p=pathlib.Path(sys.argv[1]); original=json.loads((p/'a20_original.json').read_text())['frames']; native=json.loads((p/'a20_native.json').read_text())
for tick in (318,320,326,336,360,420):
    a,b=original[str(tick)],native[str(tick)]
    if len(a)!=len(b): raise SystemExit(f'tick={tick} count original={len(a)} native={len(b)}')
    maxima={}
    for i,(p1,p2) in enumerate(zip(a,b)):
        for key in p1:
            d=abs(float(p1[key])-float(p2[key]));maxima[key]=max(maxima.get(key,0),d)
            if not math.isfinite(d) or d>1e-6: raise SystemExit(f'tick={tick} particle={i} field={key} original={p1[key]} native={p2[key]} difference={d}')
    print(f'A20_DEBRIS_MOTION tick={tick} count={len(a)} max_error={max(maxima.values(),default=0):.9g}',flush=True)
print('A20_DEBRIS_MOTION PASS; original-path particle simulation only, not fused visual/world parity')
