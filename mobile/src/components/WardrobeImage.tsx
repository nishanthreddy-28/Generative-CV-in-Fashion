import {useEffect,useState} from "react";
import {ActivityIndicator,Image,Pressable,Text,View,StyleSheet} from "react-native";
import {useResource} from "../hooks/useResource";
import {colors} from "../theme/tokens";
// Fetch authenticated bytes; never substitute public URLs for private images.
export function WardrobeImage({id,label,preview=false,source="wardrobe"}:{id:string;label:string;preview?:boolean;source?:"wardrobe"|"catalog"|"admin/catalog"}){
 const result=useResource<Blob>(`/${source}/${encodeURIComponent(id)}/image`,preview,source==="admin/catalog","image");
 const [image,setImage]=useState<{blob:Blob;uri:string}|null>(null);const [failed,setFailed]=useState<Blob|null>(null);
 useEffect(()=>{
  if(!result.data)return;const blob=result.data;const reader=new FileReader();
  reader.onload=()=>{if(typeof reader.result==='string')setImage({blob,uri:reader.result});else setFailed(blob);};
  reader.onerror=()=>setFailed(blob);reader.readAsDataURL(blob);
  return ()=>{reader.onload=null;reader.onerror=null;if(reader.readyState===FileReader.LOADING)reader.abort();};
 },[result.data]);
 const ready=!!result.data && image?.blob===result.data && failed!==result.data;
 const error=!!result.error || (!!result.data && failed===result.data);
 return <View style={styles.frame}>
  {ready ? <Image source={{uri:image!.uri}} resizeMode="contain" accessibilityLabel={label} style={styles.image} onError={()=>setFailed(result.data)}/> :
   <View style={styles.placeholder}>
    {error ? <><Text style={styles.caption}>Photo unavailable</Text><Pressable accessibilityRole="button" accessibilityLabel={`Retry photo for ${label}`} onPress={result.retry} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></> : <><ActivityIndicator accessibilityLabel={`Loading photo for ${label}`} color={colors.muted}/><Text style={styles.caption}>Loading photo</Text></>}
   </View>}
 </View>;
}
const styles=StyleSheet.create({frame:{width:'100%',aspectRatio:0.8,backgroundColor:'#EFEEE9',overflow:'hidden',borderRadius:4},image:{width:'100%',height:'100%'},placeholder:{flex:1,alignItems:'center',justifyContent:'center',padding:12,gap:12},caption:{fontSize:12,color:colors.muted,textAlign:'center'},retry:{minHeight:44,padding:12},retryText:{color:colors.ink,textDecorationLine:'underline',fontSize:12}});
