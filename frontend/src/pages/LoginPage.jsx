import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-2.11 4.45-3.74 4.25z"/>
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signInWithGoogle, signInWithApple, isDemoMode } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch {
      toast.error('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      {/* Fashion image panel */}
      <div className="hidden lg:block relative">
        <img src="/images/yellow_sunglasses.png" alt="" className="absolute inset-0 w-full h-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12">
          <p className="font-editorial text-3xl text-white font-light italic leading-tight">
            Dress with intention.
          </p>
          <p className="text-white/60 text-sm mt-3 font-light">50,000+ wardrobes styled with AI.</p>
        </div>
      </div>

      {/* Auth form */}
      <div className="flex flex-col min-h-screen px-6 sm:px-12 py-8">
        <div className="flex items-center justify-between">
          <Link to="/" className="font-editorial italic text-xl text-black">Drape&Drop</Link>
          <Link to="/signup" className="text-sm text-neutral-500 hover:text-black">Create account →</Link>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-[400px]">
            <div className="rounded-2xl border border-black/10 bg-white p-8 shadow-card">
              <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
              <p className="text-sm text-neutral-500 mt-1 mb-8">Sign in to your account</p>

              {isDemoMode && (
                <button type="button" onClick={() => { setEmail('sarah.j@drapedrop.ai'); setPassword('demo1234'); }}
                  className="w-full mb-4 text-xs text-neutral-600 border border-black/10 rounded-xl py-2.5 hover:bg-neutral-50">
                  Auto-fill demo credentials
                </button>
              )}

              <div className="space-y-3 mb-6">
                <button type="button" onClick={() => signInWithGoogle().then(() => navigate('/dashboard')).catch(() => {})}
                  className="w-full h-11 flex items-center justify-center gap-3 bg-white border border-black/10 rounded-xl text-sm font-medium hover:bg-neutral-50 shadow-card">
                  <GoogleIcon /> Continue with Google
                </button>
                <button type="button" onClick={() => signInWithApple().then(() => navigate('/dashboard')).catch(() => {})}
                  className="w-full h-11 flex items-center justify-center gap-3 bg-black text-white rounded-xl text-sm font-medium hover:bg-black/90">
                  <AppleIcon /> Continue with Apple
                </button>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-black/10" /><span className="text-xs text-neutral-400">or</span><div className="flex-1 h-px bg-black/10" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-neutral-500 mb-1.5 block">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                    className="w-full h-11 px-4 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/30" />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-500 mb-1.5 block">Password</label>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required
                      className="w-full h-11 px-4 pr-11 rounded-xl border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-black/30" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Link to="/forgot-password" className="text-xs text-neutral-500 hover:text-black">Forgot password?</Link>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full h-11 bg-black text-white rounded-xl text-sm font-medium hover:bg-black/90 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? 'Signing in…' : <>Sign in <ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
