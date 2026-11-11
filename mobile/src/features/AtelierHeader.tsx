import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppearance, type Palette } from "../theme/Appearance";

export function AtelierHeader({showSignIn = true}: {showSignIn?: boolean}) {
  const {palette,mode,toggle}=useAppearance();
  const styles=makeStyles(palette);
  const dark=mode==="dark";
  return <View style={styles.header}>
    <Link href="/" accessibilityLabel="Drape and Drop home" style={styles.logo}>DRAPE &amp; DROP</Link>
    <View style={styles.controls}>
      {showSignIn && <Link href="/login" style={styles.link}>Sign in</Link>}
      <Pressable accessibilityRole="button" accessibilityLabel={dark ? "Switch to light theme" : "Switch to dark theme"}
        onPress={toggle} style={({pressed})=>[styles.themeButton, pressed && styles.pressed]}>
        <View style={styles.themeDisc}>
          <Text accessible={false} style={styles.themeIcon}>{dark ? "☀" : "☾"}</Text>
        </View>
      </Pressable>
    </View>
  </View>;
}

const makeStyles = (palette:Palette) => StyleSheet.create({
  header:{minHeight:60,paddingLeft:20,paddingRight:12,borderBottomWidth:1,borderColor:palette.border,
    flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:8},
  logo:{color:palette.ink,fontFamily:"serif",fontSize:18,letterSpacing:0.65,paddingVertical:12},
  controls:{flexDirection:"row",alignItems:"center",gap:8},
  link:{color:palette.ink,fontSize:13,fontWeight:"600",paddingHorizontal:4,paddingVertical:14,minHeight:44},
  themeButton:{width:44,height:44,alignItems:"center",justifyContent:"center"},
  themeDisc:{width:34,height:34,borderRadius:17,borderWidth:1,borderColor:palette.border,backgroundColor:palette.surface,
    alignItems:"center",justifyContent:"center"},
  themeIcon:{color:palette.ink,fontSize:19,lineHeight:23},
  pressed:{opacity:0.65},
});
