extends SceneTree

const TEST_SAVE_PATH := "user://tests/realtime_loot_test.json"
const REPORT_PATH := "res://.artifacts/realtime_loot_report.json"
const RARITY_RULES := preload("res://game/loot/loot_rarity_rules.gd")
const LOOT_CATALOG := preload("res://game/loot/loot_catalog.gd")
const COMPLEXITY_RULES := preload(
	"res://game/meta/progression/complexity_progression_rules.gd"
)
const AUXILIARY_DEFINITIONS := preload(
	"res://game/meta/equipment/auxiliary_equipment_definitions.gd"
)
const HERO_SOUL_COMBAT_AFFIXES := preload(
	"res://game/meta/hero_souls/hero_soul_combat_affixes.gd"
)
const ARCHER_SOUL_ASSETS := preload("res://game/loot/archer_soul_asset_catalog.gd")
const AUXILIARY_PRESENTATION := preload(
	"res://game/meta/equipment/auxiliary_equipment_presentation.gd"
)
const HERO_SOUL_RULES := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const RARITY_PALETTE := preload("res://game/ui/rarity_palette.gd")
const ENEMY_RARITY_PRESENTATION := preload(
	"res://game/characters/enemies/enemy_rarity_presentation.gd"
)
const GROUND_LOOT_SCENE := preload("res://game/loot/ground_loot.tscn")
const AUDIO_ROUTER := preload("res://game/feedback/combat_audio_router.gd")
const ICON_MATERIAL := "res://assets/ui/loot/soul_ember.png"
const CUTOUT_ICON_PATHS := [
	"res://assets/library/downloaded/rpg_icons_400/Icon152.png",
	"res://assets/library/downloaded/rpg_icons_400/Icon241.png",
	"res://assets/library/downloaded/rpg_icons_400/Icon321.png",
	"res://assets/ui/loot/hero_soul_sword.png",
	"res://assets/ui/loot/hero_soul_axe.png",
	ICON_MATERIAL,
]

class FakeBoss:
	extends Node2D
	signal died(enemy: Node)

	func kill() -> void:
		died.emit(self)


var _checks := 0
var _failures: Array[String] = []
var _picked_payloads: Array[Dictionary] = []


func _initialize() -> void:
	_run.call_deferred()


func _run() -> void:
	_test_rarity_rules()
	_test_progressive_loot_disclosure()
	_test_semantic_cutout_icons()
	await _test_realtime_ground_inventory()
	await _test_boss_and_chest_bursts()
	_finish()


func _test_rarity_rules() -> void:
	_expect(
		RARITY_RULES.roll_world_rarity(44101, &"normal")
		== RARITY_RULES.roll_world_rarity(44101, &"normal"),
		"rarity rolls are deterministic for the same seed"
	)
	_expect(RARITY_RULES.normalize(&"common") == &"normal", "legacy Common normalizes to Normal")
	_expect(RARITY_RULES.normalize(&"unknown") == &"normal", "unknown rarity fails closed")
	for seed: int in 200:
		var floored := RARITY_RULES.roll_drop_rarity(seed + 5000, &"epic")
		_expect(
			RARITY_RULES.rarity_index(floored) >= RARITY_RULES.rarity_index(&"epic"),
			"Epic source never drops below its readable rarity floor"
		)
	var easy_rare := 0
	var hard_rare := 0
	for seed: int in 6000:
		var easy := RARITY_RULES.roll_world_rarity(
			seed + 91000,
			&"normal",
			{"luck": 1.0, "rare_drop_chance": 1.0}
		)
		var hard := RARITY_RULES.roll_world_rarity(
			seed + 91000,
			&"normal",
			{"luck": 1.65, "rare_drop_chance": 1.9}
		)
		if RARITY_RULES.rarity_index(easy) >= 2:
			easy_rare += 1
		if RARITY_RULES.rarity_index(hard) >= 2:
			hard_rare += 1
	_expect(hard_rare > easy_rare, "Hard luck shifts the same spawn sample toward Rare+")
	_expect(
		RARITY_RULES.jackpot_chance(&"boss", &"legendary", {"luck": 1.5})
		> RARITY_RULES.jackpot_chance(&"enemy", &"normal", {"luck": 1.0}),
		"boss rarity and difficulty luck materially raise jackpot chance"
	)
	var previous_visual_scale := 0.0
	for rarity_id: String in RARITY_PALETTE.IDS:
		var visual_scale := ENEMY_RARITY_PRESENTATION.scale_multiplier_for(rarity_id)
		_expect(
			visual_scale > previous_visual_scale,
			"%s rarity has a strictly larger enemy silhouette step" % rarity_id,
		)
		previous_visual_scale = visual_scale
	var audio := AUDIO_ROUTER.new() as CombatAudioRouter
	audio.playback_enabled = false
	root.add_child(audio)
	for cue_id: StringName in [&"loot_land", &"loot_pickup", &"loot_jackpot"]:
		var paths := audio.get_cue_variant_paths(cue_id)
		_expect(not paths.is_empty(), "%s resolves an asset-backed audio profile" % cue_id)
		_expect(
			not paths.is_empty() and ResourceLoader.exists(paths[0]),
			"%s audio asset is imported and loadable" % cue_id
		)
	audio.queue_free()


