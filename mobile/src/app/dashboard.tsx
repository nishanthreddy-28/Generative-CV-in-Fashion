import { useCallback } from "react";
import { Link, useFocusEffect } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Gate, ResourceState, Screen, ui } from "../components/Screen";
import { WardrobeImage } from "../components/WardrobeImage";
import { useResource } from "../hooks/useResource";
import { colors } from "../theme/tokens";
import type { Outfit, Page } from "../types/domain";

export default function DashboardScreen() {
  const {data,loading,error,retry}=useResource<Page<Outfit>>("/outfits?limit=4",false);
  useFocusEffect(useCallback(()=>{retry();},[retry]));
  return <Screen title="Your wardrobe">
    <Gate preview={false}>
      <View style={styles.shortcuts}>
        <Link href="/wardrobe/add" style={[styles.tile,styles.addTile]}>
          <Text style={styles.symbol}>＋</Text>{"\n"}Add a piece
        </Link>
        <Link href="/wardrobe" style={styles.tile}>
          <Text style={styles.symbol}>▤</Text>{"\n"}My wardrobe
        </Link>
        <Link href="/catalog" style={styles.tile}>
          <Text style={styles.symbol}>◇</Text>{"\n"}Catalog
        </Link>
      </View>
      <View style={styles.section}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={ui.heading}>Recent outfits</Text>
          <Link href="/outfits" style={styles.textLink}>See all ›</Link>
        </View>
        <ResourceState loading={loading} error={error} retry={retry}/>
        {data?.items.length===0 && <View style={styles.empty}>
          <Text style={ui.heading}>Put a look together</Text>
          <Text style={ui.body}>Choose pieces from your wardrobe or the catalog.</Text>
          <Link href="/outfits/new" style={styles.create}>Create outfit</Link>
        </View>}
        {!!data?.items.length && <View style={styles.grid}>
          {data.items.map(outfit=>{
            const piece=outfit.items?.[0];
            return <View key={outfit.id} style={styles.outfit}>
              {piece && <WardrobeImage id={piece.garmentId} source={piece.source} label={outfit.name}/>}
              <Link href={`/outfits/${encodeURIComponent(outfit.id)}`} style={styles.outfitName}>{outfit.name} ›</Link>
            </View>;
          })}
        </View>}
      </View>
      <View style={styles.suggestions}>
        <Text style={ui.heading}>Outfit suggestions</Text>
        <Text style={ui.body}>Find combinations for an occasion.</Text>
        <Link href="/recommendations" style={styles.textLink}>Find outfits ›</Link>
      </View>
    </Gate>
  </Screen>;
}

const styles=StyleSheet.create({
  shortcuts:{flexDirection:"row",gap:8},
  tile:{flex:1,minWidth:0,textAlign:"center",paddingVertical:12,paddingHorizontal:3,borderRadius:16,overflow:"hidden",backgroundColor:colors.raised,color:colors.ink,fontSize:12,fontWeight:"700",lineHeight:21},
  addTile:{backgroundColor:"#FFDBC0"},
  symbol:{fontSize:23,lineHeight:30},
  section:{gap:10},
  heading:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},
  textLink:{color:colors.ink,fontSize:13,fontWeight:"700",minHeight:44,paddingVertical:12},
  empty:{borderRadius:20,backgroundColor:colors.raised,padding:16,gap:8},
  create:{alignSelf:"flex-start",backgroundColor:colors.ink,color:colors.surface,borderRadius:24,overflow:"hidden",paddingHorizontal:16,paddingVertical:13,minHeight:44,fontWeight:"700"},
  grid:{flexDirection:"row",flexWrap:"wrap",gap:8},
  outfit:{flexBasis:"47%",flexGrow:1,maxWidth:"50%",borderRadius:16,overflow:"hidden",backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  outfitName:{padding:11,minHeight:44,color:colors.ink,fontWeight:"700"},
  suggestions:{backgroundColor:"#F9E5EE",borderRadius:20,padding:16,gap:4},
});
