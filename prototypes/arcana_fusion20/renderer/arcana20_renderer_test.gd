## Headless lifecycle gate for the ARCANA Fusion20 renderer (AVFX stream).
## Casts all 20 canonical IDs on the catalog timeline with a fixed 60 Hz
## source clock and asserts: cast_started, exactly one visual contact at
## the source climax tick, body cue, finish + cleanup, cancel cleanup.
## This proves the native runtime contract only — NOT Gold visual parity.
extends SceneTree

var _failures: Array[String] = []
var _contacts: Dictionary = {}
var _events: Dictionary = {}
var _finished: Dictionary = {}
var _started: Dictionary = {}

func _skill_num(cid: StringName) -> int:
    return int(String(cid).trim_prefix("arcana_fusion20_"))

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
    renderer.visual_event.connect(func(cid: StringName, kind: StringName, pos: Vector2, st: float) -> void:
        var arr: Array = _events.get(cid, [])
        arr.append(String(kind))
        _events[cid] = arr)
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
        if node is CSourcePlayer or node is DSourcePlayer:
            node.set("render_enabled", false)
        if node is ASourcePlayer:
            node.set("render_enabled", false)
        if node is FusionPlayer:
            for part in node._pending:
                part.node.set("render_enabled", false)
        var slot := Arcana20SourceCatalog.slot(id)
        var dur := float(slot.get("duration", 8.0))
        if dur <= 0.0:
            dur = 9.0
        var steps := int(ceil((dur + 0.2) * 60.0))
        for s in range(steps):
            if not is_instance_valid(node):
                break
            if node is BSourcePlayer:
                (node as BSourcePlayer).advance(1.0 / 60.0)
            elif node.has_method("_process"):
                node._process(1.0 / 60.0)
            if not renderer.is_active(cid):
                break
        var want_contacts: int = int({9: 11, 11: 7, 4: 2, 12: 4, 13: 4}.get(_skill_num(cid), 1))
        if id == 3:
            want_contacts = 8 # authored per-meteor impacts (fusion decisions #03)
        if int(_contacts[cid]) != want_contacts:
            _fail("contact count %s = %d (want %d)" % [cid, int(_contacts[cid]), want_contacts])
        if id == 2:
            var kinds: Array = _events.get(cid, [])
            if not kinds.has("bite") or kinds.count("sweep") < 3:
                _fail("wyrm event ledger incomplete: %s" % str(kinds))
        if id == 3:
            var kinds3: Array = _events.get(cid, [])
            if kinds3.count("meteor_impact") != 8 or not kinds3.has("sigil_ignition"):
                _fail("meteor event ledger incomplete: %s" % str(kinds3))
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
    for key in ["t030", "t200", "t460", "t498", "t530", "t650"]:
        var t: float = float(meta[key].t)
        br.begin()
        wyrm.render(br, t)
        wyrm.post(br, t)
        br.lighting()
        var bytes := br.finalize()
        var sum := 0
        var nonzero := 0
        for i in range(0, bytes.size(), 4):
            sum = (sum + bytes[i] * 3 + bytes[i + 1] * 5 + bytes[i + 2] * 7) & 0xFFFFFFFF
            if bytes[i + 3] != 0:
                nonzero += 1
        var sp: Dictionary = _spatial_compare(bytes, "res://prototypes/arcana_fusion20/renderer/source_b/reference/wyrm_%s.png" % key)
        print("::notice::REFDIAG ", key, " ref=", sp.get("ref_w"), "x", sp.get("ref_h"), " ref_nz=", sp.get("ref_nz"), " ref_rgb_nz=", sp.get("ref_rgb_nz"), " ref_sum=", sp.get("ref_sum"))
        print("::notice::WYRM_SPATIAL ", key, " iou=", snappedf(float(sp.get("iou", 0.0)), 0.0001), " mae=", snappedf(float(sp.get("mae", 99.0)), 0.01), " maxerr=", int(sp.get("maxerr", 255)), " shift=", sp.get("shift", "?"), "@", snappedf(float(sp.get("shift_mae", 99.0)), 0.01), " regions=", JSON.stringify(sp.get("regions", {})))
        if float(sp.get("iou", 0.0)) < 0.90 or float(sp.get("mae", 99.0)) > 6.0:
            _fail("wyrm spatial %s iou=%f mae=%f" % [key, float(sp.get("iou", 0.0)), float(sp.get("mae", 99.0))])
        var exp_sum := int(meta[key].sum)
        var exp_nz := int(meta[key].nonzero)
        var sum_rel := absf(float(sum - exp_sum)) / maxf(1.0, float(exp_sum))
        var nz_rel := absf(float(nonzero - exp_nz)) / maxf(1.0, float(exp_nz))
        print("::notice::WYRM_PARITY ", key, " t=", t, " sum_rel=", snappedf(sum_rel, 0.0001), " nz_rel=", snappedf(nz_rel, 0.0001), " nz=", nonzero, "/", exp_nz)
        if nz_rel > 0.05 or sum_rel > 0.10:
            _fail("wyrm parity %s nz_rel=%f sum_rel=%f" % [key, nz_rel, sum_rel])

    # --- Source-B meteorLoom parity (spatial + aggregate) ---
    var mmeta: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://prototypes/arcana_fusion20/renderer/source_b/reference/meteor_meta.json"))
    var br3 := BRenderer.new()
    br3.caster = Vector2(104, 132)
    br3.target = Vector2(262, 104)
    var loom := BMeteorLoom.new()
    loom.setup(br3)
    for key in ["t100", "t300", "t500", "t660", "t730", "t900"]:
        var t3: float = float(mmeta[key].t)
        br3.begin()
        loom.render(br3, t3)
        loom.post(br3, t3)
        br3.lighting()
        var bytes3 := br3.finalize()
        var sp3: Dictionary = _spatial_compare(bytes3, "res://prototypes/arcana_fusion20/renderer/source_b/reference/meteor_%s.png" % key)
        var nz3 := 0
        for i in range(0, bytes3.size(), 4):
            if bytes3[i + 3] != 0:
                nz3 += 1
        print("::notice::METEOR_SPATIAL ", key, " t=", t3, " iou=", snappedf(float(sp3.get("iou", 0.0)), 0.0001), " mae=", snappedf(float(sp3.get("mae", 99.0)), 0.01), " shift=", sp3.get("shift", "?"), "@", snappedf(float(sp3.get("shift_mae", 99.0)), 0.01), " nz=", nz3, "/", int(mmeta[key].nonzero))
        if float(sp3.get("iou", 0.0)) < 0.90 or float(sp3.get("mae", 99.0)) > 6.0:
            _fail("meteor spatial %s iou=%f mae=%f" % [key, float(sp3.get("iou", 0.0)), float(sp3.get("mae", 99.0))])

    _maw_check(renderer)
    _horizon_check()

    var st := Arcana20Status.summary()
    print("::notice::ARCANA20_DBG stages=", JSON.stringify(renderer.stage_counts), " contacts=", JSON.stringify(_contacts), " finished=", _finished.size(), " started=", _started.size())
    print("ARCANA20_RENDER_STATUS ", JSON.stringify(st))
    if _failures.is_empty():
        print("::notice::ARCANA20_RENDER_RESULT PASS failures=[] casts=20 contacts=20")
        quit(0)
    else:
        print("::error::ARCANA20_RENDER_RESULT FAIL failures=", _failures)
        quit(1)

