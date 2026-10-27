extends SceneTree

## Truth contracts transcribed from user's original gold skills1.ts s01
## and fxlib.ts, not newly invented particles or gameplay damage.
const SOURCE = preload("res://prototypes/gold_fidelity/gold_s01_center_events.gd")
const SCHEDULE = preload("res://prototypes/gold_fidelity/gold_rupture_schedule.gd")
var checks := 0
var fails := 0

func check(label: String, value: bool) -> void:
    checks += 1
    if not value:
        push_error("GOLD_S01_CENTER: "+label)
        fails += 1

func _initialize() -> void:
    var center: Dictionary = {}
    var side_event: Dictionary = {}
    var unmodified_count := 0
    for wave: Dictionary in SCHEDULE.waves():
        var d: Dictionary = {"k":wave["step"],"side":wave["side"],"position":wave["position"]}
        var emitted: Dictionary = SOURCE.for_wave(d)
        if int(wave["step"])==0:
            center = emitted
        elif int(wave["step"])==2 and int(wave["side"])==1:
            side_event=emitted
        else:
            if (emitted["lights"] as Array).is_empty() and (emitted["rings"] as Array).is_empty() and (emitted["contact_cues"] as Array).is_empty():
                unmodified_count+=1
    check("11 non-special waves must not gain unsupported FX",unmodified_count==11)
    check("exact one central large-ring descriptor",(center.get("rings",[]) as Array).size()==1)
    var rings: Array = center.get("rings",[])
    if rings.size()==1:
        var ring: Dictionary = rings[0]
        check("90 radius/r0=4",float(ring["r0"])==4.0 and float(ring["r1"])==90.0)
        check("wd=max(8,90*0.3)=27",float(ring["wd"])==27.0)
        check("s=3+90*0.03=5.7",absf(float(ring["s"])-5.7)<0.00001)
        check("ring lifetime=0.6*0.9",absf(float(ring["life"])-0.54)<0.00001)
        check("original source at x300,y147",ring["x"]==300.0 and ring["y"]==147.0)
    var lights: Array = center.get("lights",[])
    check("one exact 150-radius cool light",lights.size()==1)
    if lights.size()==1:
        var light: Dictionary = lights[0]
        check("cool light radius 150, intensity 1.6",float(light["r"])==150.0 and float(light["i"])==1.6)
        check("cool light defaults life .5, altitude 8",float(light["life"])==0.5 and float(light["z"])==8.0)
        check("cool light WebGL source palette",light["c"]==Vector3(0.62,0.78,1.0))
    var contacts: Array = center.get("contact_cues",[])
    check("central heavy target receives render-only signal",contacts.size()==1)
    if contacts.size()==1:
        check("central knockback 430, lift170, hitstop .09 but NO damage write",contacts[0]["enemy_index"]==0 and contacts[0]["power"]==430.0 and contacts[0]["lift"]==170.0 and contacts[0]["stop"]==0.09 and bool(contacts[0]["display_only"]))
    var side_contacts: Array = side_event.get("contact_cues",[])
    check("only wave step2 toward +x fires two grunt cues",side_contacts.size()==2)
    if side_contacts.size()==2:
        check("both grunts target indices 1/2 with lift60",side_contacts[0]["enemy_index"]==1 and side_contacts[1]["enemy_index"]==2 and side_contacts[0]["lift"]==60.0)
    var offset := Vector2(170.0,-31.0)
    var shifted: Dictionary = {}
    for wave: Dictionary in SCHEDULE.waves(offset):
        if int(wave["step"])==2 and int(wave["side"])==1:
            shifted=SOURCE.for_wave({"k":wave["step"],"side":wave["side"],"position":wave["position"]})
    check("moving skill in world does not lose source-local grunt contacts",(shifted.get("contact_cues",[]) as Array).size()==2)
    check("randomized source contact FX correctly flagged unported",bool(center.get("unported_randomized_contact_and_groundring_blob",false)))
    print("GOLD_S01_CENTER_SOURCE: %s / %d source contracts / no gameplay writes" % ["PASS" if fails==0 else "FAIL "+str(fails),checks])
    quit(0 if fails==0 else 1)
