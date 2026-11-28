"""Cut, shape, level and encode the game's sound files from the raw library, by recipe.

  make.py <recipe.txt> <out dir> [--only <slot prefix>] [--dry]

Recipe: one take per line, `slot | source file prefix | options`. Lines for the same slot become takes 01, 02, ...
Options (space separated):
  ev=I[@gap]     the I-th sound event of the file (split on silence, gap in seconds, default 0.12)
  at=S len=L     an explicit region in seconds (len optional)
  grain=I/N      the I-th (in time) of the N strongest onsets inside the region; glen=0.14 its length
  max=L          cap the length (fades out)            min=L  pad up to nothing, only reported
  rate=R         play faster (R>1: shorter, higher) or slower
  hp=F lp=F      high-pass / low-pass in Hz             rev   reversed
  fi=S fo=S      fade in / out seconds                  raw   keep the lead-in (no onset trim)
  T=dB           level target override                  st    keep stereo (default for beds)
  xf=S           loop crossfade seconds (beds, loops)   tail=dB  where the ring-out is cut (default -48)
  thr=dB         onset threshold relative to the peak (default -32)
Output: <out>/<group>/<slot>__NN.ogg and <out>/manifest.json (level trim `g` per file for index.json).
"""
import sys, os, json, subprocess, tempfile, re
import numpy as np, soundfile as sf
from scipy import signal
sys.path.insert(0, os.path.dirname(__file__))
import sfxlib
from sfxlib import load, mono, db, segments, loud, loud_int, centroid, env, SR

import imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
SLOTS = json.load(open(os.path.join(sfxlib.WORK, 'slots.json')))      # written by: node scripts/sfx.mjs dump

# Level target per class: K-weighted level of the loudest 100 ms (one-shots) or integrated (beds, loops),
# as heard at slot volume 1. The slot's own `vol` then sets the nuance inside the class.
TARGET = {'ui': -25, 'item': -26, 'prog': -21, 'step': -33, 'player': -22, 'warn': -24, 'swing': -27, 'hit': -18,
          'gather': -20, 'cr': -21, 'elder': -17, 'haz': -19, 'core': -19, 'fire': -17, 'build': -21, 'door': -23,
          'box': -23, 'station': -23, 'farm': -24, 'ride': -21, 'npc': -24, 'amb': -22, 'bed': -22, 'loop': -24}

def filt(x, kind, f, order=2):
    sos = signal.butter(order, f, kind, fs=SR, output='sos')
    return signal.sosfiltfilt(sos, x, axis=0)

def grains(x, n, glen, minsep=0.16):
    x = x if x.ndim == 1 else x.mean(axis=1)
    e = env(x, SR, 0.005); order = np.argsort(e)[::-1]; picked = []
    for i in order:
        if all(abs(i - j) * 0.005 >= minsep for j in picked): picked.append(int(i))
        if len(picked) >= n: break
    return sorted(picked)

