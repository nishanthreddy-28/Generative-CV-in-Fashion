import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarV2 } from '../components/layout/SidebarV2';
import { motion } from 'framer-motion';
import { Bell, Search, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export function DashboardLayoutV2() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="flex min-h-screen bg-[#0A0A0A] text-white">
      {/* Sidebar */}
      <SidebarV2 collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />

      {/* Main Content */}
      <motion.div
        layout
        className="flex-1 flex flex-col min-w-0"
        animate={{
          marginLeft: sidebarCollapsed ? 80 : 260,
        }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Topbar */}
        <motion.header
          className="h-16 flex items-center justify-between px-6 lg:px-8 border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0 z-30"
          layout
        >
          {/* Search Bar */}
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-md hidden sm:flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-white/40" />
              <input
                type="text"
                placeholder="Search wardrobe, outfits..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 h-10 bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/40 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <motion.button
              className="relative p-2.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              <motion.span
                className="absolute top-2 right-2 h-2 w-2 rounded-full bg-indigo-500"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.button>

            {/* Theme Toggle */}
            <motion.button
              onClick={toggleTheme}
              className="p-2.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </motion.button>
          </div>
        </motion.header>

        {/* Page Content */}
        <motion.main
          className="flex-1 overflow-y-auto p-6 lg:p-8"
          layout
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Outlet />
          </motion.div>
        </motion.main>
      </motion.div>
    </div>
  );
}

export { DashboardLayoutV2 as DashboardLayout };
