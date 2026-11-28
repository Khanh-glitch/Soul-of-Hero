"""Shared audio helpers for the Soul of Hero SFX import (numpy/scipy/soundfile)."""
import os, glob, numpy as np, soundfile as sf
from scipy import signal
WORK = os.environ.get('SFX_WORK', os.path.expanduser('~/sfxwork'))     # raw recordings and built audio live outside the repo
SRC = os.environ.get('SFX_SRC', os.path.join(WORK, 'src'))
HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(os.path.dirname(HERE))
SR = 44100
_cache = {}
def find(prefix):
    m = sorted(glob.glob(os.path.join(SRC, '*'.join(glob.escape(v) for v in prefix.split('**')) + '*')))
    if len(m) != 1: raise SystemExit(f'source "{prefix}": {len(m)} matches')
    return m[0]
def load(prefix, sr=SR):
    """-> float32 array (n, ch) resampled to sr."""
    key = (prefix, sr)
    if key in _cache: return _cache[key]
    path = find(prefix); x, fs = sf.read(path, dtype='float32', always_2d=True)
    if x.shape[1] > 2: x = x[:, :2]
    if fs != sr:
        g = np.gcd(int(fs), int(sr)); x = signal.resample_poly(x, sr // g, fs // g, axis=0).astype('float32')
    if len(_cache) > 6: _cache.pop(next(iter(_cache)))
    _cache[key] = x; return x
def mono(x): return x.mean(axis=1) if x.ndim == 2 else x
def db(v): return 20 * np.log10(np.maximum(v, 1e-9))
def env(x, sr=SR, win=0.005):
    m = np.abs(mono(x)); n = max(1, int(sr * win)); k = len(m) // n
    return m[:k * n].reshape(k, n).max(axis=1) if k else np.array([m.max() if len(m) else 0.0])
def segments(x, sr=SR, gap=0.12, thresh=-40.0, floor=None, minlen=0.02, pre=0.004, tail=-55.0):
    """Split on silence. thresh/tail are dB relative to the file peak. -> list of (start, end) samples."""
    win = 0.005; e = env(x, sr, win); pk = e.max()
    if pk <= 0: return []
    ed = db(e / pk); on = ed > thresh; idx = np.flatnonzero(on)
    if not len(idx): return []
    gapw = int(gap / win); segs = []; s = idx[0]; p = idx[0]
    for i in idx[1:]:
        if i - p > gapw: segs.append((s, p)); s = i
        p = i
    segs.append((s, p)); out = []; n = int(sr * win)
    for j, (s, e2) in enumerate(segs):
        lim = segs[j + 1][0] - 1 if j + 1 < len(segs) else len(ed) - 1
        t = e2
        while t < lim and ed[t + 1] > tail: t += 1      # follow the tail down
        if (t - s + 1) * win < minlen: continue
        out.append((max(0, int(s * n - pre * sr)), min(len(x), (t + 1) * n)))
    return out
_kw = {}
def kweight(x, sr=SR):
    if sr not in _kw:
        # ITU-R BS.1770 K-weighting (shelf + high-pass), coefficients recomputed for sr
        f0, G, Q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
        K = np.tan(np.pi * f0 / sr); Vh = 10 ** (G / 20); Vb = Vh ** 0.4996667741545416; a0 = 1 + K / Q + K * K
        b1 = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0]; a1 = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
        f0, Q = 38.13547087602444, 0.5003270373238773; K = np.tan(np.pi * f0 / sr); a0 = 1 + K / Q + K * K
        b2 = [1, -2, 1]; a2 = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0]
        _kw[sr] = (b1, a1, b2, a2)
    b1, a1, b2, a2 = _kw[sr]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=0), axis=0)
def loud(x, sr=SR, win=0.1):
    """K-weighted level (LUFS-like) of the loudest `win` seconds. Works on very short clips."""
    k = kweight(x if x.ndim == 2 else x[:, None], sr); p = (k ** 2).sum(axis=1) if k.shape[1] > 1 else k[:, 0] ** 2
    n = int(sr * win)
    if len(p) <= n: m = p.sum() / n
    else:
        c = np.cumsum(np.concatenate([[0.0], p])); m = (c[n:] - c[:-n]).max() / n
    return -0.691 + 10 * np.log10(max(m, 1e-12))
def loud_int(x, sr=SR):
    """Gated integrated loudness (BS.1770) for long material."""
    k = kweight(x if x.ndim == 2 else x[:, None], sr); p = (k ** 2).sum(axis=1); n = int(sr * 0.4); h = int(sr * 0.1)
    if len(p) < n: return loud(x, sr, 0.4)
    c = np.cumsum(np.concatenate([[0.0], p])); z = (c[n::h] - c[:-n:h]) / n; l = -0.691 + 10 * np.log10(np.maximum(z, 1e-12))
    z1 = z[l > -70]
    if not len(z1): return -70.0
    rel = -0.691 + 10 * np.log10(z1.mean()) - 10; z2 = z[(l > -70) & (l > rel)]
    return -0.691 + 10 * np.log10(z2.mean()) if len(z2) else -70.0
def centroid(x, sr=SR):
    m = mono(x); n = min(len(m), sr); 
    if n < 64: return 0.0
    s = np.abs(np.fft.rfft(m[:n] * np.hanning(n))); f = np.fft.rfftfreq(n, 1 / sr)
    return float((s * f).sum() / max(s.sum(), 1e-9))
