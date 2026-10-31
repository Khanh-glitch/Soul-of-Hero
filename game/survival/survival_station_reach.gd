class_name SurvivalStationReach
extends RefCounted
## One policy for "can this player use that station", owned by A0.
##
## Why this file exists: the economy session listed a station within 64 px of
## `structure.global_position + Vector2(16, 16)` (a hardcoded half-cell offset that
## only makes sense for a 2x2 footprint), while `SurvivalStructure.REACH` (44 px)
## measured from the structure origin decided whether a player could interact with
## it. A player standing at a legal interaction distance from a 2x2 furnace could be
## outside the panel's station window, see no furnace recipes at all, and be told by
## the game that the furnace was not nearby - even though it was the thing in front
## of them.
##
## The single rule, stated once and measured from one point:
##
##   * a station's interaction anchor is the centre of its own footprint, and
##   * a player may list, queue at, and use a station when they are within
##     `SurvivalStructure.REACH` of that anchor.
##
## The anchor is derived from the piece definition (A3's catalogue through A0's
## survival service), never from a hardcoded cell offset, so a 1x1 chest, a 2x1
## workbench and a 2x2 furnace are all measured the same way. The radius is the
## same constant the player already experiences when interacting with any other
## structure, so there is one number to reason about, not two.

const RADIUS := SurvivalStructure.REACH


## Footprint in pixels for a piece definition ({x: cells_x, y: cells_y}).
static func footprint_pixels(definition: Dictionary) -> Vector2:
	var cells: Variant = definition.get("footprint", [])
	if cells is Array and (cells as Array).size() == 2:
		return Vector2(float(int(cells[0])) * 16.0, float(int(cells[1])) * 16.0)
	# A piece that declares no footprint occupies the cell it stands on.
	return Vector2(16.0, 16.0)


## The point a player interacts with: the centre of the footprint.
static func anchor_for(node: Node2D, definition: Dictionary) -> Vector2:
	if node == null:
		return Vector2.ZERO
	return node.global_position + footprint_pixels(definition) * 0.5


static func in_reach(player_position: Vector2, node: Node2D, definition: Dictionary) -> bool:
	if node == null:
		return false
	return player_position.distance_to(anchor_for(node, definition)) <= RADIUS


## Distance a player is from a station's anchor, for player-facing feedback.
static func distance_to(player_position: Vector2, node: Node2D, definition: Dictionary) -> float:
	if node == null:
		return INF
	return player_position.distance_to(anchor_for(node, definition))
