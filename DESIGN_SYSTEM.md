# Drape & Drop — Premium SaaS Design System
**Version 1.0** | Elite Production-Ready Interface

---

## 1. VISUAL FOUNDATION

### 1.1 Color Palette
```
PRIMARY (Dark Mode Default)
├── Background: #0A0A0A (near-pure black for OLED optimization)
├── Surface Dark: #111113 (elevated surfaces with subtle depth)
├── Surface Mid: #1A1A1D (secondary surfaces)
├── Border Dark: #2A2A2D (subtle separation)
├── Border Light: #3A3A3D (stronger separation)
├── Text Primary: #FFFFFF (high contrast)
├── Text Secondary: #A1A1A6 (reduced emphasis)
├── Text Muted: #6F6F77 (tertiary information)

ACCENT COLORS
├── Indigo Primary: #6366F1 (interactive, CTAs)
├── Indigo Hover: #4F46E5 (darker state)
├── Indigo Light: #E0E7FF (backgrounds)
├── Emerald Success: #10B981 (positive states)
├── Amber Warning: #F59E0B (caution states)
├── Rose Error: #EF4444 (error states)

GLASS & EFFECTS
├── White overlay (glass): rgba(255, 255, 255, 0.05)
├── White border: rgba(255, 255, 255, 0.1)
├── Glow accent: rgba(99, 102, 241, 0.15) (subtle indigo glow)
```

### 1.2 Typography System
```
FONT FAMILY
├── Display/Headlines: "Geist" or "Plus Jakarta Sans" (Modern, bold serifs)
├── Body/UI: "Inter" (Crisp, clean, 400/500/600 weights)
├── Code/Mono: "Fira Code" (for technical content)

SCALE (Tailwind-mapped)
├── xs: 12px, 16px line-height (labels, micro-text)
├── sm: 14px, 20px line-height (secondary text)
├── base: 16px, 24px line-height (body text)
├── lg: 18px, 28px line-height (prominent content)
├── xl: 20px, 28px line-height (subheadings)
├── 2xl: 24px, 32px line-height (section headers)
├── 3xl: 30px, 36px line-height (page titles)
├── 4xl: 36px, 44px line-height (hero headlines)
├── 5xl: 48px, 54px line-height (mega headlines)

WEIGHT HIERARCHY
├── 300 (Light): Headlines, Display
├── 400 (Regular): Body text
├── 500 (Medium): Emphasis, Labels, CTA text
├── 600 (Semibold): Sub-headings
├── 700 (Bold): Headlines (rare, only for impact)

TRACKING
├── Tight: -0.01em (headlines)
├── Normal: 0em (body)
├── Wide: 0.025em (labels, caps)
```

### 1.3 Spacing System (8px Grid)
```
Uniform grid: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 56px, 64px

STANDARD PADDING
├── Component padding: 16px (default), 12px (compact), 24px (spacious)
├── Section padding: 40px (vertical), 24px (horizontal)

MARGIN HIERARCHY
├── Micro interactions: 4px-8px
├── Component spacing: 12px-16px
├── Section spacing: 24px-32px
├── Major layout: 40px-64px
```

### 1.4 Depth & Shadows
```
SHADOW SYSTEM (all transition: box-shadow 300ms ease)
├── None: No shadow (flat elements)
├── Subtle: 0 1px 3px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.3) (cards)
├── Soft: 0 4px 8px rgba(0, 0, 0, 0.6), 0 2px 4px rgba(0, 0, 0, 0.4) (elevated)
├── Medium: 0 8px 16px rgba(0, 0, 0, 0.7), 0 4px 8px rgba(0, 0, 0, 0.5) (modals)
├── Large: 0 16px 32px rgba(0, 0, 0, 0.8), 0 8px 16px rgba(0, 0, 0, 0.6) (drawers)

BORDER SYSTEM
├── Subtle: border-white/5 (soft separation)
├── Standard: border-white/10 (normal separation)
├── Strong: border-white/20 (prominent edges)
├── Accent: border-indigo-500/30 (interactive focus)

GLOW & AMBIENT EFFECTS
├── Soft indigo glow: radial-gradient(ellipse at center, rgba(99, 102, 241, 0.15) 0%, transparent 70%)
├── Blur backdrop: backdrop-blur-xl (for glass elements)
├── Color overlay: bg-gradient-to-br (smooth transitions)
```

