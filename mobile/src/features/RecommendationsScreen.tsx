import { useDraft } from "../hooks/useDraft";
import { useCallback, useEffect, useRef, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
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
import type { Recommendation, RecommendationFeedback, Page } from "../types/domain";
import { feedbackLabels, feedbackReasons, validateFeedback, type FeedbackReason, type FeedbackSentiment } from "./recommendationFeedback";
const fields: Field[] = [
  { key:"occasion",label:"Occasion",required:true,options:["Everyday","Work","Evening","Weekend","Special occasion"] },
  { key:"preferences",label:"What are you in the mood for?",kind:"multiline",hint:"List colours, materials or brands you like. Preference words are matched literally; exclusions are not interpreted." },
  { key:"wardrobeOnly",label:"Pieces to include",required:true,options:["My wardrobe only","Wardrobe and catalog"] },
];
function FeedbackControls({recommendation,existing,onSubmit,onClear,busy}: {
  recommendation: string; existing?: RecommendationFeedback;
  onSubmit:(id:string,sentiment:FeedbackSentiment,reason:FeedbackReason,note:string)=>void;
  onClear:(id:string)=>void; busy:boolean;
}) {
  const [sentiment,setSentiment]=useState<FeedbackSentiment|"">(existing?.sentiment ?? "");
  const [reason,setReason]=useState<FeedbackReason|"">(existing?.reasonCode ?? "");
  const [note,setNote]=useState(existing?.note ?? "");
  const options=sentiment ? feedbackReasons(sentiment) : [];
  const valid=validateFeedback(sentiment,reason,note);
  return <View style={styles.feedback}>
    <Text style={ui.label}>Help refine your suggestions</Text>
    <View style={styles.feedbackRow}>
      {(["like","dislike"] as const).map(value=><Pressable key={value} accessibilityRole="radio"
        accessibilityState={{checked:sentiment===value,disabled:busy}} disabled={busy}
        onPress={()=>{setSentiment(value);if(reason&&!feedbackReasons(value).includes(reason))setReason("");}}
        style={[styles.feedbackChoice,sentiment===value&&styles.feedbackSelected]}>
        <Text style={[styles.feedbackText,sentiment===value&&styles.feedbackTextSelected]}>{value==="like"?"Helpful":"Not for me"}</Text>
      </Pressable>)}
    </View>
    {!!sentiment && <>
      <View style={styles.feedbackRow}>
        {options.map(value=><Pressable key={value} accessibilityRole="radio" accessibilityState={{checked:reason===value,disabled:busy}}
          disabled={busy} onPress={()=>setReason(value)} style={[styles.reasonChip,reason===value&&styles.reasonSelected]}>
          <Text style={[styles.reasonText,reason===value&&styles.feedbackTextSelected]}>{feedbackLabels[value]}</Text>
        </Pressable>)}
      </View>
      <TextInput accessibilityLabel="Optional feedback note" value={note} onChangeText={setNote} editable={!busy}
        maxLength={1000} placeholder="Add a note (optional)" placeholderTextColor={colors.muted}
        multiline style={styles.feedbackNote}/>
      <Button label={existing?"Update feedback":"Send feedback"} variant="secondary" disabled={!valid}
        loading={busy} onPress={()=>{if(valid)onSubmit(recommendation,sentiment as FeedbackSentiment,reason as FeedbackReason,note);}} />
      {existing && <Button label="Clear feedback" variant="secondary" disabled={busy} onPress={()=>onClear(recommendation)} />}
    </>}
  </View>;
}

export function RecommendationLooks({items,preview,onSave,onCreateOutfit,saved,saving,feedback,onFeedback,onClearFeedback,feedbackSaving}: {
  items:Recommendation[];preview:boolean;onSave?:(look:Recommendation)=>void;onCreateOutfit?:(look:Recommendation)=>void;saved?:Record<string,string|null>;saving?:string;
  feedback?:Record<string,RecommendationFeedback>;onFeedback?:(id:string,sentiment:FeedbackSentiment,reason:FeedbackReason,note:string)=>void;
  onClearFeedback?:(id:string)=>void;feedbackSaving?:string;
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
    {onFeedback && onClearFeedback && <FeedbackControls key={`${look.id}:${feedback?.[look.id]?.updatedAt ?? "none"}`}
      recommendation={look.id} existing={feedback?.[look.id]} onSubmit={onFeedback} onClear={onClearFeedback} busy={feedbackSaving===look.id} />}
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
  const [feedbackSaving,setFeedbackSaving]=useState("");
  const history=useResource<Page<Recommendation>>("/recommendations?limit=10",preview);
  const feedbackHistory=useResource<{items:RecommendationFeedback[]}>("/recommendations/feedback?limit=100",preview);
  const [feedbackOverrides,setFeedbackOverrides]=useState<Record<string,RecommendationFeedback|null>>({});
  const refreshHistory=history.retry;
  const refreshFeedback=feedbackHistory.retry;
  useFocusEffect(useCallback(()=>{refreshHistory();refreshFeedback();},[refreshHistory,refreshFeedback]));
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
  const feedbackRows=feedbackHistory.data?.items;
  const feedbackLoadError=feedbackHistory.data&&!Array.isArray(feedbackRows)?"Feedback status could not be read.":"";
  const feedbackById:Record<string,RecommendationFeedback>={};
  for(const row of feedbackRows??[])if(row&&typeof row.recommendationId==="string")feedbackById[row.recommendationId]=row;
  for(const [id,row] of Object.entries(feedbackOverrides)){if(row)feedbackById[id]=row;else delete feedbackById[id];}
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
    if(!session)return;
    await gate.current.run(async()=>{
      setSaving(look.id);
      try{const result=await request<{id:string}>("/outfits",{method:"POST",body:{recommendationId:look.id}});router.push(`/outfits/${encodeURIComponent(result.id)}`);}
      catch(e){setMessage(e instanceof Error ? e.message : "Unable to save outfit.");}
      finally{setSaving("");}
    });
  }
  async function submitFeedback(id:string,sentiment:FeedbackSentiment,reasonCode:FeedbackReason,note:string){
    if(preview){setMessage("Preview only. Feedback has not been saved.");return;}
    if(!session)return;
    await gate.current.run(async()=>{
      setFeedbackSaving(id);setMessage("");
      try{
        const value=await request<RecommendationFeedback>(`/recommendations/${encodeURIComponent(id)}/feedback`,{method:"PUT",body:{sentiment,reasonCode,note}});
        setFeedbackOverrides(current=>({...current,[id]:value}));setMessage("Thanks. Your feedback is saved.");refreshFeedback();
      }catch(error){setMessage(error instanceof Error?error.message:"Unable to save feedback.");}
      finally{setFeedbackSaving("");}
    });
  }
  async function clearFeedback(id:string){
    if(!session)return;
    await gate.current.run(async()=>{
      setFeedbackSaving(id);
      try{await request(`/recommendations/${encodeURIComponent(id)}/feedback`,{method:"DELETE"});setFeedbackOverrides(current=>({...current,[id]:null}));setMessage("Feedback cleared.");refreshFeedback();}
      catch(error){setMessage(error instanceof Error?error.message:"Unable to clear feedback.");}
      finally{setFeedbackSaving("");}
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
      {looks && <RecommendationLooks items={looks} preview={preview} onSave={save} onCreateOutfit={saveOutfit} saved={saved} saving={saving}
        feedback={feedbackById} onFeedback={!feedbackHistory.loading&&!feedbackHistory.error&&!feedbackLoadError&&Array.isArray(feedbackRows)?submitFeedback:undefined}
        onClearFeedback={!feedbackHistory.loading&&!feedbackHistory.error&&!feedbackLoadError&&Array.isArray(feedbackRows)?clearFeedback:undefined} feedbackSaving={feedbackSaving} />}
      <Button label="Refresh recent ideas" variant="secondary" disabled={busy || history.loading} onPress={history.retry} />
      <ResourceState loading={feedbackHistory.loading} error={feedbackHistory.error||feedbackLoadError} retry={refreshFeedback} />
      <Text style={ui.heading}>Recent ideas</Text>
      <ResourceState loading={history.loading} error={history.error || historyError} retry={history.retry} />
      {!history.loading && !history.error && !historyError && !recent.length && <Notice title="No recent ideas" text="Choose an occasion and find outfits to start your history." />}
      <RecommendationLooks items={recent.filter(item => !looks?.some(look => look.id === item.id))} preview={preview} onSave={save} onCreateOutfit={saveOutfit} saved={saved} saving={saving}
        feedback={feedbackById} onFeedback={!feedbackHistory.loading&&!feedbackHistory.error&&!feedbackLoadError&&Array.isArray(feedbackRows)?submitFeedback:undefined}
        onClearFeedback={!feedbackHistory.loading&&!feedbackHistory.error&&!feedbackLoadError&&Array.isArray(feedbackRows)?clearFeedback:undefined} feedbackSaving={feedbackSaving} />
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
  feedback:{borderTopWidth:1,borderColor:colors.border,paddingTop:12,gap:10},
  feedbackRow:{flexDirection:"row",flexWrap:"wrap",gap:8},
  feedbackChoice:{borderWidth:1,borderColor:colors.border,borderRadius:6,paddingHorizontal:12,paddingVertical:9},
  feedbackSelected:{backgroundColor:colors.ink,borderColor:colors.ink},
  feedbackText:{fontSize:13,color:colors.ink},
  feedbackTextSelected:{color:colors.surface,fontWeight:"600"},
  reasonChip:{borderWidth:1,borderColor:colors.border,borderRadius:999,paddingHorizontal:10,paddingVertical:7},
  reasonSelected:{backgroundColor:colors.ink,borderColor:colors.ink},
  reasonText:{fontSize:12,color:colors.ink},
  feedbackNote:{minHeight:72,borderWidth:1,borderColor:colors.inputBorder,borderRadius:8,padding:10,color:colors.ink,textAlignVertical:"top"},
});
