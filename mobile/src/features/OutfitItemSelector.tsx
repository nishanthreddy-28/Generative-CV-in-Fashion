import {useState} from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import {WardrobeImage} from "../components/WardrobeImage";
import {Button} from "../components/Button";
import {Notice,ResourceState,RouteLink} from "../components/Screen";
import {useResource} from "../hooks/useResource";
import {readPage} from "../services/api/readResponse";
import type {Garment,OutfitItem,Page} from "../types/domain";
import {itemKey,itemRoute} from "./outfitItems";
import {colors} from "../theme/tokens";
import {garmentGroups,type GarmentGroup} from "./pieceReview";
type Props={items:OutfitItem[];onChange:(items:OutfitItem[])=>void;preview:boolean;disabled?:boolean;single?:boolean};
const labels:Record<GarmentGroup,string>={Tops:"Shirts & tops",Bottoms:"Pants & bottoms",Dresses:"Dresses",Outerwear:"Layers",Shoes:"Shoes",Accessories:"Accessories"};
function SelectedName({item,known,preview}:{item:OutfitItem;known?:Garment;preview:boolean}){
 const result=useResource<Garment>(itemRoute(item),preview||!!known);
 const garment=known??result.data;
 return <View style={{flex:1,gap:4}}><Text style={s.kicker}>{garment?.category??"SELECTED PIECE"}</Text><RouteLink to={itemRoute(item)} preview={preview}>{garment?.name??"Selected garment"}</RouteLink></View>;
}
export function OutfitItemSelector({items,onChange,preview,disabled=false,single=false}:Props){
 const [source,setSource]=useState<"wardrobe"|"catalog">("wardrobe");
 const [category,setCategory]=useState<GarmentGroup>("Tops");
 const [cursor,setCursor]=useState("");
 const [known,setKnown]=useState<Record<string,Garment>>({});
 const result=useResource<Page<Garment>>(`/${source}?limit=24&category=${encodeURIComponent(category)}${cursor?`&cursor=${encodeURIComponent(cursor)}`:""}`,preview,false,undefined,readPage);
 function choose(garment:Garment){
   const item={source,garmentId:garment.id},key=itemKey(item);
   if(items.some(selected=>itemKey(selected)===key)){onChange(items.filter(selected=>itemKey(selected)!==key));return;}
   setKnown(current=>({...current,[key]:garment}));
   const retained=items.filter(selected=>{
     const previous=known[itemKey(selected)]?.category;
     if(category==="Dresses"&&(previous==="Tops"||previous==="Bottoms"))return false;
     if((category==="Tops"||category==="Bottoms")&&previous==="Dresses")return false;
     return category==="Accessories"||previous!==category;
   });
   onChange(single?[item]:[...retained,item]);
 }
 return <>
  <View style={s.canvas}><Text style={s.kicker}>{single?"YOUR PREVIEW":"BUILD YOUR LOOK"}</Text>
   <Text style={s.title}>{single?"One piece. A new perspective.":"Start with the essentials."}</Text>
   <Text style={s.hint}>{single?"Choose one garment to try on.":"Choose a top + bottom, or a dress. Add shoes and a layer if you like. Choosing another piece in a section replaces that selection."}</Text>
   {!single&&<View style={s.requirements}>{["Tops","Bottoms","Shoes","Outerwear"].map(group=>{
     const selected=items.some(item=>known[itemKey(item)]?.category===group);
     return <Text key={group} style={[s.requirement,selected&&s.fulfilled]}>{selected?"✓ ":"＋ "}{group==="Tops"?"One top":group==="Bottoms"?"One bottom":group==="Shoes"?"Shoes · optional":"Layer · optional"}</Text>;
   })}</View>}
   {items.length>0&&<Text style={s.hint}>{items.length} {items.length===1?"piece":"pieces"} selected</Text>}
   {items.map(item=><View key={itemKey(item)} style={s.selected}>
     <View style={s.thumb}><WardrobeImage id={item.garmentId} source={item.source} label={known[itemKey(item)]?.name??"Selected garment"}/></View>
     <SelectedName item={item} known={known[itemKey(item)]} preview={preview}/>
     <Pressable accessibilityRole="button" accessibilityLabel="Remove selected garment" disabled={disabled} style={s.remove} onPress={()=>onChange(items.filter(selected=>itemKey(selected)!==itemKey(item)))}><Text style={s.mark}>×</Text></Pressable>
   </View>)}
  </View>
  <View style={s.sources}>{(["wardrobe","catalog"] as const).map(option=><Pressable key={option} accessibilityRole="tab" accessibilityState={{selected:source===option}} disabled={disabled} style={[s.source,source===option&&s.sourceActive]} onPress={()=>{setSource(option);setCursor("");}}><Text style={s.sourceText}>{option==="wardrobe"?"Your wardrobe":"The catalogue"}</Text></Pressable>)}</View>
  <View style={s.groups}>{garmentGroups.map(group=><Pressable key={group} accessibilityRole="tab" accessibilityState={{selected:category===group}} disabled={disabled} style={[s.group,category===group&&s.groupActive]} onPress={()=>{setCategory(group);setCursor("");}}><Text style={[s.groupText,category===group&&s.groupTextActive]}>{labels[group]}</Text></Pressable>)}</View>
  <Text style={s.section}>{labels[category]}</Text><ResourceState {...result}/>
  <View style={s.grid}>{result.data?.items.map(garment=>{
   const item={source,garmentId:garment.id};const checked=items.some(selected=>itemKey(selected)===itemKey(item));
   return <Pressable key={garment.id} accessibilityRole="checkbox" accessibilityLabel={`${garment.name}, ${garment.category}`} accessibilityState={{checked,disabled}} disabled={disabled||(!checked&&items.length>=100)} onPress={()=>choose(garment)} style={[s.piece,checked&&s.checked]}>
     <WardrobeImage id={garment.id} source={source} label={garment.name}/><View style={s.pieceLabel}><View style={{flex:1}}><Text style={s.pieceName} numberOfLines={2}>{garment.name}</Text><Text style={s.hint}>{garment.color||garment.category}</Text></View><Text style={s.mark}>{checked?"✓":"+"}</Text></View>
   </Pressable>;
  })}</View>
  {result.data?.items.length===0&&<Notice title={`No ${labels[category].toLowerCase()} here yet`} text="Try another section or add a piece to your wardrobe."/>}
  {!!result.data?.nextCursor&&<Button label="More pieces in this section" variant="secondary" disabled={disabled||result.loading} onPress={()=>setCursor(result.data!.nextCursor!)}/>}
  {!!cursor&&<Button label="Back to first page" variant="secondary" disabled={disabled} onPress={()=>setCursor("")}/>}
 </>;
}
const s=StyleSheet.create({
 canvas:{backgroundColor:colors.editorial,borderRadius:24,padding:20,gap:12},kicker:{fontSize:9,color:colors.sage,fontWeight:"700",letterSpacing:1.8},title:{fontFamily:"serif",fontSize:25,color:colors.ink},hint:{fontSize:12,lineHeight:19,color:colors.muted},
 requirements:{flexDirection:"row",flexWrap:"wrap",gap:6},requirement:{fontSize:11,padding:9,backgroundColor:colors.surface,borderRadius:12,color:colors.muted},fulfilled:{color:colors.sage,fontWeight:"700"},
 selected:{flexDirection:"row",alignItems:"center",gap:12,borderTopWidth:1,borderColor:colors.border,paddingTop:10},thumb:{width:48},remove:{width:44,height:44,alignItems:"center",justifyContent:"center"},mark:{fontSize:21,color:colors.ink},
 sources:{flexDirection:"row",padding:4,backgroundColor:colors.editorial,borderRadius:20},source:{flex:1,paddingVertical:12,borderRadius:16,alignItems:"center"},sourceActive:{backgroundColor:colors.surface},sourceText:{color:colors.ink,fontSize:12,fontWeight:"600"},
 groups:{flexDirection:"row",flexWrap:"wrap",gap:8},group:{borderRadius:20,paddingHorizontal:14,paddingVertical:11,borderWidth:1,borderColor:colors.border},groupActive:{backgroundColor:colors.ink,borderColor:colors.ink},groupText:{fontSize:12,color:colors.muted},groupTextActive:{color:"#fff"},
 section:{fontFamily:"serif",fontSize:23,color:colors.ink,paddingTop:8},grid:{flexDirection:"row",flexWrap:"wrap",gap:10},piece:{flexBasis:"47%",flexGrow:1,maxWidth:"50%",backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:18,overflow:"hidden"},checked:{borderColor:colors.sage,borderWidth:2},pieceLabel:{padding:10,flexDirection:"row",gap:6,alignItems:"center"},pieceName:{fontSize:13,color:colors.ink,fontWeight:"600"}
});
