/** Run from the MEASURED web checkout. Normal opening, production settle only.
 * node /path/to/scripts/npc-endurance.mjs output-directory [target-minute=20160]
 * Stages the opt-in Vitest entry outside src/tests so normal regression discovery
 * and source fingerprints remain unchanged after cleanup. Never run concurrently
 * in one checkout. Keep the checkpoint external or in an ignored workspace dir. */
import fs from 'node:fs';import path from 'node:path';import {execFileSync,spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const out=path.resolve(process.argv[2]), end=Number(process.argv[3]??20160);if(!Number.isInteger(end)||end<1||end>20160)throw Error('Expected 1..20160 simulated minutes');
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();execFileSync('git',['diff','--quiet','HEAD','--','src']);fs.mkdirSync(out,{recursive:true});
const entry='endurance-campaign.local.test.ts';const template=fileURLToPath(new URL('./npc-endurance-entry.ts.template',import.meta.url));fs.copyFileSync(template,entry,fs.constants.COPYFILE_EXCL);
try{const run=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run',entry,'--maxWorkers=1','--reporter=verbose'],{stdio:'inherit',env:{...process.env,SOH_ENDURANCE_SHA:sha,SOH_ENDURANCE_OUT:out,SOH_ENDURANCE_END:String(end)}});process.exitCode=run.status??1;}finally{fs.unlinkSync(entry);}
