extends SceneTree

const SEQUENCE = preload("res://prototypes/gold_fidelity/gold_rupture_sequence.gd")

func _initialize() -> void:
    var failures := 0
    var run = SEQUENCE.new(0x20261027,Vector2(33,-8))
    var first: Array[Dictionary] = run.advance_ticks(1)
    if first.size() != 1 or int(first[0]["k"]) != 0:
        push_error("GOLD_S01_SEQUENCE: central wave not released at first tick")
        failures += 1
    if first.size() == 1 and (first[0]["position"] as Vector2).distance_to(Vector2(333,133)) > 0.0001:
        push_error("GOLD_S01_SEQUENCE: world offset changed original local spacing")
        failures += 1
    var rest: Array[Dictionary] = run.advance_ticks(25)
    if not run.completed() or run.emitted.size() != 13 or rest.size() != 12:
        push_error("GOLD_S01_SEQUENCE: wrong total / not finished")
        failures += 1
    var emitted_total := 0
    var central_count := 0
    var latest_delay := 0.0
    for event: Dictionary in run.emitted:
        emitted_total += (event["objects"] as Array).size()
        if bool(event["central_additions_missing"]):
            central_count += 1
        latest_delay = maxf(latest_delay,float(event["delay"]))
    if emitted_total != 286 or central_count != 1 or absf(latest_delay-0.315)>0.000001:
        push_error("GOLD_S01_SEQUENCE: source object count, center marker or outer propagation wrong")
        failures += 1
    if first.size() == 1 and (first[0]["objects"] as Array).size() != 22:
        push_error("GOLD_S01_SEQUENCE: earlier wave sources were mutated by emitter reuse")
        failures += 1
    var checksum := 0.0
    for event: Dictionary in run.emitted:
        for o: Dictionary in event["objects"]:
            var attrs: Dictionary = o["source"]
            checksum += float(attrs.get("x",0.0)) * 0.019 + float(attrs.get("y",0.0)) * 0.027
            checksum += float(attrs.get("life",0.0)) * 0.061
    var repeat_run = SEQUENCE.new(0x20261027,Vector2(33,-8))
    var replay: Array[Dictionary] = repeat_run.advance_ticks(26)
    var checksum2 := 0.0
    for event: Dictionary in replay:
        for o: Dictionary in event["objects"]:
            var attrs: Dictionary = o["source"]
            checksum2 += float(attrs.get("x",0.0)) * 0.019 + float(attrs.get("y",0.0)) * 0.027
            checksum2 += float(attrs.get("life",0.0)) * 0.061
    if absf(checksum-checksum2)>0.0001 or repeat_run.emitter.random_state() != run.emitter.random_state():
        push_error("GOLD_S01_SEQUENCE: repeat seed, random draw stream or time stepping drift")
        failures += 1
    if not run.advance_ticks(30).is_empty() or run.emitted.size() != 13:
        push_error("GOLD_S01_SEQUENCE: duplicate waves after complete")
        failures += 1
    print("GOLD_S01_SEQUENCE: %s / 13 waves / %d source objects / center marked incomplete / deterministic replay" % ["PASS" if failures == 0 else "FAIL",emitted_total])
    quit(0 if failures == 0 else 1)