func _test_progressive_loot_disclosure() -> void:
	var stage_one := COMPLEXITY_RULES.policy_for_stage(1)
	_expect(
		int(stage_one.get("complexity_tier", -1)) == 0
			and stage_one.get("rarity_cap") == &"normal"
			and stage_one.get("allowed_random_families") == PackedStringArray(["material"])
			and (stage_one.get("allowed_auxiliary_slots", PackedStringArray()) as PackedStringArray).is_empty()
			and not bool(stage_one.get("random_hero_soul_enabled", true))
			and stage_one.get("reason") == COMPLEXITY_RULES.REASON_STAGE_ONE,
		"stage 1 metadata declares the materials-only tier-zero lesson",
	)
	for stage_level: int in [2, 3]:
		var lesson := COMPLEXITY_RULES.policy_for_stage(stage_level)
		var lesson_affixes: Dictionary = lesson.get("allowed_auxiliary_affixes", {})
		_expect(
			int(lesson.get("complexity_tier", -1)) == 1
				and lesson.get("rarity_cap") == &"magic"
				and lesson.get("allowed_auxiliary_slots") == PackedStringArray(["soul_vessel"])
				and lesson_affixes.get("soul_vessel") \
					== PackedStringArray(["max_hp_percent", "barrier_capacity_percent"])
				and not bool(lesson.get("random_hero_soul_enabled", true))
				and lesson.get("reason") == COMPLEXITY_RULES.REASON_VESSEL_LESSON,
			"stage %d metadata declares only the simple Soul Vessel lesson" % stage_level,
		)
	_expect(
		COMPLEXITY_RULES.complexity_tier_for_stage(2) == 1
			and COMPLEXITY_RULES.rarity_cap_for_stage(3) == &"magic"
			and COMPLEXITY_RULES.allowed_slots_for_stage(3) \
				== PackedStringArray(["soul_vessel"])
			and COMPLEXITY_RULES.disclosure_reason_for_stage(3) \
				== COMPLEXITY_RULES.REASON_VESSEL_LESSON,
		"machine-readable tier, cap, slot, and reason helpers agree",
	)
	var invalid_stage := COMPLEXITY_RULES.policy_for_stage(0)
	_expect(
		not bool(invalid_stage.get("valid", true))
			and invalid_stage.get("rarity_cap") == &"normal"
			and invalid_stage.get("allowed_random_families") == PackedStringArray(["material"]),
		"invalid stages fail closed to the stage-one disclosure surface",
	)
	var profile_errors := COMPLEXITY_RULES.get_tier_profile_errors()
	_expect(
		profile_errors.is_empty(),
		"the data-driven 100-stage loot ladder validates: %s" % "; ".join(profile_errors),
	)
	var expected_profiles := [
		{"min": 1, "max": 1, "cap": &"normal"},
		{"min": 2, "max": 3, "cap": &"magic"},
		{"min": 4, "max": 5, "cap": &"rare"},
		{"min": 6, "max": 9, "cap": &"epic"},
		{"min": 10, "max": 20, "cap": &"legendary"},
		{"min": 21, "max": 40, "cap": &"crystal"},
		{"min": 41, "max": 70, "cap": &"mythic"},
		{"min": 71, "max": 100, "cap": &"eternal"},
	]
	var profile_table_exact := COMPLEXITY_RULES.TIER_PROFILES.size() \
		== expected_profiles.size()
	for profile_index: int in expected_profiles.size():
		var expected: Dictionary = expected_profiles[profile_index]
		var profile: Dictionary = COMPLEXITY_RULES.TIER_PROFILES[profile_index]
		profile_table_exact = profile_table_exact \
			and int(profile.get("tier", -1)) == profile_index \
			and int(profile.get("stage_min", 0)) == int(expected["min"]) \
			and int(profile.get("stage_max", 0)) == int(expected["max"]) \
			and profile.get("rarity_cap") == expected["cap"]
	_expect(
		profile_table_exact,
		"one canonical table owns all eight required stage ranges and rarity caps",
	)
	var caps_monotonic := true
	var previous_cap_index := -1
	for stage_level: int in range(1, 101):
		var cap_index := RARITY_RULES.rarity_index(
			COMPLEXITY_RULES.rarity_cap_for_stage(stage_level)
		)
		caps_monotonic = caps_monotonic and cap_index >= previous_cap_index
		previous_cap_index = cap_index
	_expect(caps_monotonic, "rarity caps are monotonic across every stage from 1 through 100")

	var tier_two_policy := COMPLEXITY_RULES.policy_for_stage(5, {"soul_hero": true})
	var tier_two_aux: Dictionary = tier_two_policy.get("allowed_auxiliary_affixes", {})
	_expect(
		tier_two_policy.get("rarity_cap") == &"rare"
			and tier_two_policy.get("allowed_auxiliary_slots") \
				== PackedStringArray(["soul_vessel", "soul_boots"])
			and tier_two_aux.get("soul_vessel") \
				== PackedStringArray(["max_hp_percent", "barrier_capacity_percent"])
			and tier_two_aux.get("soul_boots") == PackedStringArray(["movement_speed_percent", "dodge_chance_percent"])
			and tier_two_policy.get("allowed_hero_soul_affixes") \
				== PackedStringArray(["max_hp", "core_damage", "max_mana", "normal_attack_power"]),
		"tier 2 adds Boots and keeps auxiliary/Hero rolls to simple LIVE core stats",
	)
	var stage_six_policy := COMPLEXITY_RULES.policy_for_stage(6, {"soul_hero": true})
	var stage_six_aux: Dictionary = stage_six_policy.get("allowed_auxiliary_affixes", {})
	_expect(
		stage_six_policy.get("rarity_cap") == &"epic"
			and stage_six_policy.get("allowed_auxiliary_slots") \
				== PackedStringArray(["soul_vessel", "soul_boots"])
			and stage_six_aux.get("soul_vessel") \
				== AUXILIARY_DEFINITIONS.live_affix_ids("soul_vessel")
			and stage_six_aux.get("soul_boots") \
				== AUXILIARY_DEFINITIONS.live_affix_ids("soul_boots")
			and stage_six_policy.get("allowed_hero_soul_affixes") \
				== PackedStringArray(HERO_SOUL_COMBAT_AFFIXES.LIVE_AFFIX_IDS),
		"stage 6 expands existing Armor/Boots only to canonical LIVE effects",
	)
	var stage_seven_policy := COMPLEXITY_RULES.policy_for_stage(7, {"soul_hero": true})
	var stage_seven_aux: Dictionary = stage_seven_policy.get("allowed_auxiliary_affixes", {})
	_expect(
		stage_seven_policy.get("allowed_auxiliary_slots") \
			== PackedStringArray(["soul_vessel", "soul_boots", "soul_trace"])
			and stage_seven_aux.get("soul_trace") \
				== AUXILIARY_DEFINITIONS.live_affix_ids("soul_trace"),
		"stage 7 adds the Jewelry slot without changing the Epic complexity tier",
	)

	var stage_one_seed_safe := true
	for seed: int in range(10000, 12048):
		var payload := LOOT_CATALOG.build_payload(
			seed,
			&"eternal",
			100,
			&"boss",
			&"stage_one_seed_cap",
			_availability_for_stage(1),
		)
		var metadata: Dictionary = payload.get("complexity", {})
		stage_one_seed_safe = stage_one_seed_safe \
			and LOOT_CATALOG.is_valid_payload(payload) \
			and payload.get("rarity") == &"normal" \
			and payload.get("kind") == &"stackable" \
			and payload.get("inventory_kind") == &"material" \
			and int(metadata.get("complexity_tier", -1)) == 0
	_expect(
		stage_one_seed_safe,
		"2,048 adversarial seeds cannot bypass stage 1's Normal material-only cap",
	)

	for stage_level: int in [2, 3]:
		var sample_safe := true
		var saw_vessel := false
		var seen_affixes := {}
		var availability := _availability_for_stage(stage_level)
		for seed: int in range(20000, 22048):
			var payload := LOOT_CATALOG.build_payload(
				seed + stage_level * 100000,
				&"eternal",
				100,
				&"boss",
				&"vessel_lesson_seed_cap",
				availability,
			)
			var kind := StringName(payload.get("kind", &""))
			sample_safe = sample_safe \
				and LOOT_CATALOG.is_valid_payload(payload) \
				and RARITY_RULES.rarity_index(payload.get("rarity")) \
					<= RARITY_RULES.rarity_index(&"magic") \
				and kind in [&"stackable", &"auxiliary_equipment"]
			if kind != &"auxiliary_equipment":
				continue
			saw_vessel = true
			var item: Dictionary = payload.get("item", {})
			var affixes: Array = item.get("affixes", [])
			sample_safe = sample_safe \
				and item.get("slot") == "soul_vessel" \
				and affixes.size() == 1
			if affixes.size() == 1:
				var affix_id := String((affixes[0] as Dictionary).get("affix_id", ""))
				sample_safe = sample_safe and affix_id in [
					"max_hp_percent", "barrier_capacity_percent",
				]
				seen_affixes[affix_id] = true
		_expect(
			sample_safe and saw_vessel,
			"stage %d seeds stay at Magic and expose only Soul Vessel equipment" % stage_level,
		)
		_expect(
			seen_affixes.size() == 2
				and not seen_affixes.has("relay_shield")
				and not seen_affixes.has("health_regen"),
			"stage %d reaches exactly both simple LIVE affixes and no hidden rule" % stage_level,
		)

	var ladder_seed_safe := true
	var ladder_seed_count := 0
	var ladder_saw_auxiliary := false
	var ladder_saw_hero_soul := false
	for stage_level: int in range(1, 101):
		var ladder_availability := _availability_for_stage(
			stage_level,
			{"soul_hero": true},
		)
		var ladder_policy: Dictionary = ladder_availability["complexity_policy"]
		var allowed_slots: PackedStringArray = ladder_policy.get(
			"allowed_auxiliary_slots", PackedStringArray(),
		)
		var allowed_auxiliary_affixes: Dictionary = ladder_policy.get(
			"allowed_auxiliary_affixes", {},
		)
		var allowed_hero_affixes: PackedStringArray = ladder_policy.get(
			"allowed_hero_soul_affixes", PackedStringArray(),
		)
		for sample_index: int in 16:
			ladder_seed_count += 1
			var payload := LOOT_CATALOG.build_payload(
				700000 + stage_level * 100 + sample_index,
				&"eternal",
				100,
				&"boss",
				&"hundred_stage_ladder",
				ladder_availability,
			)
			ladder_seed_safe = ladder_seed_safe \
				and LOOT_CATALOG.is_valid_payload(payload) \
				and RARITY_RULES.rarity_index(payload.get("rarity")) \
					<= RARITY_RULES.rarity_index(ladder_policy.get("rarity_cap"))
			var kind := StringName(payload.get("kind", &""))
			if kind == &"auxiliary_equipment":
				ladder_saw_auxiliary = true
				var item: Dictionary = payload.get("item", {})
				var slot := String(item.get("slot", ""))
				var slot_allowed: Variant = allowed_auxiliary_affixes.get(
					slot,
					PackedStringArray(),
				)
				ladder_seed_safe = ladder_seed_safe \
					and allowed_slots.has(slot) \
					and (slot_allowed is PackedStringArray or slot_allowed is Array)
				for raw_affix: Variant in item.get("affixes", []):
					var affix_id := String((raw_affix as Dictionary).get("affix_id", "")) \
						if raw_affix is Dictionary else ""
					ladder_seed_safe = ladder_seed_safe \
						and affix_id in slot_allowed \
						and AUXILIARY_DEFINITIONS.live_affix_ids(slot).has(affix_id)
			elif kind == &"hero_soul":
				ladder_saw_hero_soul = true
				ladder_seed_safe = ladder_seed_safe and stage_level >= 5
				var soul: Dictionary = payload.get("item", {})
				for raw_affix: Variant in soul.get("affixes", []):
					var affix_id := String((raw_affix as Dictionary).get("affix_id", "")) \
						if raw_affix is Dictionary else ""
					ladder_seed_safe = ladder_seed_safe \
						and allowed_hero_affixes.has(affix_id) \
						and HERO_SOUL_COMBAT_AFFIXES.is_live_affix(affix_id)
	_expect(
		ladder_seed_count == 1600
			and ladder_seed_safe
			and ladder_saw_auxiliary
			and ladder_saw_hero_soul,
		"1,600 seeds across all 100 stages obey monotonic caps and LIVE-only affix intersections",
	)

	var tier_two_boots_seen := false
	for seed: int in range(810000, 812048):
		var payload := LOOT_CATALOG.build_payload(
			seed,
			&"magic",
			100,
			&"boss",
			&"tier_two_boots",
			_availability_for_stage(4),
		)
		if payload.get("kind") == &"auxiliary_equipment" \
				and String((payload.get("item", {}) as Dictionary).get("slot", "")) \
					== "soul_boots":
			tier_two_boots_seen = true
			break
	_expect(tier_two_boots_seen, "tier 2 can roll the newly introduced LIVE-only Boots")
	var late_auxiliary_payload := {}
	for seed: int in range(820000, 822048):
		var payload := LOOT_CATALOG.build_payload(
			seed,
			&"eternal",
			100,
			&"boss",
			&"late_live_auxiliary",
			_availability_for_stage(100),
		)
		if payload.get("kind") == &"auxiliary_equipment" \
				and String((payload.get("item", {}) as Dictionary).get("slot", "")) == "soul_trace":
			late_auxiliary_payload = payload
			break
	var late_item: Dictionary = late_auxiliary_payload.get("item", {})
	var late_affixes_live := not late_auxiliary_payload.is_empty()
	for raw_affix: Variant in late_item.get("affixes", []):
		late_affixes_live = late_affixes_live \
			and raw_affix is Dictionary \
			and AUXILIARY_DEFINITIONS.live_affix_ids("soul_trace").has(
				String((raw_affix as Dictionary).get("affix_id", ""))
			)
	_expect(
		late_affixes_live
			and late_auxiliary_payload.get("rarity") == &"eternal"
			and late_item.get("rarity") == "eternal"
			and late_item.get("slot") == "soul_trace",
		"an Eternal-cap Jewelry roll uses its complete five-affix LIVE pool without stepping down",
	)

	var early_or_unentitled_soul := false
	for gate: Dictionary in [
		{"stage": 4, "features": {"soul_hero": true}},
		{"stage": 5, "features": {}},
	]:
		for seed: int in range(30000, 32048):
			var payload := LOOT_CATALOG.build_payload(
				seed + int(gate["stage"]) * 100000,
				&"eternal",
				100,
				&"boss",
				&"hero_soul_gate",
				_availability_for_stage(int(gate["stage"]), gate["features"]),
			)
			if payload.get("kind") == &"hero_soul":
				early_or_unentitled_soul = true
				break
	_expect(
		not early_or_unentitled_soul,
		"random Hero Souls require both stage 5 and the authored Soul lesson entitlement",
	)
	var entitled_soul_seen := false
	for seed: int in range(40000, 42048):
		var payload := LOOT_CATALOG.build_payload(
			seed,
			&"eternal",
			100,
			&"boss",
			&"hero_soul_entitled",
			_availability_for_stage(5, {"soul_hero": true}),
		)
		if payload.get("kind") == &"hero_soul":
			entitled_soul_seen = true
			break
	_expect(entitled_soul_seen, "stage 5 plus the Soul lesson entitlement enables random Hero Souls")
	var archer_leaked_without_entitlement := false
	for seed: int in range(43000, 44024):
		var payload := LOOT_CATALOG.build_payload(
			seed,
			&"legendary",
			100,
			&"boss",
			&"archer_entitlement_gate",
			_availability_for_stage(10, {"soul_hero": true}),
		)
		if payload.get("kind") == &"hero_soul" \
				and String((payload.get("item", {}) as Dictionary).get("hero_id", "")) \
					== "archer_hero":
			archer_leaked_without_entitlement = true
			break
	_expect(
		not archer_leaked_without_entitlement,
		"generic loot never leaks Archer before its authored entitlement",
	)
	var archer_availability := _availability_for_stage(10, {"soul_hero": true})
	archer_availability["archer_hero_unlocked"] = true
	var archer_duplicate_payload := {}
	for seed: int in range(45000, 47048):
		var payload := LOOT_CATALOG.build_payload(
			seed,
			&"legendary",
			100,
			&"boss",
			&"archer_duplicate",
			archer_availability,
		)
		if payload.get("kind") == &"hero_soul" \
				and String((payload.get("item", {}) as Dictionary).get("hero_id", "")) \
					== "archer_hero":
			archer_duplicate_payload = payload
			break
	var archer_duplicate_soul: Dictionary = archer_duplicate_payload.get("item", {})
	var archer_duplicate_live := not archer_duplicate_payload.is_empty()
	for raw_affix: Variant in archer_duplicate_soul.get("affixes", []):
		archer_duplicate_live = archer_duplicate_live \
			and raw_affix is Dictionary \
			and HERO_SOUL_COMBAT_AFFIXES.is_live_affix(
				String((raw_affix as Dictionary).get("affix_id", ""))
			)
	_expect(
		archer_duplicate_live
			and String(archer_duplicate_payload.get("icon_path", "")) \
				== ARCHER_SOUL_ASSETS.icon_path(
					int(archer_duplicate_soul.get("rarity", HERO_SOUL_RULES.Rarity.NORMAL))
				),
		"post-entitlement generic loot can roll a LIVE-affix Archer duplicate with its Bow asset",
	)

	var malformed := _availability_for_stage(3)
	var malformed_policy: Dictionary = (malformed["complexity_policy"] as Dictionary).duplicate(true)
	malformed_policy["rarity_cap"] = &"eternal"
	malformed["complexity_policy"] = malformed_policy
	var malformed_metadata := LOOT_CATALOG.availability_metadata(malformed)
	var malformed_safe: bool = not bool(malformed_metadata.get("valid", true)) \
		and malformed_metadata.get("rarity_cap") == &"normal"
	for seed: int in range(50000, 50512):
		var payload := LOOT_CATALOG.build_payload(
			seed,
			&"eternal",
			100,
			&"boss",
			&"malformed_policy",
			malformed,
		)
		malformed_safe = malformed_safe \
			and payload.get("rarity") == &"normal" \
			and payload.get("kind") == &"stackable" \
			and payload.get("inventory_kind") == &"material"
	_expect(malformed_safe, "tampered availability metadata fails closed for every sampled seed")
	var hero_affix_tamper := _availability_for_stage(6, {"soul_hero": true})
	var hero_affix_tamper_policy: Dictionary = (
		hero_affix_tamper["complexity_policy"] as Dictionary
	).duplicate(true)
	var tampered_hero_ids := PackedStringArray(hero_affix_tamper_policy.get(
		"allowed_hero_soul_affixes",
		PackedStringArray(),
	))
	tampered_hero_ids.append("crit_chance")
	hero_affix_tamper_policy["allowed_hero_soul_affixes"] = tampered_hero_ids
	hero_affix_tamper["complexity_policy"] = hero_affix_tamper_policy
	var hero_affix_tamper_metadata := LOOT_CATALOG.availability_metadata(hero_affix_tamper)
	_expect(
		not bool(hero_affix_tamper_metadata.get("valid", true))
			and hero_affix_tamper_metadata.get("rarity_cap") == &"normal"
			and (hero_affix_tamper_metadata.get(
				"allowed_hero_soul_affixes",
				PackedStringArray(),
			) as PackedStringArray).is_empty(),
		"allowed_hero_soul_affixes is canonical, tamper-checked, and fails closed",
	)

	var legacy_high_rarity := true
	var legacy_hero_seen := false
	var legacy_later_slot_seen := false
	for seed: int in range(60000, 64096):
		var payload := LOOT_CATALOG.build_payload(
			seed, &"eternal", 100, &"boss", &"legacy_unrestricted",
		)
		legacy_high_rarity = legacy_high_rarity and payload.get("rarity") == &"eternal"
		legacy_hero_seen = legacy_hero_seen or payload.get("kind") == &"hero_soul"
		if payload.get("kind") == &"auxiliary_equipment":
			legacy_later_slot_seen = legacy_later_slot_seen or String(
				(payload.get("item", {}) as Dictionary).get("slot", "")
			) in ["soul_boots", "soul_trace"]
		if legacy_hero_seen and legacy_later_slot_seen:
			break
	_expect(
		legacy_high_rarity and legacy_hero_seen and legacy_later_slot_seen,
		"direct catalog calls without availability retain legacy unrestricted behaviour",
	)


