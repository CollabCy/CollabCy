'use client';

import {useEffect,useState} from 'react';
import {Download,Share2,ArrowUpRight} from 'lucide-react';
import {Modal,Button} from '../ui/shared';
import {money} from '../data';
import {useAttention} from './store';
import {paintCard} from './share-card';
import {getRankedProducts,safeWebsite,type Product} from './model';

export function ShareListing({product}:{product:Product}){
  const [open,setOpen]=useState(false);
  return <><button className="listing-share share-trigger" type="button" aria-label={`Share ${product.name}`} onClick={()=>setOpen(true)}><Share2 size={13}/><span>Share</span></button>{open&&<ListingShareDialog product={product} onClose={()=>setOpen(false)}/>}</>;
}

function ListingShareDialog({product,onClose}:{product:Product;onClose:()=>void}){
  const {state}=useAttention();
  const rank=getRankedProducts(state.products).findIndex(p=>p.id===product.id)+1;
  const website=safeWebsite(product.websiteUrl);
  const [canvas,setCanvas]=useState<HTMLCanvasElement|null>(null);
  const [ready,setReady]=useState(false),[error,setError]=useState('');
  const [caption,setCaption]=useState(()=>`${product.name} ${rank===1?'holds #1 on the CollabCy board':'is in the CollabCy spotlight'}. ${product.description}`.slice(0,210));
  const url=typeof window==='undefined'?'':`${window.location.origin}/discover/product/${encodeURIComponent(product.slug)}`;
  useEffect(()=>{
    let active=true;setReady(false);setError('');
    // Paint offscreen so an older asynchronous logo load cannot overwrite a
    // newer product/rank while the marketplace refreshes.
    if(canvas){const frame=document.createElement('canvas');void paintCard(frame,product,rank).then(()=>{
      if(!active)return;
      canvas.width=frame.width;canvas.height=frame.height;
      const context=canvas.getContext('2d');if(!context)throw new Error('Canvas unavailable');
      context.drawImage(frame,0,0);setReady(true);
    }).catch(()=>{if(active)setError('Could not prepare your card. Please close and try again.');});}
    return()=>{active=false;};
  },[canvas,product,rank]);
  const download=()=>{
    if(!ready||!canvas)return;
    canvas.toBlob(blob=>{if(!blob){setError('Could not export the PNG. Please try again.');return;}const link=document.createElement('a');const objectUrl=URL.createObjectURL(blob);link.href=objectUrl;link.download=`collabcy-${product.slug.replace(/[^a-z0-9-]/gi,'').slice(0,70)||'brand'}-spotlight.png`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);},'image/png');
  };
  return <Modal open onClose={onClose} title="Your spotlight. Ready to share." description="DOWNLOAD YOUR CARD & MAKE YOUR MOMENT" wide><div className="listing-share-dialog"><div className="share-preview-pane"><canvas ref={setCanvas} className="listing-share-card" role="img" aria-label={`${product.name} share card, ${rank===1?'Crown Jewel #1, ':rank>1?`regular leaderboard #${rank-1}, `:''}${money(product.currentBid)} current bid${website?`, website ${website}`:''}`}/><span className="share-preview-caption">YOUR BRAND. A MOMENT WORTH SHARING.</span></div><div className="share-compose-pane">{website&&<div className="share-website-link"><small>PRODUCT WEBSITE · INCLUDED ON YOUR CARD</small><a href={website} target="_blank" rel="noopener noreferrer">{website}<ArrowUpRight size={13}/></a></div>}<label className="share-caption-label"><span>Your post</span><textarea value={caption} onChange={e=>setCaption(e.target.value)} rows={3} maxLength={220} aria-label="Share post text"/></label>{error&&<p role="alert" className="attention-error">{error}</p>}<Button className="spotlight-button" onClick={download} disabled={!ready}><Download size={17}/>{ready?'Download PNG':'Preparing your card…'}</Button><a className="btn btn-secondary" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer"><span className="share-x">𝕏</span> Post on X <ArrowUpRight size={16}/></a><p className="share-tip">Attach your downloaded PNG on X. Your listing link is included.</p></div></div></Modal>;
}
