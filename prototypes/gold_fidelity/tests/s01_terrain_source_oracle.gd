extends SceneTree

## Environmental Gold oracle: exact SOURCE groove/crack/rubble algorithms
## must survive compositing onto ARBITRARY real authored tile colors.
## World-space ground ink is not prepainted gold scene or screenshot.
const GROUND = preload("res://prototypes/gold_fidelity/hairline_ground.gd")
const INK = preload("res://prototypes/gold_fidelity/gold_s01_transparent_ground.gd")
const ACTOR = preload("res://prototypes/gold_fidelity/gold_s01_terrain_ink.gd")
const COMPONENTS = preload("res://prototypes/gold_fidelity/hairline_source_components_lab.gd")

func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    # The two buffers see SAME source RNG stream and SAME authored mutations.
    var direct = GROUND.new()
    var overlay = INK.new()
    direct.fill(53,61,73,255)
    overlay.clear_ink()
    direct.source_first_groove()
    overlay.source_first_groove()
    direct.source_second_groove()
    overlay.source_second_groove()
    for c in COMPONENTS.CRACKS:
        direct.crack(float(c[0]),150.0,float(c[1]),16.0,1)
        overlay.crack(float(c[0]),150.0,float(c[1]),16.0,1)
        direct.rubble(int(c[0]),151,7)
        overlay.rubble(int(c[0]),151,7)
    if direct._rng!=overlay._rng:
        push_error("GOLD_TERRAIN: original ground RNG drift")
        quit(1)
        return
    var marked:=overlay.marked_count()
    if marked<300 or marked>20000:
        push_error("GOLD_TERRAIN: transparent source deformation footprint unreasonable %d" % marked)
        quit(1)
        return
    var a: PackedByteArray=direct.pixels
    var b: PackedByteArray=overlay.pixels
    var over5:=0
    var affected_mismatches:=0
    var maximum_error:=0
    var affected:=0
    for i in range(0,b.size(),4):
        var oa: int=int(b[i+3])
        if oa==0:
            continue
        affected+=1
        for c in range(3):
            var blended: int=int(roundf(53.0 if c==0 else (61.0 if c==1 else 73.0)))
            blended=INK._u8(float(blended)*(1.0-float(oa)/255.0)+float(b[i+c])*float(oa)/255.0)
            var error:=absi(int(a[i+c])-blended)
            maximum_error=maxi(maximum_error,error)
            if error>5:
                over5+=1
                affected_mismatches+=1
    if over5>affected*3/10 or maximum_error>20:
        push_error("GOLD_TERRAIN: overlay violates original 8-bit RGB blend; maximum=%d badChannels=%d / %d" % [maximum_error,over5,affected*3])
        quit(1)
        return
    var visual = ACTOR.new()
    root.add_child(visual)
    visual.seek_source_time(2.84)
    var diag: Dictionary=visual.source_diagnostics()
    if int(diag["source_mutations"])!=28 or int(diag["marked_pixels"])!=marked:
        push_error("GOLD_TERRAIN: world-stage scheduler drift "+str(diag))
        quit(1)
        return
    var prev_uploads: int=int(diag["texture_uploads"])
    for repeat in range(60):
        visual.seek_source_time(2.84+float(repeat)*0.01)
    if int(visual.source_diagnostics()["texture_uploads"])!=prev_uploads:
        push_error("GOLD_TERRAIN: continuous texture uploads instead of event-driven mutations")
        quit(1)
        return
    visual.seek_source_time(0.1)
    if int(visual.source_diagnostics()["source_mutations"])!=0 or int(visual.source_diagnostics()["marked_pixels"])!=0:
        push_error("GOLD_TERRAIN: reset must clear source persistent ink")
        quit(1)
        return
    print("GOLD_S01_TERRAIN: PASS / 28 source mutations / %d persistent marked pixels / RNG identical / max RGB error=%d / per-frame texture uploads 0" % [marked,maximum_error])
    quit(0)
