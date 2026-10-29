import { mutate, readState } from './database';
const key = 'drape-drop-studio-session';
export const sessionUserId = () => sessionStorage.getItem(key);
export const logout = () => sessionStorage.removeItem(key);
async function derive(password, salt) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 210000, hash: 'SHA-256' }, material, 256);
  return Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
}
export async function register({ name, email, password }) {
  name = name.trim(); email = email.trim().toLowerCase();
  if (!name || name.length > 80) throw new Error('Enter a name between 1 and 80 characters.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  if (password.length < 8) throw new Error('Use at least 8 characters for your demo passphrase.');
  const salt = crypto.randomUUID(), hash = await derive(password, salt);
  const { value } = await mutate(state => {
    if (state.users.some(u => u.email === email)) throw new Error('A local demo profile already uses this email. Try signing in.');
    const user = { id: crypto.randomUUID(), name, email, salt, hash, role: 'USER', status: 'ACTIVE', preferences: { styles: '', colors: '', occasions: '', fit: 'No preference' }, onboarded: false, createdAt: new Date().toISOString() };
    state.users.push(user); return user.id;
  });
  sessionStorage.setItem(key, value); return value;
}
export async function login({ email, password }) {
  const state = await readState();
  const user = state.users.find(u => u.email === email.trim().toLowerCase());
  if (!user || await derive(password, user.salt) !== user.hash) throw new Error('Email or demo passphrase is incorrect.');
  if (user.status !== 'ACTIVE') throw new Error('This local demo account is suspended.');
  sessionStorage.setItem(key, user.id); return user.id;
}
export async function openAdminDemo() {
  const { value } = await mutate(state => {
    let admin = state.users.find(u => u.demoAdmin);
    if (!admin) { admin = { id: crypto.randomUUID(), name: 'Demo administrator', email: 'admin@studio.local', role: 'ADMIN', status: 'ACTIVE', demoAdmin: true, onboarded: true, preferences: {}, createdAt: new Date().toISOString() }; state.users.push(admin); }
    return admin.id;
  });
  sessionStorage.setItem(key, value); return value;
}
