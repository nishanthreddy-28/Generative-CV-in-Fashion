import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  auth, 
  googleProvider, 
  appleProvider,
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signOut as firebaseSignOut,
  updateProfile
} from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const isDemoMode = !apiKey || apiKey === 'your_api_key_here' || apiKey === 'dummy-api-key' || apiKey.includes('placeholder');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemoMode) {
      console.log('[Auth] Running in Demo Bypass Mode (Firebase API Key is a placeholder)');
      const cached = localStorage.getItem('drape_drop_demo_user');
      if (cached) {
        try {
          setUser(JSON.parse(cached));
        } catch (e) {
          localStorage.removeItem('drape_drop_demo_user');
        }
      }
      setLoading(false);
    } else {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setLoading(false);
      });
      return unsubscribe;
    }
  }, []);

  const signInWithGoogle = () => {
    if (isDemoMode) {
      return new Promise((resolve) => {
        const mockUser = {
          uid: 'mock-google-uid',
          displayName: 'Sarah Jenkins',
          email: 'sarah.j@drapedrop.ai',
          photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
          providerId: 'google.com'
        };
        localStorage.setItem('drape_drop_demo_user', JSON.stringify(mockUser));
        setUser(mockUser);
        resolve(mockUser);
      });
    }
    return signInWithPopup(auth, googleProvider);
  };

  const signInWithApple = () => {
    if (isDemoMode) {
      return new Promise((resolve) => {
        const mockUser = {
          uid: 'mock-apple-uid',
          displayName: 'Alexander Vance',
          email: 'alex.vance@icloud.com',
          photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=256',
          providerId: 'apple.com'
        };
        localStorage.setItem('drape_drop_demo_user', JSON.stringify(mockUser));
        setUser(mockUser);
        resolve(mockUser);
      });
    }
    return signInWithPopup(auth, appleProvider);
  };

  const signIn = (email, password) => {
    if (isDemoMode) {
      return new Promise((resolve) => {
        const displayName = email.split('@')[0];
        const formattedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
        const mockUser = {
          uid: 'mock-email-uid-' + email.replace(/[^a-zA-Z0-9]/g, ''),
          displayName: formattedName,
          email: email,
          photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
          providerId: 'password'
        };
        localStorage.setItem('drape_drop_demo_user', JSON.stringify(mockUser));
        setUser(mockUser);
        resolve(mockUser);
      });
    }
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = (email, password) => {
    if (isDemoMode) {
      return new Promise((resolve) => {
        const displayName = email.split('@')[0];
        const formattedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
        const mockUser = {
          uid: 'mock-email-uid-' + email.replace(/[^a-zA-Z0-9]/g, ''),
          displayName: formattedName,
          email: email,
          photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
          providerId: 'password'
        };
        localStorage.setItem('drape_drop_demo_user', JSON.stringify(mockUser));
        setUser(mockUser);
        resolve(mockUser);
      });
    }
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const updateUserProfile = (profileData) => {
    if (isDemoMode) {
      return new Promise((resolve) => {
        const updated = { ...user, ...profileData };
        localStorage.setItem('drape_drop_demo_user', JSON.stringify(updated));
        setUser(updated);
        resolve(updated);
      });
    }
    return updateProfile(auth.currentUser, profileData);
  };

  const resetPassword = (email) => {
    if (isDemoMode) {
      return Promise.resolve();
    }
    return sendPasswordResetEmail(auth, email);
  };

  const signOut = () => {
    if (isDemoMode) {
      localStorage.removeItem('drape_drop_demo_user');
      setUser(null);
      return Promise.resolve();
    }
    return firebaseSignOut(auth);
  };

  const value = {
    user,
    loading,
    isDemoMode,
    signInWithGoogle,
    signInWithApple,
    signIn,
    signUp,
    updateUserProfile,
    resetPassword,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

