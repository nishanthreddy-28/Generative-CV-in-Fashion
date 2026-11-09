import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View, type PressableProps } from "react-native";
import { forwardRef, type ElementRef } from "react";
import { FramedImage } from "../components/FramedImage";
import { colors } from "../theme/tokens";
import { Gate, Screen } from "../components/Screen";

const destinations = [
  { title: "My wardrobe", detail: "See the pieces you own", href: "/wardrobe" },
  { title: "Saved outfits", detail: "Revisit your favourite combinations", href: "/outfits" },
  { title: "Browse the catalog", detail: "Find pieces for your next outfit", href: "/catalog" },
  { title: "Style ideas", detail: "Find new ways to wear your pieces", href: "/recommendations" },
] as const;

export default function DashboardScreen() {
  return (
    <Screen title="The wardrobe edit" subtitle="A place for the pieces you love.">
      <Gate preview={false}>
        <FramedImage
          source={require("../../assets/editorial/campaign-evening.jpg")}
          label="Two models in evening tailoring in a gallery"
          ratio={1.45}
          edgeToEdge
        />
        <View style={styles.action}>
          <Link href="/wardrobe/add" style={styles.add} accessibilityLabel="Add item">+ Add item</Link>
          <Text style={styles.hint}>Start with a photo of something you wear.</Text>
        </View>
        <View>
          <Text style={styles.eyebrow}>YOUR COLLECTION</Text>
          {destinations.map(({title, detail, href}) => (
            <Link href={href} asChild key={href}>
              <DashboardRow title={title} detail={detail} />
            </Link>
          ))}
        </View>
      </Gate>
    </Screen>
  );
}


const DashboardRow = forwardRef<ElementRef<typeof Pressable>, PressableProps & {title:string;detail:string}>(
  function DashboardRow({title,detail,...props},ref) {
    return <Pressable {...props} ref={ref} style={({pressed})=>[styles.row,pressed && styles.pressed]}>
      <View style={styles.rowCopy}>
        <Text style={styles.name}>{title}</Text>
        <Text style={styles.hint}>{detail}</Text>
      </View>
      <Text accessible={false} style={styles.arrow}>↗</Text>
    </Pressable>;
  },
);

const styles = StyleSheet.create({
  action: {alignItems:"center",gap:10,paddingVertical:4},
  add: {color:colors.onAccent,backgroundColor:colors.accent,textAlign:"center",minWidth:160,minHeight:48,padding:14,fontWeight:"600"},
  hint: {color:colors.muted,fontSize:13,lineHeight:19},
  eyebrow: {fontSize:10,letterSpacing:2,fontWeight:"700",color:colors.muted,paddingBottom:10},
  row: {borderTopWidth:1,borderColor:colors.border,paddingVertical:15,flexDirection:"row",alignItems:"center",gap:12},
  rowCopy: {flex:1,gap:3},
  name: {color:colors.ink,fontSize:18,fontFamily:"serif"},
  arrow: {color:colors.ink,fontSize:19,paddingHorizontal:4},
  pressed: {opacity:0.62},
});
