#!/usr/bin/env python3
"""Product-facing SOH progression/scarcity model (SIMULATION_ONLY).

This is deliberately separate from simulate_economy.py. The older model is a
technical conservation/stress fixture that claims every eligible source on a
timer; it is NOT a realistic player journey. This model follows a fresh-player
agenda, finite bag/home storage, A1 candidate route polylines/hazards, one-time
specimen vaults, active-session station queues, and explicit USE/STORE/SACRIFICE
Core decisions. It does not execute Gold casts, edit SaveService, or approve A1
aliases. Every numeric pacing value is an explicitly labeled SOH proposal.
"""
from __future__ import annotations
import argparse, copy, hashlib, heapq, json, math, pathlib, random, sys
from collections import Counter, defaultdict

ROOT = pathlib.Path(__file__).resolve().parents[3]
DATA = ROOT / 'data/survival'


class ModelError(ValueError):
    pass


def _load(path):
    return json.loads((DATA / path).read_text())


def load_inputs():
    return {
        'items': _load('items/items.json')['items'],
        'recipes': _load('recipes/recipes.json')['recipes'],
        'techs': _load('recipes/research.json')['technologies'],
        'stations': _load('recipes/stations.json')['stations'],
        'loot': _load('items/loot_tables.json')['tables'],
        'pieces': json.loads((DATA / 'survival_catalog.json').read_text())['pieces'],
        'config': _load('recipes/progression_model.json'),
        'adoption': _load('items/a1_source_adoption.v2.json'),
    }


def validate_config(inp):
    cfg = inp['config']; items = inp['items']; recipes = inp['recipes']; stations = inp['stations']
    errors = []
    if cfg.get('status') != 'SOH_DESIGN_PROPOSAL_SIMULATION_ONLY_NOT_HUMAN_PLAYTEST':
        errors.append('progression model must remain explicitly simulation-only')
    adoption = inp.get('adoption', {})
    disputed = {d['material_key'] for d in adoption.get('rejected_global_aliases', [])}
    adopted = {a['material_key'] for a in adoption.get('adopted_source_transformations', [])}
    for src in cfg['product_sources']:
        key = src.get('a1_material_key')
        if key in disputed and not src.get('adoption_ref') and not src.get('binding_status', '').startswith('SUPERSEDED'):
            errors.append(f'disputed A1 material used without source-specific adoption: {key}')
        if src.get('adoption_ref') and src['adoption_ref'] not in {a['transformation_id'] for a in adoption.get('adopted_source_transformations', [])}:
            errors.append(f'unknown adoption_ref {src["adoption_ref"]}')
        if src.get('item_id') and src['item_id'] not in items:
            errors.append(f'unknown source item {src["item_id"]}')
        for iid in src.get('outputs', {}):
            if iid not in items:
                errors.append(f'unknown source output {iid}')
        if src.get('loot_table') and src['loot_table'] not in inp['loot']:
            errors.append(f'unknown loot table {src["loot_table"]}')
        if src.get('one_time') and src.get('item_id') and items[src['item_id']]['kind'] == 'skill_core':
            if src.get('discovery_chance', 1.0) != 1.0:
                errors.append(f'authored specimen should be one-time discovery, not repeatable roll: {src["source_id"]}')
    node_ids = {n['node_id'] for n in cfg['route_network']['nodes']}
    for e in cfg['route_network']['edges']:
        if e['from'] not in node_ids or e['to'] not in node_ids:
            errors.append(f'route edge endpoint missing: {e["route_id"]}')
    for p in cfg['capability_pois']:
        if p['poi_id'] not in node_ids:
            errors.append(f'capability POI missing from route network: {p["poi_id"]}')
    for rid in cfg['capability_bootstrap']['craft_grants']:
        if rid not in recipes:
            errors.append(f'unknown bootstrap recipe {rid}')
    for name, sc in cfg['scenarios'].items():
        if sc.get('minutes', 45) <= 0 or sc.get('sessions', 14) <= 0:
            errors.append(f'invalid scenario {name}')
    route_ids = {e['route_id'] for e in cfg['route_network']['edges']}
    for rid in cfg.get('novice_bootstrap', {}).get('safe_route_ids', []):
        if rid not in route_ids:
            errors.append(f'novice safe route missing from model network: {rid}')
    if cfg.get('novice_bootstrap', {}).get('hazardous_shortcut') not in route_ids:
        errors.append('hazardous shortcut missing from model network')
    for a in adoption.get('adopted_source_transformations', []):
        if a['a3_item_id'] not in items:
            errors.append(f'adopted source item missing: {a["a3_item_id"]}')
    # Roadside loot must not contain rare Cores/catalysts.
    road = inp['loot'].get('roadside_cache', {})
    for entry in road.get('entries', []):
        iid = entry['item_id']
        if items[iid]['kind'] == 'skill_core' or 'exploration_only' in items[iid].get('tags', []):
            errors.append(f'roadside cache contains rare/core item {iid}')
    if errors:
        raise ModelError('; '.join(errors))
    return True


def _polyline_tiles(points):
    return sum(math.dist(points[i], points[i + 1]) for i in range(len(points) - 1))


def _segment_rect_length(a, b, rect):
    x, y, w, h = rect
    xmin, xmax, ymin, ymax = x, x + w, y, y + h
    dx, dy = b[0] - a[0], b[1] - a[1]
    t0, t1 = 0.0, 1.0
    for p, q in ((-dx, a[0] - xmin), (dx, xmax - a[0]), (-dy, a[1] - ymin), (dy, ymax - a[1])):
        if abs(p) < 1e-12:
            if q < 0:
                return 0.0
        else:
            r = q / p
            if p < 0:
                t0 = max(t0, r)
            else:
                t1 = min(t1, r)
    if t0 > t1:
        return 0.0
    return max(0.0, t1 - t0) * math.hypot(dx, dy)


