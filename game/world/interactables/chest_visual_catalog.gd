class_name ChestVisualCatalog
extends RefCounted

## Authoritative region/name mapping for Seliel the Shaper's Treasure Chests
## atlas. Each visual uses one closed 32x32 cell followed by its open cell.
## Visual grades are intentionally separate from the eight gameplay rarities:
## regular grade 9 is the Eternal jackpot presentation, not a ninth rarity.

const RARITY_PALETTE := preload("res://game/ui/rarity_palette.gd")
const ATLAS_PATH := (
	"res://assets/library/downloaded/treasure_chests_1_2a/treasure chests.png"
)
const ATLAS_TEXTURE: Texture2D = preload(
	"res://assets/library/downloaded/treasure_chests_1_2a/treasure chests.png"
)
const CELL_SIZE := Vector2i(32, 32)
const ATLAS_SIZE := Vector2i(160, 192)

const FAMILY_AUTO := &"auto"
const FAMILY_REGULAR := &"regular"
const FAMILY_MONSTER := &"monster"
const SPECIAL_JACKPOT := &"jackpot"

const REGULAR_ENTRIES: Array[Dictionary] = [
	{"id": &"ironclasp_chest", "display_name": "Rương Gỗ Khóa Sắt", "tier": 1,
		"rarity": &"normal", "column": 0, "pair_row": 0, "material": &"wood", "special": &""},
	{"id": &"steelbound_chest", "display_name": "Rương Thép Gia Cố", "tier": 2,
		"rarity": &"magic", "column": 0, "pair_row": 1, "material": &"metal", "special": &""},
	{"id": &"blood_iron_chest", "display_name": "Rương Huyết Thiết", "tier": 3,
		"rarity": &"rare", "column": 0, "pair_row": 2, "material": &"metal", "special": &""},
	{"id": &"azure_seal_chest", "display_name": "Rương Lam Ấn", "tier": 4,
		"rarity": &"epic", "column": 1, "pair_row": 0, "material": &"wood", "special": &""},
	{"id": &"ancient_silver_chest", "display_name": "Rương Cổ Ngân", "tier": 5,
		"rarity": &"legendary", "column": 1, "pair_row": 1, "material": &"metal", "special": &""},
	{"id": &"frost_crystal_chest", "display_name": "Rương Băng Tinh", "tier": 6,
		"rarity": &"crystal", "column": 1, "pair_row": 2, "material": &"crystal", "special": &""},
	{"id": &"jade_crown_chest", "display_name": "Rương Vương Miện Ngọc", "tier": 7,
		"rarity": &"mythic", "column": 2, "pair_row": 0, "material": &"relic", "special": &""},
	{"id": &"celestial_chest", "display_name": "Rương Thiên Quang", "tier": 8,
		"rarity": &"eternal", "column": 2, "pair_row": 1, "material": &"relic", "special": &""},
	{"id": &"eternal_grand_vault", "display_name": "Đại Bảo Khố Vĩnh Hằng", "tier": 9,
		"rarity": &"eternal", "column": 2, "pair_row": 2, "material": &"relic",
		"special": SPECIAL_JACKPOT},
]

const MONSTER_ENTRIES: Array[Dictionary] = [
	{"id": &"wraithbone_chest", "display_name": "Rương Oán Cốt", "tier": 1,
		"rarity": &"rare", "column": 3, "pair_row": 0, "material": &"bone", "special": &""},
	{"id": &"soulbone_chest", "display_name": "Rương Linh Cốt", "tier": 2,
		"rarity": &"epic", "column": 3, "pair_row": 1, "material": &"bone", "special": &""},
	{"id": &"deathbound_chest", "display_name": "Rương Tử Thần", "tier": 3,
		"rarity": &"legendary", "column": 3, "pair_row": 2, "material": &"bone", "special": &""},
	{"id": &"ironjaw_mimic", "display_name": "Mimic Hàm Thép", "tier": 4,
		"rarity": &"crystal", "column": 4, "pair_row": 0, "material": &"mimic", "special": &""},
	{"id": &"tomb_maw_mimic", "display_name": "Mimic Hàm Cổ Mộ", "tier": 5,
		"rarity": &"mythic", "column": 4, "pair_row": 1, "material": &"mimic", "special": &""},
	{"id": &"abyssal_mimic", "display_name": "Mimic Hắc Uyên", "tier": 6,
		"rarity": &"eternal", "column": 4, "pair_row": 2, "material": &"mimic", "special": &""},
]


static func resolve_family(configured_family: Variant, contains_sigil: bool) -> StringName:
	var normalized := StringName(String(configured_family).strip_edges().to_lower())
	if contains_sigil or normalized == FAMILY_MONSTER:
		return FAMILY_MONSTER
	return FAMILY_REGULAR


