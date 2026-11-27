export function createSessionReadCache(){
 const pages=new Map<string,unknown>();
 const images=new Map<string,unknown>();
 const entries=(key:string)=>key.startsWith("image:")?images:pages;
 const pending=new Map<string,{controller:AbortController;promise:Promise<unknown>}>();
 return {
  get<T>(key:string){return entries(key).get(key) as T|undefined;},
  load<T>(key:string,read:(signal:AbortSignal)=>Promise<T>):Promise<T>{
   const values=entries(key);
   if(values.has(key)){
    const cached=values.get(key) as T;
    values.delete(key);
    values.set(key,cached);
    return Promise.resolve(cached);
   }
   const existing=pending.get(key);
   if(existing)return existing.promise as Promise<T>;
   const controller=new AbortController();
   const promise=read(controller.signal).then(value=>{
    if(!controller.signal.aborted){
     values.set(key,value);
     if(values===images&&values.size>120)values.delete(values.keys().next().value!);
    }
    return value;
   }).finally(()=>{
    if(pending.get(key)?.controller===controller)pending.delete(key);
   });
   pending.set(key,{controller,promise});
   return promise;
  },
  discardOldWardrobePages(version:number){
   const prefix="wardrobe:"+version+":";
   for(const key of pages.keys())if(!key.startsWith(prefix))pages.delete(key);
   for(const [key,entry] of pending){
    if(key.startsWith("wardrobe:")&&!key.startsWith(prefix)){
     entry.controller.abort();
     pending.delete(key);
    }
   }
  },
  clear(){
   pending.forEach(entry=>entry.controller.abort());
   pending.clear();
   pages.clear();
   images.clear();
  },
 };
}
