class_name VenomSkills
extends RefCounted

## Registry mapping an ORIGINAL skill id to its native generator.
##
## The `def` rows are transcribed from the ORIGINAL `src/game/skills/index.ts`
## META table: id, name, form, aim, cast, first, total, dur. Only the fields the
## cast pipeline and the generator actually consume are carried, and none of
## them are invented: they are the authored values.
##
## `run` factories return a state-machine object exposing `resume()` / `is_valid()`,
## the GDScript equivalent of the original `function*` skill bodies.

const S2 = preload("res://prototypes/skill_readiness/native/venom/venom_s2.gd")
const S3 = preload("res://prototypes/skill_readiness/native/venom/venom_s3.gd")
const S1 = preload("res://prototypes/skill_readiness/native/venom/venom_s1.gd")
const S2H = preload("res://prototypes/skill_readiness/native/venom/venom_s2_harvester.gd")
const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")


static func defs() -> Dictionary:
	var P: Dictionary = M.P
	return {
		1: {"id": 1, "name": "Glassfang Hunt", "form": "vessel",
				"aim": {"kind": "target", "range": 190},
				"cast": 0.1, "first": 0.25, "total": 205, "dur": 5},
		2: {"id": 2, "name": "Blooming Parasite", "form": "vessel",
				"aim": {"kind": "ground", "range": 170, "radius": 62},
				"cast": 0.15, "first": 0.4, "total": 265, "dur": 8},
		3: {"id": 3, "name": "Leechwater Rush", "form": "vessel",
				"aim": {"kind": "cone", "range": 150, "angle": 1.24},
				"cast": 0.08, "first": 0.18, "total": 195, "dur": 6},
		4: {"id": 4, "name": "Porcelain Bastion", "form": "vessel",
				"aim": {"kind": "ground", "range": 160, "radius": 44},
				"cast": 0.2, "first": 0.5, "total": 360, "dur": 12},
		5: {"id": 5, "name": "Bellows Toad", "form": "vessel",
				"aim": {"kind": "cone", "range": 140, "angle": 0.96},
				"cast": 0.08, "first": 0.3, "total": 255, "dur": 6},
		6: {"id": 6, "name": "Graft Caravan", "form": "vessel",
				"aim": {"kind": "path", "range": 230, "width": 26},
				"cast": 0.2, "first": 0.45, "total": 345, "dur": 8},
		7: {"id": 7, "name": "Hatchery Fall", "form": "vessel",
				"aim": {"kind": "ground", "range": 170, "radius": 80},
				"cast": 0.2, "first": 0.5, "total": 280, "dur": 10},
		8: {"id": 8, "name": "Brine Serpents", "form": "vessel",
				"aim": {"kind": "multi", "range": 200, "n": 3},
				"cast": 0.1, "first": 0.35, "total": 290, "dur": 8},
		9: {"id": 9, "name": "Molting Harvester", "form": "vessel",
				"aim": {"kind": "dir", "range": 230, "width": 34},
				"cast": 0.2, "first": 0.4, "total": 400, "dur": 9},
		10: {"id": 10, "name": "The Walking Crucible", "form": "vessel",
				"aim": {"kind": "ground", "range": 200, "radius": 110},
				"cast": 0.3, "first": 0.75, "total": 800, "dur": 15},
		11: {"id": 11, "name": "Unsealed Catalyst", "form": "trans",
				"aim": {"kind": "self", "range": 90},
				"cast": 0.45, "first": 0.45, "total": 80, "dur": 4},
		12: {"id": 12, "name": "Verdigris Wake", "form": "venom",
				"aim": {"kind": "path", "range": 200, "width": 24},
				"cast": 0.08, "first": 0.2, "total": 220, "dur": 8},
		13: {"id": 13, "name": "Mercury Garden", "form": "venom",
				"aim": {"kind": "ground", "range": 180, "radius": 70},
				"cast": 0.1, "first": 0.35, "total": 280, "dur": 9},
		14: {"id": 14, "name": "Reaction Cascade", "form": "venom",
				"aim": {"kind": "target", "range": 220},
				"cast": 0.08, "first": 0.22, "total": 300, "dur": 6},
		15: {"id": 15, "name": "Breath of the Vat", "form": "venom",
				"aim": {"kind": "dir", "range": 170, "width": 70},
				"cast": 0.1, "first": 0.3, "total": 275, "dur": 9},
		16: {"id": 16, "name": "Crystal Rot", "form": "venom",
				"aim": {"kind": "target", "range": 200},
				"cast": 0.1, "first": 0.3, "total": 375, "dur": 7},
		17: {"id": 17, "name": "Reverse Extraction", "form": "venom",
				"aim": {"kind": "dir", "range": 200, "width": 90},
				"cast": 0.1, "first": 0.25, "total": 285, "dur": 7},
		18: {"id": 18, "name": "Bitter Rain", "form": "venom",
				"aim": {"kind": "ground", "range": 190, "radius": 86},
				"cast": 0.15, "first": 0.55, "total": 370, "dur": 9},
		19: {"id": 19, "name": "False Remedy", "form": "venom",
				"aim": {"kind": "target", "range": 190},
				"cast": 0.1, "first": 0.28, "total": 295, "dur": 7},
		20: {"id": 20, "name": "Plague Cartography", "form": "venom",
				"aim": {"kind": "drag", "range": 300, "radius": 14},
				"cast": 0.1, "first": 0.35, "total": 405, "dur": 9},
		21: {"id": 21, "name": "The Last Distillation", "form": "venom",
				"aim": {"kind": "ground", "range": 220, "radius": 130},
				"cast": 0.3, "first": 0.75, "total": 850, "dur": 14},
	}


