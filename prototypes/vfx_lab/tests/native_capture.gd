extends SceneTree

## Offline 640x360-native evidence capture; VFX-only scene, not campaign.
const LAB: PackedScene = preload("res://prototypes/vfx_lab/native_lab.tscn")
const SAMPLES := [
  {"id": 1, "time": 1.92, "name": "knight_07_rv"},
  {"id": 2, "time": 2.44, "name": "venomwright_16"},
  {"id": 3, "time": 2.97, "name": "sword_01"}
]

func _initialize() -> void:
  call_deferred("_run")

func _run() -> void:
  var scene := LAB.instantiate() as Node2D
  root.add_child(scene)
  current_scene = scene
  var dest := ProjectSettings.globalize_path("res://.artifacts/vfx_lab")
  var error := DirAccess.make_dir_recursive_absolute(dest)
  if error != OK:
    push_error("CAPTURE FAILED: cannot create artifacts directory (%d)" % error)
    quit(1)
    return
  await process_frame
  for item in SAMPLES:
    scene.call("_reset", int(item["id"]))
    scene.call("_seek", float(item["time"]), false)
    await process_frame
    await RenderingServer.frame_post_draw
    var image: Image = root.get_viewport().get_texture().get_image()
    if image == null or image.is_empty():
      push_error("CAPTURE FAILED: empty viewport")
      quit(1)
      return
    var output := dest.path_join("%s.png" % String(item["name"]))
    var saved := image.save_png(output)
    if saved != OK:
      push_error("CAPTURE FAILED: image save error (%d)" % saved)
      quit(1)
      return
    print("VFX_NATIVE_CAPTURE: %s %dx%d" % [output, image.get_width(), image.get_height()])
  print("VFX_NATIVE_CAPTURE: PASS 3/3")
  quit(0)
