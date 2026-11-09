import { useDraft } from "../hooks/useDraft";
import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Text, View } from "react-native";
import { Screen, Gate, Notice, RouteLink, ResourceState, usePreview, ui } from "../components/Screen";
import {WardrobeImage} from "../components/WardrobeImage";
import { Button } from "../components/Button";
import { Fields } from "../components/Fields";
import { useResource } from "../hooks/useResource";
import { validate, type Field } from "./validation";
import { useSession } from "./session";
import { itemRoute } from "./outfitItems";
import { recommendationResults } from "./recommendationResults";
import { createMutationGate, saveRecommendation, savedStatus } from "./savedRecommendationActions";
import type { Recommendation, Page } from "../types/domain";
const fields: Field[] = [
  { key:"occasion",label:"Occasion",required:true,options:["Everyday","Work","Evening","Weekend","Special occasion"] },
  { key:"preferences",label:"What are you in the mood for?",kind:"multiline",hint:"List colours, materials or brands you like. Preference words are matched literally; exclusions are not interpreted." },
  { key:"wardrobeOnly",label:"Pieces to include",required:true,options:["My wardrobe only","Wardrobe and catalog"] },
];
export function RecommendationLooks({items,preview,onSave,onCreateOutfit,saved,saving}: {
  items:Recommendation[];preview:boolean;onSave?:(look:Recommendation)=>void;onCreateOutfit?:(look:Recommendation)=>void;saved?:Record<string,string|null>;saving?:string;
}) {
  return <>{items.map(look=><View key={look.id} style={ui.card}>
    <Text style={ui.heading}>{look.name}</Text>
    <Text style={ui.body}>{look.occasion} · Compatibility rule score {look.score}/100</Text>
    <View style={{flexDirection:"row",gap:12,flexWrap:"wrap"}}>
    {look.items.map(piece=><View key={`${piece.source}:${piece.garmentId}`} style={{flex:1,minWidth:130,gap:10}}>
      <WardrobeImage id={piece.garmentId} label={piece.name} source={piece.source} preview={preview}/>
      <Text style={ui.body}>{piece.name} · {piece.category}{piece.color ? ` · ${piece.color}` : ""}</Text>
      <RouteLink to={itemRoute(piece)} preview={preview}>View {piece.source} piece →</RouteLink>
    </View>)}
    </View>
    <Text style={ui.label}>Why it works</Text>
    {look.reasons.map(reason=><Text key={reason} style={ui.body}>• {reason}</Text>)}
    {onSave && <Button label={savedStatus(look.id,look.savedId,saved ?? {}) ? "Saved" : "Save recommendation"}
      disabled={Boolean(savedStatus(look.id,look.savedId,saved ?? {}) || saving)} loading={saving===look.id} onPress={()=>onSave(look)} />}
    {onCreateOutfit && <Button label="Save as outfit" variant="secondary" disabled={Boolean(saving)} onPress={()=>onCreateOutfit(look)}/>}
  </View>)}</>;
}
export function RecommendationsScreen() {
  const preview=usePreview();const {session,request}=useSession();
  const [values,setValues]=useDraft<Record<string,string>>("recommendations:fields",{});
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [generated,setGenerated]=useState<{owner:string;items:Recommendation[]}|null>(null);
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
  const [saved,setSaved]=useDraft<Record<string,string|null>>("recommendations:saved-state",{});
  const [saving,setSaving]=useState("");const gate=useRef(createMutationGate());
  const history=useResource<Page<Recommendation>>("/recommendations?limit=10",preview);
  const refreshHistory=history.retry;
  useFocusEffect(useCallback(()=>{refreshHistory();},[refreshHistory]));
  useEffect(()=>{
    if(!history.data)return;
    let items:Recommendation[];
    try{items=recommendationResults(history.data);}catch{return;}
    setSaved(current=>{
      const next={...current};
      for(const look of items) {
        next[look.id]=look.savedId ?? null;
      }
      return next;
    });
  },[history.data,setSaved]);
  const looks=generated?.owner===session?.user.id ? generated?.items : null;
  let recent:Recommendation[]=[];let historyError="";
  if(history.data) {
    try {recent=recommendationResults(history.data);}
    catch(e){historyError=e instanceof Error ? e.message : "Unable to read recommendations.";}
  }
  async function generate() {
    const issues=validate(fields,values);setErrors(issues);setMessage("");
    if(Object.keys(issues).length)return;
    if(preview){setMessage("Preview only. No recommendations have been generated.");return;}
    if(!session)return;
    const owner=session.user.id;setBusy(true);setGenerated(null);
    try {
      const response=await request<Page<Recommendation>>("/recommendations",{method:"POST",body:{
        occasion:values.occasion,preferences:values.preferences ?? "",wardrobeOnly:values.wardrobeOnly==="My wardrobe only"}});
      const items=recommendationResults(response);setGenerated({owner,items});
      setMessage(items.length ? "Recommendations generated using your available pieces." : "No compatible pairs were found among the selected pieces.");
      history.retry();
    } catch(e){setMessage(e instanceof Error ? e.message : "Unable to generate recommendations.");}
    finally{setBusy(false);}
  }
  async function save(look:Recommendation) {
    if(preview){setMessage("Preview only. No recommendation has been saved.");return;}
    if(!session)return;
    await gate.current.run(async()=>{
      setSaving(look.id);setMessage("");
      try {
        const value=await saveRecommendation(request,look.id);
        setSaved(current=>({...current,[look.id]:value.id}));
        setMessage("Recommendation saved.");history.retry();
      }catch(e){setMessage(e instanceof Error ? e.message : "Unable to save recommendation.");}
      finally{setSaving("");}
    });
  }
  async function saveOutfit(look:Recommendation){
    if(preview){setMessage("Preview only. No outfit saved.");return;}
    await gate.current.run(async()=>{
      setSaving(look.id);
      try{const result=await request<{id:string}>("/outfits",{method:"POST",body:{recommendationId:look.id}});router.push(`/outfits/${encodeURIComponent(result.id)}`);}
      catch(e){setMessage(e instanceof Error ? e.message : "Unable to save outfit.");}
      finally{setSaving("");}
    });
  }
  return <Screen title="Find your next look." subtitle="Thoughtful combinations, made from your available pieces.">
    <Gate preview={preview}>
      <Fields fields={fields} values={values} errors={errors} disabled={busy} onChange={(key,value)=>setValues(current=>({...current,[key]:value}))} />
      <Text style={ui.body}>Uses your saved style text and preference words. Rules pair tops with bottoms or dresses with shoes; scores describe these rules, not fit or sizing.</Text>
      <Button label="Find outfits" onPress={generate} loading={busy} />
      {Boolean(message) && <Notice title="Recommendation status" text={message} />}
      {looks?.length===0 && <Notice title="No outfits found" text="Add a top and bottoms, or a dress and shoes. You can also include the shared catalog." />}
      {looks && <RecommendationLooks items={looks} preview={preview} onSave={save} onCreateOutfit={saveOutfit} saved={saved} saving={saving} />}
      <Button label="Refresh recent recommendations" variant="secondary" disabled={busy || history.loading} onPress={history.retry} />
      <Text style={ui.heading}>Recent recommendations</Text>
      <ResourceState loading={history.loading} error={history.error || historyError} retry={history.retry} />
      {!history.loading && !history.error && !historyError && !recent.length && <Notice title="No recent recommendations" text="Generate a look to start your history. Unavailable pieces are omitted from history results." />}
      <RecommendationLooks items={recent} preview={preview} onSave={save} onCreateOutfit={saveOutfit} saved={saved} saving={saving} />
      <RouteLink to="/recommendations/saved" preview={preview}>View saved recommendations →</RouteLink>
      <RouteLink to="/outfits/new" preview={preview}>Build an outfit →</RouteLink>
      <RouteLink to="/outfits" preview={preview}>View saved outfits →</RouteLink>
      <RouteLink to="/wardrobe/add" preview={preview}>Add a wardrobe piece →</RouteLink>
    </Gate>
  </Screen>;
}
