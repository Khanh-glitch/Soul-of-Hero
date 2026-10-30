extends SceneTree
## A7 adversarial contract harness for D055–D061.
##
## ## Why a separate harness from A0's journey tests
##
## A0's chain answers "can a player do X". These probes answer a different
## question: "does the product implement the rule at all, and does it detect the
## corruption that would break it". They therefore boot the *production*
## autoloads (`SaveService`, `SurvivalService`, the real overworld scene) and then
## call the product's own public API, without any journey, fixture grant,
## teleport or mocked clock. When a rule is not implemented they must say so
## instead of passing: the user's requirement is explicit — a probe against a
## missing feature is RED/NOT_IMPLEMENTED, never PASS.
##
## ## Verdict protocol (also enforced by tools/survival/balance/run_native.py)
##
##   exit 0  PASS                the rule is implemented and the assertions held
##   exit 1  FAIL                it is implemented and violated (a real defect)
##   exit 2  BLOCKED             cannot be measured here (no scene, no engine)
##   exit 3  RED_NOT_IMPLEMENTED the rule does not exist in this composition
##
## `BLOCKED` and `RED` are never allowed to be counted as a pass by the runner,
## and every RED line names the missing symbol and the owner action, so the
## report can be turned into work rather than into a status word.

## The only scene a D probe may ever mount. It is the shipped overworld, loaded
## by path — never a bespoke host, a fixture or a stand-in. Probes cannot load
## scenes themselves: `_mount_world()` is the single audited door, so the gate can
## prove a probe observed the production world instead of staging one.
const WORLD_SCENE := "res://game/overworld/chapter1_overworld.tscn"
const WORLD_READY_TIMEOUT_MS := 90_000

const EXIT_PASS := 0
const EXIT_FAIL := 1
const EXIT_BLOCKED := 2
const EXIT_RED := 3

var failures: Array[String] = []
var missing: Array[String] = []
var notes: Array[String] = []
var checks := 0
var blocked := ""
var save_path := ""
var probe_id := "D000"
## Set only by `_mount_world()`. The base `_finish()` frees it synchronously, so a
## probe never has to override `_finish()` (an awaited free could let the verdict
## print and quit while the override was still suspended).
var mounted_world: Node = null
var probe_title := ""
var owner_action := ""


func _initialize() -> void:
	_console.call_deferred()


func _console() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("user://tests"))
	save_path = "user://tests/a7_%s_%d.json" % [probe_id.to_lower(), Time.get_ticks_usec()]
	var save := _save()
	if save == null:
		blocked = "SaveService autoload is not present in this composition"
	else:
		var configured := bool(save.call(&"configure_storage", save_path, true))
		if not configured:
			blocked = "SaveService refused an isolated storage path"
		else:
			await _body()
	if blocked.is_empty() and not is_instance_valid(self):
		return
	_finish()


func _finish() -> void:
	if is_instance_valid(mounted_world):
		mounted_world.free()
	mounted_world = null
	if FileAccess.file_exists(save_path):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	for line: String in notes:
		print("A7 %s NOTE %s" % [probe_id, line])
	for line: String in missing:
		print("A7 %s MISSING %s" % [probe_id, line])
	var verdict := "PASS"
	var code := EXIT_PASS
	if not missing.is_empty():
		verdict = "RED_NOT_IMPLEMENTED"
		code = EXIT_RED
	elif not blocked.is_empty():
		verdict = "BLOCKED"
		code = EXIT_BLOCKED
	elif not failures.is_empty():
		verdict = "FAIL"
		code = EXIT_FAIL
	if not blocked.is_empty():
		print("A7 %s BLOCKED %s" % [probe_id, blocked])
	if code == EXIT_RED and not owner_action.is_empty():
		print("A7 %s OWNER_ACTION %s" % [probe_id, owner_action])
	print(
		"A7 %s %s - %s: %d checks, %d failed, %d missing"
		% [probe_id, verdict, probe_title, checks, failures.size(), missing.size()]
	)
	quit(code)


# ------------------------------------------------------------------ assertions
func _expect(ok: bool, label: String) -> bool:
	checks += 1
	if not ok:
		failures.append(label)
		print("A7 %s FAIL %s" % [probe_id, label])
	return ok


## Record a contract clause the composition does not implement, with the exact
## symbol that is absent. Never silently downgraded to a pass.
func _missing(symbol: String, where: String = "") -> void:
	var row := symbol if where.is_empty() else "%s (expected in %s)" % [symbol, where]
	if not missing.has(row):
		missing.append(row)


func _note(text: String) -> void:
	notes.append(text)


func _block(reason: String) -> void:
	blocked = reason


# ---------------------------------------------------------------- production scene
## Mount the shipped overworld exactly once per probe. Returns null and sets the
## blocked reason when the composition cannot present the real world.
func _mount_world() -> Node:
	if not ResourceLoader.exists(WORLD_SCENE):
		_block("the production overworld scene %s is not in this composition" % WORLD_SCENE)
		return null
	var scene := load(WORLD_SCENE) as PackedScene
	if scene == null:
		_block("the production overworld scene %s failed to load" % WORLD_SCENE)
		return null
	var world := scene.instantiate()
	if world == null:
		_block("the production overworld scene %s did not instantiate" % WORLD_SCENE)
		return null
	root.add_child(world)
	mounted_world = world
	var deadline := Time.get_ticks_msec() + WORLD_READY_TIMEOUT_MS
	while Time.get_ticks_msec() < deadline:
		if world.has_method(&"is_world_ready") and bool(world.call(&"is_world_ready")):
			return world
		await process_frame
	_block("the production overworld did not become ready in %d ms" % WORLD_READY_TIMEOUT_MS)
	world.free()
	mounted_world = null
	return null


# --------------------------------------------------------------------- product
func _save() -> Node:
	return root.get_node_or_null("SaveService")


func _survival() -> Node:
	return root.get_node_or_null("SurvivalService")


func _snapshot() -> Dictionary:
	var save := _save()
	if save == null or not save.has_method(&"get_snapshot"):
		return {}
	return save.call(&"get_snapshot") as Dictionary


func _survival_document() -> Dictionary:
	var survival := _survival()
	if survival == null or not survival.has_method(&"document"):
		return {}
	return survival.call(&"document") as Dictionary


## True when `file` declares `needle` in source. Used only to decide whether a
## rule exists at all; a present symbol never turns an assertion green by itself.
func _source_has(path: String, needle: String) -> bool:
	if not FileAccess.file_exists(path):
		return false
	var text := FileAccess.get_file_as_string(path)
	return text.contains(needle)


func _any_source_has(paths: Array, needle: String) -> bool:
	for path: String in paths:
		if _source_has(path, needle):
			return true
	return false


## Depth-first collection of nodes by class name, so a probe can measure what the
## product actually mounted instead of what a manifest claims.
func _find_all(node: Node, class_needle: String) -> Array:
	var found: Array = []
	if node == null:
		return found
	if String(node.get_class()).contains(class_needle) or node.name.to_lower().contains(class_needle.to_lower()):
		found.append(node)
	for child: Node in node.get_children():
		found.append_array(_find_all(child, class_needle))
	return found
