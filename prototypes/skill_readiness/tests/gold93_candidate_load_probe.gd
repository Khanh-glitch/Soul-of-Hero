extends SceneTree

## Isolated Godot script-load probe. Unregistered candidate must not break registry.
## This establishes loadability only, NOT source parity or production readiness.

func _init() -> void:
	var candidate := ""
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--candidate="):
			candidate = arg.substr(12)
	if candidate != "venom_s3" and candidate != "venom_s4":
		print("GOLD93_CANDIDATE_LOAD: FAIL / unsupported candidate")
		quit(2)
		return
	var path := "res://prototypes/skill_readiness/native/venom/" + candidate + ".gd"
	var script = ResourceLoader.load(path)
	if script is GDScript and (script as GDScript).can_instantiate():
		print("GOLD93_CANDIDATE_LOAD: PASS / " + candidate)
		quit(0)
	else:
		print("GOLD93_CANDIDATE_LOAD: FAIL / " + candidate)
		quit(1)
