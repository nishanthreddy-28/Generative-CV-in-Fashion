import type { SavedRecommendation, Page } from "../types/domain.ts";
import type { RequestOptions } from "../services/api/client.ts";
type Request=<T>(path:string,options?:Omit<RequestOptions,"token">)=>Promise<T>;
export function savedRecommendation(value:SavedRecommendation) {
  if(!value || !value.id || !value.recommendationId || !Number.isFinite(Date.parse(value.savedAt)) || typeof value.available!=="boolean" || value.available!==(value.recommendation!=null))
    throw new Error("Unexpected saved recommendation response.");
  if(value.recommendation) {
    if(!Array.isArray(value.recommendation.items) || value.recommendation.items.length!==2 ||
       !Array.isArray(value.recommendation.reasons) || !value.recommendation.reasons.every(reason=>typeof reason==="string") ||
       value.recommendation.items.some(item=>!["wardrobe","catalog"].includes(item.source) || !item.garmentId || !item.name))
      throw new Error("Unexpected saved recommendation details.");
    if(value.recommendation.id!==value.recommendationId)throw new Error("Saved recommendation provenance is invalid.");
  }
  return value;
}
export function savedPage(value:Page<SavedRecommendation>) {
  if(!value || !Array.isArray(value.items) || (value.nextCursor!=null && typeof value.nextCursor!=="string"))throw new Error("Unexpected saved recommendation page.");
  value.items.forEach(savedRecommendation);return value;
}
export async function saveRecommendation(request:Request,id:string) {
  const result=savedRecommendation(await request<SavedRecommendation>(`/recommendations/${encodeURIComponent(id)}/save`,{method:"POST"}));
  if(result.recommendationId!==id || !result.available)throw new Error("Recommendation is not available to save.");
  return result;
}
export async function removeSavedRecommendation(request:Request,id:string) {
  await request(`/recommendations/saved/${encodeURIComponent(id)}`,{method:"DELETE"});
}
// Synchronous guard covers a second click before React commits disabled state.
export function createMutationGate() {
  let active=false;
  return {async run<T>(action:()=>Promise<T>):Promise<T|undefined>{
    if(active)return undefined;active=true;
    try{return await action();}finally{active=false;}
  }};
}

export function savedStatus(id:string,serverId:string|null|undefined,state:Record<string,string|null>) {
  return Object.prototype.hasOwnProperty.call(state,id) ? state[id] : serverId ?? null;
}