---

## 2. UI COMPONENTS SPECIFICATION

### 2.1 Button System
```
BUTTON HIERARCHY
├── Primary (CTA): Indigo bg, white text, rounded-lg, h-10 px-6
│  └── Hover: Darker indigo, shadow-soft, scale 1.01
│  └── Active: Even darker, raised shadow
│
├── Secondary (Alternative): White/10 border, white text, rounded-lg
│  └── Hover: White/15 bg, elevated
│  └── Use: For supporting actions
│
├── Tertiary (Ghost): Transparent, white/70 text, rounded-lg
│  └── Hover: White/10 bg
│  └── Use: Minimal actions, inline CTAs
│
├── Icon Button: h-9 w-9, rounded-md, white/10 hover
│  └── Use: Navigation, controls, compact spaces

SIZES
├── xs: h-8 px-3 text-xs (compact UI)
├── sm: h-9 px-4 text-sm (standard secondary)
├── md: h-10 px-6 text-base (primary default)
├── lg: h-12 px-8 text-base rounded-xl (hero CTA)
├── icon: h-9 w-9 or h-10 w-10 (icon-only)

STATES
├── Default: Base styles
├── Hover: Scale 1.01, shadow-soft, color shift
├── Active/Pressed: Scale 0.98, deeper shadow
├── Focus: ring-2 ring-indigo-500/50
├── Disabled: opacity-50, pointer-events-none
└── Loading: Spinner overlay, disabled cursor
```

### 2.2 Card Component
```
CARD VARIANTS
├── Default: bg-white/5 border-white/10 rounded-lg p-6
│  └── Hover: border-white/20, shadow-soft, scale 1.02
│
├── Interactive: Similar but more prominent border
│  └── Hover: bg-white/10, border-indigo-500/30
│
├── Elevated: bg-white/10 border-white/15 shadow-soft
│  └── Use: Featured content, highlighted sections

RESPONSIVE PADDING
├── Mobile: p-4 gap-3
├── Tablet: p-5 gap-4
├── Desktop: p-6 gap-6

INTERNAL SPACING
├── Title to content: mb-4
├── Content sections: gap-6 (flex)
├── Icon to text: gap-3 (inline)
```

### 2.3 Input Components
```
INPUT STYLES
├── Base: bg-white/5 border-white/10 rounded-lg h-10 px-4 text-base
│  └── Focus: border-indigo-500/50 ring-1 ring-indigo-500/30
│  └── Placeholder: text-white/40
│
├── Error State: border-rose-500/50, ring-rose-500/30
├── Success State: border-emerald-500/50, ring-emerald-500/30
├── Disabled: opacity-50, cursor-not-allowed

LABEL & HINT TEXT
├── Label: text-sm font-medium text-white mb-2
├── Hint: text-xs text-white/40 mt-1.5
├── Error message: text-xs text-rose-400 mt-1.5
```

### 2.4 Navigation Components
```
NAVBAR
├── Height: h-16 (desktop), h-14 (mobile)
├── Position: fixed top-0 z-50 w-full
├── Background: bg-black/70 backdrop-blur-xl border-white/5
├── On scroll: Becomes opaque with stronger border
├── Logo: text-xl font-semibold text-white
├── Nav links: text-sm text-white/70 hover:text-white rounded-full px-4 py-2
├── CTA Button: Primary variant, lg size

SIDEBAR
├── Width: w-64 (desktop), w-0 (collapsed)
├── Position: fixed left-0 top-0 h-screen z-40
├── Background: bg-black/50 backdrop-blur-lg border-r border-white/5
├── Transition: All smooth 300ms
├── Logo area: py-6 px-6, border-b border-white/5
├── Menu items: py-3 px-4, rounded-lg, hover:bg-white/10
├── Active state: border-l-2 border-indigo-500 bg-white/5
```