static func entry_for(
		rarity_value: Variant,
		family: Variant = FAMILY_REGULAR,
		jackpot := false,
) -> Dictionary:
	var resolved_family := resolve_family(family, false)
	var rarity_index := RARITY_PALETTE.index(rarity_value)
	if resolved_family == FAMILY_MONSTER:
		# Monster containers deliberately occupy the six upper core rarities.
		return MONSTER_ENTRIES[clampi(rarity_index - 2, 0, MONSTER_ENTRIES.size() - 1)] \
			.duplicate(true)
	if jackpot:
		return REGULAR_ENTRIES[REGULAR_ENTRIES.size() - 1].duplicate(true)
	return REGULAR_ENTRIES[clampi(rarity_index, 0, RARITY_PALETTE.IDS.size() - 1)] \
		.duplicate(true)


static func entry_for_tier(family: Variant, tier: int) -> Dictionary:
	var resolved_family := resolve_family(family, false)
	var entries := MONSTER_ENTRIES if resolved_family == FAMILY_MONSTER else REGULAR_ENTRIES
	return entries[clampi(tier - 1, 0, entries.size() - 1)].duplicate(true)


static func frame_region(entry: Dictionary, opened: bool) -> Rect2:
	var column := int(entry.get("column", 0))
	var pair_row := int(entry.get("pair_row", 0))
	var atlas_row := pair_row * 2 + (1 if opened else 0)
	return Rect2(
		Vector2(column * CELL_SIZE.x, atlas_row * CELL_SIZE.y),
		Vector2(CELL_SIZE),
	)


static func make_frame_texture(entry: Dictionary, opened: bool) -> AtlasTexture:
	var texture := AtlasTexture.new()
	texture.atlas = ATLAS_TEXTURE
	texture.region = frame_region(entry, opened)
	return texture


static func make_sprite_frames(entry: Dictionary) -> SpriteFrames:
	var frames := SpriteFrames.new()
	if frames.has_animation(&"default"):
		frames.remove_animation(&"default")
	var closed_texture := make_frame_texture(entry, false)
	var open_texture := make_frame_texture(entry, true)
	_add_animation(frames, &"closed", [closed_texture], 1.0, true)
	_add_animation(frames, &"opening", [closed_texture, open_texture], 7.0, false)
	_add_animation(frames, &"open", [open_texture], 1.0, true)
	return frames


static func get_catalog_errors() -> PackedStringArray:
	var errors := PackedStringArray()
	if not ResourceLoader.exists(ATLAS_PATH):
		errors.append("Treasure Chests atlas is missing: %s" % ATLAS_PATH)
	if REGULAR_ENTRIES.size() != 9:
		errors.append("Regular chest catalog must contain exactly nine visual grades.")
	if MONSTER_ENTRIES.size() != 6:
		errors.append("Monster chest catalog must contain exactly six visual grades.")
	_validate_entries(REGULAR_ENTRIES, FAMILY_REGULAR, errors)
	_validate_entries(MONSTER_ENTRIES, FAMILY_MONSTER, errors)
	return errors


static func _add_animation(
		frames: SpriteFrames,
		animation_name: StringName,
		textures: Array,
		fps: float,
		looped: bool,
) -> void:
	frames.add_animation(animation_name)
	frames.set_animation_speed(animation_name, fps)
	frames.set_animation_loop(animation_name, looped)
	for texture: Texture2D in textures:
		frames.add_frame(animation_name, texture)


static func _validate_entries(
		entries: Array[Dictionary],
		family: StringName,
		errors: PackedStringArray,
) -> void:
	var ids := {}
	for index: int in entries.size():
		var entry := entries[index]
		var id := StringName(entry.get("id", &""))
		if id.is_empty() or ids.has(id):
			errors.append("%s chest entry %d has a missing or duplicate id." % [family, index])
		ids[id] = true
		if int(entry.get("tier", 0)) != index + 1:
			errors.append("%s chest tiers must be contiguous and one-based." % family)
		var rarity := String(entry.get("rarity", ""))
		if rarity not in RARITY_PALETTE.IDS:
			errors.append("%s chest '%s' uses unsupported rarity '%s'." % [family, id, rarity])
		for opened: bool in [false, true]:
			var region := frame_region(entry, opened)
			if region.position.x < 0.0 or region.position.y < 0.0 \
					or region.end.x > ATLAS_SIZE.x or region.end.y > ATLAS_SIZE.y:
				errors.append("%s chest '%s' points outside the atlas." % [family, id])
