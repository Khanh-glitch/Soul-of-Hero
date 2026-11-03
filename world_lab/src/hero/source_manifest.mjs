// Deterministic provenance ledger for the one-scene hero experiment.
// Local HEAD is deliberately never serialized: a committed hash becomes stale on the next commit.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const ROOT = process.cwd();
const REPO = path.resolve(ROOT, '..');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const rel = p => path.relative(ROOT, p).replaceAll(path.sep, '/');
const walk = dir => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, {withFileTypes: true}).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const entry = p => ({path: rel(p), bytes: fs.statSync(p).size, sha256: sha(p)});

const sourceMap = json('assets/source/prototype/SOURCE_MAP.json');
const legacy = json('data/source_manifest.json');
const donors = json('data/asset_components.json');
const derivedNotice = json('data/hero_derived_notice.json');
const gold = 'src/gold/VEYRA_GOLD_MAP.sohmap.json';
const bible = 'src/gold/CURRENT_PRODUCT_CONTRACT.md';
const contract = 'src/gold/REAL_MAP_CONVERSION_CONTRACT.md';
const staging = 'src/gold/EXISTING_ASSET_GIT_SOURCES.json';

const licenseURLs = [
  'https://craftpix.net/file-licenses/',
  'https://www.dafont.com/digital-disco.font',
  'https://cainos.itch.io/pixel-art-top-down-basic',
  'https://github.com/Khanh-glitch/Soul-of-Hero/tree/7a1c53acfc5b7cda6cb34ea3f348b4e100744354',
];
const licenseFor = p => {
  if (p.includes('/prototype/')) return licenseURLs[3];
  if (p.includes('/licenses/')) return licenseURLs[2];
  if (p.includes('/derived/')) return 'AI_DERIVED_HERO_PROP_NOT_REAL_ASSET';
  return p.includes('dafont') ? licenseURLs[1] : licenseURLs[0];
};

const licenseFiles = walk('assets/source/licenses').sort().map(entry);
const rawPacks = walk('assets/source/raw_packs').filter(p => p.endsWith('.zip')).sort().map(p => ({...entry(p), license_url: licenseFor(p), source_sha256: legacy.raw_pack_sha256?.[path.basename(p)] ?? null}));
const refs = walk('assets/source/prototype/references').sort().map(p => ({...entry(p), role: 'NATIVE_PROTOTYPE_COMPARISON_ONLY', license_url: licenseURLs[3]}));
const derived = walk('assets/source/derived').sort().map(p => ({...entry(p), license_url: licenseFor(p), provenance_class: 'AI_DERIVED_HERO_PROP_NOT_REAL_ASSET'}));
const prototypeFiles = sourceMap.files.map(f => ({...f, license_url: licenseURLs[3], role: f.flat.includes('captures') || f.flat.includes('L0') || f.flat.includes('after_') ? 'NATIVE_PROTOTYPE_COMPARISON_ONLY' : 'AUTHORITATIVE_REAL_CROP_DONOR'}));
const donorFiles = [...new Set(donors.map(d => d.file))].sort().map(p => {
  const abs = path.join(ROOT, p.startsWith('assets/') ? p : `assets/source/${p}`);
  return fs.existsSync(abs) ? {...entry(abs), license_url: licenseFor(abs), connected_components: donors.filter(d => d.file === p).reduce((n, d) => n + d.components, 0)} : {path: p, missing: true};
});

const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {cwd: REPO, encoding: 'utf8'}).trim();
if (branch !== 'arena/2e3cfbd2-soul-of-hero') throw new Error(`Unexpected branch: ${branch}`);

const manifest = {
  schema: 'SOH_HERO_SOURCE_PROVENANCE_V1',
  generated: new Date().toISOString(),
  branch,
  local_head: 'DYNAMIC_SEE_GIT_REV_PARSE_HEAD',
  head_command: 'git rev-parse HEAD',
  source_branches: legacy.source_branches,
  private_APEX_CHAOS: legacy.private_APEX_CHAOS,
  gold: {...entry(gold), pinned_sha256: legacy.gold_sha256},
  product_contract: entry(bible),
  map_conversion_contract: entry(contract),
  existing_asset_git_sources: entry(staging),
  prototype: {
    branch: 'references/gameplay-prototypes-20261102',
    commit: '7a1c53acfc5b7cda6cb34ea3f348b4e100744354',
    source_map: entry('assets/source/prototype/SOURCE_MAP.json'),
    license: sourceMap.license,
    note: sourceMap.note,
    file_count: prototypeFiles.length,
    byte_count: prototypeFiles.reduce((n, f) => n + f.bytes, 0),
    files: prototypeFiles,
  },
  license_urls: licenseURLs,
  license_files: licenseFiles,
  raw_packs: rawPacks,
  native_references: refs,
  derived_assets: derived,
  derived_notice: {...entry('data/hero_derived_notice.json'), provenance_class: derivedNotice.provenance_class},
  donor_sheets: donorFiles,
  forensic_report: {...entry('data/asset_components.json'), sheets: donors.length, components: donors.reduce((n, d) => n + d.components, 0), duplicate_sheet_paths: 0},
  notes: [
    'Exact local SHA-256 and byte size are recorded for every staged source artifact.',
    'Prototype files additionally retain the exact Git blob SHA1 and origin path from the prototype branch.',
    'License URL stubs are provenance pointers, not full license text or an owner rights/approval statement.',
    'Cainos archive has no standalone license document in the supplied pack; re-check official terms before public distribution.',
    'Native prototype captures are comparison evidence only, never a scene background or a donor crop.',
    'AI-derived files are explicitly not real assets; only one labelled hero prop may be used in the scene.',
    'No C01-C24 same-SHA proof, owner semantic commitment, native Godot scene, independent playability claim, or 336h E2 claim is made.',
  ],
};
fs.writeFileSync('data/hero_source_manifest.json', JSON.stringify(manifest, null, 2) + '\n');