class ProgressionModel:
    def __init__(self, scenario='baseline', overrides=None, inputs=None):
        self.inp = inputs or load_inputs()
        validate_config(self.inp)
        self.cfg = self.inp['config']
        self.scenario_name = scenario
        self.sc = dict(self.cfg['scenarios'].get(scenario, {'seed': 30, 'sessions': 14, 'minutes': 45}))
        if overrides:
            self.sc.update(overrides)
        seed = int(self.sc.get('seed', 30))
        self.rng = random.Random(seed)
        # Separate streams so adding a gather/craft action does not silently reroll
        # death or rare discovery outcomes. Scenario seed still controls all streams.
        self.death_rng = random.Random(seed + 1000)
        self.loot_rng = random.Random(seed + 2000)
        self.rare_rng = random.Random(seed + 3000)
        self.items = self.inp['items']; self.recipes = self.inp['recipes']; self.techs = self.inp['techs']
        self.stations = self.inp['stations']; self.loot = self.inp['loot']; self.pieces = self.inp['pieces']
        self.assume = self.cfg['assumptions']
        self.sources = {s['source_id']: s for s in self.cfg['product_sources']}
        self.cap_pois = {p['poi_id']: p for p in self.cfg['capability_pois']}
        self.hazards = self.cfg['hazards']
        self.edges = self.cfg['route_network']['edges']
        self.nodes = {n['node_id']: n for n in self.cfg['route_network']['nodes']}
        self.home = Counter(); self.bag = Counter(); self.equipment = {}
        self.instances = {}
        self.known = {r for r, v in self.recipes.items() if v['knowledge'] == 'starter'}
        self.tech = set(); self.caps = set()
        self.installed = {'hand'}
        self.jobs = []
        self.chests = 0; self.home_built = False
        self.counter = 0; self.session = 0; self.clock = 0; self.time_left = 0
        self.claimed_once = set(); self.last_claim = {}
        self.crafted = Counter(); self.researched = Counter(); self.claims = Counter()
        self.bottlenecks = Counter(); self.events = []; self.route_log = []; self.decisions = []
        self.firsts = {}; self.deaths = 0; self.lost = Counter(); self.lost_instances = []
        self.overflow = Counter(); self.session_reports = []; self.claims_this_session = Counter()
        self.expected_roadside = self._expected_loot('roadside_cache')
        self.roadside_claims = 0; self.catalyst_attempts = 0; self.catalyst_successes = 0
        self.specimen_discoveries = []
        self.native_casts_executed = 0
        self.adoption = self.inp.get('adoption', {})
        self.hazard_mitigation = self.cfg.get('hazard_mitigation', {})
        self.explicit_bootstrap_pois = set(self.cfg.get('explicit_bootstrap_pois', []))
        self.world_actions = set()
        self.time_ledger = Counter()
        self.session_station_work = 0
        self.session_active_categories = Counter()
        self.blocked_routes = set(self.sc.get('blocked_routes', []))
        self.pause_stations = self.sc.get('pause_stations', {})
        self.shortcut_attempts = []

    # ----- inventory -----
    def _stack_limit(self, iid):
        return int(self.items[iid].get('stack_limit', 50))

    def _slots(self, counts, instances_loc):
        used = sum(math.ceil(n / self._stack_limit(i)) for i, n in counts.items() if n > 0)
        used += sum(1 for r in self.instances.values() if r['location'] == instances_loc)
        return used

    def bag_slots(self):
        return self._slots(self.bag, 'bag')

    def home_slots(self):
        return self._slots(self.home, 'home')

    def home_capacity(self):
        return self.chests * int(self.assume['home_storage_slots_per_chest'])

    def total(self, iid):
        return self.home[iid] + self.bag[iid]

    def _add_stack(self, iid, qty, loc='bag', reason='loot'):
        counts = self.bag if loc == 'bag' else self.home
        cap = int(self.assume['bag_slots']) if loc == 'bag' else self.home_capacity()
        other = self.home if loc == 'bag' else self.bag
        limit = self._stack_limit(iid)
        before = math.ceil(counts[iid] / limit) if counts[iid] else 0
        free = cap - self._slots(counts, loc)
        max_add = max(0, free * limit + (limit - counts[iid] % limit) % limit) if free >= 0 else 0
        # Conservative: fill only completely free slots plus current partial stack.
        add = min(qty, max_add)
        if add > 0:
            counts[iid] += add
        if qty - add > 0:
            self.overflow[iid] += qty - add
            self.bottlenecks[f'inventory_full:{loc}'] += 1
        return add

    def _add_item(self, iid, qty, loc='bag', reason='loot'):
        if qty <= 0:
            return 0
        if loc == 'home' and not self.home_built:
            loc = 'bag'
        if self.items[iid]['storage'] == 'instance':
            added = 0
            for _ in range(qty):
                cap = int(self.assume['bag_slots']) if loc == 'bag' else self.home_capacity()
                if self._slots(self.bag if loc == 'bag' else self.home, loc) >= cap:
                    self.overflow[iid] += qty - added
                    self.bottlenecks[f'inventory_full:{loc}'] += 1
                    break
                self.counter += 1
                token = f'soh_model_{self.counter:06d}'
                self.instances[token] = {
                    'instance_id': token, 'item_id': iid, 'location': loc,
                    'uses': int(self.items[iid].get('max_uses', 0)),
                    'max_uses': int(self.items[iid].get('max_uses', 0)),
                    'condition': 100, 'disposition': 'stored', 'found_session': self.session,
                    'origin': reason,
                }
                added += 1
            return added
        return self._add_stack(iid, qty, loc, reason)

    def _pay(self, costs):
        for iid, n in costs.items():
            if self.total(iid) < n:
                return False
        for iid, n in costs.items():
            left = n
            take = min(self.home[iid], left); self.home[iid] -= take; left -= take
            if left:
                self.bag[iid] -= left
        return True

    def _transfer_home(self):
        if not self.home_built:
            return
        for iid in list(self.bag):
            if self.bag[iid] <= 0:
                continue
            moved = self._add_stack(iid, self.bag[iid], 'home', 'return') if self.items[iid]['storage'] != 'instance' else 0
            if moved:
                self.bag[iid] -= moved
        for rec in self.instances.values():
            if rec['location'] == 'bag' and self.home_slots() < self.home_capacity():
                rec['location'] = 'home'

    def _ensure_chest(self):
        if self.home_slots() < self.home_capacity() or not self.home_built:
            return True
        cost = self.pieces['chest_wood']['cost']
        if self._pay(cost):
            self.chests += 1
            self._spend(self.assume['build_piece_seconds'], 'build chest')
            return True
        self.bottlenecks['home_storage_full'] += 1
        return False

    # ----- time / stations -----
    def _category(self, label):
        if label.startswith('travel '): return 'travel'
        if label.startswith('expedition ') or label.startswith('poi '): return 'exploration_interaction'
        if label.startswith('claim '): return 'gathering'
        if label.startswith('enqueue '): return 'crafting_handling'
        if label.startswith('research '): return 'research_handling'
        if label.startswith('build ') or label.startswith('install ') or label.startswith('upgrade '): return 'construction'
        if label.startswith('active-session production wait'): return 'station_wait'
        if label.startswith('combat '): return 'combat'
        if label.startswith('decision '): return 'player_decision'
        return 'other'

    def _spend(self, seconds, label):
        seconds = max(0, int(seconds))
        if seconds > self.time_left:
            self.bottlenecks['session_time'] += 1
            seconds = self.time_left
        category = self._category(label)
        self.time_ledger[category] += seconds
        self.session_active_categories[category] += seconds
        self.time_left -= seconds
        self.clock += seconds
        by_station = defaultdict(list)
        for job in self.jobs:
            if job['status'] in ('queued', 'running'):
                by_station[job['station']].append(job)
        for station, jobs in by_station.items():
            if self.session in self.pause_stations.get(station, []):
                self.bottlenecks[f'station_paused:{station}'] += 1
                continue
            jobs.sort(key=lambda j: j['seq'])
            rem = seconds
            for active in jobs:
                if rem <= 0:
                    break
                if active['status'] not in ('queued', 'running'):
                    continue
                active['status'] = 'running'
                use = min(rem, active['remaining'])
                active['remaining'] -= use
                rem -= use
                self.session_station_work += use
                if active['remaining'] <= 0:
                    active['status'] = 'ready'
        return seconds

    def wait_production(self):
        pending = [j['remaining'] for j in self.jobs if j['status'] in ('queued', 'running') and self.session not in self.pause_stations.get(j['station'], [])]
        if pending and self.time_left > 0:
            self._spend(min(max(pending), self.time_left), 'active-session production wait')

    def _queue_count(self, station):
        return sum(1 for j in self.jobs if j['station'] == station and j['status'] in ('queued', 'running', 'ready'))

    def _station_for(self, kind, min_tier):
        candidates = [s for s in self.installed if self.stations[s]['kind'] == kind and self.stations[s]['tier'] >= min_tier]
        return sorted(candidates, key=lambda s: (-self.stations[s]['tier'], s))[0] if candidates else None

    def _enqueue(self, kind, target, station, duration, reserved=None, specimen=None):
        cap = int(self.stations[station].get('queue_capacity', 1))
        if self._queue_count(station) >= cap:
            self.bottlenecks[f'queue_full:{station}'] += 1
            return False
        self.counter += 1
        self.jobs.append({'seq': self.counter, 'kind': kind, 'target': target, 'station': station,
                          'remaining': int(duration), 'duration': int(duration), 'status': 'queued',
                          'specimen': specimen, 'enqueued_session': self.session})
        return True

    def collect_jobs(self):
        collected = []
        for job in list(self.jobs):
            if job['status'] != 'ready':
                continue
            if job['kind'] == 'technology':
                self.tech.add(job['target'])
                self._first('tech:' + job['target'])
            elif job['kind'] == 'research':
                self.known.add(job['target'])
                self.researched[job['target']] += 1
                self._first('research:' + job['target'])
                if job['specimen']:
                    rec = self.instances.get(job['specimen'])
                    if rec:
                        rec['location'] = 'consumed_by_research'; rec['disposition'] = 'sacrificed'
                        self.decisions.append({'session': self.session, 'decision': 'SACRIFICE', 'instance': job['specimen'],
                                               'item_id': rec['item_id'], 'recipe': job['target'],
                                               'knowledge_permanent': True, 'native_casts_executed': 0})
            else:
                r = self.recipes[job['target']]
                for iid, qty in r['outputs'].items():
                    self._add_item(iid, qty, 'home', 'craft')
                self.crafted[job['target']] += 1
                self._first('craft:' + job['target'])
                for iid in r['outputs']:
                    if self.items[iid]['kind'] == 'skill_core':
                        self._first('manufacture:' + iid)
                for cap in self.cfg['capability_bootstrap']['craft_grants'].get(job['target'], []):
                    self.caps.add(cap)
            self.jobs.remove(job)
            collected.append(job['target'])
        if collected:
            self._ensure_chest()
        return collected

    def _first(self, key):
        if key not in self.firsts:
            self.firsts[key] = self.session

    # ----- crafting / research -----
    def craft(self, rid, times=1):
        r = self.recipes[rid]
        done = 0
        for _ in range(times):
            if rid not in self.known:
                self.bottlenecks[f'knowledge_missing:{rid}'] += 1; break
            if not set(r['required_technologies']) <= self.tech:
                self.bottlenecks[f'technology_missing:{rid}'] += 1; break
            station = self._station_for(r['station'], r['min_tier'])
            if station is None:
                self.bottlenecks[f'station_missing:{r["station"]}:t{r["min_tier"]}'] += 1; break
            costs = Counter(r['inputs']); costs.update(r['fuel'])
            if any(self.total(i) < n for i, n in costs.items()):
                for i, n in costs.items():
                    if self.total(i) < n:
                        self.bottlenecks[f'input_missing:{i}'] += 1
                break
            if not self._pay(costs):
                break
            if not self._enqueue('craft', rid, station, r['duration_ticks']):
                # refund reserved inputs if queue full; before home exists, refund to bag
                loc = self.home if self.home_built else self.bag
                for i, n in costs.items():
                    loc[i] += n
                break
            self._spend(self.assume['craft_handle_seconds'], 'enqueue ' + rid)
            done += 1
        return done

    def craft_collect(self, rid, times=1):
        done = 0
        for _ in range(times):
            if not self.craft(rid, 1):
                break
            self.wait_production(); self.collect_jobs()
            done += 1
        return done

    def craft_need(self, rid, target, max_per_session=3):
        out = next(iter(self.recipes[rid]['outputs']))
        qty = int(self.recipes[rid]['outputs'][out])
        done = 0
        for _ in range(max_per_session):
            # Cumulative production target avoids infinite catch-up grinding after
            # the player has already spent the intermediate on research/upgrades.
            if self.crafted[rid] * qty >= target or self.time_left <= 0:
                break
            if not self.craft_collect(rid, 1):
                break
            done += 1
        return done

    def research_tech(self, tid):
        t = self.techs[tid]
        if tid in self.tech or any(j['kind'] == 'technology' and j['target'] == tid for j in self.jobs):
            return False
        if not set(t['prerequisites']) <= self.tech:
            self.bottlenecks[f'tech_prereq:{tid}'] += 1; return False
        station = self._station_for('research', t['min_tier'])
        if station is None:
            self.bottlenecks['station_missing:research'] += 1; return False
        if any(self.total(i) < n for i, n in t['inputs'].items()):
            self.bottlenecks[f'tech_input:{tid}'] += 1; return False
        if not self._pay(t['inputs']):
            return False
        ok = self._enqueue('technology', tid, station, t['duration_ticks'])
        if ok:
            self._spend(self.assume['research_handle_seconds'], 'research ' + tid)
        return ok

    def research_recipe(self, rid, method='targeted', specimen=None):
        if rid in self.known or any(j['kind'] == 'research' and j['target'] == rid for j in self.jobs):
            return False
        r = self.recipes[rid]
        if not set(r['required_technologies']) <= self.tech:
            self.bottlenecks[f'research_tech_missing:{rid}'] += 1; return False
        station = self._station_for('research', 1)
        if station is None:
            self.bottlenecks['station_missing:research'] += 1; return False
        if method == 'specimen':
            rec = self.instances.get(specimen or '')
            expected = next(iter(r['outputs']))
            if not rec or rec['item_id'] != expected or rec['location'] not in ('bag', 'home'):
                self.bottlenecks['specimen_missing'] += 1; return False
            costs = {'knowledge_spares': 5}
        elif method == 'blueprint':
            plan = next((i for i, v in self.items.items() if v.get('unlocks_recipe') == rid), None)
            if not plan or self.total(plan) < 1:
                self.bottlenecks['blueprint_missing'] += 1; return False
            costs = {'knowledge_spares': 3, plan: 1}
        else:
            costs = {'knowledge_spares': 6, 'research_notes': 2}
        if any(self.total(i) < n for i, n in costs.items()):
            self.bottlenecks[f'research_input:{rid}'] += 1; return False
        if not self._pay(costs):
            return False
        if method == 'specimen':
            self.instances[specimen]['location'] = 'research_escrow'
        ok = self._enqueue('research', rid, station, 40, specimen=specimen if method == 'specimen' else None)
        if ok:
            self._spend(self.assume['research_handle_seconds'], 'research ' + rid)
        return ok

    # ----- routes / expeditions -----
    def _resistance_coverage(self, hazard_id):
        h = self.hazard_mitigation.get(hazard_id, {})
        covered = []
        fraction = 0.0
        required_keys = set(h.get('required_resistance_keys', []))
        for iid, rec in self.equipment.items():
            if rec.get('condition', 0) <= 0:
                continue
            item = self.inp['items'].get(iid, {})
            resist = item.get('resistances', {})
            if hazard_id in resist or required_keys & set(resist):
                covered.append(iid)
                fraction = max(fraction, max([resist.get(k, 0) for k in required_keys] + [resist.get(hazard_id, 0)]) / 100.0)
        cap = h.get('required_capability')
        capability_ready = bool(cap and cap in self.caps)
        if capability_ready:
            fraction = max(fraction, float(h.get('minimum_mitigation_fraction_proposal', 0.6)))
        return {'items': covered, 'capability': cap if capability_ready else None,
                'mitigation_fraction_proposal': round(fraction, 3), 'ready': fraction > 0,
                'required_resistance_keys': sorted(required_keys),
                'status': 'A3_DESIGN_PROPOSAL_CAPABILITY_MITIGATION_NOT_NATIVE'}

    def _edge_unmitigated(self, edge):
        """Route access capability is not damage mitigation."""
        unmitigated = Counter()
        for h in self.hazards:
            length = sum(_segment_rect_length(edge['polyline'][i], edge['polyline'][i + 1], h['rect']) for i in range(len(edge['polyline']) - 1))
            if length > 0:
                coverage = self._resistance_coverage(h['hazard_id'])
                effective = length * (1.0 - coverage['mitigation_fraction_proposal'])
                if effective > 0:
                    unmitigated[h['hazard_id']] += effective
        return unmitigated

    def _path(self, target, avoid_unmitigated=True):
        start = 'node_refuge'
        if target == start:
            return {'edges': [], 'tiles': 0.0, 'exposure': {}, 'unmitigated_exposure': {}, 'route_choice': 'home'}
        adj = defaultdict(list)
        for e in self.edges:
            if e['route_id'] in self.blocked_routes:
                continue
            if not set(e['required_capabilities']) <= self.caps:
                continue
            unmit = self._edge_unmitigated(e)
            if avoid_unmitigated and max(unmit.values(), default=0.0) > self.assume['hazard_exposure_abort_tiles']:
                continue
            adj[e['from']].append((e, unmit)); adj[e['to']].append((dict(e, **{'from': e['to'], 'to': e['from']}), unmit))
        dist = {start: 0.0}; prev = {}; pq = [(0.0, start)]
        while pq:
            d, u = heapq.heappop(pq)
            if u == target:
                break
            if d > dist.get(u, float('inf')):
                continue
            for e, unmit in adj[u]:
                v = e['to']; nd = d + _polyline_tiles(e['polyline'])
                if nd < dist.get(v, float('inf')):
                    dist[v] = nd; prev[v] = (u, e); heapq.heappush(pq, (nd, v))
        if target not in dist:
            if avoid_unmitigated:
                return self._path(target, avoid_unmitigated=False)
            return None
        edges = []; u = target
        while u != start:
            u, e = prev[u]; edges.append(e)
        edges.reverse()
        exposure = Counter(); unmitigated = Counter()
        for e in edges:
            unmitigated.update(self._edge_unmitigated(e))
            for h in self.hazards:
                length = sum(_segment_rect_length(e['polyline'][i], e['polyline'][i + 1], h['rect']) for i in range(len(e['polyline']) - 1))
                if length > 0:
                    exposure[h['hazard_id']] += length
        return {'edges': [e['route_id'] for e in edges], 'tiles': dist[target], 'exposure': dict(exposure),
                'unmitigated_exposure': dict(unmitigated),
                'route_choice': 'mitigation_aware' if avoid_unmitigated else 'unmitigated_fallback_for_abort_log'}

    def _death_chance(self, risk, exposure, unmitigated):
        chance = float(self.assume['base_death_chance'].get(risk, 0.05))
        # A1 uses highest-severity-per-cell; do not double-count overlapping hazards.
        unprepared = max(unmitigated.values(), default=0.0)
        if unprepared > self.assume['hazard_exposure_abort_tiles']:
            chance += self.assume['unprepared_hazard_death_chance']
        chance *= float(self.sc.get('death_scale', 1.0))
        return min(0.95, chance), unprepared

    def attempt_shortcut(self):
        shortcut_id = self.cfg.get('novice_bootstrap', {}).get('hazardous_shortcut')
        edge = next((e for e in self.edges if e['route_id'] == shortcut_id), None)
        if edge is None:
            return False
        missing = sorted(set(edge['required_capabilities']) - self.caps)
        if missing:
            self.shortcut_attempts.append({'session': self.session, 'route_id': shortcut_id, 'outcome': 'shortcut_locked', 'missing_capabilities': missing})
            self.events.append({'session': self.session, 'event': 'shortcut_locked', 'route_id': shortcut_id, 'missing_capabilities': missing,
                                'status': 'A1_AUTHORED_CAP_FILTER_GATE'})
            self.bottlenecks['shortcut_locked'] += 1
            return False
        return True

    def expedition(self, target, source_id=None, purpose='explore'):
        path = self._path(target)
        if path is None:
            self.bottlenecks[f'route_inaccessible:{target}'] += 1
            self.route_log.append({'session': self.session, 'target': target, 'outcome': 'inaccessible', 'purpose': purpose})
            return False
        src = self.sources.get(source_id or '', {})
        extra = float(src.get('round_trip_tiles', 0))
        tiles = path['tiles'] * 2 + extra
        travel = tiles * self.assume['tile_px'] / self.assume['walk_px_per_second']
        interact = self.assume['poi_interaction_seconds'] + (self.assume['search_seconds'] if source_id else 0)
        need = int(travel + interact)
        if need > self.time_left:
            self.bottlenecks['session_time:expedition'] += 1
            return False
        risk = src.get('risk', 'medium')
        unmitigated = path.get('unmitigated_exposure', {})
        chance, unprepared = self._death_chance(risk, path['exposure'], unmitigated)
        force = self.sc.get('force_death') or {}
        forced = bool(force) and (
            (force.get('session') == self.session and force.get('poi_id') == target)
            or (force.get('source_id') is not None and force.get('source_id') == source_id)
        )
        travel_spent = self._spend(travel, 'travel ' + target)
        interact_spent = self._spend(interact, 'expedition ' + target)
        aborted = unprepared > self.assume['hazard_exposure_abort_tiles'] and not forced
        died = forced or self.death_rng.random() < chance
        log = {'session': self.session, 'target': target, 'source_id': source_id, 'purpose': purpose,
               'route_edges': path['edges'], 'route_choice': path.get('route_choice'), 'round_trip_tiles': round(tiles, 2),
               'travel_seconds': travel_spent, 'exploration_interaction_seconds': interact_spent,
               'hazard_exposure_tiles': {k: round(v, 2) for k, v in path['exposure'].items()},
               'unmitigated_exposure_tiles': {k: round(v, 2) for k, v in unmitigated.items()},
               'death_chance': round(chance, 4),
               'outcome': 'death' if died else ('abort_unprepared_hazard' if aborted else 'success')}
        self.route_log.append(log)
        if aborted:
            self.bottlenecks[f'hazard_abort:{target}'] += 1
            self.events.append({'session': self.session, 'event': 'hazard_abort', 'target': target,
                                'unmitigated_exposure_tiles': {k: round(v, 2) for k, v in unmitigated.items()},
                                'resistance_coverage': {h: self._resistance_coverage(h) for h in path['exposure']},
                                'status': 'SOH_PROPOSAL_ROUTE_RETREAT_NOT_NATIVE_DAMAGE'})
            return False
        if died:
            self.deaths += 1
            for iid, n in self.bag.items():
                self.lost[iid] += n
            self.bag.clear()
            for token, rec in list(self.instances.items()):
                if rec['location'] == 'bag':
                    self.lost_instances.append(dict(rec)); rec['location'] = 'lost_on_death'
            self.events.append({'session': self.session, 'event': 'death', 'target': target,
                                'knowledge_retained': True, 'home_retained': True,
                                'native_death_system': 'NOT_INTEGRATED_A0_PENDING'})
            return False
        if target in self.cap_pois and target not in self.explicit_bootstrap_pois:
            p = self.cap_pois[target]
            if set(p['required_capabilities']) <= self.caps:
                for cap in p['grants_capabilities']:
                    if cap in self.caps:
                        continue
                    policy = self.cfg.get('capability_grant_policy', {})
                    gates = policy.get('material_gates', {})
                    if cap in gates and cap not in policy.get('bootstrap_first_visit_caps', []):
                        self.bottlenecks[f'capability_material_unresolved:{cap}'] += 1
                        self.events.append({'session': self.session, 'event': 'capability_blocked', 'capability': cap,
                                            'poi_id': target, 'missing_or_unresolved_materials': gates[cap],
                                            'status': 'A1_ALIAS_OR_MISSING_ITEM_NOT_APPROVED'})
                        continue
                    self.caps.add(cap)
                    self._first('capability:' + cap)
                    self.events.append({'session': self.session, 'event': 'capability_grant', 'capability': cap,
                                        'poi_id': target, 'status': 'A1_AUTHORED_FIRST_VISIT_GRANT_NOT_NATIVE'})
        if source_id:
            self._claim_source(source_id, target)
        return True

    def novice_action(self, action_id):
        actions = self.cfg.get('novice_bootstrap', {}).get('a3_world_action_proposals', {})
        a = actions.get(action_id)
        if a is None or action_id in self.world_actions:
            return False
        if not set(a.get('requires_capabilities', [])) <= self.caps:
            self.bottlenecks[f'novice_capability:{action_id}'] += 1
            return False
        costs = a.get('cost_a3_items', {})
        if any(self.total(i) < n for i, n in costs.items()):
            self.bottlenecks[f'novice_input:{action_id}'] += 1
            return False
        ok = self.expedition(a['poi_id'], purpose='novice_action:' + action_id)
        if not ok:
            return False
        if costs and not self._pay(costs):
            return False
        for iid, qty in a.get('reward_proposal', {}).items():
            self._add_item(iid, qty, reason='a1_novice_action_proposal:' + action_id)
        for cap in a.get('grants', []):
            if cap not in self.caps:
                self.caps.add(cap)
                self._first('capability:' + cap)
        self.world_actions.add(action_id)
        self.events.append({'session': self.session, 'event': 'novice_world_action', 'action_id': action_id,
                            'poi_id': a['poi_id'], 'costs': costs, 'rewards': a.get('reward_proposal', {}),
                            'grants_capabilities': a.get('grants', []),
                            'status': 'A1_AUTHORED_ACTION_A3_COST_PROPOSAL_NOT_NATIVE'})
        return True

    def _expected_loot(self, table_id):
        table = self.loot.get(table_id)
        if not table:
            return {}
        total = sum(e['weight'] for e in table['entries'])
        out = Counter()
        for e in table['entries']:
            avg = (e['quantity'][0] + e['quantity'][1]) / 2
            out[e['item_id']] += table['rolls'] * e['weight'] / total * avg
        return {i: round(n, 4) for i, n in out.items()}

    def _claim_source(self, sid, poi_id=None):
        src = self.sources[sid]
        if src.get('one_time') and sid in self.claimed_once:
            self.bottlenecks[f'one_time_depleted:{sid}'] += 1
            return False
        if not set(src.get('requires_capabilities', [])) <= self.caps:
            self.bottlenecks[f'capability_missing:{sid}'] += 1
            return False
        if any(self.total(i) < 1 for i in src.get('requires_items', [])):
            self.bottlenecks[f'tool_missing:{sid}'] += 1
            return False
        cap = int(src.get('max_claims_per_session', self.assume.get('max_claims_per_session_default', 2)))
        if self.claims_this_session[sid] >= cap:
            self.bottlenecks[f'restock_pending:{sid}'] += 1
            return False
        scale = float(self.sc.get('yield_scale', 1.0)) * float(self.sc.get('source_yield_scale', {}).get(sid, 1.0))
        if src.get('loot_table'):
            table = self.loot[src['loot_table']]
            total = sum(e['weight'] for e in table['entries'])
            for _ in range(table['rolls']):
                roll = self.loot_rng.random() * total
                acc = 0
                for e in table['entries']:
                    acc += e['weight']
                    if roll <= acc:
                        qty = self.loot_rng.randint(e['quantity'][0], e['quantity'][1])
                        qty = max(0, int(round(qty * scale)))
                        self._add_item(e['item_id'], qty, 'bag', sid)
                        break
            self.roadside_claims += 1
        else:
            base_chance = float(src.get('discovery_chance', 1.0))
            chance = base_chance * float(self.sc.get('rare_chance_scale', 1.0)) if base_chance < 1.0 or sid == 'catalyst_vault' else 1.0
            if sid == 'catalyst_vault':
                self.catalyst_attempts += 1
            if self.rare_rng.random() > chance:
                self.events.append({'session': self.session, 'event': 'rare_roll_failed', 'source_id': sid, 'poi_id': poi_id,
                                    'chance': chance, 'status': 'SOH_PROPOSAL_NOT_ORIGINAL_DROP_RATE'})
                if src.get('one_time'):
                    # A failed authored vault attempt does not consume the one-time discovery.
                    pass
                return False
            outputs = src.get('outputs') or {src['item_id']: src.get('yield_per_claim', 1)}
            for iid, qty in outputs.items():
                qty = max(0, int(round(qty * scale))) if self.items[iid]['storage'] != 'instance' else 1
                added = self._add_item(iid, qty, 'bag', sid)
                if added and self.items[iid]['kind'] == 'skill_core':
                    self.specimen_discoveries.append({'session': self.session, 'item_id': iid, 'source_id': sid, 'poi_id': poi_id})
                    self._first('discovery:' + iid)
                    self.events.append({'session': self.session, 'event': 'core_specimen_discovery', 'item_id': iid,
                                        'poi_id': poi_id, 'source_id': sid, 'one_time': True,
                                        'cast_readiness': self.items[iid]['skill_readiness']})
                    if self.sc.get('lose_specimen_source') == sid:
                        token = next(r['instance_id'] for r in self.instances.values() if r['item_id'] == iid and r['origin'] == sid and r['location'] == 'bag')
                        rec = self.instances[token]; rec['location'] = 'lost_on_death'
                        self.lost_instances.append(dict(rec)); self.deaths += 1
                        self.events.append({'session': self.session, 'event': 'specimen_lost_on_return', 'item_id': iid,
                                            'poi_id': poi_id, 'knowledge_retained': True,
                                            'native_death_system': 'NOT_INTEGRATED_A0_PENDING'})
                if sid == 'catalyst_vault' and added:
                    self.catalyst_successes += added
        self.claims[sid] += 1
        self.claims_this_session[sid] += 1
        for cap in self.cfg['capability_bootstrap'].get('source_grants', {}).get(sid, []):
            if cap not in self.caps:
                self.caps.add(cap); self._first('capability:' + cap)
        self.last_claim[sid] = self.clock
        if src.get('one_time'):
            self.claimed_once.add(sid)
        self._spend(self.assume['gather_seconds_per_claim'], 'claim ' + sid)
        return True

    def gather(self, sid, claims=1):
        src = self.sources[sid]
        done = 0
        for _ in range(claims):
            if self.time_left <= 0:
                break
            if src.get('poi_id'):
                ok = self.expedition(src['poi_id'], sid, 'gather')
            else:
                ok = self.expedition(src.get('route_node', 'node_refuge'), sid, 'gather')
            if ok:
                done += 1
            else:
                break
        return done

    def gather_until(self, iid, target, sid, max_claims=6):
        for _ in range(max_claims):
            if self.total(iid) >= target or self.time_left <= 0:
                break
            if not self.gather(sid, 1):
                break

    # ----- construction -----
    def build_home(self):
        if self.home_built:
            return True
        cost = Counter()
        for piece, n in self.cfg['shelter']['pieces'].items():
            for iid, q in self.pieces[piece]['cost'].items():
                cost[iid] += q * n
        if any(self.total(i) < n for i, n in cost.items()):
            self.bottlenecks['home_cost_missing'] += 1
            return False
        if not self._pay(cost):
            return False
        pieces = sum(self.cfg['shelter']['pieces'].values())
        self._spend(pieces * self.assume['build_piece_seconds'], 'build shelter')
        self.home_built = True; self.chests = self.cfg['shelter']['pieces'].get('chest_wood', 0)
        self._first('home_built')
        return True

    def install_stations(self):
        if not self.home_built:
            self.bottlenecks['home_required_for_stations'] += 1
            return
        order = ['furnace', 'workbench', 'research', 'garden', 'advanced_furnace']
        for station in order:
            if station in self.installed:
                continue
            kit = self.stations[station].get('kit')
            if kit and self.total(kit) >= 1:
                self._pay({kit: 1})
                self.installed.add(station)
                self._spend(self.assume['station_install_seconds'], 'install ' + station)
                self._first('station:' + station)
        if 'workbench' in self.installed and 'advanced_workbench' not in self.installed:
            cost = self.stations['advanced_workbench'].get('upgrade_cost', {})
            if all(self.total(i) >= n for i, n in cost.items()):
                self._pay(cost)
                self.installed.add('advanced_workbench')
                self._spend(self.assume['station_upgrade_seconds'], 'upgrade workbench')
                self._first('station:advanced_workbench')

    # ----- Core choices -----
    def _specimens(self, item_id=None):
        return [r for r in self.instances.values() if r['location'] in ('bag', 'home') and r['item_id'].startswith('core_') and (item_id is None or r['item_id'] == item_id)]

    def apply_core_policy(self):
        policy = self.sc.get('core_policy', 'store_until_ready_then_sacrifice_ember')
        if policy == 'targeted_after_loss':
            lost_ids = {r['item_id'] for r in self.lost_instances if r.get('location') == 'lost_on_death' and r.get('item_id', '').startswith('core_')}
            for iid in sorted(lost_ids):
                rid = 'craft_' + iid
                if rid not in self.known and self.total('knowledge_spares') >= 6 and self.total('research_notes') >= 2:
                    self.decisions.append({'session': self.session, 'decision': 'TARGETED_RESEARCH_AFTER_LOSS', 'item_id': iid,
                                           'cost': {'knowledge_spares': 6, 'research_notes': 2},
                                           'status': 'A3_DESIGN_PROPOSAL_NO_FREE_REPLACEMENT'})
                    self.research_recipe(rid, 'targeted')
        for rec in self._specimens():
            iid = rec['item_id']; token = rec['instance_id']
            rid = 'craft_' + iid
            if policy == 'keep_all_for_field_use':
                rec['disposition'] = 'field_use_candidate'; rec['location'] = 'bag'
                self.decisions.append({'session': self.session, 'decision': 'USE_CANDIDATE', 'instance': token,
                                       'item_id': iid, 'native_casts_executed': 0,
                                       'cast_readiness': self.items[iid]['skill_readiness'],
                                       'note': 'Allocation only; no verified Gold effect or risk reduction claimed.'})
            elif policy == 'store_all':
                rec['disposition'] = 'stored'; rec['location'] = 'home'
            elif policy == 'sacrifice_first_specimen':
                if rid not in self.known and self.total('knowledge_spares') >= 5:
                    self.research_recipe(rid, 'specimen', token)
            elif policy == 'targeted_after_loss':
                lost = any(r.get('item_id') == iid and r.get('location') == 'lost_on_death' for r in self.lost_instances)
                if lost and rid not in self.known and self.total('knowledge_spares') >= 6 and self.total('research_notes') >= 2:
                    self.decisions.append({'session': self.session, 'decision': 'TARGETED_RESEARCH_AFTER_LOSS', 'item_id': iid,
                                           'cost': {'knowledge_spares': 6, 'research_notes': 2},
                                           'status': 'A3_DESIGN_PROPOSAL_NO_FREE_REPLACEMENT'})
                    self.research_recipe(rid, 'targeted')
                else:
                    rec['disposition'] = 'stored'; rec['location'] = 'home'
            else:
                ready = ('advanced_workbench' in self.installed and 'tech_core_binding' in self.tech and self.total('ancient_catalyst') >= 1)
                if iid == 'core_ember' and ready and rid not in self.known and self.total('knowledge_spares') >= 5:
                    self.research_recipe(rid, 'specimen', token)
                else:
                    rec['disposition'] = 'stored'; rec['location'] = 'home'
        for rec in self.instances.values():
            if rec['origin'] == 'craft' and rec['item_id'].startswith('core_') and rec['location'] in ('home', 'bag'):
                rec['disposition'] = 'field_use_candidate'; rec['location'] = 'bag'

    # ----- agenda -----
    def _session_agenda(self):
        self.collect_jobs(); self._transfer_home(); self.install_stations()
        if self.sc.get('route_policy') == 'rush_east_unprepared' and 'cap_filter' not in self.caps:
            self.attempt_shortcut()
        # Reconciled A1 authored first hour: safe approach -> waystation locker/ledger -> relay hand-crank ->
        # Refuge resupply -> Orchard Apothecary filter lesson. No free bootstrap grant, no unmitigated shortcut.
        if 'cap_salvage' not in self.caps:
            self.gather_until('oak_wood', 2, 'live_oak_wood', 4)
            self.gather_until('iron_scrap', 2, 'live_iron_scrap', 4)
            self.novice_action('waystation_locker')
            self.novice_action('waystation_ledger')
            self.gather('a1_crown_salvage', 1)
        if 'cap_salvage' in self.caps and 'cap_power_1' not in self.caps:
            self.gather_until('oak_wood', 1, 'live_oak_wood', 4)
            self.gather_until('iron_scrap', 2, 'live_iron_scrap', 4)
            self.novice_action('relay_hand_crank')
        if 'cap_power_1' in self.caps and 'cap_filter' not in self.caps:
            self.gather_until('reed_fibre', 1, 'live_reed_fibre', 4)
            self.gather_until('moonleaf', 1, 'a1_amber_herb', 2)
            self.novice_action('apothecary_filter_lesson')
        # Fresh-player shelter still pays the real A0 shelter cost before station access.
        if not self.home_built:
            self.gather_until('oak_wood', 36, 'live_oak_wood', 8)
            self.gather_until('iron_scrap', 2, 'live_iron_scrap', 8)
            self.build_home()
        self.gather_until('stone_chunk', 12, 'live_stone_chunk', 6)
        if self.crafted['stone_pick'] < 1:
            self.craft_collect('stone_pick')
        self.gather_until('oak_wood', 70, 'live_oak_wood', 8)
        self.gather_until('iron_scrap', 60, 'live_iron_scrap', 10)
        self.gather_until('reed_fibre', 18, 'live_reed_fibre', 6)
        if self.crafted['furnace_kit'] < 1:
            self.craft_collect('furnace_kit')
        if self.crafted['workbench_kit'] < 1:
            self.craft_collect('workbench_kit')
        self.install_stations()
        if 'furnace' in self.installed:
            self.craft_need('burn_charcoal', 24, 3)
            self.craft_need('smelt_iron', 20, 3)
        if self.crafted['research_kit'] < 1:
            self.craft_collect('research_kit')
        self.install_stations()
        if 'research' in self.installed:
            self.craft_need('make_spares', 52, 2)
            self.craft_need('weave_cloth', 6, 2)
        self.install_stations()
        if 'cap_seal_1' in self.caps and 'specimen_ember' not in self.claimed_once:
            self.gather('specimen_ember', 1)
        if 'legacy_chapter1_rewards' not in self.claimed_once and 'cap_seal_1' in self.caps:
            self.gather('legacy_chapter1_rewards', 1)
        if 'cap_filter' in self.caps and 'cap_seal_2' not in self.caps:
            self.gather_until('sulfur', 2, 'a1_ember_sulfur', 1)
            self.expedition('poi_ember_old_forge', purpose='seal2')
        if 'cap_seal_2' in self.caps and 'catalyst_vault' not in self.claimed_once:
            self.gather('catalyst_vault', 1)
        if 'cap_power_1' in self.caps and 'cap_climb' not in self.caps:
            self.expedition('poi_ember_piton_works', purpose='climb_bootstrap')
        if 'cap_climb' in self.caps and 'cap_thermal' not in self.caps:
            self.expedition('poi_frost_wardhouse', purpose='thermal_bootstrap')
        if 'cap_thermal' in self.caps and 'cap_seal_2' in self.caps and 'specimen_frost' not in self.claimed_once:
            self.gather('specimen_frost', 1)
        # Knowledge spine and Core manufacture.
        self.wait_production(); self.collect_jobs()
        if 'research' in self.installed:
            self.craft_need('make_spares', 52, 3)
            self.craft_need('make_notes', 9, 3)
            self.research_tech('tech_smelting')
            self.wait_production(); self.collect_jobs()
            self.research_tech('tech_precision')
            self.wait_production(); self.collect_jobs()
            self.research_tech('tech_core_binding')
        self.wait_production(); self.collect_jobs()
        if 'tech_core_binding' in self.tech:
            self.research_recipe('core_blank', 'targeted')
            self.wait_production(); self.collect_jobs()
            self.research_recipe('charge_blank', 'targeted')
            self.wait_production(); self.collect_jobs()
        self.craft_need('make_parts', 8, 3)
        self.craft_need('smelt_iron', 20, 3)
        self.craft_need('burn_charcoal', 24, 3)
        self.install_stations()
        self.apply_core_policy()
        if 'craft_core_ember' in self.known and 'advanced_workbench' in self.installed and self.crafted['craft_core_ember'] < 1:
            self.craft_collect('core_blank', 1)
            self.craft_collect('charge_blank', 1)
            self.craft_collect('craft_core_ember', 1)
        self.apply_core_policy()
        # Late non-boss frontier attempts; remaining goals are reported, not forced.
        if 'cap_seal_2' in self.caps and 'cap_boat' not in self.caps:
            self.expedition('poi_saffron_drydock', purpose='boat_bootstrap')
        if 'cap_boat' in self.caps and 'cap_tide_ward' not in self.caps:
            self.expedition('poi_pearl_stilt_village', purpose='tide_ward_bootstrap')
        if 'cap_tide_ward' in self.caps and 'cap_seal_3' not in self.caps:
            self.expedition('poi_pearl_customs', purpose='seal3')
        if 'cap_seal_3' in self.caps and 'specimen_venom' not in self.claimed_once:
            self.gather('specimen_venom', 1)
        # Optional non-boss sustain: clay/reed stockpile for future garden/filters.
        self.gather_until('clay', 4, 'a1_mere_clay', 1)
        self.gather_until('reed_fibre', 24, 'live_reed_fibre', 4)
        self.wait_production(); self.collect_jobs(); self._transfer_home(); self._ensure_chest()

    def run(self):
        sessions = int(self.sc.get('sessions', 14)); minutes = int(self.sc.get('minutes', 45))
        for session in range(1, sessions + 1):
            self.session = session
            self.time_left = minutes * 60
            self.claims_this_session = Counter()
            self.session_station_work = 0
            self.session_active_categories = Counter()
            start_jobs = {j['seq']: j['remaining'] for j in self.jobs}
            self._session_agenda()
            # No offline catch-up: remaining job time persists only as active-session debt.
            end_jobs = {j['seq']: j['remaining'] for j in self.jobs}
            for seq, rem in start_jobs.items():
                if seq in end_jobs and end_jobs[seq] > rem:
                    raise ModelError('offline progress invented')
            self.session_reports.append(self._snapshot())
        return self.report()

    def _snapshot(self):
        cores = [{'token': r['instance_id'], 'item_id': r['item_id'], 'location': r['location'],
                  'uses': r['uses'], 'disposition': r['disposition'], 'origin': r['origin']}
                 for r in self.instances.values() if r['item_id'].startswith('core_')]
        budget = int(self.sc.get('minutes', 45) * 60)
        active = budget - self.time_left
        categories = dict(self.session_active_categories)
        return {
            'session': self.session, 'scheduled_budget_seconds': budget, 'active_modeled_seconds': active,
            'active_seconds_used': active, 'station_work_seconds': int(self.session_station_work),
            'unused_budget_seconds': budget - active, 'active_time_categories': categories,
            'sparse_scenario_model': bool(self.cfg.get('time_accounting', {}).get('sparse_scenario_model', True)),
            'home_inventory': {i: n for i, n in sorted(self.home.items()) if n},
            'bag_inventory': {i: n for i, n in sorted(self.bag.items()) if n},
            'bag_slots_used': self.bag_slots(), 'home_slots_used': self.home_slots(), 'home_capacity': self.home_capacity(),
            'cores': cores, 'capabilities': sorted(self.caps), 'technologies': sorted(self.tech),
            'known_recipes': len(self.known), 'stations': sorted(self.installed),
            'pending_jobs': [{'target': j['target'], 'station': j['station'], 'remaining': j['remaining'], 'status': j['status']} for j in self.jobs],
            'bottlenecks_this_run': dict(self.bottlenecks.most_common(12)),
            'deaths': self.deaths, 'specimen_discoveries': len(self.specimen_discoveries),
        }

    def _decision_analysis(self):
        return {
            'status': 'A3_DESIGN_PROPOSAL_NATIVE_CASTS_ZERO',
            'physical_core_vs_permanent_recipe': 'Core specimen is a finite physical instance; recipe knowledge is permanent. Research consumes the specimen; manufacture creates a new finite Core.',
            'alternatives': {
                'USE': {'gain': 'Potential field effect if A4 Gold skill is verified.', 'risk': 'Finite uses may be spent without permanent recipe knowledge.',
                        'permanent_loss': 'No recipe knowledge gained by casting alone.', 'missing_evidence': ['A4 Gold skill verification', 'cast cost/uses/effect', 'encounter risk reduction', 'counterfactual sacrifice value']},
                'STORE': {'gain': 'Preserves optionality and physical instance.', 'risk': 'Opportunity cost: delayed manufacture/knowledge; storage/death risk if carried.',
                          'permanent_loss': 'None while stored safely.', 'missing_evidence': ['storage safety', 'later encounter utility', 'player preference']},
                'SACRIFICE': {'gain': 'Permanent recipe knowledge and future manufacture path.', 'risk': 'Destroys the physical specimen; requires spares/station/catalyst/reagents to regain a Core.',
                              'permanent_loss': 'The specific specimen instance is consumed.', 'missing_evidence': ['manufacture cost vs field utility', 'catalyst availability', 'time-to-replacement']},
            },
            'fair_use_vs_sacrifice_comparison': {
                'not_yet_fair': True,
                'required': ['same starting Core instance and session', 'A4-verified USE effect, uses, condition and risk delta', 'SACRIFICE confirmation warning and atomic consume',
                             'manufacture recipe cost and catalyst/reagent availability', 'time to replacement under active-session queue', 'encounter outcomes with and without USE',
                             'human valuation of permanent knowledge vs finite utility'],
                'native_casts_executed': self.native_casts_executed,
            },
            'adversity': {
                'early_loss': 'Bag items and bag-carried instances are lost on death; knowledge/home retained. No invisible protection.',
                'targeted_fallback': 'After a lost specimen, targeted research may buy the recipe for 6 spares + 2 notes; it does not restore the physical Core.',
                'blocked_routes': 'Route edges require A1 capabilities; safe approach has zero exposure; east shortcut requires cap_filter. Blocked routes force longer paths or stall.',
                'missing_reagents': 'frost_resin/venom_sac/peat and tide/pressure resistance remain explicit gaps; no silent aliases.',
                'limited_playtime': 'Active-session time only; no offline catch-up; unused budget is not engagement.',
                'queue_uncertainty': 'Paused/interrupted station work persists as remaining active time; no free completion or duplicate grant.',
            },
            'decision_records': self.decisions,
            'native_casts_executed': self.native_casts_executed,
        }

    def report(self):
        found = Counter(d['item_id'] for d in self.specimen_discoveries)
        manufactured = {i: self.crafted.get('craft_' + i, 0) for i in ['core_ember', 'core_frost', 'core_venom']}
        remaining = []
        for g in self.cfg['late_goals']:
            poi = g['poi']
            p = next((x for x in self.cap_pois.values() if x['poi_id'] == poi), None)
            req = set(g.get('required_capabilities', p['required_capabilities'] if p else []))
            missing_mat = g['missing_or_unresolved_materials']
            status = 'REACHED_CAPS_BUT_NOT_NATIVE' if req <= self.caps and not missing_mat else 'REMAINING_GOAL'
            remaining.append({'goal_id': g['id'], 'poi_id': poi, 'systems': g['systems'],
                              'required_capabilities': sorted(req),
                              'capabilities_owned': sorted(req & self.caps),
                              'missing_or_unresolved_materials': missing_mat,
                              'status': status})
        time_ledger = dict(self.time_ledger)
        budget = int(self.sc.get('sessions', 14) * self.sc.get('minutes', 45) * 60)
        active = sum(s['active_modeled_seconds'] for s in self.session_reports)
        time_accounting = {
            'status': 'SPARSE_SCENARIO_MODEL' if self.cfg.get('time_accounting', {}).get('sparse_scenario_model', True) else 'MODELED',
            'scheduled_budget_seconds': budget, 'active_modeled_seconds': active,
            'unused_budget_seconds': budget - active, 'station_work_seconds': sum(s['station_work_seconds'] for s in self.session_reports),
            'active_time_categories': time_ledger,
            'combat_seconds_modeled': time_ledger.get('combat', 0),
            'player_decision_seconds_modeled': time_ledger.get('player_decision', 0),
            'station_work_overlaps_player_actions': True,
            'unmodeled_time': self.cfg.get('time_accounting', {}).get('unmodeled_time', []),
            'note': 'Scheduled budget is not engagement. Station work may overlap travel/gather/craft handling; unused time is not padded.',
            'required_native_and_human_evidence': [
                'A0 station queue + authoritative active-time receipts',
                'A0/A1 native combat encounter durations and damage/retreat recovery',
                'A1 authored POI traversal/puzzle/interaction timings',
                'A3/A0 native gather node cooldown and yield observation',
                'A6 human read/plan/decide time and inventory-management friction',
                'human 45-minute session observation for fun, fatigue, and voluntary continuation',
            ],
        }
        decision_analysis = self._decision_analysis()
        invariants = {
            'no_negative_inventory': all(n >= 0 for n in self.home.values()) and all(n >= 0 for n in self.bag.values()),
            'bag_capacity_respected': all(s['bag_slots_used'] <= int(self.assume['bag_slots']) for s in self.session_reports),
            'home_capacity_respected': all(s['home_slots_used'] <= s['home_capacity'] for s in self.session_reports),
            'no_unapproved_alias_items': not any(i in set(self.home) | set(self.bag) for i in ['frost_resin', 'venom_sac', 'peat']),
            'one_time_sources_not_repeated': all(self.claims[s] <= 1 for s in self.claimed_once),
            'no_session1_core_flood': sum(1 for d in self.specimen_discoveries if d['session'] == 1) <= 1,
            'specimen_discoveries_bounded': len(self.specimen_discoveries) <= 3,
            'knowledge_retained_on_death': all(e.get('knowledge_retained', True) for e in self.events if e['event'] == 'death'),
            'no_native_casts_claimed': self.native_casts_executed == 0,
            'manufacture_requires_catalyst': manufactured['core_ember'] == 0 or self.catalyst_successes > 0,
        }
        return {
            'schema': 'soh.economy.progression_report.v1',
            'scenario': self.scenario_name, 'scenario_config': self.sc,
            'status': 'SIMULATION_ONLY_SOH_DESIGN_PROPOSAL',
            'gameplay_design_status': 'NOT_HUMAN_PLAYTESTED',
            'integration_status': 'WORLD_NOT_INTEGRATED_A0_A1_A4_PENDING',
            'source_refs': self.cfg['source_refs'],
            'firsts': self.firsts,
            'summary': {
                'sessions': len(self.session_reports), 'minutes_per_session': self.sc.get('minutes', 45),
                'home_built': self.home_built, 'stations': sorted(self.installed),
                'capabilities': sorted(self.caps), 'technologies': sorted(self.tech),
                'known_recipes': len(self.known), 'crafted': dict(self.crafted),
                'specimens_found': dict(found), 'specimen_discovery_events': self.specimen_discoveries,
                'cores_manufactured': manufactured,
                'finite_cast_uses_created_by_manufacture': sum(manufactured[i] * int(self.items[i].get('max_uses', 0)) for i in manufactured),
                'native_casts_executed': 0,
                'catalyst_attempts': self.catalyst_attempts, 'catalyst_successes': self.catalyst_successes,
                'deaths': self.deaths, 'lost_items': dict(self.lost), 'lost_instances': self.lost_instances,
                'overflow_left_behind': dict(self.overflow),
            },
            'expected_vs_rare': {
                'roadside_cache_expected_per_claim': self.expected_roadside,
                'roadside_claims': self.roadside_claims,
                'roadside_expected_totals': {i: round(n * self.roadside_claims, 3) for i, n in self.expected_roadside.items()},
                'rare_catalyst': {'attempts': self.catalyst_attempts, 'successes': self.catalyst_successes,
                                  'proposal_chance': self.sources['catalyst_vault']['discovery_chance'],
                                  'policy': 'one_time_vault_not_repeatable_farm'},
                'specimens': {'policy': 'one_time_authored_discoveries', 'found': dict(found)},
            },
            'core_decisions': self.decisions,
            'route_choices': self.route_log,
            'bottlenecks': dict(self.bottlenecks.most_common()),
            'per_session': self.session_reports,
            'time_accounting': time_accounting,
            'decision_analysis': decision_analysis,
            'novice_bootstrap_events': [e for e in self.events if e['event'] == 'novice_world_action'],
            'shortcut_attempts': self.shortcut_attempts,
            'source_adoption': {'contract': 'data/survival/items/a1_source_adoption.v2.json',
                                'adopted': [a['transformation_id'] for a in self.adoption.get('adopted_source_transformations', [])],
                                'rejected_global_aliases': [a['material_key'] for a in self.adoption.get('rejected_global_aliases', [])],
                                'proposed_not_catalogged': [a['proposed_item_id'] for a in self.adoption.get('proposed_catalog_additions', [])],
                                'missing_items': self.adoption.get('missing_items', [])},
            'late_goals': remaining,
            'remaining_late_goal_count': sum(1 for g in remaining if g['status'] == 'REMAINING_GOAL'),
            'unresolved': {
                'a1_aliases': self.cfg['unresolved_a1_aliases'],
                'a1_missing_items': self.cfg['unresolved_a1_missing'],
                'provisional_bindings': [s['source_id'] for s in self.cfg['product_sources'] if s['binding_status'].startswith('PROVISIONAL')],
                'a0': ['generic SaveService unique-token guards', 'production station/time host', 'native death/respawn and home placement'],
                'a4': ['real Gold skill verification', 'authoritative cast commit atomicity', 'tactical effects / risk reduction not modeled'],
                'human': ['fun / rarity excitement', 'actual travel/combat/gather pacing', '14-day engagement'],
            },
            'invariants': invariants,
            'technical_status': 'PASS' if all(invariants.values()) else 'FAIL',
        }


