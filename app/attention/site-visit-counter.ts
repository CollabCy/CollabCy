export type VisitSnapshot={status:'loading'|'ready'|'unavailable';total:string|null;trackingBeganAt:string|null};
export const initialVisitSnapshot:VisitSnapshot={status:'loading',total:null,trackingBeganAt:null};

// One shared counter per page runtime. Refresh reads the server; only the first
// successful request records this tab's visit. Retries reuse the same UUID.
export function createSiteVisitCounter({request,visitId,now=Date.now}:{request:(method:'GET'|'POST',id?:string)=>Promise<unknown>;visitId:()=>string;now?:()=>number}){
  let snapshot=initialVisitSnapshot;
  let counted=false,lastRead=-Infinity;
  let pending:Promise<void>|null=null;
  const listeners=new Set<()=>void>();
  const refresh=()=>{
    if(pending)return pending;
    if(now()-lastRead<30000)return Promise.resolve();
    pending=(async()=>{
      try{
        const result=await request(counted?'GET':'POST',counted?undefined:visitId()) as {totalVisits?:unknown;trackingBeganAt?:unknown};
        if(typeof result?.totalVisits!=='string'||!/^\d+$/.test(result.totalVisits))throw new Error('Invalid total');
        counted=true;
        snapshot={status:'ready',total:result.totalVisits,trackingBeganAt:typeof result.trackingBeganAt==='string'?result.trackingBeganAt:null};
      }catch{snapshot={...snapshot,status:'unavailable'};}
      finally{lastRead=now();pending=null;listeners.forEach(listener=>listener());}
    })();
    return pending;
  };
  return {refresh,getSnapshot:()=>snapshot,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};}};
}
