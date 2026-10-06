'use client';
import Link from '../ui/app-link';
import {ArrowRight,ArrowUpRight,Plus} from 'lucide-react';
import {Button,PageTitle,DemoNote,Empty} from '../ui/shared';
import {useStore} from '../store';
import {useAttention} from './store';
import {isActive} from './model';
import {ProductLogo} from './components';
import {ShareListing} from './share';
import {money} from '../data';
import {SpotlightWizard} from './spotlight-wizard';
export function BrandProducts({creating=false,onCancel}:{creating?:boolean;onCancel?:()=>void}){const {s,go}=useStore();const {state,repository}=useAttention();const brandId=repository.getOwnerBrandId(s.profile.name);const products=brandId?state.products.filter(p=>p.brandId===brandId):[];
if(!creating)return <><PageTitle eyebrow="YOUR PRODUCT. A LITTLE MORE ATTENTION." title="Your promoted products" description="A home for products that deserve to be discovered."><Button onClick={()=>go('/brand/products/new')}><Plus size={17}/>Promote your product</Button></PageTitle><DemoNote>Brand account access is free. Product listing fees and bids are simulated.</DemoNote>{products.length?<div className="brand-product-list">{products.map(p=><article className="panel" key={p.id}><ProductLogo product={p}/><div><h2>{p.name}</h2><p>{p.description}</p><small>{isActive(p)?'Active':'Expired'} · Ends {new Date(p.listingEndsAt).toLocaleDateString()}</small></div><strong>{money(p.currentBid)}</strong><Link className="btn btn-secondary" href={`/brands/product/${p.slug}`}>Product details <ArrowUpRight size={16}/></Link><ShareListing product={p}/></article>)}</div>:<Empty title="Your product’s next chapter starts here." description="List for visibility, discovery, and website visits."><Button onClick={()=>go('/brand/products/new')}>Promote your product <ArrowRight size={16}/></Button></Empty>}</>;
return <SpotlightWizard onCancel={onCancel} />;}