func _test_semantic_cutout_icons() -> void:
	for icon_path: String in CUTOUT_ICON_PATHS:
		var texture := load(icon_path) as Texture2D
		_expect(texture != null, "%s is an imported runtime equipment icon" % icon_path)
		var image := texture.get_image() if texture != null else null
		_expect(
			image != null and image.get_pixel(0, 0).a <= 0.05,
			"%s is a transparent cutout, leaving its slot/rarity aura to own the frame" % icon_path,
		)

	var expected_slots := {
		"soul_vessel": {
			"family": "armor",
			"primary": "max_hp_flat",
		},
		"soul_boots": {
			"family": "boots",
			"primary": "movement_speed",
		},
		"soul_trace": {
			"family": "ring_or_chain",
			"primary": "damage_flat",
		},
	}
	var seen_slots := {}
	var seen_heroes := {}
	for seed: int in range(1000, 9000):
		var payload := LOOT_CATALOG.build_payload(seed, &"rare", 8, &"chest", &"semantic_test")
		var item: Dictionary = payload.get("item", {})
		if payload.get("kind") == &"auxiliary_equipment":
			var slot := String(item.get("slot", ""))
			if expected_slots.has(slot):
				seen_slots[slot] = payload
		elif payload.get("kind") == &"hero_soul":
			seen_heroes[String(item.get("hero_id", ""))] = payload
		if seen_slots.size() == 3 and seen_heroes.has("sword_hero"):
			break
	for slot: String in expected_slots:
		var payload: Dictionary = seen_slots.get(slot, {})
		var expected: Dictionary = expected_slots[slot]
		var item: Dictionary = payload.get("item", {})
		var primary: Dictionary = item.get("primary", {})
		var presentation: Dictionary = AUXILIARY_PRESENTATION.presentation_for(item)
		var icon_path := String(payload.get("icon_path", ""))
		var icon_texture := load(icon_path) as Texture2D
		var icon_image := icon_texture.get_image() if icon_texture != null else null
		_expect(
			String(payload.get("display_name", "")) == String(presentation.get("display_name", ""))
				and icon_path == String(presentation.get("icon_path", ""))
				and String(payload.get("item_family", "")) == String(expected["family"])
				and String(primary.get("stat_id", "")) == String(expected["primary"]),
			"%s name, cutout silhouette and primary function agree" % slot,
		)
		_expect(
			icon_image != null and icon_image.get_pixel(0, 0).a <= 0.05,
			"%s uses a transparent asset cutout without a baked UI panel" % slot,
		)
	_expect(
		String((seen_heroes.get("sword_hero", {}) as Dictionary).get("icon_path", "")).ends_with("hero_soul_sword.png"),
		"Sword Hero Soul uses a sword-equipment silhouette",
	)
	_expect(not seen_heroes.has("axe_hero"), "fresh-profile generic loot cannot leak the postponed Axe Hero Soul")
	var unlocked_axe_payload := {}
	for seed: int in range(1000, 9000):
		var payload := LOOT_CATALOG.build_payload(
			seed,
			&"rare",
			8,
			&"boss",
			&"semantic_test_unlocked",
			{"axe_hero_unlocked": true},
		)
		if payload.get("kind") == &"hero_soul" \
				and String((payload.get("item", {}) as Dictionary).get("hero_id", "")) == "axe_hero":
			unlocked_axe_payload = payload
			break
	_expect(
		String(unlocked_axe_payload.get("icon_path", "")).ends_with("hero_soul_axe.png"),
		"after its authored entitlement, Axe re-enters generic drops with the axe-equipment silhouette",
	)

	var allowed_slots_by_level := {
		1: [],
		2: ["soul_vessel"],
		4: ["soul_vessel", "soul_boots"],
		7: ["soul_vessel", "soul_boots", "soul_trace"],
	}
	for item_level: int in allowed_slots_by_level:
		var allowed: Array = allowed_slots_by_level[item_level]
		var seen_level_slots := {}
		var all_payloads_valid := true
		for seed: int in range(9000, 9800):
			var payload := LOOT_CATALOG.build_payload(
				seed + item_level * 10000,
				&"rare",
				item_level,
				&"chest",
				&"level_gate_test",
			)
			all_payloads_valid = all_payloads_valid and LOOT_CATALOG.is_valid_payload(payload)
			if payload.get("kind") == &"auxiliary_equipment":
				seen_level_slots[String((payload.get("item", {}) as Dictionary).get("slot", ""))] = true
		_expect(all_payloads_valid, "level %d loot rolls never disappear behind a locked slot" % item_level)
		_expect(
			seen_level_slots.keys().all(func(slot: Variant) -> bool: return slot in allowed),
			"level %d equipment rolls contain only currently unlocked slots" % item_level,
		)
		if item_level >= 2:
			_expect(
				seen_level_slots.size() == allowed.size(),
				"level %d deterministic sample can reach every unlocked equipment family" % item_level,
			)


