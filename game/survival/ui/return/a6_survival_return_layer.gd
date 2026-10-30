class_name A6SurvivalReturnLayer
extends CanvasLayer

## Mountable overlay that turns owner projections into the four A6 cards.
##
## Mounting it is a single `add_child()`; it reads nothing but `A6OwnerProjectionSource`
## and it writes nothing anywhere. A0 can keep its own HUD, pause menu and save
## loop untouched — this layer never pauses the tree, never grabs focus on its own
## and never covers the middle of the screen.
##
## Order of operations matters for the player: the return digest is shown while
## they are standing at the title/home, and the season chip is quiet until the
## digest is dismissed, so a returnee reads one thing at a time.
##
## Test seam: `configure(tree, overrides)` injects projection dictionaries or
## callables and a clock, which is how the headless gate drives 2 h / 18 h / 48 h
## returns and the "owner has no data" case without a save file.

signal digest_dismissed(digest_id: String)
signal record_opened

const RUN_CARD_SCENE: PackedScene = preload("res://game/survival/ui/return/a6_run_card.tscn")
const GUIDANCE_SCENE: PackedScene = preload("res://game/survival/ui/return/a6_guidance_panel.tscn")
const DIGEST_SCENE: PackedScene = preload("res://game/survival/ui/return/a6_return_digest.tscn")
const RECORD_SCENE: PackedScene = preload("res://game/survival/ui/return/a6_season_record_panel.tscn")
const CUE_SCENE: PackedScene = preload("res://game/survival/ui/return/a6_site_cue_chip.tscn")

const EDGE := 16.0
const CARD_TOP := 96.0

@onready var root: Control = %Root
@onready var run_card: A6RunCard = %RunCard
@onready var guidance_panel: A6GuidancePanel = %GuidancePanel
@onready var return_digest: A6ReturnDigest = %ReturnDigest
@onready var record_panel: A6SeasonRecordPanel = %SeasonRecord
@onready var site_cue_chip: A6SiteCueChip = %SiteCueChip

var _source := A6OwnerProjectionSource.new()
var _now_provider: Callable = Callable()
var _guidance_dismissed := false
var _seen_digests: Dictionary = {}
var _active_digest_id := ""
var _tick := 0.0
var _configured := false
var _last_clock: Dictionary = {}
var _last_cues: Dictionary = {}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	if not _configured:
		configure(get_tree())
	guidance_panel.dismissed.connect(_on_guidance_dismissed)
	return_digest.dismissed.connect(_on_digest_dismissed)
	return_digest.history_requested.connect(open_record)
	record_panel.closed.connect(_on_record_closed)
	run_card.activated.connect(open_record)
	get_viewport().size_changed.connect(_place_cards)
	refresh()


func configure(tree: SceneTree, overrides: Dictionary = {}, now_provider: Callable = Callable()) -> void:
	_configured = true
	_now_provider = now_provider
	_source.configure(tree, overrides)
	if is_node_ready():
		refresh()


## Pulls every projection and re-renders. Safe to call on every return to home,
## on every save load, and from the A0 mount point after a settlement.
func refresh() -> void:
	var now := now_seconds()
	var clock := _source.season_clock()
	_last_clock = clock
	run_card.present(clock, now)
	var inputs := _source.guidance_inputs()
	guidance_panel.present(A6GuidanceModel.build(inputs, clock), _guidance_dismissed)
	_last_cues = _source.site_cues()
	site_cue_chip.present(_last_cues, now)
	var digest := _source.return_digest()
	if bool(digest.get("available", false)):
		var digest_id := String(digest.get("digest_id", ""))
		var acknowledged := _is_digest_acknowledged(digest_id)
		if not _seen_digests.has(digest_id) and not acknowledged:
			_active_digest_id = digest_id
			return_digest.present(digest)
		else:
			return_digest.clear()
	else:
		_active_digest_id = ""
		return_digest.clear()
	if record_panel.visible:
		record_panel.present(_source.run_history(), clock, now)
	_place_cards()


## Owner-side memory of an already-shown digest. A6 only reads it, which is how a
## "Continue" survives a process restart without A6 owning a second save file.
func _is_digest_acknowledged(digest_id: String) -> bool:
	if digest_id.is_empty():
		return false
	var ack := _source.digest_ack()
	var list: Variant = ack.get("acknowledged", [])
	return list is Array and (list as Array).has(digest_id)


func now_seconds() -> int:
	if _now_provider.is_valid():
		var value: Variant = _now_provider.call()
		if value is int or value is float:
			return int(value)
	return int(Time.get_unix_time_from_system())


