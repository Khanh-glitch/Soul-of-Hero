p='src/game/human-navigation.ts'; s=open(p).read()
def rep(a,b):
    global s
    assert s.count(a)==1,(s.count(a),a[:60]); s=s.replace(a,b)
rep("const searchActor=(id:string)=>id.split(':')[3];","const searchActor=(id:string)=>id.split(':')[3];\nconst NAV=((globalThis as any).__nav??={}) as Record<string,number>;const nav=(k:string,n=1)=>{NAV[k]=(NAV[k]??0)+n;};")
rep("const queued=(examined:number)=>{help();","const queued=(examined:number)=>{nav('queueWait');help();")
rep("const n=heapPop(s.heap),k=tk;budget--;","nav('helpCells');const n=heapPop(s.heap),k=tk;budget--;")
rep("    const old=pending!.get(oldId)!;\n","    const old=pending!.get(oldId)!;nav('evictRank'+oldRank);nav('evictCells'+oldRank,old.points.size);\n")
rep("status('FOUND',state.expanded);return path;","nav('found');if(state.expanded>4096)nav('foundLong');status('FOUND',state.expanded);return path;")
rep("const outcome=!heap.length?'NO_PATH':'SEARCH_LIMIT';","const outcome=!heap.length?'NO_PATH':'SEARCH_LIMIT';nav(outcome);")
rep("pending.set(searchKey,state);   // a lane is free: start again","pending.set(searchKey,state);nav('ticketRestart');   // a lane is free: start again")
rep("  let pending=searches.get(r);if(!pending){pending=new Map();searches.set(r,pending);}","  let pending=searches.get(r);if(!pending){pending=new Map();searches.set(r,pending);}\n  (globalThis as any).__navPending=pending;")
open(p,'w').write(s)
