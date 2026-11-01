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
##   * a station occupies the rectangle of its own footprint, and
##   * a player may list, queue at, and use a station when they are within
##     `SurvivalStructure.REACH` of that rectangle.
##
## Reach is measured to the block the player can see, not to a point inside it: a
## person standing against the side of a 2x2 furnace is 16 px from it, not 32 px
## from a centre buried in the middle of it. Measuring to the rectangle is also
## what makes a 1x1 chest, a 2x1 workbench and a 2x2 furnace behave the same way.
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


## The block a station physically occupies, in world pixels.
static func footprint_rect(node: Node2D, definition: Dictionary) -> Rect2:
	if node == null:
		return Rect2()
	return Rect2(node.global_position, footprint_pixels(definition))


## The point a player aims at when they walk up to a station: the centre of the
## footprint (used for approach and for player-facing feedback only).
static func anchor_for(node: Node2D, definition: Dictionary) -> Vector2:
	if node == null:
		return Vector2.ZERO
	return node.global_position + footprint_pixels(definition) * 0.5


## Distance from the player to the station's own block. 0 means touching it.
static func distance_to(player_position: Vector2, node: Node2D, definition: Dictionary) -> float:
	if node == null:
		return INF
	var rect := footprint_rect(node, definition)
	var clamped := Vector2(
		clampf(player_position.x, rect.position.x, rect.end.x),
		clampf(player_position.y, rect.position.y, rect.end.y))
	return player_position.distance_to(clamped)


static func in_reach(player_position: Vector2, node: Node2D, definition: Dictionary) -> bool:
	if node == null:
		return false
	return distance_to(player_position, node, definition) <= RADIUS
