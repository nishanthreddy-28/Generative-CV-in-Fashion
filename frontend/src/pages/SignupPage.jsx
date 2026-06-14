import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Check, X } from 'lucide-react';

// Inline SVG icons for Google and Apple
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-2.11 4.45-3.74 4.25z" fill="#000000"/>
    </svg>
  );
}

// Password strength checker
function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500' };
  if (score <= 2) return { score: 2, label: 'Fair', color: 'bg-orange-500' };
  if (score <= 3) return { score: 3, label: 'Good', color: 'bg-yellow-500' };
  if (score <= 4) return { score: 4, label: 'Strong', color: 'bg-green-500' };
  return { score: 5, label: 'Very Strong', color: 'bg-emerald-500' };
}

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp, signInWithGoogle, signInWithApple, updateUserProfile, isDemoMode } = useAuth();
  const navigate = useNavigate();

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.', {
        style: { background: '#000', color: '#fff', borderRadius: '0' }
      });
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password);
      // Update display name after account creation
      if (name.trim()) {
        await updateUserProfile({ displayName: name.trim() });
      }
      navigate('/dashboard');
    } catch (error) {
      let message = 'Signup failed. Please try again.';
      if (error.code === 'auth/email-already-in-use') message = 'An account with this email already exists.';
      if (error.code === 'auth/weak-password') message = 'Password is too weak. Use at least 6 characters.';
      if (error.code === 'auth/invalid-email') message = 'Invalid email address.';
      toast.error(message, {
        style: { background: '#000', color: '#fff', borderRadius: '0' }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      await signInWithGoogle();
      navigate('/dashboard');
    } catch (error) {
      if (error.code !== 'auth/popup-closed-by-user') {
        toast.error('Google sign-up failed.', {
          style: { background: '#000', color: '#fff', borderRadius: '0' }
        });
      }
    }
  };

  const handleApple = async () => {
    try {
      await signInWithApple();
      navigate('/dashboard');
    } catch (error) {
      if (error.code !== 'auth/popup-closed-by-user') {
        toast.error('Apple sign-up failed.', {
          style: { background: '#000', color: '#fff', borderRadius: '0' }
        });
      }
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Left Panel — Editorial Image */}
      <div className="hidden lg:flex lg:w-1/2 bg-neutral-100 items-center justify-center relative overflow-hidden p-12">
        <img 
          src="/images/hero_fashion_2.png" 
          alt="Editorial fashion photography" 
          className="w-full h-full object-cover absolute inset-0 opacity-80"
        />
        <div className="relative z-10 text-center bg-white/80 backdrop-blur-sm p-12 border border-white">
          <h2 className="text-3xl font-light text-black font-display tracking-tight mb-4">Join the vanguard.</h2>
          <p className="text-sm text-neutral-600">Elevate your personal aesthetic and build your digital closet.</p>
        </div>
      </div>

      {/* Right Panel — Form */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center p-8">
        <div className="w-full max-w-[400px]">
          <h1 className="text-2xl font-medium text-black mb-2">Create Account</h1>
          <p className="text-sm text-neutral-500 mb-6">
            Already have an account? <Link to="/login" className="text-black underline underline-offset-4 hover:text-neutral-600 transition-colors">Sign in</Link>
          </p>
          
          {isDemoMode && (
            <div className="mb-6 p-4 bg-neutral-50 border border-neutral-200 text-xs text-neutral-600 rounded">
              <span className="font-semibold text-black block mb-1">✨ Demo Mode Active</span>
              Firebase is in demo mode. Any details you register will instantly sign you in using mock sessions.
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-medium text-black uppercase tracking-widest mb-2">Name</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                required
                placeholder="Enter your full name"
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 text-sm focus:border-black outline-none transition-all duration-200 placeholder:text-neutral-400" 
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-black uppercase tracking-widest mb-2">Email</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required
                placeholder="Enter your email address"
                className="w-full px-4 py-3 bg-neutral-50 border border-neutral-200 text-sm focus:border-black outline-none transition-all duration-200 placeholder:text-neutral-400" 
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-black uppercase tracking-widest mb-2">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required
                  placeholder="Create a strong password"
                  className="w-full px-4 py-3 pr-12 bg-neutral-50 border border-neutral-200 text-sm focus:border-black outline-none transition-all duration-200 placeholder:text-neutral-400" 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {password && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                          level <= passwordStrength.score ? passwordStrength.color : 'bg-neutral-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-neutral-500">{passwordStrength.label}</p>
                </div>
              )}
            </div>
            <Button type="submit" disabled={loading} className="w-full h-12">
              {loading ? 'Creating...' : 'Create Account'}
            </Button>
          </form>

          {/* Separator */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-neutral-200" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-4 text-xs text-neutral-400 uppercase tracking-widest">or</span></div>
          </div>

          {/* Social Auth Stack */}
          <div className="space-y-3">
            <button 
              onClick={handleGoogle} 
              className="w-full h-12 flex items-center justify-center gap-3 bg-white border border-neutral-200 text-sm font-medium text-black hover:bg-neutral-50 transition-all duration-200 hover:border-neutral-300"
            >
              <GoogleIcon />
              Continue with Google
            </button>
            <button 
              onClick={handleApple} 
              className="w-full h-12 flex items-center justify-center gap-3 bg-white border border-neutral-200 text-sm font-medium text-black hover:bg-neutral-50 transition-all duration-200 hover:border-neutral-300"
            >
              <AppleIcon />
              Continue with Apple
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