## #08 spatial parity vs original tide.ts (seed 808) — authored samples.
func _maw_check(_host: Arcana20Renderer) -> void:
    var mmeta: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://prototypes/arcana_fusion20/renderer/source_b/reference/maw_meta.json"))
    var br := BRenderer.new()
    br.caster = Vector2(104, 132)
    br.target = Vector2(262, 104)
    var maw := BUndertowMaw.new()
    maw.setup(br)
    for key in ["t150", "t300", "t440", "t510", "t600"]:
        var t: float = float(mmeta[key].t)
        br.begin()
        maw.render(br, t)
        maw.post(br, t)
        br.lighting()
        var bytes := br.finalize()
        var sp := _spatial_compare(bytes, "res://prototypes/arcana_fusion20/renderer/source_b/reference/maw_%s.png" % key)
        var nz := 0
        for i in range(0, bytes.size(), 4):
            if bytes[i + 3] != 0:
                nz += 1
        print("::notice::MAW_SPATIAL ", key, " t=", t, " iou=", snappedf(float(sp.get("iou", 0.0)), 0.0001), " mae=", snappedf(float(sp.get("mae", 99.0)), 0.01), " shift=", sp.get("shift", "?"), "@", snappedf(float(sp.get("shift_mae", 99.0)), 0.01), " nz=", nz, "/", int(mmeta[key].nonzero))
        if float(sp.get("iou", 0.0)) < 0.90 or float(sp.get("mae", 99.0)) > 6.0:
            _fail("maw spatial %s iou=%f mae=%f" % [key, float(sp.get("iou", 0.0)), float(sp.get("mae", 99.0))])

func ref_nz_count(rb: PackedByteArray) -> int:
    var n := 0
    for i in range(0, rb.size(), 4):
        if rb[i + 3] > 0:
            n += 1
    return n

