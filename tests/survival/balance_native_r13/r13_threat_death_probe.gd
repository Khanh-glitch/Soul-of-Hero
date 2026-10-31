extends "res://tests/survival/balance_native_r13/r13_harness.gd"
## R13TD — the two halves of "risk with a way back": a fair threat, and one bag.
##
## **Threat.** The shipped default is measured first, because that is what a player
## meets. Then the guarded mount is driven with the flag switched on — a
## counterfactual, and the probe says so on every line — to answer whether the
## mechanism would be fair if A3/A1 turned it on: safe distance from the spawn,
## the enemy's real shipped numbers, and the absence of a reward.
##
## **Death.** D062–D074 and the product contract allow exactly one death bag per
## death, cleared by a commit. The probe kills the Hero through the service's own
## `begin_overworld_death`, verifies a second death cannot mint a second bag, that
## recovery is refused while the death is still pending, and that the *physical*
## bag node in the world is the thing that returns the stack.
##
## Not claimed: that the fight is enjoyable or that the player understands it. Both
## need a human (EV8) and pixels (R13VIS).

## Carried forward from round 12 unchanged except the probe id and this note, so any
## difference between the round-12 and round-13 rows is a fact about the product, not
## about the probe.

func _body() -> void:
	probe_id = "R13TD"
	probe_title = "threat fairness (default + counterfactual) and the single death bag, recovered through the world node"
	owner_action = (
		"A0 (arena_dea2428e, 21c37aec) + A3 (b44e22df): the death bag is implemented and refuses the wrong states; "
		+ "the threat is implemented and off by default, so no player meets one. Either ship it on with A3's "
		+ "risk/reward numbers, or state in the product contract that the first run has no combat. Leaving a "
		+ "fully-built, fully-guarded encounter unreachable is the exact 'dead code as progress' failure the "
		+ "protocol forbids. A1 must also confirm the ring is somewhere a player actually walks."
	)

	var mounted := await _mount_world_ready(false)
	if mounted == null:
		_block("the shipped overworld did not reach READY: %s" % blocked)
		_done()
		return

	await _threat(mounted)
	_death(mounted)

	_done()


# ------------------------------------------------------------------- 1. threat
func _threat(mounted: Node) -> void:
	var mount: Node = mounted.get(&"threat_mount")
	if mount == null:
		_missing("a production threat mount", "chapter1_overworld.threat_mount")
		return
	var shipped: Dictionary = mount.call(&"snapshot") as Dictionary
	_note("shipped threat snapshot: %s" % str(shipped))
	var setting_value := bool(ProjectSettings.get_setting("survival/a0_optional_threat", false))
	_expect(bool(shipped.get("enabled", not setting_value)) == setting_value,
		"the threat snapshot reports the same setting the world reads (%s)" % str(setting_value))
	_expect(not bool(shipped.get("mounted", true)),
		"the shipped world mounts no threat while the setting is off")
	if not bool(shipped.get("enabled", false)):
		_missing("a threat a player can meet in the shipped run (P4 fair threats)",
			"survival/a0_optional_threat is absent/false, so OptionalSkeletonEncounter is never created")

	# COUNTERFACTUAL: the flag is not the product's setting; it is A7 asking the
	# product's own mount what it would do. Restored immediately afterwards.
	ProjectSettings.set_setting("survival/a0_optional_threat", true)
	var forced: Dictionary = mount.call(&"mount", mounted, hero, traversability, mounted.get(&"survival_build")) as Dictionary
	ProjectSettings.set_setting("survival/a0_optional_threat", false)
	_note("COUNTERFACTUAL threat flag on -> %s" % str(forced))
	if not bool(forced.get("mounted", false)):
		_missing("a valid threat site inside the opening ring",
			"the mount searched and refused: %s (attempts=%d)"
			% [String(forced.get("last_error", "?")), int(forced.get("attempts", 0))])
		return
	var cell_value: Variant = forced.get("site_cell", [])
	var site := Vector2i(int((cell_value as Array)[0]), int((cell_value as Array)[1]))
	var center := Vector2(site.x * 16 + 8, site.y * 16 + 15)
	var distance := hero.global_position.distance_to(center)
	_note("threat site=%s distance=%.0f px (%.1f tiles) attempts=%d"
		% [str(site), distance, distance / 16.0, int(forced.get("attempts", 0))])
	_expect(distance > 320.0,
		"the counterfactual threat is outside the encounter's 320 px safe spawn ring (%.0f px)" % distance)
	_expect(bool(forced.get("reward_free", false)),
		"the encounter declares itself reward-free (no XP, no random loot)")
	var encounter: Node = mount.get(&"encounter")
	if encounter == null or not is_instance_valid(encounter):
		_missing("a live encounter node after a successful mount", "threat_mount.encounter")
		return
	var enemy: Node = null
	for child: Node in encounter.get_children():
		if child.get(&"contact_damage") != null:
			enemy = child
			break
	if enemy == null:
		for child: Node in encounter.find_children("*", "CharacterBody2D", true, false):
			enemy = child
			break
	if enemy != null:
		_note("shipped enemy numbers: contact_damage=%s max_health=%s detection=%s leash=%s"
			% [str(enemy.get(&"contact_damage")), str(enemy.get(&"max_health")),
				str(enemy.get(&"detection_radius")), str(enemy.get(&"leash_distance"))])
		var damage := int(enemy.get(&"contact_damage"))
		var hp := int(enemy.get(&"max_health"))
		var hero_hp := int(hero.get(&"max_health"))
		_note("fairness arithmetic: hero %d hp / %d contact damage = %d contacts; enemy %d hp"
			% [hero_hp, damage, int(ceil(float(hero_hp) / float(maxi(damage, 1)))), hp])
		_expect(damage > 0 and hp > 0, "the counterfactual enemy carries real shipped combat numbers")
		_expect(hero_hp > damage * 2,
			"one contact does not kill a full-health Hero (%d hp vs %d damage)" % [hero_hp, damage])
	# Leave the world as the product built it: the encounter was mounted by this
	# counterfactual and must not survive into the death test below.
	if encounter != null and is_instance_valid(encounter):
		encounter.queue_free()
		await process_frame


