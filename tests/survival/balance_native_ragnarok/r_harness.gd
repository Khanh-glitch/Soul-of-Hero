extends "res://tests/survival/balance_native_decisions/d_harness.gd"
## A7 harness for the 14-day / Ragnarok / two-economy system (D055-D067).
##
## Same verdict protocol as the D family (0 PASS, 1 FAIL, 2 BLOCKED, 3 RED), and
## the same one-door rule for mounting a real world. What is added here is what a
## *system* acceptance needs rather than a feature census:
##
## * **forward compatibility.** Every clause is written as `if the API exists,
##   assert it; else record the exact missing symbol`. A probe therefore turns from
##   RED to a real gate the day an owner lands the API, with no rewrite, and that
##   transition is visible in the ledger because the missing list empties.
## * **contract arithmetic.** 336 h and the 72 h finale are user-locked, so their
##   boundaries (264 h / 11 d, 336 h / 14 d) are computed from the decisions, not
##   tuned. Numeric pressure lives in a versioned tuning file the probe only reads.
## * **a real second OS process.** Persistence claims are checked by spawning the
##   engine again, never by re-reading the same process's memory.

const RUN_SECONDS := 336 * 3600
const RAGNAROK_SECONDS := 72 * 3600
const CALM_SECONDS := RUN_SECONDS - RAGNAROK_SECONDS
const DISCORD_SECONDS := 24 * 3600
const PLANNER := "res://game/survival/economy/offline_operation_planner.gd"
const A3_SERVICE := "res://game/survival/economy/economy_service.gd"
const A0_VENDORED := "res://game/survival/economy/vendor/a3_economy_service.gd"
const POLICY_JSON := "res://data/survival/recipes/offline_operations.v1.json"
const SAVE_SERVICE := "res://game/autoload/save_service.gd"
## A7-owned test configuration. It is never read by the game; every value in it
## carries the class of its provenance so a probe can print "locked" or "tunable"
## next to the number it used.
const TUNING_JSON := "res://data/survival/balance/ragnarok_tuning.v1.json"


## Set by `_done()` at the end of a probe body. A GDScript runtime error inside
## `_body()` does not stop `_console`, so without this flag a probe that crashed on
## its fourth line would print PASS with three checks. `_finish()` below turns that
## silence into a blocker instead.
var completed := false


func _done() -> void:
	completed = true


func _finish() -> void:
	if not completed and blocked.is_empty():
		blocked = "the probe body did not run to completion (a script error aborted it before the last check)"
	super._finish()


func _json(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var text := FileAccess.get_file_as_string(path)
	var value: Variant = JSON.parse_string(text)
	return value if value is Dictionary else {}


## Method names declared by a script resource, without instancing it.
func _script_methods(path: String) -> Array:
	var found: Array = []
	var script: Script = load(path) as Script
	if script == null:
		return found
	for entry: Dictionary in script.get_script_method_list():
		found.append(String(entry.get("name", "")))
	return found


func _has_methods(path: String, names: Array) -> Dictionary:
	var declared := _script_methods(path)
	var present: Array = []
	var absent: Array = []
	for name: String in names:
		if declared.has(name):
			present.append(name)
		else:
			absent.append(name)
	return {"present": present, "absent": absent}


## Call a `static func` on a loaded GDScript. Static functions are not reachable
## through an instance, so probes that want to exercise a pure validator call it
## here instead of inventing an instance that does not exist in production.
func _static_call(script: Script, name: StringName, args: Array = []) -> Variant:
	var callable := Callable(script, name)
	if not callable.is_valid():
		return null
	return callable.callv(args)


## Seconds elapsed since the run started, from the run's own numbers. Returns -1
## when the composition has no run record at all, which is a fact worth stating
## rather than a number worth inventing.
func _elapsed_seconds(started_unix: int, now_unix: int) -> int:
	if started_unix <= 0 or now_unix < started_unix:
		return -1
	return now_unix - started_unix


## The phase the *decisions* say elapsed seconds belong to. Derived arithmetic:
## 336 h maximum, the last 72 h are Ragnarok, and the final 24 h are the island
## catastrophe. This function never decides whether the product agrees; it only
## gives the probe something to compare against.
func _expected_phase(elapsed: int) -> String:
	if elapsed < 0 or elapsed >= RUN_SECONDS:
		return "EXPIRED"
	if elapsed >= RUN_SECONDS - DISCORD_SECONDS:
		return "CATASTROME"
	if elapsed >= CALM_SECONDS:
		return "ROAMING"
	return "CALM"


## Spawn the engine again and return its output. Used for persistence claims: a
## value that survives only inside this process has not been saved.
func _run_second_process(extra: Array) -> Dictionary:
	var exe := OS.get_executable_path()
	# Reconstruct the invocation rather than guessing it: `--script` plus the file
	# this process was started with, then our own arguments.
	var script := ""
	for arg: String in OS.get_cmdline_args():
		if arg.begins_with("res://") or arg.ends_with(".gd"):
			script = arg
	if script.is_empty():
		return {"ok": false, "code": -1, "output": "", "reason": "cannot identify this probe's own script path"}
	var command: Array = ["--headless", "--path", ".", "--script", script]
	# Arguments must follow `--` or the engine parses them as its own flags and
	# `OS.get_cmdline_user_args()` in the child sees nothing.
	if not extra.is_empty():
		command.append("--")
		for arg: String in extra:
			command.append(arg)
	var output: Array = []
	var code := OS.execute(exe, command, output, true)
	return {"ok": code == 0, "code": code, "output": "\n".join(output)}


# ---------------------------------------------------------------- economy facts
## The run's declared namespaces, read from the product's own save snapshot.
func _namespace_keys() -> Array:
	var keys: Array = _snapshot().keys()
	keys.sort()
	return keys


## The three persistent categories D056/D063 permit. Everything else is run-local.
func _persistent_profile_categories() -> Array:
	var allowed: Array = ["achievements", "run_history", "secured_ragnarok_currency"]
	var top := _namespace_keys()
	var found: Array = []
	for key: String in allowed:
		if top.has(key):
			found.append(key)
	return found
