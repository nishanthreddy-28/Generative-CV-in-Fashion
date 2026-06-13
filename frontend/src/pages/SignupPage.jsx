import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { ShoppingBag, ArrowRight } from 'lucide-react';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const triggerConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#4f46e5', '#8b5cf6', '#ec4899', '#f59e0b']
    });
  };

  const handleError = (error, provider) => {
    if (error.code === 'auth/api-key-not-valid' || error.message.includes('API_KEY')) {
      toast.error('Firebase API Key is invalid or missing. Please check your .env file.', { duration: 5000 });
    } else {
      toast.error(`Failed to sign up with ${provider}: ${error.message}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signUp(email, password);
      triggerConfetti();
      toast.success('Account created successfully!');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (error) {
      handleError(error, 'Email');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignIn = async (providerName) => {
    if (providerName === 'Google') {
      try {
        await signInWithGoogle();
        triggerConfetti();
        toast.success('Signed in with Google!');
        setTimeout(() => navigate('/dashboard'), 1500);
      } catch (error) {
        handleError(error, 'Google');
      }
    } else {
      toast.error(`${providerName} signup is not configured yet.`);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Right Image Section (Flipped for Signup) */}
      <div className="hidden lg:relative lg:block lg:w-1/2">
        <div className="absolute inset-0 bg-zinc-900">
          <img 
            src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=2940&auto=format&fit=crop" 
            alt="Fashion runway" 
            className="absolute inset-0 h-full w-full object-cover opacity-80 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/90 via-zinc-900/40 to-transparent" />
        </div>
        
        <div className="absolute top-0 left-0 right-0 p-16 xl:p-24">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <blockquote className="space-y-6">
              <p className="text-3xl font-medium leading-relaxed text-white">
                "Join thousands of users who have revolutionized their style with our AI-powered virtual wardrobe."
              </p>
              <footer className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full border-2 border-white/20 overflow-hidden">
                  <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=250&auto=format&fit=crop" alt="User avatar" className="h-full w-full object-cover" />
                </div>
                <div>
                  <div className="text-base font-semibold text-white">Marcus Chen</div>
                  <div className="text-sm text-zinc-400">Personal Stylist</div>
                </div>
              </footer>
            </blockquote>
          </motion.div>
        </div>
      </div>

      {/* Form Section */}
      <div className="flex w-full flex-col justify-center px-4 sm:px-6 lg:w-1/2 lg:px-20 xl:px-32">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto w-full max-w-sm lg:w-[400px]"
        >
          <div className="mb-10 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <ShoppingBag className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xl font-bold tracking-tight">Drape & Drop</span>
          </div>

          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">Create an account</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-primary transition-colors hover:text-primary/80">
                Log in here
              </Link>
            </p>
          </div>

          <div className="mt-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Email</label>
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 rounded-lg bg-muted/50 transition-colors focus:bg-background"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Password</label>
                  <Input
                    type="password"
                    placeholder="Create a password (min 6 chars)"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 rounded-lg bg-muted/50 transition-colors focus:bg-background"
                  />
                </div>
              </div>

              <Button type="submit" className="h-11 w-full rounded-lg text-base font-medium shadow-md shadow-primary/20" disabled={loading}>
                {loading ? 'Creating account...' : 'Create account'}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </form>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              By clicking "Create account", you agree to our{' '}
              <a href="#" className="underline underline-offset-2 hover:text-foreground">Terms of Service</a> and{' '}
              <a href="#" className="underline underline-offset-2 hover:text-foreground">Privacy Policy</a>.
            </p>

            <div className="mt-8 relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-background px-4 text-muted-foreground">Or sign up with</span>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <Button type="button" variant="outline" className="h-11 rounded-lg border-border hover:bg-muted" onClick={() => handleSocialSignIn('Google')}>
                <GoogleIcon className="mr-2 h-5 w-5" />
                Google
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-lg border-border hover:bg-muted" onClick={() => handleSocialSignIn('Apple')}>
                <AppleIcon className="mr-2 h-5 w-5" />
                Apple
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-lg border-border hover:bg-muted" onClick={() => handleSocialSignIn('GitHub')}>
                <GithubIcon className="mr-2 h-5 w-5" />
                GitHub
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-lg border-border hover:bg-muted" onClick={() => handleSocialSignIn('Microsoft')}>
                <MicrosoftIcon className="mr-2 h-5 w-5" />
                Microsoft
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// Icons
function GoogleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

function AppleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.05 2.53.8 3.29.8.74 0 2.18-.9 3.8-.75 1.39.11 2.65.68 3.51 1.69-2.83 1.62-2.38 5.68.42 6.78-1.02 2.6-2.18 3.65-3.02 4.45zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.37-1.92 4.29-3.74 4.25z" />
    </svg>
  );
}

function GithubIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.022A9.606 9.606 0 0112 6.82c.85.004 1.705.114 2.504.336 1.909-1.29 2.747-1.022 2.747-1.022.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

function MicrosoftIcon(props) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path fill="#f35325" d="M1.5 1.5h10v10h-10z" />
      <path fill="#81bc06" d="M12.5 1.5h10v10h-10z" />
      <path fill="#05a6f0" d="M1.5 12.5h10v10h-10z" />
      <path fill="#ffba08" d="M12.5 12.5h10v10h-10z" />
    </svg>
  );
}
