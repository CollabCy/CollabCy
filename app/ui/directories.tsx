'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {ArrowRight,ArrowUpRight,Bookmark,Plus,Send} from 'lucide-react';
import {Sheet,SheetContent,SheetTitle,SheetDescription} from '@/components/ui/sheet';
import {Switch} from '@/components/ui/switch';
import {toast} from 'sonner';
import {Button,PageTitle,Pick,SearchBox,Empty,Modal,Textarea,Field,Avatar,Rating,Platform} from './shared';
import {useStore} from '../store';
import {Creator,categories,money,compact,brandCreatorRelationship,isCreatorUserId,isUuid,realDirectoryCreators} from '../data';
import {createNetworkConnection,getPublicBrand,getPublicCreator,inviteCreatorToCampaign,listMyApplications,listMyConnections,listPublicBrands,listPublicCreators,persistMarketplace} from '@/lib/supabase';

function metric(value:number,label:string,percent=false){
  return <div><strong>{value>0?(percent?`${value}%`:compact(value)):'—'}</strong><small>{label}</small></div>;
}
function platformsOf(c:Creator){
  return [...(c.platforms||[]),c.platform].filter((name,index,all)=>!!name&&all.indexOf(name)===index);
}

export function CreatorDiscovery({shortlistOnly=false,publicView=false}:{shortlistOnly?:boolean;publicView?:boolean}){
  const {s,update,go}=useStore();
  const params=useSearchParams();
  const path=usePathname();
  const [q,setQ]=useState(params.get('q')||''),[cat,setCat]=useState('All categories'),[platform,setPlatform]=useState('All platforms'),[budget,setBudget]=useState('Any rate'),[available,setAvailable]=useState(false),[sort,setSort]=useState('Recommended'),[selected,setSelected]=useState<Creator|null>(null),[invite,setInvite]=useState(false),[network,setNetwork]=useState(false),[campaign,setCampaign]=useState(''),[message,setMessage]=useState(''),[rate,setRate]=useState(100),[sending,setSending]=useState(false),[missing,setMissing]=useState(false);
  const live=persistMarketplace(s);
  const owned=s.campaigns;
  const publicId=path.match(/\/creators\/([^/]+)$/)?.[1]||'';
  useEffect(()=>{if(!s.session)return;let cancelled=false;void (async()=>{
    const directory=await listPublicCreators();
    if(cancelled)return;
    if(directory.error)toast.error(directory.error);
    update(p=>({...p,directoryCreators:directory.error||directory.skipped?realDirectoryCreators(p.directoryCreators):realDirectoryCreators(directory.creators||[])}));
    if(live){
      const [apps,conns]=await Promise.all([listMyApplications(),listMyConnections()]);
      if(cancelled)return;
      if(apps.error)toast.error(apps.error);
      if(conns.error)toast.error(conns.error);
      update(p=>({...p,applications:apps.skipped||apps.error?p.applications:apps.applications,connections:conns.skipped||conns.error?p.connections:conns.connections}));
    }
    if(publicId&&isUuid(publicId)){
      const detail=await getPublicCreator(publicId);
      if(cancelled)return;
      if(detail.error)toast.error(detail.error);
      if(detail.creator){setSelected(detail.creator);setMissing(false);}
      else if(!detail.skipped)setMissing(true);
    }
  })();return()=>{cancelled=true}},[live,s.session,s.profile.email,s.role,publicId]);
  const directory=realDirectoryCreators(s.directoryCreators);
  const filtered=directory.filter(c=>(!shortlistOnly||s.shortlist.includes(c.id))&&(!available||c.available)&&(cat==='All categories'||cat===c.niche)&&(platform==='All platforms'||platform===c.platform||(c.platforms||[]).includes(platform))&&(budget==='Any rate'||(budget==='Under $100'?c.rate>0&&c.rate<100:c.rate>=100))&&`${c.name} ${c.handle} ${c.bio} ${c.niche}`.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>sort==='Lowest rate'?a.rate-b.rate:sort==='Most followers'?b.followers-a.followers:sort==='Highest rated'?b.rating-a.rating:0);
  const toggle=(c:Creator)=>{if(!s.session){go(`/login?next=${encodeURIComponent(path||'/creators')}`);return}const has=s.shortlist.includes(c.id);update(p=>({...p,shortlist:has?p.shortlist.filter(x=>x!==c.id):[...p.shortlist,c.id]}));toast.success(has?'Creator removed from shortlist.':'Creator added to your shortlist.')};
  const workspaceBase=s.session?`/${s.role}`:'';
  function openConnect(c:Creator){
    if(!isCreatorUserId(c.id)){toast.error('Choose a creator to connect with.');return}
    if(!s.session){go(`/login?next=${encodeURIComponent(`/creators/${c.id}`)}`);return}
    if(c.id===s.authUserId){toast.error('Choose someone to connect with.');return}
    const rel=brandCreatorRelationship(c.id,s.applications,s.connections);
    if(rel.kind==='connected'||rel.kind==='closed'){go(`${workspaceBase}/collaborations/${rel.connectionId}`);return}
    if(rel.kind==='pending'){go(`${workspaceBase}/collaborations/${rel.applicationId}`);return}
    setSelected(c);
    if(s.role==='brand'&&owned.length){setCampaign(owned[0].id);setRate(c.rate>0?c.rate:100);setMessage('');setInvite(true);return}
    setMessage('');setNetwork(true);
  }
  function sendInvite(e:FormEvent){
    e.preventDefault();
    const c=owned.find(x=>x.id===campaign);
    if(!persistMarketplace(s)){toast.error('Sign in to connect.');return}
    if(!selected||!isCreatorUserId(selected.id)){toast.error('Choose a creator to connect with.');setInvite(false);return}
    if(!c){toast.error('Choose a campaign first.');return}
    if(sending)return;
    if(s.applications.some(a=>a.creatorId===selected.id&&a.campaignId===c.id&&(a.status==='pending'||a.status==='accepted'))){toast.error('You already have a pending request with this creator.');return}
    if(s.connections.some(n=>n.creatorId===selected.id&&n.campaignId===c.id)){toast.error('You’re already connected with this creator on this campaign.');return}
    setSending(true);
    void (async()=>{
      const result=await inviteCreatorToCampaign({campaignId:c.id,creatorId:selected.id,message,proposedRate:rate});
      setSending(false);
      if(result.error||!result.application){toast.error(result.error||'Could not send this request.');return}
      update(p=>({...p,applications:[result.application!,...p.applications.filter(a=>a.id!==result.application!.id)]}));
      setInvite(false);setSelected(null);toast.success('Request sent. They’ll see it in Collaborations.');
    })();
  }
  function sendNetwork(e:FormEvent){
    e.preventDefault();
    if(!selected||!isUuid(selected.id)){toast.error('Choose someone to connect with.');return}
    if(sending)return;
    setSending(true);
    void (async()=>{
      const result=await createNetworkConnection(selected.id,message);
      setSending(false);
      if(result.error||!result.connection){toast.error(result.error||'Could not create this connection.');return}
      update(p=>({...p,connections:[result.connection!,...p.connections.filter(c=>c.id!==result.connection!.id)]}));
      setNetwork(false);setSelected(null);toast.success('You’re connected.');
      if(s.session)go(`/${s.role}/collaborations/${result.connection.id}`);
    })();
  }
  const emptyDirectory=!directory.length;
  const emptyTitle=missing?'This profile is not publicly available.':shortlistOnly&&!s.shortlist.length?'Your next great partner belongs here.':emptyDirectory?'No creators available yet.':'No creators match just yet.';
  const emptyDescription=missing?'Only verified creators appear in the public directory.':shortlistOnly&&!s.shortlist.length?'Save creators from Discover to build your shortlist.':emptyDirectory?'Verified creator profiles appear here after CollabCy approval.':'Try a broader niche, platform, or budget.';
  if(missing)return <Empty title="Profile unavailable" description="This creator is not publicly available."><Button variant="secondary" onClick={()=>go(`/${s.role}/creators`)}>Browse creators</Button></Empty>;
  return <><PageTitle eyebrow="GREAT STORIES START WITH THE RIGHT VOICES" title={shortlistOnly?'Your creator shortlist':'Find your kind of creator'} description={shortlistOnly?'The voices you’d love to work with.':'Look beyond the numbers. Find a voice that feels like a great fit.'}>{s.role==='brand'&&s.session&&<Button onClick={()=>go('/brand/campaigns/new')}><Plus size={17}/> Create campaign</Button>}</PageTitle><section className="discovery-tools" aria-label="Search and filter creators"><div className="filters"><SearchBox value={q} onChange={setQ} placeholder="Search creators, niches, or keywords…"/><Pick value={cat} onChange={setCat} options={categories} label="Creator niche"/><Pick value={platform} onChange={setPlatform} options={['All platforms','X','Instagram','Facebook']} label="Creator platform"/><Pick value={budget} onChange={setBudget} options={['Any rate','Under $100','$100 and above']} label="Creator rate"/></div><div className="results-heading"><span><strong>{filtered.length}</strong> {filtered.length===1?'creator':'creators'}</span><div><label className="inline-switch"><Switch checked={available} onCheckedChange={setAvailable}/>Available now</label><span>Sort by</span><Pick value={sort} onChange={setSort} options={['Recommended','Lowest rate','Most followers','Highest rated']} label="Sort creators"/></div></div></section>{filtered.length?<div className="creator-grid">{filtered.map(c=><article className="creator-card" key={c.id}><div className="creator-card-top"><span className={c.available?'availability-badge':'away-badge'}>{c.available?'Available':'Currently booked'}</span>{s.session&&<button className={`icon-button ${s.shortlist.includes(c.id)?'saved':''}`} onClick={()=>toggle(c)} aria-label={`${s.shortlist.includes(c.id)?'Remove':'Save'} ${c.name||'creator'}`}><Bookmark size={19} fill={s.shortlist.includes(c.id)?'currentColor':'none'}/></button>}</div><Avatar name={c.name} image={c.avatar} color={c.color} size="xl"/><h3>{c.name||'Creator'}</h3>{c.handle?<span className="creator-handle">{c.handle}</span>:null}{c.niche?<span className="niche-label">{c.niche}</span>:null}{c.reviews>0?<Rating value={c.rating} count={c.reviews}/>:null}<p>{c.bio||'This creator hasn’t added a bio yet.'}</p><div className="creator-stats">{metric(c.followers,'Followers')}{metric(c.impressions,'Avg. impressions')}{metric(c.engagement,'Engagement',true)}</div><div className="creator-bottom"><div>{c.rate>0?<><strong>{money(c.rate)}</strong><small>starting rate</small></>:<small>Rate not listed</small>}</div><Button variant="secondary" onClick={()=>setSelected(c)}>View profile <ArrowUpRight size={15}/></Button></div></article>)}</div>:<Empty title={emptyTitle} description={emptyDescription}>{(!emptyDirectory||shortlistOnly)&&<Button variant="secondary" onClick={()=>shortlistOnly?go(`/${s.role}/creators`):(setQ(''),setCat('All categories'),setPlatform('All platforms'),setBudget('Any rate'),setAvailable(false))}>{shortlistOnly?'Discover creators':'Clear filters'}</Button>}</Empty>}<Sheet open={!!selected&&!invite&&!network} onOpenChange={o=>!o&&setSelected(null)}><SheetContent className="detail-sheet">{selected&&<><div className="creator-detail-head"><Avatar name={selected.name} image={selected.avatar} color={selected.color} size="xl"/><SheetTitle>{selected.name||'Creator'}</SheetTitle><SheetDescription>{[selected.handle,selected.location].filter(Boolean).join(' · ')||'Creator profile'}</SheetDescription>{selected.reviews>0?<Rating value={selected.rating} count={selected.reviews}/>:null}{selected.niche?<span className="niche-label">{selected.niche}</span>:null}</div><p>{selected.bio||'This creator hasn’t added a bio yet.'}</p><div className="creator-stats">{metric(selected.followers,'Followers')}{metric(selected.impressions,'Impressions')}{metric(selected.engagement,'Engagement',true)}</div><div className="detail-block"><h3>Platforms</h3>{platformsOf(selected).length?platformsOf(selected).map(name=><Platform key={name} name={name}/>):<p>No platforms listed yet.</p>}</div>{selected.website?<div className="detail-block"><h3>Website</h3><p>{selected.website}</p></div>:null}{(selected.portfolio||[]).length?<div className="detail-block"><h3>Portfolio</h3><ul>{selected.portfolio!.map(item=><li key={item}>{item}</li>)}</ul></div>:null}{selected.rate>0?<div className="detail-block"><h3>Starting rate</h3><div className="package-box"><div><strong>Collaboration rate</strong><p>Proposed by this creator. Final terms are agreed after connecting.</p></div><strong>{money(selected.rate)}</strong></div></div>:null}<div className="sheet-actions">{(()=>{if(!isCreatorUserId(selected.id)||selected.id===s.authUserId)return null;const rel=brandCreatorRelationship(selected.id,s.applications,s.connections);if(rel.kind==='connected'||rel.kind==='closed')return <Button className="full-width" onClick={()=>s.session?go(`/${s.role}/collaborations/${rel.connectionId}`):go(`/login?next=${encodeURIComponent(`/creators/${selected.id}`)}`)}>Open collaboration <ArrowRight size={17}/></Button>;if(rel.kind==='pending')return <Button className="full-width" onClick={()=>go(`/${s.role}/collaborations/${rel.applicationId}`)}>Request sent</Button>;return <Button className="full-width" onClick={()=>openConnect(selected)}>Connect <Send size={17}/></Button>})()}{s.session&&<Button variant="secondary" onClick={()=>toggle(selected)}>{s.shortlist.includes(selected.id)?'Remove from shortlist':'Save to shortlist'}</Button>}</div></>}</SheetContent></Sheet><Modal open={invite&&isCreatorUserId(selected?.id||'')} onClose={()=>!sending&&setInvite(false)} title={`Connect with ${selected?.name||'this creator'}`} description="Choose a campaign and tell them why this could be a great fit."><form onSubmit={sendInvite}><label className="field"><span>Campaign</span><Pick value={owned.find(c=>c.id===campaign)?.title||'Choose a campaign'} onChange={v=>setCampaign(owned.find(c=>c.title===v)?.id||'')} options={owned.map(c=>c.title)}/></label><Field label="Proposed rate (USD)" type="number" min={1} max={100000} required value={rate} onChange={e=>setRate(Number(e.target.value))}/><Textarea label="Your message" required minLength={15} maxLength={2000} value={message} onChange={e=>setMessage(e.target.value)} rows={4} placeholder="What made this creator stand out? Tell them about your campaign…"/><div className="form-footer"><Button type="button" variant="secondary" disabled={sending} onClick={()=>setInvite(false)}>Cancel</Button><Button type="submit" disabled={sending||!isCreatorUserId(selected?.id||'')}>{sending?'Sending…':'Send request'}<Send size={16}/></Button></div></form></Modal><Modal open={network&&isUuid(selected?.id||'')} onClose={()=>!sending&&setNetwork(false)} title={`Connect with ${selected?.name||'this account'}`} description="Send a short hello. This opens a conversation without creating a paid collaboration."><form onSubmit={sendNetwork}><Textarea label="Your message (optional)" maxLength={2000} value={message} onChange={e=>setMessage(e.target.value)} rows={4} placeholder="Hi, I’d like to connect on CollabCy…"/><div className="form-footer"><Button type="button" variant="secondary" disabled={sending} onClick={()=>setNetwork(false)}>Cancel</Button><Button type="submit" disabled={sending}>{sending?'Connecting…':'Connect'}<Send size={16}/></Button></div></form></Modal></>;
}

