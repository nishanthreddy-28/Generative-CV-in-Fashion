import { useDraft } from "../hooks/useDraft";
import { useState } from "react";
import { Text, View } from "react-native";
import { Screen, Gate, Notice, RouteLink, ResourceState, usePreview, ui } from "../components/Screen";
import { Button } from "../components/Button";
import { Fields } from "../components/Fields";
import { useResource } from "../hooks/useResource";
import { validate, type Field } from "./validation";
import { useSession } from "./session";
import { itemRoute } from "./outfitItems";
import { recommendationResults } from "./recommendationResults";
import type { Recommendation, Page } from "../types/domain";
const fields: Field[] = [
  { key:"occasion",label:"Occasion",required:true,options:["Everyday","Work","Evening","Weekend","Special occasion"] },
  { key:"preferences",label:"What are you in the mood for?",kind:"multiline",hint:"List colours, materials or brands you like. Preference words are matched literally; exclusions are not interpreted." },
  { key:"wardrobeOnly",label:"Pieces to include",required:true,options:["My wardrobe only","Wardrobe and catalog"] },
];
function Looks({items,preview}:{items:Recommendation[];preview:boolean}) {
  return <>{items.map(look=><View key={look.id} style={ui.card}>
    <Text style={ui.heading}>{look.name}</Text>
    <Text style={ui.body}>Rule score: {look.score}/100 · {look.occasion}</Text>
    {look.items.map(piece=><View key={`${piece.source}:${piece.garmentId}`}>
      <Text style={ui.body}>{piece.name} · {piece.category}{piece.color ? ` · ${piece.color}` : ""}</Text>
      <RouteLink to={itemRoute(piece)} preview={preview}>View {piece.source} piece →</RouteLink>
    </View>)}
    <Text style={ui.label}>Why these pieces</Text>
    {look.reasons.map(reason=><Text key={reason} style={ui.body}>• {reason}</Text>)}
  </View>)}</>;
}
export function RecommendationsScreen() {
  const preview=usePreview();const {session,request}=useSession();
  const [values,setValues]=useDraft<Record<string,string>>("recommendations:fields",{});
  const [errors,setErrors]=useState<Record<string,string>>({});
  const [generated,setGenerated]=useState<{owner:string;items:Recommendation[]}|null>(null);
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
  const history=useResource<Page<Recommendation>>("/recommendations?limit=10",preview);
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
  return <Screen title="Find your next look." subtitle="Explainable combinations from your actual pieces.">
    <Gate preview={preview}>
      <Fields fields={fields} values={values} errors={errors} disabled={busy} onChange={(key,value)=>setValues(current=>({...current,[key]:value}))} />
      <Text style={ui.body}>Uses your saved style text and preference words. Rules pair tops with bottoms or dresses with shoes; scores describe these rules, not fit or sizing.</Text>
      <Button label="Find outfits" onPress={generate} loading={busy} />
      {Boolean(message) && <Notice title="Recommendation status" text={message} />}
      {looks?.length===0 && <Notice title="No outfits found" text="Add a top and bottoms, or a dress and shoes. You can also include the shared catalog." />}
      {looks && <Looks items={looks} preview={preview} />}
      <Button label="Refresh recent recommendations" variant="secondary" disabled={busy || history.loading} onPress={history.retry} />
      <Text style={ui.heading}>Recent recommendations</Text>
      <ResourceState loading={history.loading} error={history.error || historyError} retry={history.retry} />
      {!history.loading && !history.error && !historyError && !recent.length && <Notice title="No recent recommendations" text="Generate a look to start your history. Unavailable pieces are omitted from history results." />}
      <Looks items={recent} preview={preview} />
      <RouteLink to="/outfits/new" preview={preview}>Build an outfit →</RouteLink>
      <RouteLink to="/outfits" preview={preview}>View saved outfits →</RouteLink>
      <RouteLink to="/wardrobe/add" preview={preview}>Add a wardrobe piece →</RouteLink>
    </Gate>
  </Screen>;
}
