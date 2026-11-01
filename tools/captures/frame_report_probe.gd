extends SceneTree
## Print the frame report for PNGs on disk, with no display server.
##
##   godot --headless --path . --script res://tools/captures/frame_report_probe.gd -- \
##     res://docs/overworld/evidence/overworld_crucible.png
##
## The capture calls the same FrameReport on the live frame; this entry point
## exists so the report code can be checked (and any stored PNG inspected)
## headlessly, in an environment that cannot open a window.

const FrameReport := preload("res://tools/captures/frame_report.gd")


func _initialize() -> void:
	var paths: Array[String] = []
	for argument in OS.get_cmdline_user_args():
		if argument.ends_with(".png"):
			paths.append(argument)
	if paths.is_empty():
		printerr("usage: --script res://tools/captures/frame_report_probe.gd -- <png>...")
		quit(2)
		return
	var failed := 0
	for path in paths:
		var image := Image.new()
		var result := image.load(ProjectSettings.globalize_path(path))
		if result != OK:
			printerr("FRAME REPORT: cannot load %s (%d)" % [path, result])
			failed += 1
			continue
		FrameReport.report(image, path.get_file().get_basename())
	quit(1 if failed > 0 else 0)
