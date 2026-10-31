class_name A0AuthoredWorldView
extends OverworldWorld
## The authored continent, answering the same questions the legacy world answers.
##
## A0 has exactly one gameplay world. Since R13 that world is A1's authored
## 1024x768 continent, streamed by A1's own streamer; the 384x256 Hollow Marches
## is retained as a *reusable route world* (see `A0WorldAuthority`), not as a
## second main world.
##
## Everything here is a read of A1's data through A1's API. This class does not
## paint, does not own geography and does not fork A1's reader:
##
##   * `width`/`height` are the frame A1 authored (1024x768 cells);
##   * `is_solid_cell()` is A1's own `walk` layer for that cell;
##   * `is_water_cell()` is A1's own `surface` layer;
##   * `blocker_root` is A1's streamed collision root, so the traversability grid
##     sees exactly the StaticBody2D the player will collide with.
##
## A world object that painted its own terrain here would be a second authority,
## which is what this round removed.

## Set by A0WorldAuthority before the world is used. `world_of`, `tile_of` and the
## grid queries are inherited; everything that needs A1 data goes through `_host`.
var _host: Node = null


func configure_authored(host: Node) -> void:
	_host = host
	var authority := host as A0WorldAuthority
	width = int(authority.world_cells().x)
	height = int(authority.world_cells().y)
	data = authority.world_document()
	# A1's streamed bodies are the real collision; pointing the traversability
	# grid at anything else would measure a world the player cannot touch.
	blocker_root = authority.collision_root()


func is_solid_cell(x: int, y: int) -> bool:
	if _host == null:
		return true
	if x < 0 or y < 0 or x >= width or y >= height:
		return true
	return not bool(_host.call(&"cell_is_walkable", Vector2i(x, y)))


func is_water_cell(x: int, y: int) -> bool:
	if _host == null or x < 0 or y < 0 or x >= width or y >= height:
		return false
	return String(_host.call(&"cell_surface", Vector2i(x, y))) == "water"


## A1 names its ground by surface/biome, so the legacy single-character codes do
## not exist there. An empty detail code means "no authored decal on this cell",
## which is the truthful answer and keeps build placement off a phantom road.
func ground_code_at(world_position: Vector2) -> String:
	return String(_host.call(&"cell_surface", tile_of(world_position)))


func detail_code_at(world_position: Vector2) -> String:
	return "r" if bool(_host.call(&"cell_is_road", tile_of(world_position))) else ""


func is_walkable(world_position: Vector2, radius := 6.0) -> bool:
	if _host == null:
		return false
	if not Rect2(Vector2.ZERO, Vector2(width, height) * TILE).has_point(world_position):
		return false
	for offset: Vector2 in [
		Vector2.ZERO,
		Vector2(radius, 0), Vector2(-radius, 0), Vector2(0, radius), Vector2(0, -radius),
	]:
		var cell := tile_of(world_position + offset)
		if not bool(_host.call(&"cell_is_walkable", cell)):
			return false
	return true


func solid_cell_count() -> int:
	return int(_host.call(&"authored_blocked_cells")) if _host != null else 0


## A1 owns its own world time and region ambient; A0 only asks for the projection.
func set_time_of_day(t: float) -> void:
	if _host != null:
		_host.call(&"apply_time_of_day", t)
