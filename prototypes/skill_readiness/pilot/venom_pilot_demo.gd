extends Control

## Isolated, runnable Venomwright 006 / 010 pilot (owner demo, not production).
##
## Plays the native generators through `VenomPilotStage` on the original 60 Hz
## clock. The view is the native scene raster (ground + effects, exactly what
## the GOLD oracle hashes) composed with the native glow raster by a tiny
## additive shader. Every sampled tick is checked live against the recorded
## GOLD raster hash, and the GOLD hit/cue timeline is shown beside it.
##
## Run:  godot --path . res://prototypes/skill_readiness/pilot/venom_pilot_demo.tscn

const STAGE = preload("res://prototypes/skill_readiness/pilot/venom_pilot_stage.gd")

const ORACLE_PATH := "res://docs/vfx/skill_readiness/oracle/venomwright_%03d.json"
## Aftermath shown after the oracle's last tick, so cleanup is visible.
const TAIL_TICKS: int = 360
const SPEEDS: Array = [0.25, 0.5, 1.0, 2.0]
const NAMES: Dictionary = {6: "Graft Caravan", 10: "The Walking Crucible"}

const COMPOSITE_CODE := """shader_type canvas_item;
uniform sampler2D glow_tex : filter_linear;
void fragment() {
	vec4 s = texture(TEXTURE, UV);
	vec4 g = texture(glow_tex, UV);
	COLOR = vec4(clamp(s.rgb + g.rgb, 0.0, 1.0), 1.0);
}
"""

var stage = null
var oracle: Dictionary = {}
var oracle_rows: Dictionary = {}
var playing: bool = false
var speed: float = 1.0
var acc: float = 0.0
var active_sid: int = 6
var match_ok: int = 0
var match_bad: int = 0
var last_match: String = "-"
var first_bad_tick: int = -1

var _skill_pick: OptionButton
var _speed_pick: OptionButton
var _play_btn: Button
var _view: TextureRect
var _mat: ShaderMaterial
var _status: Label
var _timeline: RichTextLabel


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var root := VBoxContainer.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(root)

	var bar := HBoxContainer.new()
	root.add_child(bar)
	var title := Label.new()
	title.text = "Venomwright pilot (GOLD-fidelity, native VFX)"
	bar.add_child(title)

	_skill_pick = OptionButton.new()
	for sid in STAGE.PILOT_SKILLS:
		_skill_pick.add_item("%03d %s" % [sid, NAMES[sid]], sid)
	bar.add_child(_skill_pick)

	var cast_btn := Button.new()
	cast_btn.text = "Cast (restart)"
	cast_btn.pressed.connect(_restart)
	bar.add_child(cast_btn)

	_play_btn = Button.new()
	_play_btn.text = "Pause"
	_play_btn.pressed.connect(_toggle_play)
	bar.add_child(_play_btn)

	var step_btn := Button.new()
	step_btn.text = "Step 1 tick"
	step_btn.pressed.connect(_step_once)
	bar.add_child(step_btn)

	_speed_pick = OptionButton.new()
	for s in SPEEDS:
		_speed_pick.add_item("x%s" % str(s), int(s * 100))
	_speed_pick.select(2)
	_speed_pick.item_selected.connect(_on_speed)
	bar.add_child(_speed_pick)

	var body := HBoxContainer.new()
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(body)

	_view = TextureRect.new()
	_view.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_view.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_view.custom_minimum_size = Vector2(900, 510)
	_view.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_view.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var sh := Shader.new()
	sh.code = COMPOSITE_CODE
	_mat = ShaderMaterial.new()
	_mat.shader = sh
	_view.material = _mat
	body.add_child(_view)

	var side := VBoxContainer.new()
	side.custom_minimum_size = Vector2(340, 0)
	body.add_child(side)
	_status = Label.new()
	_status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	side.add_child(_status)
	_timeline = RichTextLabel.new()
	_timeline.bbcode_enabled = true
	_timeline.size_flags_vertical = Control.SIZE_EXPAND_FILL
	side.add_child(_timeline)

	_restart()


func _on_speed(index: int) -> void:
	speed = float(SPEEDS[index])


func _toggle_play() -> void:
	if stage == null:
		return
	playing = not playing
	_play_btn.text = "Pause" if playing else "Play"


func _step_once() -> void:
	if stage == null:
		return
	playing = false
	_play_btn.text = "Play"
	_advance(1)
	_refresh()


