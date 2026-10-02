'use client';
import {useEffect,useRef,useState} from 'react';
import Link from '../ui/app-link';
import {ArrowUpRight,ArrowRight,Check,Trophy,Layers,TrendingUp,Users,MousePointer2,ChevronRight,Search,Heart,BarChart3,Crown,Sparkles} from 'lucide-react';
import {Accordion,AccordionItem,AccordionTrigger,AccordionContent} from '@/components/ui/accordion';
import {PublicHeader,PublicFooter} from '../ui/public';
import {Button,SearchBox,Empty,DemoNote} from '../ui/shared';
import {useStore} from '../store';
import {money} from '../data';
import {useAttention} from './store';
import {attentionCategories,getRankedProducts,getFilteredProducts,isActive,timeAgo,websiteHost,LISTING_FEE,LISTING_DAYS,MIN_INITIAL_BID,type MarketplaceFilters,type Product} from './model';
import {ProductLogo,LiveBadge,ActivityList,VisitDialog,BidDialog,ProductMetrics,lastBidAddOn} from './components';

const faqs=[
  ['How does ranking work?','Products with higher current bids rank higher. When bids are equal, the earlier bid keeps its position. Expired listings leave the active leaderboard. Dollar amounts are simulated demo values and no real money is charged. Ranking and bid state are stored and updated in the CollabCy backend.'],
  ['How much does it cost to list a product?',`A ${LISTING_DAYS}-day product listing has a $${LISTING_FEE} listing fee, plus your chosen initial bid (from $${MIN_INITIAL_BID}). Brand account access is free. These dollar amounts are simulated demo values. No real money is currently charged.`],
  ['Can I update my bid later?','Yes. Open a product and choose Place bid. The minimum shown is the amount needed to move above the next product, or increase the leading bid. Review your projected rank before confirming.'],
  ['What happens when a listing expires?','It leaves the active leaderboard and cannot receive new bids. Its product details and bid history remain available.'],
  ['Do I need an account to place a bid?','No. Browsing, bidding, and listing a product do not require a CollabCy account. No real payment is collected.'],
  ['Can I use the marketplace only for website visits?','Yes. Attention Marketplace listings are for product discovery, visibility, and website traffic.'],
  ['Can creators discover my product without a campaign?','Yes. Every active product is public. Visitors can explore its details and website from the leaderboard.'],
];

export function usePromote(){
  const {go}=useStore();
  return ()=>{go('/brand/products/new');};
}

