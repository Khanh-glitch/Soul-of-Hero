#!/usr/bin/env python3
"""Verify the uploaded creator-review zip after downloading it in a separate job.

This verifies bytes, embedded file checksums and provenance, not visual approval.
"""
import hashlib
import json
import pathlib
import sys
import zipfile


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest_stream(stream):
    digest = hashlib.sha256()
    while chunk := stream.read(1024 * 1024):
        digest.update(chunk)
    return digest.hexdigest()


def verify(folder, sha):
    folder = pathlib.Path(folder)
    archive = folder / 'ARCANA_FIVE_FUSIONS_CREATOR_REVIEW.zip'
    checksum_file = folder / (archive.name + '.sha256')
    expected, name = checksum_file.read_text().strip().split(maxsplit=1)
    require(name.lstrip('*') == archive.name, 'outer checksum names wrong archive')
    with archive.open('rb') as f:
        require(digest_stream(f) == expected, 'outer ZIP checksum mismatch')
    with zipfile.ZipFile(archive) as z:
        names = z.namelist()
        require(len(names) == len(set(names)), 'duplicate ZIP members')
        bad = z.testzip()
        require(bad is None, f'corrupt member: {bad}')
        # zip CLI records ./ paths; normalize only that unambiguous prefix.
        members = {name.removeprefix('./'): name for name in names if not name.endswith('/')}
        require(len(members) == sum(not n.endswith('/') for n in names), 'ambiguous paths')
        for path in members:
            require(not path.startswith('/') and '..' not in pathlib.PurePosixPath(path).parts, 'unsafe ZIP path')
        for name in ('CODE_SHA.txt', 'BATCH_F_REVIEW.txt', 'BATCH_S_REVIEW.txt', 'HUONG_DAN.txt', 'SHA256SUMS.txt'):
            require(name in members, f'missing {name}')
        require(sha in z.read(members['CODE_SHA.txt']).decode(), 'incorrect CODE_SHA')
        manifests = [n for n in members if n.endswith('/arcana20_join_manifest.json')]
        require(len(manifests) == 1, f'expected one build manifest: {manifests}')
        manifest = json.loads(z.read(members[manifests[0]]))
        require(manifest['shas']['avfx'] == sha, 'incorrect manifest AVFX SHA')
        for os in ('linux', 'windows'):
            require(any(n.endswith('/SOH_AVFX_EXPERIMENTAL_' + os + '.zip') for n in members), f'missing {os} export')
        for skill in ('F01', 'F09', 'F11', 'F16', 'F20', 'F01MATCH', 'F16STEP', 'F16FIX', 'F20FIX'):
            for light in ('normal', 'dimmed'):
                prefix = f'fusion-full-cast/r20-{skill}-{light}-lock0/'
                for tail in ('timeline.json', 'review.mp4'):
                    require(any(n.startswith(prefix) and n.endswith('/' + tail) for n in members), f'missing {skill}/{light}/{tail}')
        lines = z.read(members['SHA256SUMS.txt']).decode().splitlines()
        seen = set()
        for line in lines:
            expected_file, path = line.split(maxsplit=1)
            path = path.lstrip('*').removeprefix('./')
            require(path in members and path not in seen, f'bad checksum entry {path}')
            with z.open(members[path]) as f:
                require(digest_stream(f) == expected_file, f'checksum mismatch {path}')
            seen.add(path)
        # The packager deliberately excludes every file named SHA256SUMS.txt
        # from the top-level list. Verify the nested build list separately.
        checksum_paths = {n for n in members if pathlib.PurePosixPath(n).name == 'SHA256SUMS.txt'}
        require(seen == set(members) - checksum_paths, 'missing or extra checksum entries')
        nested = checksum_paths - {'SHA256SUMS.txt'}
        require(len(nested) == 1, f'expected one build checksum list: {nested}')
        build_checksums = nested.pop()
        build_dir = pathlib.PurePosixPath(build_checksums).parent
        build_seen = set()
        for line in z.read(members[build_checksums]).decode().splitlines():
            file_hash, name = line.split(maxsplit=1)
            name = name.lstrip('*')
            path = str(build_dir / name)
            require(path in members and path not in build_seen, f'bad build checksum entry {path}')
            with z.open(members[path]) as f:
                require(digest_stream(f) == file_hash, f'build checksum mismatch {path}')
            build_seen.add(path)
        require(len(build_seen) == 2, 'expected checksums for both OS exports')
        listing = (folder / 'f-final-contents.txt').read_text()
        for name in ('CODE_SHA.txt', 'BATCH_F_REVIEW.txt', 'SOH_AVFX_EXPERIMENTAL_linux.zip', 'SOH_AVFX_EXPERIMENTAL_windows.zip'):
            require(name in listing, f'uploaded listing missing {name}')
    print(f'F_DOWNLOAD_VERIFIED sha={sha} zip_sha256={expected} files={len(members)} verified_files={len(seen)} normal_dim_pairs=9')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('usage: verify_f_download.py DIRECTORY AVFX_SHA')
    verify(sys.argv[1], sys.argv[2])
