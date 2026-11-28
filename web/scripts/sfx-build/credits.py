"""Write docs/sfx/NGUON_AM_THANH.md: every shipped sound file, the library recording it was cut from, and who made it."""
import json, glob, os, re
from sfxlib import WORK, WEB, HERE
OUT = os.path.join(WORK, 'out'); DOC = os.path.join(os.path.dirname(WEB), 'docs', 'sfx', 'NGUON_AM_THANH.md')
m = json.load(open(os.path.join(OUT, 'manifest.json')))
lib = {}
for p in sorted(glob.glob(os.path.join(WORK, 'lists', 'Part*.tsv'))):       # the file lists that come with the bundles
    for l in list(open(p, encoding='utf8', errors='replace'))[3:]:
        r = l.rstrip('\n').split('\t')
        if len(r) >= 3 and r[0]: lib[r[0].strip().lower()] = (r[1].strip(), r[2].strip())
# Older bundles have no file list: library and maker come from the Drive folder each file sat in.
OLD = [
    (r'^EFX (INT|EXT) (Dog|Mutt)', 'Dog', 'Coll Anderson'), (r'^EFX SD GORE', 'Gore', 'Coll Anderson'), (r'^EFX (INT|EXT) (HOUSE|Bulkhead|Knife)', 'House', 'Coll Anderson'),
    (r'^EFX SD Metal plate', 'Metal Plate', 'Coll Anderson'), (r'^EFX SD Pig', 'Pig', 'Coll Anderson'), (r'^EFX SD (Aggressive|Rage)', 'Monster Zombie Vocal', 'Coll Anderson'),
    (r'^(Bread|Celery|Ice|Frozen),', 'Crunch Mode', 'Mattia Cellotto'),
    (r'_MB \d+\.wav$', 'Ambience and Weather', 'Mechanical Wave'), (r'_VS \d+\.wav$', 'Foley Session 01', 'Mechanical Wave'), (r'_HW \d+\.wav$', 'Hits and Whoosh', 'Mechanical Wave'),
    (r'_RBD \d+\.wav$', 'Rock, Brick and Dirt', 'Mechanical Wave'), (r'_VM \d+\.wav$', 'Vegetable Massacres', 'Mechanical Wave'),
    (r'^Bone Cracking', 'Bone Crackings', 'Membrans'), (r'^Cartoon Arrow', 'Cartoon Arrow', 'Membrans'), (r'^Monster \d+\.wav$', 'Monster Pack', 'Membrans'), (r'^Pop \d+\.wav$', 'Pops', 'Membrans'),
    (r'HK1\.wav$', 'HK Hit Kit 1', 'NoizBoy'), (r'^HKAP2', 'HK Hit Kit 2', 'NoizBoy'),
    (r'^(Creature (Hiss|Roar|Screeches|Combo)|Growl Dry|Hisses Dry|Roar Dry)', 'RDGSFX002 Creatures', 'RDGSFX'), (r'^SQUEAKS AND CREAKS', 'RDGSFX005 Squeaks and Creaks', 'RDGSFX'),
    (r'^California Beaches', 'RDGSFX006 California Beaches', 'RDGSFX'), (r'^RIPS AND TEARS', 'RDGSFX007 Rips and Tears', 'RDGSFX'), (r'^Metal (Shelf|Moans)', 'RDGSFX008 Metal Shelf', 'RDGSFX'),
]
# The bundle lists spell some makers in more than one way.
SAME = {'CB_Sounddesign': 'CB Sound Design', 'DavidDumais': 'David Dumais Audio', 'Justsoundeffects': 'Just Sound Effects', 'BluezoneCorp': 'Bluezone Corporation'}
def who(name):
    if name.lower() in lib: l, s = lib[name.lower()]; return (l, SAME.get(s, s))
    for rx, l, s in OLD:
        if re.search(rx, name): return (l, s)
    return ('?', '?')
rows = sorted(m, key=lambda r: (r['slot'], r['take']))
unknown = sorted({r['src'] for r in rows if who(r['src'])[1] == '?'})
by = {}
for r in rows: l, s = who(r['src']); by.setdefault(s, {}).setdefault(l, set()).add(r['src'])
out = ['# Nguồn âm thanh', '',
       'File này do `web/scripts/sfx-build/credits.py` sinh ra từ công thức cắt (`web/scripts/sfx-build/recipe.txt`). Không sửa tay.', '',
       f'{len(rows)} file trong `web/public/sfx/` được cắt từ {len({r["src"] for r in rows})} bản thu của {len(by)} nhà làm âm thanh, tất cả thuộc các gói Sonniss #GameAudioGDC.',
       'Giấy phép: xem `web/THIRD_PARTY.md`.', '', '## Theo nhà làm âm thanh', '', '| Nhà làm âm thanh | Thư viện | Số bản thu dùng |', '|---|---|---|']
for s in sorted(by, key=str.lower):
    for l in sorted(by[s], key=str.lower): out.append(f'| {s} | {l} | {len(by[s][l])} |')
out += ['', '## Theo file', '', '| File trong game | Bản thu gốc | Thư viện | Nhà làm | Cách cắt |', '|---|---|---|---|---|']
for r in rows:
    l, s = who(r['src']); out.append(f"| `{r['f']}` | {r['src']} | {l} | {s} | {r['opts'] or 'nguyên đoạn'} |")
open(DOC, 'w', encoding='utf8').write('\n'.join(out) + '\n')
print(len(rows), 'files,', len(by), 'makers; unknown maker:', unknown)