export function AttentionMarketplace(){
  const {state,repository}=useAttention();
  const promote=usePromote();
  const [filters,setFilters]=useState<MarketplaceFilters>({query:'',category:'All',time:'all'});
  const [visit,setVisit]=useState<string|null>(null);
  const [bid,setBid]=useState<string|null>(null);
  const [allActivity,setAllActivity]=useState(false);
  const ranked=getRankedProducts(state.products);
  const filtered=getFilteredProducts(state.products,filters);
  const setCategory=(category:string)=>setFilters(v=>({...v,category}));
  const loading=repository.getStatus()==='loading';
  const leader=ranked[0];
  return <>
    <PublicHeader/>
    <main className="attention-page attention-editorial">
      <section className="attention-hero">
        <div className="public-container">
          <div className="attention-hero-grid">
            <div className="editorial-hero-copy">
              <div className="attention-eyebrow"><LiveBadge/><span>BRANDS ARE COMPETING FOR ATTENTION</span></div>
              <h1>ATTENTION<span>MARKETPLACE</span></h1>
              <p>Where brands compete for attention — and creators discover their next opportunity.</p>
              <div className="hero-actions">
                <a className="btn btn-primary" href="#products">Explore products <ArrowRight size={17}/></a>
                <button className="btn btn-secondary" type="button" onClick={promote}>List your product <ArrowRight size={16}/></button>
              </div>
              <div className="attention-trust">
                <span><Search size={15}/>Product discovery</span>
                <span><BarChart3 size={15}/>Live demo bidding</span>
                <span><Heart size={15}/>Find your next favorite</span>
              </div>
            </div>
            <HeroStage/>
          </div>
        </div>
      </section>
      <section className="public-container attention-market" id="products" aria-label="Product marketplace">
        <div className="attention-market-grid">
          <div className="attention-board">
            <div className="attention-board-head">
              <div>
                <span className="editorial-kicker">THE LIVE PRODUCT INDEX</span>
                <h2>Products competing for attention<span className="editorial-period">.</span></h2>
                <p>Real products. Real brands. Real opportunities.</p>
              </div>
            </div>
            <div className="attention-toolbar">
              <div className="attention-controls">
                <div className="attention-time" role="group" aria-label="Activity period">
                  <button aria-pressed={filters.time==='all'} onClick={()=>setFilters(v=>({...v,time:'all'}))}>All time</button>
                  <button aria-pressed={filters.time==='48h'} onClick={()=>setFilters(v=>({...v,time:'48h'}))}>Last 48 hours</button>
                </div>
                <div id="market-search"><SearchBox placeholder="Search products, brands, or categories…" value={filters.query} onChange={query=>setFilters(v=>({...v,query}))}/></div>
              </div>
              <CategoryChips value={filters.category} onChange={setCategory}/>
            </div>
            {filtered.length
              ? <div className="attention-products" role="list">
                  {filtered.map(product=>{
                    const rank=ranked.findIndex(item=>item.id===product.id)+1;
                    return <LeaderboardRow key={product.id} product={product} rank={rank} onVisit={()=>setVisit(product.id)} onBid={()=>setBid(product.id)}/>;
                  })}
                </div>
              : loading
                ? null
                : !ranked.length
                  ? <BoardEmpty onList={promote}/>
                  : <div className="attention-filter-empty">
                      <span><Search size={18}/></span>
                      <div><strong>No matching products.</strong><p>Try another search or category.</p></div>
                      <Button variant="secondary" onClick={()=>setFilters({query:'',category:'All',time:'all'})}>Clear filters</Button>
                    </div>}
          </div>
          <aside className="attention-sidebar">
            <ClaimSpot leader={leader} onBid={()=>leader&&setBid(leader.id)} onList={promote}/>
            <section className="attention-side-card activity-card">
              <div className="attention-side-title">
                <h2><i/>Live activity</h2>
                <button onClick={()=>setAllActivity(v=>!v)}>{allActivity?'Show less':'View all'}</button>
              </div>
              <ActivityList events={state.activity} limit={allActivity?state.activity.length:5}/>
            </section>
          </aside>
        </div>
      </section>
      <section className="public-container attention-how" id="marketplace-how">
        <div className="center-heading">
          <span className="editorial-kicker">02 / FROM LISTED TO DISCOVERED</span>
          <h2>How the Attention Marketplace works</h2>
          <p>A simple and transparent way to get discovered.</p>
        </div>
        <div className="attention-steps">
          {[
            {icon:Layers,title:'List your product',text:'Tell creators what you’re building. Your bid determines your ranking.'},
            {icon:TrendingUp,title:'Add to your bid',text:'Increase your position anytime by adding only the simulated add-on. No real money is charged.'},
            {icon:Users,title:'Move up the ranking',text:'Climb as your cumulative bid grows.'},
            {icon:Trophy,title:'Get discovered',text:'Creators explore and find your product.'},
          ].map(({icon:Icon,title,text},index)=><div key={title}><span>{String(index+1).padStart(2,'0')}</span><Icon/><h3>{title}</h3><p>{text}</p></div>)}
        </div>
      </section>
      <section className="public-container">
        <div className="attention-cta">
          <div><span>READY TO GET DISCOVERED?</span><h2>List your product today.</h2><p>Join the Attention Marketplace and get in front of creators.</p></div>
          <Button variant="secondary" onClick={promote}>List your product <ArrowUpRight size={18}/></Button>
        </div>
      </section>
      <section className="public-container attention-faq">
        <div>
          <span className="eyebrow">03 / A LITTLE MORE CLARITY</span>
          <h2>Frequently asked questions</h2>
          <p>Good questions. Clear answers.</p>
          <Link href="/help" className="text-link">Visit the help center <ArrowRight size={16}/></Link>
        </div>
        <Accordion type="single" collapsible>
          {faqs.map(([question,answer],index)=><AccordionItem key={question} value={String(index)}><AccordionTrigger>{question}</AccordionTrigger><AccordionContent>{answer}</AccordionContent></AccordionItem>)}
        </Accordion>
      </section>
    </main>
    <PublicFooter/>
    <VisitDialog productId={visit} onClose={()=>setVisit(null)} onBid={id=>{setVisit(null);setBid(id);}}/>
    <BidDialog productId={bid} onClose={()=>setBid(null)}/>
  </>;
}

