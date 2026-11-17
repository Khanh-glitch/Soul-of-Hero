/** Optional synchronous engineering counters; never serialized or a simulation authority. */
export interface WorldWork { worldSlices:number;plannerActivations:number;actorPlans:number;regionCompilations:number;renderCompilations:number;routeExpansions:number;entityScans:number }
let measuring:WorldWork|undefined;
export function countWorldWork(key:keyof WorldWork,n=1){if(measuring)measuring[key]+=n;}
export function measureWorldWork<T>(work:()=>T):{result:T;counts:WorldWork;elapsedMs:number}{
 const previous=measuring,counts:WorldWork={worldSlices:0,plannerActivations:0,actorPlans:0,regionCompilations:0,renderCompilations:0,routeExpansions:0,entityScans:0};measuring=counts;const at=performance.now();
 try{return {result:work(),counts,elapsedMs:performance.now()-at};}finally{measuring=previous;}
}
