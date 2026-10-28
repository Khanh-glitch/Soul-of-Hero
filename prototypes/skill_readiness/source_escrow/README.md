# GOLD93 source escrow (encrypted)

These files contain the **complete original ZIP archives encrypted at rest** (RFC8439 ChaCha20) to avoid publishing unlicensed/unreviewed original source bytes in a public GitHub repository.

They were sourced from the owner's two original ZIP uploads. **Both unencrypted ZIP SHA-256 hashes were verified locally before upload.**

Use the **private 64-hex-character key supplied only in the Arena handoff prompt** (never put it into a committed file, CI logs, or issue discussion):

```bash
# In an isolated terminal: obtain GOLD93_ARCHIVE_KEY securely from the owner
python3 prototypes/skill_readiness/source_escrow/decrypt_gold93_sources.py --out-dir /tmp/gold93-original-sources
```

The script requires `GOLD93_ARCHIVE_KEY` in its local environment, verifies decrypted ZIP SHA-256 and every ZIP member, and refuses to write decrypted archives into the working repository. It uses only Python's standard library.

**Agent acceptance gate:** do not declare source recovered until command outputs `GOLD93_SOURCES_VERIFIED: 2/2`. Then extract under `/tmp` or another git-excluded workspace and begin original-source-driven native porting. No source-fidelity claims from these ciphertexts alone.

Do **not** commit decrypted ZIPs, extracted original source or the decryption key. If preserving long-term source access is needed, migrate escrow to a private, access-controlled repository or artifact store. Public ciphertext and its SHA-256 metadata are not a replacement for authorization to distribute the source.
