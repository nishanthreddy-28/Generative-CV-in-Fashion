import type {Garment,TryOnJob} from '../types/domain.ts';
export function collectionColumns(windowWidth:number){return Math.min(windowWidth,660)-48>=320 ? 2 : 1;}
export function garmentSummary(item:Pick<Garment,'brand'|'color'|'size'>){return [item.brand,item.color,item.size].filter(value=>typeof value==='string' && value.trim()).join(' · ');}
export function priceLabel(value:unknown){return typeof value==='number' && Number.isFinite(value) && value>=0 ? new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:2}).format(value) : null;}
export function jobPresentation(job:Pick<TryOnJob,'status'|'failureCode'>){
 if(job.failureCode==='CANCELLED')return {title:'Cancelled',tone:'neutral',detail:'You cancelled this request. Photo cleanup has been requested.'} as const;
 if(job.failureCode==='INPUT_EXPIRED')return {title:'Photo expired',tone:'neutral',detail:'This input is no longer available. Start a new request with a new photo if needed.'} as const;
 if(job.status==='failed')return {title:'Request failed',tone:'error',detail:'Your request could not be processed. You can start a new request.'} as const;
 if(job.status==='processing')return {title:'Processing',tone:'neutral',detail:'The job is marked as processing. Refresh to check for a status change.'} as const;
 if(job.status==='completed')return {title:'Completed',tone:'positive',detail:'The job is marked complete. No generated result image is available in this release.'} as const;
 return {title:'Queued',tone:'neutral',detail:'Your request is saved. Image generation is unavailable, so it will not produce a result yet.'} as const;
}
export function fieldAutofill(key:string,kind?:string,passwordPurpose?:"new"|"current"){
 if(kind==='email')return 'email' as const;
 if(kind==='password')return passwordPurpose==='new' || (passwordPurpose!=='current' && /new|confirm/i.test(key)) ? 'new-password' as const : 'current-password' as const;
 if(key==='name')return 'name' as const;
 return 'off' as const;
}
