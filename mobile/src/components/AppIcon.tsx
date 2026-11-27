import {Fragment} from "react";
import {View} from "react-native";
import {colors} from "../theme/tokens";
export type IconName="account"|"wardrobe"|"catalog"|"home"|"stylist"|"try-on"|"outfits"|"plus"|"back";
type Point=readonly [number,number];
function Stroke({points,size,color}:{points:readonly Point[];size:number;color:string}){
 const thickness=Math.max(1.5,size/14);
 return <>{points.slice(1).map((end,index)=>{
  const start=points[index],dx=(end[0]-start[0])*size,dy=(end[1]-start[1])*size;
  const length=Math.hypot(dx,dy);
  return <View key={index} style={{position:"absolute",left:(start[0]+end[0])*size/2-length/2,top:(start[1]+end[1])*size/2-thickness/2,width:length,height:thickness,borderRadius:thickness,backgroundColor:color,transform:[{rotate:`${Math.atan2(dy,dx)}rad`}]}}/>;
 })}</>;
}
const paths:Record<Exclude<IconName,"account">,readonly (readonly Point[])[]>={
 home:[[[.1,.45],[.5,.12],[.9,.45]],[[.22,.38],[.22,.88],[.78,.88],[.78,.38]],[[.42,.88],[.42,.61],[.59,.61],[.59,.88]]],
 wardrobe:[[[.17,.1],[.83,.1],[.83,.85],[.17,.85],[.17,.1]],[[.5,.1],[.5,.85]],[[.39,.43],[.39,.54]],[[.61,.43],[.61,.54]],[[.26,.85],[.26,.94]],[[.74,.85],[.74,.94]]],
 catalog:[[[.13,.13],[.42,.13],[.42,.42],[.13,.42],[.13,.13]],[[.58,.13],[.87,.13],[.87,.42],[.58,.42],[.58,.13]],[[.13,.58],[.42,.58],[.42,.87],[.13,.87],[.13,.58]],[[.58,.58],[.87,.58],[.87,.87],[.58,.87],[.58,.58]]],
 stylist:[[[.49,.1],[.59,.39],[.88,.49],[.59,.59],[.49,.89],[.39,.59],[.1,.49],[.39,.39],[.49,.1]],[[.82,.08],[.82,.24]],[[.74,.16],[.9,.16]]],
 "try-on":[[[.35,.18],[.18,.25],[.08,.44],[.25,.52],[.3,.43],[.3,.87],[.7,.87],[.7,.43],[.75,.52],[.92,.44],[.82,.25],[.65,.18]],[[.35,.18],[.4,.31],[.5,.35],[.6,.31],[.65,.18]]],
 outfits:[[[.15,.69],[.15,.15],[.69,.15]],[[.3,.3],[.85,.3],[.85,.85],[.3,.85],[.3,.3]],[[.42,.47],[.73,.47]],[[.42,.62],[.66,.62]]],
 plus:[[[.5,.18],[.5,.82]],[[.18,.5],[.82,.5]]],
 back:[[[.6,.18],[.28,.5],[.6,.82]]],
};
export function AppIcon({name,size=24,color=colors.ink}:{name:IconName;size?:number;color?:string}){
 const stroke=Math.max(1.5,size/14),line={borderColor:color,borderWidth:stroke};
 return <View accessible={false} importantForAccessibility="no-hide-descendants" style={{width:size,height:size}}>
  {name==="account"?<Fragment>
   <View style={[line,{position:"absolute",width:size*.28,height:size*.28,borderRadius:size,left:size*.36,top:size*.12}]}/>
   <View style={[line,{position:"absolute",width:size*.72,height:size*.32,borderTopLeftRadius:size*.36,borderTopRightRadius:size*.36,left:size*.14,top:size*.57}]}/>
  </Fragment>:paths[name].map((points,index)=><Stroke key={index} points={points} size={size} color={color}/>)}
 </View>;
}
