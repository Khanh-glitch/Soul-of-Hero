extends SceneTree
## Native screenshot capture: run under xvfb-run with opengl3 x11.
## Boots the overworld, waits for build, teleports camera to refuge and
## to the L01 (crypt) entrance, saves one PNG per waypoint into
## res://artifacts/. Runs in --script mode (extends SceneTree) which
## avoids the windowed-scene GL init hang.

const OW_SCENE := preload("res://game/overworld/chapter1_overworld.tscn")
const OUT_DIR := "res://artifacts"
const TILE := 16

func _initialize() -> void:
	call_deferred("_run")

func _ready_ow(ow: Node) -> Node2D:
	for i in range(300):
		await process_frame
		var e := ow.get_node_or_null("Entities")
		var lm := ow.get_node_or_null("Landmarks")
		if e == null or lm == null: continue
		for c in e.get_children():
			if c is CharacterBody2D:
				for _j in range(5): await process_frame
				return c as Node2D
	return null

func _shoot(vp: Window, path: String, pos: Vector2, player: Node2D) -> bool:
	player.global_position = pos
	var cam: Camera2D = player.get_node_or_null("Camera") as Camera2D
	if cam == null: return false
	cam.current = true; cam.make_current(); cam.reset_smoothing()
	for _i in range(30): await process_frame
	await RenderingServer.frame_post_draw
	var img := vp.get_texture().get_image()
	if img == null or img.get_width() < 2: return false
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT_DIR))
	return img.save_png(OUT_DIR + "/" + path) == OK

func _run() -> void:
	var vp := get_root()
	vp.size = Vector2i(640, 480)
	vp.set_update_mode(Viewport.UPDATE_ALWAYS)
	var ow := OW_SCENE.instantiate()
	var host := Node2D.new(); vp.add_child(host); host.add_child(ow)
	var player := _ready_ow(ow)
	if player == null:
		push_error("capture: player never spawned"); quit(1); return
	var refuge := ow.get("world_data").get("refuge", {})
	var rp: Array = refuge.get("pos", [56, 216])
	var refuge_pos := Vector2(float(rp[0]) * TILE + 8.0, float(rp[1]) * TILE + 8.0)
	# Find L01 (lm_crypt) gate position.
	var l01_pos := Vector2.ZERO
	var landmarks := ow.get_node_or_null("Landmarks")
	if landmarks != null:
		for g in landmarks.get_children():
			if String(g.name) == "Gate_lm_crypt":
				l01_pos = g.global_position; break
	var written := 0
	if _shoot(vp, "overworld_refuge.png", refuge_pos, player): written += 1
	if l01_pos != Vector2.ZERO and _shoot(vp, "overworld_l01.png", l01_pos, player): written += 1
	print("capture: wrote %d PNGs" % written)
	if written < 1: push_error("capture: no PNGs written"); quit(1); return
	quit(0)
