'use client';
import type {ComponentProps} from 'react';
import Link from '../ui/app-link';

export function BrandLink({brandId:_brandId,...props}:ComponentProps<typeof Link>&{brandId?:string}){
  return <Link {...props}/>;
}
