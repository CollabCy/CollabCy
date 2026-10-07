'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {useSearchParams} from 'next/navigation';
import Link from '../ui/app-link';
import {ArrowUpRight,ArrowRight,Check,Trophy,Layers,TrendingUp,Users,ChevronRight,Search,Heart,BarChart3,Crown,Sparkles,Globe as GlobeIcon,ShieldCheck as ShieldIcon} from 'lucide-react';
import {PublicHeader,PublicFooter} from '../ui/public';
import {Button,SearchBox,Empty,DemoNote,Modal} from '../ui/shared';
import {BrandProducts} from './listing';
import {AudiencePulse,BrandClicks} from './audience';
import {BrandLink} from './brand-link';
import {useWebsiteVisit} from './website-visit';
import {ShareListing} from './share';
import {useStore} from '../store';
import {money} from '../data';
import {useAttention} from './store';
import {attentionCategories,getRankedProducts,getFilteredProducts,isActive,timeAgo,websiteHost,MIN_INITIAL_BID,type MarketplaceFilters,type Product} from './model';
import {ProductLogo,LiveBadge,ActivityList,BidDialog,ProductMetrics} from './components';

export function usePromote(){
  const {go}=useStore();
  return ()=>{go('/brand/products/new');};
}

export function AttentionMarketplace({view='discover'}:{view?:'discover'|'listings'}){
  const {state,repository}=useAttention();
  const promote=usePromote();
  const [filters,setFilters]=useState<MarketplaceFilters>({query:'',category:'All',time:'all'});
  const openWebsite=useWebsiteVisit();
  const [bid,setBid]=useState<string|null>(null);
  const [allActivity,setAllActivity]=useState(false);
  const [spotlight,setSpotlight]=useState(false);
  const ranked=getRankedProducts(state.products);
  const filtered=getFilteredProducts(state.products,filters);
  const setCategory=(category:string)=>setFilters(v=>({...v,category}));
  const loading=repository.getStatus()==='loading';
  const leader=ranked[0];
  return <>
    <PublicHeader/>
    <main className={`attention-page attention-editorial spotlight-page ${view==='listings'?'spotlight-listings':''}`}><div className="audience-dock public-container"><AudiencePulse/></div>
      {view==='listings'&&<div className="listing-scene" aria-hidden="true"><div className="listing-glow glow-pink"/><div className="listing-glow glow-gold"/><Crown className="listing-sky-crown" strokeWidth={1}/><div className="listing-royal-seal"><Crown size={90} strokeWidth={1}/><span>GOOD IDEAS<br/>DESERVE A SPOTLIGHT</span><Sparkles size={30}/></div>{[0,1,2,3,4,5].map(i=><span key={i} className={`listing-confetti confetti-${i}`}>{i%2?<Sparkles size={22} strokeWidth={1}/>:<i/>}</span>)}</div>}
      {view==='discover'&&<section className="attention-hero brands-hero-scene">
        <div className="brands-ambient" aria-hidden="true"><span className="brands-ambient-glow"/><Crown className="brands-ambient-crown" strokeWidth={1}/><Sparkles className="brands-ambient-star"/><i/><i/></div>
        <div className="public-container">
          <div className="attention-hero-grid">
            <div className="editorial-hero-copy">
              <div className="attention-eyebrow"><LiveBadge/><span>BRANDS ARE COMPETING FOR ATTENTION</span></div>
              <h1>Your brand deserves<span>the spotlight.</span></h1>
              <p>Big ideas deserve to be seen. Meet remarkable products, discover your next favorite, and put your brand in the spotlight.</p>
              <div className="hero-actions">
                <button className="btn btn-primary spotlight-button" type="button" onClick={()=>setSpotlight(true)}><span>Spotlight your brand</span><ArrowRight size={17}/></button>
                <Link className="btn btn-secondary" href="/listings">View all listings <ArrowRight size={16}/></Link>
              </div>
              <div className="attention-trust">
                <span><Search size={15}/>Product discovery</span>
                <span><BarChart3 size={15}/>Listings from ${MIN_INITIAL_BID}</span>
                <span><Heart size={15}/>Find your next favorite</span>
              </div>
            </div>
            <HeroStage products={ranked.slice(0,4)} loading={loading}/>
          </div>
        </div>
      </section>}
      <section className="public-container attention-market" id="products" aria-label="Product marketplace">
        <div className="attention-market-grid">
          <div className="attention-board">
            <div className="attention-board-head">
              <div>
                {view==='listings'?<nav className="listing-breadcrumb" aria-label="Breadcrumb"><Link href="/">Discover</Link><span>/</span><span aria-current="page">Listings</span></nav>:<span className="editorial-kicker">THE BRAND SPOTLIGHT</span>}
                {view==='listings'?<h1>All listings<span className="editorial-period">.</span></h1>:<h2>Who’s in the spotlight<span className="editorial-period">.</span></h2>}
                <p>{view==='listings'?`${ranked.length} ${ranked.length===1?'product':'products'} on the board. Your next discovery starts here.`:'Independent brands. Ambitious ideas. Your next discovery.'}</p>
              </div>
              <Button className={`spotlight-button${view==='listings'?' listing-spotlight-cta':''}`} onClick={()=>setSpotlight(true)}>{view==='listings'&&<Crown className="listing-cta-crown" size={16}/>}<span>Spotlight your brand</span><ArrowUpRight size={17}/></Button>
            </div>
            <div className="attention-toolbar">
              <div className="attention-controls">
                <div className="attention-time" role="group" aria-label="Activity period">
                  <button aria-pressed={filters.time==='all'} onClick={()=>setFilters(v=>({...v,time:'all'}))}>All time</button>
                  <button aria-pressed={filters.time==='24h'} onClick={()=>setFilters(v=>({...v,time:'24h'}))}>Last 24 hours</button>
                </div>
                <div id="market-search"><SearchBox placeholder="Search products, brands, or categories…" value={filters.query} onChange={query=>setFilters(v=>({...v,query}))}/></div>
              </div>
              <CategoryChips value={filters.category} onChange={setCategory}/>
            </div>
            {filtered.length
              ? <div className={view==='listings'?'listing-directory':'attention-products'} role="list">
                  {filtered.map(product=>{
                    const rank=ranked.findIndex(item=>item.id===product.id)+1;
                    return view==='listings'?<ListingRow key={product.id} product={product} rank={rank} onVisit={()=>openWebsite(product)} onBid={()=>setBid(product.id)}/>:<LeaderboardRow key={product.id} product={product} rank={rank} onVisit={()=>openWebsite(product)} onBid={()=>setBid(product.id)}/>;
                  })}
                </div>
              : loading
                ? view==='listings'?<div className="listing-loading" role="status" aria-label="Loading listings">{[0,1,2].map(i=><div className="listing-skeleton" key={i}><span/><div><b/><i/></div><em/></div>)}</div>:null
                : !ranked.length
                  ? view==='listings'?<ListingsEmpty onList={()=>setSpotlight(true)}/>:<BoardEmpty onList={promote}/>
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
            {icon:TrendingUp,title:'Add to your bid',text:'Increase your position by paying only the add-on through Dodo Test Mode checkout. The bid is applied after payment is confirmed.'},
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

    </main>
    <PublicFooter/>
    <Modal open={spotlight} onClose={()=>setSpotlight(false)} title="Your next moment in the spotlight" description="Introduce your brand, review your placement, and publish your listing." wide><div className="spotlight-form"><BrandProducts creating onCancel={()=>setSpotlight(false)}/></div></Modal>

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
    {name?<><Link href="/">Discover</Link><ChevronRight size={13}/><span aria-current="page">{name}</span></>:<span aria-current="page">Discover</span>}
  </nav>;
}

function HeroStage({products,loading}:{products:Product[];loading:boolean}){
  return <div className="spotlight-stage" aria-label="Top ranked products">
    <div className="spotlight-orbit orbit-one"/><div className="spotlight-orbit orbit-two"/>
    <span className="spotlight-star star-one"><Sparkles/></span><span className="spotlight-star star-two"><Sparkles size={16}/></span>
    <div className="crown-jewel"><div className="crown-jewel-inner">{products[0]&&<BrandLink brandId={products[0].id} className="brand-card-link" href={`/discover/product/${products[0].slug}`} aria-label={`Open #1 ${products[0].name}`}/>}<span className="crown-jewel-icon"><Crown size={28} strokeWidth={1.5}/></span><div><small>THE CROWN JEWEL · #1</small><strong>{products[0]?<BrandLink brandId={products[0].id} href={`/discover/product/${products[0].slug}`}>{products[0].name}</BrandLink>:(loading?'Finding the standout…':'A place for something extraordinary.')}</strong><p>{products[0]?`${products[0].brandName} · ${money(products[0].currentBid)} leading bid`:'The brightest brand earns the crown.'}</p>{products[0]&&<BrandPageClicks product={products[0]}/>}</div>{products[0]&&<ShareListing product={products[0]}/>}</div></div>
    <div className="spotlight-stage-label"><span/> THE ROYAL THREE</div>
    {[0,1,2].map(index=>{const product=products[index+1];const rank=index+2;return <div key={product?.id||index} className={`royal-brand royal-brand-${index+1}`}>{product&&<BrandLink brandId={product.id} className="brand-card-link" href={`/discover/product/${product.slug}`} aria-label={`Open #${rank} ${product.name}`}/>}

      <span className="royal-position">#{rank}</span>
      {product?<ProductLogo product={product}/>:<span className="royal-placeholder"><Crown size={22}/></span>}
      <div className="royal-brand-copy"><small>{index===0?'FIRST IN LINE':index===1?'ON THE RISE':'ONE TO WATCH'}</small><strong>{product?.name||(loading?'Finding the leaders…':'Your brand could be here')}</strong><span>{product?`${product.brandName} · ${money(product.currentBid)} current bid`:'A little ambition. A lot of possibility.'}</span>{product&&<BrandPageClicks product={product}/>}</div>
      {product&&<div className="royal-brand-actions"><ShareListing product={product}/><BrandLink brandId={product.id} href={`/discover/product/${product.slug}`} aria-label={`Explore ${product.name}`}><ArrowUpRight size={18}/></BrandLink></div>}
    </div>})}
    <div className="royal-stage-foot"><TrendingUp size={14}/>Ranked live. Built to be discovered.</div>
  </div>;
}

export function SpotlightAbout(){
  const promote=usePromote();
  return <><PublicHeader/><main className="attention-editorial spotlight-page spotlight-about"><section className="public-container about-intro"><span className="editorial-kicker">A LITTLE ABOUT COLLABCY</span><h1>Great brands.<br/><span>Brighter possibilities.</span></h1><p>We believe the next great thing deserves a chance to be discovered. CollabCy brings independent brands, curious people, and ambitious creators together in one shared spotlight.</p><Link href="/listings" className="btn btn-primary spotlight-button">Find your next favorite <ArrowUpRight size={18}/></Link><div className="about-values"><article><GlobeIcon/><span>01 / DISCOVER</span><h2>Ideas worth your attention.</h2><p>Explore products across AI, design, developer tools, and beyond. Get to know the people and brands behind them.</p></article><article><Crown/><span>02 / STAND OUT</span><h2>A spotlight you can earn.</h2><p>Active products are ranked by their current bids. Higher bids move up; equal bids keep the earlier position.</p></article><article><Heart/><span>03 / CONNECT</span><h2>Your next favorite starts here.</h2><p>Visit a brand, explore its product, and discover something that fits the way you work and create.</p></article></div></section><section className="public-container about-process"><span className="editorial-kicker">YOUR BRAND’S NEXT CHAPTER</span><h2>From an idea to the spotlight.</h2><div className="about-process-steps"><p><b>01</b><strong>Introduce your brand</strong><span>Add your product name, description, website, and category.</span></p><p><b>02</b><strong>Choose your placement</strong><span>Review your initial bid and projected position.</span></p><p><b>03</b><strong>Make your debut</strong><span>Publish your listing and join the active product board.</span></p></div><div className="about-payment-note"><ShieldIcon/><p>Listing is free. Bid increases use Dodo Test Mode and update only after payment confirmation. Listings stay active until they are removed.</p></div><Button className="spotlight-button" onClick={promote}>Spotlight your brand <ArrowRight size={17}/></Button></section></main><PublicFooter/></>;
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

function ListingsEmpty({onList}:{onList:()=>void}){
  return <div className="listing-empty"><span className="listing-empty-crown"><Crown size={34} strokeWidth={1.4}/><Sparkles size={16}/></span><span className="listing-empty-eyebrow">THE NEXT GREAT THING COULD BE YOURS</span><h2>A little spotlight.<br/>A world of possibility.</h2><p>The board is ready for its first brand. Introduce what you’re building and claim your place from ${MIN_INITIAL_BID}.</p><Button className="spotlight-button" onClick={onList}><span>Spotlight your brand</span><ArrowUpRight size={17}/></Button><small>Stay listed · Listings from ${MIN_INITIAL_BID}</small></div>;
}

function ListingRow({product,rank,onVisit,onBid}:{product:Product;rank:number;onVisit:()=>void;onBid:()=>void}){
  return <article className={`listing-row${rank===1?' listing-row-leader':''}`} role="listitem" style={{animationDelay:`${Math.min(rank-1,8)*55}ms`}}>
    <BrandLink brandId={product.id} className="brand-card-link" href={`/discover/product/${product.slug}`} aria-label={`Open ${product.name} details`}/><span className="listing-rank" aria-label={`Rank ${rank}`}>{rank===1?<Crown size={19} strokeWidth={1.6}/>:<>#{rank}</>}</span>
    <BrandLink brandId={product.id} className="listing-logo-link" href={`/discover/product/${product.slug}`} aria-label={`View ${product.name}`}><ProductLogo product={product}/></BrandLink>
    <div className="listing-story"><div className="listing-story-title"><BrandLink brandId={product.id} href={`/discover/product/${product.slug}`}>{product.name}</BrandLink>{rank===1&&<span className="listing-leader-badge"><Sparkles size={10}/> IN THE SPOTLIGHT</span>}<span className="listing-category">{product.category}</span></div><p>{product.description}</p><span className="listing-host">{websiteHost(product.websiteUrl)}</span><BrandPageClicks product={product}/></div>
    <div className="listing-row-details"><button className="listing-bid" type="button" onClick={onBid} aria-label={`Raise bid for ${product.name}, current bid ${money(product.currentBid)}`} title="Raise this product’s bid">{money(product.currentBid)}<TrendingUp size={13}/></button><div className="listing-stats"><span>{timeAgo(product.listingStartsAt)}</span></div><div className="listing-row-social"><ShareListing product={product}/><button className="listing-visit" type="button" onClick={onVisit} aria-label={`Visit ${product.name}`}>Visit <ArrowUpRight size={13}/></button></div></div>
  </article>;
}

function BrandPageClicks({product}:{product:Product}){
  return <BrandClicks count={product.clickCount} kind="website"/>;
}

function LeaderboardRow({product,rank,onVisit,onBid}:{product:Product;rank:number;onVisit:()=>void;onBid:()=>void}){
  return <article className={`attention-product brand-glass-card ${rank===1?'is-leader':''}`} role="listitem" style={{animationDelay:`${Math.min(rank,8)*65}ms`}}>
    <BrandLink brandId={product.id} className="brand-card-link" href={`/discover/product/${product.slug}`} aria-label={`Open ${product.name} details`}/>
    <span className={`product-rank rank-${rank}`}>{rank===1?<Crown size={22}/>:<><small>#</small>{rank}</>}</span><ProductLogo product={product}/>
    <div className="product-story"><div className="product-story-top"><BrandLink brandId={product.id} href={`/discover/product/${product.slug}`}>{product.name}</BrandLink><span>{product.category}</span></div><p>{product.description}</p><BrandPageClicks product={product}/></div>
    <div className="brand-card-side"><div className="product-list-stat bid-stat"><strong>{money(product.currentBid)}</strong><small>Current bid</small></div><div className="brand-card-actions"><Button className="bid-cta" id={`bid-${product.id}`} onClick={onBid} aria-label={`Place a bid for ${product.name}`}>Bid <TrendingUp size={13}/></Button><button className="product-visit" type="button" id={`visit-${product.id}`} onClick={onVisit} aria-label={`Visit ${product.name}`}>Visit <ArrowUpRight size={13}/></button><ShareListing product={product}/></div></div>
  </article>;
}

export function AttentionProduct({slug}:{slug:string}){
  const {state,repository}=useAttention();
  const params=useSearchParams();
  const p=state.products.find(product=>product.slug===slug);
  const openWebsite=useWebsiteVisit();
  const [bid,setBid]=useState<string|null>(null);
  const paidReturn=params.get('paid')==='1';
  const intendedBid=Number(params.get('bid'));
  const initialIncrement=Number.isInteger(intendedBid)&&intendedBid>0?intendedBid:undefined;
  useEffect(()=>{
    if(paidReturn) repository.refresh();
  },[paidReturn,repository]);
  useEffect(()=>{
    if(!p||paidReturn||!initialIncrement)return;
    setBid(p.id);
  },[p?.id,paidReturn,initialIncrement]);
  if(!p)return repository.getStatus()==='loading'
    ? <><PublicHeader/><main className="public-container attention-detail"/><PublicFooter/></>
    : <><PublicHeader/><main className="public-container attention-detail"><Empty title="This product hasn’t arrived yet." description="Explore the marketplace to find something new."><Link href="/" className="btn btn-primary">Explore products</Link></Empty></main><PublicFooter/></>;
  const ranked=getRankedProducts(state.products);
  const isLeader=ranked[0]?.id===p.id;
  return <>
    <PublicHeader/>
    <main className="public-container attention-detail brand-profile-page" style={{'--brand-accent':p.color} as CSSProperties}>
      <div className="audience-dock"><AudiencePulse/></div>
      <Breadcrumb name={p.name}/>
      {paidReturn&&<div className="attention-success" role="status"><h3>Checkout complete. Your bid is confirming.</h3><p>Returning from Dodo does not apply the bid by itself. Rankings update after payment is confirmed in Test Mode.</p></div>}
      <article className="brand-profile-sheet">
        <header className="profile-intro">
          <div className="profile-topline"><span><Sparkles size={14}/> THE BRAND SPOTLIGHT</span><span className="profile-status"><i/>{isActive(p)?'Active listing':'Inactive listing'}</span></div>
          <div className="profile-identity"><ProductLogo product={p}/><div><span className="profile-maker">By {p.brandName}</span><h1>{p.name}</h1><div className="attention-tags"><span>{p.category}</span>{p.tags.map(tag=><span key={tag}>{tag}</span>)}</div></div></div>
          <p className="profile-description">{p.description}</p>
          <div className="profile-action-row">
            <Button id={`visit-${p.id}`} onClick={()=>openWebsite(p)}>Visit website <ArrowUpRight size={18}/></Button>
            <Button variant="secondary" id={`bid-${p.id}`} disabled={!isActive(p)} onClick={()=>setBid(p.id)}>Place a bid <TrendingUp size={16}/></Button>
            <ShareListing product={p}/>
            <span className="profile-domain"><GlobeIcon size={14}/>{websiteHost(p.websiteUrl)}</span>
          </div>
        </header>
        <div className="profile-stats"><ProductMetrics product={p}/></div>
        <div className="profile-body">
          <div className="profile-story">
            <section className="profile-section"><span className="profile-section-label">01 / THE IDEA</span><h2>A little more about {p.name}.</h2><p>{p.description}</p><p>Made by {p.brandName}. Take a closer look at the website to explore what they’re building.</p><button type="button" className="profile-website-link" onClick={()=>openWebsite(p)}>Explore {websiteHost(p.websiteUrl)} <ArrowUpRight size={16}/></button></section>
            <section className="profile-section">
              <span className="profile-section-label">02 / BID HISTORY</span>
              <h2>How this bid grew.</h2>
              <ol className="attention-bid-history">{p.bids.map(bidItem=><li key={bidItem.id}><span><TrendingUp size={16}/> {money(bidItem.amount)}</span><time dateTime={new Date(bidItem.createdAt).toISOString()}>{timeAgo(bidItem.createdAt)}</time></li>)}</ol>
            </section>
          </div>
          <aside className="profile-sidebar">
            <div className="profile-rank-note"><Crown size={22}/><div><strong>{isLeader?'#1 · The Crown Jewel':'In the spotlight'}</strong><p>{isLeader?'Leading the board. Setting the pace.':'Good ideas deserve to be seen.'}</p></div></div>
            <section className="profile-section">
              <span className="profile-section-label">LATEST ACTIVITY</span>
              <h2>What’s happening.</h2>
              <ActivityList events={state.activity.filter(event=>event.productId===p.id)} limit={20}/>
            </section>
          </aside>
        </div>
        <footer className="profile-footnote"><DemoNote>Website visits are open to everyone. Bid increases use Dodo Test Mode checkout. The bid is applied only after payment is confirmed. Returning from Dodo does not apply the bid by itself.</DemoNote></footer>
      </article>
    </main>
    <PublicFooter/>

    <BidDialog productId={bid} onClose={()=>setBid(null)} initialIncrement={initialIncrement}/>
  </>;
}
