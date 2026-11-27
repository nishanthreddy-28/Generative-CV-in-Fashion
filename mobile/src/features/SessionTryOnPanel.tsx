import {ProcessingCard} from "../components/ProcessingCard";
import {useEffect,useState} from "react";
import {Image,Pressable,Text,View} from "react-native";
import {Button} from "../components/Button";
import {Confirm,Notice,ui} from "../components/Screen";
import {Fields} from "../components/Fields";
import {PhotoField} from "../components/PhotoField";
import {useTryOnState} from "./TryOnState";
import {OutfitItemSelector} from "./OutfitItemSelector";
import {useResource} from "../hooks/useResource";
function PrivatePreview({url}:{url:string}){
  const image=useResource<Blob>(url,false,false,"image");
  const [value,setValue]=useState<{blob:Blob;uri:string}|null>(null);
  const [failedBlob,setFailedBlob]=useState<Blob|null>(null);
  const decodeError=!!image.data&&failedBlob===image.data;
  useEffect(()=>{
    if(!image.data)return;
    const blob=image.data,reader=new FileReader();
    reader.onload=()=>{if(typeof reader.result==="string")setValue({blob,uri:reader.result});};
    reader.onerror=()=>setFailedBlob(image.data);
    reader.readAsDataURL(blob);
    return()=>{reader.onload=null;reader.onerror=null;if(reader.readyState===FileReader.LOADING)reader.abort();};
  },[image.data]);
  return value?.blob===image.data&&value&&!decodeError?<Image source={{uri:value.uri}} accessibilityLabel="Private generated try-on preview" resizeMode="contain" style={{width:"100%",height:400}} onError={()=>setFailedBlob(image.data)}/>:
    <View style={{gap:8}}><Text style={ui.body}>{image.error||(decodeError?"This preview could not be displayed. Try loading it again.":"Loading private preview…")}</Text>
      {(!!image.error||decodeError)&&<Button label="Retry private preview" variant="secondary" onPress={()=>{setFailedBlob(null);setValue(null);image.retry();}}/>}</View>;
}
export function SessionTryOnPanel(){
  const {items,setItems,photo,setPhoto,consent,setConsent,provider,setProvider,busy,error,setError,result,setResult,deleteTarget,setDeleteTarget,loadingHistory,historyLoaded,history,reload,removePreview,generate,cancel}=useTryOnState();
  const capabilities=useResource<{sessionStorageAvailable:boolean}>("/ml/capabilities",false);
  return <View style={ui.card}>
    <Text style={ui.heading}>Create a session preview</Text>
    <Text style={ui.body}>Choose one top, bottom or dress. WeShopAI can use IDM-VTON as backup for a top; direct IDM-VTON supports upper-body garments. Shoes and layered outfit generation are not supported. This is a visual preview, not a fit guarantee.</Text>
    <OutfitItemSelector items={items} onChange={next=>{setItems(next);setConsent(false);}} preview={false} disabled={busy} single/>
    <PhotoField label="Person photo for this preview" subject="try-on person" camera value={photo} onChange={next=>{setPhoto(next);setConsent(false);}} disabled={busy}/>
    <Fields fields={[{key:"provider",label:"Try-on provider",options:["WeShopAI","IDM-VTON"]}]} values={{provider}} errors={{}} disabled={busy}
      onChange={(_,value)=>{setProvider(value);setConsent(false);}}/>
    <Pressable accessibilityRole="checkbox" accessibilityState={{checked:consent,disabled:busy}} disabled={busy} onPress={()=>setConsent(value=>!value)}>
      <Text style={ui.body}>{consent?"☑":"☐"} I consent to sending this person photo and selected garment to the hosted try-on provider, including an eligible IDM-VTON fallback.</Text>
    </Pressable>
    <Text style={ui.body}>Keep your session active until processing finishes. IDM-VTON is a noncommercial research demo and availability can vary.</Text>
    {!capabilities.loading&&!capabilities.data?.sessionStorageAvailable&&<Notice title="Preview setup pending" text="Saving generated previews is temporarily unavailable. No photo will be sent until this service is ready."/>}
    <Button label="Generate private preview" loading={busy} disabled={busy||!photo||items.length!==1||!consent||!capabilities.data?.sessionStorageAvailable} onPress={()=>void generate()}/>
    {busy&&!deleteTarget&&<ProcessingCard title="Creating your preview" detail="Preparing the reference and waiting for the try-on provider. Generation time can vary."/>}
    {busy&&!deleteTarget&&<Button label="Cancel request" variant="secondary" onPress={cancel}/>}
    {!!error&&<Notice title="Preview unavailable" text={error} tone="error"/>}
    {result&&<View style={ui.card}><Text style={ui.label}>Generated with {result.provider}</Text><PrivatePreview url={result.imageUrl}/>
      <Button label="Delete this preview" variant="danger" disabled={busy||loadingHistory} onPress={()=>setDeleteTarget(result)}/>
      {result.warnings.map((warning,index)=><Text key={index} style={ui.body}>{warning}</Text>)}</View>}
    <Button label={historyLoaded?"Refresh previous sessions":"Load previous sessions"} variant="secondary" loading={loadingHistory} disabled={busy||loadingHistory} onPress={()=>void reload()}/>
    {history.filter(item=>item.id!==result?.id).map(item=><View key={item.id} style={ui.card}>
      <Text style={ui.label}>Generated with {item.provider}</Text>
      {!!item.createdAt&&<Text style={ui.body}>{new Date(item.createdAt).toLocaleString()}</Text>}
      <Button label="Load preview" variant="secondary" disabled={busy} onPress={()=>{setResult(item);setError("");}}/>
      <Button label="Delete preview" variant="danger" disabled={busy||loadingHistory} onPress={()=>setDeleteTarget(item)}/></View>)}
    {historyLoaded&&!history.length&&!result&&<Text style={ui.body}>No previous previews to load.</Text>}
    <Confirm visible={!!deleteTarget} title="Delete this try-on preview?" text="This removes the saved preview and its generated image. Your wardrobe garment and person photo are unchanged." busy={busy} confirmLabel="Delete preview" onCancel={()=>{if(!busy)setDeleteTarget(null);}} onConfirm={()=>void removePreview()}/>
  </View>;
}
