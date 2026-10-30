extends RefCounted
## A7-owned test double for the A0 profile port (D074's `soh.economy.a0_profile_port.v1`).
##
## ## Why A7 is allowed to write this
## A3's own native meta test ships the same thing
## (`tests/survival/catalog/a0_profile_port_candidate.gd`, marked
## `OWNER-CONTRACT CANDIDATE ONLY — NOT PRODUCTION A0`). A port is the boundary A0
## must provide; until A0 provides one, the *only* way to execute A3's rules is a
## double that implements the documented contract. This class therefore does
## exactly two things: it answers the five port questions from data the probe
## controls, and it keeps the profile deltas inside the save candidate the way
## A3's candidate does.
##
## ## What the probe must never conclude from it
## A passing check here is a statement about **A3's planner**, never about the
## product. The product has no port, so every number produced through this class is
## labelled `MODEL_ORACLE` in the probe output, and the product verdict for
## "a player can bank currency" stays RED until A0 ships the port.
##
## The double is also the attack surface: the probe mutates `run_ctx`, `endpoints`
## and `sources` to forge identity, position, revision and generation, and expects
## A3's planner to refuse each forgery by name.

var run_ctx: Dictionary = {}
var endpoints: Dictionary = {}
var sources: Dictionary = {}
## Counts the profile writes, so a probe can prove that a refused plan never
## reached the durable balance.
var profile_writes := 0


func run_context() -> Dictionary:
	return run_ctx.duplicate(true)


func endpoint_authority(endpoint_id: String) -> Dictionary:
	return (endpoints.get(endpoint_id, {}) as Dictionary).duplicate(true)


func source_authority(source_id: String, source_instance_id: String) -> Dictionary:
	return (sources.get(source_id + "|" + source_instance_id, {}) as Dictionary).duplicate(true)


func read_profile(candidate: Dictionary) -> Dictionary:
	var raw: Variant = candidate.get("profile", {})
	if not raw is Dictionary:
		return {"secured_ragnarok_currency": 0, "achievements": {"elder_stones": []}, "run_history": []}
	return raw


func apply_profile_delta(candidate: Dictionary, delta: int, receipt: Dictionary) -> bool:
	var profile := read_profile(candidate)
	var balance := int(profile.get("secured_ragnarok_currency", 0))
	if balance + delta < 0:
		return false
	profile["secured_ragnarok_currency"] = balance + delta
	var receipts: Array = profile.get("currency_receipts", [])
	receipts.append(receipt.duplicate(true))
	profile["currency_receipts"] = receipts
	candidate["profile"] = profile
	profile_writes += 1
	return true


func record_elder_stone(candidate: Dictionary, stone_id: String, receipt: Dictionary) -> bool:
	var profile := read_profile(candidate)
	var achievements: Dictionary = profile.get("achievements", {"elder_stones": []})
	var stones: Array = achievements.get("elder_stones", [])
	if stones.has(stone_id):
		return false
	stones.append(stone_id)
	achievements["elder_stones"] = stones
	profile["achievements"] = achievements
	candidate["profile"] = profile
	return true
