#!/usr/bin/env bash
# Fetch the two licensed grade-0 avatar source archives from their Git source.
#
#   tools/fetch_a6_avatar_sources.sh <output-directory>
#
# The archives are CraftPix 555940 (male) and 419402 (female). They live as real
# binaries on branches of the creator's asset repository, pinned here to immutable
# commits - not to branch names, which move. Every archive is checked four ways
# before it is handed to tools/stage_a6_avatar_art.py: the commit id, the Git blob
# id, the exact byte length and the SHA-256.
#
# This replaces the anonymous `drive.google.com/uc?export=download` curl that the
# workflow used to run. That URL answers with an HTML consent page, so the step
# failed with "download is not a ZIP archive" before Godot ever started - an asset
# transport failure that said nothing about the sprites themselves.
#
# Notes for whoever maintains this:
#   * nothing is written into the repository; output defaults to a caller-chosen
#     temporary directory outside it, and the staging tool refuses to run on an
#     archive inside the repo;
#   * raw source stays in runner-temporary storage and is deleted after staging -
#     the CraftPix licence allows shipping the art inside the game, not
#     redistributing the source packs, so no ZIP is ever uploaded as an artifact;
#   * if the asset repository is ever made private, export A6_ASSET_TOKEN with a
#     read-only token and the same commands keep working;
#   * APEX-CHAOS is a large repository, so the fetch is blobless (`--filter`) and
#     depth-1: only the two pinned blobs come down, not the tree's history.
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

# gender|commit|repository path|git blob id|bytes|sha256
PINS=(
	"male|bf11a0cecfda43beca510062bd5d9dc1a8573cc5|craftpix-net-555940-free-base-4-direction-male-character-pixel-art.zip|ce3e032df5b67ef6c25ae4dcb0562bb3b7e545c0|6439805|b5579a3cc6006ef8c9d55c9ca0388575d75c987382b6cb504e2c7519e6c1e795"
	"female|b75dfc0ffa98c25059d67f655be14e419e63430b|craftpix-net-419402-free-base-4-direction-female-character-pixel-art.zip|854be998896252479a678aef6f4b7b09d809a6b4|6419098|f704e7852273d5f0111435ae86975fa981354d699dff1f594934f6a32d9821ad"
)

mkdir -p "$OUT" || exit 2
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

git init -q --bare "$WORK/source.git" || exit 2
git -C "$WORK/source.git" remote add origin "$REMOTE" || exit 2

failures=0
for pin in "${PINS[@]}"; do
	IFS='|' read -r gender commit path blob want_bytes want_sha <<<"$pin"
	target="$OUT/${gender}.zip"

	if ! git -C "$WORK/source.git" fetch -q --depth 1 --filter=blob:none origin "$commit" 2>"$WORK/fetch.err"; then
		echo "::error::${gender}: cannot fetch ${commit} from ${REPO_SLUG}" >&2
		sed 's/^/    /' "$WORK/fetch.err" >&2
		failures=$((failures + 1))
		continue
	fi
	fetched="$(git -C "$WORK/source.git" rev-parse FETCH_HEAD)"
	if [ "$fetched" != "$commit" ]; then
		echo "::error::${gender}: asked for ${commit}, got ${fetched}" >&2
		failures=$((failures + 1))
		continue
	fi

	tree_line="$(git -C "$WORK/source.git" ls-tree "$commit" "$path")"
	tree_blob="$(echo "$tree_line" | awk '{print $3}')"
	if [ "$tree_blob" != "$blob" ]; then
		echo "::error::${gender}: ${path} is blob '${tree_blob}', pinned '${blob}'" >&2
		failures=$((failures + 1))
		continue
	fi

	if ! git -C "$WORK/source.git" show "$commit:$path" >"$target" 2>"$WORK/show.err"; then
		echo "::error::${gender}: cannot read ${path} at ${commit}" >&2
		sed 's/^/    /' "$WORK/show.err" >&2
		failures=$((failures + 1))
		continue
	fi

	got_bytes="$(wc -c <"$target" | tr -d ' ')"
	got_sha="$(sha256sum "$target" | awk '{print $1}')"
	magic="$(head -c 4 "$target" | od -An -tx1 | tr -d ' \n')"

	if [ "$magic" != "504b0304" ]; then
		# A Git LFS pointer or an HTML page would land here, not a real archive.
		echo "::error::${gender}: not a ZIP (magic ${magic}, first bytes: $(head -c 32 "$target" | tr -d '\0'))" >&2
		failures=$((failures + 1))
		continue
	fi
	if [ "$got_bytes" != "$want_bytes" ]; then
		echo "::error::${gender}: ${got_bytes} bytes, pinned ${want_bytes}" >&2
		failures=$((failures + 1))
		continue
	fi
	if [ "$got_sha" != "$want_sha" ]; then
		echo "::error::${gender}: SHA-256 ${got_sha}, pinned ${want_sha}" >&2
		failures=$((failures + 1))
		continue
	fi

	echo "A6 ASSET SOURCE: ${gender} ok"
	echo "  repository: ${REPO_SLUG}"
	echo "  commit:     ${commit}"
	echo "  path:       ${path}"
	echo "  blob:       ${blob}"
	echo "  bytes:      ${got_bytes}"
	echo "  sha256:     ${got_sha}"
	echo "  file:       ${target}"
done

if [ "$failures" -ne 0 ]; then
	echo "A6 ASSET SOURCE FAILED (${failures})" >&2
	exit 1
fi
echo "A6 ASSET SOURCES VERIFIED (2 archives, pinned commits, SHA-256 matched)"
