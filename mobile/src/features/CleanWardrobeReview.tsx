import {useEffect,useRef,useState} from "react";
import {Image,Text,View} from "react-native";
import {useSession} from "./session";
import {Button} from "../components/Button";
import {ProcessingCard} from "../components/ProcessingCard";
import {Notice,ui} from "../components/Screen";
type Piece={id:string;name:string;category:string};
type Ready={receipt:string;cutoutBase64:string;warnings:string[]};
export function CleanWardrobeReview({onSaved}:{onSaved:()=>void}){
 const {request}=useSession();
 const [items,setItems]=useState<Piece[]|null>(null);
 const [ready,setReady]=useState<Ready|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [saved,setSaved]=useState(0);
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>()=>controller.current?.abort(),[]);
 const current=items?.[0];
 async function start(){
  setBusy(true);setError("");setSaved(0);
  try{const page=await request<{items:Piece[]}>("/ml/garments/clean-photo-review");setItems(page.items);}
  catch(reason){setError(reason instanceof Error?reason.message:"Could not load your pieces.");}
  finally{setBusy(false);}
 }
 async function prepare(){
  if(!current)return;
  setBusy(true);setError("");controller.current=new AbortController();
  try{setReady(await request<Ready>(`/ml/garments/${current.id}/prepare`,{method:"POST",timeoutMs:180000,signal:controller.current.signal}));}
  catch(reason){setError(reason instanceof Error?reason.message:"Could not prepare this piece.");}
  finally{setBusy(false);controller.current=null;}
 }
 async function confirm(){
  if(!current||!ready)return;
  setBusy(true);setError("");
  try{await request(`/ml/garments/${current.id}/prepared`,{method:"POST",body:{receipt:ready.receipt,confirmed:true}});setSaved(value=>value+1);setReady(null);setItems(list=>list?.slice(1)??[]);onSaved();}
  catch(reason){setError(reason instanceof Error?reason.message:"The clean image was not saved.");}
  finally{setBusy(false);}
 }
 return <View style={ui.card}>
  <Text style={ui.heading}>A cleaner wardrobe</Text>
  {!items&&<><Text style={ui.body}>Prepare clean photos for pieces already in your wardrobe. Review each preview before saving; your originals stay safe.</Text><Button label="Review existing wardrobe photos" variant="secondary" disabled={busy} onPress={()=>void start()}/></>}
  {current&&<><Text style={ui.body}>{current.name} · {items!.length} to review</Text>
   {ready?<><Image source={{uri:`data:image/webp;base64,${ready.cutoutBase64}`}} accessibilityLabel={`Clean photo preview of ${current.name}`} resizeMode="contain" style={{width:"100%",height:240}}/>
    <Text style={ui.body}>Check sleeves, straps and edges before saving.</Text>{ready.warnings.map((warning,index)=><Text key={index} style={ui.body}>{warning}</Text>)}
    <Button label="Save clean photo & continue" loading={busy} disabled={busy} onPress={()=>void confirm()}/></>:<Button label="Prepare this photo" loading={busy} disabled={busy} onPress={()=>void prepare()}/>}
   <Button label="Skip this piece" variant="secondary" disabled={busy} onPress={()=>{setReady(null);setError("");setItems(list=>list?.slice(1)??[]);}}/>
  </>}
  {items?.length===0&&<Text style={ui.body}>{saved?`${saved} clean photos saved. `:""}This review is complete. Skipped pieces keep their original photo.</Text>}
  {busy&&<ProcessingCard title="Preparing your wardrobe…" detail="Keeping the garment, clearing the background."/>}
  {!!error&&<Notice title="Photo review needs attention" text={error} tone="error"/>}
  {items&&<Button label="Close photo review" variant="secondary" disabled={busy} onPress={()=>{setItems(null);setReady(null);setError("");}}/>}
 </View>;
}
