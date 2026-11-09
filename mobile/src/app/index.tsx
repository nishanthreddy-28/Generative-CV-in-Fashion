import { useRef, type ComponentRef } from "react";
import { Link } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FramedImage } from "../components/FramedImage";
import { AtelierHeader } from "../features/AtelierHeader";
import {useAppearance, type Palette} from "../theme/Appearance";

const features = [
  ["01", "Organise your wardrobe", "Keep your clothes and their details in one place."],
  ["02", "Put outfits together", "Pair the pieces you own and save the looks you love."],
  ["03", "Discover clothing", "Browse the catalog for pieces that fit your style."],
];

export default function Introduction() {
  const {palette:atelier,mode}=useAppearance();
  const styles=makeStyles(atelier);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const discovery = useRef(0);
  const discover = () => scroll.current?.scrollTo({y:discovery.current,animated:false});
  return <SafeAreaView style={styles.screen}>
    <StatusBar style={mode === "light" ? "dark" : "light"} />
    <ScrollView ref={scroll}>
      <AtelierHeader onDiscover={discover} />
      <View style={styles.hero}>
        <Text style={styles.kicker}>THE PERSONAL EDIT</Text>
        <Text accessibilityRole="header" style={styles.title}>Your wardrobe.{"\n"}Your way.</Text>
        <Text style={styles.body}>Organise what you own and put together looks you’ll wear again.</Text>
        <View style={styles.actions}>
          <Link href="/signup" style={[styles.cta,styles.primary]}>Get started</Link>
          <Pressable accessibilityRole="button" onPress={discover} style={styles.cta}>
            <Text style={styles.secondary}>Discover</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.imageFrame}>
        <FramedImage edgeToEdge source={require("../../assets/editorial/campaign-atelier.jpg")} ratio={0.8}
          label="Model wearing espresso tailoring in a sunlit stone corridor" />
        <View style={styles.imageCaption}><Text style={styles.kicker}>EVERYDAY, CONSIDERED.</Text><Text style={styles.body}>Make more of what’s already yours.</Text></View>
      </View>
      <View onLayout={event => {discovery.current=event.nativeEvent.layout.y;}} style={styles.discovery}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>The wardrobe edit</Text>
        {features.map(([number,title,detail]) => <View key={number} style={styles.row}>
          <Text style={styles.kicker}>{number}</Text>
          <View style={styles.rowCopy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.body}>{detail}</Text></View>
        </View>)}
      </View>
      <View style={styles.footer}><Text style={styles.sectionTitle}>A little less searching.
A little more wearing.</Text><Link href="/signup" style={[styles.cta,styles.primary]}>Create your wardrobe</Link></View>
    </ScrollView>
  </SafeAreaView>;
}

const makeStyles = (atelier:Palette) => StyleSheet.create({
  imageFrame:{marginHorizontal:20,overflow:"hidden"},
  imageCaption:{paddingVertical:14,gap:5,borderBottomWidth:1,borderColor:atelier.border},
  footer:{padding:24,gap:20,borderTopWidth:1,borderColor:atelier.border},
  screen:{flex:1,backgroundColor:atelier.background},
  hero:{paddingHorizontal:24,paddingTop:30,paddingBottom:28,gap:14},
  kicker:{color:atelier.accent,fontSize:10,letterSpacing:2,fontWeight:"700"},
  title:{color:atelier.ink,fontFamily:"serif",fontSize:42,lineHeight:46},
  body:{color:atelier.muted,fontSize:14,lineHeight:22},
  actions:{flexDirection:"row",flexWrap:"wrap",gap:10,marginTop:5},
  cta:{flexGrow:1,minWidth:110,minHeight:48,padding:14,borderWidth:1,borderColor:atelier.border,textAlign:"center",alignItems:"center",justifyContent:"center"},
  primary:{backgroundColor:atelier.accent,borderColor:atelier.accent,color:atelier.onAccent,fontWeight:"700"},
  secondary:{color:atelier.ink,fontWeight:"600"},
  discovery:{padding:24,gap:14},
  sectionTitle:{color:atelier.ink,fontFamily:"serif",fontSize:27},
  row:{borderTopWidth:1,borderColor:atelier.border,paddingTop:14,flexDirection:"row",gap:15},
  rowCopy:{flex:1,gap:4},
  rowTitle:{color:atelier.ink,fontSize:16,fontWeight:"600"},
});
