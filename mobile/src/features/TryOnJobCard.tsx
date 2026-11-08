import {useEffect,useState} from "react";
import {Image,Text,View} from "react-native";
import {Button} from "../components/Button";
import {Notice,ResourceState,ui} from "../components/Screen";
import {useResource} from "../hooks/useResource";
import type {TryOnJob} from "../types/domain";
function InputBytes({job,preview}:{job:TryOnJob;preview:boolean}) {
  const result=useResource<Blob>(job.inputUrl,preview,false,"image");
  const [photo,setPhoto]=useState<{blob:Blob;uri:string}|null>(null);const [failed,setFailed]=useState(false);
  useEffect(()=>{
    if(!result.data)return;const blob=result.data;const reader=new FileReader();
    reader.onload=()=>{if(typeof reader.result==='string')setPhoto({blob,uri:reader.result});else setFailed(true);};
    reader.onerror=()=>setFailed(true);reader.readAsDataURL(blob);
    return ()=>{reader.onload=null;reader.onerror=null;if(reader.readyState===FileReader.LOADING)reader.abort();};
  },[result.data]);
  return <><ResourceState {...result}/>{photo?.blob===result.data && <Image source={{uri:photo.uri}} style={ui.image} accessibilityLabel="Private submitted try-on photo"/>}
    {failed && <Text style={ui.error}>Input photo could not be displayed.</Text>}</>;
}
export function TryOnJobCard({job,preview,busy,onRefresh,onCancel}:{job:TryOnJob;preview:boolean;busy:boolean;onRefresh:()=>void;onCancel:()=>void}) {
  const [show,setShow]=useState(false);
  return <View style={ui.card}>
    <Notice title={job.failureCode==='CANCELLED' ? 'Job cancelled' : `Try-on ${job.status}`} text={job.error ?? job.workerMessage}/>
    <Text style={ui.body}>Submitted {new Date(job.createdAt).toLocaleString()}</Text>
    <Text style={ui.body}>No inference worker is configured. No generated result image is available.</Text>
    <Button label="Refresh job status" variant="secondary" onPress={onRefresh} disabled={busy}/>
    {job.canCancel && <Button label="Cancel queued job" variant="secondary" onPress={onCancel} disabled={busy}/>}
    {job.inputAvailable && <Button label={show ? "Hide input photo" : "View private input photo"} variant="secondary" onPress={()=>setShow(v=>!v)} disabled={busy}/>}
    {job.inputAvailable && show && <InputBytes job={job} preview={preview}/>}
  </View>;
}
