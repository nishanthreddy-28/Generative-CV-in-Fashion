import {useCallback,useEffect,useState,useSyncExternalStore} from "react";
import {useSession} from "../features/session";
import {useSessionReadCache} from "../features/SessionReadCache";
import {wardrobeChanges} from "../features/wardrobeChanges";

function toDataUrl(blob:Blob):Promise<string>{
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onload=()=>typeof reader.result==="string"?resolve(reader.result):reject(new Error("Photo unavailable"));
  reader.onerror=()=>reject(new Error("Photo unavailable"));
  reader.readAsDataURL(blob);
 });
}

export function useCachedWardrobeImage(id:string,path:string,enabled:boolean){
 const {request,session,accountDeleting}=useSession();
 const cache=useSessionReadCache();
 const getVersion=useCallback(()=>wardrobeChanges.imageVersion(id),[id]);
 const version=useSyncExternalStore(wardrobeChanges.subscribe,getVersion);
 const [attempt,setAttempt]=useState(0);
 const [status,setStatus]=useState<{key:string;uri?:string}|null>(null);
 const key="image:"+JSON.stringify([path,version,attempt]);
 const cached=cache.get<string>(key);
 const active=enabled&&!!session&&!accountDeleting;
 useEffect(()=>{
  if(!active)return;
  let live=true;
  void cache.load(key,async signal=>toDataUrl(await request<Blob>(path,{signal,responseType:"image"}))).then(uri=>{
   if(live)setStatus({key,uri});
  },()=>{
   if(live)setStatus({key});
  });
  return ()=>{live=false;};
 },[active,cache,key,path,request]);
 return {
  uri:active?(cached??(status?.key===key?status.uri:undefined)):undefined,
  error:active&&!cached&&status?.key===key&&!status.uri,
  retry:()=>setAttempt(number=>number+1),
 };
}
