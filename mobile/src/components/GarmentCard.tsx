import {Text,View,StyleSheet} from 'react-native';
import {WardrobeImage} from './WardrobeImage';
import {RouteLink} from './Screen';
import {colors} from '../theme/tokens';
import {garmentSummary,priceLabel} from '../features/presentation';
import type {Garment} from '../types/domain';
export function GarmentCard({item,source}:{item:Garment;source:'wardrobe'|'catalog'|'admin/catalog'}){
 const summary=garmentSummary(item);
 const price=source==='wardrobe' ? null : priceLabel(item.price);
 return <View style={styles.card}>
  {item.imageUrl ? <WardrobeImage id={item.id} label={item.name} source={source}/> : <View style={styles.placeholder} accessibilityLabel="No garment photo"><Text style={styles.caption}>Photo unavailable</Text></View>}
  <View style={styles.details}>
   <Text style={styles.category}>{item.category}</Text>
   <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
   {!!summary && <Text style={styles.caption} numberOfLines={2}>{summary}</Text>}
   {price && <Text style={styles.price}>{price}</Text>}
   {source==='admin/catalog' && item.active===false && <Text style={styles.caption}>Inactive · hidden from discovery</Text>}
   <RouteLink to={`/${source}/${encodeURIComponent(item.id)}`}>{source==='admin/catalog' ? 'Manage piece' : 'View piece'} →</RouteLink>
  </View>
 </View>;
}
const styles=StyleSheet.create({card:{borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,borderRadius:6,overflow:'hidden',height:'100%'},details:{padding:12,gap:5},category:{fontSize:10,textTransform:'uppercase',letterSpacing:1.2,color:colors.accent},name:{fontSize:19,fontFamily:'serif',color:colors.ink,lineHeight:24},caption:{fontSize:12,color:colors.muted,lineHeight:18},price:{fontSize:14,fontWeight:'600',color:colors.ink},placeholder:{aspectRatio:0.8,backgroundColor:colors.editorial,alignItems:'center',justifyContent:'center',padding:16}});
