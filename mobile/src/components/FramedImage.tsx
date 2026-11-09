import {Image,View,type ImageSourcePropType} from 'react-native';
import {colors} from '../theme/tokens';
// Keep intrinsic source dimensions out of flex layout on web and native.
export function FramedImage({source,label,ratio=1,contain=false,edgeToEdge=false}:{source:ImageSourcePropType;label:string;ratio?:number;contain?:boolean;edgeToEdge?:boolean}){
 return <View style={{width:'100%',aspectRatio:ratio,position:'relative',overflow:'hidden',backgroundColor:colors.editorial,borderRadius:edgeToEdge ? 0 : 6}}>
  <Image source={source} accessibilityLabel={label} resizeMode={contain ? 'contain' : 'cover'} style={{position:"absolute",top:0,left:0,width:"100%",height:"100%"}}/>
 </View>;
}
