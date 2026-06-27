import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { ArrowRight, Play, Check } from 'lucide-react';
import { motion } from 'framer-motion';

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
    <div className="min-h-screen bg-background text-foreground selection:bg-white/20 selection:text-white">

      <Navbar showNavLinks heroVariant="dark" />

      {/* ═══ HERO — full-bleed photo, gradient left, text constrained ═ */}
      <section className="relative min-h-screen isolate flex flex-col">
        <img
          src="/images/vibrant_western_hero.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover object-[60%_top] pointer-events-none select-none"
        />
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/30 to-transparent pointer-events-none" />

        <div className="relative z-10 flex-1 flex flex-col pt-24 pb-12">
          <div className="flex-1 flex items-center px-8 lg:px-16 max-w-[1400px] mx-auto w-full">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-2xl lg:max-w-3xl"
            >
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/60 mb-6 font-medium">
                AI Fashion Platform
              </p>
              <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-[88px] font-light leading-[1.05] tracking-tight text-white mb-8">
                See Every Outfit<br />Before You Buy.
              </h1>
              <p className="text-lg lg:text-xl text-white/70 font-light leading-relaxed max-w-lg mb-12">
                AI-powered virtual try-on and personalised styling for the next generation of fashion shopping.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-3 h-14 px-8 bg-white text-black rounded-full text-sm font-medium hover:bg-transparent hover:text-white border border-white transition-all duration-500"
                >
                  Start for free <ArrowRight className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-3 h-14 px-8 border border-white/30 text-white rounded-full text-sm font-medium hover:bg-white/10 hover:border-white/50 transition-all duration-500"
                >
                  <Play className="h-3.5 w-3.5 fill-white" /> Watch demo
                </button>
              </div>
            </motion.div>
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="mt-auto border-t border-white/10 px-8 lg:px-16 pt-10 max-w-[1400px] mx-auto w-full"
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { n: '50K+', l: 'Wardrobes styled' },
                { n: '2M+', l: 'Outfits generated' },
                { n: '4.9', l: 'App Store rating' },
                { n: '94%', l: 'Return-rate reduction' },
              ].map(({ n, l }) => (
                <div key={l} className="group cursor-default">
                  <p className="font-display text-3xl lg:text-4xl font-light text-white group-hover:text-white/80 transition-colors">{n}</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mt-3">{l}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ MARQUEE ══════════════════════════════════════════════ */}
      <div className="border-y border-white/5 py-4 overflow-hidden bg-background">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...MARQUEE, ...MARQUEE].map((item, i) => (
            <span key={i} className="mx-8 text-[11px] uppercase tracking-[0.25em] text-white/50 flex items-center gap-8">
              {item}<span className="text-white/20">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ═══ INTRO ══════════════════════════════════════════════════ */}
      <section className="px-8 lg:px-16 py-32 lg:py-48 max-w-[1400px] mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-end"
        >
          <h2 className="font-display text-4xl sm:text-5xl lg:text-[64px] font-light leading-[1.1] text-white tracking-tight">
            AI-powered styling that knows your body, your wardrobe, and your taste.
          </h2>
          <div className="lg:pb-2">
            <p className="text-lg text-white/60 font-light leading-relaxed mb-10">
              Drape & Drop combines computer vision and generative AI to create a complete fashion intelligence system — one that gets sharper with every outfit you wear.
            </p>
            <Link to="/signup" className="inline-flex items-center gap-3 h-12 px-8 bg-white text-black rounded-full text-sm font-medium hover:bg-transparent hover:text-white border border-white transition-all duration-500">
              Get started — it&apos;s free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ═══ FEATURES — image cards ════════════════════ */}
      <section className="px-8 lg:px-16 pb-32 lg:pb-48 max-w-[1400px] mx-auto space-y-32 lg:space-y-48">
        {FEATURES.map((feat, index) => (
          <motion.div 
            key={feat.tag} 
            id={feat.id}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="inline-block text-[11px] uppercase tracking-[0.25em] text-white/50 border border-white/20 rounded-full px-4 py-1.5 mb-8">
              {feat.tag}
            </span>
            <div className={`grid lg:grid-cols-2 gap-12 lg:gap-24 items-center ${index % 2 !== 0 ? 'lg:grid-flow-col-dense' : ''}`}>
              <div className={`rounded-3xl overflow-hidden aspect-[4/5] lg:aspect-[3/4] bg-neutral-900 group ${index % 2 !== 0 ? 'lg:col-start-2' : ''} border border-white/5`}>
                <img src={feat.image} alt={feat.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1.5s] ease-out" />
              </div>
              <div className={`${index % 2 !== 0 ? 'lg:col-start-1' : ''}`}>
                <h3 className="font-display text-3xl sm:text-4xl lg:text-[44px] font-light leading-[1.15] mb-6 tracking-tight">
                  {feat.title}
                </h3>
                <p className="text-lg text-white/60 font-light leading-relaxed mb-10">{feat.body}</p>
                <Link to="/signup" className="inline-flex items-center gap-3 text-sm text-white uppercase tracking-widest font-medium border-b border-white/30 pb-1 hover:border-white transition-colors group">
                  Try it free <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                </Link>
              </div>
            </div>
          </motion.div>
        ))}
      </section>

      {/* ═══ TESTIMONIALS ═════════════════════════════════════════ */}
      <section className="border-t border-white/5 px-8 lg:px-16 py-32 lg:py-48">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1 }}
          className="max-w-[1400px] mx-auto"
        >
          <h2 className="font-display text-4xl sm:text-5xl lg:text-[56px] font-light text-center mb-24 tracking-tight">
            Loved by stylists worldwide.
          </h2>
          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {TESTIMONIALS.map((t, i) => (
              <motion.div 
                key={t.initials} 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: i * 0.1 }}
                className="p-10 lg:p-12 rounded-3xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
              >
                <p className="text-lg text-white/70 font-light leading-relaxed italic mb-10">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-5">
                  <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center text-sm font-medium border border-white/5">{t.initials}</div>
                  <div>
                    <p className="text-sm font-medium tracking-wide">{t.name}</p>
                    <p className="text-[10px] text-white/50 tracking-widest uppercase mt-1.5">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ═══ PRICING ══════════════════════════════════════════════ */}
      <section id="pricing" className="px-8 lg:px-16 py-32 lg:py-48 border-t border-white/5">
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1 }}
          className="max-w-[1400px] mx-auto"
        >
          <div className="text-center mb-24">
            <h2 className="font-display text-4xl sm:text-5xl lg:text-[56px] font-light mb-6 tracking-tight">Simple, honest pricing.</h2>
            <p className="text-lg text-white/50 font-light">Start free. Scale as you grow.</p>
          </div>
          <div className="grid lg:grid-cols-3 gap-8">
            {PLANS.map((plan, i) => (
              <motion.div 
                key={plan.name} 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: i * 0.1 }}
                className={`relative p-10 lg:p-12 rounded-3xl border ${plan.popular ? 'border-white/20 bg-white/[0.04]' : 'border-white/5 bg-white/[0.01]'}`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.25em] bg-white text-black px-4 py-1.5 rounded-full font-medium shadow-lg">
                    Most Popular
                  </span>
                )}
                <p className="font-display text-2xl mb-2">{plan.name}</p>
                <p className="mb-10">
                  <span className="text-4xl font-light">{plan.price}</span>
                  <span className="text-white/40 text-sm ml-2">/{plan.period}</span>
                </p>
                <ul className="space-y-4 mb-12">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-3 text-sm text-white/70 font-light">
                      <Check className="h-4 w-4 text-white/40 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/signup"
                  className={`flex items-center justify-center gap-2 w-full h-12 rounded-full text-sm font-medium transition-all duration-500 border ${plan.popular ? 'bg-white border-white text-black hover:bg-transparent hover:text-white' : 'border-white/20 text-white hover:border-white/60 hover:bg-white/5'}`}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ═══ FINAL CTA ════════════════════════════════════════════ */}
      <section className="relative overflow-hidden border-t border-white/5">
        <img src="/images/hero_fashion_2.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-40 object-top" />
        <div className="absolute inset-0 bg-background/80 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1 }}
          className="relative z-10 px-8 lg:px-16 py-40 lg:py-64 text-center max-w-4xl mx-auto"
        >
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60 mb-8 font-medium">Ready to start</p>
          <h2 className="font-display text-5xl sm:text-6xl lg:text-[80px] font-light leading-[1.05] mb-12 tracking-tight">
            The future of<br />getting dressed.
          </h2>
          <Link to="/signup" className="inline-flex items-center gap-3 h-14 px-10 bg-white text-black rounded-full text-sm font-medium hover:bg-transparent hover:text-white border border-white transition-all duration-500">
            Get started — it&apos;s free <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </section>

      {/* ═══ FOOTER ═══════════════════════════════════════════════ */}
      <footer className="border-t border-white/5 px-8 lg:px-16 py-12">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <Link to="/" className="font-serif italic text-2xl text-white tracking-wide">Drape&Drop</Link>
          <div className="flex gap-8 text-xs text-white/50 uppercase tracking-widest">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Support</a>
          </div>
          <p className="text-xs text-white/30 tracking-widest uppercase">© 2026 Drape&Drop</p>
        </div>
      </footer>
    </div>
  );
}
