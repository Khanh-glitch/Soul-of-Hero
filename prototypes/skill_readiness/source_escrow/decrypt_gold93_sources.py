#!/usr/bin/env python3
"""Restore SHA256-pinned GOLD93 ZIP archives from encrypted Git escrow.
Source archives and the key must NEVER be committed to this public repository.
Standard library only. RFC 8439 ChaCha20 (256-bit key, 96-bit nonce, counter 1).
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import stat
import struct
import sys
import zipfile

MASK = 0xFFFFFFFF

def _rotl(v, n):
    return ((v << n) | (v >> (32 - n))) & MASK

def _qr(s, a, b, c, d):
    s[a] = (s[a] + s[b]) & MASK
    s[d] = _rotl(s[d] ^ s[a], 16)
    s[c] = (s[c] + s[d]) & MASK
    s[b] = _rotl(s[b] ^ s[c], 12)
    s[a] = (s[a] + s[b]) & MASK
    s[d] = _rotl(s[d] ^ s[a], 8)
    s[c] = (s[c] + s[d]) & MASK
    s[b] = _rotl(s[b] ^ s[c], 7)

def chacha20_block(key, nonce, counter):
    assert len(key) == 32 and len(nonce) == 12
    state = [0x61707865, 0x3320646E, 0x79622D32, 0x6B206574]
    state.extend(struct.unpack('<8I', key))
    state.extend((counter & MASK, *struct.unpack('<3I', nonce)))
    work = list(state)
    for _ in range(10):
        _qr(work, 0, 4, 8, 12)
        _qr(work, 1, 5, 9, 13)
        _qr(work, 2, 6, 10, 14)
        _qr(work, 3, 7, 11, 15)
        _qr(work, 0, 5, 10, 15)
        _qr(work, 1, 6, 11, 12)
        _qr(work, 2, 7, 8, 13)
        _qr(work, 3, 4, 9, 14)
    return struct.pack('<16I', *(((work[i] + state[i]) & MASK) for i in range(16)))

def chacha20_xor(data, key, nonce, counter=1):
    out = bytearray(len(data))
    for offset in range(0, len(data), 64):
        stream = chacha20_block(key, nonce, counter + offset // 64)
        for i, value in enumerate(data[offset:offset + 64]):
            out[offset + i] = value ^ stream[i]
    return bytes(out)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out-dir', required=True, type=Path)
    args = parser.parse_args()
    repo_directory = Path(__file__).resolve().parents[2]
    target = args.out_dir.resolve()
    if target == repo_directory or repo_directory in target.parents:
        sys.exit('ERROR: decrypted GOLD ZIPs must remain OUTSIDE the git working tree')
    key_hex = os.environ.get('GOLD93_ARCHIVE_KEY', '')
    if len(key_hex) != 64:
        sys.exit('ERROR: GOLD93_ARCHIVE_KEY must be a 64-hex-character value supplied privately')
    try:
        key = bytes.fromhex(key_hex)
    except ValueError:
        sys.exit('ERROR: GOLD93_ARCHIVE_KEY is not valid hexadecimal')
    target.mkdir(parents=True, exist_ok=True)
    os.chmod(target, stat.S_IRWXU)
    directory = Path(__file__).resolve().parent
    manifest = json.loads((directory / 'source_archive_manifest.json').read_text())
    for item in manifest['archives']:
        ciphertext = (directory / item['encrypted_path']).read_bytes()
        if len(ciphertext) != item['size']:
            sys.exit(f"ERROR: size mismatch for {item['encrypted_path']}")
        data = chacha20_xor(ciphertext, key, bytes.fromhex(item['nonce_hex']))
        digest = hashlib.sha256(data).hexdigest()
        if digest != item['sha256']:
            sys.exit(f"ERROR: incorrect key or corrupted archive {item['original_filename']}")
        archive = target / item['original_filename']
        with os.fdopen(os.open(archive, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600), 'wb') as f:
            f.write(data)
        with zipfile.ZipFile(archive) as z:
            error_member = z.testzip()
            if error_member is not None:
                sys.exit(f"ERROR: corrupt ZIP member {error_member}")
            print(f"VERIFIED {archive.name}: {len(data)} bytes, {len(z.namelist())} entries, SHA256={digest}")
    print('GOLD93_SOURCES_VERIFIED: 2/2. Plaintext ZIPs are outside repository.')

if __name__ == '__main__':
    main()
