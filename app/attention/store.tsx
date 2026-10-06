'use client';
import {createContext,useContext,useEffect,useState,useRef,useMemo,useCallback,useSyncExternalStore,type ReactNode} from 'react';
import {demoMarketplace} from './demo';
import {createAttentionBackend} from './backend';
import {createMarketplaceRepository,type MarketplaceRepository} from './repository';
import {getSupabase} from '../../lib/supabase';
import {incrementBrandClick,readBrandClicks,type ClickCounts} from './click-counts';
import type {Product} from './model';
const Context=createContext<{repository:MarketplaceRepository;demos:Product[];visitDemo:(id:string)=>void;brandClicks:ClickCounts;recordBrandClick:(id:string)=>void}|null>(null);
export function AttentionProvider({children}:{children:ReactNode}){
 const [repository]=useState(()=>createMarketplaceRepository(undefined,createAttentionBackend()));
 const [demos,setDemos]=useState(()=>demoMarketplace().products);
 const demoRef=useRef(demos);
 const [brandClicks,setBrandClicks]=useState<ClickCounts>(readBrandClicks);const brandRef=useRef(brandClicks);
 const applyClicks=useCallback((next:ClickCounts)=>{brandRef.current=next;setBrandClicks(next);try{localStorage.setItem('collabcy-brand-clicks',JSON.stringify(next));}catch{}},[]);
 const recordBrandClick=useCallback((id:string)=>{applyClicks(incrementBrandClick(brandRef.current,id));const client=getSupabase();if(!client||id.startsWith('demo-'))return;void client.rpc('record_attention_brand_click',{p_product_id:id}).then(({data,error})=>{if(!error&&typeof data==='number')applyClicks({...brandRef.current,[id]:Math.max(brandRef.current[id]||0,data)});});},[applyClicks]);
 useEffect(()=>{let active=true;const client=getSupabase();const load=()=>{const ids=repository.getSnapshot().products.map(p=>p.id);if(!client||!ids.length)return;void client.rpc('get_attention_brand_clicks',{p_product_ids:ids}).then(({data,error})=>{if(active&&!error&&Array.isArray(data))applyClicks({...brandRef.current,...Object.fromEntries(data.map(row=>[row.product_id,Math.max(brandRef.current[row.product_id]||0,Number(row.click_count)||0)]))});});};load();const stop=repository.subscribe(load);return()=>{active=false;stop();};},[repository,applyClicks]);
 const visitDemo=useCallback((id:string)=>{const next=demoRef.current.map(p=>p.id===id?{...p,clickCount:p.clickCount+1}:p);demoRef.current=next;try{localStorage.setItem('collabcy-demo-clicks',JSON.stringify(Object.fromEntries(next.map(p=>[p.id,p.clickCount]))));}catch{}setDemos(next);},[]);
 useEffect(()=>{void repository.hydrate();const unwatch=repository.watchRemote();const timer=setInterval(()=>repository.refresh(),30000);return()=>{clearInterval(timer);unwatch();};},[repository]);
 return <Context.Provider value={{repository,demos,visitDemo,brandClicks,recordBrandClick}}>{children}</Context.Provider>;
}
export function useAttention(){const context=useContext(Context);if(!context)throw new Error('Missing marketplace provider');const {repository,demos,visitDemo,brandClicks,recordBrandClick}=context;const remote=useSyncExternalStore(repository.subscribe,repository.getSnapshot,repository.getSnapshot);const actions=useMemo(()=>({...repository,recordBrandClick,simulateVisit:(id:string)=>{if(id.startsWith('demo-brand-')){visitDemo(id);return;}return repository.simulateVisit(id);}}),[repository,visitDemo,recordBrandClick]);return {brandClicks,state:{...remote,products:[...remote.products,...demos]},repository:actions};}
