import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { ArrowRight, Play, Check } from 'lucide-react';

const MARQUEE = [
  'Virtual Try-On', 'AI Styling', 'Smart Wardrobe', 'Trend Intelligence',
  'Colour Matching', 'Body Suitability', 'Outfit History', 'Gap Analysis',
];

const FEATURES = [
  {
    id: 'features',
    tag: '01 — Digital Twin',
    title: 'A stylist who knows your exact body.',
    body: 'Upload a photo. The AI maps your body shape, skin undertone, and colour season in seconds — then calibrates everything to your specific measurements.',
    image: '/images/daisy_sunglasses.png',
  },
  {
    id: 'how-it-works',
    tag: '02 — Smart Wardrobe',
    title: 'Your entire closet, digitised instantly.',
    body: 'Photograph each piece. AI removes the background and auto-tags category, colour, fabric, and vibe — no manual entry. Cold start solved in under 10 minutes.',
    image: '/images/minimalist_closet.png',
  },
  {
    id: 'pricing',
    tag: '03 — Daily Stylist',
    title: 'Three outfits. Every morning. Ranked.',
    body: 'Safe choice, trendy option, bold look — each scored against your body shape and colour profile. With a clear explanation of why it works.',
    image: '/images/turquoise_model.png',
  },
  {
    tag: '04 — Found Online',
    title: 'See it on you before you buy it.',
    body: 'Paste any product URL from Zara, Myntra, or Instagram. We render the item on your body and scan your wardrobe for compatibility — before you spend a rupee.',
    image: '/images/pink_dress_field.png',
  },
];

const TESTIMONIALS = [
  { quote: "The AI understood my style better than I did. Three months in, I haven't opened Myntra without checking here first.", name: 'Ananya S.', role: 'Fashion Editor, Vogue India', initials: 'AS' },
  { quote: 'I used to spend 20 minutes picking an outfit. Now it takes 10 seconds and I look measurably better.', name: 'Marcus R.', role: 'Creative Director', initials: 'MR' },
  { quote: 'The wardrobe gap analysis saved me money. I was about to buy a fifth white shirt — turns out I needed navy chinos.', name: 'Priya M.', role: 'Startup Founder', initials: 'PM' },
];

