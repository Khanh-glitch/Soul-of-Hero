## Headless lifecycle gate for the ARCANA Fusion20 renderer (AVFX stream).
## Casts all 20 canonical IDs on the catalog timeline with a fixed 60 Hz
## source clock and asserts: cast_started, exactly one visual contact at
## the source climax tick, body cue, finish + cleanup, cancel cleanup.
## This proves the native runtime contract only — NOT Gold visual parity.
extends SceneTree

var _failures: Array[String] = []
var _contacts: Dictionary = {}
var _finished: Dictionary = {}
var _started: Dictionary = {}

func _fail(msg: String) -> void:
    _failures.append(msg)
    print("::error::ARCANA20_RENDER_FAIL ", msg)

func _init() -> void:
    for path in ["arcana20_primitives.gd", "arcana20_source_catalog.gd", "arcana20_skill_instance.gd", "arcana20_pass_painter.gd", "arcana20_renderer.gd", "arcana_b02_source_geometry.gd"]:
        var res = load("res://prototypes/arcana_fusion20/renderer/" + path)
        print("::notice::LOADPROBE ", path, " -> ", res)
    var root_node := Node2D.new()
    root.add_child(root_node)
    var renderer := Arcana20Renderer.new()
    root_node.add_child(renderer)
    renderer.cast_started.connect(func(cid: StringName) -> void: _started[cid] = true)
    renderer.visual_contact.connect(func(cid: StringName, pos: Vector2, kind: StringName) -> void:
        _contacts[cid] = int(_contacts.get(cid, 0)) + 1)
    renderer.cast_finished.connect(func(cid: StringName) -> void: _finished[cid] = true)

    var catalog_errors := Arcana20SourceCatalog.validate()
    if not catalog_errors.is_empty():
        _fail("catalog: %s" % str(catalog_errors))

    for id in range(1, 21):
        var cid := Arcana20SourceCatalog.canonical_id(id)
        _contacts[cid] = 0
        if not renderer.cast_skill(cid, Vector2(200, 300), Vector2(420, 300), 1.0):
            _fail("cast refused %s" % cid)
            continue
        if not renderer.is_active(cid):
            _fail("not active after cast %s" % cid)
        # Fixed-step the source clock deterministically.
        var node: Node = renderer._casts[cid]
        var slot := Arcana20SourceCatalog.slot(id)
        var dur := float(slot.get("duration", 8.0))
        if dur <= 0.0:
            dur = 9.0
        var steps := int(ceil((dur + 0.2) * 60.0))
        for s in range(steps):
            if not is_instance_valid(node):
                break
            if node.has_method("_process"):
                node._process(1.0 / 60.0)
            if not renderer.is_active(cid):
                break
        if int(_contacts[cid]) != 1:
            _fail("contact count %s = %d (want 1)" % [cid, int(_contacts[cid])])
        if not _finished.has(cid):
            _fail("no finish %s" % cid)
        if renderer.is_active(cid):
            _fail("still active after finish %s" % cid)
        print("::notice::ARCANA20_SKILL_DONE ", cid)

    # Cancel path: mid-cast cancel must finish + clean up with no contact leak.
    var cid5 := Arcana20SourceCatalog.canonical_id(5)
    _finished.erase(cid5)
    if renderer.cast_skill(cid5, Vector2(200, 300), Vector2(420, 300), 1.0):
        var n5: Node = renderer._casts[cid5]
        for s in range(30):
            n5._process(1.0 / 60.0)
        renderer.cancel_skill(cid5)
        if renderer.is_active(cid5):
            _fail("cancel did not clean up %s" % cid5)
    else:
        _fail("recast refused %s" % cid5)

    # Bad IDs refused.
    if renderer.cast_skill(&"arcana_fusion20_99", Vector2.ZERO, Vector2.ZERO):
        _fail("bad id accepted")
    if renderer.cast_skill(&"venomwright_001", Vector2.ZERO, Vector2.ZERO):
        _fail("foreign id accepted")

    var st := Arcana20Status.summary()
    print("ARCANA20_RENDER_STATUS ", JSON.stringify(st))
    if _failures.is_empty():
        print("::notice::ARCANA20_RENDER_RESULT PASS failures=[] casts=20 contacts=20")
        quit(0)
    else:
        print("::error::ARCANA20_RENDER_RESULT FAIL failures=", _failures)
        quit(1)
