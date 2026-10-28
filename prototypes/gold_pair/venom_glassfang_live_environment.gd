class_name VenomGlassfangLiveEnvironment
extends RefCounted

## Continuous ORIGINAL cast-cue -> native environmental event timeline.
## Unlike the 3-frame review ledger, this keeps every native source 60Hz tick.
## This remains partial until every World.fx constructor/Part.fn and original
## WebGL post-compositor is source-locked. It never edits combat health.
const F:float=1.0/60.0
const WHITE:int=0xFFFFFFFF
var pending:Array[Dictionary]=[]
var last_cue:int=0
var last_bite:int=0
var last_tick:int=0
var total_received:int=0
var total_expired:int=0

func reset()->void:
    pending.clear()
    last_cue=0
    last_bite=0
    last_tick=0
    total_received=0
    total_expired=0

func _accept(event:Dictionary,frame:int)->void:
    var copy:Dictionary=event.duplicate(true)
    copy["frame"]=frame
    pending.append(copy)
    total_received+=1

func capture(source)->void:
    if source==null:return
    var tick:int=int(source.world_frame)
    if tick<=last_tick:
        push_error("GLASSFANG_ENVIRONMENT: source World tick must advance exactly once")
        return
    if tick!=last_tick+1:
        push_error("GLASSFANG_ENVIRONMENT: source World frame gap")
        return
    last_tick=tick
    # Source World step appends splash / embed landing effects dynamically.
    # These are REAL landing positions from continuous source particle physics.
    var cues:Array=source.cues
    for index in range(last_cue,cues.size()):
        var cue:Dictionary=cues[index]
        var kind:String=String(cue.get("kind",""))
        if kind=="splash":
            _accept({"kind":"splash","x":cue["x"],"y":cue["y"],
                "radius":cue["radius"],"c1":cue["c1"],"c2":cue["c2"]},
                int(cue.get("frame",tick)))
        elif kind=="embed":
            _accept({"kind":"embed","x":cue["x"],"y":cue["y"],
                "size":cue["size"],"lit":cue["lit"],"dark":cue["dark"],
                "edge":cue["edge"],"duration":cue["duration"]},
                int(cue.get("frame",tick)))
    last_cue=cues.size()
    # Original skill uses w.hit(kind=bite), which creates source Splash,
    # Ring, Flash at contact; finisher independently emits larger blast.
    var bites:Array=source.motion.bite_cues
    for index in range(last_bite,bites.size()):
        var bite:Dictionary=bites[index]
        var born:int=int(bite["frame"])
        var x:float=float(bite["contact_x"])
        var y:float=float(bite["contact_y"])
        _accept({"kind":"splash","x":x,"y":y,"radius":4.0,
            "c1":0xFF30EAA6,"c2":0xFFA0FFEE},born)
        _accept({"kind":"ring","x":x,"y":y,"radius":10.0,
            "duration":0.2,"colors":[WHITE,0xFFDCBCE6,0xFF62A3A6],
            "width":2.0,"r0":0.0,"ease":2.0},born)
        _accept({"kind":"flash","x":x,"y":y,"radius":6.0,
            "duration":0.14,"color":0xFFFCE0D4,"z":6.0},born)
        if bool(bite.get("final",false)):
            # Original finisher blast is centered at fang/ground impact,
            # independently from contact ring.
            _accept({"kind":"flash","x":x,"y":y,"radius":22.0,
                "duration":0.3,"color":0xFFA0FFEE,"z":8.0},born)
            _accept({"kind":"ring","x":x,"y":y,"radius":34.0,
                "duration":0.35,"colors":[WHITE,0xFF529A27,0xFF080904],
                "width":3.0,"r0":0.0,"ease":2.0},born)
    last_bite=bites.size()
    # Old effects must be disposed even on ticks where no screenshot is taken.
    for index in range(pending.size()-1,-1,-1):
        var e:Dictionary=pending[index]
        var life:float=_life(e)
        if float(tick-int(e["frame"])+1)*F>life:
            pending.remove_at(index)
            total_expired+=1

static func _life(e:Dictionary)->float:
    match String(e["kind"]):
        "splash":return 0.34
        "flash","ring","embed":return float(e["duration"])
    return 0.0

func snapshot()->Array:
    var result:Array=[]
    for e in pending:
        var age:float=maxf(0.0,float(last_tick-int(e["frame"])+1)*F)
        if age>_life(e):continue
        var item:Dictionary=e.duplicate(true)
        item["age"]=age
        result.append(item)
    return result

func stats()->Dictionary:
    return {"tick":last_tick,"pending":pending.size(),
        "received":total_received,"expired":total_expired,
        "source_cue_cursor":last_cue,"source_bite_cursor":last_bite}
