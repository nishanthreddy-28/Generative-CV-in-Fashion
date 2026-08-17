import React from "react";
import { cn } from "../../lib/utils";
import { motion } from "framer-motion";

// Glowing Background Box
export function GlowBox({ 
  children, 
  variant = "indigo",
  className,
  animated = true,
  ...props 
}) {
  const glowColors = {
    indigo: "from-indigo-600/20 via-transparent to-indigo-600/10",
    emerald: "from-emerald-600/20 via-transparent to-emerald-600/10",
    rose: "from-rose-600/20 via-transparent to-rose-600/10",
  };

  return (
    <div 
      className={cn(
        "relative rounded-2xl overflow-hidden",
        animated && "animate-glow-pulse",
        className
      )}
      {...props}
    >
      <div className={cn("absolute inset-0 bg-gradient-to-br", glowColors[variant])} />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

// Animated Card Component
export function AnimatedCard({ 
  children, 
  delay = 0,
  className,
  ...props 
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      className={cn(
        "rounded-lg bg-white/5 border border-white/10 p-6 transition-all duration-300",
        "hover:bg-white/[0.08] hover:border-white/20 hover:shadow-soft",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
}

// Gradient Text Component
export function GradientText({ 
  children, 
  className,
  from = "indigo-400",
  via = "indigo-500",
  to = "indigo-600",
}) {
  return (
    <span 
      className={cn(
        `bg-gradient-to-r from-${from} via-${via} to-${to} bg-clip-text text-transparent`,
        className
      )}
      style={{
        backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))`,
      }}
    >
      {children}
    </span>
  );
}

// Blurred Background Element
export function BlurredBackground({ 
  className,
  variant = "indigo",
  ...props 
}) {
  const variants = {
    indigo: "bg-indigo-600/20",
    emerald: "bg-emerald-600/20",
    rose: "bg-rose-600/20",
  };

  return (
    <div 
      className={cn(
        "fixed pointer-events-none",
        variants[variant],
        "blur-3xl rounded-full",
        className
      )}
      {...props}
    />
  );
}

// Animated Badge
export function AnimatedBadge({ 
  children, 
  className,
  variant = "default",
  ...props 
}) {
  const variants = {
    default: "bg-white/10 text-white border-white/20",
    indigo: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    emerald: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  };

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3 }}
      className={cn(
        "inline-block px-3 py-1 text-xs font-medium rounded-full border",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </motion.span>
  );
}

// Smooth Divider
export function SmoothDivider({ className, ...props }) {
  return (
    <div 
      className={cn(
        "h-px bg-gradient-to-r from-transparent via-white/20 to-transparent",
        className
      )}
      {...props}
    />
  );
}
