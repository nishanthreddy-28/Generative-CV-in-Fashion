import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../ui/Button';
import { Search, Bell, Settings, LogOut, LayoutDashboard, Shirt, Sparkles, Sun, Moon } from 'lucide-react';

export function Navbar({ showNavLinks = false, heroVariant = 'dark' }) {
  const [scrolled, setScrolled] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const isLanding = location.pathname === '/';
  const isWarmHero = heroVariant === 'warm' && isLanding;
  const isTransparent = isLanding && !scrolled;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showProfileMenu && !e.target.closest('[data-profile-menu]')) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Wardrobe', path: '/wardrobe', icon: Shirt },
    { name: 'AI Stylist', path: '/ai-stylist', icon: Sparkles },
  ];

  const linkClass = (extra = '') => {
    if (isTransparent && isWarmHero) {
      return `text-sm font-light text-espresso/60 hover:text-espresso transition-colors duration-300 ${extra}`;
    }
    if (isTransparent) {
      return `text-sm font-light text-neutral-300 hover:text-white transition-colors duration-300 ${extra}`;
    }
    return `text-sm font-light text-espresso/55 hover:text-espresso dark:text-neutral-400 dark:hover:text-white transition-colors duration-300 ${extra}`;
  };

  const iconBtnClass = () => {
    if (isTransparent && isWarmHero) {
      return 'text-espresso/50 hover:text-espresso hover:bg-espresso/5';
    }
    if (isTransparent) {
      return 'text-neutral-300 hover:text-white hover:bg-white/10';
    }
    return 'text-espresso/50 hover:text-espresso dark:text-neutral-400 dark:hover:text-white hover:bg-espresso/5 dark:hover:bg-neutral-900';
  };

  const logoClass = () => {
    if (isTransparent && isWarmHero) return 'text-espresso hover:text-espresso/70';
    if (isTransparent) return 'text-white hover:text-neutral-200';
    return 'text-espresso dark:text-white hover:text-espresso/70 dark:hover:text-neutral-300';
  };

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 border-b ${
        scrolled
          ? isWarmHero
            ? 'bg-cream/90 backdrop-blur-xl border-espresso/10 shadow-sm'
            : 'bg-white/80 dark:bg-black/80 backdrop-blur-md border-neutral-200 dark:border-neutral-800 shadow-sm'
          : 'bg-transparent border-transparent'
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <span className={`text-xl font-serif italic font-normal tracking-wide transition-colors duration-300 ${logoClass()}`}>
              Drape&Drop
            </span>
          </Link>

          {showNavLinks && (
            <div className="hidden md:flex items-center gap-8">
              {!user && isLanding ? (
                <>
                  <a href="#features" className={linkClass()}>Features</a>
                  <a href="#how-it-works" className={linkClass()}>How it works</a>
                  <a href="#pricing" className={linkClass()}>Pricing</a>
                </>
              ) : (
                navLinks.map((link) => {
                  const isActive = location.pathname === link.path;
                  return (
                    <Link
                      key={link.name}
                      to={link.path}
                      className={`text-sm font-medium transition-colors ${
                        isActive ? 'text-espresso dark:text-white' : 'text-espresso/50 hover:text-espresso dark:text-neutral-500 dark:hover:text-white'
                      }`}
                    >
                      {link.name}
                    </Link>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button className={`flex items-center justify-center h-9 w-9 rounded-full transition-colors ${iconBtnClass()}`}>
            <Search className="h-4 w-4" />
          </button>

          <button
            onClick={toggleTheme}
            className={`flex items-center justify-center h-9 w-9 rounded-full transition-colors ${iconBtnClass()}`}
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {user ? (
            <div className="flex items-center gap-3">
              <button className={`relative flex items-center justify-center h-9 w-9 rounded-full transition-colors ${iconBtnClass()}`}>
                <Bell className="h-4 w-4" />
                <span className={`absolute top-2 right-2.5 h-1.5 w-1.5 rounded-full ${
                  isTransparent && !isWarmHero ? 'bg-white' : 'bg-espresso dark:bg-white'
                }`} />
              </button>

              <div className="relative" data-profile-menu>
                <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="flex items-center gap-2 focus:outline-none">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium border ${
                    isTransparent && !isWarmHero
                      ? 'bg-white/10 text-white border-white/20'
                      : 'bg-espresso/8 text-espresso border-espresso/15 dark:bg-neutral-800 dark:text-white dark:border-neutral-700'
                  }`}>
                    {user.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </button>

                <AnimatePresence>
                  {showProfileMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-48 rounded-xl border border-espresso/10 dark:border-neutral-800 bg-cream dark:bg-neutral-900 p-1 shadow-editorial"
                    >
                      <div className="px-2 py-2 border-b border-espresso/8 dark:border-neutral-800 mb-1">
                        <p className="text-sm font-medium text-espresso dark:text-white truncate">{user.displayName || 'User'}</p>
                        <p className="text-xs text-espresso/50 dark:text-neutral-400 truncate">{user.email}</p>
                      </div>
                      <Link to="/settings" className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-espresso/60 dark:text-neutral-400 hover:text-espresso dark:hover:text-white hover:bg-espresso/5 dark:hover:bg-neutral-800 rounded-lg">
                        <Settings className="h-4 w-4" />
                        Settings
                      </Link>
                      <button
                        onClick={signOut}
                        className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-espresso/60 dark:text-neutral-400 hover:text-espresso dark:hover:text-white hover:bg-espresso/5 dark:hover:bg-neutral-800 rounded-lg"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Link to="/login" className={linkClass('hidden sm:block')}>
                Sign in
              </Link>
              <Link to="/signup">
                <Button
                  size="sm"
                  className={`rounded-full px-5 h-9 font-medium transition-all border-none ${
                    isTransparent && isWarmHero
                      ? 'bg-espresso hover:bg-espresso/90 text-cream shadow-editorial'
                      : isTransparent
                        ? 'bg-white hover:bg-neutral-100 text-black shadow-md shadow-white/5'
                        : 'bg-espresso hover:bg-espresso/90 text-cream dark:bg-white dark:hover:bg-neutral-100 dark:text-black'
                  }`}
                >
                  Get started
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </motion.nav>
  );
}
