class_name WizardSoulAssetCatalog
extends RefCounted

## Staff silhouettes for the physical Wizard Soul. Icon 79 is the canonical
## normal-drop silhouette selected for the Chapter 2 recruitment contract.
const ICON_PATHS := [
	"res://assets/library/downloaded/rpg_arsenal_1_1/Icons_no_background/staffs/rpg_icons79.png",
	"res://assets/library/downloaded/rpg_arsenal_1_1/Icons_no_background/staffs/rpg_icons78.png",
	"res://assets/library/downloaded/rpg_arsenal_1_1/Icons_no_background/staffs/rpg_icons80.png",
	"res://assets/library/downloaded/rpg_arsenal_1_1/Icons_no_background/staffs/rpg_icons77.png",
	"res://assets/library/downloaded/rpg_arsenal_1_1/Icons_no_background/staffs/rpg_icons81.png",
	"res://assets/library/downloaded/rpg_arsenal_1_1/Icons_no_background/staffs/rpg_icons76.png",
	"res://assets/library/downloaded/rpg_arsenal_1_1/Icons_no_background/staffs/rpg_icons82.png",
	"res://assets/library/downloaded/rpg_arsenal_1_1/Icons_no_background/staffs/rpg_icons75.png",
]


static func icon_path(rarity: Variant) -> String:
	return ICON_PATHS[clampi(int(rarity), 0, ICON_PATHS.size() - 1)]
