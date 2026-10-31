extends Node
## A0 PRODUCTION THREAT MOUNT (Round 12, WP-A0.3).
##
## Authority: CT decision T1 — A0 may integrate ONE deterministic, optional
## opening-world threat through the existing `game/survival/encounters` seam,
## with no reward, no XP and no random loot. This node is the ONLY place the
## production overworld ever creates an enemy for the survival run:
##
##  * the shipped default is OFF (`survival/a0_optional_threat` absent/false), so
##    a normal player never meets it until A3's risk/reward policy and A1's
##    visual review pass;
##  * when ON, placement is validated against the live world (traversability,
##    protected route cells, structure footprints, the real safe-distance and
##    endpoint/shortcut margins enforced inside OptionalSkeletonEncounter), so a
##    site that would ambush the player at the bed or on the corridor is refused
##    and the mount reports the refusal instead of placing something unfair;
##  * the enemy is the shipped `skeleton_enemy.gd` with contact damage 14, attack
##    range 38, detection 184 — no tuned-up test numbers, no scripted lethal hit;
##  * the encounter keeps its own durable first-hit receipt, zero score reward and
##    the `loot_drop_processed` seal that stops the global director from dropping
##    random loot.
##
## What it does NOT do: no damage injection, no teleporting the Hero, no bed or
## bag logic (the world's real death path owns those), no currency.
const ENCOUNTER_SCRIPT := preload("res://game/survival/optional_skeleton_encounter.gd")
const SETTING := "survival/a0_optional_threat"
## Searched outward from the Hero's start, in tiles. The lower bound keeps the
## threat out of the first-minute safety ring; the upper bound keeps it inside
## the opening route the player actually walks.
const RING_MIN := 26
const RING_MAX := 64

var last_error := ""
var mounted := false
var attempts := 0
var site_cell := Vector2i(-1, -1)
var encounter: Node = null

var _world: Node
var _hero: Node2D
var _nav: OverworldTraversability
var _build: Node


func mount(world: Node, hero: Node2D, navigation: OverworldTraversability, build: Node) -> Dictionary:
	_world = world
	_hero = hero
	_nav = navigation
	_build = build
	last_error = ""
	mounted = false
	attempts = 0
	if world == null or hero == null or navigation == null or build == null:
		last_error = "world_seats_absent"
		return snapshot()
	if not bool(ProjectSettings.get_setting(SETTING, false)):
		return snapshot()
	var found := _find_site()
	if not found.get("ok", false):
		last_error = String(found.get("reason", "site_refused"))
		return snapshot()
	var node := ENCOUNTER_SCRIPT.new()
	node.name = "OptionalSkeletonEncounter"
	world.add_child(node)
	var configured: Dictionary = node.call(&"configure", hero, build, navigation, site_cell)
	if not bool(configured.get("ok", false)):
		last_error = "encounter_refused:" + String(configured.get("reason", "unknown"))
		node.queue_free()
		return snapshot()
	encounter = node
	mounted = true
	return snapshot()


## Outward ring search. Every candidate is validated by the encounter itself, so
## this function can only ever offer a site the seam accepts; the search exists
## to find the nearest acceptable one rather than hard-coding a coordinate that
## would silently rot when A1 regenerates geography.
func _find_site() -> Dictionary:
	if not is_instance_valid(_hero) or _nav == null:
		return {"ok": false, "reason": "hero_absent"}
	var origin := _nav.cell_of(_hero.global_position)
	for ring in range(RING_MIN, RING_MAX + 1):
		for dy in range(-ring, ring + 1):
			for dx in range(-ring, ring + 1):
				if maxi(absi(dx), absi(dy)) != ring:
					continue
				var cell := origin + Vector2i(dx, dy)
				attempts += 1
				if not _nav.in_bounds(cell) or not _nav.is_free(cell):
					continue
				# The seam's own rules are the oracle: a site it refuses is not a
				# site. `configure` is the only authority on distance, endpoints,
				# shortcuts, road detail and structure overlap.
				var probe: Dictionary = ENCOUNTER_SCRIPT.validate_site(_hero, _build, _nav, cell)
				if not bool(probe.get("ok", false)):
					continue
				site_cell = cell
				return {"ok": true, "cell": cell}
	return {"ok": false, "reason": "no_valid_site_in_ring:%d..%d" % [RING_MIN, RING_MAX]}


func snapshot() -> Dictionary:
	return {
		"schema": "soh.a0.threat_mount.v1",
		"setting": SETTING,
		"enabled": bool(ProjectSettings.get_setting(SETTING, false)),
		"mounted": mounted,
		"attempts": attempts,
		"site_cell": [site_cell.x, site_cell.y],
		"reward_free": true,
		"last_error": last_error,
	}
