## Same C channel at exact recorded real-world endpoints/source ticks, isolated
## on zero A field with original C palette and k=1. Not full fusion parity.
extends SceneTree
func _initialize() -> void:
    var dir := OS.get_environment("R17_CHANNEL_DIR")
    if dir.is_empty():
        push_error("R17_CHANNEL_FAIL missing R17_CHANNEL_DIR")
        quit(1)
        return
    var written := 0
    for filename in DirAccess.get_files_at(dir):
        if not filename.begins_with("r17_") or not filename.ends_with(".json"): continue
        var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(dir.path_join(filename)))
        if not parsed is Dictionary: continue
        var report: Dictionary = parsed
        var q: Dictionary = report.get("chosen_bolt", {})
        if not q.has("a") or not q.has("b"): continue
        var a := Vector2(float(q.a[0]), float(q.a[1]))
        var b := Vector2(float(q.b[0]), float(q.b[1]))
        var seed := float(q.seed) * 131.0 if int(report.skill) == 11 else float(q.seed)
        var branch_count := int(q.branch_count)
        var frame := AFramebuffer.new()
        CChainChannel.new().draw(frame, a, b, float(q.t), seed, 1.0,
            Vector3(0.92, 0.96, 1.0), Vector3(0.28, 0.4, 1.0), 1.6, 0.32, branch_count)
        var out := FileAccess.open(dir.path_join(filename.trim_suffix(".json") + ".native.rgb32f"), FileAccess.WRITE)
        if out == null:
            push_error("R17_CHANNEL_FAIL cannot write %s" % filename)
            quit(1)
            return
        out.store_buffer(frame.buf.to_byte_array())
        out.close()
        # Replay the actual selected fusion helper, with its own palette,
        # strength, widths and midpoint glow. This is one recorded connector,
        # not an assertion about the rest of the live frame.
        var actual := AFramebuffer.new()
        if int(report.skill) == 9:
            var chain := AChainVerdictGraph.new()
            chain._bolt(actual, a, b, float(q.t), int(q.seed), float(q.width), float(q.k), float(q.rough), int(q.branch_count), float(q.get("glow_k", -1.0)))
        else:
            var rotor := AVoltCarouselFusion.new()
            rotor._bolt(actual, float(q.a[0]), float(q.a[1]), float(q.b[0]), float(q.b[1]), float(q.t), float(q.seed), float(q.width), float(q.k), float(q.rough))
        var current := FileAccess.open(dir.path_join(filename.trim_suffix(".json") + ".current-connector.rgb32f"), FileAccess.WRITE)
        if current == null:
            push_error("R17_CHANNEL_FAIL cannot write current connector")
            quit(1)
            return
        current.store_buffer(actual.buf.to_byte_array())
        current.close()
        written += 1
    if written == 0:
        push_error("R17_CHANNEL_FAIL no real connector snapshots")
        quit(1)
        return
    print("R17_CHANNEL_NATIVE_CAPTURE count=", written)
    quit(0)
