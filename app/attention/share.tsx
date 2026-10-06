'use client';

import {useEffect,useState} from 'react';
import {Download,Share2,ArrowUpRight} from 'lucide-react';
import {Modal,Button} from '../ui/shared';
import {money} from '../data';
import {useAttention} from './store';
import {getRankedProducts,websiteHost,type Product} from './model';

function fitText(ctx:CanvasRenderingContext2D,value:string,maxWidth:number){
  if(ctx.measureText(value).width<=maxWidth)return value;
  let text=value;while(text.length&&ctx.measureText(`${text}…`).width>maxWidth)text=text.slice(0,-1);
  return `${text}…`;
}

async function paintCard(canvas:HTMLCanvasElement,product:Product,rank:number){
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Your browser does not support image export.');
  canvas.width=1200;canvas.height=630;
  const bg=ctx.createLinearGradient(0,0,1200,630);bg.addColorStop(0,'#151216');bg.addColorStop(1,'#30202b');ctx.fillStyle=bg;ctx.fillRect(0,0,1200,630);
  const glow=ctx.createRadialGradient(1050,70,5,1050,70,600);glow.addColorStop(0,'#a9537244');glow.addColorStop(1,'#a9537200');ctx.fillStyle=glow;ctx.fillRect(0,0,1200,630);
  ctx.strokeStyle='#e8bb6740';ctx.lineWidth=1;ctx.strokeRect(24,24,1152,582);
  const tier=rank===1?'CROWN JEWEL':rank>1&&rank<=4?'THE ROYAL THREE':'BRAND SPOTLIGHT';
  ctx.font='600 19px system-ui';ctx.fillStyle='#e4bf76';ctx.fillText(tier,66,83);
  ctx.textAlign='right';ctx.fillStyle='#fce7f1';ctx.font='700 27px system-ui';ctx.fillText('CollabCy',1134,84);ctx.textAlign='left';
  ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(66,214,102,102,24);ctx.fill();
  let logo:HTMLImageElement|null=null;
  if(product.logo.startsWith('data:image/')){try{logo=new Image();logo.src=product.logo;await logo.decode();}catch{logo=null;}}
  if(logo){ctx.save();ctx.beginPath();ctx.roundRect(76,224,82,82,18);ctx.clip();const ratio=Math.min(82/logo.width,82/logo.height);ctx.drawImage(logo,117-logo.width*ratio/2,265-logo.height*ratio/2,logo.width*ratio,logo.height*ratio);ctx.restore();}
  else {ctx.fillStyle='#b83772';ctx.beginPath();ctx.roundRect(78,226,78,78,17);ctx.fill();ctx.fillStyle='#fff';ctx.font='700 49px system-ui';ctx.textAlign='center';ctx.fillText(product.name.slice(0,1).toUpperCase(),117,284);ctx.textAlign='left';}
  ctx.font='700 50px system-ui';ctx.fillStyle='#fff';ctx.fillText(fitText(ctx,product.name,890),198,263);
  ctx.font='400 22px system-ui';ctx.fillStyle='#bbaaB4';ctx.fillText(fitText(ctx,websiteHost(product.websiteUrl),880),198,302);
  ctx.font='400 22px system-ui';ctx.fillStyle='#ceb9c5';ctx.fillText(fitText(ctx,product.description,1060),66,376);
  ctx.font='700 40px system-ui';ctx.fillStyle='#e4bf76';ctx.fillText(rank===1?'The Crown Jewel':rank>1?`#${rank-1} in the spotlight`:'A brand worth discovering',66,510);
  ctx.font='400 18px system-ui';ctx.fillStyle='#a990a0';ctx.fillText(rank>0?'on the CollabCy board':'Explore the listing on CollabCy',66,546);
  ctx.textAlign='right';ctx.font='700 52px system-ui';ctx.fillStyle='#fff';ctx.fillText(money(product.currentBid),1134,509);
  ctx.font='400 18px system-ui';ctx.fillStyle='#a990a0';ctx.fillText('current bid',1134,546);ctx.textAlign='left';
}

export function ShareListing({product}:{product:Product}){
  const [open,setOpen]=useState(false);
  return <><button className="listing-share share-trigger" type="button" aria-label={`Share ${product.name}`} onClick={()=>setOpen(true)}><Share2 size={13}/><span>Share</span></button>{open&&<ListingShareDialog product={product} onClose={()=>setOpen(false)}/>}</>;
}

function ListingShareDialog({product,onClose}:{product:Product;onClose:()=>void}){
  const {state}=useAttention();
  const rank=getRankedProducts(state.products).findIndex(p=>p.id===product.id)+1;
  const [canvas,setCanvas]=useState<HTMLCanvasElement|null>(null);
  const [ready,setReady]=useState(false),[error,setError]=useState('');
  const [caption,setCaption]=useState(()=>`${product.name} ${rank===1?'is the Crown Jewel':'is in the spotlight'} on CollabCy. ${product.description}`.slice(0,210));
  const url=typeof window==='undefined'?'':`${window.location.origin}/brands/product/${encodeURIComponent(product.slug)}`;
  useEffect(()=>{let active=true;setReady(false);if(canvas)void paintCard(canvas,product,rank).then(()=>{if(active)setReady(true);}).catch(()=>{if(active)setError('Could not prepare your card. Please close and try again.');});return()=>{active=false;};},[canvas,product,rank]);
  const download=()=>{
    if(!ready||!canvas)return;
    canvas.toBlob(blob=>{if(!blob){setError('Could not export the PNG. Please try again.');return;}const link=document.createElement('a');const objectUrl=URL.createObjectURL(blob);link.href=objectUrl;link.download=`collabcy-${product.slug.replace(/[^a-z0-9-]/gi,'').slice(0,70)||'brand'}-spotlight.png`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);},'image/png');
  };
  return <Modal open onClose={onClose} title="Your spotlight. Ready to share." description="DOWNLOAD YOUR CARD & MAKE YOUR MOMENT" wide><div className="listing-share-dialog"><div className="share-preview-pane"><canvas ref={setCanvas} className="listing-share-card" role="img" aria-label={`${product.name} share card, ${rank>0?`rank ${rank}, `:''}${money(product.currentBid)} current bid`}/><span className="share-preview-caption">YOUR BRAND. A MOMENT WORTH SHARING.</span></div><div className="share-compose-pane"><label className="share-caption-label"><span>Your post</span><textarea value={caption} onChange={e=>setCaption(e.target.value)} rows={3} maxLength={220} aria-label="Share post text"/></label>{error&&<p role="alert" className="attention-error">{error}</p>}<Button className="spotlight-button" onClick={download} disabled={!ready}><Download size={17}/>{ready?'Download PNG':'Preparing your card…'}</Button><a className="btn btn-secondary" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer"><span className="share-x">𝕏</span> Post on X <ArrowUpRight size={16}/></a><p className="share-tip">Attach your downloaded PNG on X. Your listing link is included.</p></div></div></Modal>;
}
