import type { PropsWithChildren } from "react";
import { Link } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FramedImage } from "../components/FramedImage";
import { AtelierHeader } from "./AtelierHeader";
import { useAppearance, type Palette } from "../theme/Appearance";

type Props = PropsWithChildren<{title:string;subtitle?:string;accountMode?:"login"|"signup"}>;
const tabs = [{mode:"login",href:"/login",label:"Sign in"},{mode:"signup",href:"/signup",label:"Create account"}] as const;

export function AtelierAccount({title,subtitle,accountMode="login",children}:Props) {
  const {palette,mode}=useAppearance();
  const styles=makeStyles(palette);
  const signup=accountMode==="signup";
  return <SafeAreaView style={styles.screen}>
    <StatusBar style={mode === "light" ? "dark" : "light"} />
    <AtelierHeader showSignIn={false} />
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.tabs} accessibilityLabel="Account navigation">
          {tabs.map(tab=> <Link key={tab.mode} href={tab.href} replace
            accessibilityState={{selected:tab.mode===accountMode}}
            style={[styles.tab,tab.mode===accountMode && styles.activeTab]}>{tab.label}</Link>)}
        </View>
        <View style={styles.intro}>
          <Text style={styles.kicker}>{signup ? "THE FIRST STEP" : "MEMBER ACCESS"}</Text>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          {!!subtitle && <Text style={styles.body}>{subtitle}</Text>}
        </View>
        {signup && <View style={styles.steps}>
          <View style={styles.step}><Text style={styles.stepNumber}>01</Text><Text style={styles.stepLabel}>Verify email</Text></View>
          <View style={styles.stepDivider}/>
          <View style={styles.step}><Text style={styles.stepNumber}>02</Text><Text style={styles.stepLabel}>Choose password</Text></View>
        </View>}
        {children}
        <View style={styles.editorial}>
          <View style={styles.portrait}><FramedImage edgeToEdge ratio={2/3}
            source={signup ? require("../../assets/editorial/campaign-daylight.jpg") : require("../../assets/editorial/campaign-evening.jpg")}
            label={signup ? "A model in relaxed tailoring" : "Two models in evening tailoring"}/></View>
          <View style={styles.caption}>
            <Text style={styles.kicker}>THE PERSONAL EDIT</Text>
            <Text style={styles.captionTitle}>{signup ? "Make it yours." : "Wear what you love."}</Text>
            <Link href="/" style={styles.home}>Back to home <Text accessible={false}>↗</Text></Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const makeStyles = (palette:Palette) => StyleSheet.create({
  flex:{flex:1},screen:{flex:1,backgroundColor:palette.background},
  content:{paddingHorizontal:20,paddingTop:12,paddingBottom:28,gap:18,width:"100%",maxWidth:440,alignSelf:"center"},
  tabs:{flexDirection:"row",borderBottomWidth:1,borderColor:palette.border},
  tab:{flex:1,textAlign:"center",minHeight:46,paddingHorizontal:4,paddingVertical:13,color:palette.muted,fontSize:13,fontWeight:"600",borderBottomWidth:2,borderColor:"transparent"},
  activeTab:{color:palette.ink,borderColor:palette.accent},
  intro:{gap:8},
  kicker:{fontSize:10,fontWeight:"700",letterSpacing:1.5,color:palette.muted},
  title:{fontFamily:"serif",fontSize:39,lineHeight:42,letterSpacing:-0.9,color:palette.ink},
  body:{color:palette.muted,fontSize:14,lineHeight:21},
  steps:{minHeight:48,flexDirection:"row",alignItems:"center",borderWidth:1,borderColor:palette.border},
  step:{flex:1,flexDirection:"row",flexWrap:"wrap",paddingHorizontal:10,paddingVertical:10,alignItems:"center",gap:5},
  stepNumber:{color:palette.muted,fontSize:10,fontWeight:"700"},
  stepLabel:{color:palette.ink,fontSize:12,fontWeight:"600"},
  stepDivider:{width:1,alignSelf:"stretch",backgroundColor:palette.border},
  editorial:{flexDirection:"row",alignItems:"center",borderTopWidth:1,borderColor:palette.border,paddingTop:14,gap:14},
  portrait:{width:66},
  caption:{flex:1,gap:4},
  captionTitle:{fontFamily:"serif",fontSize:22,lineHeight:25,color:palette.ink},
  home:{color:palette.muted,fontSize:12,paddingVertical:11,minHeight:44,textDecorationLine:"underline"},
});
