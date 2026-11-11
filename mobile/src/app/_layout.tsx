import {Stack,usePathname} from "expo-router";
import {StatusBar} from "expo-status-bar";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {ActivityIndicator,Platform,StyleSheet,Text,View} from "react-native";
import {SessionProvider,useSession} from "../features/session";
import {guestScreens,publicScreens,personalScreens,adminScreens,accountScreens,routeAccess} from "../features/navigation";
import {AppearanceProvider,useAppearance} from "../theme/Appearance";
import {colors} from "../theme/tokens";
export const unstable_settings={anchor:"login"};
function AppNavigator({publicAccount}: {publicAccount: boolean}){
 const {palette}=useAppearance();
 const {background,ink}=publicAccount ? palette : colors;
 const {session,ready,accountDeleting}=useSession();
 const access=routeAccess(ready,session?.user.role,accountDeleting);
 if(!ready)return <View style={{flex:1,alignItems:"center",justifyContent:"center",gap:20,backgroundColor:background}}>
  <Text style={{color:ink,letterSpacing:3,fontWeight:"600"}}>DRAPE &amp; DROP</Text>
  <ActivityIndicator accessibilityLabel="Restoring your session" color={ink}/>
 </View>;
 return <Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:background}}}>
  <Stack.Protected guard={access.guest}>{guestScreens.map(name=><Stack.Screen key={name} name={name}/>)}</Stack.Protected>
  <Stack.Protected guard={access.personal}>{personalScreens.map(name=><Stack.Screen key={name} name={name}/>)}</Stack.Protected>
  <Stack.Protected guard={access.admin}>{adminScreens.map(name=><Stack.Screen key={name} name={name}/>)}</Stack.Protected>
  <Stack.Protected guard={access.account}>{accountScreens.map(name=><Stack.Screen key={name} name={name}/>)}</Stack.Protected>
  {publicScreens.map(name=><Stack.Screen key={name} name={name}/>)}
 </Stack>;
}
function AppFrame(){
 const {palette,mode}=useAppearance();
 const publicAccount=["/","/login","/signup"].includes(usePathname());
 return <View style={styles.browser}><View style={[styles.app,publicAccount && {backgroundColor:palette.background,borderColor:palette.border}]}><SafeAreaProvider><SessionProvider>
 <StatusBar style={publicAccount && mode==="dark" ? "light" : "dark"}/><AppNavigator publicAccount={publicAccount}/>
 </SessionProvider></SafeAreaProvider></View></View>;
}
export default function RootLayout(){return <AppearanceProvider><AppFrame/></AppearanceProvider>;}

const styles=StyleSheet.create({
 browser:{flex:1,backgroundColor:colors.canvas},
 app:{flex:1,width:"100%",alignSelf:"center",backgroundColor:colors.background,...(Platform.OS==="web"?{maxWidth:480,borderLeftWidth:1,borderRightWidth:1,borderColor:colors.border}:{})},
});
