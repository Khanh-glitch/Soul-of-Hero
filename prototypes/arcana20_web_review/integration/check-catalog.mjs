import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
let c=JSON.parse(readFileSync(new URL('./p0-catalog.json',import.meta.url),'utf8'));
assert.equal(c.source_commit,'b9b8cfa904d8c4126da63bdfca41b38b0f4718eb');
assert.equal(c.skills.length,20);
for(let i=0;i<20;i++){assert.equal(c.skills[i].id,i+1);assert.equal(c.skills[i].key,`arcana_fusion20_${String(i+1).padStart(2,'0')}`);assert.equal(c.skills[i].web_visual_implemented,false)}
console.log('P0 metadata 20/20; no browser skill port claimed');
