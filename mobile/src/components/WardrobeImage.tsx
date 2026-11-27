import {useCachedWardrobeImage} from "../hooks/useCachedWardrobeImage";
import {useFocusEffect} from "expo-router";
import {useCallback,useEffect,useState} from "react";
import {ActivityIndicator,Image,Pressable,Text,View,StyleSheet} from "react-native";
import {useResource} from "../hooks/useResource";
import {colors} from "../theme/tokens";
// Fetch authenticated bytes; never substitute public URLs for private images.
export function WardrobeImage({id,label,preview=false,source="wardrobe",photoId,size="full"}:{id:string;label:string;preview?:boolean;source?:"wardrobe"|"catalog"|"admin/catalog";photoId?:string;size?:"full"|"thumbnail"}){
 const path=source==="wardrobe"&&!photoId?`/ml/garments/${encodeURIComponent(id)}/closet-image${size==="thumbnail"?"?size=thumbnail":""}`:`/${source}/${encodeURIComponent(id)}/${photoId ? `photos/${encodeURIComponent(photoId)}` : "image"}`;
 const cached=source==="wardrobe"&&!photoId;
 const wardrobeImage=useCachedWardrobeImage(id,path,cached&&!preview);
 const result=useResource<Blob>(path,preview||cached,source==="admin/catalog","image");
 const retryImage=result.retry;
 useFocusEffect(useCallback(()=>{if(!cached)retryImage();},[cached,retryImage]));
 const [image,setImage]=useState<{blob:Blob;uri:string}|null>(null);const [failed,setFailed]=useState<Blob|null>(null);
 useEffect(()=>{
  if(!result.data)return;const blob=result.data;const reader=new FileReader();
  reader.onload=()=>{if(typeof reader.result==='string')setImage({blob,uri:reader.result});else setFailed(blob);};
  reader.onerror=()=>setFailed(blob);reader.readAsDataURL(blob);
  return ()=>{reader.onload=null;reader.onerror=null;if(reader.readyState===FileReader.LOADING)reader.abort();};
 },[result.data]);
 const [frameWidth,setFrameWidth]=useState(0);
 const ready=!!result.data && image?.blob===result.data && failed!==result.data;
 const [failedUri,setFailedUri]=useState<string>();
 const uri=cached?(failedUri===wardrobeImage.uri?undefined:wardrobeImage.uri):ready?image!.uri:undefined;
 const legacyError=!!result.error || (!!result.data && failed===result.data);
 const error=cached?wardrobeImage.error||!!failedUri&&failedUri===wardrobeImage.uri:legacyError;
 const retry=cached?wardrobeImage.retry:result.retry;
 return <View onLayout={event=>setFrameWidth(event.nativeEvent.layout.width)} style={[styles.frame,frameWidth>0&&{aspectRatio:undefined,height:Math.min(frameWidth/0.8,420)}]}>
  {uri ? <Image source={{uri}} resizeMode="contain" accessibilityLabel={label} style={styles.image} onError={()=>cached?setFailedUri(uri):setFailed(result.data)}/> :
   <View style={styles.placeholder}>
    {error ? <><Text style={styles.caption}>Photo unavailable</Text><Pressable accessibilityRole="button" accessibilityLabel={`Retry photo for ${label}`} onPress={()=>{setFailedUri(undefined);retry();}} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></> : <><ActivityIndicator accessibilityLabel={`Loading photo for ${label}`} color={colors.muted}/><Text style={styles.caption}>Loading photo</Text></>}
   </View>}
 </View>;
}
const styles=StyleSheet.create({frame:{width:'100%',aspectRatio:0.8,backgroundColor:colors.editorial,overflow:'hidden',borderRadius:4},image:{position:"absolute",top:0,left:0,width:"100%",height:"100%"},placeholder:{flex:1,alignItems:'center',justifyContent:'center',padding:12,gap:12},caption:{fontSize:12,color:colors.muted,textAlign:'center'},retry:{minHeight:44,padding:12},retryText:{color:colors.ink,textDecorationLine:'underline',fontSize:12}});
