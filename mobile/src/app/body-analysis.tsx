import {PrivateBodyPhoto} from "../components/PrivateBodyPhoto";
import {ProcessingCard} from "../components/ProcessingCard";
import { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Link, useFocusEffect } from "expo-router";
import { useSession } from "../features/session";
import { Button } from "../components/Button";
import { Fields } from "../components/Fields";
import { Screen, Notice, ui } from "../components/Screen";
import type { Field } from "../features/validation";

const observations: Field[] = [
  {key:"shoulder_landmark_span_cm",label:"Shoulder landmark span (cm)",kind:"number",min:5.01,max:109.99},
  {key:"clothed_waist_front_width_cm",label:"Clothed waist front width (cm)",kind:"number",min:5.01,max:149.99},
  {key:"torso_landmark_length_cm",label:"Torso landmark length (cm)",kind:"number",min:5.01,max:119.99},
  {key:"shoulder_hip_ratio",label:"Shoulder / hip landmark ratio",kind:"number",min:.301,max:3.999},
];
type Estimates = Record<string,number>;
type Analysis = Estimates & {reference_height_cm:number;confirmed:boolean;original_estimates:Estimates};
type Result = {imageId:string;analysis:Analysis|null;receipt?:string;confirmedAt?:string};
type PhotoStatus = {draft:{id:string;state:string}|null;reviewed:{id:string;state:string}|null};
export default function BodyAnalysisScreen() {
  const { request } = useSession();
  const operation=useRef(false);
  const [height,setHeight] = useState("");
  const [storageReady,setStorageReady] = useState(false);
  const [photoId,setPhotoId] = useState<string|null>(null);
  const [values,setValues] = useState<Record<string,string>>({});
  const [result,setResult] = useState<Result|null>(null);
  const [busy,setBusy] = useState(false);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");

  const load = useCallback(async () => {
    if(operation.current)return;
    setError("");setLoading(true);
    try {
      const caps=await request<{poseStorageAvailable:boolean}>("/ml/capabilities");
      setStorageReady(caps.poseStorageAvailable);
      const [status,profile] = await Promise.all([request<PhotoStatus>("/onboarding"),request<{height?:number|null;units?:string}>("/profile/body")]);
      const knownHeight=profile.height;
      if(typeof knownHeight==="number"&&Number.isFinite(knownHeight))setHeight(current=>current||String(Math.round(knownHeight*(profile.units==="in"?2.54:1)*10)/10));
      const photo = status.draft?.state === "ready" ? status.draft : status.reviewed?.state === "reviewed" ? status.reviewed : null;
      setPhotoId(photo?.id ?? null);setResult(null);setValues({});
      if (photo && caps.poseStorageAvailable) {
        const saved = await request<Result>(`/ml/body-analysis/${encodeURIComponent(photo.id)}`);
        if (saved.analysis) {
          setResult(saved);setHeight(String(saved.analysis.reference_height_cm));
          setValues(Object.fromEntries(observations.map(field=>[field.key,String(saved.analysis![field.key])])));
        }
      }
    } catch(reason) {setError(reason instanceof Error ? reason.message : "Saved analysis could not be loaded.");}
    finally {setLoading(false);}
  },[request]);
  useFocusEffect(useCallback(()=>{void load();},[load]));

  async function analyse() {
    if(operation.current)return;
    const calibration=Number(height);
    if(!photoId){setError("Save a private body photo in profile onboarding first.");return;}
    if(!Number.isFinite(calibration)||calibration<80||calibration>250){
      setError("Enter your known height between 80 and 250 cm.");return;
    }
    operation.current=true;
    setBusy(true);setError("");setMessage("");setResult(null);
    try {
      const response=await request<Result>("/ml/body-analysis",{method:"POST",timeoutMs:180000,body:{imageId:photoId,referenceHeightCm:calibration}});
      if(!response.analysis||!response.receipt||response.imageId!==photoId)throw new Error("The service returned an invalid analysis.");
      setResult(response);
      setValues(Object.fromEntries(observations.map(field=>[field.key,String(response.analysis![field.key])])));
    }catch(reason){setError(reason instanceof Error?reason.message:"Analysis failed.");}
    finally{setBusy(false);operation.current=false;}
  }
  async function confirm(){
    if(!result?.analysis||!result.receipt||result.analysis.confirmed||operation.current)return;
    const reviewed:Estimates={};
    for(const field of observations){
      const value=Number(values[field.key]);
      if(!values[field.key]?.trim()||!Number.isFinite(value)||value<(field.min??0)||value>(field.max??Infinity)){
        setError("Enter valid values for each photo observation.");return;
      }
      reviewed[field.key]=value;
    }
    operation.current=true;
    setBusy(true);setError("");setMessage("");
    try{
      const saved=await request<Result>("/ml/body-analysis/confirm",{method:"POST",
        body:{imageId:result.imageId,receipt:result.receipt,reviewed,confirmed:true}});
      if(!saved.analysis?.confirmed)throw new Error("The analysis was not confirmed. Reload and try again.");
      setResult(saved);setMessage("Your reviewed observations were saved. Manual body measurements are unchanged.");
    }catch(reason){setError(reason instanceof Error?reason.message:"Confirmation failed.");}
    finally{setBusy(false);operation.current=false;}
  }
  return <Screen title="Body photo analysis" subtitle="Optional, approximate front-view observations from your private body photo.">
    <Text style={ui.body}>Stand front-facing with your head and feet visible and arms down slightly away from your body. Enter your known height. Waist front width is not waist circumference or a clothing-size prediction.</Text>
    <Link href="/profile/onboarding" style={ui.body}>Choose or update your private body photo</Link>
    {!!photoId&&<PrivateBodyPhoto id={photoId}/>}
    <Button label="Reload saved analysis" variant="secondary" disabled={busy||loading} onPress={()=>void load()}/>
    <Fields fields={[{key:"height",label:"Known height (cm)",kind:"number",required:true,min:80,max:250}]}
      values={{height}} errors={{}} disabled={busy||loading} onChange={(_,value)=>{setHeight(value);setResult(null);setMessage("");}}/>
    <Button label={loading?"Loading saved photo…":"Analyse saved body photo"} loading={busy} disabled={busy||loading||!photoId} onPress={()=>void analyse()}/>
    {busy&&!result&&<ProcessingCard title="Checking your body photo…" detail="Finding visible pose landmarks and checking the full-body outline." note="You’ll review approximate observations before anything is saved."/>}
    {!loading&&!photoId&&<Notice title="Add a body photo" text="Save a private photo in profile onboarding, then return and reload."/>}
    {!storageReady&&!loading&&<Notice title="Analysis can be previewed" text="Saving reviewed observations is unavailable until service setup is complete. Manual measurements remain available."/>}
    {!!error&&<Notice title="Could not complete analysis" text={error} tone="error"/>}
    {result?.analysis&&<View style={ui.card}>
      <Text style={ui.heading}>{result.analysis.confirmed?"Confirmed observations":"Review your photo observations"}</Text>
      <Fields fields={observations} values={values} errors={{}} disabled={busy||result.analysis.confirmed}
        onChange={(key,value)=>setValues(current=>({...current,[key]:value}))}/>
      <Text style={ui.body}>Original estimates: {observations.map(field=>`${field.label}: ${result.analysis!.original_estimates[field.key]}`).join("; ")}</Text>
      {!result.analysis.confirmed&&<>
        <Button label="Reset edits to original estimates" variant="secondary" disabled={busy}
          onPress={()=>setValues(Object.fromEntries(observations.map(field=>[field.key,String(result.analysis!.original_estimates[field.key])])))} />
        <Button label="Confirm and save these observations" loading={busy} disabled={busy||!storageReady} onPress={()=>void confirm()}/>
      </>}
    </View>}
    {!!message&&<Notice title="Saved" text={message} tone="success"/>}
  </Screen>;
}
