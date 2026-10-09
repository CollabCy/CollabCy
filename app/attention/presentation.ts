import {safeWebsite,type Product} from './model';

// Presentation only: the first ranked product is featured separately. Never use
// these positions for checkout, projected ranks, or bid calculations.
export function marketplacePlacement(ranked:Product[],id:string){
  const index=ranked.findIndex(product=>product.id===id);
  return {crown:index===0,position:index<0?0:index===0?1:index};
}

export function productLogoSource(logo:string){
  if(/^data:image\/(png|jpe?g|webp|gif|svg\+xml);/i.test(logo))return logo;
  return /^https?:\/\//i.test(logo)?safeWebsite(logo):null;
}

export function shareWebsite(value:string){
  const href=safeWebsite(value);
  if(!href)return null;
  const url=new URL(href);
  return {href,origin:url.origin,detail:`${url.pathname}${url.search}${url.hash}`};
}
