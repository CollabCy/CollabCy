'use client';
import {useEffect,useState} from 'react';
import {Users,MousePointer2} from 'lucide-react';
import {getSupabase} from '../../lib/supabase';

export function AudiencePulse(){
  const [live,setLive]=useState<number|null>(null);
  const [total,setTotal]=useState<number|null>(null);
  const [online,setOnline]=useState(false);
  useEffect(()=>{
    const id=crypto.randomUUID();
    let visitor:string;
    try{visitor=localStorage.getItem('collabcy-visitor')||crypto.randomUUID();localStorage.setItem('collabcy-visitor',visitor);}catch{visitor=crypto.randomUUID();}
    try{
      let n=Number(localStorage.getItem('collabcy-preview-visits'))||0;
      if(!sessionStorage.getItem('collabcy-preview-counted')){
        n++;
        localStorage.setItem('collabcy-preview-visits',String(n));
        sessionStorage.setItem('collabcy-preview-counted','1');
      }
      setTotal(n);
    }catch{setTotal(1);}
    const peers=new Map<string,number>();
    const bc=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('collabcy-audience'):null;
    let remoteLive=false;
    const ping=()=>{
      peers.set(id,Date.now());
      bc?.postMessage({id,at:Date.now()});
      for(const [key,at] of peers)if(Date.now()-at>18000)peers.delete(key);
      if(!remoteLive)setLive(peers.size);
    };
    if(bc)bc.onmessage=e=>{
      if(typeof e.data?.id!=='string')return;
      if(e.data.left)peers.delete(e.data.id);
      else if(typeof e.data.at==='number')peers.set(e.data.id,e.data.at);
      if(!remoteLive)setLive(peers.size);
    };
    ping();
    const timer=setInterval(ping,5000);
    const client=getSupabase();
    const channel=client?.channel('collabcy-public-audience',{config:{presence:{key:visitor}}});
    channel?.on('presence',{event:'sync'},()=>{
      const count=Object.keys(channel.presenceState()).length;
      remoteLive=true;
      setLive(count);
      setOnline(true);
    }).subscribe(status=>{
      if(status==='SUBSCRIBED')void channel.track({joinedAt:Date.now()});
      else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
        remoteLive=false;
        setOnline(false);
        setLive(peers.size);
      }
    });
    return()=>{
      clearInterval(timer);
      bc?.postMessage({id,left:true});
      bc?.close();
      if(channel&&client)void client.removeChannel(channel);
    };
  },[]);
  return <div className="audience-pulse" aria-label="Marketplace audience">
    <span><i/><strong key={live}>{live===null?'—':live}</strong> live {online?'now':'here'}</span>
    <span><Users size={14}/><strong key={total}>{total===null?'—':total.toLocaleString()}</strong> visits in this browser</span>
    <small>{online?'Live presence on this page':'Page presence in this browser'}</small>
  </div>;
}

export function BrandClicks({count,kind='website'}:{count:number;kind?:'website'|'brand'}){
  return <span className="brand-clicks"><MousePointer2 size={12}/><strong key={count}>{count.toLocaleString()}</strong> {kind} clicks</span>;
}
