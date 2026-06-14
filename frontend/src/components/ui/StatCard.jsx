import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

function useCountUp(target, duration = 1200, startOnMount = true) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!startOnMount && !started) return;
    setStarted(true);
    let startTime = null;
    const startVal = 0;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
      else setCount(target);
    };

    requestAnimationFrame(step);
  }, [target, duration, startOnMount, started]);

  return count;
}

const colorMap = {
  blue: {
    icon: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    gradient: 'from-blue-500/10 to-transparent',
    trend: 'text-blue-400',
    glow: 'hover:border-blue-500/30 hover:shadow-[0_0_30px_rgba(59,130,246,0.08)]',
  },
  violet: {
    icon: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
    gradient: 'from-violet-500/10 to-transparent',
    trend: 'text-violet-400',
    glow: 'hover:border-violet-500/30 hover:shadow-[0_0_30px_rgba(139,92,246,0.08)]',
  },
  emerald: {
    icon: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    gradient: 'from-emerald-500/10 to-transparent',
    trend: 'text-emerald-400',
    glow: 'hover:border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.08)]',
  },
  gold: {
    icon: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    gradient: 'from-amber-500/10 to-transparent',
    trend: 'text-amber-400',
    glow: 'hover:border-amber-500/30 hover:shadow-[0_0_30px_rgba(245,158,11,0.08)]',
  },
};

export function StatCard({
  title,
  value,
  suffix = '',
  prefix = '',
  icon: Icon,
  trend,
  trendValue,
  description,
  color = 'blue',
  delay = 0,
  animate = true,
}) {
  const count = useCountUp(typeof value === 'number' ? value : 0, 1400);
  const displayValue = typeof value === 'number' ? count : value;
  const colors = colorMap[color] || colorMap.blue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-6 cursor-default',
        'transition-all duration-300',
        colors.glow
      )}
    >
      {/* Gradient backdrop */}
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-50', colors.gradient)} />

      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl border', colors.icon)}>
            {Icon && <Icon className="h-5 w-5" />}
          </div>
          {trend && (
            <div className={cn('flex items-center gap-1 text-xs font-medium', 
              trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-zinc-500'
            )}>
              {trend === 'up' && <TrendingUp className="h-3 w-3" />}
              {trend === 'down' && <TrendingDown className="h-3 w-3" />}
              {trend === 'neutral' && <Minus className="h-3 w-3" />}
              {trendValue}
            </div>
          )}
        </div>

        <div className="mt-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: delay + 0.2, duration: 0.5 }}
            className="text-3xl font-bold tracking-tight text-white font-display"
          >
            {prefix}{displayValue}{suffix}
          </motion.div>
          <div className="mt-1 text-sm font-medium text-zinc-400">{title}</div>
          {description && (
            <div className="mt-0.5 text-xs text-zinc-600">{description}</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default StatCard;
