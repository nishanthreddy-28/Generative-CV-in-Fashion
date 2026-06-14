import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  actionLabel,
  className,
  variant = 'default',
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/50 px-8 py-20 text-center',
        className
      )}
    >
      {Icon && (
        <div className="relative mb-6">
          {/* Glow orb behind icon */}
          <div className="absolute inset-0 rounded-full bg-brand-blue/10 blur-2xl scale-150" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 shadow-card">
            <Icon className="h-7 w-7 text-zinc-400" />
          </div>
        </div>
      )}

      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm text-zinc-500 leading-relaxed">{description}</p>
      )}

      {action && (
        <motion.button
          onClick={action}
          whileHover={{ scale: 1.03, y: -1 }}
          whileTap={{ scale: 0.97 }}
          className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-blue-violet px-6 py-2.5 text-sm font-medium text-white shadow-glow-blue transition-all duration-200"
        >
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  );
}

export default EmptyState;
