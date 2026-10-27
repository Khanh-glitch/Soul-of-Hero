extends SceneTree

## All expected numeric checkpoints are from unmodified original actors.ts
## transpiled with tsc and executed as source Enemy in Node.js.
## Original actors.ts sha256: 6422b09b706705b07a0b13bf695baf981363c1dafb2a283f85457de17e717e57
## Row = [tick, x, y, z, vx, vy, vz, flash, stun, down, lean, centerY]
const ACTOR = preload("res://prototypes/gold_fidelity/gold_s01_enemy_presentation.gd")
const FIXTURES = [
    {"kind":"heavy","id":0,"x":300.0,"y":150.0,"dir":PI,"power":430.0,
        "opts":{"lift":170.0,"down":1.4},
        "rows":[
            [0,300,150,0,-301,0,170,1,.4,1.4,0,137],
            [1,294.98333333,150,2.83333333,-299.00000738,0,161.33333333,.9,.38333333,1.38333333,.1061837,134.16666667],
            [5,275.24779129,150,12.72222222,-291.13204625,0,126.66666667,.5,.31666667,1.31666667,.35124117,124.27777778],
            [15,228.15119237,150,27.33333333,-272.35606283,0,40,0,.15,1.15,.48843272,109.66666667],
            [30,163.13970279,150,22.16666667,-246.43795668,0,-90,0,0,.9,.50191072,114.83333333],
            [60,64.90380166,150,0,-86.81478415,0,0,0,0,.4,.50000237,137],
            [90,48.29278936,150,0,-7.12619144,0,0,0,0,0,.12871956,137]
        ]},
    {"kind":"grunt","id":1,"x":352.0,"y":108.0,"dir":-PI/2.0,"power":150.0,
        "opts":{"lift":60.0,"stun":0.6},
        "rows":[
            [0,352,108,0,0,-120,60,1,.6,0,0,98],
            [1,352,106,1,0,-119.20266075,51.33333333,.9,.58333333,0,.0061837,95],
            [5,352,98.13200982,3.55555556,0,-116.06593206,16.66666667,.5,.51666667,0,.01508117,84.57645426],
            [15,352,79.35595709,0,0,-100.56709092,0,0,.35,0,.00602491,69.35595709],
            [30,352,64.39887464,0,0,-28.81295395,0,0,.1,0,.00359934,54.39887464],
            [60,352,58.88584668,0,0,-2.36511129,0,0,0,0,-.00002462,48.88584668],
            [90,352,58.43330979,0,0,-.19414016,0,0,0,0,-.00000003,48.43330979]
        ]},
    {"kind":"grunt","id":2,"x":348.0,"y":196.0,"dir":PI/2.0,"power":150.0,
        "opts":{"lift":60.0,"stun":0.6},
        "rows":[
            [0,348,196,0,0,120,60,1,.6,0,0,186],
            [1,348,198,1,0,119.20266075,51.33333333,.9,.58333333,0,.0061837,187],
            [5,348,205.86799018,3.55555556,0,116.06593206,16.66666667,.5,.51666667,0,.01508117,192.31243463],
            [15,348,224.64404291,0,0,100.56709092,0,0,.35,0,.00602491,214.64404291],
            [30,348,239.60112536,0,0,28.81295395,0,0,.1,0,.00359934,229.60112536],
            [60,348,245.11415332,0,0,2.36511129,0,0,0,0,-.00002462,235.11415332],
            [90,348,245.56669021,0,0,.19414016,0,0,0,0,-.00000003,235.56669021]
        ]},
    {"kind":"heavy","id":0,"x":300.0,"y":150.0,"dir":PI,"power":22.0,
        "opts":{"stun":0.4,"flash":0.8},
        "rows":[
            [0,300,150,0,-15.4,0,0,.8,.4,0,0,137],
            [1,299.74333333,150,0,-14.16868399,0,0,.7,.38333333,0,.04018854,137],
            [5,298.90612305,150,0,-10.15230571,0,0,.3,.31666667,0,.10900196,137],
            [15,297.70959796,150,0,-4.41217387,0,0,0,.15,0,.07721615,137],
            [30,297.05338679,150,0,-1.26410898,0,0,0,0,0,.02543115,137],
            [60,296.81151405,150,0,-.10376438,0,0,0,0,0,.00191135,137]
        ]}
]
const KEYS = ["x","y","z","vx","vy","vz","flash","stun","down","lean","cy"]
const ERROR_LIMIT := 0.00015

func _initialize() -> void:
    var checked := 0
    var fails := 0
    for data: Dictionary in FIXTURES:
        var original = ACTOR.new(int(data["id"]),String(data["kind"]),float(data["x"]),float(data["y"]))
        original.hit(float(data["dir"]),float(data["power"]),data["opts"])
        var tick := 0
        for row: Array in data["rows"]:
            var requested: int = int(row[0])
            while tick < requested:
                original.advance(1.0/60.0,150.0)
                tick += 1
            var current: Dictionary = original.diagnostics()
            for index in range(KEYS.size()):
                var key: String = KEYS[index]
                if absf(float(current[key])-float(row[index+1])) > ERROR_LIMIT:
                    push_error("GOLD_S01_ENEMY: %s power=%s tick=%d key=%s expected=%s actual=%s" %
                        [String(data["kind"]),str(data["power"]),tick,key,str(row[index+1]),str(current[key])])
                    fails += 1
                checked += 1
        if not bool(original.diagnostics().get("non_authoritative_visual_only",false)):
            push_error("GOLD_S01_ENEMY: accidentally declared combat authority")
            fails += 1
        checked += 1
    print("GOLD_S01_ENEMY_ORACLE: %s / %d numerical comparisons against original JS actor source" %
        ["PASS" if fails==0 else "FAIL "+str(fails),checked])
    quit(0 if fails==0 else 1)
