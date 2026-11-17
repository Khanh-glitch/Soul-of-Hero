/** Optional synchronous engineering counters; never serialized or a simulation authority. */
export interface WorldWork { sourceLookups:number;sourceIndexReads:number;worldSlices:number;plannerActivations:number;actorPlans:number;regionCompilations:number;renderCompilations:number;routeExpansions:number;entityScans:number }
let measuring:WorldWork|undefined;
export function countWorldWork(key:keyof WorldWork,n=1){if(measuring)measuring[key]+=n;}
export function measureWorldWork<T>(work:()=>T):{result:T;counts:WorldWork;elapsedMs:number}{
 const previous=measuring,counts:WorldWork={sourceLookups:0,sourceIndexReads:0,worldSlices:0,plannerActivations:0,actorPlans:0,regionCompilations:0,renderCompilations:0,routeExpansions:0,entityScans:0};measuring=counts;const at=performance.now();
 try{return {result:work(),counts,elapsedMs:performance.now()-at};}finally{measuring=previous;}
}

/** Inclusive elapsed CPU-wall diagnostics. Nesting is intentional; do not sum
 * overlapping labels. Disabled path never reads a clock or allocates a sample. */
let timing:Record<string,{calls:number;ms:number}>|undefined;
export function timedWorldWork<T>(label:string,work:()=>T):T {
 if(!timing)return work();const at=performance.now();
 try{return work();}finally{const s=timing[label]??=( {calls:0,ms:0});s.calls++;s.ms+=performance.now()-at;}
}
export function profileWorldWork<T>(work:()=>T){const previous=timing,samples:NonNullable<typeof timing>={};timing=samples;try{return {...measureWorldWork(work),timings:samples};}finally{timing=previous;}}
