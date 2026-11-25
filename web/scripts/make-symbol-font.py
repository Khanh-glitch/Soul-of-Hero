#!/usr/bin/env python3
"""Rebuild src/fonts/soh-symbols.woff2: the symbols the UI prints that neither bundled pixel font has.

VT323 and Pixelify Sans carry no arrows, stars, gender signs, weather signs and so on. Without this file those
characters came from whatever symbol font the player's system had, or showed as an empty box where it had none.
The script scans src/ for every non-ASCII character, keeps the ones missing from both UI fonts, and takes their
outlines from Noto Sans Symbols, Noto Sans Symbols 2 and Noto Sans Math (SIL OFL 1.1). CJK text in source
comments is ignored (none of the three fonts has it and the UI does not print it).

Needs: pip install fonttools brotli; npm i --no-save @fontsource/noto-sans-symbols @fontsource/noto-sans-symbols-2
@fontsource/noto-sans-math. Run from web/. After a run, copy the printed unicode-range into src/index.css.
"""
import glob, os
from fontTools import merge, subset
from fontTools.ttLib import TTFont

def cmap(pattern):
    have = set()
    for path in glob.glob(pattern):
        have |= set(TTFont(path).getBestCmap())
    return have

ui = cmap('node_modules/@fontsource/vt323/files/*400-normal.woff2') | cmap('node_modules/@fontsource/pixelify-sans/files/*400-normal.woff2')
used = set()
for path in glob.glob('src/**/*.ts*', recursive=True):
    used |= {ord(ch) for ch in open(path, encoding='utf8').read() if ord(ch) > 0x7e}
missing = sorted(used - ui)

sources = [p for pat in ('noto-sans-symbols', 'noto-sans-math', 'noto-sans-symbols-2') for p in sorted(glob.glob(f'node_modules/@fontsource/{pat}/files/*400-normal.woff2'))]
plan, left = {}, list(missing)
for path in sources:
    have = set(TTFont(path).getBestCmap())
    take = [c for c in left if c in have]
    if take:
        plan[path] = take
        left = [c for c in left if c not in have]

parts = []
for i, (path, take) in enumerate(plan.items()):
    opts = subset.Options(); opts.layout_features = []; opts.hinting = False; opts.glyph_names = False; opts.notdef_outline = True
    opts.drop_tables += ['MATH', 'GDEF', 'GSUB', 'GPOS', 'vhea', 'vmtx', 'DSIG', 'STAT', 'meta', 'BASE', 'JSTF', 'gasp', 'prep', 'fpgm', 'cvt ']
    font = TTFont(path); s = subset.Subsetter(opts); s.populate(unicodes=take); s.subset(font); font.flavor = None
    out = f'/tmp/soh-symbols-part{i}.ttf'; font.save(out); parts.append(out)
font = merge.Merger().merge(parts)
for rec in list(font['name'].names):
    if rec.nameID in (1, 4, 16): font['name'].setName('SOH Symbols', rec.nameID, rec.platformID, rec.platEncID, rec.langID)
    if rec.nameID == 6: font['name'].setName('SOHSymbols', rec.nameID, rec.platformID, rec.platEncID, rec.langID)
font.flavor = 'woff2'; os.makedirs('src/fonts', exist_ok=True); font.save('src/fonts/soh-symbols.woff2')
got = sorted(TTFont('src/fonts/soh-symbols.woff2').getBestCmap())
print(len(got), 'glyphs,', os.path.getsize('src/fonts/soh-symbols.woff2'), 'bytes')
print('unicode-range:', ','.join(f'U+{c:X}' for c in got))
print('not covered (CJK in comments is expected):', len(left), ''.join(chr(c) for c in left if c < 0x3000))
