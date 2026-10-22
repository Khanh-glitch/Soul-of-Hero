class_name LootAssetCatalog
extends RefCounted

## Authored cutout assets used by runtime loot. Keeping these semantic paths in
## one place prevents a staff or Hero Soul from silently sharing the
## wrong silhouette just because they occupy the same inventory grid.
const WIZARD_HERO_SOUL_ICON_PATH := (
	"res://assets/library/downloaded/rpg_arsenal_1_1/Icons_no_background/staffs/rpg_icons79.png"
)
# Backward-compatible name for authored data and saves that used the original
# Mage label before the hero was renamed to Wizard.
const MAGE_HERO_SOUL_ICON_PATH := WIZARD_HERO_SOUL_ICON_PATH


static func hero_soul_icon_path(hero_id: StringName, entitlements: Dictionary = {}) -> String:
	var canonical_id := &"wizard_hero" if hero_id == &"mage_hero" else hero_id
	if canonical_id != &"wizard_hero":
		return ""
	# Defining Wizard assets never grants the identity.  Runtime loot can expose
	# this icon only after the future Level 20 reward has set the entitlement.
	var unlocked := bool(entitlements.get("wizard_hero_unlocked", false)) \
		or bool(entitlements.get("mage_hero_unlocked", false))
	if not unlocked:
		return ""
	return WIZARD_HERO_SOUL_ICON_PATH
