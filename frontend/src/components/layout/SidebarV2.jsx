import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  Shirt,
  Sparkles,
  Eye,
  TrendingUp,
  Settings,
  User,
  ChevronLeft,
  Plus,
  LogOut,
  Home,
} from 'lucide-react';

const mainLinks = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, badge: null },
  { name: 'Wardrobe', path: '/wardrobe', icon: Shirt, badge: null },
  { name: 'AI Stylist', path: '/ai-stylist', icon: Sparkles, badge: 'new' },
  { name: 'Try-On', path: '/try-on', icon: Eye, badge: null },
  { name: 'Insights', path: '/insights', icon: TrendingUp, badge: null },
];

const settingsLinks = [
  { name: 'Profile', path: '/profile', icon: User },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export function SidebarV2({ collapsed, setCollapsed }) {
  const location = useLocation();
  const { user, signOut } = useAuth();

  const isActive = (path) => location.pathname === path;

  const NavLink = ({ item }) => {
    const active = isActive(item.path);
    return (
      <Link to={item.path}>
        <motion.div
          className={cn(
            'flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group relative',
            active
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
          )}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <item.icon className={cn('h-5 w-5 flex-shrink-0', active ? 'text-indigo-400' : 'text-white/40 group-hover:text-white/70')} />

          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="text-sm font-medium whitespace-nowrap"
              >
                {item.name}
              </motion.span>
            )}
          </AnimatePresence>

          {item.badge && !collapsed && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500 text-white"
            >
              {item.badge}
            </motion.span>
          )}

          {active && (
            <motion.div
              className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-400 rounded-r-full"
              layoutId="activeIndicator"
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            />
          )}
        </motion.div>
      </Link>
    );
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 80 : 260 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed left-0 top-0 h-screen flex flex-col bg-black/30 backdrop-blur-xl border-r border-white/10 z-40 overflow-hidden"
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                DD
              </div>
              <span className="text-base font-semibold text-white tracking-tight">Drape & Drop</span>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Toggle sidebar"
        >
          <ChevronLeft className={cn('h-5 w-5 transition-transform', collapsed ? 'rotate-180' : '')} />
        </motion.button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1.5 no-scrollbar">
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.p
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-xs font-semibold text-white/40 uppercase tracking-wider px-4 mb-4"
            >
              Menu
            </motion.p>
          )}
        </AnimatePresence>

        <motion.div className="space-y-1.5" layout>
          {mainLinks.map((item) => (
            <NavLink key={item.path} item={item} />
          ))}
        </motion.div>

        {/* Divider */}
        <motion.div className="h-px bg-gradient-to-r from-white/10 via-white/5 to-transparent my-4" layout />

        {/* Settings Links */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.p
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-xs font-semibold text-white/40 uppercase tracking-wider px-4 mb-4"
            >
              Account
            </motion.p>
          )}
        </AnimatePresence>

        <motion.div className="space-y-1.5" layout>
          {settingsLinks.map((item) => (
            <NavLink key={item.path} item={item} />
          ))}
        </motion.div>
      </div>

      {/* User Profile & Logout */}
      <div className="p-3 border-t border-white/10">
        {collapsed ? (
          <motion.button
            onClick={signOut}
            className="w-full p-2 rounded-lg hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors flex items-center justify-center"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Logout"
          >
            <LogOut className="h-5 w-5" />
          </motion.button>
        ) : (
          <>
            <div className="px-4 py-3 rounded-lg bg-white/5 border border-white/10 mb-3">
              <p className="text-sm font-medium text-white truncate">{user?.displayName || 'User'}</p>
              <p className="text-xs text-white/60 truncate mt-1">{user?.email}</p>
            </div>
            <motion.button
              onClick={signOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors font-medium text-sm"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </motion.button>
          </>
        )}
      </div>
    </motion.aside>
  );
}
