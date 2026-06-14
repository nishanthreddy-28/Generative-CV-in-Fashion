import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

const glowVariants = {
  blue: 'shadow-glow-blue bg-gradient-blue-violet',
  violet: 'shadow-glow-violet bg-gradient-to-r from-violet-600 to-purple-600',
  emerald: 'shadow-glow-emerald bg-gradient-to-r from-emerald-500 to-teal-500',
  gold: 'bg-gradient-gold shadow-[0_4px_15px_rgba(245,158,11,0.4)]',
  ghost: 'bg-transparent border border-zinc-800 hover:border-brand-blue/50 text-white',
  outline: 'bg-transparent border border-zinc-700 hover:bg-zinc-900 text-zinc-200',
};

export function GlowButton({
  children,
  variant = 'blue',
  size = 'md',
  className,
  disabled,
  onClick,
  type = 'button',
  icon,
  iconRight,
  loading,
  ...props
}) {
  const sizes = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
    xl: 'px-8 py-4 text-lg gap-3',
  };

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      whileHover={{ scale: disabled ? 1 : 1.02, y: disabled ? 0 : -1 }}
      whileTap={{ scale: disabled ? 1 : 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={cn(
        'relative inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
        glowVariants[variant],
        sizes[size],
        variant !== 'ghost' && variant !== 'outline' && 'text-white',
        className
      )}
      {...props}
    >
      {loading ? (
        <LoadingSpinner size={size} />
      ) : (
        <>
          {icon && <span className="shrink-0">{icon}</span>}
          {children}
          {iconRight && <span className="shrink-0">{iconRight}</span>}
        </>
      )}
    </motion.button>
  );
}

function LoadingSpinner({ size }) {
  const spinnerSize = size === 'sm' ? 'w-3 h-3' : size === 'lg' || size === 'xl' ? 'w-5 h-5' : 'w-4 h-4';
  return (
    <svg className={cn('animate-spin', spinnerSize)} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default GlowButton;
