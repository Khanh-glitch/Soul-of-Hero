#!/usr/bin/env python3
"""Fail-closed A3 schema/reference/progression audit; no third-party game data.
Run: PYTHONPATH=... python tools/survival/economy/validate_economy.py --json report.json
"""
from __future__ import annotations
import argparse, hashlib, json, pathlib, sys
from collections import defaultdict, deque
try:
    import jsonschema
except ImportError:
    print('Install tools/survival/economy/requirements.txt first', file=sys.stderr)
    raise SystemExit(2)
ROOT = pathlib.Path(__file__).resolve().parents[3]
DATA = ROOT / 'data/survival'

def load(p): return json.loads((ROOT/p).read_text())

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--json',type=pathlib.Path); ap.add_argument('--index',type=pathlib.Path)
    args=ap.parse_args(); errors=[]
    docs={}
    for key,path,schema in [
        ('items','items/items.json','item'),('recipes','recipes/recipes.json','recipe'),
        ('technologies','recipes/research.json','research'),('sources','items/sources.json','source'),
        ('stations','recipes/stations.json','station')]:
        d=load(DATA/path); docs[key]=d
        s=load(DATA/f'recipes/{schema}.schema.json')
        v=jsonschema.Draft202012Validator(s)
        for e in v.iter_errors(d): errors.append(f'{path}: {list(e.absolute_path)}: {e.message}')
    items=docs['items']['items']; recipes=docs['recipes']['recipes']; techs=docs['technologies']['technologies']
    sources=docs['sources']['sources']; stations=docs['stations']['stations']
    for collection,entries in [('item',items),('recipe',recipes),('technology',techs),('source',sources)]:
        for k,v in entries.items():
            if k!=v['id']: errors.append(f'{collection} key/id mismatch {k}')
    def refs(q,where):
        for i,n in q.items():
            if i not in items: errors.append(f'{where}: unknown item {i}')
            if type(n) is not int or n<=0: errors.append(f'{where}: invalid quantity {i}')
    for rid,r in recipes.items():
        refs(r['inputs'],rid); refs(r['outputs'],rid); refs(r['fuel'],rid+' fuel')
        if 'research_cost' in r: refs(r['research_cost'],rid+' research_cost')
        if r['station'] not in stations: errors.append(f'{rid}: unknown station')
        for t in r['required_technologies']:
            if t not in techs: errors.append(f'{rid}: unknown technology {t}')
        for i in r['outputs']:
            if items.get(i,{}).get('storage')=='instance' and r['outputs'][i]!=1: errors.append(f'{rid}: instance output must be one')
        if r['category']=='reconstruction' and r.get('consumes_specimen') not in items: errors.append(f'{rid}: missing specimen')
        if len(r['outputs']) != 1 or items.get(next(iter(r['outputs']), ''), {}).get('storage') != 'instance':
            if r['category'] in ['core','reconstruction']: errors.append(f'{rid}: researchable recipe must output exactly one instance')
    for tid,t in techs.items():
        refs(t['inputs'],tid)
        for i in t['inputs']: used_in_placeholder = i
        for p in t['prerequisites']:
            if p not in techs: errors.append(f'{tid}: unknown prerequisite')
    for sid,s in sources.items():
        if s['item_id'] not in items: errors.append(f'{sid}: unknown item')
        if s['yield_per_claim']>50: errors.append(f'{sid}: yield exceeds SaveService stack')
        if s.get('max_claims',0) and s.get('replenishment_seconds',0)!=0: errors.append(f'{sid}: one-time source must not replenish')
    for iid,i in items.items():
        if (i['storage']=='instance') != (i['stack_limit']==1): errors.append(f'{iid}: instance/stack mismatch')
        for sid in i['source_ids']:
            if sid not in sources or sources[sid]['item_id']!=iid: errors.append(f'{iid}: bad source {sid}')
        if 'salvage' in i:
            refs(i['salvage']['outputs'],iid+' salvage')
            if i['salvage']['station'] not in stations: errors.append(f'{iid}: salvage station missing')
    # Production DAG deliberately excludes lossy recovery edges.
    graph=defaultdict(set)
    for rid,r in recipes.items():
        for i in r['inputs']:
            for o in r['outputs']:
                # A seed returned unchanged is a renewable passthrough, not value creation.
                if i == o and r['outputs'][i] <= r['inputs'][i]:
                    continue
                graph[i].add(o)
    color={}; cycles=[]
    def dfs(n,stack):
        color[n]=1
        for m in sorted(graph[n]):
            if color.get(m)==1: cycles.append(stack+[m])
            elif not color.get(m): dfs(m,stack+[m])
        color[n]=2
    for n in sorted(items):
        if not color.get(n): dfs(n,[n])
    if cycles: errors.append(f'production cycles: {cycles}')
    color={}
    def tdfs(n):
        color[n]=1
        for m in techs[n]['prerequisites']:
            if color.get(m)==1 or not tdfs(m): return False
        color[n]=2; return True
    for n in techs:
        if not color.get(n) and not tdfs(n): errors.append(f'technology cycle at {n}')
    # Least fixed point: sources -> starter recipes -> station kits -> research.
    # This is a CONTRACT feasibility proof, not a claim A1 spawned the sources.
    reachable=set(); live=set(); known={r for r,v in recipes.items() if v['knowledge']=='starter'}
    learned_tech=set(); available_stations={'hand'}
    for s in sources.values():
        if s['integration_status'].startswith('LIVE') and not s['requirements']: live.add(s['item_id'])
    def requirements_met(requirements):
        for q in requirements:
            kind, value = q['kind'], q['value']
            if kind in ['tool_item'] and value not in reachable: return False
            if kind == 'tool_tag' and value == 'mining' and not {'stone_pick','iron_pick'} & reachable: return False
            if kind == 'access_tier':
                credential = {1:'green_seal',2:'blue_seal',3:'purple_seal'}.get(value)
                if credential not in reachable: return False
            if kind == 'power' and value and 'charcoal' not in reachable: return False
            if kind == 'resistance':
                hazard, amount = str(value).split(':')
                if not any(items[i].get('resistances',{}).get(hazard,0) >= int(amount) for i in reachable): return False
        return True
    for _ in range(len(recipes)+len(techs)+len(items)+5):
        before=(len(reachable),len(known),len(learned_tech),len(available_stations))
        for s in sources.values():
            if requirements_met(s['requirements']): reachable.add(s['item_id'])
        for sid,st in stations.items():
            if sid=='hand' or st.get('kit') in reachable: available_stations.add(sid)
        for tid,t in techs.items():
            if 'research' in available_stations and set(t['prerequisites'])<=learned_tech and set(t['inputs'])<=reachable:
                learned_tech.add(tid)
        for rid,r in recipes.items():
            station=next((s for s in available_stations if stations[s]['kind']==r['station'] and stations[s]['tier']>=r['min_tier']),None)
            if station and (rid in known or r['knowledge']=='starter') and set(r['required_technologies'])<=learned_tech \
               and set(r['inputs'])<=reachable and set(r['fuel'])<=reachable:
                reachable.update(r['outputs']); known.add(rid)
                if r['category']=='reconstruction': reachable.add(r['consumes_specimen'])
        # Blueprint/specimen knowledge is obtainable when its physical object is.
        for iid,i in items.items():
            if iid in reachable and i.get('unlocks_recipe') in recipes: known.add(i['unlocks_recipe'])
        for rid,r in recipes.items():
            if r['category']=='core' and set(r['outputs'])<=reachable: known.add(rid)
        if 'research' in available_stations and {'knowledge_spares','research_notes'} <= reachable:
            for rid,r in recipes.items():
                if set(r['required_technologies']) <= learned_tech: known.add(rid)
        if before==(len(reachable),len(known),len(learned_tech),len(available_stations)): break
    missing=sorted(set(items)-reachable)
    if missing: errors.append(f'unobtainable contract items: {missing}')
    unknown_recipes=sorted(set(recipes)-known)
    if unknown_recipes: errors.append(f'no knowledge acquisition route: {unknown_recipes}')
    # Reverse index and explicit terminal sinks. Terminal story items are not sinks.
    used_in=defaultdict(set); produced_by=defaultdict(set); sink_ids=defaultdict(set)
    for rid,r in recipes.items():
        for i in list(r['inputs'])+list(r['fuel']): used_in[i].add(rid); sink_ids[i].add(rid)
        for i in r['outputs']: produced_by[i].add(rid)
        if r.get('consumes_specimen'): used_in[r['consumes_specimen']].add(rid); sink_ids[r['consumes_specimen']].add(rid)
    for tid,t in techs.items():
        for i in t['inputs']: sink_ids[i].add('technology:'+tid)
    for iid,i in items.items():
        if i.get('unlocks_recipe'): sink_ids[iid].add('blueprint:'+i['unlocks_recipe'])
        if i['kind']=='key_item': sink_ids[iid].add('runtime_use:access')
        if 'salvage' in i:
            for o in i['salvage']['outputs']: produced_by[o].add('salvage:'+iid)
        if i['kind'] in ['equipment','skill_core','consumable','station_kit']: sink_ids[iid].add('runtime_use:'+i['kind'])
        for s in sources.values():
            if any(q.get('kind')=='tool_item' and q['value']==iid for q in s['requirements']): sink_ids[iid].add('source_requirement:'+s['id'])
    for iid in items:
        if not sink_ids[iid] and not items[iid].get('purpose'): errors.append(f'no purposeful sink: {iid}')
    # Repair cannot restore Core charges. Ordinary repair consumes materials.
    for iid,i in items.items():
        if i['kind']=='skill_core' and i.get('repair_policy')!='reconstruct_only': errors.append(f'{iid}: charge repair forbidden')
    # Exact historical source integrity.
    atlas=ROOT/'docs/survival/source_archive/Soul_of_Heroes_Atlas_Last_Day_Rules_Research_2026.md'
    digest=hashlib.sha256(atlas.read_bytes()).hexdigest()
    if digest!='b958de0fc413cc200b35b0938760228c2ebd3a8ef4aa2f52c1051c52cca59157': errors.append('original Atlas hash changed')
    # A1 pinned physical source bindings (V3). Deterministic canonical rewards;
    # no loot-rate invention, no Core, no capability-only locker material grant.
    from world_binding_contract import validate as validate_world_bindings
    bindings_doc=load(DATA/'items/world_source_bindings.v3.json')
    bindings=bindings_doc.get('bindings',[]); world_actions=bindings_doc.get('world_actions',[])
    errors.extend(validate_world_bindings(bindings_doc, items, sources))
    # V6 prepared-offline policy: opt-in allowlist, no crop/collector/Core automation.
    offline_doc=load(DATA/'recipes/offline_operations.v1.json')
    offline_schema=load(DATA/'recipes/offline_operations.schema.json')
    offline_validator=jsonschema.Draft202012Validator(offline_schema)
    for e in offline_validator.iter_errors(offline_doc): errors.append(f'offline_operations.v1.json: {list(e.absolute_path)}: {e.message}')
    offline_policy=offline_doc.get('policy',{})
    for rid in offline_policy.get('eligible_craft_recipes',[]):
        if rid not in recipes: errors.append(f'offline policy unknown craft recipe {rid}')
        elif recipes[rid]['category'] in offline_policy.get('ineligible_categories',[]): errors.append(f'offline policy eligible recipe in forbidden category {rid}')
    for rid in offline_policy.get('eligible_research_recipes',[]):
        if rid not in recipes: errors.append(f'offline policy unknown research recipe {rid}')
    for tid in offline_policy.get('eligible_technologies',[]):
        if tid not in techs: errors.append(f'offline policy unknown technology {tid}')
    binding_ids={b['binding_id'] for b in bindings}
    for bid in offline_policy.get('active_only_sources_unchanged',[]):
        if bid not in binding_ids: errors.append(f'offline policy unknown ACTIVE-only world binding {bid}')
    index={'schema':'soh.economy.index.v1','items':{i:{'sources':items[i]['source_ids'],'used_in':sorted(used_in[i]),'produced_by':sorted(produced_by[i]),'sinks':sorted(sink_ids[i])} for i in sorted(items)}}
    report={'schema':'soh.economy.validation.v1','technical_status':'FAIL' if errors else 'PASS','scope':'catalog contract feasibility; not production-world integration','errors':errors,
        'counts':{'items':len(items),'recipes':len(recipes),'technologies':len(techs),'sources':len(sources),'stations':len(stations),'world_source_bindings':len(bindings),'world_actions':len(world_actions),'offline_eligible_craft_recipes':len(offline_policy.get('eligible_craft_recipes',[])),'offline_eligible_research_recipes':len(offline_policy.get('eligible_research_recipes',[])),'offline_eligible_technologies':len(offline_policy.get('eligible_technologies',[]))},
        'contract_reachable_items':len(reachable),'live_source_items':sorted(live),'production_cycles':cycles,
        'atlas_sha256':digest,'gameplay_design_status':'NOT_HUMAN_PLAYTESTED','integration_status':'A0_A1_A4_PENDING'}
    if args.index: args.index.write_text(json.dumps(index,indent=2)+'\n')
    if args.json: args.json.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report,indent=2))
    return 1 if errors else 0
if __name__=='__main__': raise SystemExit(main())
