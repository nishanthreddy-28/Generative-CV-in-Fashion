import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  Eye, EyeOff, Check, X, ArrowRight, Shield, Star,
  Zap, Brain, Shirt,
} from 'lucide-react';

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

function FloatingInput({ label, type = 'text', value, onChange, required, children }) {
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
      {children && <div className="absolute right-3 top-1/2 -translate-y-1/2">{children}</div>}
    </div>
  );
}

function Req({ met, label }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`h-4 w-4 rounded-full flex items-center justify-center border transition-all duration-300 ${
        met ? 'bg-emerald-50 border-emerald-400 text-emerald-600' : 'border-espresso/12 text-espresso/20'
      }`}>
        {met ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
      </div>
      <span className={`text-[11px] transition-colors ${met ? 'text-espresso/70' : 'text-espresso/35'}`}>{label}</span>
    </div>
  );
}

const PERKS = [
  { icon: Zap,   label: 'Virtual Try-On',     desc: 'See any outfit on your body before buying' },
  { icon: Brain, label: 'AI Recommendations', desc: 'Personalised to your body & colour season' },
  { icon: Shirt, label: 'Smart Wardrobe',       desc: 'AI auto-tags every piece — zero manual entry' },
];

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp, signInWithGoogle, signInWithApple, updateUserProfile, isDemoMode } = useAuth();
  const navigate = useNavigate();

  const reqMinLength         = password.length >= 6;
  const reqHasUppercase      = /[A-Z]/.test(password);
  const reqHasNumberOrSymbol = /[0-9\W]/.test(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reqMinLength) {
      toast.error('Password must be at least 6 characters.', { style: { background: '#FAF7F2', color: '#1A1412', borderRadius: '12px' } });
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password);
      if (name.trim()) await updateUserProfile({ displayName: name.trim() });
      navigate('/dashboard');
    } catch (error) {
      let message = 'Signup failed. Please try again.';
      if (error.code === 'auth/email-already-in-use') message = 'An account with this email already exists.';
      if (error.code === 'auth/weak-password')         message = 'Password is too weak. Use at least 6 characters.';
      if (error.code === 'auth/invalid-email')          message = 'Invalid email address.';
      toast.error(message, { style: { background: '#FAF7F2', color: '#1A1412', borderRadius: '12px' } });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try { await signInWithGoogle(); navigate('/dashboard'); }
    catch (error) {
      if (error.code !== 'auth/popup-closed-by-user')
        toast.error('Google sign-up failed.', { style: { background: '#FAF7F2', color: '#1A1412', borderRadius: '12px' } });
    }
  };

  const handleApple = async () => {
    try { await signInWithApple(); navigate('/dashboard'); }
    catch (error) {
      if (error.code !== 'auth/popup-closed-by-user')
        toast.error('Apple sign-up failed.', { style: { background: '#FAF7F2', color: '#1A1412', borderRadius: '12px' } });
    }
  };

  return (
    <div className="flex min-h-screen bg-cream text-espresso overflow-hidden">

      {/* ── LEFT — Pink dress editorial ─────────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col">
        <div className="absolute inset-0">
          <img
            src="/images/pink_dress_field.png"
            alt="Fashion editorial"
            className="w-full h-full object-cover object-[center_20%]"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-espresso/50 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-espresso/70 via-transparent to-espresso/20" />
          <div className="absolute inset-0 grain" />
        </div>

        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">
          <div className="flex items-center justify-between">
            <Link to="/" className="font-serif italic text-2xl text-cream hover:text-cream/80 transition-colors">
              Drape&amp;Drop
            </Link>
            <span className="text-[10px] uppercase tracking-[0.2em] text-cream/60 bg-cream/10 backdrop-blur-sm px-3 py-1.5 rounded-full border border-cream/15">
              Free forever
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-center max-w-md space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <p className="text-[11px] uppercase tracking-[0.25em] text-cream/50 mb-4">Join the movement</p>
              <h2 className="font-editorial text-5xl xl:text-6xl font-light text-cream leading-[1.05]">
                Start looking your<br />
                <span className="italic">best, today.</span>
              </h2>
              <p className="mt-4 text-sm text-cream/55 font-light leading-relaxed">
                Your AI personal stylist. Free to start, no credit card required.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="bg-cream/10 backdrop-blur-xl border border-cream/15 rounded-2xl p-6 space-y-5"
            >
              <p className="text-sm font-medium text-cream">What you get on Day 1</p>
              {PERKS.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex items-start gap-3.5">
                  <div className="h-8 w-8 rounded-xl bg-cream/10 border border-cream/15 flex items-center justify-center shrink-0">
                    <Icon className="h-3.5 w-3.5 text-cream" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-cream">{label}</p>
                    <p className="text-[11px] text-cream/50 font-light mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="grid grid-cols-3 gap-3"
            >
              {[
                { v: '50K+', l: 'Users' },
                { v: '4.9★', l: 'Rated' },
                { v: '94%', l: 'Less returns' },
              ].map(({ v, l }) => (
                <div key={l} className="bg-cream/10 backdrop-blur-sm border border-cream/10 rounded-xl p-3 text-center">
                  <p className="text-cream font-medium text-sm">{v}</p>
                  <p className="text-cream/45 text-[10px] font-light mt-0.5">{l}</p>
                </div>
              ))}
            </motion.div>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-cream/40 font-light">
            <p>© 2026 Drape&amp;Drop</p>
            <span className="h-3 w-px bg-cream/15" />
            <Link to="/" className="hover:text-cream/70 transition-colors">Privacy</Link>
            <span className="h-3 w-px bg-cream/15" />
            <Link to="/" className="hover:text-cream/70 transition-colors">Terms</Link>
          </div>
        </div>
      </div>

      {/* ── RIGHT — Sign up form ────────────────────────────────── */}
      <div className="w-full lg:w-[48%] flex flex-col min-h-screen">
        <div className="lg:hidden relative h-48 overflow-hidden shrink-0">
          <img src="/images/pink_dress_field.png" alt="" className="w-full h-full object-cover object-[center_20%]" />
          <div className="absolute inset-0 bg-espresso/35" />
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
              <h1 className="font-editorial text-4xl font-light text-espresso tracking-tight">
                Create your account
              </h1>
              <p className="text-sm text-espresso/50 font-light mt-2">
                Already have an account?{' '}
                <Link to="/login" className="text-espresso underline underline-offset-4 decoration-espresso/25 hover:decoration-espresso transition-colors">
                  Sign in
                </Link>
              </p>
            </div>

            {isDemoMode && (
              <div className="mb-6 p-4 bg-ivory border border-espresso/10 rounded-xl text-xs text-espresso/60">
                <span className="font-semibold text-espresso block mb-1">Demo Mode Active</span>
                <p className="font-light">Any details you register will instantly sign you in using mock sessions.</p>
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
              <span className="text-[11px] text-espresso/35 uppercase tracking-widest">or with email</span>
              <div className="flex-1 h-px bg-espresso/10" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <FloatingInput label="Full name" type="text" value={name} onChange={e => setName(e.target.value)} required />
              <FloatingInput label="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              <FloatingInput
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              >
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-espresso/30 hover:text-espresso/60 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </FloatingInput>

              {password && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-4 bg-ivory border border-espresso/8 rounded-xl space-y-2 overflow-hidden"
                >
                  <p className="text-[10px] font-medium text-espresso/40 uppercase tracking-widest mb-1">Password strength</p>
                  <div className="flex gap-1 mb-2">
                    {[reqMinLength, reqHasUppercase, reqHasNumberOrSymbol].map((met, i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-500 ${met ? 'bg-emerald-500' : 'bg-espresso/10'}`} />
                    ))}
                  </div>
                  <Req met={reqMinLength}         label="At least 6 characters" />
                  <Req met={reqHasUppercase}      label="Contains an uppercase letter" />
                  <Req met={reqHasNumberOrSymbol} label="Contains a number or symbol" />
                </motion.div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-full bg-espresso hover:bg-espresso/90 text-cream font-medium text-sm transition-all duration-200 shadow-editorial hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group mt-2"
              >
                {loading ? (
                  <><div className="h-4 w-4 rounded-full border-2 border-cream/20 border-t-cream animate-spin" /> Creating account…</>
                ) : (
                  <>Create account <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>
                )}
              </button>

              <p className="text-[11px] text-espresso/40 font-light text-center leading-relaxed pt-2">
                By creating an account you agree to our{' '}
                <a href="#" className="text-espresso/60 hover:text-espresso underline underline-offset-2">Terms</a>
                {' '}and{' '}
                <a href="#" className="text-espresso/60 hover:text-espresso underline underline-offset-2">Privacy Policy</a>.
              </p>
            </form>

            <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-espresso/35">
              <Shield className="h-3 w-3" />
              <span>256-bit encryption · SOC 2 · Zero data selling</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
