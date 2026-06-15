import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../ui/Button';
import { Search, Bell, Settings, LogOut, Sun, Moon } from 'lucide-react';

export function Navbar({ showNavLinks = false, heroVariant = 'dark' }) {
  const [scrolled, setScrolled] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const isLanding = location.pathname === '/';
  const isDarkHero = heroVariant === 'dark' && isLanding;
  const isTransparent = isLanding && !scrolled;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showProfileMenu && !e.target.closest('[data-profile-menu]')) setShowProfileMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showProfileMenu]);

  const onHero = isTransparent && isDarkHero;

  const linkClass = onHero
    ? 'text-sm text-white/70 hover:text-white transition-colors'
    : 'text-sm text-neutral-500 hover:text-black transition-colors';

  const logoClass = onHero ? 'text-white' : 'text-black';

  const navBg = scrolled
    ? 'bg-black/90 backdrop-blur-xl border-white/10'
    : 'bg-transparent border-transparent';

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 border-b ${navBg}`}>
      <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className={`font-serif italic text-xl transition-colors ${logoClass}`}>
          Drape&Drop
        </Link>

        {showNavLinks && !user && isLanding && (
          <div className="hidden md:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
            <a href="#features" className={linkClass}>Features</a>
            <a href="#how-it-works" className={linkClass}>How it works</a>
            <a href="#pricing" className={linkClass}>Pricing</a>
          </div>
        )}

        <div className="flex items-center gap-3 ml-auto">
          {!user && (
            <>
              <button className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${onHero ? 'text-white/70 hover:text-white' : 'text-neutral-500 hover:text-black'}`}>
                <Search className="h-4 w-4" />
              </button>
              <button onClick={toggleTheme} className={`h-9 w-9 rounded-full flex items-center justify-center transition-colors ${onHero ? 'text-white/70 hover:text-white' : 'text-neutral-500 hover:text-black'}`}>
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <Link to="/login" className={`${linkClass} hidden sm:block`}>Sign in</Link>
              <Link to="/signup">
                <Button size="sm" className={`rounded-full px-5 h-9 border-none ${onHero ? 'bg-white text-black hover:bg-neutral-100' : 'bg-black text-white hover:bg-black/90'}`}>
                  Get started
                </Button>
              </Link>
            </>
          )}

          {user && (
            <div className="relative" data-profile-menu>
              <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="h-8 w-8 rounded-full bg-white/20 text-white text-xs font-medium border border-white/30">
                {user.email?.charAt(0).toUpperCase() || 'U'}
              </button>
              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    className="absolute right-0 mt-2 w-48 rounded-xl border border-white/10 bg-neutral-900 p-1 shadow-lg">
                    <div className="px-3 py-2 border-b border-white/10 mb-1">
                      <p className="text-sm text-white truncate">{user.displayName || 'User'}</p>
                      <p className="text-xs text-neutral-400 truncate">{user.email}</p>
                    </div>
                    <Link to="/dashboard" className="block px-3 py-2 text-sm text-neutral-300 hover:text-white">Dashboard</Link>
                    <Link to="/settings" className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-300 hover:text-white">
                      <Settings className="h-4 w-4" /> Settings
                    </Link>
                    <button onClick={signOut} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-neutral-300 hover:text-white">
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
