export const attentionCategories = ['AI Tools','SaaS','Developer Tools','Marketing','Productivity','Apps','Finance','Design','Education','Gaming','Other'];
export type Bid = {id:string;amount:number;createdAt:number};
export type CampaignPreview = {title:string;description:string;requirements:string;budget:number;existingCampaignId?:string};
export type Product = {id:string;brandId:string;brandName:string;name:string;slug:string;logo:string;color:string;websiteUrl:string;description:string;category:string;tags:string[];currentBid:number;clickCount:number;visitTimes:number[];status:'active'|'expired';listingStartsAt:number;listingEndsAt:number;campaign?:CampaignPreview;bids:Bid[]};
export type ActivityEvent = {id:string;productId:string;type:'bid'|'listing'|'visit';createdAt:number;amount?:number;rank?:number};
export type MarketplaceFilters = {query:string;category:string;time:'all'|'24h'};
export type MarketplaceState = {version:1;products:Product[];activity:ActivityEvent[]};
export type MarketplaceStats = {activeProducts:number;visitsToday:number;weeklyBids:number};
export const MIN_INITIAL_BID=2;
export const MAX_INITIAL_BID=100000;
export function isActive(p:Product, now=Date.now()){return p.status==='active'&&p.listingStartsAt<=now&&(p.listingEndsAt<=0||p.listingEndsAt>now);}
export function getRankedProducts(products:Product[],now=Date.now()){return products.filter(p=>isActive(p,now)).slice().sort((a,b)=>b.currentBid-a.currentBid||(a.bids[0]?.createdAt??a.listingStartsAt)-(b.bids[0]?.createdAt??b.listingStartsAt)||a.id.localeCompare(b.id));}
export function getMinimumBidForPosition(products:Product[],productId:string,now=Date.now()){const ranked=getRankedProducts(products,now);const i=ranked.findIndex(p=>p.id===productId);if(i<0)return null;const current=ranked[i].currentBid;const nextHigher=i>0?ranked[i-1].currentBid:current;return nextHigher-current+1;}
export function recommendedIncrementToLead(products:Product[],productId:string,now=Date.now()){const ranked=getRankedProducts(products,now);const i=ranked.findIndex(p=>p.id===productId);if(i<0)return null;if(i===0)return MIN_INITIAL_BID;const min=getMinimumBidForPosition(products,productId,now);return min==null?null:Math.max(min,MIN_INITIAL_BID);}
export function getProjectedRank(products:Product[],amount:number,productId?:string,now=Date.now()){return getRankedProducts(products,now).filter(p=>p.id!==productId&&p.currentBid>=amount).length+1;}
export function getFilteredProducts(products:Product[],filters:MarketplaceFilters,now=Date.now()){const q=filters.query.trim().toLowerCase();return getRankedProducts(products,now).filter(p=>(filters.category==='All'||p.category===filters.category||p.tags.includes(filters.category))&&(!q||`${p.name} ${p.brandName} ${p.description} ${p.category} ${p.tags.join(' ')}`.toLowerCase().includes(q))&&(filters.time==='all'||Math.max(p.listingStartsAt,p.bids[0]?.createdAt??0)>=now-24*3600000));}
export function getMarketplaceStats(products:Product[],now=Date.now()):MarketplaceStats{const active=getRankedProducts(products,now);const midnight=new Date(now);midnight.setHours(0,0,0,0);return {activeProducts:active.length,visitsToday:products.reduce((s,p)=>s+p.visitTimes.filter(t=>t>=midnight.getTime()&&t<=now).length,0),weeklyBids:products.reduce((s,p)=>s+p.bids.filter(b=>b.createdAt>=now-7*86400000&&b.createdAt<=now).reduce((n,b)=>n+b.amount,0),0)};}
export function validateBid(products:Product[],id:string,increment:number,now=Date.now()){const p=products.find(p=>p.id===id);if(!p||!isActive(p,now))return 'This listing has expired and cannot receive bids.';if(!Number.isFinite(increment)||increment<=0)return 'Enter a valid bid amount.';if(!Number.isInteger(increment))return 'Use a whole-dollar amount.';if(increment<MIN_INITIAL_BID)return `Enter at least $${MIN_INITIAL_BID}.`;const nextBid=p.currentBid+increment;if(nextBid>100000)return 'Demo bids must be $100,000 or less.';return '';}
export function timeAgo(timestamp:number,now=Date.now()){const hours=Math.max(0,Math.floor((now-timestamp)/3600000));return hours>=24?`${Math.floor(hours/24)}d ago`:hours?`${hours}h ago`:Math.max(0,Math.floor((now-timestamp)/60000))<1?'Just now':`${Math.floor((now-timestamp)/60000)}m ago`;}
export function normalizeWebsiteInput(value:string){
  if(typeof value!=='string')return '';
  const trimmed=value.trim();
  if(!trimmed)return '';
  if(/^[a-z][a-z0-9+.-]*:/i.test(trimmed))return trimmed;
  return `https://${trimmed}`;
}
export function safeWebsite(value:string){try{if(typeof value!=='string'||value.length>2048)return null;const trimmed=normalizeWebsiteInput(value);if(!trimmed||trimmed.length>2048||/\s/.test(trimmed))return null;const u=new URL(trimmed);const host=u.hostname.toLowerCase();if(!['https:','http:'].includes(u.protocol)||u.username||u.password||!host)return null;if(host==='localhost'||host==='127.0.0.1'||host==='0.0.0.0'||host==='::1')return null;return u.href;}catch{return null;}}
export function websiteHost(value:string){const href=safeWebsite(value);if(!href)return '';try{return new URL(href).hostname;}catch{return '';}}
export function websiteListingKey(value:string){
  const href=safeWebsite(value);
  if(!href)return '';
  try{
    let host=new URL(href).hostname.toLowerCase().replace(/\.+$/,'');
    if(!host||host.startsWith('[')||host.includes(':'))return '';
    if(host.startsWith('www.'))host=host.slice(4);
    return host;
  }catch{return '';}
}
export function findExistingListingByWebsite(products:Product[],websiteUrl:string,now=Date.now()){
  const key=websiteListingKey(websiteUrl);
  if(!key)return null;
  return products.find(product=>isActive(product,now)&&websiteListingKey(product.websiteUrl)===key)||null;
}
export function activityTickerText(event:ActivityEvent,productName:string){
  if(event.type==='listing')return `${productName} joined`;
  if(event.type==='visit')return `${productName} received a visit`;
  if(event.rank)return `${productName} moved to #${event.rank}`;
  return `${productName} updated bid`;
}
