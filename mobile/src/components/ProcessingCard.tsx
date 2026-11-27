import {useEffect,useState} from "react";
import {AccessibilityInfo,Animated,Platform,StyleSheet,Text,View} from "react-native";
import {colors} from "../theme/tokens";
export function ProcessingCard({title,detail,note="Working on your piece. This can take a moment."}:{title:string;detail:string;note?:string}){
 const [motion]=useState(()=>new Animated.Value(0));
 const [reduced,setReduced]=useState(true);
 useEffect(()=>{let alive=true;void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(alive)setReduced(value);});const listener=AccessibilityInfo.addEventListener("reduceMotionChanged",setReduced);return()=>{alive=false;listener.remove();};},[]);
 useEffect(()=>{if(reduced)return;const loop=Animated.loop(Animated.sequence([Animated.timing(motion,{toValue:1,duration:1200,useNativeDriver:Platform.OS!=="web"}),Animated.timing(motion,{toValue:0,duration:1200,useNativeDriver:Platform.OS!=="web"})]));loop.start();return()=>{loop.stop();motion.setValue(0);};},[motion,reduced]);
 return <View accessibilityRole="progressbar" accessibilityLabel={title} accessibilityValue={{text:"Processing"}} style={s.card}>
 <Animated.Text style={[s.spark,{opacity:reduced?1:motion.interpolate({inputRange:[0,1],outputRange:[.35,1]}),transform:[{rotate:reduced?"0deg":motion.interpolate({inputRange:[0,1],outputRange:["-12deg","12deg"]})}]}]}>✧</Animated.Text>
 <Text style={s.title}>{title}</Text><Text style={s.detail}>{detail}</Text>
 <View style={s.track}><Animated.View style={[s.bar,{transform:[{translateX:reduced?0:motion.interpolate({inputRange:[0,1],outputRange:[0,130]})}]}]}/></View>
 <Text style={s.note}>{note}</Text></View>;
}
const s=StyleSheet.create({card:{padding:22,borderRadius:24,backgroundColor:colors.editorial,gap:13},spark:{fontSize:34,color:colors.sage},title:{fontFamily:"serif",fontSize:24,color:colors.ink},detail:{fontSize:13,lineHeight:21,color:colors.muted},track:{height:4,borderRadius:2,backgroundColor:colors.border,overflow:"hidden"},bar:{width:"45%",height:4,borderRadius:2,backgroundColor:colors.sage},note:{fontSize:11,color:colors.muted}});
