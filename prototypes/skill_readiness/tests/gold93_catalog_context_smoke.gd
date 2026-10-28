extends SceneTree

## Native Godot catalog/aim API contract; does NOT certify any skill as ported.
const CATALOG=preload("res://prototypes/skill_readiness/core/gold_skill_catalog.gd")
const CONTEXT=preload("res://prototypes/skill_readiness/core/gold_cast_context.gd")

func _fail(message:String)->void:
    push_error("GOLD93_READINESS_API: "+message)
    quit(1)

func _initialize()->void:
    var cat=CATALOG.new()
    if not cat.is_valid():
        _fail(cat.error_message())
        return
    if cat.ids().size()!=93 or cat.family_count("venomwright")!=21 or cat.family_count("arcana_iii")!=72:
        _fail("expected exact 21 Venom + 72 ARCANA IDs")
        return
    for id in cat.ids():
        var entry:Dictionary=cat.skill(id)
        if String(entry.get("key",""))!=id:
            _fail("catalog ID/entry mismatch "+id)
            return
        if bool(entry.get("native_port_ready",false)):
            if String(entry.get("native_module_path","")).is_empty():
                _fail("port-ready without native executable module "+id)
                return
        elif cat.can_cast_in_lab(id):
            _fail("not-ported entry is incorrectly executable "+id)
            return
        if cat.can_cast_in_production(id) and not bool(entry.get("gameplay_configured",false)):
            _fail("production cast enabled without user-approved rules "+id)
            return
    if not cat.skill("venomwright:999").is_empty() or cat.has_skill("k_night:001"):
        _fail("unknown/non-scoped skill leaked into Gold93 catalog")
        return
    var hero:=Node2D.new()
    var enemy:=Node2D.new()
    root.add_child(hero)
    root.add_child(enemy)
    var ctx=CONTEXT.new()
    ctx.initialize(hero,Vector2(200.0,100.0),20261028)
    if ctx.aim_is_set or ctx.has_production_rules():
        _fail("untouched input envelope invented production aim or rules")
        return
    if not ctx.set_world_aim(Vector2(260.0,145.0)):
        _fail("native world-angle pointer aim not available")
        return
    if absf(ctx.aim_direction.length()-1.0)>0.000001:
        _fail("360-degree aim direction normalization failed")
        return
    var path:=PackedVector2Array([Vector2(200.0,100.0),Vector2(240.0,170.0),Vector2(310.0,200.0)])
    if not ctx.set_drag_path(path) or ctx.drag_path.size()!=3:
        _fail("hold/drag/release path missing")
        return
    ctx.bind_target(enemy)
    if ctx.targets_alive().size()!=1:
        _fail("actor target WeakRef binding failed")
        return
    if ctx.has_production_rules():
        _fail("LAB preview mistakenly exposed unconfigured skill in combat")
        return
    hero.queue_free()
    enemy.queue_free()
    print("GOLD93_READINESS_API: PASS / 93 distinct catalog IDs / native 360-degree pointer and drag context / no invented gameplay availability")
    quit(0)
