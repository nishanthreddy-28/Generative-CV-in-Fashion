import {createContext,useContext,useEffect,useState,type PropsWithChildren} from "react";
import {useSession} from "./session";

import {createSessionReadCache} from "./sessionCacheStore";
import {wardrobeChanges} from "./wardrobeChanges";

const CacheContext=createContext<ReturnType<typeof createSessionReadCache>|null>(null);
function Cache({children}:PropsWithChildren){
 const [cache]=useState(createSessionReadCache);
 useEffect(()=>{
  let version=wardrobeChanges.listVersion();
  const unsubscribe=wardrobeChanges.subscribe(()=>{
   const next=wardrobeChanges.listVersion();
   if(next!==version){
    version=next;
    cache.discardOldWardrobePages(next);
   }
  });
  return ()=>{unsubscribe();cache.clear();};
 },[cache]);
 return <CacheContext.Provider value={cache}>{children}</CacheContext.Provider>;
}
export function SessionReadCacheProvider({children}:PropsWithChildren){
 const {session,accountDeleting}=useSession();
 return <Cache key={accountDeleting?"deleting":session?.user.id??"signed-out"}>{children}</Cache>;
}
export function useSessionReadCache(){
 const cache=useContext(CacheContext);
 if(!cache)throw new Error("Session cache provider is missing");
 return cache;
}
