import type {MarketplaceState,Product} from './model';
export function demoMarketplace():MarketplaceState {
 const now=Date.now();
 let saved:Record<string,number>={};
 if(typeof window!=='undefined')try{const parsed=JSON.parse(localStorage.getItem('collabcy-demo-clicks')||'{}');if(parsed&&typeof parsed==='object')saved=parsed;}catch{/* Storage may be unavailable in private browsing. */}
 const brands=[['Bloom Studio','Design','A little creative magic for your next big idea.','#de5793',18],['Orbit Notes','Productivity','A calmer workspace for notes, plans, and everyday inspiration.','#648ce5',12],['Forma AI','AI Tools','Turn your first spark of an idea into something worth sharing.','#a084e6',8],['Mellow','Apps','Make room for better habits and a more intentional day.','#59a998',2]] as const;
 return {version:1,activity:[],products:brands.map(([name,category,description,color,currentBid],i):Product=>({id:`demo-brand-${i}`,brandId:'demo',brandName:name,name,slug:`demo-${name.toLowerCase().replaceAll(' ','-')}`,logo:name[0],color,websiteUrl:'https://example.com',description,category,tags:['Demo'],currentBid,clickCount:Number.isSafeInteger(saved[`demo-brand-${i}`])&&saved[`demo-brand-${i}`]>=0?saved[`demo-brand-${i}`]:0,visitTimes:[],status:'active',listingStartsAt:now-60000,listingEndsAt:now+7*86400000,bids:[{id:`demo-bid-${i}`,amount:currentBid,createdAt:now-60000}]}))};
}
