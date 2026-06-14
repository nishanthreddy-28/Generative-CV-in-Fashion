import React from 'react';
import { motion } from 'framer-motion';
import { Brain, TrendingUp, Sparkles, Award, ShieldAlert } from 'lucide-react';

export default function InsightsPage() {
  const styleScore = 87;

  const colorPalette = [
    { name: 'Navy Blue', hex: '#1e3a5f', pct: '35%' },
    { name: 'Eggshell White', hex: '#f5f5f0', pct: '25%' },
    { name: 'Camel Tan', hex: '#8b7355', pct: '20%' },
    { name: 'Charcoal Black', hex: '#222222', pct: '15%' },
    { name: 'Gold Accent', hex: '#d4af37', pct: '5%' },
  ];

  return (
    <div className="max-w-[1200px] mx-auto space-y-12 pb-12 text-black dark:text-white transition-colors duration-300">
      {/* Header */}
      <div className="flex flex-col items-center text-center pb-8 border-b border-neutral-200 dark:border-neutral-800">
        <Brain className="h-8 w-8 text-black dark:text-white mb-4" strokeWidth={1} />
        <h1 className="text-3xl font-light tracking-tight font-display mb-2">Aesthetic Analytics.</h1>
        <p className="text-neutral-500 dark:text-neutral-450 max-w-md">Data-driven insights into your personal style catalog.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        
        {/* Style Score Card */}
        <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111113] p-8 flex flex-col items-center justify-center text-center rounded-xl shadow-soft">
           <p className="text-xs font-semibold uppercase tracking-widest text-neutral-455 mb-6">Style Score</p>
           <div className="relative w-40 h-40 flex items-center justify-center border-4 border-black dark:border-white rounded-full mb-6">
             <span className="text-5xl font-light font-display">{styleScore}</span>
             <div className="absolute inset-0 border border-neutral-100 dark:border-neutral-900 rounded-full scale-110 pointer-events-none border-dashed animate-spin" style={{ animationDuration: '30s' }} />
           </div>
           <p className="flex items-center gap-1.5 text-xs font-medium text-black dark:text-white bg-neutral-100 dark:bg-neutral-900 px-3 py-1.5 rounded-full">
             <TrendingUp className="h-3.5 w-3.5 text-green-500" /> +5% aesthetic alignment this week
           </p>
        </div>
        
        {/* Category Breakdown Card */}
        <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111113] p-8 flex flex-col rounded-xl shadow-soft">
           <p className="text-xs font-semibold uppercase tracking-widest text-neutral-455 mb-6 text-center">Top Categories</p>
           <div className="space-y-5 flex-1 flex flex-col justify-center">
             {[
               { name: 'Outerwear', val: '40%', items: '2 items' },
               { name: 'Tops', val: '30%', items: '2 items' },
               { name: 'Bottoms', val: '20%', items: '1 item' },
               { name: 'Shoes', val: '10%', items: '1 item' }
             ].map(cat => (
               <div key={cat.name}>
                 <div className="flex justify-between text-xs mb-1.5">
                   <span className="text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{cat.name} ({cat.items})</span>
                   <span className="font-semibold">{cat.val}</span>
                 </div>
                 <div className="h-1.5 bg-neutral-100 dark:bg-neutral-800 w-full rounded-full overflow-hidden">
                   <div className="h-full bg-black dark:bg-white rounded-full" style={{ width: cat.val }} />
                 </div>
               </div>
             ))}
           </div>
        </div>

        {/* Color Palette Harmony Card */}
        <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111113] p-8 flex flex-col rounded-xl shadow-soft">
           <p className="text-xs font-semibold uppercase tracking-widest text-neutral-455 mb-6 text-center">Color Signature</p>
           <div className="space-y-4 flex-1 flex flex-col justify-center">
             {colorPalette.map(color => (
               <div key={color.name} className="flex items-center justify-between text-xs">
                 <div className="flex items-center gap-3">
                   <div 
                     className="w-5 h-5 rounded-full border border-neutral-200 dark:border-neutral-800 shadow-sm" 
                     style={{ backgroundColor: color.hex }}
                   />
                   <span className="text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">{color.name}</span>
                 </div>
                 <span className="font-semibold">{color.pct}</span>
               </div>
             ))}
           </div>
        </div>

        {/* Style Consistency Metrics */}
        <div className="border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#111113] p-8 flex flex-col rounded-xl shadow-soft">
           <p className="text-xs font-semibold uppercase tracking-widest text-neutral-455 mb-6 text-center">Consistency Breakdown</p>
           <div className="space-y-6 flex-1 flex flex-col justify-center">
             {[
               { title: 'Aesthetic Unity', desc: 'Minimalist editorial styling', score: '92%' },
               { title: 'Palette Synergy', desc: 'High compatibility neutral tones', score: '85%' },
               { title: 'Silhouette Variety', desc: 'Balanced structure & layering', score: '81%' }
             ].map((m, idx) => (
               <div key={idx} className="flex items-start justify-between gap-4">
                 <div>
                   <h4 className="text-xs font-semibold uppercase tracking-wider text-black dark:text-white">{m.title}</h4>
                   <p className="text-[10px] text-neutral-550 dark:text-neutral-400 mt-0.5">{m.desc}</p>
                 </div>
                 <span className="text-sm font-light font-display text-black dark:text-white">{m.score}</span>
               </div>
             ))}
           </div>
        </div>

      </div>
    </div>
  );
}
