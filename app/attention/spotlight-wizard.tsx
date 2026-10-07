'use client';
import {useState,useRef} from 'react';
import {ArrowRight,ArrowLeft,Crown,Check,Sparkles,Upload,Loader2} from 'lucide-react';
import {Button,Field,Textarea,Pick} from '../ui/shared';
import Link from '../ui/app-link';
import {useStore} from '../store';
import {useAttention} from './store';
import {attentionCategories,safeWebsite,MIN_INITIAL_BID,MAX_INITIAL_BID,type Product} from './model';
import {ShareListing} from './share';
import {money} from '../data';

export function SpotlightWizard({onCancel}:{onCancel?:()=>void}){
  const {s,go}=useStore();
  const {repository}=useAttention();
  const [step,setStep]=useState(0),[name,setName]=useState(''),[url,setUrl]=useState(''),[description,setDescription]=useState(''),[category,setCategory]=useState('AI Tools'),[bid,setBid]=useState(String(MIN_INITIAL_BID)),[logo,setLogo]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[created,setCreated]=useState<Product|null>(null);
  const submitting=useRef(false);
  const close=()=>onCancel?onCancel():go(s.session&&s.role==='brand'?'/brand/products':'/');
  const bidValue=Number(bid);
  async function next(){
    setError('');
    if(step===0){
      if(!name.trim()||!description.trim()||!safeWebsite(url)){setError('Add your product name, a valid https:// website, and a short description.');return;}
      setStep(1);
      return;
    }
    if(step===1){
      if(!Number.isInteger(Number(bid))||Number(bid)<MIN_INITIAL_BID||Number(bid)>MAX_INITIAL_BID){setError(`Choose a whole-dollar bid from $${MIN_INITIAL_BID} to $${MAX_INITIAL_BID.toLocaleString()}.`);return;}
      setStep(2);
      return;
    }
    if(submitting.current)return;
    submitting.current=true;
    setBusy(true);
    try{
      setCreated(await repository.createProduct({brandId:repository.getOwnerBrandId(s.profile.name),brandName:s.profile.name.trim()||name.trim(),name,websiteUrl:url,description,category,logo:logo||name[0],initialBid:Number(bid)}));
    }catch(e){
      setError((e as Error).message);
    }finally{
      submitting.current=false;
      setBusy(false);
    }
  }
  return <div className="spotlight-wizard"><aside className="wizard-preview"><div className="wizard-orbit"/><span className="wizard-kicker"><Sparkles size={14}/> YOUR NEXT BIG MOMENT</span><Crown className="wizard-crown" size={48}/><h2>Small brand.<br/><em>Big spotlight.</em></h2><p>Great ideas deserve a place to shine.</p><div className="wizard-brand-preview"><span>{logo?<img src={logo} alt="Your logo preview"/>:name[0]?.toUpperCase()||'✦'}</span><strong>{name||'Your brand, right here'}</strong><small>{category} · from ${bid||MIN_INITIAL_BID}</small></div><span className="wizard-preview-foot">YOUR BRAND. NEW POSSIBILITIES.</span></aside><div className="wizard-main">
    {created?<div className="wizard-success"><span><Check size={30}/></span><h2>You’re in the spotlight.</h2><p>{created.name} is ready to be discovered.</p><small>Listing is free. No money was charged.</small><ShareListing product={created}/><Link href={`/discover/product/${created.slug}`} className="btn btn-primary spotlight-button">See your brand <ArrowRight size={16}/></Link></div>:<><nav className="wizard-steps" aria-label="Listing progress">{['Your brand','Placement','Review'].map((label,i)=><span key={label} className={i===step?'current':i<step?'complete':''} aria-current={i===step?'step':undefined}><b>{i<step?<Check size={12}/>:i+1}</b>{label}</span>)}</nav><form onSubmit={e=>{e.preventDefault();void next();}}><div className="wizard-step" key={step}><span className="wizard-kicker">STEP 0{step+1} / 03</span><h2>{['Let’s meet your brand.','Choose your spotlight.','Ready for your big moment?'][step]}</h2><p className="wizard-subtitle">{['A name, a link, and the idea behind it.','Make it yours. Listings start at just $2.','Review everything before you launch.'][step]}</p>
      {step===0?<><Field label="Brand name" placeholder="Your next big thing" required maxLength={60} value={name} onChange={e=>setName(e.target.value)}/><Field label="Website URL" placeholder="https://yourbrand.com" type="url" required value={url} onChange={e=>setUrl(e.target.value)}/><Textarea label="Short description" placeholder="What makes your brand worth discovering?" rows={2} required maxLength={240} value={description} onChange={e=>setDescription(e.target.value)}/></>:step===1?<><label className="wizard-upload"><span>{logo?<img src={logo} alt="Brand logo"/>:<Upload size={20}/>}</span><div><strong>Add your brand logo</strong><small>Optional · PNG, JPG, WebP · up to 500 KB</small></div><input aria-label="Upload brand logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>500000){setError('Choose a PNG, JPG, or WebP under 500 KB.');return;}const reader=new FileReader();reader.onload=()=>setLogo(String(reader.result));reader.onerror=()=>setError('Could not read the logo. Please try again.');reader.readAsDataURL(f);}}/></label><div className="field"><span>Category</span><Pick label="Brand category" value={category} onChange={setCategory} options={attentionCategories}/></div><Field label="Initial bid · USD" type="number" required min={MIN_INITIAL_BID} max={MAX_INITIAL_BID} step={1} value={bid} onChange={e=>setBid(e.target.value)}/><div className="wizard-note"><Crown size={16}/>Your cumulative bid determines your position.</div></>:<><div className="wizard-review"><strong>{name}</strong><small>{safeWebsite(url)?new URL(url).hostname:''} · {category}</small><p>{description}</p></div><dl className="wizard-receipt"><div><dt>Listing</dt><dd>Free</dd></div><div><dt>Initial bid</dt><dd>{money(Number.isFinite(bidValue)?bidValue:0)}</dd></div></dl><div className="wizard-note"><Check size={16}/>Listing is free. No card needed.</div></>}
    </div><div className="wizard-error" role="status">{error}</div><footer className="wizard-footer"><Button type="button" variant="ghost" disabled={busy} onClick={()=>step?setStep(step-1):close()}>{step?<><ArrowLeft size={15}/>Back</>:'Cancel'}</Button><Button className="spotlight-button" type="submit" disabled={busy}>{busy?<><Loader2 className="wizard-spinner" size={16}/>Launching…</>:<>{step===2?'Launch your brand':'Continue'}<ArrowRight size={16}/></>}</Button></footer></form></>}
  </div></div>;
}
