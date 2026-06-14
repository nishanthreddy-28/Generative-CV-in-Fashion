import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  Shirt,
  Sparkles,
  ScanFace,
  Brain,
  Settings,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';

const mainLinks = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'My Wardrobe', path: '/wardrobe', icon: Shirt },
  { name: 'AI Stylist', path: '/ai-stylist', icon: Sparkles },
  { name: 'Virtual Try-On', path: '/try-on', icon: ScanFace },
  { name: 'Insights', path: '/insights', icon: Brain },
];

const accountLinks = [
  { name: 'Profile', path: '/profile', icon: User },
  { name: 'Settings', path: '/settings', icon: Settings },
];

export function Sidebar({ collapsed, setCollapsed }) {
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const NavItem = ({ item }) => {
    const isActive = location.pathname === item.path;
    return (
      <Link
        to={item.path}
        className={cn(
          "group flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 relative overflow-hidden",
          isActive 
            ? "bg-black dark:bg-neutral-800 text-white" 
            : "text-neutral-500 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900"
        )}
      >
        <item.icon className={cn("h-4 w-4 shrink-0 transition-colors", isActive ? "text-white" : "text-neutral-400 group-hover:text-black dark:group-hover:text-white")} strokeWidth={isActive ? 2 : 1.5} />
        
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
      </Link>
    );
  };

  return (
    <motion.aside
      animate={{ width: collapsed ? 68 : 240 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 h-screen flex flex-col border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#09090b] z-40 overflow-hidden"
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-neutral-100 dark:border-neutral-800">
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 overflow-hidden"
            >
              <span className="text-base font-medium tracking-tight text-black dark:text-white uppercase font-display">Drape&Drop</span>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 transition-colors"
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Main Nav */}
      <div className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-6 custom-scrollbar">
        <div className="space-y-1">
          {mainLinks.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}
        </div>

        <div className="space-y-1">
          <AnimatePresence>
            {!collapsed && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="px-3 text-xs font-semibold text-neutral-400 tracking-wider uppercase mb-2"
              >
                Account
              </motion.p>
            )}
          </AnimatePresence>
          {accountLinks.map((item) => (
            <NavItem key={item.path} item={item} />
          ))}
        </div>
      </div>

      {/* User Footer */}
      <div className="p-3 border-t border-neutral-100 dark:border-neutral-800">
        <div className={cn(
          "flex items-center gap-3 rounded-md transition-all",
          collapsed ? "justify-center" : "px-3 py-2"
        )}>
          <div className="h-8 w-8 shrink-0 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-xs font-medium text-black dark:text-white border border-neutral-300 dark:border-neutral-700">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="flex flex-1 items-center justify-between min-w-0"
              >
                <div className="min-w-0 pr-2">
                  <p className="text-sm font-medium text-black dark:text-white truncate">{user?.displayName || 'User'}</p>
                </div>
                <button
                  onClick={signOut}
                  className="text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  );
}
