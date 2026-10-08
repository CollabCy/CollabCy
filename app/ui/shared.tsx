'use client';
import React from 'react';
import Link from './app-link';
import {Search,Inbox,Camera} from 'lucide-react';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
export function Logo({white=false}:{white?:boolean}){return <Link href="/" className={`logo ${white?'white':''}`} aria-label="CollabCy home"><img className="brand-logo-image" src="/collabcy-mark.svg" alt="" width={42} height={42}/>Collab<span className="logo-light">Cy</span></Link>}
export function Button({children,variant='primary',className='',...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'ghost'|'danger'}){return <button className={`btn btn-${variant} ${className}`} {...props}>{children}</button>}
export function Pick({value,onChange,options,label,className=''}:{value:string;onChange:(v:string)=>void;options:string[];label?:string;className?:string}){return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label||'Choose an option'} className={`pick ${className}`}><SelectValue/></SelectTrigger><SelectContent>{options.map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>}
export function Field({label,hint,children,...props}:React.InputHTMLAttributes<HTMLInputElement>&{label:string;hint?:string;children?:React.ReactNode}){return <label className="field"><span>{label}{props.required&&<b> *</b>}</span>{children||<input {...props}/>} {hint&&<small>{hint}</small>}</label>}
export function Textarea({label,...props}:React.TextareaHTMLAttributes<HTMLTextAreaElement>&{label:string}){return <label className="field"><span>{label}{props.required&&<b> *</b>}</span><textarea {...props}/></label>}
export function Modal({open,onClose,title,description,children,wide=false}:{open:boolean;onClose:()=>void;title:string;description?:string;children:React.ReactNode;wide?:boolean}){return <Dialog open={open} onOpenChange={v=>!v&&onClose()}><DialogContent className={`app-modal ${wide?'wide':''}`}><DialogTitle>{title}</DialogTitle><DialogDescription>{description||'Review the details below.'}</DialogDescription>{children}</DialogContent></Dialog>}
export function PageTitle({eyebrow,title,description,children}:{eyebrow?:string;title:string;description?:string;children?:React.ReactNode}){return <div className="page-title"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h1>{title}<span>.</span></h1>{description&&<p>{description}</p>}</div>{children&&<div className="title-actions">{children}</div>}</div>}
export function SearchBox({value,onChange,placeholder='Search…'}:{value:string;onChange:(v:string)=>void;placeholder?:string}){return <label className="search-box"><Search size={18}/><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}/></label>}
export function Empty({title,description,children}:{title:string;description:string;children?:React.ReactNode}){return <div className="empty-state"><span><Inbox size={30}/></span><h3>{title}</h3><p>{description}</p>{children}</div>}
export function DemoNote({children}:{children?:React.ReactNode}){return <div className="demo-note"><span className="tiny-dot"/>{children||'Frontend preview · Sample data · No real payments or messages are sent.'}</div>}

export function Instagram({size=18,...props}:{size?:number;[key:string]:any}){return <Camera size={size} {...props}/>;}
export function Facebook({size=18,...props}:{size?:number;[key:string]:any}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}><text x="7" y="22" fontSize="25" fontWeight="bold" fontFamily="Arial">f</text></svg>;}
