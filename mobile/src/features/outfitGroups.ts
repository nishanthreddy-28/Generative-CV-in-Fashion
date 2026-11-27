import type {Outfit} from "../types/domain";
export function groupSavedOutfits(items:Outfit[]){
 const groups=new Map<string,{outfit:Outfit;copies:Outfit[]}>();
 for(const outfit of items){
  const references=outfit.items?.length?outfit.items.map(item=>item.source+":"+item.garmentId):outfit.garmentIds.map(id=>"wardrobe:"+id);
  const signature=references.length?references.sort().join("|"):outfit.id;
  const group=groups.get(signature);
  if(group)group.copies.push(outfit);else groups.set(signature,{outfit,copies:[outfit]});
 }
 return [...groups.values()];
}


export function outfitSignature(items:{source:string;garmentId:string}[]){
 return items.map(item=>item.source+":"+item.garmentId).sort().join("|");
}
export async function hasSavedLook(read:(path:string)=>Promise<{items:Outfit[];nextCursor?:string|null}>,items:{source:string;garmentId:string}[]){
 const signature=outfitSignature(items);
 let cursor:string|null=null;
 const visited=new Set<string>();
 do{
  const page=await read('/outfits?limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''));
  if(page.items.some(item=>outfitSignature(item.items??item.garmentIds.map(id=>({source:'wardrobe',garmentId:id})))===signature))return true;
  cursor=page.nextCursor??null;
  if(cursor&&visited.has(cursor))throw new Error('Could not check saved outfits. Please try again.');
  if(cursor)visited.add(cursor);
 }while(cursor);
 return false;
}