## Generator factories. Only ids with a ported generator appear here; asking for
## an unported id returns null rather than a placeholder, so a missing skill can
## never be mistaken for a running one.
static func run_factory(skill_id: int):
	match skill_id:
		1:
			return func(c): return S1.make(c)
		2:
			return func(c): return S1.parasite(c)
		3:
			return func(c): return S1.leechwater(c)
		4:
			return func(c): return S1.bastion(c)
		5:
			return func(c): return S1.toad(c)
		6:
			return func(c): return S2.caravan(c)
		9:
			return func(c): return S2H.harvester(c)
	return null


static func has_generator(skill_id: int) -> bool:
	return run_factory(skill_id) != null


## ---------------------------------------------------------------------------
## source-native execution probe
## ---------------------------------------------------------------------------

## Runs the ported generator for `sid` inside a real `venom_world` for a few
## authored ticks and reports whether a cast actually executed.
##
## This is the "does it really run" question, asked of the SOURCE-NATIVE
## engine rather than of the host adapter. It is deliberately separate: the
## host adapter (`Gold93SkillModule` / `gold_pair`) and the source-native
## pipeline (`venom_world` / `venom_engine`) are two different execution
## domains, and `readiness_report()` must never add their counts together.
static func probe_native(sid: int, ticks: int = 30, seed_: int = 7) -> bool:
	if not has_generator(sid):
		return false
	var defs: Dictionary = defs()
	if not defs.has(sid):
		return false
	var def: Dictionary = defs[sid]
	var ENGINE = preload("res://prototypes/skill_readiness/native/venom/venom_engine.gd")
	var WORLDG = preload("res://prototypes/skill_readiness/native/venom/venom_world.gd")
	var w = WORLDG.new(ENGINE.WW, ENGINE.WH)
	w.cfg["density"] = 16
	w.reset_ids()
	w.uid = 1
	w.reset(seed_, true)
	w.lab = true
	var p = w.player
	p.form = "venom" if String(def.get("form", "vessel")) == "venom" else "vessel"
	p.venomT = 999.0 if String(def.get("form", "vessel")) == "venom" else 0.0
	p.cat = 100.0
	var r: Dictionary = ENGINE.auto_aim(w, def)
	ENGINE.cast(w, def, r, run_factory(sid))
	var F: float = 1.0 / 60.0
	for _i in range(ticks):
		w.step(F)
	return w.time > 0.0 and w.castLog.size() > 0
