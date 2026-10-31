extends RefCounted
class_name RoadsideSourceContract

## Safe roadside source contract (A1).
##
## Defines roadside salvage source identities that A1 physically authenticates
## when mounting roadside outcrops. A3 enforces fail-closed: unauthenticated
## source IDs yield nothing and never grant inventory.
##
## Roadside sources are low-risk, lawful, limited-yield salvage points.
## Each source has finite max_yields tracked via SaveService transaction
## idempotency — a source cannot be harvested more times than its contract
## allows, even after reload.

## Source identities committed by A1. A3 authenticates these at mount time.
const ROADSIDE_SOURCE_IDS := [
	"roadside_oak_1",
	"roadside_stone_1",
	"roadside_iron_1",
]

## Contract terms per source. Finite rewards are explicit.
const SOURCE_CONTRACTS: Dictionary = {
	"roadside_oak_1": {
		"owner": "A1",
		"kind": "roadside",
		"display_name": "Roadside Oak Outcrop",
		"max_yields": 3,
		"base_yield": {"roadside_oak_scrap": 1},
		"spare_chance": 0.33,
		"tool_required": "stone_pick",
		"tool_wear_per_use": 25,
		"risk": "low",
		"availability": "always",
	},
	"roadside_stone_1": {
		"owner": "A1",
		"kind": "roadside",
		"display_name": "Roadside Stone Outcrop",
		"max_yields": 3,
		"base_yield": {"roadside_stone_chip": 1},
		"spare_chance": 0.33,
		"tool_required": "stone_pick",
		"tool_wear_per_use": 25,
		"risk": "low",
		"availability": "always",
	},
	"roadside_iron_1": {
		"owner": "A1",
		"kind": "roadside",
		"display_name": "Roadside Iron Deposit",
		"max_yields": 2,
		"base_yield": {"roadside_iron_scrap": 1},
		"spare_chance": 0.25,
		"tool_required": "iron_pick",
		"tool_wear_per_use": 10,
		"risk": "low",
		"availability": "always",
	},
}

## Check whether a source ID is a known roadside source.
func is_roadside_source(source_id: String) -> bool:
	return source_id in ROADSIDE_SOURCE_IDS

## Get the contract for a roadside source. Returns empty dict if unknown.
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
