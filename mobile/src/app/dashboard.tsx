import {FramedImage} from "../components/FramedImage";
import {useCallback} from "react";
import {useFocusEffect} from "expo-router";
import {Text,View,StyleSheet} from "react-native";
import {Button} from "../components/Button";
import {Screen,Gate,Notice,RouteLink,ResourceState,ui} from "../components/Screen";
import {useResource} from "../hooks/useResource";
import {colors} from "../theme/tokens";
import type {Dashboard} from "../types/domain";
export default function DashboardScreen(){
 const result=useResource<Dashboard>("/dashboard",false);const refresh=result.retry;
 useFocusEffect(useCallback(()=>{refresh();},[refresh]));
 return <Screen title="Your personal edit." subtitle="Less guesswork. More outfits that feel like you.">
  <Gate preview={false}>
   <View style={styles.hero}>
    <FramedImage source={require('../../assets/editorial/introduction.png')} ratio={1.8} contain label="Curated fashion editorial"/>
    <View style={styles.heroCopy}>
     <Text style={styles.eyebrow}>THE EVERYDAY EDIT</Text>
     <Text style={styles.heroTitle}>Make more of{`\n`}what you own.</Text>
     <RouteLink to="/recommendations">Find your next look →</RouteLink>
    </View>
   </View>
   <ResourceState {...result}/>
   {result.data && <View style={styles.stats}>
    {[["Pieces",result.data.wardrobeCount],["Outfits",result.data.savedOutfitCount],["Saved ideas",result.data.savedRecommendationCount]].map(([label,count])=><View key={label} style={styles.stat}><Text style={styles.number}>{count}</Text><Text style={styles.statLabel}>{label}</Text></View>)}
   </View>}
   {result.data && !result.data.wardrobeCount && <Notice title="Start with a favourite piece" text="Add your first garment and build your wardrobe, one good piece at a time."><RouteLink to="/wardrobe/add">Add your first piece →</RouteLink></Notice>}
   <View style={styles.sectionHeading}><Text style={ui.heading}>Made for your wardrobe</Text><RouteLink to="/wardrobe/add">+ Add a piece</RouteLink></View>
   <View style={styles.tiles}>
    {[["Build a look","Combine pieces from your wardrobe and the catalog.","/outfits/new"],["Discover something new","Explore the shared clothing collection.","/catalog"],["Your saved ideas","Come back to the looks you love.","/recommendations/saved"],["Try-on studio","Submit a private job and follow its status.","/try-on"]].map(([title,text,path])=><View key={path} style={styles.tile}><Text style={ui.heading}>{title}</Text><Text style={ui.body}>{text}</Text><RouteLink to={path}>Explore →</RouteLink></View>)}
   </View>
   {result.data && <Text style={ui.body}>{result.data.recommendationCount} generated ideas · {result.data.tryOnJobCount} try-on jobs</Text>}
   <Button label="Refresh your overview" variant="secondary" onPress={refresh} disabled={result.loading}/>
  </Gate>
 </Screen>;
}
const styles=StyleSheet.create({
 hero:{backgroundColor:'#EAE7DF',borderRadius:4,overflow:'hidden'},heroImage:{width:'100%',aspectRatio:1.8},heroCopy:{padding:22,gap:10},eyebrow:{fontSize:10,letterSpacing:2,color:colors.sage,fontWeight:'700'},heroTitle:{fontSize:30,lineHeight:35,fontFamily:'serif',color:colors.ink},
 stats:{flexDirection:'row',borderBottomWidth:1,borderColor:colors.border,paddingVertical:18},stat:{flex:1,alignItems:'center',gap:6},number:{fontSize:28,fontFamily:'serif',color:colors.ink},statLabel:{fontSize:12,color:colors.muted},sectionHeading:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:8},tiles:{flexDirection:'row',flexWrap:'wrap',gap:12},tile:{flexGrow:1,flexBasis:240,padding:20,gap:12,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
});
