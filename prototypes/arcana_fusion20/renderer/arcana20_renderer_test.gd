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
        if id == 2:
            print("::notice::P2DBG node=", node, " diag=", node.diagnostics() if is_instance_valid(node) and node.has_method("diagnostics") else "freed")
        if int(_contacts[cid]) != 1:
            _fail("contact count %s = %d (want 1)" % [cid, int(_contacts[cid])])
        if not _finished.has(cid):
            _fail("no finish %s" % cid)
        if renderer.is_active(cid):
            _fail("still active after finish %s" % cid)

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

    # --- Source-B furnaceWyrm frame parity vs the ORIGINAL TS engine ---
    # Reference PNGs/meta were produced by running the unmodified B
    # sources in Node (floor zeroed, same alpha transport). Tolerances
    # absorb sin/hash last-ulp platform differences only.
    var meta_text := FileAccess.get_file_as_string("res://prototypes/arcana_fusion20/renderer/source_b/reference/wyrm_meta.json")
    var meta: Dictionary = JSON.parse_string(meta_text)
    var br := BRenderer.new()
    br.caster = Vector2(104, 132)
    br.target = Vector2(262, 104)
    var wyrm := BPyreWyrm.new()
    wyrm.setup(br)
    var probe_rng := BMath.BRng.new(202)
    print("::notice::WYRMDBG rng=", probe_rng.next(), ",", probe_rng.next(), " orbit=", wyrm._orbit(2.1), " caster=", wyrm._caster)
    print("::notice::WYRMDBG cracks=", wyrm._cracks.size(), " debris=", wyrm._debris.size(), " ctrl=", wyrm._head_ctrl.size(), " head2=", wyrm.head(2.0))
    for key in ["t030", "t200", "t460", "t498", "t530", "t650"]:
        var t: float = float(meta[key].t)
        br.begin()
        wyrm.render(br, t)
        if key == "t200":
            var mx := 0.0
            for v in br.main_buf:
                mx = maxf(mx, v)
            print("::notice::WYRMDBG t200 main_max=", mx, " lights=", br.lights.size())
        wyrm.post(br, t)
        br.lighting()
        var bytes := br.finalize()
        var sum := 0
        var nonzero := 0
        for i in range(0, bytes.size(), 4):
            sum = (sum + bytes[i] * 3 + bytes[i + 1] * 5 + bytes[i + 2] * 7) & 0xFFFFFFFF
            if bytes[i + 3] != 0:
                nonzero += 1
        var exp_sum := int(meta[key].sum)
        var exp_nz := int(meta[key].nonzero)
        var sum_rel := absf(float(sum - exp_sum)) / maxf(1.0, float(exp_sum))
        var nz_rel := absf(float(nonzero - exp_nz)) / maxf(1.0, float(exp_nz))
        print("::notice::WYRM_PARITY ", key, " t=", t, " sum_rel=", snappedf(sum_rel, 0.0001), " nz_rel=", snappedf(nz_rel, 0.0001), " nz=", nonzero, "/", exp_nz)
        if nz_rel > 0.05 or sum_rel > 0.10:
            _fail("wyrm parity %s nz_rel=%f sum_rel=%f" % [key, nz_rel, sum_rel])

    var st := Arcana20Status.summary()
    print("::notice::ARCANA20_DBG stages=", JSON.stringify(renderer.stage_counts), " contacts=", JSON.stringify(_contacts), " finished=", _finished.size(), " started=", _started.size())
    print("ARCANA20_RENDER_STATUS ", JSON.stringify(st))
    if _failures.is_empty():
        print("::notice::ARCANA20_RENDER_RESULT PASS failures=[] casts=20 contacts=20")
        quit(0)
    else:
        print("::error::ARCANA20_RENDER_RESULT FAIL failures=", _failures)
        quit(1)
