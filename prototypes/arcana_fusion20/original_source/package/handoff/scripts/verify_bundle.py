#!/usr/bin/env python3
from pathlib import Path
import hashlib,json,sys,zipfile
base=Path(__file__).resolve().parents[1]
manifest=json.loads((base/'fusion_manifest.json').read_text())
assert len(manifest['spells'])==20 and {s['id'] for s in manifest['spells']}==set(range(1,21))
assert sum(s['originalVote']['none'] for s in manifest['spells'])==6
assert manifest['spells'][18]['fusionVisualLead'].startswith('D')
assert all(s['mustUseAOnBodyFX'] for s in manifest['spells'])
assert all(s['status']=='PLANNED_NOT_IMPLEMENTED' for s in manifest['spells'])
for tag,src in manifest['candidateMap'].items():
 p=base/src['file']
 got=hashlib.sha256(p.read_bytes()).hexdigest()
 assert got==src['sha256'],f'{tag}: SHA mismatch'
 if p.suffix=='.zip':
  with zipfile.ZipFile(p) as z:
   assert z.testzip() is None, f'{tag}: corrupt ZIP'
 print('OK',tag,p.name,got[:16])
votes=json.loads((base/'votes/ARCANA_Votes_20-of-20.json').read_text())
assert votes['summary']=={'completed':20,'total':20}
for src,decision in zip(votes['votes'],manifest['spells']):
 assert src['index']==decision['id']
 assert src['skill']==decision['name']
 assert src['winners']==decision['originalVote']['winners']
 assert src['none']==decision['originalVote']['none']
 assert src.get('note','')==decision['originalVote']['userNote']
print('OK 20/20 user votes preserved; no fusion approval fabricated')
