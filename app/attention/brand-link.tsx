'use client';
import type {ComponentProps} from 'react';
import Link from '../ui/app-link';
import {useAttention} from './store';
export function BrandLink({brandId,onClick,...props}:ComponentProps<typeof Link>&{brandId:string}){
 const {repository}=useAttention();
 return <Link {...props} onClick={event=>{onClick?.(event);if(!event.defaultPrevented)repository.recordBrandClick(brandId);}}/>;
}
