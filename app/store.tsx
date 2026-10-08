'use client';
import React,{createContext,useContext} from 'react';
import {useRouter} from 'next/navigation';
import {toInAppPath} from '@/lib/app-origin';

type NavState={profile:{name:string}};
type Store={s:NavState;ready:true;go:(path:string)=>void};
const Context=createContext<Store>(null!);
const empty:NavState={profile:{name:''}};

export function StoreProvider({children}:{children:React.ReactNode}){
  const router=useRouter();
  const go=(path:string)=>{router.push(toInAppPath(path));window.scrollTo({top:0,behavior:'instant'})};
  return <Context.Provider value={{s:empty,ready:true,go}}>{children}</Context.Provider>;
}
export const useStore=()=>useContext(Context);
