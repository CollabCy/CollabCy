import {getSupabaseAdmin} from './supabase-admin';

export function siteVisitsEnabled(request:Request){
  const url=new URL(request.url);
  return process.env.COLLABCY_SITE_VISITS_ENABLED==='true'&&url.protocol==='https:'&&['collabcy.app','www.collabcy.app'].includes(url.hostname);
}

export async function siteVisitsResponse(request:Request){
  const headers={'Cache-Control':'no-store'};
  // Localhost and preview builds must never contribute to the production total.
  if(!siteVisitsEnabled(request))return Response.json({error:'Site visit tracking is not enabled.'},{status:503,headers});
  let visitId:string|undefined;
  if(request.method==='POST'){
    if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid origin.'},{status:403,headers});
    if(!request.headers.get('content-type')?.startsWith('application/json'))return Response.json({error:'Expected JSON.'},{status:415,headers});
    const body=await request.text();
    if(body.length>128)return Response.json({error:'Invalid visit.'},{status:400,headers});
    try{visitId=JSON.parse(body).visitId;}catch{return Response.json({error:'Invalid visit.'},{status:400,headers});}
    if(typeof visitId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitId))return Response.json({error:'Invalid visit.'},{status:400,headers});
  }
  try{
    const {data,error}=await getSupabaseAdmin().rpc(visitId?'record_collabcy_site_visit':'get_collabcy_site_visits',visitId?{p_visit_id:visitId}:{});
    if(error||!data||!/^\d+$/.test(data.totalVisits))throw new Error('Aggregate unavailable');
    return Response.json({totalVisits:String(data.totalVisits),trackingBeganAt:data.trackingBeganAt??null},{headers});
  }catch{
    return Response.json({error:'Site visit total is temporarily unavailable.'},{status:503,headers});
  }
}
