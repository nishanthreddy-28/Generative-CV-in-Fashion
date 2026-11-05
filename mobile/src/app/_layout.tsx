import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../theme/tokens';
export default function RootLayout() {
  return <SafeAreaProvider><StatusBar style="dark" /><Stack screenOptions={{
    headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.ink,
    headerShadowVisible: false, contentStyle: { backgroundColor: colors.background },
  }}><Stack.Screen name="index" options={{ headerShown: false }} />
    <Stack.Screen name="login" options={{ title: 'Your personal wardrobe' }} />
  </Stack></SafeAreaProvider>;
}