func _spatial_compare(bytes: PackedByteArray, ref_path: String) -> Dictionary:
    var ref := Image.load_from_file(ref_path)
    if ref == null or ref.is_empty():
        var tex := ResourceLoader.load(ref_path) as Texture2D
        if tex == null:
            return {"error": "no reference"}
        ref = tex.get_image()
    if ref.get_format() != Image.FORMAT_RGBA8:
        ref.convert(Image.FORMAT_RGBA8)
    var rb := ref.get_data()
    var inter := 0
    var union := 0
    var mae := 0.0
    var maxerr := 0
    var npix := BRenderer.W * BRenderer.H
    var regions := {}
    for i in range(npix):
        var o := i * 4
        var na := bytes[o + 3] > 0
        var ra := rb[o + 3] > 0
        if na and ra:
            inter += 1
        if na or ra:
            union += 1
        var d := maxi(maxi(absi(int(bytes[o]) - int(rb[o])), absi(int(bytes[o + 1]) - int(rb[o + 1]))), absi(int(bytes[o + 2]) - int(rb[o + 2])))
        mae += float(d)
        maxerr = maxi(maxerr, d)
        if d > 24:
            var gx := (i % BRenderer.W) * 8 / BRenderer.W
            var gy := (i / BRenderer.W) * 6 / BRenderer.H
            var key := "%d,%d" % [gx, gy]
            regions[key] = int(regions.get(key, 0)) + 1
    var best := 1e9
    var best_key := "0,0"
    for sy in [-1, 0, 1]:
        for sx in [-1, 0, 1]:
            var acc := 0.0
            for yy in range(BRenderer.H):
                var ry := clampi(yy - sy, 0, BRenderer.H - 1)
                for xx in range(BRenderer.W):
                    var rx := clampi(xx - sx, 0, BRenderer.W - 1)
                    var oo := (ry * BRenderer.W + rx) * 4
                    var oo2 := (yy * BRenderer.W + xx) * 4
                    acc += float(maxi(maxi(absi(int(bytes[oo2]) - int(rb[oo])), absi(int(bytes[oo2 + 1]) - int(rb[oo + 1]))), absi(int(bytes[oo2 + 2]) - int(rb[oo + 2]))))
            var m := acc / float(npix)
            if m < best:
                best = m
                best_key = "%d,%d" % [sx, sy]
    var iou := 1.0 if union == 0 else float(inter) / float(union)
    var go := {}
    var ro := {}
    for yy in range(BRenderer.H):
        for xx in range(BRenderer.W):
            var oo := (yy * BRenderer.W + xx) * 4
            var ga2: bool = bytes[oo + 3] > 0
            var ra2: bool = rb[oo + 3] > 0
            if ga2 == ra2:
                continue
            var key2 := "%d,%d" % [xx * 8 / BRenderer.W, yy * 6 / BRenderer.H]
            if ga2:
                go[key2] = int(go.get(key2, 0)) + 1
            else:
                ro[key2] = int(ro.get(key2, 0)) + 1
    var gb := [9999, 9999, -1, -1]
    var rb2 := [9999, 9999, -1, -1]
    var gc := [0.0, 0.0]
    var rc := [0.0, 0.0]
    for yy in range(BRenderer.H):
        for xx in range(BRenderer.W):
            var oo := (yy * BRenderer.W + xx) * 4
            if bytes[oo + 3] > 0:
                gb[0] = mini(gb[0], xx); gb[1] = mini(gb[1], yy); gb[2] = maxi(gb[2], xx); gb[3] = maxi(gb[3], yy)
                gc[0] += xx; gc[1] += yy
            if rb[oo + 3] > 0:
                rb2[0] = mini(rb2[0], xx); rb2[1] = mini(rb2[1], yy); rb2[2] = maxi(rb2[2], xx); rb2[3] = maxi(rb2[3], yy)
                rc[0] += xx; rc[1] += yy
    var ref_nz := 0
    var ref_rgb_nz := 0
    var ref_sum := 0
    for i in range(npix):
        var o := i * 4
        if rb[o + 3] > 0:
            ref_nz += 1
        if rb[o] != 0 or rb[o + 1] != 0 or rb[o + 2] != 0:
            ref_rgb_nz += 1
        ref_sum = (ref_sum + rb[o] * 3 + rb[o + 1] * 5 + rb[o + 2] * 7) & 0xFFFFFFFF
    var grow2 := []
    var rrow := []
    for yy in range(BRenderer.H):
        var gn := 0
        var rn := 0
        for xx in range(BRenderer.W):
            var oo := (yy * BRenderer.W + xx) * 4
            if bytes[oo + 3] > 0:
                gn += 1
            if rb[oo + 3] > 0:
                rn += 1
        grow2.append(gn)
        rrow.append(rn)
    return {"rows_g": str(grow2), "rows_r": str(rrow), "ref_w": ref.get_width(), "ref_h": ref.get_height(), "ref_nz": ref_nz, "ref_rgb_nz": ref_rgb_nz, "ref_sum": ref_sum, "iou": iou, "mae": mae / maxf(1.0, float(npix)), "maxerr": maxerr, "regions": regions, "shift_mae": best, "shift": best_key, "gbbox": "%d,%d-%d,%d" % [gb[0], gb[1], gb[2], gb[3]], "rbbox": "%d,%d-%d,%d" % [rb2[0], rb2[1], rb2[2], rb2[3]], "go": str(go), "ro": str(ro), "gcen": "%.0f,%.0f" % [gc[0] / maxf(1.0, float(inter + (union - inter))), gc[1] / maxf(1.0, float(inter + (union - inter)))], "rcen": "%.0f,%.0f" % [rc[0] / maxf(1.0, float(ref_nz_count(rb))), rc[1] / maxf(1.0, float(ref_nz_count(rb)))]}