# -------------------------------------------------------------------- 2. death
func _death(mounted: Node) -> void:
	var service := _survival()
	if service == null:
		_block("SurvivalService is not present in this composition")
		return
	_grant_item("oak_wood", 5, "a7_r13_death_oak")
	var bag_before := _count_item("oak_wood")
	var first: Dictionary = service.call(&"begin_overworld_death", hero.global_position) as Dictionary
	_note("begin_overworld_death -> ok=%s entity=%s already_pending=%s"
		% [str(first.get("ok", false)), String(first.get("entity_id", "")), str(first.get("already_pending", false))])
	_expect(bool(first.get("ok", false)), "the Hero's death opens a death bag through the service")
	var bag_id := String(first.get("entity_id", ""))
	if bag_id.is_empty():
		_missing("a death bag record", "begin_overworld_death returned no entity id")
		return
	var doc: Dictionary = service.call(&"document") as Dictionary
	_expect(doc.get("death_bags", {}) is Dictionary and (doc.get("death_bags", {}) as Dictionary).has(bag_id),
		"the bag exists as one durable record (%s)" % bag_id)
	_expect(_count_item("oak_wood") < bag_before,
		"the dropped stack left the bag (%d -> %d)" % [bag_before, _count_item("oak_wood")])
	# One bag per death: a second death while the first is pending must not mint a
	# second bag, and must return the same id.
	var second: Dictionary = service.call(&"begin_overworld_death", hero.global_position) as Dictionary
	_note("second begin_overworld_death -> %s" % str(second))
	_expect(bool(second.get("already_pending", false)) and String(second.get("entity_id", "")) == bag_id,
		"a second death before recovery reuses the pending bag instead of making a second one")
	var bags: Dictionary = (service.call(&"document") as Dictionary).get("death_bags", {}) as Dictionary
	_expect(bags.size() == 1, "exactly one death bag exists after two deaths (%d)" % bags.size())
	# Recovery while the death is still pending is a refusal, not a silent success.
	_expect(not bool(service.call(&"recover_death_bag", bag_id)),
		"recovery is refused while the death is still pending")
	var finished := bool(service.call(&"finish_overworld_death", hero.global_position))
	_note("finish_overworld_death -> %s" % str(finished))
	_expect(finished, "finishing the death clears the pending state in one commit")
	# The physical bag node: the world creates it from the documented bag record.
	var bag_nodes: Array[Node] = []
	for i in 3:
		await process_frame
	for node: Node in mounted.get_tree().get_nodes_in_group(&"survival_death_bag"):
		bag_nodes.append(node)
	_note("physical death-bag nodes in the world: %d" % bag_nodes.size())
	if bag_nodes.is_empty():
		_missing("a physical death bag the player can click",
			"no node in the survival_death_bag group after a committed death")
		# Fall back to the service so the recovery rule itself is still measured.
		_expect(bool(service.call(&"recover_death_bag", bag_id)),
			"the service can still recover the bag by id")
		return
	var bag: Node2D = bag_nodes[0] as Node2D
	_expect(bag.global_position.distance_to(hero.global_position) <= 44.0,
		"the bag lies within the product's own 44 px reach at the death spot (%.0f px)"
		% bag.global_position.distance_to(hero.global_position))
	var interacted := bool(bag.call(&"interact", hero))
	await process_frame
	var restored := _count_item("oak_wood")
	_note("bag.interact -> %s; oak back to %d" % [str(interacted), restored])
	_expect(interacted, "the physical bag accepts the player's interaction")
	_expect(restored >= bag_before,
		"recovering the bag returns the dropped stack to the bag (%d -> %d)" % [bag_before, restored])
	var after: Dictionary = (service.call(&"document") as Dictionary).get("death_bags", {}) as Dictionary
	_expect(not after.has(bag_id), "the recovered bag is removed from the durable record")
