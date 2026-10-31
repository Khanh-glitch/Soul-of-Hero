class_name A0AuthoredWorldMount
extends Node2D
## A0's production mount for A1's authored continent (Round 12, A1 PR20 `8551a323`).
##
## Division of authority, stated once:
##   * A1 owns the authored world: the 1024x768 plan, the 192 source chunks, the
##     production reader (`game/survival/world/a1_authored_world_reader.gd`) and the
##     bounded streamer (`game/survival/world/a1_authored_world_stream.gd`). A0 does
##     not fork, re-time or re-plan either of them.
##   * A0 owns the player, collision authority, construction, SaveService and every
##     gameplay consequence. The legacy inset that A0 already ships stays the world
##     A0 governs; the authored stream is mounted *beside* it, never instead of it,
##     and A0 never widens its own bounds to make empty terrain look playable.
##
## Fail-closed: every refusal names the missing owner artifact, so "the continent is
## empty" can never be the accepted explanation for "the source is not here".

const STREAM_PATH := "res://game/survival/world/a1_authored_world_stream.gd"
const READER_PATH := "res://game/survival/world/a1_authored_world_reader.gd"
const WORLD_ROOT := "res://data/survival/world"

var stream: Node2D
var last_error := ""
var configured := false
var chunks_loaded := 0
var max_chunks := 0
var region := ""
var stream_events: Array = []
var render_legacy := true


## Mount A1's reader + bounded stream. Returns false with [member last_error] set.
func mount() -> bool:
	configured = false
	last_error = ""
	if not FileAccess.file_exists(READER_PATH):
		last_error = "A1_AUTHORED_READER_ABSENT: " + READER_PATH
		return false
	if not FileAccess.file_exists(STREAM_PATH):
		last_error = "A1_AUTHORED_STREAM_ABSENT: " + STREAM_PATH
		return false
	var reader_script: Variant = load(READER_PATH)
	if reader_script == null or not (reader_script is Script):
		last_error = "A1_AUTHORED_READER_UNLOADABLE"
		return false
	var stream_script: Variant = load(STREAM_PATH)
	if stream_script == null or not (stream_script is Script):
		last_error = "A1_AUTHORED_STREAM_UNLOADABLE"
		return false
	var reader: Variant = (reader_script as Script).new()
	if reader == null or not bool(reader.call(&"configure", WORLD_ROOT)):
		last_error = "A1_AUTHORED_SOURCE_" + String(reader.get(&"last_error")).to_upper() if reader != null else "A1_AUTHORED_READER_UNLOADABLE"
		return false
	stream = (stream_script as Script).new() as Node2D
	if stream == null:
		last_error = "A1_AUTHORED_STREAM_UNLOADABLE"
		return false
	stream.name = "A1AuthoredStream"
	add_child(stream)
	if not bool(stream.call(&"configure", WORLD_ROOT, reader, render_legacy)):
		last_error = "A1_AUTHORED_STREAM_" + String(stream.get(&"last_error")).to_upper()
		return false
	max_chunks = int(stream.get(&"max_loaded_chunks"))
	configured = true
	return true


## Keep the stream around the player, with A0's own view rectangle. The streamer
## decides which chunks exist; A0 only says where the player is looking.
func advance(hero: Node2D, view_rect: Rect2) -> Dictionary:
	if not configured or stream == null or hero == null:
		return {"ok": false, "error": last_error if not configured else "no_hero"}
	var report: Dictionary = stream.call(&"update_stream", hero.global_position, view_rect)
	chunks_loaded = (stream.get(&"loaded_chunks") as Dictionary).size() if stream.get(&"loaded_chunks") != null else 0
	region = String(stream.get(&"current_region"))
	stream_events = stream.get(&"stream_events") as Array
	return report


## What a caller may safely assert about the mount right now.
func status() -> Dictionary:
	return {
		"configured": configured,
		"last_error": last_error,
		"chunks_loaded": chunks_loaded,
		"max_chunks": max_chunks,
		"region": region,
		"events": stream_events.size(),
	}
