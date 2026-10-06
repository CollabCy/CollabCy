'use client';
import {useEffect,useState,useRef,type ReactNode} from 'react';
import Link from '../ui/app-link';
import {ArrowUpRight,ArrowRight,ArrowUp,Users,ChartNoAxesColumnIncreasing,Zap,Orbit,Command,CheckCircle2,Globe,TrendingUp,Clock} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Button,Field,DemoNote} from '../ui/shared';
import {useAttention} from './store';
import {useStore} from '../store';
import {getRankedProducts,getMarketplaceStats,getMinimumBidForPosition,getProjectedRank,isActive,timeAgo,validateBid,safeWebsite,websiteHost,type Product,type ActivityEvent} from './model';
import {money,compact} from '../data';
import {getSupabase} from '@/lib/supabase';
import {bidLoginPath} from '@/lib/attention-payments';

export function ProductLogo({product,small=false}:{product:Product;small?:boolean}){
  return <span className={`attention-logo ${small?'small':''}`} style={{background:product.color}}>{product.logo.startsWith('data:image/')?<img src={product.logo} alt=""/>:product.logo==='orbit'?<Orbit/>:product.logo==='frame'?<Command/>:product.logo.slice(0,1)}</span>;
}
export function LiveBadge(){return <span className="attention-live"><i/>LIVE</span>;}
export function lastBidAddOn(product:Product){
  if(product.bids.length<2)return null;
  const delta=product.bids[0].amount-product.bids[1].amount;
  return delta>0?delta:null;
}
function previousBidForEvent(product:Product,event:ActivityEvent){
  return product.bids.find(bid=>bid.createdAt<event.createdAt)?.amount;
}
export function ModeSwitch({discover=false}:{discover?:boolean}){
  return <nav className={`attention-modes ${discover?'discover-active':''}`} aria-label="Explore CollabCy">
    <span className="attention-mode-indicator"/>
    <Link href="/" aria-current={!discover?'page':undefined}>
      <span className="mode-icon"><Users/></span>
      <span><strong>COLLABORATE <em className="mode-preview">Preview</em></strong><small>Work with creators & brands</small></span>
    </Link>
    <Link href="/brands" aria-current={discover?'page':undefined}>
      <span className="mode-icon"><ChartNoAxesColumnIncreasing/></span>
      <span><strong>DISCOVER <em><i/>LIVE</em></strong><small>Explore the attention marketplace</small></span>
    </Link>
  </nav>;
}
export function AttentionEntry(){
  const {state}=useAttention();
  const ranked=getRankedProducts(state.products);
  const stats=getMarketplaceStats(state.products);
  const [index,setIndex]=useState(0),[paused,setPaused]=useState(false);
  useEffect(()=>{
    const motion=matchMedia('(prefers-reduced-motion: reduce)');
    if(paused||motion.matches)return;
    const t=setInterval(()=>setIndex(v=>v+1),6000);
    const stop=()=>{if(motion.matches)clearInterval(t)};
    motion.addEventListener('change',stop);
    return()=>{clearInterval(t);motion.removeEventListener('change',stop)};
  },[paused]);
  const events=state.activity.filter(a=>ranked.some(p=>p.id===a.productId));
  const event=events[index%Math.max(1,events.length)];
  const moved=ranked.find(p=>p.id===event?.productId);
  const leader=ranked[0];
  return <section className={`attention-entry ${paused?'motion-paused':''}`} aria-label="Explore the attention marketplace">
    <div className="public-container">
      <div className="attention-banner">
        {leader?<div className="banner-leader"><ProductLogo product={leader}/><div><span className="banner-label"><i/>LIVE ON COLLABCY</span><strong>#1 spot <ArrowRight size={17}/> {leader.name}</strong><small>{money(leader.currentBid)} current bid · {leader.clickCount} visits</small></div></div>:<div><strong>Your product could be first.</strong></div>}
        <div className="banner-movement"><ArrowUp className="movement-icon"/><div className="banner-cycle" key={event?.id}><span className="banner-label">LATEST ACTIVITY</span><strong>{moved?.name||'The marketplace'} {event?.type==='listing'?'just joined':'placed a bid'}</strong><small>{event?.amount?`${money(event.amount)} bid`:'Discover something new'}</small></div></div>
        <div className="banner-community"><span className="mode-icon"><Users/></span><div><span className="banner-label">BRANDS ARE BIDDING</span><strong>{stats.activeProducts} active products</strong><small>Creators are discovering them</small></div></div>
        <Link className="banner-explore" href="/brands"><Zap/><div><span className="banner-label">DISCOVER WHAT’S GETTING PROMOTED</span><strong>Explore the live marketplace <ArrowRight size={17}/></strong></div></Link>
      </div>
      <div className="attention-demo-line"><span>Attention Marketplace · Listings remain unpaid demo · Bids use Dodo Test Mode</span><button onClick={()=>setPaused(v=>!v)} aria-pressed={paused}>{paused?'Resume motion':'Pause motion'}</button></div>
    </div>
    <div className="attention-marquee"><div className="marquee-track">{[0,1].map(copy=><div className="marquee-group" key={copy} aria-hidden={copy===1}>{ranked.map(p=><span key={p.id}><ProductLogo product={p} small/>{p.name}<b>·</b></span>)}</div>)}</div></div>
    <div className="public-container"><p className="explore-label">EXPLORE COLLABCY</p><ModeSwitch/></div>
  </section>;
}
function VisitSpark({products}:{products:Product[]}){
  const now=Date.now();
  const days=7;
  const midnight=new Date(now);
  midnight.setHours(0,0,0,0);
  const start=midnight.getTime()-(days-1)*86400000;
  const buckets=Array.from({length:days},()=>0);
  for(const product of products){
    for(const time of product.visitTimes){
      if(time>=start&&time<=now){
        const index=Math.floor((time-start)/86400000);
        if(index>=0&&index<days)buckets[index]+=1;
      }
    }
  }
  const max=Math.max(1,...buckets);
  return <div className="summary-spark" aria-hidden="true">{buckets.map((count,index)=>{
    const label=new Date(start+index*86400000).toLocaleDateString('en-US',{weekday:'short'}).slice(0,2);
    return <div key={label+index}><i style={{height:`${Math.max(12,(count/max)*100)}%`}}/><small>{label}</small></div>;
  })}</div>;
}
export function MarketplaceSummary(){
  const {state}=useAttention();
  const stats=getMarketplaceStats(state.products);
  const ranked=getRankedProducts(state.products);
  const cumulative=ranked.reduce((sum,product)=>sum+product.currentBid,0);
  const empty=!stats.activeProducts&&!stats.visitsToday&&!cumulative;
  return <aside className="attention-summary">
    <div className="summary-signal-heading"><span><ChartNoAxesColumnIncreasing size={18}/> MARKETPLACE PULSE</span><LiveBadge/></div>
    <div className="summary-numbers">
      <div><strong>{stats.activeProducts}</strong><small>Active products</small></div>
      <div><strong>{compact(stats.visitsToday)}</strong><small>Visits today</small></div>
      <div><strong>{money(cumulative)}</strong><small>Cumulative bids</small></div>
    </div>
    {empty
      ? <p className="summary-footnote"><Zap size={14}/>Every marketplace starts with a first mover.</p>
      : <><p className="summary-caption">Visits · last 7 days</p><VisitSpark products={state.products}/></>}
  </aside>;
}
export function ActivityList({events,limit=5}:{events:ActivityEvent[];limit?:number}){
  const {state}=useAttention();
  const rows=events.slice(0,limit).flatMap(event=>{
    const product=state.products.find(item=>item.id===event.productId);
    if(!product)return [];
    const previous=event.type==='bid'&&event.amount!=null?previousBidForEvent(product,event):undefined;
    const addOn=previous!=null&&event.amount!=null?event.amount-previous:null;
    const detail=event.type==='listing'
      ? 'joined'
      : event.type==='visit'
        ? 'received a visit'
        : addOn!=null&&addOn>0&&previous!=null&&event.amount!=null
          ? `added +${money(addOn)} / ${money(previous)} → ${money(event.amount)}`
          : `updated bid to ${money(event.amount||0)}`;
    return [<li key={event.id}>
      <ProductLogo product={product} small/>
      <div>
        <strong>{product.name}</strong>
        <span>{detail}</span>
        {event.rank?<b>Moved to #{event.rank}</b>:null}
      </div>
      <small>{timeAgo(event.createdAt)}</small>
    </li>];
  });
  return <ol className="attention-activity">{rows}{!rows.length&&<li className="activity-quiet"><span className="activity-quiet-mark"><TrendingUp size={18}/></span><strong>Quiet for now.</strong><small>New products and ranking changes will appear here.</small></li>}</ol>;
}
export function MarketDialog({open,onClose,title,description,children,returnFocusId}:{open:boolean;onClose:()=>void;title:string;description:string;children:ReactNode;returnFocusId?:string}){
  const trigger=useRef<HTMLElement|null>(null);
  return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent className="attention-dialog" onOpenAutoFocus={()=>{trigger.current=document.activeElement as HTMLElement;}} onCloseAutoFocus={e=>{const target=trigger.current?.isConnected?trigger.current:returnFocusId?document.getElementById(returnFocusId):null;if(target){e.preventDefault();target.focus();}}}><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription>{children}</DialogContent></Dialog>;
}
export function VisitDialog({productId,onClose,onBid}:{productId:string|null;onClose:()=>void;onBid:(id:string)=>void}){
  const {state,repository}=useAttention();
  const p=state.products.find(p=>p.id===productId);
  return <MarketDialog returnFocusId={p?`visit-${p.id}`:undefined} open={!!p} onClose={onClose} title={p?.name||'Product information'} description={p?`By ${p.brandName}`:'Discover a product'}>{p&&<><div className="visit-intro"><ProductLogo product={p}/><p>{p.description}</p></div><div className="attention-tags"><span>{p.category}</span>{p.tags.map(t=><span key={t}>{t}</span>)}</div><ProductMetrics product={p}/><div className="visit-website"><Globe size={20}/><div><small>WEBSITE · DEMO DESTINATION</small><strong>{websiteHost(p.websiteUrl)}</strong></div><ArrowUpRight size={18}/></div>{p.campaign&&<div className="attention-opportunity"><span>OPTIONAL CREATOR OPPORTUNITY</span><strong>{p.campaign.title}</strong><p>Budget: {money(p.campaign.budget)}</p></div>}<div className="attention-dialog-actions"><Button onClick={()=>{const href=safeWebsite(p.websiteUrl);if(!href)return;void Promise.resolve(repository.simulateVisit(p.id)).catch(error=>{console.error('[attention]', error);});if(p.brandId!=='demo')window.open(href,'_blank','noopener,noreferrer');}}>{p.brandId==='demo'?'Try demo visit':'Visit website'} <ArrowUpRight size={17}/></Button><Button variant="secondary" disabled={!isActive(p)||p.brandId==='demo'} onClick={()=>onBid(p.id)}>{isActive(p)?'Place bid':'Listing expired'}</Button></div><Link className="text-link" href={`/brands/product/${p.slug}`} onClick={onClose}>Product details & bid history <ArrowRight size={15}/></Link><DemoNote>Website visits stay open without an account. Placing a bid requires a signed-in Dodo Test Mode checkout.</DemoNote></>}</MarketDialog>;
}
export function ProductMetrics({product:p}:{product:Product}){
  const {state}=useAttention();
  const rank=getRankedProducts(state.products).findIndex(x=>x.id===p.id)+1;
  return <div className="product-metrics"><div><strong>{money(p.currentBid)}</strong><small>Current bid</small></div><div><strong>{rank===1?'Crown Jewel':rank>1?`#${rank-1}`:'Expired'}</strong><small>Position</small></div><div><strong key={p.clickCount}>{p.clickCount}</strong><small>Website clicks</small></div><div><strong>{timeAgo(p.bids[0]?.createdAt||p.listingStartsAt)}</strong><small>Last bid</small></div></div>;
}
export function BidDialog({productId,onClose,initialIncrement}:{productId:string|null;onClose:()=>void;initialIncrement?:number}){
  const {state}=useAttention();
  const {s,go}=useStore();
  const p=state.products.find(p=>p.id===productId);
  const [step,setStep]=useState<'amount'|'review'>('amount'),[amount,setAmount]=useState(''),[error,setError]=useState('');
  const busy=useRef(false);
  const min=p?getMinimumBidForPosition(state.products,p.id):null;
  const paidMin=min?Math.max(min,2):2;
  const rankNow=p?getRankedProducts(state.products).findIndex(item=>item.id===p.id)+1:0;
  useEffect(()=>{
    setStep('amount');
    setError('');
    busy.current=false;
    const product=state.products.find(item=>item.id===productId);
    const next=product?getMinimumBidForPosition(state.products,product.id):null;
    const floor=next?Math.max(next,2):2;
    setAmount(initialIncrement&&initialIncrement>=floor?String(initialIncrement):String(floor));
  },[productId,initialIncrement]);
  const value=Number(amount);
  const nextBid=p&&Number.isInteger(value)?p.currentBid+value:NaN;
  const validation=p?validateBid(state.products,p.id,value)||(Number.isInteger(value)&&value<2?'Enter at least $2.':''):'';
  const rank=p&&amount&&!validation?getProjectedRank(state.products,nextBid,p.id):null;
  function advance(){
    if(!amount.trim()||validation){setError(!amount.trim()?'Enter your bid increase.':validation);return;}
    setError('');
    setStep('review');
  }
  async function startCheckout(){
    if(!p||busy.current)return;
    if(!amount.trim()||validation){setError(!amount.trim()?'Enter your bid increase.':validation);return;}
    if(!s.session){
      go(bidLoginPath(p.slug,value));
      return;
    }
    busy.current=true;
    setError('');
    try{
      const supabase=getSupabase();
      const token=(await supabase?.auth.getSession())?.data.session?.access_token;
      if(!token){
        go(bidLoginPath(p.slug,value));
        return;
      }
      const response=await fetch('/api/attention/checkout',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({product_id:p.id,increment:value}),
      });
      const payload=await response.json().catch(()=>({})) as {checkout_url?:unknown;error?:unknown};
      if(response.status===401){
        go(bidLoginPath(p.slug,value));
        return;
      }
      if(!response.ok||typeof payload.checkout_url!=='string'||!payload.checkout_url){
        setError(typeof payload.error==='string'&&payload.error?payload.error:'Could not start checkout.');
        return;
      }
      window.location.assign(payload.checkout_url);
    }catch{
      setError('Could not start checkout.');
    }finally{
      busy.current=false;
    }
  }
  return <MarketDialog returnFocusId={p?`bid-${p.id}`:undefined} open={!!p} onClose={onClose} title={step==='review'?'Review your bid':'Move into the spotlight.'} description={`Bid for ${p?.name||'a product'} · Sign in required`}>
    {p&&<>
      <div className="bid-product"><ProductLogo product={p} small/><div><strong>{p.name}</strong><span>{p.category}</span></div><a className="btn btn-secondary" href={safeWebsite(p.websiteUrl)||undefined} target="_blank" rel="noopener noreferrer">Visit website <ArrowUpRight size={14}/></a></div>
      <div className="bid-clear" aria-label="Current bid, your new bid, and required add-on">
        <div>
          <small>CURRENT BID</small>
          <strong>{money(p.currentBid)}</strong>
        </div>
        <div className="bid-clear-new">
          <small>YOUR NEW BID</small>
          <strong>{Number.isFinite(nextBid)?money(nextBid):'—'}</strong>
        </div>
        <div>
          <small>REQUIRED ADD-ON</small>
          <strong>{Number.isInteger(value)?`+${money(value)}`:`+${money(paidMin)}`}</strong>
        </div>
      </div>
      <p className="bid-clear-note">Pay only the add-on through Dodo Test Mode checkout. Rankings update after payment is confirmed.</p>
      <div className="bid-progress"><span className={step==='amount'?'active':''}>1. Amount</span><span className={step==='review'?'active':''}>2. Review</span><span className={step==='review'?'active':''}>3. Dodo checkout</span></div>
      {step==='amount'
        ? <form onSubmit={e=>{e.preventDefault();if(!s.session){if(!amount.trim()||validation){setError(!amount.trim()?'Enter your bid increase.':validation);return;}go(bidLoginPath(p.slug,value));return;}advance();}} noValidate>
            <div className="bid-targets">
              <span>Target position <b>#{rank||rankNow||'—'}</b></span>
              {rankNow>1&&<span>Current leader <b>{money(getRankedProducts(state.products)[0]?.currentBid||0)}</b></span>}
            </div>
            <div className="bid-minimum"><TrendingUp size={18}/><span>Minimum add-on to improve position <strong>{min?money(Math.max(min,2)):'Listing expired'}</strong></span></div>
            <Field label="Your bid increase (USD)" type="number" min={paidMin} max={Math.max(paidMin,100000-p.currentBid)} step={1} value={amount} onChange={e=>{setAmount(e.target.value);setError('');}} placeholder={String(paidMin)} aria-describedby="bid-feedback" autoFocus/>
            <p id="bid-feedback" className={error?'attention-error':'bid-projection'} role="status">{error||(rank?`New cumulative bid ${money(nextBid)} · You will move to #${rank}.`:amount?validation:'Enter a whole-dollar increase to preview your position.')}</p>
            <Button className="full-width" type="submit" disabled={!isActive(p)}>{s.session?`Continue · ${Number.isInteger(value)?money(value):money(paidMin)}`:'Sign in to place a bid'}<ArrowRight size={16}/></Button>
            <p className="bid-disclaimer"><Clock size={13}/>Rankings may change before payment is confirmed.</p>
          </form>
        : <>
            <dl className="attention-receipt">
              <div><dt>Product</dt><dd>{p.name}</dd></div>
              <div><dt>Current bid</dt><dd>{money(p.currentBid)} <small>cumulative total</small></dd></div>
              <div><dt>Your add-on</dt><dd>{money(value)}</dd></div>
              <div><dt>New bid</dt><dd>{money(nextBid)} <small>new cumulative total</small></dd></div>
              <div><dt>Projected position</dt><dd>#{rank||'—'}</dd></div>
              <div className="receipt-total"><dt>Test Mode payment</dt><dd>{money(value)}</dd></div>
            </dl>
            <div className="demo-payment"><CheckCircle2/><div><strong>Dodo Payments · Test Mode</strong><p>You will be redirected to Dodo to pay the add-on only. This is Test Mode billing, not live production charges. Returning to CollabCy does not apply the bid by itself.</p></div></div>
            {error&&<p className="attention-error" role="alert">{error}</p>}
            <div className="attention-dialog-actions">
              <Button variant="secondary" onClick={()=>setStep('amount')}>Edit bid</Button>
              <Button onClick={()=>void startCheckout()}>{s.session?'Pay with Dodo':'Sign in to continue'}<ArrowRight size={16}/></Button>
            </div>
          </>}
      <DemoNote>Paid bids require a CollabCy account and Dodo Test Mode checkout. The bid is applied only after Dodo confirms payment.</DemoNote>
    </>}
  </MarketDialog>;
}
