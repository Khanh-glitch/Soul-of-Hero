// Canonical Veyra GOLD source loader. The .sohmap.json stays canonical; this
// module only reads it and fingerprints it. Nothing here writes a competing
// world source or changes a coordinate.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';

export const CANON = {
  branch: 'map/veyra-gold-asset-canon-20261102',
  commit: '19d8c6ec820f324a6ac12733165e43b5e2c6eab2',
  path: 'map_tower/veyra_gold/VEYRA_GOLD_MAP.sohmap.json',
};

export const sha256 = buf => createHash('sha256').update(buf).digest('hex');

export function loadSource({ sourcePath = null, cwd = process.cwd() } = {}) {
  const raw = sourcePath
    ? fs.readFileSync(sourcePath)
    : Buffer.from(execFileSync('git', ['show', `${CANON.commit}:${CANON.path}`], { cwd, maxBuffer: 32 * 1024 * 1024 }));
  const text = raw.toString('utf8');
  const doc = JSON.parse(text);
  if (doc.format !== 'soh-maplab' || doc.version !== 1) throw new Error('unexpected Veyra source format/version');
  const project = doc.project;
  if (!project || !project.terrain) throw new Error('Veyra source is missing project.terrain');
  return {
    raw, text, doc, project,
    fingerprint: {
      branch: CANON.branch,
      commit: CANON.commit,
      path: CANON.path,
      bytes: raw.length,
      sha256: sha256(raw),
      format: doc.format,
      version: doc.version,
      name: project.name,
      metaStatus: project.meta?.status ?? null,
      created: project.meta?.created ?? null,
      modified: project.meta?.modified ?? null,
      author: project.meta?.author ?? null,
    },
  };
}

/** Deep-equal guard used by the ID/coordinate fidelity tests. */
export function stableStringify(v) { return JSON.stringify(v); }
