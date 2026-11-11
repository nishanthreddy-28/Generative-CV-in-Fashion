import { useRef, type ComponentRef } from "react";
import { Link } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FramedImage } from "../components/FramedImage";
import { AtelierHeader } from "../features/AtelierHeader";
import { useAppearance, type Palette } from "../theme/Appearance";

const edits = [
  {number:"01",title:"Your wardrobe",detail:"Keep the clothes you own in one place.",
    source:require("../../assets/editorial/campaign-daylight.jpg"),label:"A model in a brown blazer and wide-leg trousers"},
  {number:"02",title:"Your outfits",detail:"Put looks together and save them for later.",
    source:require("../../assets/editorial/campaign-evening.jpg"),label:"Two models in burgundy and black evening tailoring"},
];

export default function Introduction() {
  const {palette,mode}=useAppearance();
  const styles=makeStyles(palette);
  const {width}=useWindowDimensions();
  const compact=width<360;
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const discovery = useRef(0);
  const discover = () => scroll.current?.scrollTo({y:discovery.current,animated:false});
  return <SafeAreaView style={styles.screen}>
    <StatusBar style={mode === "light" ? "dark" : "light"} />
    <AtelierHeader />
    <ScrollView ref={scroll}>
      <View style={styles.hero}>
        <View style={styles.edition}><View style={styles.rule}/><Text style={styles.kicker}>THE PERSONAL EDIT</Text></View>
        <Text accessibilityRole="header" style={[styles.title,compact && styles.compactTitle]}>Your wardrobe.{"\n"}Your way.</Text>
        <Text style={styles.body}>See what you own, plan what to wear, and keep the looks you love.</Text>
        <View style={styles.actions}>
          <Link href="/signup" style={[styles.cta,styles.primary]}>Get started <Text accessible={false}>↗</Text></Link>
          <Pressable accessibilityRole="button" onPress={discover} style={({pressed})=>[styles.cta,styles.secondary,pressed && styles.pressed]}>
            <Text style={styles.secondaryText}>Discover <Text accessible={false}>↓</Text></Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.campaign}>
        <FramedImage edgeToEdge source={require("../../assets/editorial/campaign-atelier.jpg")} ratio={0.8}
          label="A model wearing an espresso wool coat in a sunlit stone corridor" />
        <View style={styles.caption}><Text style={styles.kicker}>THE DAILY UNIFORM</Text><Text style={styles.kicker}>01 / 03</Text></View>
      </View>
      <View onLayout={event=>{discovery.current=event.nativeEvent.layout.y;}} style={styles.discovery}>
        <Text style={styles.kicker}>THE WARDROBE EDIT</Text>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Get dressed with what you own.</Text>
        <View style={styles.edits}>
          {edits.map(edit=><View key={edit.number} style={styles.edit}>
            <FramedImage edgeToEdge source={edit.source} ratio={2/3} label={edit.label}/>
            <Text style={styles.kicker}>{edit.number}</Text>
            <Text style={styles.editTitle}>{edit.title}</Text>
            <Text style={styles.smallBody}>{edit.detail}</Text>
          </View>)}
        </View>
        <View style={styles.discoveryNote}>
          <Text style={styles.editTitle}>Discover clothing</Text>
          <Text style={styles.smallBody}>Browse the catalog for pieces that work with your style.</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.sectionTitle}>Start with your first piece.</Text>
        <Link href="/signup" style={[styles.cta,styles.primary]}>Create your wardrobe</Link>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const makeStyles = (palette:Palette) => StyleSheet.create({
  screen:{flex:1,backgroundColor:palette.background},
  hero:{paddingHorizontal:20,paddingTop:24,paddingBottom:20,gap:12},
  edition:{flexDirection:"row",alignItems:"center",gap:9},
  rule:{width:22,height:1,backgroundColor:palette.accent},
  kicker:{color:palette.muted,fontSize:10,letterSpacing:1.6,fontWeight:"700"},
  title:{color:palette.ink,fontFamily:"serif",fontSize:48,lineHeight:49,letterSpacing:-1.5},
  compactTitle:{fontSize:39,lineHeight:42,letterSpacing:-1.1},
  body:{color:palette.muted,fontSize:15,lineHeight:23,maxWidth:330},
  actions:{flexDirection:"row",gap:8,marginTop:4},
  cta:{flex:1,minHeight:48,paddingVertical:13,paddingHorizontal:10,borderWidth:1,borderColor:palette.border,
    textAlign:"center",alignItems:"center",justifyContent:"center",fontSize:14},
  primary:{backgroundColor:palette.accent,borderColor:palette.accent,color:palette.onAccent,fontWeight:"700"},
  secondary:{backgroundColor:palette.surface},
  secondaryText:{color:palette.ink,fontWeight:"600",fontSize:14},
  pressed:{opacity:0.7},
  campaign:{marginHorizontal:12},
  caption:{paddingVertical:12,paddingHorizontal:8,borderBottomWidth:1,borderColor:palette.border,flexDirection:"row",justifyContent:"space-between"},
  discovery:{paddingHorizontal:20,paddingVertical:28,gap:14},
  sectionTitle:{color:palette.ink,fontFamily:"serif",fontSize:30,lineHeight:34,letterSpacing:-0.5},
  edits:{flexDirection:"row",gap:10,marginTop:2},
  edit:{flex:1,minWidth:0,gap:6},
  editTitle:{color:palette.ink,fontFamily:"serif",fontSize:20,lineHeight:24},
  smallBody:{color:palette.muted,fontSize:13,lineHeight:19},
  discoveryNote:{borderTopWidth:1,borderColor:palette.border,marginTop:6,paddingTop:14,gap:4},
  footer:{padding:20,paddingBottom:30,gap:14,borderTopWidth:1,borderColor:palette.border,backgroundColor:palette.surface},
});