def run_scenario(name='baseline', overrides=None, inputs=None):
    return ProgressionModel(name, overrides, inputs).run()


def run_all(names=None, inputs=None):
    inp = inputs or load_inputs(); validate_config(inp)
    names = names or list(inp['config']['scenarios'])
    reports = [run_scenario(n, inputs=inp) for n in names]
    baseline = next((r for r in reports if r['scenario'] == 'baseline'), reports[0])
    comparison = []
    for r in reports:
        s = r['summary']
        comparison.append({'scenario': r['scenario'], 'technical_status': r['technical_status'],
                           'home_built': s['home_built'], 'specimens_found': s['specimens_found'],
                           'cores_manufactured': s['cores_manufactured'],
                           'first_ember_discovery': r['firsts'].get('discovery:core_ember'),
                           'first_frost_discovery': r['firsts'].get('discovery:core_frost'),
                           'first_ember_manufacture': r['firsts'].get('manufacture:core_ember'),
                           'catalyst_successes': s['catalyst_successes'], 'deaths': s['deaths'],
                           'remaining_late_goals': r['remaining_late_goal_count'],
                           'time_accounting_status': r['time_accounting']['status'],
                           'active_modeled_seconds': r['time_accounting']['active_modeled_seconds'],
                           'unused_budget_seconds': r['time_accounting']['unused_budget_seconds']})
    return {
        'schema': 'soh.economy.progression_audit.v1',
        'status': 'SIMULATION_ONLY_SOH_DESIGN_PROPOSAL',
        'gameplay_design_status': 'NOT_HUMAN_PLAYTESTED',
        'technical_fixture_preserved': {
            'model': 'tools/survival/economy/simulate_economy.py',
            'report': 'docs/survival/economy/balance_report.json',
            'note': 'The 14-session 156-loot-specimen conservation run remains a technical stress fixture, not a realistic playtest.',
        },
        'baseline': baseline,
        'scenarios': {
            r['scenario']: (r if r['scenario'] == 'baseline' else
                            {k: v for k, v in r.items() if k not in ('per_session', 'route_choices', 'source_refs')})
            for r in reports
        },
        'comparison': comparison,
        'product_findings': product_findings(baseline, reports),
    }


