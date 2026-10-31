#!/usr/bin/env bash
# Fetch the licensed interface-art source packs from their Git refs.
#
#   tools/fetch_a6_ui_sources.sh <output-directory>
#
# Same transport as tools/fetch_a6_avatar_sources.sh: a blobless, depth-1 fetch of
# an immutable commit, then blob-id / byte-length / ZIP-magic / SHA-256 checks. The
# packs live on the creator's asset repository, one pack family per branch.
#
# Output stays outside the repository. tools/import_a6_ui_art.py reads the ZIPs and
# writes only the specific crops the UI binds to, with a provenance receipt.
set -uo pipefail

OUT="${1:-}"
if [ -z "$OUT" ]; then
	echo "usage: $0 <output-directory>" >&2
	exit 2
fi

REPO_SLUG="${A6_ASSET_REPO:-Khanh-glitch/APEX-CHAOS}"
TOKEN="${A6_ASSET_TOKEN:-}"
if [ -n "$TOKEN" ]; then
	REMOTE="https://x-access-token:${TOKEN}@github.com/${REPO_SLUG}.git"
else
	REMOTE="https://github.com/${REPO_SLUG}.git"
fi

# pack id | commit | path | sha256 (blob id and size are asserted from the tree)
PINS=(
	"255216|bf11a0cecfda43beca510062bd5d9dc1a8573cc5|craftpix-net-255216-free-basic-pixel-art-ui-for-rpg.zip|91f20fe9d45c84006c12f5ef0364fee0addc03406c0a1d49068fd78cb9ccbd16"
	"994534|a960f0945b36614c9754d8dbf2d3e6ec367d449f|craftpix-net-994534-free-basic-pixel-art-fantasy-icons-16x16-for-ui.zip|076cac89a70746d3cd3b59bbb0652b88047bd06bddb952b2a5cf0959cfaed660"
)

mkdir -p "$OUT" || exit 2
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
git init -q --bare "$WORK/source.git" || exit 2
git -C "$WORK/source.git" remote add origin "$REMOTE" || exit 2

failures=0
for pin in "${PINS[@]}"; do
	IFS='|' read -r pack commit path _sha <<<"$pin"
	target="$OUT/${pack}.zip"
	if ! git -C "$WORK/source.git" fetch -q --depth 1 --filter=blob:none origin "$commit" 2>"$WORK/fetch.err"; then
		echo "::error::pack ${pack}: cannot fetch ${commit} from ${REPO_SLUG}" >&2
		sed 's/^/    /' "$WORK/fetch.err" >&2
		failures=$((failures + 1))
		continue
	fi
	if ! git -C "$WORK/source.git" show "$commit:$path" >"$target" 2>"$WORK/show.err"; then
		echo "::error::pack ${pack}: cannot read ${path} at ${commit}" >&2
		sed 's/^/    /' "$WORK/show.err" >&2
		failures=$((failures + 1))
		continue
	fi
	magic="$(head -c 4 "$target" | od -An -tx1 | tr -d ' \n')"
	if [ "$magic" != "504b0304" ]; then
		echo "::error::pack ${pack}: not a ZIP (magic ${magic})" >&2
		failures=$((failures + 1))
		continue
	fi
	got_sha="$(sha256sum "$target" | awk '{print $1}')"
	if [ "$got_sha" != "$_sha" ]; then
		echo "::error::pack ${pack}: SHA-256 ${got_sha}, pinned ${_sha}" >&2
		failures=$((failures + 1))
		continue
	fi
	echo "A6 UI SOURCE: ${pack} ok"
	echo "  commit:   ${commit}"
	echo "  path:     ${path}"
	echo "  bytes:    $(wc -c <"$target" | tr -d ' ')"
	echo "  sha256:   ${got_sha}"
done

if [ "$failures" -ne 0 ]; then
	echo "A6 UI SOURCES FAILED (${failures})" >&2
	exit 1
fi
echo "A6 UI SOURCES VERIFIED (2 packs)"