func _test_realtime_ground_inventory() -> void:
	var save := root.get_node_or_null("SaveService") as LivingArsenalSaveService
	var events := root.get_node_or_null("GameEvents")
	var director := root.get_node_or_null("LootDirector")
	_expect(save != null, "SaveService autoload exists")
	_expect(events != null, "GameEvents autoload exists")
	_expect(director != null, "LootDirector autoload exists")
	if save == null or events == null or director == null:
		return
	var session := root.get_node_or_null("GameSession")
	if session != null:
		session.set("active_stage_level", 1)
	_remove_generations(TEST_SAVE_PATH)
	_expect(save.configure_storage(TEST_SAVE_PATH, true), "isolated realtime-loot profile loads")
	var fresh_availability: Dictionary = director.call(&"_loot_availability")
	var fresh_policy: Dictionary = fresh_availability.get("complexity_policy", {})
	_expect(
		int(fresh_availability.get("active_stage_level", 0)) == 1
			and fresh_availability.get("feature_state") is Dictionary
			and int(fresh_policy.get("complexity_tier", -1)) == 0
			and fresh_policy.get("rarity_cap") == &"normal"
			and not bool(fresh_availability.get("axe_hero_unlocked", true))
			and not bool(fresh_availability.get("archer_hero_unlocked", true)),
		"LootDirector passes the active stage, feature state, and fresh-profile tier-zero policy",
	)
	if session != null:
		session.set("active_stage_level", 3)
		var stage_three_availability: Dictionary = director.call(&"_loot_availability")
		var stage_three_policy: Dictionary = stage_three_availability.get(
			"complexity_policy",
			{},
		)
		_expect(
			int(stage_three_availability.get("active_stage_level", 0)) == 3
				and int(stage_three_policy.get("complexity_tier", -1)) == 1
				and stage_three_policy.get("rarity_cap") == &"magic",
			"LootDirector derives policy from the live stage instead of a hard-coded tier",
		)
		session.set("active_stage_level", 1)
	events.loot_picked_up.connect(_on_loot_picked_up)
	director.call(&"set_seed_for_tests", 778899)

	var world := Node2D.new()
	world.name = "LootTestWorld"
	root.add_child(world)
	var player := CharacterBody2D.new()
	player.name = "LootTestPlayer"
	player.add_to_group(&"player")
	world.add_child(player)
	player.global_position = Vector2(120.0, 90.0)

	var stack_payload := {
		"loot_id": "realtime_stack_001",
		"kind": &"stackable",
		"family": &"material",
		"display_name": "Tinh Chất Linh Hồn",
		"icon_path": ICON_MATERIAL,
		"item_id": &"soul_ember",
		"inventory_kind": &"material",
		"quantity": 4,
		"rarity": &"rare",
		"item_level": 1,
		"source": &"enemy",
		"source_id": &"test_enemy",
	}
	var revision_before := int(save.get_value(["revision"], -1))
	var loot := await _land_payload(world, player.global_position, stack_payload)
	_expect(
		loot != null and bool(loot.get_focus_payload().get("auto_pickup", false))
			and not loot.is_in_group(&"player_interactable"),
		"physical loot advertises auto-pickup without an obsolete E interaction",
	)
	await create_timer(0.62).timeout
	var stack: Dictionary = save.get_value(["inventory", "item_stacks", "soul_ember"], {})
	_expect(int(stack.get("quantity", 0)) == 4, "magnet pickup updates the in-run inventory immediately")
	_expect(
		String(stack.get("display_name", "")) == "Tinh Chất Linh Hồn"
			and String(stack.get("icon_path", "")) == ICON_MATERIAL
			and String(stack.get("rarity", "")) == "rare",
		"live bag preserves the physical stack's readable name, cutout icon and rarity",
	)
	_expect(int(save.get_value(["revision"], -1)) == revision_before + 1, "pickup is one durable SaveService commit")
	_expect(_picked_payloads.size() == 1, "pickup event emits only after the inventory commit")
	await create_timer(0.22).timeout

	var duplicate := await _land_payload(world, player.global_position, stack_payload)
	await create_timer(0.62).timeout
	_expect(not is_instance_valid(duplicate) or duplicate.is_queued_for_deletion(), "duplicate world visual retires after reading the durable receipt")
	# The receipt prevents double payment and no second success event is emitted.
	_expect(int(save.get_value(["inventory", "item_stacks", "soul_ember", "quantity"], 0)) == 4, "receipt prevents duplicate inventory payment")
	_expect(_picked_payloads.size() == 1, "idempotent duplicate retirement emits no pickup success event")

	var legendary_stack_payload := stack_payload.duplicate(true)
	legendary_stack_payload["loot_id"] = "realtime_stack_legendary_002"
	legendary_stack_payload["quantity"] = 2
	legendary_stack_payload["rarity"] = &"legendary"
	legendary_stack_payload["item_level"] = 7
	var legendary_stack := await _land_payload(world, player.global_position, legendary_stack_payload)
	_expect(legendary_stack != null, "a rarer physical copy lands inside the magnet radius")
	await create_timer(0.62).timeout
	var merged_stack: Dictionary = save.get_value(["inventory", "item_stacks", "soul_ember"], {})
	_expect(
		int(merged_stack.get("quantity", 0)) == 6
			and String(merged_stack.get("rarity", "")) == "legendary"
			and int(merged_stack.get("item_level", 0)) == 7,
		"stack merge preserves total quantity and upgrades presentation to its strongest rarity/level",
	)

	var family_payloads := _find_family_payloads()
	for family_kind: StringName in [&"auxiliary_equipment", &"hero_soul"]:
		var payload: Dictionary = family_payloads.get(family_kind, {})
		_expect(not payload.is_empty(), "catalog can roll %s ground loot" % family_kind)
		if payload.is_empty():
			continue
		var family_loot := await _land_payload(world, player.global_position, payload)
		_expect(family_loot != null, "%s creates a physical auto-pickup" % family_kind)
		await create_timer(0.62).timeout
	_expect(
		(save.get_value(["inventory", "auxiliary_equipment"], []) as Array).size() == 1,
		"equipment drop enters the realtime tủ đồ"
	)
	_expect(
		(save.get_value(["inventory", "hero_souls"], []) as Array).size() == 2,
		"Hero Soul drop enters inventory beside the starter Soul"
	)
	var authored_axe := HERO_SOUL_RULES.create_instance(
		&"axe_hero",
		HERO_SOUL_RULES.Rarity.MAGIC,
		15,
		&"authored_axe_pickup_test",
		150015,
		HERO_SOUL_RULES.AFFINITY_WARRIOR,
	)
	_expect(
		bool(save.call(&"grant_hero_soul", authored_axe, "test:authored_axe_entitlement")),
		"the authored Axe pickup commits its durable Hero entitlement",
	)
	var axe_availability: Dictionary = director.call(&"_loot_availability")
	_expect(
		bool(axe_availability.get("axe_hero_unlocked", false))
			and not bool(
				(axe_availability.get("complexity_policy", {}) as Dictionary).get(
					"random_hero_soul_enabled",
					true,
				)
			),
		"Axe eligibility is passed separately while the stage-one lesson still blocks random Souls",
	)
	var authored_archer := HERO_SOUL_RULES.create_instance(
		&"archer_hero",
		HERO_SOUL_RULES.Rarity.NORMAL,
		5,
		&"authored_archer_pickup_test",
		150016,
		HERO_SOUL_RULES.AFFINITY_RANGER,
	)
	_expect(
		bool(save.call(
			&"grant_hero_soul",
			authored_archer,
			"test:authored_archer_entitlement",
		)),
		"the authored Archer pickup commits its durable Hero entitlement",
	)
	var archer_availability: Dictionary = director.call(&"_loot_availability")
	_expect(
		bool(archer_availability.get("archer_hero_unlocked", false)),
		"LootDirector passes Archer entitlement for later generic duplicate drops",
	)
	world.queue_free()
	await process_frame


