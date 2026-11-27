import { useState } from "react";
import { Image, Text, View } from "react-native";
import { Button } from "../components/Button";
import { Notice, ui } from "../components/Screen";
import { useSession } from "./session";
type Analysis={category:string;slot:"top"|"bottom"|"outer"|"full"|"shoes";
  colors:{name:string}[];attributes:{pattern:string;formality:string;season:string;fit:string};
  confidence:number;route:"auto"|"review"|"ask";warnings:string[];cutoutUsed:boolean;
  cutoutMime:"image/webp";cutoutBase64:string};
const categories={top:"Tops",bottom:"Bottoms",outer:"Outerwear",full:"Dresses",shoes:"Shoes"};
export function GarmentAnalysisPanel({id,disabled=false,onApply}:{id:string;disabled?:boolean;onApply:(values:Record<string,string>)=>void}){
  const {request}=useSession();
  const [result,setResult]=useState<Analysis|null>(null);
  const [busy,setBusy]=useState(false);
  const [prepared,setPrepared]=useState<{receipt:string;cutoutBase64:string;warnings:string[]}|null>(null);
  const [saved,setSaved]=useState(false);
  async function prepare(){
    setBusy(true);setError("");setSaved(false);setPrepared(null);
    try{
      const caps=await request<{preparedStorageAvailable:boolean}>("/ml/capabilities");
      if(!caps.preparedStorageAvailable)throw new Error("Clean wardrobe photos need the pending storage setup. Your original is preserved.");
      setPrepared(await request(`/ml/garments/${encodeURIComponent(id)}/prepare`,{method:"POST",timeoutMs:180000}));
    }catch(reason){setError(reason instanceof Error?reason.message:"Could not prepare this photo.");}
    finally{setBusy(false);}
  }
  async function saveClean(){
    if(!prepared)return;
    setBusy(true);setError("");
    try{
      await request(`/ml/garments/${encodeURIComponent(id)}/prepared`,{method:"POST",body:{receipt:prepared.receipt,confirmed:true}});
      setSaved(true);setPrepared(null);
    }catch(reason){setError(reason instanceof Error?reason.message:"The clean photo was not saved.");}
    finally{setBusy(false);}
  }
  const [error,setError]=useState("");
  async function analyse(){
    setBusy(true);setError("");setResult(null);
    try{
      const response=await request<{garmentId:string;analysis:Analysis}>(`/ml/garments/wardrobe/${encodeURIComponent(id)}/analysis`,{method:"POST",timeoutMs:180000});
      if(response.garmentId!==id||!response.analysis||!(response.analysis.slot in categories))throw new Error("Unexpected garment analysis.");
      setResult(response.analysis);
    }catch(reason){setError(reason instanceof Error?reason.message:"Garment analysis is unavailable.");}
    finally{setBusy(false);}
  }
  return <View style={ui.card}>
    <Text style={ui.heading}>Photo suggestions</Text>
    <Text style={ui.body}>Analyse the saved photo for a background cutout, category, colours and approximate attributes. Review suggestions before using them. Save a replacement photo first.</Text>
    <Button label="Analyse saved garment photo" loading={busy} disabled={busy||disabled} variant="secondary" onPress={()=>void analyse()}/>
    <Button label="Prepare clean wardrobe photo" loading={busy} disabled={busy||disabled} variant="secondary" onPress={()=>void prepare()}/>
    {prepared&&!disabled&&<>
      <Image accessibilityLabel="Review clean wardrobe photo" source={{uri:`data:image/webp;base64,${prepared.cutoutBase64}`}} style={{width:"100%",height:240}} resizeMode="contain"/>
      <Text style={ui.body}>Check sleeves, edges and details against the original above. Save this preview to show it in your wardrobe; your original stays available.</Text>
      {prepared.warnings.map((warning,index)=><Text key={index} style={ui.body}>{warning}</Text>)}
      <Button label="Use clean photo in wardrobe" disabled={busy} onPress={()=>void saveClean()}/>
      <Button label="Keep original photo" disabled={busy} variant="secondary" onPress={()=>setPrepared(null)}/>
    </>}
    {saved&&<Notice title="Clean photo saved" text="Your wardrobe will show the clean photo when you return to the collection. Your original is preserved." tone="success"/>}
    {!!error&&<Notice title="Analysis unavailable" text={error} tone="error"/>}
    {result&&!disabled&&<>
      {result.cutoutUsed&&<Image accessibilityLabel="Garment with background removed" source={{uri:`data:image/webp;base64,${result.cutoutBase64}`}} style={{width:"100%",height:240}} resizeMode="contain"/>}
      <Text style={ui.body}>Suggested category: {result.category}</Text>
      <Text style={ui.body}>Colours: {result.colors.map(color=>color.name).join(", ")}</Text>
      <Text style={ui.body}>Pattern: {result.attributes.pattern}; style: {result.attributes.formality}; season: {result.attributes.season}; apparent fit: {result.attributes.fit}</Text>
      <Text style={ui.body}>Model confidence: {Math.round(result.confidence*100)}%. This is not measured classification accuracy.</Text>
      {result.warnings.map((warning,index)=><Text key={index} style={ui.body}>{warning}</Text>)}
      <Button label="Use suggested category and colours" variant="secondary" disabled={busy}
        onPress={()=>onApply({category:categories[result.slot],color:result.colors.map(color=>color.name).join(", ")})}/>
      <Text style={ui.body}>Suggestions are applied to your draft. Save the garment to confirm those changes.</Text>
    </>}
  </View>;
}
