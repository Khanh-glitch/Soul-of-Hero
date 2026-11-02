class_name HeroTeamQuickLook
extends RefCounted

## Read-only projection for the fixed active/reserve Hero pair. The save owns
## exact item selections; catalog presence alone never implies ownership/equip.
## No SaveService, scene, campaign or autoload dependency.

const SOULS := preload("res://game/meta/hero_souls/hero_soul_rules.gd")
const AUX := preload("res://game/meta/equipment/auxiliary_equipment_definitions.gd")
const AUX_PRESENTATION := preload("res://game/meta/equipment/auxiliary_equipment_presentation.gd")
const HERO_DEFINITIONS := {
	"sword_hero": preload("res://game/heroes/data/sword_hero.tres"),
	"archer_hero": preload("res://game/heroes/data/archer_hero.tres"),
	"axe_hero": preload("res://game/heroes/data/axe_hero.tres"),
	"wizard_hero": preload("res://game/heroes/data/wizard_hero.tres"),
}
const AUX_LOADOUT_KEYS := {
	"soul_vessel": "armor",
	"soul_boots": "boots",
	"soul_trace": "jewelry",
}


static func summarize(save_snapshot: Dictionary, hero_id: String, role: String) -> Dictionary:
	if hero_id.is_empty():
		return {
			"hero": "%s • TRỐNG" % role,
			"gear": "Chọn Hero Weapon để lập cặp chiến đấu.",
		}
	var hero: HeroDefinition = HERO_DEFINITIONS.get(hero_id) as HeroDefinition
	if hero == null:
		return {"hero": "%s • KHÔNG RÕ HERO" % role, "gear": "—"}
	var team_value: Variant = save_snapshot.get("soul_team", {})
	var team: Dictionary = team_value if team_value is Dictionary else {}
	var selected_value: Variant = team.get("selected_soul_instances", {})
	var selections: Dictionary = selected_value if selected_value is Dictionary else {}
	var inventory_value: Variant = save_snapshot.get("inventory", {})
	var inventory: Dictionary = inventory_value if inventory_value is Dictionary else {}
	var soul_value: Variant = inventory.get("hero_souls", [])
	var souls: Array = soul_value if soul_value is Array else []
	var selected_id := String(selections.get(hero_id, ""))
	var selected_soul := _find_soul(souls, selected_id, hero_id)
	var weapon_copy := "SOUL CHƯA GẮN"
	if not selected_soul.is_empty():
		var rarity := clampi(int(selected_soul.get("rarity", 0)), 0, 7)
		weapon_copy = "%s L%d" % [
			SOULS.rarity_display_name_vi(rarity).to_upper(),
			int(selected_soul.get("item_level", 1)),
		]
	var loadouts_value: Variant = save_snapshot.get("hero_loadouts", {})
	var loadouts: Dictionary = loadouts_value if loadouts_value is Dictionary else {}
	var loadout_value: Variant = loadouts.get(hero_id, {})
	var loadout: Dictionary = loadout_value if loadout_value is Dictionary else {}
	var gear_value: Variant = inventory.get(
		"auxiliary_equipment", inventory.get("auxiliary_items", [])
	)
	var gear: Array = gear_value if gear_value is Array else []
	var statuses: Array[String] = []
	for slot_id: String in AUX.SLOT_IDS:
		var equipped_uuid := String(loadout.get(AUX_LOADOUT_KEYS[slot_id], ""))
		var equipped := false
		if not equipped_uuid.is_empty():
			for raw_item: Variant in gear:
				if raw_item is Dictionary:
					var item := raw_item as Dictionary
					if String(item.get("uuid", "")) == equipped_uuid \
							and String(item.get("slot", "")) == slot_id:
						equipped = true
						break
		statuses.append("%s %s" % [
			AUX_PRESENTATION.slot_display_name(slot_id).to_upper(),
			"✓" if equipped else "—",
		])
	return {
		"hero": "%s • %s • %s" % [role, hero.display_name.to_upper(), weapon_copy],
		"gear": "  |  ".join(PackedStringArray(statuses)),
	}


static func _find_soul(souls: Array, instance_id: String, hero_id: String) -> Dictionary:
	if instance_id.is_empty():
		return {}
	for raw: Variant in souls:
		if raw is Dictionary:
			var soul := raw as Dictionary
			if String(soul.get("instance_id", "")) == instance_id \
					and String(soul.get("hero_id", "")) == hero_id:
				return soul
	return {}