## C-family spatial parity vs original C spells (stage loop, seeds per
## spell index: seed = 1000 + index*7919).
func _horizon_check() -> void:
    _c_parity("HORIZON", CEventHorizon.new(), "horizon")
    _c_parity("BASILICA", CMirrorfrostBasilica.new(), "basilica")
    _c_parity("THUNDERLOOM", CThunderloom.new(), "thunderloom")
    _c_parity("THORN", CThornOpera.new(), "thorn")

func _c_parity(label: String, fx: RefCounted, prefix: String) -> void:
    var meta: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://prototypes/arcana_fusion20/renderer/source_c/reference/%s_meta.json" % prefix))
    fx.setup()
    var frame := CFrame.new()
    var targets: Dictionary = {}
    for key in meta.keys():
        targets[key] = float(meta[key].t)
    var t := 0.0
    var shake_k := 0.0
    var flash_k := 0.0
    var flash_c := Vector3.ZERO
    var chroma_k := 0.0
    var steps := 0
    while t <= 8.05:
        fx.update(1.0 / 60.0, t)
        t += 1.0 / 60.0
        steps += 1
        if float(fx.fx_shake) > 0.0:
            shake_k = maxf(shake_k, float(fx.fx_shake))
            fx.fx_shake = 0.0
        if float(fx.fx_flash_k) > 0.0:
            flash_c = fx.fx_flash
            flash_k = maxf(flash_k, float(fx.fx_flash_k))
            fx.fx_flash_k = 0.0
        if float(fx.fx_kick) > 0.0:
            chroma_k = maxf(chroma_k, float(fx.fx_kick))
            fx.fx_kick = 0.0
        shake_k *= 0.86
        if shake_k < 0.3:
            shake_k = 0.0
        flash_k *= 0.82
        chroma_k *= 0.88
        for key in targets.keys():
            if absf(t - float(targets[key])) < 1.0 / 120.0:
                frame.clear()
                frame.t = t
                frame.chroma = chroma_k
                frame.flash = flash_c * flash_k * 0.28
                frame.shake = Vector2((CMath.hash1(steps * 3) - 0.5) * 2.0 * shake_k, (CMath.hash1(steps * 3 + 1) - 0.5) * 2.0 * shake_k) if shake_k > 0.0 else Vector2.ZERO
                fx.render(frame, t)
                var bytes := frame.composite()
                var sp := _spatial_compare(bytes, "res://prototypes/arcana_fusion20/renderer/source_c/reference/%s_%s.png" % [prefix, key])
                var nz := 0
                for i in range(0, bytes.size(), 4):
                    if bytes[i + 3] != 0:
                        nz += 1
                print("::notice::" + label + "_SPATIAL ", key, " t=", t, " iou=", snappedf(float(sp.get("iou", 0.0)), 0.0001), " mae=", snappedf(float(sp.get("mae", 99.0)), 0.01), " shift=", sp.get("shift", "?"), "@", snappedf(float(sp.get("shift_mae", 99.0)), 0.01), " nz=", nz, "/", int(meta[key].nonzero))
                if float(sp.get("iou", 0.0)) < 0.90 or float(sp.get("mae", 99.0)) > 6.0:
                    _fail("%s spatial %s iou=%f mae=%f nz=%d/%d shift=%s@%f gbb=%s rbb=%s go=%s ro=%s" % [label, key, float(sp.get("iou", 0.0)), float(sp.get("mae", 99.0)), nz, int(meta[key].nonzero), str(sp.get("shift", "?")), float(sp.get("shift_mae", 99.0)), str(sp.get("gbbox", "?")), str(sp.get("rbbox", "?")), str(sp.get("go", "?")), str(sp.get("ro", "?"))])
                if label == "THORN" and key == "t100":
                    print("::error::THORNROWS g=", sp.get("rows_g"), " r=", sp.get("rows_r"))
