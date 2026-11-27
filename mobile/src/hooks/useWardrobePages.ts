import {useCallback,useEffect,useState,useSyncExternalStore} from "react";
import {useSession} from "../features/session";
import {useSessionReadCache} from "../features/SessionReadCache";
import {wardrobeChanges} from "../features/wardrobeChanges";
import {readPage} from "../services/api/readResponse";
import type {Garment,Page} from "../types/domain";

type Loaded={items:Garment[];nextCursor:string|null;count:number};

export function useWardrobePages(query:string, count:number, enabled:boolean){
 const {request,session,accountDeleting}=useSession();
 const cache=useSessionReadCache();
 const version=useSyncExternalStore(wardrobeChanges.subscribe,wardrobeChanges.listVersion);
 const [retryCount,setRetryCount]=useState(0);
 const [state,setState]=useState<{key:string;error:string}|null>(null);
 const active=enabled&&!!session&&!accountDeleting;
 const prefix="wardrobe:"+version+":"+query;
 const key=JSON.stringify([prefix,count,retryCount,session?.user.id]);
 const pageKey=(cursor:string|null)=>prefix+":"+JSON.stringify(cursor);
 const items=new Map<string,Garment>();
 let cursor:string|null=null;
 let loaded:Loaded|null=null;
 if(active){
  for(let index=0;index<count;index++){
   const page:Page<Garment>|undefined=cache.get(pageKey(cursor));
   if(!page)break;
   for(const garment of page.items)items.set(garment.id,garment);
   cursor=page.nextCursor??null;
   loaded={items:[],nextCursor:cursor,count:index+1};
   if(!cursor)break;
  }
  if(loaded)loaded.items=[...items.values()];
 }
 useEffect(()=>{
  if(!active)return;
  let live=true;
  async function load(){
   let next:string|null=null;
   for(let index=0;index<count;index++){
    const path=query+(next?"&cursor="+encodeURIComponent(next):"");
    const page:Page<Garment>=await cache.load(prefix+":"+JSON.stringify(next),async signal=>readPage(await request<Page<Garment>>(path,{signal})));
    if(!live)return;
    next=page.nextCursor??null;
    setState({key,error:""});
    if(!next)break;
   }
  }
  void load().catch(error=>{
   if(live)setState({key,error:error instanceof Error?error.message:"Could not load wardrobe pieces."});
  });
  return ()=>{live=false;};
 },[active,cache,count,key,prefix,query,request]);
 const error=state?.key===key?state.error:"";
 const complete=!!loaded&&(loaded.count===count||!loaded.nextCursor);
 return {data:loaded,loading:active&&!complete&&!error,error,retry:useCallback(()=>setRetryCount(n=>n+1),[])};
}