### 2.5 Modals & Overlays
```
MODAL
├── Backdrop: fixed inset-0 bg-black/70 backdrop-blur-sm z-40
├── Panel: bg-white/10 border-white/15 rounded-2xl shadow-lg
├── Animation: Scale fade-in on mount
├── Header: py-6 px-8, border-b border-white/10
├── Body: py-6 px-8
├── Footer: py-4 px-8, border-t border-white/10, flex justify-end gap-3

TOASTER/NOTIFICATIONS
├── Position: bottom-right, safe margins
├── Style: bg-white/10 border-white/15 rounded-lg text-white
├── Animation: Slide in from bottom right
├── Duration: Auto-dismiss after 3-5 seconds
```

---

## 3. ANIMATION & MOTION

### 3.1 Timing & Easing
```
STANDARD DURATIONS
├── Micro (fast): 150ms (hover states, brief feedback)
├── Normal (standard): 300ms (transitions, common animations)
├── Slow (deliberate): 500ms (entrance animations, page changes)
├── Slower (emphasis): 700ms (hero animations, scroll-triggered)

EASING FUNCTIONS
├── Default: cubic-bezier(0.4, 0, 0.2, 1) (ease-in-out)
├── Smooth: cubic-bezier(0.25, 0.46, 0.45, 0.94) (smooth decelerate)
├── Spring: cubic-bezier(0.16, 1, 0.3, 1) (bouncy decelerate)
├── Linear: linear (scroll parallax)
```

### 3.2 Animation Patterns
```
ENTRANCE ANIMATIONS (Framer Motion)
├── Fade In: opacity: [0, 1], duration: 300ms
├── Slide Up: y: [20, 0], opacity: [0, 1], duration: 400ms
├── Slide Right: x: [-20, 0], opacity: [0, 1], duration: 300ms
├── Stagger: staggerChildren: 0.05, delayChildren: 0.1
├── Scale In: scale: [0.95, 1], opacity: [0, 1], duration: 300ms

HOVER INTERACTIONS
├── Button: scale: 1.01, shadow elevation
├── Card: scale: 1.02, border brightening
├── Icon: rotation/color shift
├── Link: underline animation

SCROLL-TRIGGERED (Optional Intersection Observer)
├── Fade in on scroll: Detect element in viewport
├── Parallax: Slower scroll speed for depth
├── Reveal: Staggered unveiling of list items
```

### 3.3 Micro-Interactions
```
LOADING STATES
├── Skeleton: Shimmer animation (white/5 → white/10)
├── Spinner: Rotating indigo icon, 24px diameter
├── Progress bar: Width animation with duration indicator

FEEDBACK INDICATORS
├── Success: Green checkmark, scale-in animation
├── Error: Red X, shake animation
├── Warning: Orange alert, pulse animation
├── Info: Blue info icon, fade-in

TRANSITION PATTERN (For page changes)
├── Fade out current: opacity: [1, 0], 150ms
├── Fade in next: opacity: [0, 1], 300ms
└── No layout shift during transition
```

---

## 4. RESPONSIVE DESIGN BREAKPOINTS

```
BREAKPOINTS (Tailwind standard)
├── Mobile: < 640px (portrait phones)
├── Tablet: 640px - 1024px (landscape phones, small tablets)
├── Desktop: 1024px - 1280px (standard desktop)
├── Wide: ≥ 1280px (large screens)
├── Ultra: ≥ 1536px (very large displays)

MOBILE-FIRST STRATEGY
├── Base styles: Mobile optimized
├── sm:, md:, lg:, xl:, 2xl: Progressive enhancement
├── Touch targets: min-height: 44px, min-width: 44px (mobile)
├── Font sizes: Smaller on mobile, scale up on desktop
├── Spacing: Tighter on mobile, generous on desktop
├── Nav: Hidden sidebar, hamburger menu (mobile)
```

---

## 5. COMPONENT LIBRARY STRUCTURE

### Core Components (Priority Order)
```
1. Buttons (Primary, Secondary, Ghost, Icon)
2. Cards (Default, Interactive, Elevated)
3. Inputs (Text, Select, Checkbox, Toggle)
4. Navigation (Navbar, Sidebar, Breadcrumbs)
5. Modals & Dialogs
6. Forms & Labels
7. Tables (Data display)
8. Avatars & Badges
9. Alerts & Toasts
10. Loaders & Skeletons
```

