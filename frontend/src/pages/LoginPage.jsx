import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Eye, EyeOff, ArrowRight, ChevronRight, Shield, Star } from 'lucide-react';

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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-2.11 4.45-3.74 4.25z"/>
    </svg>
  );
}

function FloatingField({ label, type = 'text', value, onChange, required, children }) {
  const [focused, setFocused] = useState(false);
  const lifted = focused || value.length > 0;

  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required}
        placeholder=""
        className={`w-full px-4 pt-6 pb-2.5 bg-ivory border rounded-xl text-sm text-espresso focus:outline-none transition-all duration-200 ${
          children ? 'pr-12' : ''
        } ${
          focused
            ? 'border-espresso/30 shadow-[0_0_0_3px_rgba(26,20,18,0.04)] bg-white'
            : 'border-espresso/10 hover:border-espresso/20'
        }`}
      />
      <label className={`absolute left-4 pointer-events-none transition-all duration-200 ${
        lifted ? 'top-2 text-[10px] text-espresso/40 tracking-widest uppercase' : 'top-4 text-sm text-espresso/35'
      }`}>
        {label}
      </label>
      {children}
    </div>
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
    } catch (err) {
      let msg = 'Invalid email or password.';
      if (err.code === 'auth/user-not-found')   msg = 'No account found with this email.';
      if (err.code === 'auth/wrong-password')    msg = 'Incorrect password.';
      if (err.code === 'auth/too-many-requests') msg = 'Too many attempts. Try again later.';
      toast.error(msg, { style: { background: '#FAF7F2', color: '#1A1412', borderRadius: '14px', border: '1px solid #E8E0D8' } });
    } finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    try { await signInWithGoogle(); navigate('/dashboard'); }
    catch (err) {
      if (err.code !== 'auth/popup-closed-by-user')
        toast.error('Google sign-in failed.', { style: { background: '#FAF7F2', color: '#1A1412', borderRadius: '14px' } });
    }
  };

  const handleApple = async () => {
    try { await signInWithApple(); navigate('/dashboard'); }
    catch (err) {
      if (err.code !== 'auth/popup-closed-by-user')
        toast.error('Apple sign-in failed.', { style: { background: '#FAF7F2', color: '#1A1412', borderRadius: '14px' } });
    }
  };

  return (
    <div className="flex min-h-screen bg-cream text-espresso overflow-hidden">

      {/* ── LEFT — Editorial panel ──────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col">
        <div className="absolute inset-0">
          <img
            src="/images/sunlight_lady.png"
            alt="Fashion editorial"
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-espresso/60 via-espresso/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-espresso/80 via-transparent to-espresso/30" />
          <div className="absolute inset-0 grain" />
        </div>

        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">
          <Link to="/" className="font-serif italic text-2xl text-cream hover:text-cream/80 transition-colors w-fit">
            Drape&amp;Drop
          </Link>

          <div className="flex-1 flex flex-col justify-end pb-8 max-w-md space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="text-[11px] uppercase tracking-[0.25em] text-cream/50 mb-4">Welcome back</p>
              <h2 className="font-editorial text-5xl xl:text-6xl font-light text-cream leading-[1.05]">
                Style is<br />
                <span className="italic">a language.</span>
              </h2>
              <p className="mt-4 text-sm text-cream/55 font-light leading-relaxed">
                Pick up where you left off — your wardrobe, outfits, and AI stylist are waiting.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="bg-cream/10 backdrop-blur-xl border border-cream/15 rounded-2xl p-5"
            >
              <div className="flex gap-0.5 mb-2">
                {[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-wheat text-wheat" />)}
              </div>
              <p className="text-cream/75 text-sm font-light leading-relaxed italic">
                "Returned only 2 items last year — down from 22. The AI actually gets my style."
              </p>
              <p className="text-cream/40 text-xs mt-2 font-light">— Aanya S., Mumbai</p>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── RIGHT — Form panel ──────────────────────────────────── */}
      <div className="w-full lg:w-[48%] flex flex-col min-h-screen">
        {/* Mobile hero strip */}
        <div className="lg:hidden relative h-48 overflow-hidden shrink-0">
          <img src="/images/sunlight_lady.png" alt="" className="w-full h-full object-cover object-top" />
          <div className="absolute inset-0 bg-espresso/40" />
          <Link to="/" className="absolute top-6 left-6 font-serif italic text-xl text-cream">Drape&amp;Drop</Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 sm:px-12 py-12 lg:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[420px]"
          >
            <div className="mb-8">
              <h1 className="font-editorial text-4xl font-light text-espresso tracking-tight">Sign in</h1>
              <p className="text-sm text-espresso/50 font-light mt-2">
                New here?{' '}
                <Link to="/signup" className="text-espresso underline underline-offset-4 decoration-espresso/25 hover:decoration-espresso transition-colors">
                  Create a free account
                </Link>
              </p>
            </div>

            {isDemoMode && (
              <div className="mb-6 p-4 bg-ivory border border-espresso/10 rounded-xl text-xs text-espresso/60 space-y-1.5">
                <span className="font-semibold text-espresso block">Demo Mode</span>
                <button
                  onClick={() => { setEmail('sarah.j@drapedrop.ai'); setPassword('demo1234'); }}
                  className="text-espresso/70 hover:text-espresso underline underline-offset-2 flex items-center gap-0.5 transition-colors"
                >
                  Auto-fill credentials <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}

            <div className="space-y-3 mb-6">
              <button
                onClick={handleGoogle}
                type="button"
                className="w-full h-12 flex items-center justify-center gap-3 bg-espresso hover:bg-espresso/90 text-cream text-sm font-medium rounded-full transition-all duration-200 hover:-translate-y-0.5 shadow-editorial"
              >
                <GoogleIcon />
                Continue with Google
              </button>
              <button
                onClick={handleApple}
                type="button"
                className="w-full h-12 flex items-center justify-center gap-3 bg-ivory hover:bg-white border border-espresso/12 text-espresso text-sm font-medium rounded-full transition-all duration-200"
              >
                <AppleIcon />
                Continue with Apple
              </button>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-espresso/10" />
              <span className="text-[11px] text-espresso/35 uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-espresso/10" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <FloatingField
                label="Email address"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />

              <FloatingField
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              >
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-espresso/30 hover:text-espresso/60 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </FloatingField>

              <div className="flex justify-end pt-1">
                <Link to="/forgot-password" className="text-xs text-espresso/40 hover:text-espresso/70 transition-colors">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-full bg-espresso hover:bg-espresso/90 text-cream font-medium text-sm transition-all duration-200 shadow-editorial hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group mt-2"
              >
                {loading ? (
                  <><div className="h-4 w-4 rounded-full border-2 border-cream/20 border-t-cream animate-spin" /> Signing in…</>
                ) : (
                  <>Sign in <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>
                )}
              </button>
            </form>

            <div className="mt-8 flex items-center justify-center gap-1.5 text-[11px] text-espresso/35">
              <Shield className="h-3 w-3" />
              <span>Encrypted · SOC 2 · Zero data selling</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
