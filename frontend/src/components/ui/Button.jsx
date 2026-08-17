import React from "react";
import { cn } from "../../lib/utils";

const Button = React.forwardRef(
  ({ className, variant = "primary", size = "md", isLoading = false, disabled, children, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-50 cursor-pointer";

    const variants = {
      primary: "bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 shadow-soft hover:shadow-medium",
      secondary: "bg-white/10 text-white border border-white/20 hover:bg-white/15 hover:border-white/30 hover:shadow-soft",
      tertiary: "bg-transparent text-white/70 hover:text-white hover:bg-white/5 active:bg-white/10",
      ghost: "bg-transparent text-white/60 hover:text-white/80 hover:bg-white/5",
      outline: "bg-transparent border border-white/20 text-white hover:bg-white/5 hover:border-white/30",
      danger: "bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600/30 hover:border-red-500/50",
      success: "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30",
    };

    const sizes = {
      xs: "h-8 px-3 text-xs",
      sm: "h-9 px-4 text-sm",
      md: "h-10 px-6 text-sm",
      lg: "h-12 px-8 text-base rounded-xl",
      xl: "h-14 px-10 text-base rounded-xl",
      icon: "h-10 w-10 rounded-lg",
      "icon-sm": "h-8 w-8 rounded-md",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          "hover:scale-105 active:scale-95",
          className
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {children}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
