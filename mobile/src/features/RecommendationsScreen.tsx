import { useDraft } from "../hooks/useDraft";
import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Screen, Gate, Notice, RouteLink, ResourceState, usePreview, ui } from "../components/Screen";
import {WardrobeImage} from "../components/WardrobeImage";
import { colors } from "../theme/tokens";
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
  return <>{items.map(look=><View key={look.id} style={styles.look}>
    {!!look.occasion && <Text style={styles.occasion}>{look.occasion}</Text>}
    <Text style={styles.lookTitle}>{look.name}</Text>
    <View style={styles.pieces}>
    {look.items.map(piece=><View key={`${piece.source}:${piece.garmentId}`} style={styles.piece}>
      <WardrobeImage id={piece.garmentId} label={piece.name} source={piece.source} preview={preview}/>
      <RouteLink to={itemRoute(piece)} preview={preview}>{piece.name} ›</RouteLink>
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
      setMessage(items.length ? "New outfit ideas are ready." : "No compatible pairs were found among the selected pieces.");
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
  return <Screen title="Outfit suggestions">
    <Gate preview={preview}>
      <View style={styles.filters}>
        <Fields fields={fields} values={values} errors={errors} disabled={busy} onChange={(key,value)=>setValues(current=>({...current,[key]:value}))} />
        <Button label="Find outfits" onPress={generate} loading={busy} />
      </View>
      {Boolean(message) && <Notice title="Style ideas" text={message} />}
      {looks?.length===0 && <Notice title="No outfits found" text="Add a top and bottoms, or a dress and shoes. You can also include the shared catalog." />}
      {looks && <RecommendationLooks items={looks} preview={preview} onSave={save} onCreateOutfit={saveOutfit} saved={saved} saving={saving} />}
      <Button label="Refresh recent ideas" variant="secondary" disabled={busy || history.loading} onPress={history.retry} />
      <Text style={ui.heading}>Recent ideas</Text>
      <ResourceState loading={history.loading} error={history.error || historyError} retry={history.retry} />
      {!history.loading && !history.error && !historyError && !recent.length && <Notice title="No recent ideas" text="Choose an occasion and find outfits to start your history." />}
      <RecommendationLooks items={recent.filter(item => !looks?.some(look => look.id === item.id))} preview={preview} onSave={save} onCreateOutfit={saveOutfit} saved={saved} saving={saving} />
      <RouteLink to="/recommendations/saved" preview={preview}>View saved ideas →</RouteLink>
    </Gate>
  </Screen>;
}

const styles = StyleSheet.create({
  filters:{borderRadius:20,padding:16,gap:12,backgroundColor:colors.raised},
  look:{borderWidth:1,borderColor:colors.border,borderRadius:20,padding:14,gap:10,backgroundColor:colors.surface},
  lookTitle:{color:colors.ink,fontSize:21,fontWeight:"800"},
  occasion:{alignSelf:"flex-start",backgroundColor:"#FFDBC0",borderRadius:14,overflow:"hidden",paddingVertical:4,paddingHorizontal:9,color:colors.ink,fontSize:12},
  pieces:{flexDirection:"row",flexWrap:"wrap",gap:8},
  piece:{flexBasis:"47%",flexGrow:1,maxWidth:"50%",backgroundColor:colors.raised,borderRadius:12,overflow:"hidden",padding:6},
});
