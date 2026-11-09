import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {useAppearance, type Palette} from "../theme/Appearance";

export function AtelierHeader({onDiscover, account = "login"}: {
  onDiscover?: () => void;
  account?: "login" | "signup";
}) {
  const {palette,mode,toggle}=useAppearance();
  const styles=makeStyles(palette);
  return <View style={styles.header}>
    <Link href="/" accessibilityLabel="Drape and Drop home" style={styles.logo}>DRAPE &amp; DROP</Link>
    <View style={styles.links}>
      {onDiscover && <Pressable accessibilityRole="button" onPress={onDiscover} style={styles.discover}>
        <Text style={styles.link}>Discover</Text>
      </Pressable>}
      <Link href={account === "login" ? "/login" : "/signup"} style={styles.link}>
        {account === "login" ? "Sign in" : "Join"}
      </Link>
    </View>
    <View style={styles.themeRow}>
      <Text style={styles.themeLabel}>Appearance</Text>
      <Pressable accessibilityRole="switch" accessibilityLabel="Dark appearance" accessibilityState={{checked:mode==="dark"}} onPress={toggle} style={styles.themeButton}>
        <Text style={styles.themeText}>{mode === "light" ? "Light · Switch to dark" : "Dark · Switch to light"}</Text>
      </Pressable>
    </View>
  </View>;
}

const makeStyles = (atelier:Palette) => StyleSheet.create({
  themeRow:{width:"100%",flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderTopWidth:1,borderColor:atelier.border},
  themeLabel:{fontSize:10,letterSpacing:1,color:atelier.muted,textTransform:"uppercase"},
  themeButton:{minHeight:44,justifyContent:"center",paddingLeft:16},
  themeText:{fontSize:12,color:atelier.ink},
  header:{paddingHorizontal:20,borderBottomWidth:1,borderColor:atelier.border,flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between",alignItems:"center",columnGap:10},
  logo:{color:atelier.ink,fontSize:13,fontWeight:"700",letterSpacing:2.1,paddingVertical:16},
  links:{flexDirection:"row",alignItems:"center",gap:16},
  discover:{justifyContent:"center"},
  link:{color:atelier.ink,fontSize:13,paddingVertical:15,minHeight:44},
});
