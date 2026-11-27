import {createContext,useContext,useEffect,useRef,useState,type PropsWithChildren} from "react";
import {appendPhoto,type Photo} from "../components/PhotoField";
import {useSession} from "./session";
import type {OutfitItem} from "../types/domain";

type Preview={createdAt?:string;id:string;kind:string;provider:string;warnings:string[];imageUrl:string};
function useTryOn(){
  const {request}=useSession();
  const [items,setItems]=useState<OutfitItem[]>([]);
  const [photo,setPhoto]=useState<Photo|null>(null);
  const [consent,setConsent]=useState(false);
  const [provider,setProvider]=useState("WeShopAI");
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const [result,setResult]=useState<Preview|null>(null);
  const [deleteTarget,setDeleteTarget]=useState<Preview|null>(null);
  const [loadingHistory,setLoadingHistory]=useState(false);
  const historyLock=useRef(false);
  const [historyLoaded,setHistoryLoaded]=useState(false);
  const deletionLock=useRef(false);
  const [history,setHistory]=useState<Preview[]>([]);
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  async function reload(){
    if(historyLock.current)return;
    historyLock.current=true;setLoadingHistory(true);setError("");
    try{const page=await request<{items:Preview[]}>("/ml/history?kind=tryon&limit=100");setHistory(page.items.filter(item=>item.kind==="tryon"));setHistoryLoaded(true);}
    catch(reason){setError(reason instanceof Error?reason.message:"Previews could not be loaded.");}
    finally{historyLock.current=false;setLoadingHistory(false);}
  }
  async function removePreview(){
    if(!deleteTarget||deletionLock.current||controller.current||historyLock.current)return;
    deletionLock.current=true;setBusy(true);setError("");
    const target=deleteTarget;
    try{
      await request(`/ml/history/${encodeURIComponent(target.id)}`,{method:"DELETE"});
      setHistory(items=>items.filter(item=>item.id!==target.id));
      setResult(current=>current?.id===target.id?null:current);setDeleteTarget(null);
    }catch(reason){setError(reason instanceof Error?reason.message:"Could not delete this preview. Please retry.");}
    finally{setBusy(false);deletionLock.current=false;}
  }
  async function generate(){
    if(controller.current||deletionLock.current)return;
    if(!photo||items.length!==1||!consent){setError("Choose one garment and a person photo, then confirm photo consent.");return;}
    setBusy(true);setError("");controller.current=new AbortController();
    try{
      const form=new FormData();appendPhoto(form,"person",photo);
      form.append("garmentId",items[0].garmentId);form.append("source",items[0].source);form.append("photoConsent","true");
      const response=await request<Preview>(`/ml/session-tryon?provider=${provider==="IDM-VTON"?"idm":"weshop"}`,
        {method:"POST",body:form,timeoutMs:180000,signal:controller.current.signal});
      setResult(response);await reload();
    }catch(reason){setError(reason instanceof Error?reason.message:"Try-on failed.");}
    finally{setBusy(false);controller.current=null;}
  }
 return {items,setItems,photo,setPhoto,consent,setConsent,provider,setProvider,busy,error,setError,result,setResult,deleteTarget,setDeleteTarget,loadingHistory,historyLoaded,history,reload,removePreview,generate,cancel:()=>controller.current?.abort()};
}

const Context=createContext<ReturnType<typeof useTryOn>|null>(null);
function State({children}:PropsWithChildren){
 return <Context.Provider value={useTryOn()}>{children}</Context.Provider>;
}
export function TryOnStateProvider({children}:PropsWithChildren){
 const {session,accountDeleting}=useSession();
 const key=accountDeleting?"deleting":session?.user.id??"signed-out";
 return <State key={key}>{children}</State>;
}
export function useTryOnState(){
 const state=useContext(Context);
 if(!state)throw new Error("TryOnState provider is missing");
 return state;
}
