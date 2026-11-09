import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { validBinding, type RegistrationBinding } from './registration';
const key = 'drapedrop.registration.pending';
const options = {keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY};
// Original-tab binding: opening an email elsewhere never transfers the capability.
export async function pendingRegistration(): Promise<RegistrationBinding | null> {
  try {
    const raw = Platform.OS === 'web' ? window.sessionStorage.getItem(key) : await SecureStore.getItemAsync(key, options);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return validBinding(parsed) ? parsed : null;
  } catch {return null;}
}
export async function retainRegistration(binding: RegistrationBinding | null) {
  if (binding && !validBinding(binding)) throw new Error('Invalid registration session.');
  if (Platform.OS === 'web') {
    if (binding) window.sessionStorage.setItem(key, JSON.stringify(binding));
    else window.sessionStorage.removeItem(key);
  } else if (binding) await SecureStore.setItemAsync(key, JSON.stringify(binding), options);
  else await SecureStore.deleteItemAsync(key, options);
}
