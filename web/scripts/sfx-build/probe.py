import sys, os, glob, numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(__file__)); from sfxlib import *
args = sys.argv[1:]; gap = 0.12; detail = False
if args and args[0].startswith('gap='): gap = float(args.pop(0)[4:])
if args and args[0] == '-d': detail = True; args.pop(0)
files = [find(a) for a in args] if args else sorted(glob.glob(SRC + '/*'), key=os.path.getmtime)
for p in files:
    try: i = sf.info(p)
    except Exception as e: print('ERR', os.path.basename(p)[:60], e); continue
    name = os.path.basename(p)
    if i.duration > 400: print(f'{name[:46]:46s} {i.samplerate//1000}k {i.channels}ch {i.duration:7.1f}s  (long, not analysed)'); continue
    x = load(name); pk = db(np.abs(x).max()); sg = segments(x, gap=gap) if i.duration < 200 else []
    ds = [(e - s) / SR for s, e in sg]
    line = f'{name[:46]:46s} {i.samplerate//1000}k {i.channels}ch {i.duration:7.2f}s pk{pk:6.1f} L{loud_int(x) if i.duration>3 else loud(x):6.1f} cen{centroid(x):6.0f} ev{len(sg):3d}'
    if ds: line += ' [' + ' '.join(f'{d:.2f}' for d in ds[:14]) + (' …' if len(ds) > 14 else '') + ']'
    print(line)
    if detail:
        for j, (s, e) in enumerate(sg): c = x[s:e]; print(f'    #{j:2d} @{s/SR:7.2f}s len {(e-s)/SR:5.2f}s pk{db(np.abs(c).max()):6.1f} L{loud(c):6.1f} cen{centroid(c):6.0f}')
