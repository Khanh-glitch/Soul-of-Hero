class_name GoldS01CenterEvents
extends RefCounted

## Literal, deterministic S01 special-impact parameters from the user's
## top-down-sword-vfx-laboratory.zip:
## skills1.ts s01 + fxlib.ts groundRing/lightAt/contact.
## IMPORTANT: this class does NOT emulate the extra randomized contact FX.
## It intentionally never writes damage or enemy state.
const COOL := Vector3(0.62,0.78,1.0)
const MAIN_ENEMY := 0
const GRUNT_A := 1
const GRUNT_B := 2

static func for_wave(wave: Dictionary) -> Dictionary:
    var order: int = int(wave["k"])
    var side: int = int(wave["side"])
    var position: Vector2 = wave["position"]
    var rings: Array[Dictionary] = []
    var lights: Array[Dictionary] = []
    var contact_cues: Array[Dictionary] = []
    if order == 0:
        # fxlib.groundRing({r:90,life:0.6,th:0.14})
        # GLSL ring is (r0=4,r1=90, wd=max(8,90*.3),
        #                 s=3+90*.03, life=.6*.9).
        rings.append({"x":position.x,"y":position.y+6.0,
            "r0":4.0,"r1":90.0,"wd":27.0,"s":5.7,
            "life":0.54,"t":0.0,"source":"center_ground_ring_90"})
        # fxlib.lightAt({r:150,i:1.6,c:COOL})
        # LightFx defaults: life=.5, z=8, hold=0.
        lights.append({"x":position.x,"y":position.y,
            "z":8.0,"r":150.0,"i":1.6,"life":0.5,"t":0.0,
            "hold":0.0,"c":COOL,"source":"center_cool_light"})
        contact_cues.append({"enemy_index":MAIN_ENEMY,"direction":PI,
            "power":430.0,"lift":170.0,"down":1.4,"big":true,
            "stop":0.09,"display_only":true,
            "missing_source_contact_particles":true})
    # Source condition: Math.abs(x - 352) < 14.
    # It is not 'every second wave': it only triggers at world x344.
    if absf((300.0+float(order*side)*22.0)-352.0)<14.0:
        contact_cues.append({"enemy_index":GRUNT_A,"direction":-PI/2.0,
            "power":150.0,"lift":60.0,"stun":0.6,
            "display_only":true,"missing_source_contact_particles":true})
        contact_cues.append({"enemy_index":GRUNT_B,"direction":PI/2.0,
            "power":150.0,"lift":60.0,"stun":0.6,
            "display_only":true,"missing_source_contact_particles":true})
    return {"rings":rings,"lights":lights,"contact_cues":contact_cues,
        "unported_randomized_contact_and_groundring_blob":order==0 or contact_cues.size()>0}