const PLANS = [
  { name: 'Free', price: '₹0', period: 'forever', features: ['25 wardrobe items', '5 AI outfits/day', 'Basic Try-On'], cta: 'Get started', popular: false },
  { name: 'Pro', price: '₹499', period: 'per month', features: ['Unlimited wardrobe', 'Unlimited AI outfits', 'Advanced Try-On', 'Gap analysis', 'URL shopping'], cta: 'Start trial', popular: true },
  { name: 'Studio', price: '₹1,299', period: 'per month', features: ['Everything in Pro', 'Client management', 'API access', 'Team collaboration', 'Custom branding'], cta: 'Contact sales', popular: false },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-white">

      <Navbar showNavLinks heroVariant="dark" />

      {/* ═══ HERO — full-bleed photo, gradient left, text constrained (vercel ref) ═ */}
      <section className="relative min-h-screen isolate">
        <img
          src="/images/yellow_sunglasses.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-[65%_center] pointer-events-none select-none"
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(to right, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.92) 38%, rgba(0,0,0,0.45) 58%, rgba(0,0,0,0.08) 78%, transparent 100%)',
          }}
        />

        <div className="relative z-10 min-h-screen flex flex-col pt-16">
          <div className="flex-1 flex items-center px-6 sm:px-10 lg:px-14 max-w-[1400px] mx-auto w-full py-16 lg:py-20">
            <div className="w-full max-w-lg lg:max-w-xl overflow-hidden">
              <p className="text-[11px] uppercase tracking-[0.25em] text-white/50 mb-5">
                AI Fashion Platform
              </p>
              <h1 className="font-display text-[clamp(2rem,4.5vw,3.5rem)] font-light leading-[1.12] tracking-tight text-white max-w-[14ch] sm:max-w-none">
                See Every Outfit Before You Buy.
              </h1>
              <p className="mt-5 text-base text-white/60 font-light leading-relaxed max-w-md">
                AI-powered virtual try-on and personalised styling for the next generation of fashion shopping.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 h-12 px-7 bg-white text-black rounded-full text-sm font-medium hover:bg-neutral-100 transition-colors"
                >
                  Start for free <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 h-12 px-7 border border-white/30 text-white rounded-full text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  <Play className="h-3.5 w-3.5 fill-white" /> Watch demo
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 px-6 sm:px-10 lg:px-14 py-8 max-w-[1400px] mx-auto w-full">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { n: '50K+', l: 'Wardrobes styled' },
                { n: '2M+', l: 'Outfits generated' },
                { n: '4.9', l: 'App Store rating' },
                { n: '94%', l: 'Return-rate reduction' },
              ].map(({ n, l }) => (
                <div key={l}>
                  <p className="font-display text-2xl lg:text-3xl font-light">{n}</p>
                  <p className="text-[9px] uppercase tracking-[0.15em] text-white/40 mt-1">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ MARQUEE ══════════════════════════════════════════════ */}
      <div className="border-y border-white/10 py-3.5 overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...MARQUEE, ...MARQUEE].map((item, i) => (
            <span key={i} className="mx-6 text-[10px] uppercase tracking-[0.22em] text-white/40 flex items-center gap-6">
              {item}<span className="text-white/20">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ═══ INTRO ══════════════════════════════════════════════════ */}
      <section className="px-6 sm:px-10 py-24 lg:py-32 max-w-[1400px] mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-end">
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-light leading-tight text-white">
            AI-powered styling that knows your body, your wardrobe, and your taste.
          </h2>
          <div>
            <p className="text-white/55 font-light leading-relaxed mb-8">
              Drape & Drop combines computer vision and generative AI to create a complete fashion intelligence system — one that gets sharper with every outfit you wear.
            </p>
            <Link to="/signup" className="inline-flex items-center gap-2 h-11 px-6 bg-white text-black rounded-full text-sm font-medium hover:bg-neutral-100 transition-colors">
              Get started — it&apos;s free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ FEATURES — image cards like vercel ════════════════════ */}
      <section className="px-6 sm:px-10 pb-24 lg:pb-32 max-w-[1400px] mx-auto space-y-20 lg:space-y-28">
        {FEATURES.map((feat) => (
          <div key={feat.tag} id={feat.id}>
            <span className="inline-block text-[10px] uppercase tracking-[0.2em] text-white/40 border border-white/15 rounded-full px-3 py-1 mb-6">
              {feat.tag}
            </span>
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
              <div className="rounded-2xl overflow-hidden aspect-[4/5] lg:aspect-[3/4] bg-neutral-900">
                <img src={feat.image} alt={feat.title} className="w-full h-full object-cover" />
              </div>
              <div>
                <h3 className="font-display text-2xl sm:text-3xl lg:text-4xl font-light leading-snug mb-5">
                  {feat.title}
                </h3>
                <p className="text-white/55 font-light leading-relaxed mb-8">{feat.body}</p>
                <Link to="/signup" className="inline-flex items-center gap-2 text-sm text-white border-b border-white/30 pb-0.5 hover:border-white transition-colors group">
                  Try it free <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* ═══ TESTIMONIALS ═════════════════════════════════════════ */}
      <section className="border-t border-white/10 px-6 sm:px-10 py-24 lg:py-32">
        <div className="max-w-[1400px] mx-auto">
          <h2 className="font-display text-3xl sm:text-4xl font-light text-center mb-16">
            Loved by stylists worldwide.
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.initials} className="p-8 rounded-2xl border border-white/10 bg-white/[0.03]">
                <p className="text-white/70 font-light leading-relaxed italic mb-8">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium">{t.initials}</div>
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-white/40">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRICING ══════════════════════════════════════════════ */}
      <section id="pricing" className="px-6 sm:px-10 py-24 lg:py-32 border-t border-white/10">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl sm:text-4xl font-light mb-3">Simple, honest pricing.</h2>
            <p className="text-white/50 font-light">Start free. Scale as you grow.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {PLANS.map((plan) => (
              <div key={plan.name} className={`relative p-8 rounded-2xl border ${plan.popular ? 'border-white/30 bg-white/[0.05]' : 'border-white/10 bg-white/[0.02]'}`}>
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-[0.2em] bg-white text-black px-3 py-1 rounded-full font-medium">
                    Most Popular
                  </span>
                )}
                <p className="font-display text-xl mb-1">{plan.name}</p>
                <p className="mb-6">
                  <span className="text-3xl font-light">{plan.price}</span>
                  <span className="text-white/40 text-sm">/{plan.period}</span>
                </p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-white/60">
                      <Check className="h-4 w-4 text-white/40 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/signup"
                  className={`block text-center h-11 leading-[2.75rem] rounded-full text-sm font-medium transition-colors ${plan.popular ? 'bg-white text-black hover:bg-neutral-100' : 'border border-white/25 hover:bg-white/10'}`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-t border-white/10">
        <img src="/images/sunlight_lady.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-black/70" />
        <div className="relative z-10 px-6 sm:px-10 py-32 lg:py-40 text-center max-w-3xl mx-auto">
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/40 mb-5">Ready to start</p>
          <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-light leading-tight mb-10">
            The future of getting dressed.
          </h2>
          <Link to="/signup" className="inline-flex items-center gap-2 h-12 px-8 bg-white text-black rounded-full text-sm font-medium hover:bg-neutral-100 transition-colors">
            Get started — it&apos;s free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ═══ FOOTER ═══════════════════════════════════════════════ */}
      <footer className="border-t border-white/10 px-6 sm:px-10 py-10">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/" className="font-serif italic text-lg text-white">Drape&Drop</Link>
          <div className="flex gap-6 text-xs text-white/40">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Support</a>
          </div>
          <p className="text-xs text-white/30">© 2026 Drape&Drop</p>
        </div>
      </footer>
    </div>
  );
}
