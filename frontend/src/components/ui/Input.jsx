import React from "react";
import { cn } from "../../lib/utils";

const Input = React.forwardRef(
  ({ className, type = "text", error, success, disabled, label, hint, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-white mb-2">
            {label}
          </label>
        )}
        <input
          type={type}
          disabled={disabled}
          ref={ref}
          className={cn(
            "w-full h-10 px-4 rounded-lg bg-white/5 border transition-all duration-300",
            "text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            !error && !success && "border-white/10 hover:border-white/20 focus:border-indigo-500",
            error && "border-red-500/50 focus:border-red-500 focus:ring-red-500",
            success && "border-emerald-500/50 focus:border-emerald-500 focus:ring-emerald-500",
            className
          )}
          {...props}
        />
        {hint && <p className="text-xs text-white/40 mt-1.5">{hint}</p>}
        {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };

