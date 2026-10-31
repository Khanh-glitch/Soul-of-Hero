## All-20 visual evidence capture (AVFX review package).
## Renders every skill at staged source times (opening / development /
## peak(climax) / first-contact / aftermath / OUT) plus an animation
## strip, and composes per-skill contact sheets + manifest.json under
## evidence_out/review/. Source-buffer evidence only — this is NOT
## SOH composite verification and NOT visual approval.
extends SceneTree

const OUT_DIR := "res://prototypes/arcana_fusion20/renderer/evidence_out/review"
const STEP := 1.0 / 60.0

var _failures: Array[String] = []

func _fail(msg: String) -> void:
    _failures.append(msg)
    print("::error::ARCANA20_CAPTURE_FAIL ", msg)

func _nz(bytes: PackedByteArray) -> int:
    var n := 0
    for i in range(0, bytes.size(), 4):
        if bytes[i + 3] != 0:
            n += 1
    return n

func _save(bytes: PackedByteArray, w: int, h: int, path: String) -> Image:
    var img := Image.create_from_data(w, h, false, Image.FORMAT_RGBA8, bytes)
    img.save_png(path)
    return img

func _sheet(images: Array, path: String) -> void:
    var tw := 288
    var th := 162
    var sheet := Image.create(tw * 3 + 16, th * 2 + 12, false, Image.FORMAT_RGBA8)
    sheet.fill(Color(0.05, 0.06, 0.09, 1.0))
    for i in range(mini(6, images.size())):
        var im: Image = images[i]
        var cp := im.duplicate() as Image
        cp.resize(tw, th, Image.INTERPOLATE_NEAREST)
        var x := 4 + (i % 3) * (tw + 4)
        var y := 4 + (i / 3) * (th + 4)
        sheet.blend_rect(cp, Rect2i(0, 0, tw, th), Vector2i(x, y))
    sheet.save_png(path)

func _init() -> void:
    DirAccess.make_dir_recursive_absolute(OUT_DIR)
    var manifest: Array = []
    var host := Arcana20Renderer.new()
    var names := {1: "cinder_crown", 2: "furnace_wyrm", 3: "meteor_loom", 4: "ashen_guillotine", 5: "abyssal_bloom", 6: "riptide_calligraphy", 7: "mirrorfrost_basilica", 8: "undertow_maw", 9: "chain_verdict", 10: "thunderloom", 11: "volt_carousel", 12: "skybreaker_script", 13: "rootwake", 14: "spore_nebula", 15: "thorn_opera", 16: "worldseed", 17: "event_horizon", 18: "chronoshard", 19: "constellation_engine", 20: "reality_ripper"}
    for id in range(1, 21):
        var t0 := Time.get_ticks_msec()
        var entry := _capture_skill(id, String(names[id]), host)
        entry["ms"] = Time.get_ticks_msec() - t0
        manifest.append(entry)
        print("::notice::CAPTURE skill ", id, " ", names[id], " ms=", entry["ms"], " contacts=", entry.get("contacts", -1))
    var f := FileAccess.open(OUT_DIR + "/manifest.json", FileAccess.WRITE)
    f.store_string(JSON.stringify(manifest, "  "))
    f.close()
    _write_index(manifest, names)
    host.free()
    if _failures.is_empty():
        print("ARCANA20_CAPTURE_RESULT PASS skills=20")
    else:
        print("ARCANA20_CAPTURE_RESULT FAIL n=", _failures.size())
    quit(0 if _failures.is_empty() else 1)

func _write_index(manifest: Array, names: Dictionary) -> void:
    var html := "<!doctype html><meta charset=utf-8><title>ARCANA Fusion20 — visual review</title>"
    html += "<style>body{background:#0b0e14;color:#dbe4f5;font:14px system-ui}img{width:864px;image-rendering:pixelated}section{margin:28px 0}</style>"
    html += "<h1>ARCANA Fusion20 — native source-buffer review sheets</h1><p>Stages per sheet (row-major): opening, development, catalog peak, first contact (fixed-step capture), aftermath, OUT. Additional contact_*.png files show each authored contact cue. Fixed-clock, sampled source-buffer evidence only, not SOH composite or approval. #01 is an FX-only software composition using the player world transforms; it is not a real SOH composite. See stages.json for times and limitations. VISUAL_NOT_VERIFIED for all 20.</p>"
    for e in manifest:
        var id := int(e["id"])
        html += "<section><h2>%02d %s — dur %.1fs, contacts %s, first contact %ss</h2><p><a href=\"skill_%02d/preview.gif\">Animation</a> · <a href=\"skill_%02d/stages.json\">stage data</a></p><img src=\"skill_%02d_sheet.png\"></section>" % [id, String(names[id]), float(e["duration"]), str(e.get("contacts", "?")), str(e.get("first_contact_t", "?")), id, id, id]
    var f := FileAccess.open(OUT_DIR + "/index.html", FileAccess.WRITE)
    f.store_string(html)
    f.close()

func _stage_times(dur: float, climax: float) -> Dictionary:
    return {
        "opening": 0.35,
        "development": dur * 0.30,
        "peak": climax,
        "aftermath": dur * 0.85,
        "out": dur * 0.97,
    }

## Nearest-neighbor source-over of #01's two actual source buffers after
## the same similarity transforms used by their Sprite2D hosts. The viewport
## covers world (0,120)..(640,480), with caster (200,300), target (420,300).
## This is a source FX-only diagnostic, not an in-game screenshot.
func _fusion_world_frame(cp: CSourcePlayer, ap: ASourcePlayer) -> PackedByteArray:
    var cb := cp.frame_bytes()
    var ab := ap._fb.present()
    var out := PackedByteArray()
    out.resize(416 * 234 * 4)
    for y in range(234):
        for x in range(416):
            var world := Vector2(float(x) * 640.0 / 416.0, 120.0 + float(y) * 360.0 / 234.0)
            var cpos := (world - cp._origin).rotated(-cp._rot) / cp._scale + Vector2(112, 126)
            var apos := (world - ap._origin).rotated(-ap._rot) / ap._scale + ASourcePlayer.CASTER_LOCAL
            var cx := floori(cpos.x)
            var cy := floori(cpos.y)
            var ax := floori(apos.x)
            var ay := floori(apos.y)
            var ci := (cy * 384 + cx) * 4
            var ai := (ay * 416 + ax) * 4
            var ca := 0.0
            var aa := 0.0
            if cx >= 0 and cx < 384 and cy >= 0 and cy < 216:
                ca = float(cb[ci + 3]) / 255.0
            if ax >= 0 and ax < 416 and ay >= 0 and ay < 234:
                aa = float(ab[ai + 3]) / 255.0
            var alpha := aa + ca * (1.0 - aa)
            var oi := (y * 416 + x) * 4
            if alpha > 0.0:
                for channel in range(3):
                    var c := float(cb[ci + channel]) if ca > 0.0 else 0.0
                    var a := float(ab[ai + channel]) if aa > 0.0 else 0.0
                    out[oi + channel] = clampi(roundi((a * aa + c * ca * (1.0 - aa)) / alpha), 0, 255)
                out[oi + 3] = clampi(roundi(alpha * 255.0), 0, 255)
    return out

func _capture_skill(id: int, sname: String, host: Arcana20Renderer) -> Dictionary:
    var slot := Arcana20SourceCatalog.slot(id)
    var dur := float(slot.get("duration", 8.0))
    var climax := float(slot.get("climax", dur * 0.6))
    var stages := _stage_times(dur, climax)
    var dir := OUT_DIR + "/skill_%02d" % id
    DirAccess.make_dir_recursive_absolute(dir)
    DirAccess.make_dir_recursive_absolute(dir + "/anim")
    var contacts := [0]
    var first_contact := [-1.0]
    var grab: Callable

    if id == 2 or id == 3 or id == 8:
        var bp := BSourcePlayer.new()
        root.add_child(bp)
        bp.visual_contact.connect(func(pos: Vector2) -> void:
            contacts[0] += 1
            if first_contact[0] < 0.0:
                first_contact[0] = bp.elapsed)
        bp.begin(Vector2(200, 300), Vector2(420, 300), "wyrm" if id == 2 else ("meteor" if id == 3 else "maw"))
        dur = bp.duration
        stages = _stage_times(dur, climax)
        grab = func(t: float) -> PackedByteArray:
            bp.elapsed = t
            bp._fire_due_events()
            bp._r.begin()
            bp._fx.call("render", bp._r, bp.elapsed)
            bp._fx.call("post", bp._r, bp.elapsed)
            bp._r.lighting()
            return bp._r.finalize()
        _run_plan(id, sname, dur, stages, grab, dir, bp, contacts, first_contact, 384, 216)
        bp.free()
    elif id == 7 or id == 10 or id == 15 or id == 17:
        var cp := CSourcePlayer.new()
        root.add_child(cp)
        cp.visual_contact.connect(func(kind: StringName, pos: Vector2, st: float) -> void:
            contacts[0] += 1
            if first_contact[0] < 0.0:
                first_contact[0] = st)
        cp.set("render_enabled", false)
        cp.begin(Vector2(200, 300), Vector2(420, 300), "horizon" if id == 17 else ("basilica" if id == 7 else ("thunderloom" if id == 10 else "thorn")))
        dur = cp.duration
        stages = _stage_times(dur, climax)
        grab = func(t: float) -> PackedByteArray:
            while cp.source_time() < t - 0.0001 and bool(cp.get("_active")):
                cp.advance(STEP)
            cp.set("render_enabled", true)
            cp.call("_render_frame")
            cp.set("render_enabled", false)
            return cp.frame_bytes()
        _run_plan(id, sname, dur, stages, grab, dir, cp, contacts, first_contact, 384, 216)
        cp.free()
    elif id == 19:
        var dp := DSourcePlayer.new()
        root.add_child(dp)
        dp.visual_contact.connect(func(kind: StringName, pos: Vector2, st: float) -> void:
            contacts[0] += 1
            if first_contact[0] < 0.0:
                first_contact[0] = st)
        dp.set("render_enabled", false)
        dp.begin(Vector2(200, 300), Vector2(420, 300))
        dur = dp.duration
        stages = _stage_times(dur, climax)
        grab = func(t: float) -> PackedByteArray:
            while dp.source_time() < t - 0.0001 and bool(dp.get("_active")):
                dp.advance(STEP)
            dp.set("render_enabled", true)
            dp.call("_render_frame")
            dp.set("render_enabled", false)
            return (dp.get("_eng") as DConstellationEngine).frame_bytes()
        _run_plan(id, sname, dur, stages, grab, dir, dp, contacts, first_contact, 480, 270)
        dp.free()
    elif id == 1:
        # Exercise the real fusion clock and map both source sprites into the
        # same world-space viewport. This is FX-only, not a SOH scene.
        var fp := FusionPlayer.new()
        var ap := ASourcePlayer.new()
        var cp := CSourcePlayer.new()
        ap.configure(ACinderCrown.new(), ACinderCrown.DURATION)
        fp.configure([
            {"node": cp, "layer": -1, "offset": 0.69, "begin_call": func(n: Node, cw: Vector2, tw: Vector2) -> void: n.call("begin", cw, tw, "crown")},
            {"node": ap, "layer": 1, "offset": 0.0, "begin_call": func(n: Node, cw: Vector2, tw: Vector2) -> void: n.call("begin", cw, tw)},
        ], ACinderCrown.DURATION)
        root.add_child(fp)
        fp.visual_contact.connect(func(kind: StringName, pos: Vector2, st: float) -> void:
            contacts[0] += 1
            if first_contact[0] < 0.0:
                first_contact[0] = st)
        fp.begin(Vector2(200, 300), Vector2(420, 300))
        ap.set("render_enabled", false)
        cp.set("render_enabled", false)
        dur = fp.duration
        stages = _stage_times(dur, 3.95)
        grab = func(t: float) -> PackedByteArray:
            while fp.source_time() < t - 0.0001 and bool(fp.get("_active")):
                fp.advance(STEP)
            cp.set("render_enabled", true)
            cp.call("_render_frame")
            cp.set("render_enabled", false)
            ap._fb.clear()
            ap._spell.call("render", ap._fb, ap.source_time())
            return _fusion_world_frame(cp, ap)
        _run_plan(id, sname, dur, stages, grab, dir, fp, contacts, first_contact, 416, 234)
        fp.free()
    else:
        var ap := ASourcePlayer.new()
        root.add_child(ap)
        ap.configure(host._make_a_spell(id), host._a_spell_dur(id))
        ap.set("render_enabled", false)
        ap.visual_contact.connect(func(kind: StringName, pos: Vector2, st: float) -> void:
            contacts[0] += 1
            if first_contact[0] < 0.0:
                first_contact[0] = st)
        ap.begin(Vector2(200, 300), Vector2(420, 300))
        dur = ap.duration
        stages = _stage_times(dur, climax)
        grab = func(t: float) -> PackedByteArray:
            while ap.source_time() < t - 0.0001 and bool(ap.get("_active")):
                ap.advance(STEP)
            ap._fb.clear()
            ap._spell.call("render", ap._fb, ap.source_time())
            return ap._fb.present()
        _run_plan(id, sname, dur, stages, grab, dir, ap, contacts, first_contact, 416, 234)
        ap.free()
    return {"id": id, "name": sname, "duration": dur, "contacts": contacts[0],
        "first_contact_t": snappedf(first_contact[0], 0.01)}

func _run_plan(id: int, sname: String, dur: float, stages: Dictionary, grab: Callable, dir: String, node: Node, contacts: Array, first_contact: Array, w: int, h: int) -> void:
    # Single ascending pass (source players are forward-only): merged
    # stage + animation capture points, grabbed once each.
    var points: Array = [] # {t, kind, key}
    var cue_list: Array = []
    if node is FusionPlayer:
        for part in node._pending:
            var part_events: Array = part.node.get("_events")
            for ev in part_events:
                var kind := String(ev.kind)
                if kind.ends_with("impact") or kind.ends_with("contact") or kind == "bite":
                    cue_list.append({"t": maxf(0.0, float(ev.t) - float(part.get("offset", 0.0))), "kind": kind})
    else:
        var events_v: Variant = node.get("_events")
        if events_v is Array:
            for ev in events_v:
                var kind := String(ev.kind)
                if kind.ends_with("impact") or kind.ends_with("contact") or kind == "bite":
                    cue_list.append({"t": float(ev.t), "kind": kind})
    cue_list.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return float(a.t) < float(b.t))
    for i in range(cue_list.size()):
        var cue: Dictionary = cue_list[i]
        points.append({"t": cue.t, "kind": "cue", "key": "%02d" % i})
    var order := ["opening", "development", "peak", "contact", "aftermath", "out"]
    if id == 19:
        for tick in [30, 72, 120, 192, 264, 312, 384, 444, 474, 489]:
            points.append({"t": float(tick) / 60.0, "kind": "d_compare", "key": "t%03d" % int(round(float(tick) * 100.0 / 60.0))})
    for key in order:
        var t: float = float(stages.get(key, -1.0))
        if key == "contact":
            t = -1.0 # resolved after pass from first_contact (peak frame reused if earlier)
        if t >= 0.0:
            points.append({"t": t, "kind": "stage", "key": key})
    var anim_t := 0.2
    var fi := 0
    while anim_t < dur:
        points.append({"t": anim_t, "kind": "anim", "key": str(fi)})
        fi += 1
        anim_t += 0.4
    points.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return float(a.t) < float(b.t))
    var stage_imgs: Dictionary = {}
    var stage_nz: Dictionary = {}
    for pt in points:
        var bytes: PackedByteArray = grab.call(clampf(float(pt.t), 0.0, dur - 0.001))
        if String(pt.kind) == "anim":
            _save(bytes, w, h, dir + "/anim/f_%03d.png" % int(String(pt.key)))
        elif String(pt.kind) == "d_compare":
            _save(bytes, w, h, dir + "/native_%s.png" % String(pt.key))
        elif String(pt.kind) == "cue":
            _save(bytes, w, h, dir + "/contact_%s.png" % String(pt.key))
        else:
            var img := _save(bytes, w, h, dir + "/stage_%s.png" % String(pt.key))
            stage_imgs[String(pt.key)] = img
            stage_nz[String(pt.key)] = _nz(bytes)
    # The first authored cue is captured as part of the ascending fixed-step
    # pass. It is not substituted by a nearby animation sample.
    var contact_img: Image = stage_imgs.get("peak")
    var first_cue_path := dir + "/contact_00.png"
    if FileAccess.file_exists(first_cue_path):
        contact_img = Image.load_from_file(first_cue_path)
    if contact_img != null:
        contact_img.save_png(dir + "/stage_contact.png")
        stage_nz["contact"] = _nz(contact_img.get_data())
    var images: Array = []
    for key in order:
        if stage_imgs.has(key):
            images.append(stage_imgs[key])
        elif key == "contact" and contact_img != null:
            images.append(contact_img)
    _sheet(images, OUT_DIR + "/skill_%02d_sheet.png" % id)
    if int(stage_nz.get("development", 0)) == 0:
        _fail("capture %s development frame empty" % sname)
    if int(stage_nz.get("peak", 0)) == 0:
        _fail("capture %s peak frame empty" % sname)
    var f := FileAccess.open(dir + "/stages.json", FileAccess.WRITE)
    f.store_string(JSON.stringify({"stages": stages, "nz": stage_nz, "first_contact_t": first_contact[0], "contacts": contacts[0], "contact_captures": cue_list}, "  "))
    f.close()
