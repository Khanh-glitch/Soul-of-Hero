// Suppress only C20 world block draw in memory; the source remains untouched.
const fs=require('node:fs'),esbuild=require('esbuild');
esbuild.build({entryPoints:['tools/arcana20_source_compare/c20_out_reference.ts'],bundle:true,platform:'node',format:'esm',outfile:process.argv[2],
 plugins:[{name:'isolate-out',setup(build){build.onLoad({filter:/\/sources\/C\/src\/spells\/astral\.ts$/},args=>{
  const text=fs.readFileSync(args.path,'utf8'),needle='        if (blocksOut) {';
  if(text.split(needle).length!==2)throw new Error('C20 block instrumentation location changed');
  return {contents:text.replace(needle,'        if (false && blocksOut) {'),loader:'ts'};
 });}}]}).catch(e=>{console.error(e);process.exit(1)});
