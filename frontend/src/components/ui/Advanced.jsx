import React from "react";
import { cn } from "../../lib/utils";
import { motion } from "framer-motion";

// Badge Component
export const Badge = React.forwardRef(
  ({ className, variant = "default", size = "md", children, ...props }, ref) => {
    const variants = {
      default: "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30",
      success: "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30",
      warning: "bg-amber-600/20 text-amber-300 border border-amber-500/30",
      error: "bg-red-600/20 text-red-300 border border-red-500/30",
      secondary: "bg-white/10 text-white/80 border border-white/20",
    };

    const sizes = {
      sm: "px-2 py-0.5 text-xs",
      md: "px-3 py-1 text-sm",
      lg: "px-4 py-1.5 text-base",
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full font-medium transition-all",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);
Badge.displayName = "Badge";

// Avatar Component
export const Avatar = React.forwardRef(
  ({ className, src, alt, initials, size = "md", ...props }, ref) => {
    const sizes = {
      xs: "h-6 w-6 text-xs",
      sm: "h-8 w-8 text-sm",
      md: "h-10 w-10 text-base",
      lg: "h-12 w-12 text-lg",
      xl: "h-16 w-16 text-2xl",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-center rounded-full font-semibold text-white bg-gradient-to-br from-indigo-500 to-indigo-600",
          sizes[size],
          className
        )}
        {...props}
      >
        {src ? (
          <img src={src} alt={alt} className="h-full w-full rounded-full object-cover" />
        ) : (
          initials || "?"
        )}
      </div>
    );
  }
);
Avatar.displayName = "Avatar";

// Avatar Group
export function AvatarGroup({ avatars, max = 3, size = "sm" }) {
  const displayed = avatars.slice(0, max);
  const remaining = avatars.length - max;

  return (
    <div className="flex -space-x-2">
      {displayed.map((avatar, i) => (
        <Avatar
          key={i}
          src={avatar.src}
          initials={avatar.initials}
          size={size}
          className="border border-black"
        />
      ))}
      {remaining > 0 && (
        <Avatar
          initials={`+${remaining}`}
          size={size}
          className="border border-black"
        />
      )}
    </div>
  );
}

// Alert Component
export const Alert = React.forwardRef(
  ({ className, variant = "default", icon: Icon, title, children, ...props }, ref) => {
    const variants = {
      default: "bg-indigo-600/20 border-indigo-500/30 text-indigo-300",
      success: "bg-emerald-600/20 border-emerald-500/30 text-emerald-300",
      warning: "bg-amber-600/20 border-amber-500/30 text-amber-300",
      error: "bg-red-600/20 border-red-500/30 text-red-300",
    };

    const iconColors = {
      default: "text-indigo-400",
      success: "text-emerald-400",
      warning: "text-amber-400",
      error: "text-red-400",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "flex gap-4 rounded-lg border p-4",
          variants[variant],
          className
        )}
        {...props}
      >
        {Icon && <Icon className={cn("h-5 w-5 flex-shrink-0 mt-0.5", iconColors[variant])} />}
        <div className="flex-1">
          {title && <h4 className="font-semibold mb-1">{title}</h4>}
          <div className="text-sm opacity-90">{children}</div>
        </div>
      </div>
    );
  }
);
Alert.displayName = "Alert";

// Progress Component
export function Progress({ value = 0, max = 100, className, animated = true }) {
  const percentage = (value / max) * 100;

  return (
    <div className={cn("w-full h-2 bg-white/10 rounded-full overflow-hidden", className)}>
      <motion.div
        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: animated ? 0.5 : 0, ease: "easeOut" }}
      />
    </div>
  );
}

// Tag Component
export function Tag({ label, onRemove, icon: Icon, variant = "default" }) {
  const variants = {
    default: "bg-white/10 hover:bg-white/20",
    indigo: "bg-indigo-600/20 hover:bg-indigo-600/30",
    emerald: "bg-emerald-600/20 hover:bg-emerald-600/30",
  };

  return (
    <motion.div
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium text-white transition-colors",
        variants[variant]
      )}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 hover:text-white/60 transition-colors"
          aria-label="Remove tag"
        >
          ✕
        </button>
      )}
    </motion.div>
  );
}
