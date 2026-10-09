import {money} from '../data';
import {type Product} from './model';
import {productLogoSource,shareWebsite} from './presentation';

export function fitText(ctx:CanvasRenderingContext2D,value:string,maxWidth:number){
  if(ctx.measureText(value).width<=maxWidth)return value;
  let text=value;while(text.length&&ctx.measureText(`${text}…`).width>maxWidth)text=text.slice(0,-1);
  return `${text}…`;
}

export function paintWebsite(ctx:CanvasRenderingContext2D,value:string){
  const website=shareWebsite(value);
  if(!website)return; // A missing/invalid URL never becomes a fictional address.
  const x=720,width=414;
  ctx.save();
  ctx.fillStyle='#ffffff05';ctx.strokeStyle='#e6afc42b';ctx.lineWidth=1;
  ctx.beginPath();ctx.roundRect(x-22,202,width+44,120,16);ctx.fill();ctx.stroke();
  ctx.fillStyle='#c995ad';ctx.font='600 13px system-ui';ctx.letterSpacing='2px';
  ctx.fillText('WEBSITE',x,232);
  ctx.letterSpacing='1px';
  let size=28;
  const font=()=>{ctx.font=`500 ${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;};
  font();while(size>18&&ctx.measureText(website.origin).width>width){size--;font();}
  const ink=ctx.createLinearGradient(x,0,x+width,0);ink.addColorStop(0,'#fff5fb');ink.addColorStop(1,'#e5b4cf');
  ctx.fillStyle=ink;ctx.fillText(fitText(ctx,website.origin,width),x,271);
  ctx.letterSpacing='0px';ctx.font='400 17px ui-monospace, SFMono-Regular, Menlo, monospace';ctx.fillStyle='#bd9cad';
  if(website.detail!=='/')ctx.fillText(fitText(ctx,website.detail,width),x,302);
  ctx.restore();
}

export async function paintCard(canvas:HTMLCanvasElement,product:Product,rank:number){
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Your browser does not support image export.');
  canvas.width=1200;canvas.height=630;
  const bg=ctx.createLinearGradient(0,0,1200,630);bg.addColorStop(0,'#151216');bg.addColorStop(1,'#30202b');ctx.fillStyle=bg;ctx.fillRect(0,0,1200,630);
  const glow=ctx.createRadialGradient(1050,70,5,1050,70,600);glow.addColorStop(0,'#a9537244');glow.addColorStop(1,'#a9537200');ctx.fillStyle=glow;ctx.fillRect(0,0,1200,630);
  ctx.strokeStyle='#e8bb6740';ctx.lineWidth=1;ctx.strokeRect(24,24,1152,582);
  const tier=rank===1?'CROWN JEWEL':rank>0?'IN THE SPOTLIGHT':'BRAND SPOTLIGHT';
  ctx.font='600 19px system-ui';ctx.fillStyle='#e4bf76';ctx.fillText(tier,66,83);
  ctx.textAlign='right';ctx.fillStyle='#fce7f1';ctx.font='700 27px system-ui';ctx.fillText('CollabCy',1134,84);ctx.textAlign='left';
  ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(66,214,102,102,24);ctx.fill();
  let logo:HTMLImageElement|null=null;
  const logoSource=productLogoSource(product.logo);
  if(logoSource){
    let timeout:ReturnType<typeof setTimeout>|undefined;
    try{
      logo=new Image();logo.crossOrigin='anonymous';logo.src=logoSource;
      await Promise.race([logo.decode(),new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Logo timed out')),4000);})]);
    }catch{logo=null;}finally{clearTimeout(timeout);}
  }
  if(logo){ctx.save();ctx.beginPath();ctx.roundRect(76,224,82,82,18);ctx.clip();const ratio=Math.min(82/logo.width,82/logo.height);ctx.drawImage(logo,117-logo.width*ratio/2,265-logo.height*ratio/2,logo.width*ratio,logo.height*ratio);ctx.restore();}
  else {ctx.fillStyle='#b83772';ctx.beginPath();ctx.roundRect(78,226,78,78,17);ctx.fill();ctx.fillStyle='#fff';ctx.font='700 49px system-ui';ctx.textAlign='center';ctx.fillText(product.name.slice(0,1).toUpperCase(),117,284);ctx.textAlign='left';}
  ctx.font='700 44px system-ui';ctx.fillStyle='#fff';ctx.fillText(fitText(ctx,product.name,450),198,263);
  ctx.font='400 22px system-ui';ctx.fillStyle='#bbaaB4';ctx.fillText(fitText(ctx,product.brandName,450),198,302);
  paintWebsite(ctx,product.websiteUrl);
  ctx.font='400 22px system-ui';ctx.fillStyle='#ceb9c5';ctx.fillText(fitText(ctx,product.description,1060),66,376);
  ctx.font='700 40px system-ui';ctx.fillStyle='#e4bf76';ctx.fillText(rank===1?'#1 · The Crown Jewel':rank>1?`#${rank-1} · Regular leaderboard`:'A brand worth discovering',66,510);
  ctx.font='400 18px system-ui';ctx.fillStyle='#a990a0';ctx.fillText(rank===1?'Featured on CollabCy':rank>1?'on the CollabCy regular leaderboard':'Explore the listing on CollabCy',66,546);
  ctx.textAlign='right';ctx.font='700 52px system-ui';ctx.fillStyle='#fff';ctx.fillText(money(product.currentBid),1134,509);
  ctx.font='400 18px system-ui';ctx.fillStyle='#a990a0';ctx.fillText('current bid',1134,546);ctx.textAlign='left';
}
