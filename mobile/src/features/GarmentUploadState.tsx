import type {RequestOptions} from "../services/api/client";
import {createContext,useContext,useEffect,useRef,useState,type PropsWithChildren} from "react";
import {appendPhoto,type Photo} from "../components/PhotoField";
import {useSession} from "./session";
import {completePieceSave,PieceSaveFailure} from "./pieceSave";
import {suggestedPiece,validPiece} from "./pieceReview";
import {ApiError} from "../services/api/client";
type Analysis={preparation?:{receipt:string;category:string;cutoutBase64:string;warnings:string[]};category:string;slot:string;colors:{name:string}[];route:"auto"|"review"|"ask";warnings:string[];cutoutUsed:boolean;cutoutMime:"image/webp";cutoutBase64:string;attributes:{pattern:string;season:string;fit:string;formality:string}};
function useUploadState(){
 const {request}=useSession();
 const [photo,setPhoto]=useState<Photo|null>(null);
 const [values,setValues]=useState<Record<string,string>>({});
 const [analysis,setAnalysis]=useState<{photo:Photo;value:Analysis}|null>(null);
 const [busy,setBusy]=useState<"analyse"|"save"|null>(null);
 const [error,setError]=useState("");
 const [prepared,setPrepared]=useState<{receipt:string;category:string;cutoutBase64:string;warnings:string[]}|null>(null);
 const [savedId,setSavedId]=useState<string|null>(null);
 const saveLock=useRef(false);
 const [saved,setSaved]=useState(false);
 const [editing,setEditing]=useState(false);
 const [duplicate,setDuplicate]=useState(false);
 const [view,setView]=useState<"original"|"cutout">("cutout");
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const reviewed=analysis?.photo===photo?analysis.value:null;
 function changePhoto(next:Photo|null){
   controller.current?.abort();setPhoto(next);setAnalysis(null);setPrepared(null);setSavedId(null);setValues({});setError("");setDuplicate(false);setEditing(false);setSaved(false);setView("cutout");
 }
 async function analyse(){
   if(!photo||busy||controller.current||saveLock.current)return;
   setBusy("analyse");setError("");setDuplicate(false);
   const selected=photo;controller.current=new AbortController();
   try{
     const form=new FormData();appendPhoto(form,"image",selected);
     const response=await request<Analysis>("/ml/garments/analyse-upload"+(analysis&&values.category?"?category="+encodeURIComponent(values.category):""),{method:"POST",body:form,timeoutMs:180000,signal:controller.current.signal});
     if(!response.category||!Array.isArray(response.colors)||!response.cutoutBase64)throw new Error("We could not finish reading this photo. Please try again.");
     const suggestions=suggestedPiece(response);
     if(analysis&&values.category)suggestions.category=values.category as typeof suggestions.category;
     if(!response.preparation)throw new Error("The clean wardrobe image could not be prepared. Please try again.");
     setPrepared(response.preparation);
     setValues(analysis?{...values,category:suggestions.category}:suggestions);setAnalysis({photo:selected,value:response});setEditing(response.route!=="auto");
   }catch(reason){
     setError(reason instanceof Error?reason.message:"We could not analyse this photo.");
   }finally{setBusy(null);controller.current=null;}
 }
 async function save(allowDuplicate=false){
   if(!photo||!reviewed||busy||saveLock.current)return;
   if(!validPiece(values)){setEditing(true);setError("Add a name and choose a category. Names and colours can contain up to 200 characters.");return;}
   saveLock.current=true;
   const saveController=new AbortController();
   controller.current=saveController;
   const saveRequest=<T,>(path:string,options:Omit<RequestOptions,"token">)=>
     request<T>(path,{...options,signal:saveController.signal});
   setBusy("save");setError("");setDuplicate(false);
   try{
     await completePieceSave({request:saveRequest,savedId,values,preparation:prepared?.category===values.category?prepared:null,onCreated:setSavedId,
       createForm:()=>{const form=new FormData();appendPhoto(form,"image",photo);
         form.append("metadata",JSON.stringify({name:values.name.trim(),category:values.category,color:values.color?.trim()??"",allowDuplicate}));return form;}});
     setPhoto(null);setValues({});setAnalysis(null);setPrepared(null);setSavedId(null);setSaved(true);
   }catch(reason){
     const stage=reason instanceof PieceSaveFailure?reason.stage:"review";
     const existingId=reason instanceof PieceSaveFailure?reason.savedId:savedId;
     const failure=reason instanceof PieceSaveFailure?reason.reason:reason;
     if(stage==="create"&&failure instanceof ApiError&&failure.status===409){setDuplicate(true);setError("This photo may already be in your wardrobe. Check it before keeping another piece.");}
     else if(existingId&&stage==="cutout"){
       if(failure instanceof ApiError&&failure.status===409)setPrepared(null);
       setError(failure instanceof ApiError&&failure.status===409
       ? "Your original photo is saved, but the clean image needs a fresh check. Check the photo again, then save to finish this same piece."
       : "Your original photo is saved, but the clean image could not be attached. Retry Save to finish this same piece.");
     }else setError(reason instanceof Error?reason.message:"Your piece was not saved. Please try again.");
   }finally{controller.current=null;setBusy(null);saveLock.current=false;}
 }
 return {photo,values,setValues,busy,error,prepared,setPrepared,savedId,editing,setEditing,duplicate,view,setView,reviewed,changePhoto,analyse,save,saved,cancel:()=>controller.current?.abort()};
}

const Context=createContext<ReturnType<typeof useUploadState>|null>(null);
function State({children}:PropsWithChildren){
 return <Context.Provider value={useUploadState()}>{children}</Context.Provider>;
}
export function GarmentUploadStateProvider({children}:PropsWithChildren){
 const {session,accountDeleting}=useSession();
 const key=accountDeleting?"deleting":session?.user.id??"signed-out";
 return <State key={key}>{children}</State>;
}
export function useGarmentUploadState(){
 const state=useContext(Context);
 if(!state)throw new Error("GarmentUploadState provider is missing");
 return state;
}