### Export Structure
```
/components/
├── ui/
│  ├── Button.jsx
│  ├── Card.jsx
│  ├── Input.jsx
│  ├── Modal.jsx
│  ├── Badge.jsx
│  ├── Avatar.jsx
│  ├── Skeleton.jsx
│  ├── Spinner.jsx
│  └── ...
├── layout/
│  ├── Navbar.jsx
│  ├── Sidebar.jsx
│  ├── Footer.jsx
│  └── ...
├── common/
│  ├── GlowBox.jsx
│  ├── AnimatedCard.jsx
│  ├── GradientText.jsx
│  └── ...
└── sections/
   ├── Hero.jsx
   ├── Features.jsx
   ├── CTA.jsx
   └── ...
```

---

## 6. DESIGN TOKENS (Tailwind Config)

### Extended Tailwind Configuration
```javascript
theme: {
  extend: {
    colors: {
      // Base colors
      background: '#0A0A0A',
      surface: { dark: '#111113', mid: '#1A1A1D' },
      border: { dark: '#2A2A2D', light: '#3A3A3D' },
      text: { 
        primary: '#FFFFFF', 
        secondary: '#A1A1A6', 
        muted: '#6F6F77' 
      },
      
      // Accent colors
      indigo: { 
        '50': '#F0F4FF',
        '500': '#6366F1',
        '600': '#4F46E5',
      },
      
      // Semantic colors
      success: '#10B981',
      warning: '#F59E0B',
      error: '#EF4444',
    },
    
    boxShadow: {
      none: 'none',
      subtle: '0 1px 3px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.3)',
      soft: '0 4px 8px rgba(0, 0, 0, 0.6), 0 2px 4px rgba(0, 0, 0, 0.4)',
      medium: '0 8px 16px rgba(0, 0, 0, 0.7), 0 4px 8px rgba(0, 0, 0, 0.5)',
      large: '0 16px 32px rgba(0, 0, 0, 0.8), 0 8px 16px rgba(0, 0, 0, 0.6)',
      glow: '0 0 20px rgba(99, 102, 241, 0.3)',
    },
    
    borderRadius: {
      none: '0px',
      sm: '0.25rem',
      base: '0.375rem',
      md: '0.5rem',
      lg: '0.75rem',
      xl: '1rem',
      '2xl': '1.5rem',
      full: '9999px',
    },
    
    backdropBlur: {
      sm: 'blur(4px)',
      md: 'blur(12px)',
      lg: 'blur(20px)',
      xl: 'blur(40px)',
    },
    
    transitionTimingFunction: {
      smooth: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      spring: 'cubic-bezier(0.16, 1, 0.3, 1)',
    },
  }
}
```

---

## 7. IMPLEMENTATION GUIDELINES

### Best Practices
1. **Color Contrast**: Maintain WCAG AA (4.5:1 for body, 3:1 for large text)
2. **Spacing**: Always use 8px grid multiples
3. **Typography**: Max 3 font weights per page
4. **Shadows**: Use subtle, multi-layer shadows for depth
5. **Animations**: Keep under 300ms for feedback, up to 700ms for entrance
6. **Borders**: Use white/10 by default, increase for emphasis
7. **Interactive States**: Always provide hover, active, focus, disabled states
8. **Dark Mode**: Optimize for OLED (pure blacks, reduced whites)
9. **Responsive**: Test at 375px, 768px, 1440px minimum
10. **Performance**: Lazy-load images, use CSS animations (not JS when possible)

### Accessibility Checklist
- [ ] Color not sole indicator of state
- [ ] Focus indicators visible (ring-2 ring-indigo-500)
- [ ] ARIA labels on custom components
- [ ] Keyboard navigation fully functional
- [ ] Motion can be disabled (prefers-reduced-motion)
- [ ] Text contrast meets WCAG AA
- [ ] Form labels associated with inputs
- [ ] Error messages descriptive
- [ ] Touch targets ≥ 44px (mobile)
- [ ] Alt text on all meaningful images

---

**This design system ensures a cohesive, high-converting SaaS interface with elite aesthetics, production-ready code, and exceptional UX across all devices.**
