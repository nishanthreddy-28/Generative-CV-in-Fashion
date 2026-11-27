type Listener=()=>void;
let listVersion=0;
const imageVersions=new Map<string,number>();
const listeners=new Set<Listener>();

export const wardrobeChanges={
 subscribe(listener:Listener){
  listeners.add(listener);
  return ()=>{listeners.delete(listener);};
 },
 listVersion:()=>listVersion,
 imageVersion:(id:string)=>imageVersions.get(id)??0,
 invalidate(path:string){
  const route=path.split("?")[0];
  if(route==="/wardrobe"||route.startsWith("/wardrobe/"))listVersion++;
  else if(!/^\/ml\/garments\/[^/]+\/prepared$/.test(route))return;
  const id=route.startsWith("/wardrobe/")?route.split("/")[2]:
   route.startsWith("/ml/")?route.split("/")[3]:undefined;
  if(id)imageVersions.set(id,(imageVersions.get(id)??0)+1);
  listeners.forEach(listener=>listener());
 },
};
