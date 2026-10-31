extends RefCounted
class_name QuarrySourceContract

## Quarry source-action contract (A8).
##
## Defines Quarry expedition source identities that A8 physically authenticates
## when mounting Quarry scenes. A3 enforces fail-closed: unauthenticated
## source IDs yield nothing and never grant inventory.
##
## Quarry sources are higher-risk expedition points with finite rewards.
## Each source has explicit max_yields and a chance for valuable Core fragments.
## Quarry samples are low-value until a run-local discovery unlocks their use.

## Source identities committed by A8. A3 authenticates these at mount time.
const QUARRY_SOURCE_IDS := [
	"quarry_deep_1",
]

## Contract terms per source. Finite rewards are explicit.
const SOURCE_CONTRACTS: Dictionary = {
	"quarry_deep_1": {
		"owner": "A8",
		"kind": "quarry",
		"display_name": "Deep Quarry Face",
		"max_yields": 5,
		"base_yield": {"quarry_sample": 2},
		"core_chance": 0.20,
		"tool_required": "iron_pick",
		"tool_wear_per_use": 10,
		"risk": "high",
		"availability": "expedition_only",
	},
}

## Check whether a source ID is a known Quarry source.
func is_quarry_source(source_id: String) -> bool:
	return source_id in QUARRY_SOURCE_IDS

## Get the contract for a Quarry source. Returns empty dict if unknown.
func get_contract(source_id: String) -> Dictionary:
	return SOURCE_CONTRACTS.get(source_id, {})

## Get the maximum number of harvests allowed for a source.
func get_max_yields(source_id: String) -> int:
	var contract = get_contract(source_id)
	if contract.is_empty():
		return 0
	return int(contract.get("max_yields", 0))

## Get the tool required to harvest from a source.
func get_required_tool(source_id: String) -> String:
	var contract = get_contract(source_id)
	if contract.is_empty():
		return ""
	return String(contract.get("tool_required", ""))
