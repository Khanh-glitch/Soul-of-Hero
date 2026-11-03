// Test-only shipping-geometry clone for exercising build-time JSON discovery.
// Never ship as an alternate playable map; write outside the source checkout.
import {createServer} from 'vite';import {writeFile} from 'node:fs/promises';
if(!process.argv[2])throw Error('usage: node scripts/write-loader-fixture.mjs /temporary/path.json');
const v=await createServer({configFile:'vite.config.ts',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
try {const {manifest}=await v.ssrLoadModule('/tests/fixtures/runtime-map.ts');await writeFile(process.argv[2],JSON.stringify(manifest()));}finally{await v.close();}