func _restart() -> void:
	active_sid = _skill_pick.get_selected_id()
	stage = STAGE.new()
	if not stage.start(active_sid):
		_status.text = "Skill %d is not a pilot skill." % active_sid
		stage = null
		return
	oracle = _load_oracle(active_sid)
	oracle_rows.clear()
	for row in oracle.get("rows", []):
		oracle_rows[int(row["tick"])] = row
	match_ok = 0
	match_bad = 0
	last_match = "-"
	first_bad_tick = -1
	acc = 0.0
	playing = true
	_play_btn.text = "Pause"
	_refresh()


func _load_oracle(sid: int) -> Dictionary:
	var f := FileAccess.open(ORACLE_PATH % sid, FileAccess.READ)
	if f == null:
		return {}
	var parsed: Variant = JSON.parse_string(f.get_as_text())
	f.close()
	return parsed if parsed is Dictionary else {}


func _end_tick() -> int:
	return int(oracle.get("ticks", 0)) + TAIL_TICKS


func _process(delta: float) -> void:
	if stage == null or not playing:
		return
	acc += delta * speed
	var n: int = int(floor(acc / STAGE.F))
	if n <= 0:
		return
	acc -= float(n) * STAGE.F
	n = mini(mini(n, 12), _end_tick() - stage.tick)
	for _i in range(n):
		_advance(1)
	if stage.tick >= _end_tick():
		playing = false
		_play_btn.text = "Play"
	_refresh()


## One original tick: advance, then check the GOLD raster hash on sampled ticks.
func _advance(count: int) -> void:
	for _i in range(count):
		stage.advance(1)
		var t: int = stage.tick
		if oracle_rows.has(t):
			var want: String = String(oracle_rows[t]["scene_sha256"])
			var got: String = _sha(stage.scene_bytes())
			if got == want:
				match_ok += 1
				last_match = "MATCH t%d" % t
			else:
				match_bad += 1
				last_match = "MISMATCH t%d" % t
				if first_bad_tick < 0:
					first_bad_tick = t


func _sha(b: PackedByteArray) -> String:
	var ctx := HashingContext.new()
	ctx.start(HashingContext.HASH_SHA256)
	ctx.update(b)
	return ctx.finish().hex_encode().substr(0, 32)


func _refresh() -> void:
	if stage == null:
		return
	_view.texture = ImageTexture.create_from_image(stage.scene_image())
	_mat.set_shader_parameter("glow_tex", ImageTexture.create_from_image(stage.glow_image()))
	_refresh_status()
	_refresh_timeline()


func _refresh_status() -> void:
	var c: Dictionary = stage.live_counts()
	var phase: String = "casting"
	var oracle_end: int = int(oracle.get("ticks", 0))
	if stage.tick >= _end_tick():
		phase = "finished (aftermath checked)"
	elif stage.tick > oracle_end:
		phase = "aftermath"
	elif not stage.cast_started:
		phase = "pre-cast"
	var lines: Array = []
	lines.append("%03d %s" % [active_sid, NAMES.get(active_sid, "")])
	lines.append("phase: %s" % phase)
	lines.append("tick %d / %d   t=%.2fs" % [int(c.get("tick", 0)), _end_tick(), float(c.get("time", 0.0))])
	lines.append("live fx %d   parts %d   enemies %d" % [int(c.get("fx", 0)), int(c.get("parts", 0)), int(c.get("enemies", 0))])
	lines.append("")
	lines.append("GOLD raster hash (recorded oracle, %d sampled ticks)" % oracle_rows.size())
	lines.append("  matches %d   mismatches %d" % [match_ok, match_bad])
	lines.append("  last check: %s" % last_match)
	if first_bad_tick >= 0:
		lines.append("  first mismatch tick: %d" % first_bad_tick)
	_status.text = "\n".join(lines)


func _refresh_timeline() -> void:
	var now: float = stage.sim_time()
	var events: Array = []
	for h in oracle.get("hits", []):
		events.append({"t": float(h["t"]), "txt": "hit e%d %s %s" % [int(h["e"]), String(h["kind"]), str(snappedf(float(h["amt"]), 0.1))]})
	for cue in oracle.get("cues", []):
		events.append({"t": float(cue["t"]), "txt": "cue %s" % String(cue["k"])})
	events.sort_custom(func(a, b): return float(a["t"]) < float(b["t"]))
	var out: String = "[b]GOLD timeline (oracle)[/b]\n"
	var shown: int = 0
	for e in events:
		var passed: bool = float(e["t"]) <= now
		var mark: String = "[color=#9f9]" if passed else "[color=#777]"
		if not passed and shown > 14:
			continue
		out += "%s%6.2fs  %s[/color]\n" % [mark, float(e["t"]), String(e["txt"])]
		shown += 1
	_timeline.text = out
