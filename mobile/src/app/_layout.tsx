import {Stack} from "expo-router";
import {StatusBar} from "expo-status-bar";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {ActivityIndicator,Text,View} from "react-native";
import {SessionProvider,useSession} from "../features/session";
import {guestScreens,publicScreens,personalScreens,adminScreens,accountScreens,routeAccess} from "../features/navigation";
import {colors} from "../theme/tokens";
export const unstable_settings={anchor:"login"};
function AppNavigator(){
 const {session,ready,accountDeleting}=useSession();
 const access=routeAccess(ready,session?.user.role,accountDeleting);
 if(!ready)return <View style={{flex:1,alignItems:"center",justifyContent:"center",gap:20,backgroundColor:colors.background}}>
  <Text style={{color:colors.ink,letterSpacing:3,fontWeight:"600"}}>DRAPE &amp; DROP</Text>
  <ActivityIndicator accessibilityLabel="Restoring your session" color={colors.ink}/>
 </View>;
 return <Stack screenOptions={{headerShown:false,contentStyle:{backgroundColor:colors.background}}}>
  <Stack.Protected guard={access.guest}>{guestScreens.map(name=><Stack.Screen key={name} name={name}/>)}</Stack.Protected>
  <Stack.Protected guard={access.personal}>{personalScreens.map(name=><Stack.Screen key={name} name={name}/>)}</Stack.Protected>
  <Stack.Protected guard={access.admin}>{adminScreens.map(name=><Stack.Screen key={name} name={name}/>)}</Stack.Protected>
  <Stack.Protected guard={access.account}>{accountScreens.map(name=><Stack.Screen key={name} name={name}/>)}</Stack.Protected>
  {publicScreens.map(name=><Stack.Screen key={name} name={name}/>)}
 </Stack>;
}
export default function RootLayout(){return <SafeAreaProvider><SessionProvider>
 <StatusBar style="dark"/><AppNavigator/>
 </SessionProvider></SafeAreaProvider>;}