def fade(x, fi, fo):
    n = len(x); a = int(min(fi * SR, n // 2)); b = int(min(fo * SR, n - a))
    w = np.ones(n)
    if a > 0: w[:a] = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    if b > 0: w[n - b:] = np.cos(np.linspace(0, np.pi / 2, b)) ** 2
    return x * (w[:, None] if x.ndim == 2 else w)

def tomono(x):
    if x.ndim == 1: return x
    if x.shape[1] == 1: return x[:, 0]
    m = x.mean(axis=1)
    # a wide or out-of-phase stereo image thins out when summed: then keep the stronger side
    if np.sqrt((m ** 2).mean()) < 0.6 * np.sqrt((x ** 2).mean()):
        return x[:, int(np.argmax((x ** 2).mean(axis=0)))]
    return m

def cut(src, o, mode):
    x = load(src)
    if 'at' in o:
        a = int(float(o['at']) * SR); b = a + int(float(o['len']) * SR) if 'len' in o else len(x)
        x = x[a:b]
    if 'ev' in o:
        idx, _, gap = o['ev'].partition('@')
        segs = segments(x, SR, gap=float(gap or 0.12))
        if int(idx) >= len(segs): raise SystemExit(f'{src}: event {idx} of {len(segs)}')
        a, b = segs[int(idx)]; x = x[a:b]
    x = np.array(x, dtype='float64')
    x = filt(x, 'highpass', float(o.get('hp', 35 if mode == 'shot' else 25)))
    if 'lp' in o: x = filt(x, 'lowpass', float(o['lp']))
    if 'grain' in o:
        i, n = (int(v) for v in o['grain'].split('/')); glen = float(o.get('glen', 0.14))
        g = grains(x, n, glen, float(o.get('sep', 0.16)))
        if i >= len(g): raise SystemExit(f'{src}: grain {i} of {len(g)}')
        c = g[i] * int(SR * 0.005); a = max(0, c - int(float(o.get('pre', 0.03)) * SR)); x = x[a:c + int(glen * SR)]
    stereo = mode == 'bed' or 'st' in o
    x = x if (stereo and x.ndim == 2 and x.shape[1] == 2) else tomono(x)
    if 'rate' in o:
        r = float(o['rate']); up, down = 1000, int(round(1000 * r))
        x = signal.resample_poly(x, up, down, axis=0)
    if 'rev' in o: x = x[::-1].copy()
    return x

def pattern(x, o):
    """Repeat the cut at the given times: pat=0:1,0.28:0.7 ; pad=L sets the total length."""
    hits = [(float(t), float(g)) for t, g in (v.split(':') for v in o['pat'].split(','))]
    n = max(int((max(t for t, _ in hits)) * SR) + len(x), int(float(o.get('pad', 0)) * SR))
    y = np.zeros((n,) + x.shape[1:])
    for t, g in hits:
        a = int(t * SR); y[a:a + len(x)] += x[:n - a] * g
    return y

def shot(x, o):
    m = np.abs(x if x.ndim == 1 else x.max(axis=1)); pk = m.max()
    if pk <= 0: raise SystemExit('silent cut')
    if 'raw' not in o:
        thr = pk * 10 ** (float(o.get('thr', -32)) / 20); first = int(np.argmax(m > thr))
        x = x[max(0, first - int(0.003 * SR)):]
        m = np.abs(x if x.ndim == 1 else x.max(axis=1))
    # ring-out: last moment the 10 ms envelope is above `tail` dB of the peak
    n = int(SR * 0.01); k = len(m) // n
    if k > 2:
        e = m[:k * n].reshape(k, n).max(axis=1); above = np.flatnonzero(e > pk * 10 ** (float(o.get('tail', -48)) / 20))
        end = min(len(x), (int(above[-1]) + 2) * n) if len(above) else len(x)
        x = x[:end]
    capped = False
    if 'max' in o and len(x) > float(o['max']) * SR: x = x[:int(float(o['max']) * SR)]; capped = True
    L = len(x) / SR
    fo = float(o['fo']) if 'fo' in o else (min(0.4 * L, 0.5) if capped else min(0.15 * L, 0.03))
    return fade(x, float(o.get('fi', 0.002)), fo)

def loop(x, o, mode):
    """Seamless loop: the head is cross-faded with the material that follows the tail."""
    xf = float(o.get('xf', 2.0 if mode == 'bed' else 0.5)); X = int(xf * SR)
    if len(x) < 3 * X: raise SystemExit('loop region too short for the crossfade')
    L = len(x) - X; t = np.linspace(0, np.pi / 2, X)
    fin, fout = np.sin(t), np.cos(t)                       # equal power: the two ends are not correlated
    if x.ndim == 2: fin, fout = fin[:, None], fout[:, None]
    y = x[:L].copy(); y[:X] = x[:X] * fin + x[L:L + X] * fout
    return y

def encode(x, path, mode):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as t: tmp = t.name
    sf.write(tmp, x.astype('float32'), SR, subtype='FLOAT')
    rate = '48000' if mode != 'shot' else '44100'
    q = '2.5' if mode == 'bed' else '3.5'
    subprocess.run([FF, '-v', 'error', '-y', '-i', tmp, '-map_metadata', '-1', '-ar', rate, '-c:a', 'libvorbis', '-q:a', q, path], check=True)
    os.unlink(tmp)

def main():
    recipe, out = sys.argv[1], sys.argv[2]
    only = sys.argv[sys.argv.index('--only') + 1] if '--only' in sys.argv else ''
    dry = '--dry' in sys.argv
    lines = []
    for ln, raw in enumerate(open(recipe, encoding='utf8'), 1):
        s = '' if raw.lstrip().startswith('#') else raw.strip()
        if not s: continue
        p = [v.strip() for v in s.split('|')]
        if len(p) < 2: raise SystemExit(f'line {ln}: {raw}')
        o = {}
        for tok in (p[2].split() if len(p) > 2 else []):
            k, _, v = tok.partition('='); o[k] = v if v else True
        if p[0] not in SLOTS: raise SystemExit(f'line {ln}: unknown slot {p[0]}')
        sfxlib.find(p[1])
        lines.append((p[0], p[1], o, ln))
    take = {}; rows = []
    todo = []
    for slot, src, o, ln in lines:
        take[slot] = take.get(slot, 0) + 1
        if slot.startswith(only): todo.append((slot, src, o, ln, take[slot]))
    sfxlib._cache.clear()
    for slot, src, o, ln, tk in sorted(todo, key=lambda r: r[1]):
        S = SLOTS[slot]; mode = S['mode']; grp = S['group']
        try:
            x = cut(src, o, mode)
            if 'pat' in o: x = pattern(shot(x, o), o)
            elif mode == 'shot': x = shot(x, o)
            if mode != 'shot' and float(o.get('xf', 1)) > 0: x = loop(x, o, mode)
        except SystemExit as e:
            raise SystemExit(f'line {ln} ({slot}): {e}')
        pk = np.abs(x).max(); x = x * (10 ** (-2 / 20) / pk)
        lvl = loud_int(x) if mode != 'shot' else loud(x, SR, 0.1)
        T = float(o['T']) if 'T' in o else TARGET[grp]
        g = float(np.clip(10 ** ((T - lvl) / 20), 0.02, 4))
        rel = f'{grp}/{slot}__{tk:02d}.ogg'; path = os.path.join(out, rel)
        if not dry: encode(x, path, mode)
        rows.append(dict(slot=slot, take=tk, f=rel, src=os.path.basename(sfxlib.find(src)), dur=round(len(x) / SR, 3), lvl=round(float(lvl), 1), g=round(g, 3),
                         cen=int(centroid(x)), ch=1 if x.ndim == 1 else 2, bytes=os.path.getsize(path) if not dry else 0, opts=' '.join(f'{k}={v}' if v is not True else k for k, v in o.items())))
    rows.sort(key=lambda r: (r['slot'], r['take']))
    for r in rows:
        want = SLOTS[r['slot']]['len']
        print(f"{r['f']:44s} {r['dur']:7.2f}s  L {r['lvl']:6.1f}  g {r['g']:5.2f}  cen {r['cen']:5d}  {r['bytes'] / 1024:6.1f}k  [{want}]  <- {r['src'][:38]} {r['opts']}")
    if not dry and not only:
        json.dump(rows, open(os.path.join(out, 'manifest.json'), 'w'), indent=0)
    print(f'{len(rows)} files, {sum(r["bytes"] for r in rows) / 1e6:.2f} MB')

if __name__ == '__main__': main()