function CategoryChips({value,onChange}:{value:string;onChange:(category:string)=>void}){
  const scroller=useRef<HTMLDivElement>(null);
  const [overflows,setOverflows]=useState(false);
  const [canScrollMore,setCanScrollMore]=useState(false);
  useEffect(()=>{
    const el=scroller.current;
    if(!el)return;
    const update=()=>{
      const extra=el.scrollWidth-el.clientWidth;
      setOverflows(extra>4);
      const last=el.querySelector('button:last-of-type');
      if(!last){setCanScrollMore(false);return;}
      const edge=el.getBoundingClientRect().right-36;
      setCanScrollMore(last.getBoundingClientRect().right>edge+1);
    };
    update();
    el.addEventListener('scroll',update,{passive:true});
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(update);
    observer?.observe(el);
    window.addEventListener('resize',update);
    return()=>{
      el.removeEventListener('scroll',update);
      observer?.disconnect();
      window.removeEventListener('resize',update);
    };
  },[]);
  const scrollRight=()=>{
    const el=scroller.current;
    if(!el)return;
    const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({left:Math.max(Math.round(el.clientWidth*.62),180),behavior:reduce?'auto':'smooth'});
  };
  return <div className={`attention-chip-strip${overflows?' is-overflowing':''}${canScrollMore?' has-more':''}`}>
    <div ref={scroller} className="attention-chips" role="group" aria-label="Product categories">
      {['All',...attentionCategories].map(category=><button type="button" key={category} aria-pressed={value===category} onClick={()=>onChange(category)}>{category}</button>)}
    </div>
    <button type="button" className="attention-chip-next" aria-label="Scroll categories right" disabled={!canScrollMore} tabIndex={overflows?0:-1} onClick={scrollRight}><ArrowRight size={16} aria-hidden="true"/></button>
  </div>;
}

function Breadcrumb({name}:{name?:string}){
  return <nav className="attention-breadcrumb" aria-label="Breadcrumb">
    <Link href="/">Home</Link>
    <ChevronRight size={13}/>
    {name?<><Link href="/discover">Discover</Link><ChevronRight size={13}/><span aria-current="page">{name}</span></>:<span aria-current="page">Discover</span>}
  </nav>;
}

function HeroStage(){
  return <div className="hero-stage" aria-hidden="true">
    <div className="hero-stage-glow"/>
    <div className="hero-stage-arrow"><TrendingUp size={72}/></div>
    <div className="hero-float float-a">
      <span className="hero-float-mark mark-x">×</span>
      <div><b>Live ranking</b><small>Products rise as bids grow</small></div>
      <em><Sparkles size={11}/> #3 Trending</em>
    </div>
    <div className="hero-float float-b">
      <span className="hero-float-mark mark-o">○</span>
      <div><b>Attention lead</b><small>Highest cumulative bid sits first</small></div>
      <em><Crown size={11}/> #1 Trending</em>
    </div>
    <div className="hero-float float-c">
      <span className="hero-float-mark mark-box"/>
      <div><b>New listing</b><small>Join the live product index</small></div>
      <em><TrendingUp size={11}/> #5 Trending</em>
    </div>
    <span className="hero-crown"><Crown size={18}/></span>
  </div>;
}

function ClaimSpot({leader,onBid,onList}:{leader:Product|undefined;onBid:()=>void;onList:()=>void}){
  const claim=leader?leader.currentBid+1:null;
  return <section className="claim-card">
    <div className="claim-card-top">
      <span className="claim-crown"><Crown size={18}/></span>
      {leader?<span className="claim-new">New</span>:null}
    </div>
    <h2>Claim the #1 spot</h2>
    {leader&&claim!=null
      ? <>
          <p>Currently, the #1 product has a bid of {money(leader.currentBid)}.</p>
          <strong>Bid {money(claim)} to claim the #1 spot.</strong>
          <Button onClick={onBid}>Place your bid <ArrowRight size={16}/></Button>
          <ul>
            <li><Check size={15}/> Get the #1 position on the leaderboard</li>
            <li><Check size={15}/> Increase your visibility anytime</li>
            <li><Check size={15}/> Pay only the difference</li>
          </ul>
        </>
      : <>
          <p>Be the first product to compete for attention.</p>
          <Button onClick={onList}>List your product <ArrowRight size={16}/></Button>
        </>}
  </section>;
}

function BoardEmpty({onList}:{onList:()=>void}){
  return <div className="attention-board-empty">
    <div className="board-empty-box" aria-hidden="true">
      <span className="box-spark spark-a"><Sparkles size={14}/></span>
      <span className="box-spark spark-b"><Sparkles size={10}/></span>
      <div className="open-box"><b/><i/><em/></div>
    </div>
    <h3>No products listed yet</h3>
    <p>Be the first to list your product and start competing for attention from thousands of creators.</p>
    <Button onClick={onList}>List your product first <ArrowRight size={16}/></Button>
  </div>;
}

