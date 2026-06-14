import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Shirt, Sparkles, ScanFace, ArrowRight, ArrowUpRight } from 'lucide-react';

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

function EditorialStatCard({ label, value, trend, icon: Icon }) {
  return (
    <motion.div variants={itemVariants} className="p-6 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111113] rounded-lg shadow-soft transition-all hover:border-black dark:hover:border-white">
      <div className="flex items-center justify-between mb-4">
        <Icon className="h-5 w-5 text-neutral-400" strokeWidth={1.5} />
        {trend && (
          <span className="flex items-center text-xs font-medium text-black dark:text-white">
            {trend} <ArrowUpRight className="h-3 w-3 ml-0.5" />
          </span>
        )}
      </div>
      <div>
        <p className="text-3xl font-light text-black dark:text-white tracking-tight">{value}</p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mt-2">{label}</p>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const stats = [
    { label: 'Wardrobe Items', value: '4', trend: 'Preset', icon: Shirt },
    { label: 'Outfits Generated', value: '12', trend: '+15%', icon: Sparkles },
    { label: 'Style Score', value: '87', trend: '+5%', icon: Sparkles },
    { label: 'Try-On Sessions', value: '8', trend: 'Active', icon: ScanFace },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="max-w-[1200px] mx-auto space-y-12 pb-12">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h1 className="text-3xl md:text-4xl font-light text-black dark:text-white tracking-tight font-display mb-2">
            {greeting}, {user?.displayName?.split(' ')[0] || 'Guest'}.
          </h1>
          <p className="text-neutral-500 dark:text-neutral-400">Your style overview for today.</p>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-xs font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
          </p>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <EditorialStatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <motion.div variants={itemVariants} className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-medium text-black dark:text-white">Quick Actions</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Link to="/ai-stylist" className="group block p-6 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#111113] hover:border-black dark:hover:border-white transition-colors rounded-lg">
              <Sparkles className="h-6 w-6 text-black dark:text-white mb-4" strokeWidth={1.5} />
              <h3 className="text-sm font-medium text-black dark:text-white mb-1">Generate Outfit</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">Let AI build a look from your wardrobe.</p>
              <span className="flex items-center text-xs font-medium text-black dark:text-white group-hover:underline underline-offset-4">
                Start Session <ArrowRight className="h-3 w-3 ml-1 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
            <Link to="/wardrobe" className="group block p-6 border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-[#111113] hover:border-black dark:hover:border-white transition-colors rounded-lg">
              <Shirt className="h-6 w-6 text-black dark:text-white mb-4" strokeWidth={1.5} />
              <h3 className="text-sm font-medium text-black dark:text-white mb-1">Upload Item</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">Digitize a new piece of clothing.</p>
              <span className="flex items-center text-xs font-medium text-black dark:text-white group-hover:underline underline-offset-4">
                Open Wardrobe <ArrowRight className="h-3 w-3 ml-1 transition-transform group-hover:translate-x-1" />
              </span>
            </Link>
          </div>
        </motion.div>

        {/* Recent Activity (Editorial list) */}
        <motion.div variants={itemVariants} className="space-y-4">
          <h2 className="text-lg font-medium text-black dark:text-white">Recent Activity</h2>
          <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111113] p-6 h-[200px] flex flex-col items-center justify-center text-center rounded-lg">
            <div className="h-10 w-10 border border-neutral-200 dark:border-neutral-800 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="h-4 w-4 text-neutral-400" />
            </div>
            <h3 className="text-sm font-medium text-black dark:text-white mb-1">Pre-loaded catalog</h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">Your mock library is active and ready.</p>
          </div>
        </motion.div>
      </div>

      {/* Aesthetic Inspiration section */}
      <motion.div variants={itemVariants} className="space-y-6">
        <h2 className="text-lg font-medium text-black dark:text-white">Aesthetic Inspiration</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { img: '/images/hero_fashion_female.png', title: 'Editorial Avant-Garde', tag: 'Monochrome' },
            { img: '/images/knit_sweater_card.png', title: 'Minimalist Knitwear', tag: 'Textured' },
            { img: '/images/hero_fashion_male.png', title: 'Sleek Trench Styling', tag: 'Silhouette' },
            { img: '/images/virtual_tryon_showcase.png', title: 'Intelligent Fit Showcase', tag: 'Virtual Fitting' },
          ].map((item, index) => (
            <div key={index} className="group relative overflow-hidden bg-neutral-100 dark:bg-neutral-900 aspect-[3/4] rounded-lg border border-neutral-250 dark:border-neutral-850">
              <img 
                src={item.img} 
                alt={item.title} 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <span className="text-[10px] font-semibold tracking-wider text-white uppercase mb-2">{item.tag}</span>
                <h3 className="text-sm font-medium text-white">{item.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