# --- player actions ---------------------------------------------------------


func open_record() -> void:
	var now := now_seconds()
	record_panel.open(_source.run_history(), _source.season_clock(), now)
	_place_cards()
	record_opened.emit()


func close_record() -> void:
	record_panel.close()


func dismiss_digest() -> void:
	return_digest.dismiss()


func dismiss_guidance() -> void:
	_on_guidance_dismissed()



func _on_guidance_dismissed() -> void:
	_guidance_dismissed = true
	guidance_panel.clear()


## Returning focus to the season chip keeps a controller player from being
## dropped into an invisible focus ring after closing the record.
func _on_record_closed() -> void:
	if run_card.visible:
		run_card.grab_focus()


func _on_digest_dismissed() -> void:
	if _active_digest_id.is_empty():
		return
	var dismissed_id := _active_digest_id
	_seen_digests[dismissed_id] = true
	_active_digest_id = ""
	return_digest.clear()
	digest_dismissed.emit(dismissed_id)


# --- layout -----------------------------------------------------------------


func _process(delta: float) -> void:
	# Re-evaluate the cached projections once a second so a countdown really ticks
	# and a D061 cue really expires. No owner method is called from here.
	if not run_card.visible and not site_cue_chip.visible:
		return
	_tick += delta
	if _tick < 1.0:
		return
	_tick = 0.0
	var now := now_seconds()
	if run_card.visible and not _last_clock.is_empty():
		run_card.present(_last_clock, now)
	if site_cue_chip.visible and not _last_cues.is_empty():
		site_cue_chip.present(_last_cues, now)


func _place_cards() -> void:
	if not is_node_ready():
		return
	var view := root.size
	if view.x <= 0.0 or view.y <= 0.0:
		view = get_viewport().get_visible_rect().size
	var items: Array = []
	_collect_layout_item(items, "run_card", run_card)
	_collect_layout_item(items, "guidance", guidance_panel)
	_collect_layout_item(items, "digest", return_digest)
	_collect_layout_item(items, "site_cue", site_cue_chip)
	_collect_layout_item(items, "record", record_panel)
	var rects := layout_rects(view, items)
	for id: String in rects.keys():
		var control := _control_for(id)
		if control == null:
			continue
		var rect: Rect2 = rects[id]
		control.set_anchors_preset(Control.PRESET_TOP_LEFT, false)
		control.position = rect.position
		control.size = rect.size


## Pure placement, so the 720p / 1440p / 2160p checks can assert geometry without
## a renderer. Unknown ids are ignored rather than placed at the origin.
static func layout_rects(view: Vector2, items: Array) -> Dictionary:
	var rects := {}
	for item_value: Variant in items:
		if not item_value is Dictionary:
			continue
		var item: Dictionary = item_value
		var id := String(item.get("id", ""))
		var size_value: Variant = item.get("size", Vector2.ZERO)
		if not size_value is Vector2:
			continue
		var item_size: Vector2 = size_value
		var at := Vector2.ZERO
		match id:
			"run_card":
				at = Vector2(EDGE, CARD_TOP)
			"guidance":
				at = Vector2(EDGE, view.y - item_size.y - EDGE)
			"digest":
				at = Vector2(view.x - item_size.x - EDGE, CARD_TOP)
			"site_cue":
				at = Vector2(view.x - item_size.x - EDGE, view.y - item_size.y - EDGE)
			"record":
				at = Vector2((view.x - item_size.x) * 0.5, maxf(24.0, (view.y - item_size.y) * 0.5))
			_:
				continue
		var max_x := maxf(EDGE, view.x - item_size.x - EDGE)
		var max_y := maxf(EDGE, view.y - item_size.y - EDGE)
		at = Vector2(clampf(at.x, EDGE, max_x), clampf(at.y, EDGE, max_y))
		rects[id] = Rect2(at.round(), item_size)
	return rects


func _collect_layout_item(items: Array, id: String, control: Control) -> void:
	if control == null or not control.visible:
		return
	var size := control.get_combined_minimum_size()
	size.x = maxf(size.x, control.custom_minimum_size.x)
	size.y = maxf(size.y, control.custom_minimum_size.y)
	items.append({"id": id, "size": size})


func _control_for(id: String) -> Control:
	match id:
		"run_card":
			return run_card
		"guidance":
			return guidance_panel
		"digest":
			return return_digest
		"site_cue":
			return site_cue_chip
		"record":
			return record_panel
	return null
