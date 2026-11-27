import {useState} from "react";
import {Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import {RouteLink,ui} from "../components/Screen";
import {WardrobeImage} from "../components/WardrobeImage";
import {colors} from "../theme/tokens";
import {Button} from "../components/Button";
import {itemRoute} from "./outfitItems";
import {savedStatus} from "./savedRecommendationActions";
import type {Recommendation,RecommendationFeedback} from "../types/domain";
import {feedbackLabels,feedbackReasons,validateFeedback,type FeedbackReason,type FeedbackSentiment} from "./recommendationFeedback";
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
const styles = StyleSheet.create({
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
