/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Cormorant Garamond', 'Georgia', 'serif'],
        serif:   ['"DM Serif Display"', '"Cormorant Garamond"', 'Georgia', 'serif'],
        editorial: ['Cormorant Garamond', 'Georgia', 'serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT:    'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        border:  'var(--border)',
        primary: {
          DEFAULT:    'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        muted: {
          DEFAULT:    'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        blush:    '#E8C4BC',
        wheat:    '#C9A96E',
        espresso: '#1A1412',
        cream:    '#FAF7F2',
        ivory:    '#F5F0E8',
        teal:     '#2AABB8',
        neutral: {
          850: '#1a1a1a',
          925: '#0d0d0d',
          950: '#080808',
        },
      },
      boxShadow: {
        'soft':      '0 4px 20px -2px rgba(0,0,0,0.06)',
        'glass':     '0 8px 32px rgba(0,0,0,0.4)',
        'hero':      '0 25px 80px rgba(0,0,0,0.7)',
        'card-dark': '0 1px 0 rgba(255,255,255,0.05), 0 20px 40px rgba(0,0,0,0.5)',
        'editorial': '0 40px 80px -20px rgba(26,20,18,0.18)',
        'warm':      '0 20px 60px -15px rgba(201,169,110,0.25)',
      },
      backdropBlur: {
        '2xl': '40px',
        '3xl': '60px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':  'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      animation: {
        'float-slow':   'float-slow 4s ease-in-out infinite',
        'float-medium': 'float-medium 3s ease-in-out infinite',
        'pulse-soft':   'pulse-soft 2s ease-in-out infinite',
        'spin-slow':    'spin-slow 12s linear infinite',
        'bar-fill':     'bar-fill 1.2s ease-out forwards',
        'marquee':      'marquee 28s linear infinite',
      },
      keyframes: {
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':       { transform: 'translateY(-8px)' },
        },
        'float-medium': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':       { transform: 'translateY(6px)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '0.5' },
          '50%':       { opacity: '1' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to:   { transform: 'rotate(360deg)' },
        },
        'bar-fill': {
          from: { width: '0%' },
        },
        'marquee': {
          '0%':   { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      spacing: {
        '4.5': '1.125rem',
        '18':  '4.5rem',
        '22':  '5.5rem',
      },
    },
  },
  plugins: [],
}