function LeaderboardRow({product,rank,onVisit,onBid}:{product:Product;rank:number;onVisit:()=>void;onBid:()=>void}){
  const addOn=lastBidAddOn(product);
  return <article className={`attention-product ${rank===1?'is-leader':''}`} role="listitem">
    <span className={`product-rank rank-${rank}`}><small>#</small>{rank}</span>
    <ProductLogo product={product}/>
    <div className="product-story">
      <div className="product-story-top">
        <Link href={`/discover/product/${product.slug}`}>{product.name}</Link>
        <span>{product.category}</span>
      </div>
      <p>{product.description}</p>
    </div>
    <div className="product-list-stat bid-stat"><strong>{money(product.currentBid)}</strong><small>Current bid</small></div>
    <span className={`product-move ${addOn?'up':''}`} title={addOn?`Latest increase ${money(addOn)}`:'No recent movement'}>{addOn?<TrendingUp size={16}/>:'—'}</span>
    <Button className="bid-cta" id={`bid-${product.id}`} onClick={onBid} aria-label={`Place a bid for ${product.name}`}>Bid</Button>
    <button type="button" className="product-visit" id={`visit-${product.id}`} onClick={onVisit} aria-label={`Visit ${product.name}`}>Visit</button>
  </article>;
}

export function AttentionProduct({slug}:{slug:string}){
  const {state,repository}=useAttention();
  const {s,go}=useStore();
  const p=state.products.find(product=>product.slug===slug);
  const [visit,setVisit]=useState<string|null>(null);
  const [bid,setBid]=useState<string|null>(null);
  if(!p)return repository.getStatus()==='loading'
    ? <><PublicHeader/><main className="public-container attention-detail"/><PublicFooter/></>
    : <><PublicHeader/><main className="public-container attention-detail"><Empty title="This product hasn’t arrived yet." description="Explore the marketplace to find something new."><Link href="/discover" className="btn btn-primary">Explore products</Link></Empty></main><PublicFooter/></>;
  return <>
    <PublicHeader/>
    <main className="public-container attention-detail">
      <Breadcrumb name={p.name}/>
      <div className="attention-detail-hero">
        <ProductLogo product={p}/>
        <div>
          <span className="eyebrow">BY {p.brandName}</span>
          <h1>{p.name}</h1>
          <p>{p.description}</p>
          <div className="attention-tags"><span>{p.category}</span>{p.tags.map(tag=><span key={tag}>{tag}</span>)}<span>{isActive(p)?'Active listing':'Expired listing'}</span></div>
        </div>
        <div className="attention-detail-actions">
          <Button id={`visit-${p.id}`} onClick={()=>setVisit(p.id)}>Visit <ArrowUpRight size={17}/></Button>
          <Button variant="secondary" id={`bid-${p.id}`} disabled={!isActive(p)} onClick={()=>setBid(p.id)}>Place a bid</Button>
        </div>
      </div>
      <ProductMetrics product={p}/>
      <div className="attention-detail-grid">
        <div>
          <section className="attention-side-card">
            <h2>About the product</h2>
            <p>{p.description}</p>
            <p>Built by {p.brandName}. Explore the website to learn more about the product.</p>
            <div className="visit-website"><MousePointer2/><div><small>WEBSITE</small><strong>{websiteHost(p.websiteUrl)}</strong></div></div>
            <p className="listing-dates">Listed {new Date(p.listingStartsAt).toLocaleDateString()} · {isActive(p)?'Expires':'Expired'} {new Date(p.listingEndsAt).toLocaleDateString()}</p>
            <DemoNote>Fictional sample or locally created preview product. No live traffic or payments.</DemoNote>
          </section>
          {p.campaign&&<section className="attention-side-card">
            <span className="eyebrow">OPTIONAL CREATOR OPPORTUNITY</span>
            <h2>{p.campaign.title}</h2>
            <p>{p.campaign.description}</p>
            <p>{p.campaign.requirements}</p>
            <strong>Creator budget: {money(p.campaign.budget)}</strong>
            {p.campaign.existingCampaignId&&<Button variant="secondary" onClick={()=>go(s.session&&s.role==='creator'?`/creator/discover?q=${encodeURIComponent(p.name)}`:'/login?role=creator')}>Explore creator opportunities <ArrowRight size={16}/></Button>}
          </section>}
          <section className="attention-side-card">
            <h2>Bid history</h2>
            <ol className="attention-bid-history">{p.bids.map(bidItem=><li key={bidItem.id}><span><TrendingUp size={16}/> {money(bidItem.amount)}</span><time dateTime={new Date(bidItem.createdAt).toISOString()}>{timeAgo(bidItem.createdAt)}</time></li>)}</ol>
          </section>
        </div>
        <section className="attention-side-card">
          <h2>Latest activity</h2>
          <ActivityList events={state.activity.filter(event=>event.productId===p.id)} limit={20}/>
        </section>
      </div>
    </main>
    <PublicFooter/>
    <VisitDialog productId={visit} onClose={()=>setVisit(null)} onBid={id=>{setVisit(null);setBid(id);}}/>
    <BidDialog productId={bid} onClose={()=>setBid(null)}/>
  </>;
}
