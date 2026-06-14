import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { motion } from 'framer-motion';
import { Bell, Search } from 'lucide-react';

export function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-neutral-50 dark:bg-[#0c0c0d] text-black dark:text-zinc-100 transition-colors duration-300">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      
      <motion.div 
        layout
        className="flex-1 flex flex-col min-w-0"
      >
        {/* Dashboard Topbar */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#09090b] sticky top-0 z-30">
          <div className="flex items-center gap-4 flex-1">
             <div className="relative w-full max-w-md hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input 
                  type="text" 
                  placeholder="Search your wardrobe, outfits..." 
                  className="w-full pl-9 pr-4 py-2 text-sm bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white border-none rounded-md focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white placeholder:text-neutral-500"
                />
             </div>
          </div>
          <div className="flex items-center gap-4">
             <button className="relative p-2 text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white transition-colors rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-900">
               <Bell className="h-4 w-4" />
               <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-black dark:bg-white"></span>
             </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-6 lg:p-8 overflow-x-hidden">
          <Outlet />
        </main>
      </motion.div>
    </div>
  );
}
