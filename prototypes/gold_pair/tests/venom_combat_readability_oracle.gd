extends SceneTree

## Contrast assist is a NEW optional map-side presentation feature, not a Gold
## shader replacement. Validate sampling / fade / tinted map preservation.
const CONTROL=preload("res://prototypes/gold_pair/venom_combat_readability.gd")

func _initialize()->void:
    var map:=Node2D.new()
    map.name="ReadabilityOnlyFixture"
    root.add_child(map)
    var initial:Array[Color]=[
        Color(0.68,0.73,0.82,1.0),
        Color(0.74,0.78,0.86,0.9),
        Color(0.84,0.8,0.78,0.7)
    ]
    var nodes:Array[Node2D]=[]
    for i in range(3):
        var layer:=Node2D.new()
        layer.name=["Backdrop","Geometry","Decor"][i]
        layer.modulate=initial[i]
        map.add_child(layer)
        nodes.append(layer)
    var knight:=Node2D.new()
    knight.name="RealKnightMustRemainBright"
    knight.modulate=Color(0.96,0.88,0.74,0.95)
    map.add_child(knight)
    var enemy:=Node2D.new()
    enemy.name="RealEnemyMustRemainBright"
    enemy.modulate=Color(1.0,0.5,0.4,1.0)
    map.add_child(enemy)
    var actor_before:Color=knight.modulate
    var enemy_before:Color=enemy.modulate

    var assist=CONTROL.new()
    assist.bind_level(map)
    var image:=Image.create(96,96,false,Image.FORMAT_RGBA8)
    image.fill(Color(0.87,0.85,0.83,1.0))
    var bright:float=assist.sample_roi(image,Rect2i(8,8,70,70),3)
    if bright<0.55 or assist.last_sample_count<100:
        _fail("bright authored floor luminance not measured from image")
        return
    var target:float=assist.request_for_luminance(bright,true)
    if target<=0.1 or target>assist.MAX_ATTENUATION:
        _fail("invalid auto attenuation against bright source floor")
        return
    for i in range(45):
        assist.advance_60hz()
    if absf(assist.strength-target)>0.009:
        _fail("deterministic 60Hz ramp to dim target failed")
        return
    for i in range(3):
        var c:Color=nodes[i].modulate
        if not is_equal_approx(c.a,initial[i].a):
            _fail("authored tile alpha changed")
            return
        if absf(c.r-initial[i].r*(1.0-assist.strength))>0.0005:
            _fail("authored backdrop tint relative color not preserved")
            return
    if knight.modulate!=actor_before or enemy.modulate!=enemy_before:
        _fail("smart background attenuation altered visible actors")
        return

    image.fill(Color(0.16,0.17,0.15,1.0))
    var dark:float=assist.sample_roi(image,Rect2i(12,12,64,64),4)
    if assist.request_for_luminance(dark,true)!=0.0:
        _fail("dark maps must not be automatically dimmed")
        return
    for i in range(65):
        assist.advance_60hz()
    if assist.strength>0.013:
        _fail("map brightness not smoothly restored")
        return
    if assist.request_for_luminance(bright,false)!=0.0:
        _fail("backdrop dim should switch off after skill lifetime")
        return
    assist.set_strength(0.28)
    assist.restore()
    for i in range(3):
        if nodes[i].modulate!=initial[i]:
            _fail("restoring original authored map tint is not exact")
            return
    if knight.modulate!=actor_before or enemy.modulate!=enemy_before:
        _fail("source artists' actor colors changed after cleanup")
        return
    print("VENOM_ADAPTIVE_CONTRAST: PASS / bright-floor sensor / dark-floor bypass / 60Hz smooth in-out / actor-color isolation / exact authored tint restoration")
    quit(0)

func _fail(message:String)->void:
    push_error("VENOM_ADAPTIVE_CONTRAST: "+message)
    quit(1)
