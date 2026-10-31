// Insert a diagnostic no-op at the beginning of A's bolt helper in memory.
// This compares the unchanged A rotor/fragment operations while excluding
// bolts deliberately replaced by C geometry; no source file is rewritten.
const fs = require('node:fs');
const esbuild = require('esbuild');
esbuild.build({
  entryPoints: ['tools/arcana20_source_compare/a11_reference.ts'], bundle: true,
  platform: 'node', format: 'esm', outfile: process.argv[2],
  plugins: [{name: 'isolate-a11-rotor', setup(build) {
    build.onLoad({filter: /\/sources\/A\/src\/spells\/tempest\.ts$/}, args => {
      const text = fs.readFileSync(args.path, 'utf8');
      const needle = '  const frame = Math.floor(t * 28);';
      if (text.split(needle).length !== 2) throw new Error('A bolt instrumentation location changed');
      return {contents: text.replace(needle, '  return; // diagnostic: original A bolt role intentionally excluded\n' + needle), loader: 'ts'};
    });
  }}]
}).catch(e => { console.error(e); process.exit(1); });
