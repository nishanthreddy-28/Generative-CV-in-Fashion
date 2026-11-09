import type { PropsWithChildren } from "react";
import { Link } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AtelierHeader } from "./AtelierHeader";
import {useAppearance, type Palette} from "../theme/Appearance";

export function AtelierAccount({title,subtitle,children}:PropsWithChildren<{title:string;subtitle?:string}>) {
  const {palette,mode}=useAppearance();
  const styles=makeStyles(palette);
  return <SafeAreaView style={styles.screen}>
    <StatusBar style={mode === "light" ? "dark" : "light"} />
    <AtelierHeader account={title === "Sign in" ? "signup" : "login"} />
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={styles.kicker}>YOUR PERSONAL WARDROBE</Text>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.body}>{subtitle}</Text>}
        {children}
        <Link href="/" style={styles.home}>Back to Drape &amp; Drop</Link>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const makeStyles = (atelier:Palette) => StyleSheet.create({
  flex:{flex:1},screen:{flex:1,backgroundColor:atelier.background},
  content:{padding:24,paddingBottom:32,gap:12,width:"100%",maxWidth:440,alignSelf:"center"},
  kicker:{fontSize:10,letterSpacing:2,color:atelier.accent,marginTop:8},
  title:{fontFamily:"serif",fontSize:34,lineHeight:39,color:atelier.ink},
  body:{color:atelier.muted,fontSize:14,lineHeight:22},
  home:{color:atelier.muted,fontSize:12,paddingVertical:14,minHeight:44},
});
