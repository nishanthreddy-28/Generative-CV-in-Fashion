import {AppIcon} from "../components/AppIcon";
import { useCallback } from "react";
import { Link, useFocusEffect } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gate, ResourceState, Screen, ui } from "../components/Screen";
import { WardrobeImage } from "../components/WardrobeImage";
import { useResource } from "../hooks/useResource";
import { readPage } from "../services/api/readResponse";
import { colors } from "../theme/tokens";
import type { Outfit, Page } from "../types/domain";

export default function DashboardScreen() {
  const {data,loading,error,retry}=useResource<Page<Outfit>>("/outfits?limit=4",false,false,undefined,readPage);
  useFocusEffect(useCallback(()=>{retry();},[retry]));
  return <Screen title="Your wardrobe">
    <Gate preview={false}>
      <View style={styles.shortcuts}>
        <Link href="/wardrobe/add" asChild><Pressable style={StyleSheet.flatten([styles.tile,styles.addTile])} accessibilityLabel="Add a piece"><Text style={styles.symbol}>＋</Text><Text style={styles.tileLabel}>Add a piece</Text></Pressable></Link>
        <Link href="/wardrobe" asChild><Pressable style={styles.tile} accessibilityLabel="My wardrobe"><AppIcon name="wardrobe" size={28}/><Text style={styles.tileLabel}>My wardrobe</Text></Pressable></Link>
        <Link href="/catalog" asChild><Pressable style={styles.tile} accessibilityLabel="Catalog"><AppIcon name="catalog" size={28}/><Text style={styles.tileLabel}>Catalog</Text></Pressable></Link>
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
        <Text style={ui.heading}>Your personal stylist</Text>
        <Text style={ui.body}>Build a look around your wardrobe.</Text>
        <Link href="/stylist" style={styles.textLink}>Chat with your AI stylist ›</Link>
        <Link href="/body-analysis" style={styles.textLink}>Body photo analysis ›</Link>
      </View>
    </Gate>
  </Screen>;
}

const styles=StyleSheet.create({
  shortcuts:{flexDirection:"row",gap:8},
  tileLabel:{fontSize:12,fontWeight:"700",color:colors.ink,textAlign:"center"},
  tile:{alignItems:"center",justifyContent:"center",gap:8,flex:1,minWidth:0,paddingVertical:12,paddingHorizontal:3,borderRadius:16,overflow:"hidden",backgroundColor:colors.raised},
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
