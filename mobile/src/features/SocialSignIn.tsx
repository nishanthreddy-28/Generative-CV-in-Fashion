import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import {useAppearance, type Palette} from "../theme/Appearance";
import { providerAvailability, type ProviderAvailability } from "../services/auth/providerAvailability";
import type { SocialProvider } from "../services/auth/contracts";

const rollout = {
  google:process.env.EXPO_PUBLIC_GOOGLE_AUTH_ENABLED === "true",
  apple:process.env.EXPO_PUBLIC_APPLE_AUTH_ENABLED === "true",
};
export function SocialSignIn({busy,onPress}:{busy:boolean;onPress:(provider:SocialProvider)=>void}) {
  const {palette}=useAppearance();
  const styles=makeStyles(palette);
  const [available,setAvailable]=useState<ProviderAvailability>({google:false,apple:false});
  useEffect(()=>{
    if (process.env.EXPO_PUBLIC_REVIEW_ONLY === "true" || (!rollout.google && !rollout.apple)) return;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8000);
    const origin=process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
    const key=process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
    if(!origin || !key) {clearTimeout(timer);return;}
    void fetch(origin.replace(/\/$/,"")+"/auth/v1/settings",{
      headers:{apikey:key},signal:controller.signal,redirect:"error",credentials:"omit",
    }).then(async response=>{
      if(!response.ok)throw new Error("Provider unavailable");
      const value=await response.json();
      if(!controller.signal.aborted)setAvailable(providerAvailability(value,rollout));
    }).catch(()=>undefined).finally(()=>clearTimeout(timer));
    return()=>{controller.abort();clearTimeout(timer);};
  },[]);
  if(!available.google && !available.apple)return null;
  return <View style={styles.container}>
    {(["google","apple"] as const).filter(provider=>available[provider]).map(provider=>
      <Pressable key={provider} accessibilityRole="button" accessibilityState={{disabled:busy,busy}}
        disabled={busy} onPress={()=>onPress(provider)} style={({pressed})=>[styles.button,pressed && {opacity:0.7}]}>
        {busy ? <ActivityIndicator color={palette.ink}/> : <Text accessible={false} style={styles.icon}>{provider==="google" ? "G" : ""}</Text>}
        <Text style={styles.label}>Continue with {provider==="google" ? "Google" : "Apple"}</Text>
      </Pressable>)}
    <View style={styles.divider}><View style={styles.line}/><Text style={styles.caption}>OR CONTINUE WITH EMAIL</Text><View style={styles.line}/></View>
  </View>;
}
const makeStyles = (atelier:Palette) => StyleSheet.create({
  container:{gap:10,marginTop:12},button:{minHeight:48,borderWidth:1,borderColor:atelier.border,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:12,padding:12},
  label:{color:atelier.ink,fontSize:14,fontWeight:"600"},icon:{color:atelier.ink,fontWeight:"700",fontSize:19},
  divider:{flexDirection:"row",alignItems:"center",gap:10,paddingVertical:10},
  line:{flex:1,height:1,backgroundColor:atelier.border},caption:{color:atelier.muted,fontSize:9,letterSpacing:1},
});
