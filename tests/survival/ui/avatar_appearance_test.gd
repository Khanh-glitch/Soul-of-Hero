extends SceneTree

const ADAPTER := preload("res://game/survival/ui/avatar_appearance_adapter.gd")
const MANIFEST_PATH := "res://game/survival/ui/avatar_art_manifest.json"
var checks := 0
var failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		printerr("FAIL: ", message)


func _run() -> void:
	var manifest: Variant = JSON.parse_string(FileAccess.get_file_as_string(MANIFEST_PATH))
	_check(manifest is Dictionary, "load the A6 avatar source manifest")
	if not manifest is Dictionary:
		quit(1)
		return
	var characters: Dictionary = manifest.get("characters", {})
	var male: Dictionary = characters.get("male", {})
	var female: Dictionary = characters.get("female", {})
	_check(male.get("craftpix_id", "") == "555940", "canonical male is Craftpix 555940")
	_check(
		male.get("drive_file_id", "") == "1CuSQ3pr75U1l1Ep8FIDexQlMr8fO3qGb",
		"male source points to user-verified Drive file"
	)
	_check(female.get("craftpix_id", "") == "419402", "canonical female is Craftpix 419402")
	_check(
		female.get("drive_file_id", "") == "1o5hRVbPZjZxcPGwP5coPDHZARbAej75o",
		"female source points to user-verified Drive file"
	)
	_check(
		male.get("archive_md5", "") == "b4910c4dd86a5193e5e0640751a20abd"
		and male.get("archive_sha256", "") == "b5579a3cc6006ef8c9d55c9ca0388575d75c987382b6cb504e2c7519e6c1e795"
		and male.get("png_crc_failures", -1) == 0,
		"male archive bytes and inspected PNG integrity are recorded"
	)
	_check(
		female.get("archive_md5", "") == "cf6ffa60ef922e4703dc6b27c3b5bac2"
		and female.get("archive_sha256", "") == "f704e7852273d5f0111435ae86975fa981354d699dff1f594934f6a32d9821ad"
		and female.get("png_crc_failures", -1) == 0,
		"female archive bytes and inspected PNG integrity are recorded"
	)
	var license_review: Dictionary = manifest.get("license_review", {})
	_check(
		String(license_review.get("status", "")) == "VERIFIED_GAME_USE"
		and String(license_review.get("distribution_boundary", "")) == "PUBLIC_RAW_SOURCE_REDISTRIBUTION_NOT_APPROVED",
		"official Freebie terms support game use without approving public raw-art redistribution"
	)
	var unverified_runtime_candidate: Dictionary = manifest.duplicate(true)
	unverified_runtime_candidate.characters.male.armor_grades["0"].idle_sheet = MANIFEST_PATH
	var public_checkout_blocked := ADAPTER.resolve(_owner("male", 0), unverified_runtime_candidate)
	_check(
		public_checkout_blocked.status == "SOURCE_BLOCKED"
		and String(public_checkout_blocked.reason).contains("not installed"),
		"verified game-use terms do not pretend private runtime art exists in a public checkout"
	)
	_check(
		male.armor_grades["0"].idle_sheet == "" and female.armor_grades["0"].idle_sheet == "",
		"inspected source previews are not misrepresented as installed runtime art"
	)
	var male_dimensions: Variant = male.armor_grades["0"].get("dimensions", null)
	_check(
		male_dimensions is Array and male_dimensions.size() == 2 and int(male_dimensions[0]) == 768 and int(male_dimensions[1]) == 256,
		"male bald unarmored idle sheet dimensions are documented"
	)
	var female_dimensions: Variant = female.armor_grades["0"].get("dimensions", null)
	_check(
		female_dimensions is Array and female_dimensions.size() == 2 and int(female_dimensions[0]) == 768 and int(female_dimensions[1]) == 256,
		"female bald unarmored idle sheet dimensions are documented"
	)
	_check(
		male.armor_grades["0"].runtime_action_sheets == {} and female.armor_grades["0"].runtime_action_sheets == {},
		"license is verified, but identity-specific private runtime sheets remain unstaged in public Git"
	)
	_check(
		male.armor_grades["1"] == null and male.armor_grades["2"] == null,
		"male matching armor stages are not fabricated"
	)
	_check(
		female.armor_grades["1"] == null and female.armor_grades["2"] == null,
		"female matching armor stages are not fabricated"
	)
	_check(
		manifest.explicitly_rejected_substitutions[0].craftpix_id == "180537",
		"a different Swordsman identity is explicitly rejected as a fallback"
	)
	var blocked_male := ADAPTER.resolve(_owner("male", 0), manifest)
	var blocked_female := ADAPTER.resolve(_owner("female", 0), manifest)
	_check(
		blocked_male.status == "SOURCE_BLOCKED" and blocked_male.gender == "male",
		"missing installed male source fails closed without changing identity"
	)
	_check(
		blocked_female.status == "SOURCE_BLOCKED" and blocked_female.gender == "female",
		"missing installed female source fails closed without changing identity"
	)
	var unversioned_owner := _owner("male", 0)
	unversioned_owner.erase("revision")
	_check(
		ADAPTER.resolve(unversioned_owner, manifest).status == "SOURCE_BLOCKED",
		"avatar appearance requires a non-empty owner revision"
	)
	var male_grade_one := ADAPTER.resolve(_owner("male", 1), manifest)
	var female_grade_two := ADAPTER.resolve(_owner("female", 2), manifest)
	_check(
		male_grade_one.status == "SOURCE_BLOCKED" and male_grade_one.gender == "male",
		"male armor grade 1 does not fall back to another character"
	)
	_check(
		female_grade_two.status == "SOURCE_BLOCKED" and female_grade_two.gender == "female",
		"female armor grade 2 does not fall back to another character"
	)
	_check(
		ADAPTER.resolve(_owner("female", 3), manifest).status == "SOURCE_BLOCKED",
		"unsupported armor grades are rejected"
	)
	var forged := _owner("male", 1)
	forged.provenance = "FIXTURE_PROJECTION"
	_check(
		ADAPTER.resolve(forged, manifest).status == "SOURCE_BLOCKED",
		"fixture state cannot select a player avatar"
	)
	if failures.is_empty():
		print("A6 AVATAR SOURCE GATE PASSED - %d checks" % checks)
		quit(0)
	else:
		printerr("A6 AVATAR SOURCE GATE FAILED - %d/%d" % [failures.size(), checks])
		quit(1)


func _owner(gender: String, armor_grade: int) -> Dictionary:
	return {
		"schema": "soh.ui.avatar_appearance.v1",
		"provenance": "A0_OWNER_PROJECTION",
		"revision": "test-owner-save-1",
		"gender": gender,
		"armor_grade": armor_grade,
	}