func _test_boss_and_chest_bursts() -> void:
	var director := root.get_node_or_null("LootDirector")
	if director == null:
		return
	var world := Node2D.new()
	world.name = "BurstTestWorld"
	root.add_child(world)
	var boss := FakeBoss.new()
	boss.name = "TestBoss"
	var boss_sprite := AnimatedSprite2D.new()
	boss_sprite.name = "AnimatedSprite2D"
	boss_sprite.scale = Vector2.ONE
	boss.add_child(boss_sprite)
	boss.add_to_group(&"enemies")
	boss.add_to_group(&"bosses")
	world.add_child(boss)
	boss.global_position = Vector2(300.0, 180.0)
	await create_timer(0.08).timeout
	_expect(boss.has_meta(&"loot_rarity"), "boss receives a spawn-time rarity")
	_expect(
		RARITY_RULES.rarity_index(boss.get_meta(&"loot_rarity")) >= 3,
		"boss rarity has at least the Epic floor"
	)
	_expect(
		boss.get_node_or_null("LootRarityAura") == null
			and boss_sprite.material is ShaderMaterial
			and boss_sprite.scale.x > 1.0
			and StringName(boss.get_meta(&"enemy_rarity_presented", &"")) == &"epic"
			and (boss_sprite.material as ShaderMaterial).get_shader_parameter(&"rarity_color") \
				== RARITY_PALETTE.color(&"epic"),
		"boss rarity glows and scales its own silhouette without a circular rear aura",
	)
	var first_boss_scale := boss_sprite.scale
	director.call(&"configure_world_source", boss, &"enemy")
	_expect(
		boss_sprite.scale.is_equal_approx(first_boss_scale),
		"reconfiguring a live enemy repairs presentation without compounding its rarity scale",
	)
	boss.kill()
	await create_timer(0.06).timeout
	var boss_drops := _ground_loot_children(world)
	_expect(boss_drops.size() >= 3, "boss death bursts at least three physical drops")
	var all_boss_drops_follow_stage_one := true
	for loot: GroundLoot in boss_drops:
		var payload := loot.get_loot_payload()
		var metadata: Dictionary = payload.get("complexity", {})
		all_boss_drops_follow_stage_one = all_boss_drops_follow_stage_one \
			and payload.get("rarity") == &"normal" \
			and payload.get("kind") == &"stackable" \
			and payload.get("inventory_kind") == &"material" \
			and int(metadata.get("complexity_tier", -1)) == 0
	_expect(
		all_boss_drops_follow_stage_one,
		"Epic boss presentation survives while its stage-one random drops stay Normal materials",
	)

	var chest_scene := load("res://game/world/interactables/chest.tscn") as PackedScene
	var chest := chest_scene.instantiate() as Node2D
	chest.set("rarity_override", "legendary")
	world.add_child(chest)
	chest.global_position = Vector2(420.0, 180.0)
	await process_frame
	var forced_burst: Array = director.call(&"spawn_chest_burst", chest, true)
	_expect(forced_burst.size() >= 8, "forced chest jackpot visibly bursts a large loot fan")
	var all_chest_drops_follow_stage_one := true
	for loot: GroundLoot in forced_burst:
		var payload := loot.get_loot_payload()
		all_chest_drops_follow_stage_one = all_chest_drops_follow_stage_one \
			and payload.get("rarity") == &"normal" \
			and payload.get("kind") == &"stackable" \
			and payload.get("inventory_kind") == &"material"
	_expect(
		all_chest_drops_follow_stage_one,
		"Legendary chest seeds cannot bypass the stage-one material and rarity cap",
	)
	var chest_payload: Dictionary = chest.call(&"get_target_payload")
	_expect(chest_payload.get("rarity") == &"legendary", "chest target payload exposes its readable rarity")
	var drop_count_before_open := _ground_loot_children(world).size()
	chest.call(&"_open")
	await process_frame
	_expect(
		_ground_loot_children(world).size() >= drop_count_before_open + 3,
		"opening the real chest automatically spawns its physical reward burst"
	)
	world.queue_free()
	await process_frame


