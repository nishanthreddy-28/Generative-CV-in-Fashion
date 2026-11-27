import {Image,Pressable,StyleSheet,Text,View} from "react-native";
import {router} from "expo-router";
import {Screen,Notice,ui} from "../../components/Screen";
import {PhotoField} from "../../components/PhotoField";
import {ProcessingCard} from "../../components/ProcessingCard";
import {Button} from "../../components/Button";
import {Fields} from "../../components/Fields";
import {colors} from "../../theme/tokens";
import {garmentGroups} from "../../features/pieceReview";
import {useGarmentUploadState} from "../../features/GarmentUploadState";

export default function Add(){
 const {photo,values,setValues,busy,error,prepared,setPrepared,savedId,editing,setEditing,duplicate,view,setView,reviewed,changePhoto,analyse,save,saved,cancel}=useGarmentUploadState();
 return <Screen title="A new piece." subtitle="One photo. A little detail. A wardrobe that feels like you.">
   <View style={s.steps}>{["01  Photo","02  Discover","03  Review"].map((step,index)=><Text key={step} style={[s.step,(reviewed?index===2:photo?index===1:index===0)&&s.active]}>{step}</Text>)}</View>
   <View style={s.intro}><Text style={s.eyebrow}>THE WARDROBE EDIT</Text><Text style={s.title}>{reviewed?"Meet your new piece.":"Start with a clear photo."}</Text>
     <Text style={ui.body}>{reviewed?"We filled in the details. Keep them, or make them yours.":"Photograph one garment at a time. Keep the whole piece visible and avoid clutter."}</Text></View>
   {!reviewed&&<PhotoField label="Your garment photo" subject="garment" camera value={photo} onChange={changePhoto} disabled={!!busy}/>}
   {!reviewed&&<Button label={busy==="analyse"?"Reading your piece…":"Check photo & discover details"} loading={busy==="analyse"} disabled={!photo||!!busy} onPress={()=>void analyse()}/>}
   {busy&&<ProcessingCard title={busy==="analyse"?"Discovering your piece":"Preparing your piece"} detail={busy==="analyse"?"Checking the photo, separating its background and reading the details.":"Isolating the garment and saving your reviewed reference."}/>}
   {reviewed&&photo&&<>
     <View style={s.preview}>
       <View style={s.tabs}>{(["cutout","original"] as const).map(option=><Pressable key={option} onPress={()=>setView(option)} accessibilityRole="tab" accessibilityState={{selected:view===option}} style={[s.tab,view===option&&s.tabActive]}><Text style={s.tabText}>{option==="cutout"?"Clean view":"Original"}</Text></Pressable>)}</View>
       <Image source={{uri:view==="cutout"&&(reviewed.cutoutUsed||prepared?.category===values.category)?`data:${reviewed.cutoutMime};base64,${prepared?.category===values.category?prepared.cutoutBase64:reviewed.cutoutBase64}`:photo.uri}} accessibilityLabel={view==="cutout"?"Garment preview after background processing":"Original garment photo"} resizeMode="contain" style={s.photo}/>
       <Text style={s.caption}>{reviewed.cutoutUsed?"Background removed · original preserved":"Background separation was uncertain · showing your original"}</Text>
     </View>
     <View style={s.details}><Text style={s.eyebrow}>DOES THIS LOOK RIGHT?</Text><Text style={s.pieceName}>{values.name}</Text>
       <View style={s.tags}><Text style={s.tag}>{values.category}</Text><Text style={s.tag}>{values.color||"Choose a colour"}</Text></View>
       {reviewed.route!=="auto"&&<Text style={s.review}>A detail needs your eye. Please check the category and name.</Text>}
       <Text style={s.caption}>Suggested from the photo · you have the final say</Text>
       <Pressable accessibilityRole="button" disabled={!!busy} onPress={()=>setEditing(value=>!value)} style={s.edit}><Text style={s.editText}>{editing?"Close detail editor":"Edit name, category or colour"} ↗</Text></Pressable>
       {editing&&<Fields fields={[{key:"name",label:"Piece name",required:true},{key:"category",label:"Category",required:true,options:[...garmentGroups]},{key:"color",label:"Colours"}]} values={values} errors={{}} disabled={!!busy} onChange={(key,value)=>{if(key==="category")setPrepared(null);setValues(current=>({...current,[key]:value}));}}/>}
     </View>
     {prepared?.category===values.category&&<Notice title="Garment-only reference ready" text="Check sleeves, straps and edges before confirming. Your original photo is preserved."/>}
     {prepared?.warnings.map((warning,index)=><Text key={"prepared"+index} style={s.caption}>{warning}</Text>)}
     {reviewed.warnings.map((warning,index)=><Text key={index} style={s.caption}>{warning}</Text>)}
     <Button label={savedId?"Finish saving this piece":editing?"Save my changes & add piece":"Looks right — add to wardrobe"} loading={busy==="save"} disabled={!!busy||prepared?.category!==values.category} onPress={()=>void save()}/>
     {(!prepared||!!savedId)&&<Button label="Check photo again" variant="secondary" disabled={!!busy} onPress={()=>void analyse()}/>}
     <Button label="Choose a different photo" variant="secondary" disabled={!!busy} onPress={()=>changePhoto(null)}/>
     {duplicate&&<Button label="Review existing wardrobe pieces" variant="secondary" disabled={!!busy} onPress={()=>router.push("/wardrobe")}/>}
     {duplicate&&<Button label="Keep another piece with this photo" variant="secondary" disabled={!!busy} onPress={()=>void save(true)}/>}
   </>}
   {!!error&&<Notice title="Let’s check that" text={error} tone="error"/>}
   {busy==="analyse"&&<Button label="Cancel processing" variant="secondary" onPress={cancel}/>}
   {saved&&<Notice title="Piece saved" text="Your clean photo is ready in Wardrobe." tone="success"><Button label="View wardrobe" variant="secondary" onPress={()=>router.replace("/wardrobe")}/></Notice>}
   <Text style={s.caption}>{savedId?"Finishing this piece: your original is saved. Complete the clean-image step before adding another.":"Your piece is saved only after you confirm. Suggestions can be edited."}</Text>
 </Screen>;
}
const s=StyleSheet.create({
 steps:{flexDirection:"row",justifyContent:"space-between",borderBottomWidth:1,borderColor:colors.border,paddingBottom:14},step:{fontSize:11,color:colors.muted,letterSpacing:1},active:{color:colors.ink,fontWeight:"700"},
 intro:{gap:10,paddingVertical:12},eyebrow:{fontSize:10,letterSpacing:2,color:colors.sage,fontWeight:"700"},title:{fontFamily:"serif",fontSize:30,color:colors.ink},
 preview:{backgroundColor:colors.editorial,borderRadius:24,padding:16,gap:12},tabs:{flexDirection:"row",alignSelf:"center",backgroundColor:"#E5E0D8",padding:4,borderRadius:24},tab:{paddingHorizontal:20,paddingVertical:10,borderRadius:20},tabActive:{backgroundColor:colors.surface},tabText:{fontSize:12,color:colors.ink},photo:{width:"100%",height:300},
 caption:{fontSize:12,lineHeight:19,color:colors.muted},details:{padding:22,borderWidth:1,borderColor:colors.border,borderRadius:24,backgroundColor:colors.surface,gap:14},pieceName:{fontFamily:"serif",fontSize:28,color:colors.ink},tags:{flexDirection:"row",gap:8,flexWrap:"wrap"},tag:{backgroundColor:colors.raised,paddingVertical:8,paddingHorizontal:12,borderRadius:15,fontSize:12,color:colors.ink},review:{color:colors.sage,fontSize:13,lineHeight:20},edit:{paddingVertical:12,borderTopWidth:1,borderColor:colors.border},editText:{color:colors.ink,fontSize:13,textDecorationLine:"underline"}
});
