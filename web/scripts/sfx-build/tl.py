# coarse loudness timeline: tl.py <step_seconds> <prefix> ...
import sys, os, numpy as np
sys.path.insert(0, os.path.dirname(__file__)); from sfxlib import *
step = float(sys.argv[1])
for a in sys.argv[2:]:
    x = mono(load(a)); n = int(SR * step); k = len(x) // n
    r = db(np.sqrt((x[:k * n].reshape(k, n) ** 2).mean(axis=1)))
    print(os.path.basename(find(a))[:40], f'step {step}s:', ' '.join(f'{v:.0f}' for v in r))