export function BrandDiscovery({publicView=false}:{publicView?:boolean}){
  const {s,update,go}=useStore();
  const params=useSearchParams();
  const path=usePathname();
  const [q,setQ]=useState(params.get('q')||''),[cat,setCat]=useState('All categories'),[sort,setSort]=useState('Recommended'),[selected,setSelected]=useState<Creator|null>(null),[network,setNetwork]=useState(false),[message,setMessage]=useState(''),[sending,setSending]=useState(false),[missing,setMissing]=useState(false);
  const live=persistMarketplace(s);
  const publicId=path.match(/\/brands\/([^/]+)$/)?.[1]||'';
  useEffect(()=>{if(!s.session)return;let cancelled=false;void (async()=>{
    const directory=await listPublicBrands();
    if(cancelled)return;
    if(directory.error)toast.error(directory.error);
    update(p=>({...p,directoryBrands:directory.error||directory.skipped?p.directoryBrands:directory.brands.filter(b=>isUuid(b.id))}));
    if(live){
      const conns=await listMyConnections();
      if(cancelled)return;
      if(conns.error)toast.error(conns.error);
      else if(!conns.skipped)update(p=>({...p,connections:conns.connections}));
    }
    if(publicId&&isUuid(publicId)){
      const detail=await getPublicBrand(publicId);
      if(cancelled)return;
      if(detail.error)toast.error(detail.error);
      if(detail.brand){setSelected(detail.brand);setMissing(false);}
      else if(!detail.skipped)setMissing(true);
    }
  })();return()=>{cancelled=true}},[live,s.session,s.profile.email,s.role,publicId]);
  const directory=(s.directoryBrands||[]).filter(b=>isUuid(b.id));
  const filtered=directory.filter(c=>(cat==='All categories'||cat===c.niche)&&`${c.name} ${c.handle} ${c.bio} ${c.niche} ${c.website}`.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>a.name.localeCompare(b.name));
  function openConnect(c:Creator){
    if(!isUuid(c.id)){toast.error('Choose someone to connect with.');return}
    if(!s.session){go(`/login?next=${encodeURIComponent(`/brands/${c.id}`)}`);return}
    if(c.id===s.authUserId){toast.error('Choose someone to connect with.');return}
    const rel=brandCreatorRelationship(c.id,s.applications,s.connections);
    if(rel.kind==='connected'||rel.kind==='closed'){go(`/${s.role}/collaborations/${rel.connectionId}`);return}
    setSelected(c);setMessage('');setNetwork(true);
  }
  function sendNetwork(e:FormEvent){
    e.preventDefault();
    if(!selected||!isUuid(selected.id)){toast.error('Choose someone to connect with.');return}
    if(sending)return;
    setSending(true);
    void (async()=>{
      const result=await createNetworkConnection(selected.id,message);
      setSending(false);
      if(result.error||!result.connection){toast.error(result.error||'Could not create this connection.');return}
      update(p=>({...p,connections:[result.connection!,...p.connections.filter(c=>c.id!==result.connection!.id)]}));
      setNetwork(false);setSelected(null);toast.success('You’re connected.');
      if(s.session)go(`/${s.role}/collaborations/${result.connection.id}`);
    })();
  }
  if(missing)return <Empty title="Profile unavailable" description="This brand is not publicly available."><Button variant="secondary" onClick={()=>go(`/${s.role}/brands`)}>Browse brands</Button></Empty>;
  const emptyDirectory=!directory.length;
  return <><PageTitle eyebrow="BRANDS BUILDING IN PUBLIC" title="Find brands on CollabCy" description="Browse brand profiles. Connect when you see a fit."/><section className="discovery-tools" aria-label="Search and filter brands"><div className="filters"><SearchBox value={q} onChange={setQ} placeholder="Search brands, niches, or keywords…"/><Pick value={cat} onChange={setCat} options={categories} label="Brand category"/></div><div className="results-heading"><span><strong>{filtered.length}</strong> {filtered.length===1?'brand':'brands'}</span><div><span>Sort by</span><Pick value={sort} onChange={setSort} options={['Recommended']} label="Sort brands"/></div></div></section>{filtered.length?<div className="creator-grid">{filtered.map(c=><article className="creator-card" key={c.id}><div className="creator-card-top"><span className="availability-badge">Brand</span></div><Avatar name={c.name} image={c.avatar} color={c.color} size="xl"/><h3>{c.name||'Brand'}</h3>{c.handle?<span className="creator-handle">{c.handle}</span>:null}{c.niche?<span className="niche-label">{c.niche}</span>:null}<p>{c.bio||'This brand hasn’t added a description yet.'}</p><div className="creator-bottom"><div>{c.website?<small>{c.website}</small>:<small>Website not listed</small>}</div><Button variant="secondary" onClick={()=>setSelected(c)}>View profile <ArrowUpRight size={15}/></Button></div></article>)}</div>:<Empty title={emptyDirectory?'No brands available yet.':'No brands match just yet.'} description={emptyDirectory?'Brand profiles appear here as brands join CollabCy.':'Try another category or keyword.'}>{!emptyDirectory&&<Button variant="secondary" onClick={()=>{setQ('');setCat('All categories')}}>Clear filters</Button>}</Empty>}<Sheet open={!!selected&&!network} onOpenChange={o=>!o&&setSelected(null)}><SheetContent className="detail-sheet">{selected&&<><div className="creator-detail-head"><Avatar name={selected.name} image={selected.avatar} color={selected.color} size="xl"/><SheetTitle>{selected.name||'Brand'}</SheetTitle><SheetDescription>{[selected.handle,selected.location].filter(Boolean).join(' · ')||'Brand profile'}</SheetDescription>{selected.niche?<span className="niche-label">{selected.niche}</span>:null}</div><p>{selected.bio||'This brand hasn’t added a description yet.'}</p><div className="detail-block"><h3>Platforms</h3>{platformsOf(selected).length?platformsOf(selected).map(name=><Platform key={name} name={name}/>):<p>No platforms listed yet.</p>}</div>{selected.website?<div className="detail-block"><h3>Website</h3><p>{selected.website}</p></div>:null}{(selected.portfolio||[]).length?<div className="detail-block"><h3>Links</h3><ul>{selected.portfolio!.map(item=><li key={item}>{item}</li>)}</ul></div>:null}<div className="sheet-actions">{selected.id!==s.authUserId&&<Button className="full-width" onClick={()=>openConnect(selected)}>Connect <Send size={17}/></Button>}</div></>}</SheetContent></Sheet><Modal open={network&&isUuid(selected?.id||'')} onClose={()=>!sending&&setNetwork(false)} title={`Connect with ${selected?.name||'this brand'}`} description="Send a short hello. This opens a conversation without creating a paid collaboration."><form onSubmit={sendNetwork}><Textarea label="Your message (optional)" maxLength={2000} value={message} onChange={e=>setMessage(e.target.value)} rows={4} placeholder="Hi, I’d like to connect on CollabCy…"/><div className="form-footer"><Button type="button" variant="secondary" disabled={sending} onClick={()=>setNetwork(false)}>Cancel</Button><Button type="submit" disabled={sending}>{sending?'Connecting…':'Connect'}<Send size={16}/></Button></div></form></Modal></>;
}
