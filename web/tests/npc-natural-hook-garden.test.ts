import {it} from 'vitest';
import {naturalHookGarden} from './helpers/hook-garden-run';
it('Hook residents plant, irrigate, harvest, deliver and replant across a growing-plot reload',()=>{
 console.log('HOOK_GARDEN',JSON.stringify(naturalHookGarden()));
},600000);
