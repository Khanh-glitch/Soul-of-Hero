class_name VenomCandidates
extends RefCounted

## UNVERIFIED candidate generators, kept OUTSIDE the verified registry.
##
## `venom_skills.gd` is the registry the shipped gates and the host adapter
## read. Nothing in it references this file. The differential test reaches a
## candidate only when it is started with `-- --candidates`, so a candidate
## that fails to load or diverges cannot change any verified result.
##
## Promotion = moving a case from here into `venom_skills.gd` in the same
## commit that records a PASS in docs/vfx/skill_readiness/parity/index.json.

const S3 = preload("res://prototypes/skill_readiness/native/venom/venom_s3.gd")
const S4 = preload("res://prototypes/skill_readiness/native/venom/venom_s4.gd")
const R17 = preload("res://prototypes/skill_readiness/native/venom/venom_r17.gd")
const R18 = preload("res://prototypes/skill_readiness/native/venom/venom_r18.gd")
const R19 = preload("res://prototypes/skill_readiness/native/venom/venom_r19.gd")
const R20 = preload("res://prototypes/skill_readiness/native/venom/venom_r20.gd")
const R21 = preload("res://prototypes/skill_readiness/native/venom/venom_r21.gd")


static func has_generator(skill_id: int) -> bool:
	return run_factory(skill_id) != null


static func run_factory(skill_id: int):
	match skill_id:
		7:
			return func(c): return S3.hatchery(c)
		8:
			return func(c): return S4.serpents(c)
		17:
			return func(c): return R17.extraction(c)
		18:
			return func(c): return R18.rain(c)
		19:
			return func(c): return R19.remedy(c)
		20:
			return func(c): return R20.cartography(c)
		21:
			return func(c): return R21.distillation(c)
	return null
