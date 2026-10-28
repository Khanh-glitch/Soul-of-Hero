extends SceneTree

## Original source src/game/skills/s1.ts glassfang() was executed with
## unmodified src/game/world.ts World.step(1/60) for 240 ticks per scenario.
## Hashes are from original TS Fang positions + every Chain segment + cast RNG.
## Source enemies are given identical scripted moving trajectories; the native
## controller MUST compute its own full head path, not replay source head frames.
const MOTION=preload("res://prototypes/gold_pair/venom_glassfang_motion.gd")
const F:float=1.0/60.0
const CASES=[
    ["tracking_elite","1566f11ef3a7617431a4dc48abcea2c7e5a3e1f550b8bbe675bd74fb66e60e74",
      [14,47,80,113,146],[17,17,17,17,17],138,2893698598],
    ["kill_and_retarget","f9a4f9e1deb1271799c65fa3e952d55a1cb05eec28f7374fbdd04e4755eb6481",
      [14,31,64,97,130],[17,18,18,18,18],122,4285252332]
]

static func _fmt(v:float)->String:
    return "%.6f" % v

func _initialize()->void:
    for c in CASES:
        var retarget:bool=String(c[0])=="kill_and_retarget"
        var e1:Dictionary={
            "id":17,"x":375.0,"y":190.0,
            "r":6.0 if retarget else 9.5,
            "dying":0.0,"hp":30 if retarget else 900,
            "exists":true
        }
        var e2:Dictionary={
            "id":18,"x":407.0,"y":166.0,
            "r":9.5,"dying":0.0,"hp":900,"exists":retarget
        }
        var enemies:Array=[e1,e2] if retarget else [e1]
        var angle:float=atan2(30.0,115.0)
        var cast=MOTION.new()
        cast.begin(260.0,160.0,angle,17,1765485952)
        var rows:PackedStringArray=PackedStringArray()
        var fang_frames:int=0
        var bite_checked:int=0
        for frame in range(1,241):
            for enemy in enemies:
                if not bool(enemy.get("exists",true)):continue
                if int(enemy["id"])==17:
                    enemy["x"]=375.0+8.0*sin(float(frame)*0.070)
                    enemy["y"]=190.0+5.0*cos(float(frame)*0.055)
                else:
                    enemy["x"]=407.0+11.0*sin(float(frame)*0.049)
                    enemy["y"]=166.0+7.0*cos(float(frame)*0.035)
            var previous:int=cast.bite_cues.size()
            cast.step_60hz(enemies)
            var line:String=str(frame)
            if cast.fang==null:
                line+="|none"
            else:
                fang_frames+=1
                line+="|"+_fmt(cast.fang.x)+"|"+_fmt(cast.fang.y)
                line+="|"+_fmt(cast.fang.z)+"|"+_fmt(cast.fang.heading)+"|"+_fmt(cast.fang.open)
                for i in range(8):
                    line+="|"+_fmt(cast.fang.chain.sx[i])+"|"+_fmt(cast.fang.chain.sy[i])
            line+="|"+str(cast.rng.state)
            rows.append(line)

            # This SIMULATED TEST WORLD owns HP, not the VFX renderer:
            # real SOH must pass bite cues to authoritative CombatDamage ONCE.
            for j in range(previous,cast.bite_cues.size()):
                var cue:Dictionary=cast.bite_cues[j]
                if bite_checked>=5:
                    _fail("unexpected extra bite")
                    return
                if int(cue["frame"])!=int(c[2][bite_checked]):
                    _fail("%s bite frame %d expected %d" % [c[0],int(cue["frame"]),int(c[2][bite_checked])])
                    return
                if int(cue["enemy"])!=int(c[3][bite_checked]):
                    _fail("%s target drift on bite %d" % [c[0],bite_checked])
                    return
                if int(cue["amount"])!=(55 if bite_checked==4 else 30):
                    _fail("original bite percentages changed")
                    return
                bite_checked+=1
                for e in enemies:
                    if int(e["id"])==int(cue["enemy"]):
                        e["hp"]=int(e["hp"])-int(cue["amount"])
                        if int(e["hp"])<=0:
                            e["hp"]=0
                            e["dying"]=0.16
                        break
            for e in enemies:
                if float(e.get("dying",0.0))>0.0:
                    e["dying"]=float(e["dying"])-F
                    if float(e["dying"])<=0.0:
                        e["exists"]=false
        if bite_checked!=5 or fang_frames!=int(c[4]):
            _fail("%s bites=%d expected=5 activeFang=%d expected=%d" % [c[0],bite_checked,fang_frames,int(c[4])])
            return
        if cast.rng.state!=int(c[5]):
            _fail("%s final source RNG expected %s actual %s" % [c[0],str(c[5]),str(cast.rng.state)])
            return
        var ctx:=HashingContext.new()
        ctx.start(HashingContext.HASH_SHA256)
        ctx.update(("\n".join(rows)+"\n").to_utf8_buffer())
        var actual:String=ctx.finish().hex_encode()
        var expected:String=String(c[1])
        if actual!=expected:
            print("VENOM_GLASSFANG_MOTION: source rows first 15 for %s:" % c[0])
            for k in range(15):print(rows[k])
            _fail("%s full 240-frame source head + 8*Chain + RNG SHA drift expected=%s got=%s" % [c[0],expected,actual])
            return
        print("VENOM_GLASSFANG_MOTION: scenario %s PASS: 240 frame motion/source Chain/RNG SHA, 5 bites, correct death retarget and 60Hz" % c[0])
    print("VENOM_GLASSFANG_MOTION: PASS / 2 original source World-step scenarios / 480 frames / 10 real bite cues / no native damage calls")
    quit(0)

func _fail(message:String)->void:
    push_error("VENOM_GLASSFANG_MOTION: "+message)
    quit(1)
