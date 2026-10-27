extends SceneTree
const Ground = preload("res://prototypes/gold_fidelity/hairline_ground.gd")
const Floor = preload("res://prototypes/gold_fidelity/hairline_source_floor.gd")
const HASH := "92e4c6668b0383bb21b69e23807f4e4f88300cbdd246c5f5543abc2998499af7"
func _initialize() -> void:
    var buf := Ground.new()
    var builder := Floor.new()
    builder.build(buf)
    var found: String = buf.sha256()
    print("GOLD_SOURCE_FLOOR_SHA: %s" % found)
    if found!=HASH:
        push_error("SOURCE_FLOOR differs from original WebGL/TS gold: %s != %s" % [found,HASH])
        print("GOLD_SOURCE_FLOOR: FAIL")
        quit(1)
        return
    print("GOLD_SOURCE_FLOOR: PASS original RGBA buffer byte-for-byte")
    quit(0)
