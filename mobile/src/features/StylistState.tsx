import {createContext,useContext,useEffect,useRef,useState,type PropsWithChildren} from "react";
import {useSession} from "./session";
import type {OutfitItem} from "../types/domain";
export type Piece={source:"wardrobe"|"catalog";garmentId:string;name:string};
export type Look={id:string;items:Piece[];rankingScore:number;explanation:string;fitNotes:string[]};
export type Result={id:string;conversationId:string;kind?:string;status:string;message:string;userMessage?:string;outfits:Look[];warnings:string[];bookmarked?:boolean;feedback?:"like"|"dislike"|null};
function useCreateState(){
 const [values,setValues]=useState<Record<string,string>>({message:"",count:"1",pieces:"My wardrobe"});
 const [conversation,setConversation]=useState<string|null>(null);
 const [current,setCurrent]=useState<Result|null>(null);
 const [history,setHistory]=useState<Result[]>([]);
 const [selected,setSelected]=useState<OutfitItem[]>([]);
 const [pending,setPending]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [message,setMessage]=useState("");
 const [savedLooks,setSavedLooks]=useState<string[]>([]);
 const controllerRef=useRef<AbortController|null>(null);
 const requestLockRef=useRef(false);
 useEffect(()=>()=>controllerRef.current?.abort(),[]);
 return {values,setValues,conversation,setConversation,current,setCurrent,history,setHistory,selected,setSelected,pending,setPending,busy,setBusy,error,setError,message,setMessage,savedLooks,setSavedLooks,controllerRef,requestLockRef};
}
const Context=createContext<ReturnType<typeof useCreateState>|null>(null);
function State({children}:PropsWithChildren){return <Context.Provider value={useCreateState()}>{children}</Context.Provider>;}
export function StylistStateProvider({children}:PropsWithChildren){
 const {session}=useSession();
 return <State key={session?.user.id??"signed-out"}>{children}</State>;
}
export function useStylistState(){const value=useContext(Context);if(!value)throw new Error("Stylist state unavailable");return value;}
