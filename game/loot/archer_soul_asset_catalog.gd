class_name ArcherSoulAssetCatalog
extends RefCounted

## Curated Bow silhouettes for the physical Archer Soul and its inventory tile.
## The source pack is intentionally kept outside runtime import; only these
## eight selected transparent icons are shipped with the game.
const ICON_PATHS := [
	"res://assets/ui/loot/archer_soul/bow_normal.png",
	"res://assets/ui/loot/archer_soul/bow_magic.png",
	"res://assets/ui/loot/archer_soul/bow_rare.png",
	"res://assets/ui/loot/archer_soul/bow_epic.png",
	"res://assets/ui/loot/archer_soul/bow_legendary.png",
	"res://assets/ui/loot/archer_soul/bow_crystal.png",
	"res://assets/ui/loot/archer_soul/bow_mythic.png",
	"res://assets/ui/loot/archer_soul/bow_eternal.png",
]
const ICONS := [
	preload("res://assets/ui/loot/archer_soul/bow_normal.png"),
	preload("res://assets/ui/loot/archer_soul/bow_magic.png"),
	preload("res://assets/ui/loot/archer_soul/bow_rare.png"),
	preload("res://assets/ui/loot/archer_soul/bow_epic.png"),
	preload("res://assets/ui/loot/archer_soul/bow_legendary.png"),
	preload("res://assets/ui/loot/archer_soul/bow_crystal.png"),
	preload("res://assets/ui/loot/archer_soul/bow_mythic.png"),
	preload("res://assets/ui/loot/archer_soul/bow_eternal.png"),
]
const RARITY_IDS := [
	"normal", "magic", "rare", "epic", "legendary", "crystal", "mythic", "eternal",
]


static func icon_path(rarity: Variant) -> String:
	return ICON_PATHS[_rarity_index(rarity)]


static func icon(rarity: Variant) -> Texture2D:
	return ICONS[_rarity_index(rarity)] as Texture2D


static func _rarity_index(rarity: Variant) -> int:
	if rarity is int or rarity is float:
		return clampi(int(rarity), 0, ICON_PATHS.size() - 1)
	var normalized := String(rarity).strip_edges().to_lower().replace(" ", "_")
	if normalized == "common":
		normalized = "normal"
	elif normalized == "uncommon":
		normalized = "magic"
	return maxi(0, RARITY_IDS.find(normalized))