func _land_payload(world: Node2D, position: Vector2, payload: Dictionary) -> GroundLoot:
	var loot := GROUND_LOOT_SCENE.instantiate() as GroundLoot
	world.add_child(loot)
	if not loot.configure(payload):
		loot.queue_free()
		return null
	loot.launch_from(position, position, 0.12, 10.0)
	await create_timer(0.16).timeout
	return loot


func _find_family_payloads() -> Dictionary:
	var result := {}
	for seed: int in range(1000, 3000):
		var payload := LOOT_CATALOG.build_payload(seed, &"rare", 8, &"chest", &"test")
		var kind := StringName(payload.get("kind", &""))
		if kind in [&"auxiliary_equipment", &"hero_soul"] and not result.has(kind):
			result[kind] = payload
		if result.size() == 2:
			break
	return result


func _availability_for_stage(stage_level: int, features: Dictionary = {}) -> Dictionary:
	return {
		"active_stage_level": stage_level,
		"feature_state": features.duplicate(true),
		"complexity_policy": COMPLEXITY_RULES.policy_for_stage(stage_level, features),
	}


func _ground_loot_children(parent: Node) -> Array[GroundLoot]:
	var result: Array[GroundLoot] = []
	for child: Node in parent.get_children():
		if child is GroundLoot:
			result.append(child as GroundLoot)
	return result


func _on_loot_picked_up(payload: Dictionary) -> void:
	_picked_payloads.append(payload.duplicate(true))


func _remove_generations(path: String) -> void:
	for suffix: String in ["", ".bak", ".tmp", ".pre_v2.bak"]:
		var candidate := path + suffix
		if FileAccess.file_exists(candidate):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(candidate))


func _finish() -> void:
	_remove_generations(TEST_SAVE_PATH)
	var report := {
		"checks": _checks,
		"failures": _failures.duplicate(),
		"passed": _checks - _failures.size(),
	}
	var file := FileAccess.open(REPORT_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(report, "\t") + "\n")
	if _failures.is_empty():
		print("REALTIME LOOT TEST PASSED - %d checks" % _checks)
		quit(0)
		return
	for failure: String in _failures:
		push_error("FAIL  " + failure)
	print("REALTIME LOOT TEST FAILED - %d/%d checks failed" % [_failures.size(), _checks])
	quit(1)


func _expect(condition: bool, message: String) -> void:
	_checks += 1
	if not condition:
		_failures.append(message)