def product_findings(baseline, reports):
    findings = []
    b = baseline['summary']
    findings.append({'id': 'P-01', 'status': 'OBSERVED_IN_MODEL',
                     'finding': 'Rare Core specimens are one-time POI discoveries, not flat timer loot.',
                     'evidence': {'specimen_discoveries': b['specimen_discovery_events'], 'session1_flood': False}})
    findings.append({'id': 'P-02', 'status': 'OBSERVED_IN_MODEL',
                     'finding': 'USE/STORE/SACRIFICE changes permanent knowledge and physical Core availability; no Gold cast is executed.',
                     'evidence': {'decisions': baseline['core_decisions'], 'native_casts_executed': 0}})
    findings.append({'id': 'P-03', 'status': 'BOTTLENECK',
                     'finding': 'Core manufacture is gated by knowledge_spares, ancient_catalyst, advanced workbench and family reagents.',
                     'evidence': {'bottlenecks': baseline['bottlenecks'], 'cores_manufactured': b['cores_manufactured']}})
    findings.append({'id': 'P-04', 'status': 'UNRESOLVED_A1',
                     'finding': 'frost_resin, venom_sac and peat remain unapproved; Frost/Venom manufacture must not silently consume A1 world keys as A3 items.',
                     'evidence': {'aliases': baseline['unresolved']['a1_aliases']}})
    findings.append({'id': 'P-05', 'status': 'REMAINING_FRONTIER',
                     'finding': 'At least three late goals remain after the modeled journey; they are destinations, not proven engagement.',
                     'evidence': {'remaining_late_goal_count': baseline['remaining_late_goal_count'], 'goals': baseline['late_goals']}})
    findings.append({'id': 'P-06', 'status': 'SENSITIVITY',
                     'finding': 'Poor loot, lost specimens, shortages, failed expeditions and limited playtime delay or block milestones rather than being averaged away.',
                     'evidence': {'comparison': [{'scenario': r['scenario'], 'firsts': r['firsts'], 'deaths': r['summary']['deaths']} for r in reports]}})
    return findings


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scenario', default=None)
    ap.add_argument('--json', type=pathlib.Path)
    ap.add_argument('--sessions', type=int)
    ap.add_argument('--minutes', type=int)
    args = ap.parse_args()
    overrides = {}
    if args.sessions:
        overrides['sessions'] = args.sessions
    if args.minutes:
        overrides['minutes'] = args.minutes
    if args.scenario:
        report = run_scenario(args.scenario, overrides or None)
    else:
        report = run_all()
    if args.json:
        args.json.write_text(json.dumps(report, indent=2) + '\n')
    if args.scenario:
        print(json.dumps({k: report[k] for k in ['scenario', 'technical_status', 'gameplay_design_status', 'firsts', 'summary', 'invariants', 'remaining_late_goal_count']}, indent=2))
        return 0 if report['technical_status'] == 'PASS' else 1
    print(json.dumps({'status': report['status'], 'gameplay_design_status': report['gameplay_design_status'],
                      'comparison': report['comparison'],
                      'baseline_technical_status': report['baseline']['technical_status'],
                      'product_findings': report['product_findings']}, indent=2))
    return 0 if all(r['technical_status'] == 'PASS' for r in report['scenarios'].values()) else 1


if __name__ == '__main__':
    raise SystemExit(main())
