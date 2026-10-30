extends RefCounted
## OWNER-CONTRACT CANDIDATE ONLY — NOT PRODUCTION A0.
## Demonstrates the smallest profile/run atomic boundary A0 must provide inside
## the SAME SaveService document. It is never an autoload, never a side file,
## and never a second wallet. Production A3 fails closed without a real A0 port.

var run_ctx: Dictionary = {}
var endpoints: Dictionary = {}
var sources: Dictionary = {}

func run_context() -> Dictionary:
	return run_ctx.duplicate(true)

func endpoint_authority(endpoint_id: String) -> Dictionary:
	return (endpoints.get(endpoint_id, {}) as Dictionary).duplicate(true)

func source_authority(source_id: String, source_instance_id: String) -> Dictionary:
	var key := source_id + "|" + source_instance_id
	return (sources.get(key, {}) as Dictionary).duplicate(true)

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
	return true

func record_elder_stone(candidate: Dictionary, stone_id: String, receipt: Dictionary) -> bool:
	var profile := read_profile(candidate)
	var achievements: Dictionary = profile.get("achievements", {"elder_stones": []})
	var stones: Array = achievements.get("elder_stones", [])
	if stones.has(stone_id):
		return false
	stones.append(stone_id)
	achievements["elder_stones"] = stones
	achievements["stone_receipts"] = (achievements.get("stone_receipts", []) as Array) + [receipt.duplicate(true)]
	profile["achievements"] = achievements
	candidate["profile"] = profile
	return true

## Owner-contract candidate run reset: clears ALL run-local gameplay namespaces
## while preserving only profile achievements/history/secured currency.
func reset_run(candidate: Dictionary, new_ctx: Dictionary) -> void:
	candidate["survival"] = {"schema": 1, "resource_nodes": {}, "structures": {}, "containers": {}, "spawn_anchor": "", "death_bags": {}, "pending_death": "", "knowledge": {"recipes": {}}, "counters": {}}
	candidate.erase("survival_economy")
	candidate.erase("world_slice")
	var inventory: Dictionary = candidate.get("inventory", {})
	inventory["item_stacks"] = {}
	candidate["inventory"] = inventory
	var storage: Dictionary = candidate.get("storage", {})
	storage["item_stacks"] = {}
	candidate["storage"] = storage
	run_ctx = new_ctx.duplicate(true)
