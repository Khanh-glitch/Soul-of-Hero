#!/usr/bin/env python3
"""Deterministic aggregate-flow simulation for SOH_PROPOSAL balance review.

This is NOT a Godot runtime test and NOT a human playtest. It models claimed
source yields, recipe stoichiometry, active production ticks and finite Core
uses to expose gross resource sinks, knowledge demand and exploration catalyst
pressure before A1/A0/A4 integration. It deliberately does not invent combat
DPS, travel time, enemy HP or Gold skill effects.
"""
from __future__ import annotations
import argparse, json, pathlib
from collections import Counter
ROOT=pathlib.Path(__file__).resolve().parents[3]
D=ROOT/'data/survival'

def load(p): return json.loads((D/p).read_text())

def run(seed:int, sessions:int, minutes:int, yield_scale:float=1.0, demand_scale:float=1.0):
    items=load('items/items.json')['items']; recipes=load('recipes/recipes.json')['recipes']
    techs=load('recipes/research.json')['technologies']; sources=load('items/sources.json')['sources']
    inv=Counter(); produced=Counter(); consumed=Counter(); claims=Counter(); crafted=Counter(); tech=set(); loot=Counter()
    ticks=0; catalyst_claims=0; cores_built=0; finite_uses_created=0; known={r for r,v in recipes.items() if v['knowledge']=='starter'}; researched=Counter()
    claimed_once=set()
    def scaled(q): return Counter({i:max(1,int(round(n*demand_scale))) for i,n in q.items()})
    def pay(q, label):
        nonlocal ticks
        if any(inv[i]<n for i,n in q.items()): return False
        for i,n in q.items(): inv[i]-=n; consumed[i]+=n
        return True
    def craft(rid, times=1):
        nonlocal ticks, cores_built, finite_uses_created
        r=recipes[rid]
        if rid not in known or not set(r['required_technologies'])<=tech: return 0
        done=0
        for _ in range(times):
            need=Counter(r['inputs']); need.update(r['fuel'])
            if not pay(need,rid): break
            for i,n in r['outputs'].items():
                inv[i]+=n; produced[i]+=n
                if items[i]['storage']=='instance' and items[i]['kind']=='skill_core':
                    cores_built+=n; finite_uses_created+=n*int(items[i].get('max_uses',0))
            ticks+=r['duration_ticks']; crafted[rid]+=1; done+=1
        return done
    def requirements_met(req):
        for q in req:
            k,v=q['kind'],q['value']
            if k=='tool_item' and inv[v]<1: return False
            if k=='tool_tag' and v=='mining' and inv['stone_pick']+inv['iron_pick']<1: return False
            if k=='access_tier' and inv[{1:'green_seal',2:'blue_seal',3:'purple_seal'}.get(v,'')]<1: return False
            if k=='power' and v and inv['charcoal']<1: return False
            if k=='resistance':
                h,a=str(v).split(':')
                if not any(inv[i]>0 and items[i].get('resistances',{}).get(h,0)>=int(a) for i in items): return False
        return True
    for session in range(sessions):
        budget=minutes*60
        for sid,s in sorted(sources.items()):
            if not requirements_met(s['requirements']): continue
            if s['acquisition']=='reward' and sid in claimed_once: continue
            interval=max(1,int(s['replenishment_seconds']))
            n=min(1 + max(0,budget-1)//interval, 4)
            if n<=0: continue
            amount=max(1,int(round(s['yield_per_claim']*yield_scale)))
            iid=s['item_id']; inv[iid]+=amount*n; produced[iid]+=amount*n; claims[sid]+=n
            if items[iid]['storage']=='instance': loot[iid]+=amount*n
            if iid=='ancient_catalyst': catalyst_claims+=amount*n
            if s['acquisition']=='reward': claimed_once.add(sid)
        # 1. Starter tool + fuel. 2. Knowledge spine. 3. Stations. 4. Core chain.
        if crafted['stone_pick'] < 1: craft('stone_pick')
        craft('burn_charcoal',3)
        craft('make_spares',2)
        if 'tech_smelting' not in tech and pay(scaled(techs['tech_smelting']['inputs']),'tech_smelting'):
            tech.add('tech_smelting'); ticks+=techs['tech_smelting']['duration_ticks']
        craft('smelt_iron',3)
        if 'tech_precision' not in tech and pay(scaled(techs['tech_precision']['inputs']),'tech_precision'):
            tech.add('tech_precision'); ticks+=techs['tech_precision']['duration_ticks']
        craft('make_notes',2)
        if 'tech_core_binding' not in tech and set(techs['tech_core_binding']['prerequisites'])<=tech and pay(scaled(techs['tech_core_binding']['inputs']),'tech_core_binding'):
            tech.add('tech_core_binding'); ticks+=techs['tech_core_binding']['duration_ticks']
        for tid in ['tech_toxin','tech_frost']:
            if tid not in tech and pay(scaled(techs[tid]['inputs']),tid): tech.add(tid); ticks+=techs[tid]['duration_ticks']
        for rid in ['furnace_kit','workbench_kit','research_kit','garden_kit','advanced_furnace_kit']:
            if crafted[rid] < 1: craft(rid)
        # Reserve knowledge for the exploration-gated Core chain first.
        for rid in ['extract_venom','extract_frost','toxin_mask','core_blank','charge_blank','craft_core_venom','craft_core_frost','craft_core_ember']:
            if rid not in known and set(recipes[rid]['required_technologies'])<=tech and pay({'knowledge_spares':6,'research_notes':2},rid):
                known.add(rid); researched[rid]+=1; ticks+=40
        craft('make_spares',2); craft('make_notes',2); craft('smelt_iron',3)
        for rid in ['extract_venom','extract_frost','toxin_mask','frost_cloak']: craft(rid,2)
        for rid in ['core_blank','charge_blank']: craft(rid,2)
        for rid in ['craft_core_venom','craft_core_frost','craft_core_ember']: craft(rid)
        # Optional maintenance / cultivation / consumables use what remains.
        for rid in ['iron_pick','salvage_hammer','make_spring','minor_salve','rebuild_core_venom','rebuild_core_frost','rebuild_core_ember']:
            if rid not in known and set(recipes[rid]['required_technologies'])<=tech and pay({'knowledge_spares':6,'research_notes':2},rid):
                known.add(rid); researched[rid]+=1; ticks+=40
        for rid in ['smelt_ore','alloy_steel','make_parts','weave_cloth','make_spring','make_compost','burn_charcoal','smelt_iron']: craft(rid,3)
        for rid in ['grow_moonleaf','grow_grain']: craft(rid,2)
        for rid in ['minor_salve','field_meal']: craft(rid,2)
    catalyst_consumed=consumed['ancient_catalyst']
    report={'schema':'soh.economy.simulation.v1','seed':seed,'sessions':sessions,'minutes_per_session':minutes,
        'yield_scale':yield_scale,'demand_scale':demand_scale,'status':'MODEL_ONLY_NOT_PLAYTEST',
        'active_production_ticks':ticks,'claims':dict(sorted(claims.items())),'crafted':dict(sorted(crafted.items())),
        'technologies_learned':sorted(tech),'recipes_researched':dict(sorted(researched.items())),'produced':dict(sorted(produced.items())),'consumed':dict(sorted(consumed.items())),
        'ending_inventory':{i:n for i,n in sorted(inv.items()) if n},'loot_instances':dict(sorted(loot.items())),
        'ancient_catalyst_claims':catalyst_claims,'ancient_catalyst_consumed':catalyst_consumed,
        'cores_built':cores_built,'finite_cast_uses_created':finite_uses_created,
        'invariants':{'no_negative_inventory':all(n>=0 for n in inv.values()),
          'catalyst_conservation':catalyst_consumed<=catalyst_claims and inv['ancient_catalyst']==catalyst_claims-catalyst_consumed,
          'farm_never_creates_catalyst':not any('ancient_catalyst' in r['outputs'] for r in recipes.values() if r['category']=='cultivation')},
        'unresolved':['A1 node density/travel/risk not measured','A0 station placement/power not integrated','A4 verified skill costs/effects absent','human pacing and fun not measured']}
    return report

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--seed',type=int,default=30);ap.add_argument('--sessions',type=int,default=14);ap.add_argument('--minutes',type=int,default=45);ap.add_argument('--json',type=pathlib.Path)
    a=ap.parse_args(); scenarios=[run(a.seed,a.sessions,a.minutes),run(a.seed,a.sessions,a.minutes,0.75,1.25),run(a.seed,a.sessions,a.minutes,1.25,0.75)]
    report={'schema':'soh.economy.balance_report.v1','baseline':scenarios[0],'scarcity':scenarios[1],'abundance':scenarios[2],
      'technical_status':'PASS' if all(s['invariants']['no_negative_inventory'] and s['invariants']['farm_never_creates_catalyst'] for s in scenarios) else 'FAIL',
      'gameplay_design_status':'NOT_HUMAN_PLAYTESTED'}
    if a.json:a.json.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'technical_status':report['technical_status'],'gameplay_design_status':report['gameplay_design_status'],'baseline':{k:scenarios[0][k] for k in ['active_production_ticks','cores_built','finite_cast_uses_created','ancient_catalyst_consumed','technologies_learned','invariants']},'scenarios':[{k:s[k] for k in ['yield_scale','demand_scale','cores_built','ancient_catalyst_consumed','invariants']} for s in scenarios]},indent=2))
    return 0 if report['technical_status']=='PASS' else 1
if __name__=='__main__':raise SystemExit(main())
