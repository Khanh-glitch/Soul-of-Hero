/** HTTP delivery: losslessly unpack canonical base64 PNG pages after CSS @imports
 * have been resolved. No source atlas or visual pixel is resized/reencoded. */
import { createHash } from 'node:crypto';
import type { Plugin } from 'vite';
export function externalVfxPages(): Plugin {
  return {
    name: 'soh-external-vfx-pages', enforce: 'post', apply: 'build',
    generateBundle: { order: 'post', handler(_options, bundle) {
      for (const asset of Object.values(bundle)) {
        if (asset.type !== 'asset' || !asset.fileName.endsWith('.css')) continue;
        const code = typeof asset.source === 'string' ? asset.source : Buffer.from(asset.source).toString();
        asset.source = code.replace(/(--[a-z0-9_-]+:\s*["'])([A-Za-z0-9+/=]+)(["'])/g, (all, prefix, b64, quote) => {
          const bytes = Buffer.from(b64, 'base64');
          if (!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return all;
          const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 20);
          const fileName = `assets/vfx-${hash}.png`;
          if (!bundle[fileName]) this.emitFile({ type: 'asset', fileName, source: bytes });
          return `${prefix}asset:${fileName}${quote}`;
        });
      }
    } },
  };
}
