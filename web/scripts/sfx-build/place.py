"""Copy the made files into web/public/sfx, write the level trims into index.json and the source list for the board."""
import json, os, shutil, sys, glob
from sfxlib import WORK, WEB
OUT = os.path.join(WORK, 'out'); PUB = os.path.join(WEB, 'public', 'sfx')
m = json.load(open(os.path.join(OUT, 'manifest.json')))
for old in glob.glob(os.path.join(PUB, '*', '*.ogg')): os.unlink(old)
slots = {}; src = {}
for r in m:
    os.makedirs(os.path.dirname(os.path.join(PUB, r['f'])), exist_ok=True)
    shutil.copyfile(os.path.join(OUT, r['f']), os.path.join(PUB, r['f']))
    slots.setdefault(r['slot'], []).append({'f': r['f'], 'g': r['g']})
    src[r['f']] = r['src'] + (' | ' + r['opts'] if r['opts'] else '')
json.dump({'version': 1, 'slots': slots}, open(os.path.join(PUB, 'index.json'), 'w'))
json.dump(src, open(os.path.join(PUB, 'sources.json'), 'w'), indent=0, ensure_ascii=False, sort_keys=True)
print(len(m), 'files placed')