const licenseLines = licenseFiles.map(f => `| \`${f.path}\` | ${f.bytes} | \`${f.sha256}\` |`).join('\n');
const rawLines = rawPacks.map(f => `| \`${f.path}\` | ${f.bytes} | \`${f.sha256}\` | \`${f.source_sha256}\` | [CraftPix license](${licenseURLs[0]}) |`).join('\n');
const refLines = refs.map(f => `| \`${f.path}\` | ${f.bytes} | \`${f.sha256}\` |`).join('\n');
const derivedLines = derived.map(f => `| \`${f.path}\` | ${f.bytes} | \`${f.sha256}\` | ${f.provenance_class} |`).join('\n');
const urls = licenseURLs.map(u => `- ${u}`).join('\n');

fs.writeFileSync('ASSET_LICENSES.md', `# Asset licenses and exact source SHAs\n\nGenerated: ${manifest.generated}. Current HEAD: run \`git rev-parse HEAD\` (never pinned in a committed document).\n\n## Exact license / source URLs\n${urls}\n\n## License stub files\n\n| File | Bytes | SHA-256 |\n|---|---:|---|\n${licenseLines}\n\n## Downloaded raw packs\n\n| File | Bytes | SHA-256 | Build manifest SHA-256 | License |\n|---|---:|---|---|---|\n${rawLines}\n\n## Prototype provenance\n\n- Branch: \`references/gameplay-prototypes-20261102\` at \`${manifest.prototype.commit}\`.\n- Staged files: ${manifest.prototype.file_count}; bytes: ${manifest.prototype.byte_count}; exact per-file Git blob SHA1, origin path, byte count and SHA-256 are in \`data/hero_source_manifest.json\`.\n- Source map: \`${manifest.prototype.source_map.path}\`, ${manifest.prototype.source_map.bytes} bytes, SHA-256 \`${manifest.prototype.source_map.sha256}\`.\n- License/source URL: ${licenseURLs[3]}.\n\n## Native comparison captures (not scene backgrounds or donor crops)\n\n| File | Bytes | SHA-256 |\n|---|---:|---|\n${refLines}\n\n## AI-derived files (not real assets)\n\n| File | Bytes | SHA-256 | Provenance class |\n|---|---:|---|---|\n${derivedLines}\n\n## Honest coverage\n\nThe staged URL/readme/THIRD_PARTY stubs are not full license coverage. The Cainos archive supplied no standalone license document. This is a provenance record, not a claim that asset rights were confirmed by the creator, and not an owner semantic commitment. The four native captures are comparison only; no native screenshot is pasted into a scene. Current verdict: **PLAYABILITY_UNPROVEN / GAMEPLAY_INTEGRATION_BLOCKED**.\n`);

fs.writeFileSync('THIRD_PARTY.md', `# Third-party source notice\n\nThis experiment stages original prototype-branch generated art/tools/docs and user-supplied third-party donor packs. Exact per-file SHA-256, byte sizes and Git blob SHA1s are in \`data/hero_source_manifest.json\`; exact license URLs and license-stub SHAs are in \`ASSET_LICENSES.md\`.\n\nExact source and license URLs:\n${urls}\n\n- GOLD: \`${gold}\`, ${fs.statSync(gold).size} bytes, SHA-256 \`${sha(gold)}\`.\n- Product contract: \`${bible}\`, ${fs.statSync(bible).size} bytes, SHA-256 \`${sha(bible)}\`.\n- Map conversion contract: \`${contract}\`, ${fs.statSync(contract).size} bytes, SHA-256 \`${sha(contract)}\`.\n- Existing Git source inventory: \`${staging}\`, ${fs.statSync(staging).size} bytes, SHA-256 \`${sha(staging)}\`.\n- Prototype branch commit: \`${manifest.prototype.commit}\`; ${manifest.prototype.file_count} byte-for-byte files, ${manifest.prototype.byte_count} bytes.\n- Four native prototype captures: comparison only, exact SHAs in \`ASSET_LICENSES.md\`.\n- AI-derived hero material: \`AI_DERIVED_HERO_PROP_NOT_REAL_ASSET\`; one labelled derived hero prop only, never represented as a real asset.\n\nNo full license text is vendored for every pack; no creator rights confirmation or owner semantic commitment is asserted. No C01-C24 same-SHA proof, native Godot 4.7 scene/import/captures/test, 336h E2 evidence, or independent playability proof is asserted.\n`);
console.log(`hero source manifest: ${manifest.prototype.file_count} prototype files, ${rawPacks.length} raw packs, ${refs.length} references, ${licenseFiles.length} license stubs, ${donorFiles.length} donor sheets`);
