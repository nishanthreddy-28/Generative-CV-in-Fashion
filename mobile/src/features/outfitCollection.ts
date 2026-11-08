import type { Outfit, Page } from "../types/domain.ts";
import type { RequestOptions } from "../services/api/client.ts";

export type OutfitFilters = { search: string; source: string; category: string; sort: string; from: string; through: string };
export const emptyOutfitFilters: OutfitFilters = { search:"",source:"",category:"",sort:"newest",from:"",through:"" };
function day(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Use dates in YYYY-MM-DD format.");
  const date=new Date(value+"T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==value) throw new Error("Enter a valid date.");
  return date;
}
export function outfitQuery(filters: OutfitFilters, cursor?: string) {
  const params=new URLSearchParams({search:filters.search.trim(),source:filters.source,category:filters.category,sort:filters.sort,limit:"24"});
  const start=filters.from ? day(filters.from) : null;
  const end=filters.through ? day(filters.through) : null;
  if (start && end && start>end) throw new Error("The end date must not precede the start date.");
  if(start)params.set("created_from",start.toISOString());
  if(end) { end.setUTCDate(end.getUTCDate()+1);params.set("created_before",end.toISOString()); }
  if(cursor)params.set("cursor",cursor);
  return "/outfits?"+params;
}
export function mergeOutfits(current: Outfit[], incoming: Outfit[]) {
  const values=new Map(current.map(item=>[item.id,item]));
  incoming.forEach(item=>values.set(item.id,item));
  return [...values.values()];
}
type Request = <T>(path:string,options?:Omit<RequestOptions,"token">)=>Promise<T>;
// Re-anchor every refresh at the first page. Old cursor chains are not reused after edits.
export async function loadOutfitPages(request: Request, filters: OutfitFilters, count: number, signal?: AbortSignal) {
  let items:Outfit[]=[];let cursor:string|undefined;let loaded=0;
  const seen=new Set<string>();
  do {
    const page=await request<Page<Outfit>>(outfitQuery(filters,cursor),{signal});
    if(signal?.aborted)throw new Error("Request cancelled.");
    if(!page || !Array.isArray(page.items) || (page.nextCursor!=null && typeof page.nextCursor!=="string"))throw new Error("Invalid outfit page.");
    items=mergeOutfits(items,page.items);loaded++;
    cursor=page.nextCursor || undefined;
    if(cursor && seen.has(cursor))throw new Error("The outfit cursor did not advance. Refresh the list.");
    if(cursor)seen.add(cursor);
  } while(cursor && loaded<count);
  return {items,nextCursor:cursor ?? null};
}
