import {useCallback,useRef,useState} from "react";
import {useFocusEffect} from "expo-router";
import {Text,View} from "react-native";
import {useSession} from "./session";
import {useResource} from "../hooks/useResource";
import {ResourceState,Notice,ui} from "../components/Screen";
import {Button} from "../components/Button";
import {WardrobeImage} from "../components/WardrobeImage";
import {hasSavedLook} from "./outfitGroups";
import type {Look,Result} from "./StylistState";

export function GeneratedLooks(){
 const {request}=useSession();
 const history=useResource<{items:Result[]}>("/ml/history?limit=100",false);
 const retry=history.retry;
 useFocusEffect(useCallback(()=>{retry();},[retry]));
 const savingRef=useRef(false);
 const [saving,setSaving]=useState<string|null>(null);
 const [saved,setSaved]=useState<string[]>([]);
 const [error,setError]=useState("");
 const seen=new Set<string>();
 const looks=(history.data?.items??[]).filter(turn=>turn.kind==="stylist"&&turn.status==="recommended").flatMap(turn=>turn.outfits).filter(look=>{
  const key=look.items.map(piece=>piece.source+":"+piece.garmentId).sort().join("|");
  if(seen.has(key))return false;seen.add(key);return true;
 });
 async function save(look:Look){
  if(savingRef.current)return;
  savingRef.current=true;
  setSaving(look.id);setError("");
  try{
   if(!await hasSavedLook(path=>request(path),look.items))await request("/outfits",{method:"POST",body:{
    name:look.items.slice(0,2).map(piece=>piece.name).join(" + ").slice(0,200),description:look.explanation.slice(0,2000),occasion:"",
    items:look.items.map(piece=>({source:piece.source,garmentId:piece.garmentId}))}});
   setSaved(ids=>[...ids,look.id]);
  }catch(reason){setError(reason instanceof Error?reason.message:"Could not save this look.");}
  finally{setSaving(null);savingRef.current=false;}
 }
 return <View style={{gap:16}}>
  <Text style={ui.body}>Your looks from the latest 100 stylist responses. Save favourites to keep them with your created outfits.</Text>
  <ResourceState loading={history.loading} error={history.error} retry={retry}/>
  {!!error&&<Notice title="Could not save look" text={error} tone="error"/>}
  {!history.loading&&!history.error&&!looks.length&&<Notice title="Your generated looks will appear here" text="Ask your AI stylist to create an outfit from your wardrobe."/>}
  {looks.map(look=><View key={look.id} style={ui.card}>
   <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>{look.items.map(piece=><View key={piece.source+piece.garmentId} style={{width:"47%",gap:6}}>
    <WardrobeImage id={piece.garmentId} source={piece.source} label={piece.name}/><Text style={ui.label}>{piece.name}</Text>
   </View>)}</View>
   <Text style={ui.body}>{look.explanation}</Text>
   <Button label={saved.includes(look.id)?"Saved to outfits":"Save this look"} variant="secondary" loading={saving===look.id} disabled={saving!==null||saved.includes(look.id)} onPress={()=>void save(look)}/>
  </View>)}
 </View>;
}
