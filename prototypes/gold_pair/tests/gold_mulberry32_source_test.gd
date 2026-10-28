extends SceneTree

## Expected floats were calculated by compiling/executing the unchanged
## original Venomwright pixel.ts and ARCANA III util.ts under Node.js.
const RNG = preload("res://prototypes/gold_pair/gold_mulberry32_rng.gd")
const CASES = [
    [1, [0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741, 0.9683778982143849, 0.281103502959013, 0.6128388606011868, 0.7207431411370635]],
    [42, [0.6011037519201636, 0.4482905589975417, 0.8524657934904099, 0.6697340414393693, 0.1748138987459242, 0.5265925421845168, 0.2732279943302274, 0.6247446539346129]],
    [539365415, [0.4136612256988883, 0.4125039700884372, 0.3146405937150121, 0.04268758231773973, 0.1139449756592512, 0.0925024498719722, 0.219894042937085, 0.8618364820722491]],
    [4294967295, [0.8964226141106337, 0.189478256739676, 0.7156526781618595, 0.9440599093213677, 0.8452364315744489, 0.5391399988438934, 0.6804977387655526, 0.4755720964167267]],
    [0, [0.26642920868471265, 0.0003297457005828619, 0.2232720274478197, 0.1462021479383111, 0.4673278229311109, 0.5450490827206522, 0.6152513844426721, 0.6489853798411787]]
]

func _initialize() -> void:
    var checked: int = 0
    for row in CASES:
        var seed: int = int(row[0])
        for family in ["venomwright", "arcana"]:
            var source_seed: int = 1 if family == "arcana" and seed == 0 else seed
            var expected: Array = CASES[0][1] if family == "arcana" and seed == 0 else row[1]
            var rng = RNG.new(seed)
            rng.reseed(seed, family == "arcana")
            if rng.state != source_seed:
                push_error("GOLD_PAIR_RNG: source seed policy drift")
                quit(1)
                return
            for i in range(expected.size()):
                var got: float = rng.next()
                var want: float = float(expected[i])
                if absf(got - want) > 0.000000000001:
                    push_error("GOLD_PAIR_RNG: %s seed=%d draw=%d expected=%.15f got=%.15f" % [family, seed, i, want, got])
                    quit(1)
                    return
                checked += 1
    if checked != 80:
        push_error("GOLD_PAIR_RNG: incorrect test coverage")
        quit(1)
        return
    print("GOLD_PAIR_RNG: PASS / 80 original TypeScript outputs across both engines and zero-seed policies")
    quit(0)
