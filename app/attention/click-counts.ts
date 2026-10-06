export type ClickCounts=Record<string,number>;
export function incrementBrandClick(counts:ClickCounts,id:string):ClickCounts{return {...counts,[id]:(counts[id]||0)+1};}
export function readBrandClicks():ClickCounts{
 if(typeof window==='undefined')return {};
 try{const parsed=JSON.parse(localStorage.getItem('collabcy-brand-clicks')||'{}');if(!parsed||typeof parsed!=='object')return {};return Object.fromEntries(Object.entries(parsed).filter(([,n])=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0)) as ClickCounts;}catch{return {};}
}
