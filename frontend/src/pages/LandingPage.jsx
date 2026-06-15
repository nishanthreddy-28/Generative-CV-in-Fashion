import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Navbar } from '../components/layout/Navbar';
import { ArrowRight, Play, Sparkles, Scan, Palette, Shirt } from 'lucide-react';

const MARQUEE_ITEMS = [
  'Virtual Try-On', 'AI Styling', 'Smart Wardrobe', 'Colour Analysis',
  'Body Mapping', 'Outfit Scoring', 'Zero Returns', 'Personal Stylist',
];

const FEATURES = [
  {
    id: 'features',
    tag: '01 — Wardrobe',
    title: 'Your closet,',
    titleItalic: 'digitised.',
    body: 'Photograph each piece. AI removes backgrounds and auto-tags category, colour, fabric, and vibe — cold start solved in under ten minutes.',
    image: '/images/minimalist_closet.png',
    accent: 'bg-ivory',
    imagePosition: 'right',
  },
  {
    id: 'how-it-works',
    tag: '02 — Styling',
    title: 'Three outfits.',
    titleItalic: 'Every morning.',
    body: 'Safe choice, trendy option, bold look — each scored against your body shape and colour profile, with a clear explanation of why it works.',
    image: '/images/turquoise_model.png',
    accent: 'bg-teal/10',
    imagePosition: 'left',
  },
  {
    id: 'pricing',
    tag: '03 — Try-On',
    title: 'See it on you',
    titleItalic: 'before you buy.',
    body: 'Upload a photo. The AI maps your body shape, skin undertone, and colour season — then renders any outfit on your exact frame in seconds.',
    image: '/images/daisy_sunglasses.png',
    accent: 'bg-cream',
    imagePosition: 'right',
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, delay: i * 0.12, ease: [0.16, 1, 0.3, 1] },
  }),
};

function EditorialImage({ src, alt, className = '' }) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover transition-transform duration-[1.4s] ease-spring hover:scale-[1.03]"
      />
      <div className="absolute inset-0 grain" />
    </div>
  );
}

export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.3], [0, 80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0.4]);

  return (
    <div className="min-h-screen bg-cream text-espresso overflow-x-hidden selection:bg-blush selection:text-espresso">
      <Navbar showNavLinks heroVariant="warm" />

      {/* ── HERO — pink dress field ─────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col justify-end">
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="absolute inset-0">
          <img
            src="/images/pink_dress_field.png"
            alt="Fashion editorial hero"
            className="w-full h-full object-cover object-[center_30%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-cream via-cream/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-cream/60 via-transparent to-transparent" />
          <div className="absolute inset-0 grain" />
        </motion.div>

        <div className="relative z-10 px-6 sm:px-12 lg:px-20 pt-32 pb-16 lg:pb-24 max-w-[1400px] mx-auto w-full">
          <motion.div
            initial="hidden"
            animate="show"
            className="max-w-3xl"
          >
            <motion.p variants={fadeUp} custom={0} className="text-[11px] font-medium tracking-[0.3em] uppercase text-espresso/60 mb-6">
              AI Fashion Platform · Est. 2026
            </motion.p>
            <motion.h1
              variants={fadeUp}
              custom={1}
              className="font-editorial text-[clamp(3rem,8vw,6.5rem)] font-light leading-[0.95] tracking-tight text-espresso text-balance"
            >
              Dress with{' '}
              <span className="italic font-normal text-espresso/80">intention.</span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              custom={2}
              className="mt-6 text-lg md:text-xl text-espresso/65 font-light leading-relaxed max-w-lg"
            >
              Virtual try-on, AI styling, and a wardrobe that thinks — built for people who care how they look.
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center gap-2 h-12 px-8 bg-espresso hover:bg-espresso/90 text-cream rounded-full text-sm font-medium transition-all duration-300 shadow-editorial hover:shadow-warm hover:-translate-y-0.5"
              >
                Start for free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button className="inline-flex items-center justify-center gap-2 h-12 px-8 border border-espresso/20 hover:border-espresso/40 bg-cream/60 backdrop-blur-sm text-espresso rounded-full text-sm font-medium transition-all duration-300">
                <Play className="h-3.5 w-3.5 fill-espresso" />
                Watch demo
              </button>
            </motion.div>
          </motion.div>

          {/* Stats ribbon */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="mt-20 lg:mt-28 grid grid-cols-2 md:grid-cols-4 gap-6 lg:gap-12 border-t border-espresso/10 pt-10"
          >
            {[
              { n: '50K+', l: 'Wardrobes styled' },
              { n: '2M+', l: 'Outfits generated' },
              { n: '4.9', l: 'App Store rating' },
              { n: '94%', l: 'Fewer returns' },
            ].map(({ n, l }) => (
              <div key={l}>
                <p className="font-editorial text-4xl lg:text-5xl font-light text-espresso">{n}</p>
                <p className="text-[11px] uppercase tracking-[0.2em] text-espresso/45 mt-1 font-light">{l}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── MARQUEE ─────────────────────────────────────────────── */}
      <div className="border-y border-espresso/10 bg-espresso text-cream py-4 overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} className="mx-8 text-[11px] uppercase tracking-[0.25em] font-light flex items-center gap-8">
              {item}
              <span className="text-wheat">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── BENTO GALLERY — editorial spread ────────────────────── */}
      <section className="px-6 sm:px-12 lg:px-20 py-24 lg:py-32 max-w-[1400px] mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-14">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-espresso/45 mb-3">The Edit</p>
            <h2 className="font-editorial text-4xl sm:text-5xl lg:text-6xl font-light text-espresso leading-tight">
              Fashion, <span className="italic">reimagined.</span>
            </h2>
          </div>
          <p className="text-sm text-espresso/55 font-light max-w-sm leading-relaxed lg:text-right">
            Every image tells a story. Drape&amp;Drop turns yours into a wardrobe that actually works.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-3 lg:gap-4 auto-rows-[180px] sm:auto-rows-[220px] lg:auto-rows-[260px]">
          {/* yellow sunglasses — hero tile */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="col-span-12 lg:col-span-7 row-span-2 relative rounded-2xl overflow-hidden editorial-shadow group"
          >
            <EditorialImage src="/images/yellow_sunglasses.png" alt="Edgy street style" className="h-full" />
            <div className="absolute inset-0 bg-gradient-to-t from-espresso/70 via-transparent to-transparent" />
            <div className="absolute bottom-6 left-6 right-6">
              <p className="text-[10px] uppercase tracking-[0.2em] text-cream/60 mb-1">Virtual Try-On</p>
              <p className="font-editorial text-2xl lg:text-3xl text-cream font-light italic">See every look before you commit.</p>
            </div>
          </motion.div>

          {/* sunlight lady */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="col-span-6 lg:col-span-5 row-span-1 relative rounded-2xl overflow-hidden editorial-shadow"
          >
            <EditorialImage src="/images/sunlight_lady.png" alt="Golden hour editorial" className="h-full" />
          </motion.div>

          {/* login_bg — mood reference tile */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="col-span-6 lg:col-span-5 row-span-1 relative rounded-2xl overflow-hidden editorial-shadow"
          >
            <EditorialImage src="/images/login_bg.png" alt="Drape and Drop platform" className="h-full object-[center_20%]" />
          </motion.div>
        </div>
      </section>

      {/* ── FEATURE SECTIONS ────────────────────────────────────── */}
      {FEATURES.map((feat, idx) => (
        <section
          key={feat.id}
          id={feat.id}
          className={`${feat.accent} border-t border-espresso/8`}
        >
          <div className={`grid lg:grid-cols-2 min-h-[80vh] ${feat.imagePosition === 'left' ? '' : ''}`}>
            {feat.imagePosition === 'left' && (
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.9 }}
                className="relative min-h-[360px] lg:min-h-0 order-2 lg:order-1"
              >
                <EditorialImage src={feat.image} alt={feat.title} className="absolute inset-0 h-full" />
              </motion.div>
            )}

            <div className="flex flex-col justify-center px-8 sm:px-16 lg:px-24 py-20 lg:py-28 order-1 lg:order-none">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="max-w-lg space-y-6"
              >
                <p className="text-[11px] uppercase tracking-[0.25em] text-espresso/40">{feat.tag}</p>
                <h2 className="font-editorial text-4xl sm:text-5xl lg:text-[3.5rem] font-light leading-[1.05] text-espresso">
                  {feat.title}{' '}
                  <span className="italic text-espresso/75">{feat.titleItalic}</span>
                </h2>
                <p className="text-base text-espresso/55 font-light leading-relaxed">{feat.body}</p>
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 text-sm font-medium text-espresso border-b border-espresso/25 pb-0.5 hover:border-espresso transition-colors group"
                >
                  Try it free
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </Link>
              </motion.div>
            </div>

            {feat.imagePosition === 'right' && (
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.9 }}
                className="relative min-h-[360px] lg:min-h-0"
              >
                <EditorialImage src={feat.image} alt={feat.title} className="absolute inset-0 h-full" />
              </motion.div>
            )}
          </div>
        </section>
      ))}

      {/* ── CAPABILITIES STRIP ──────────────────────────────────── */}
      <section className="px-6 sm:px-12 lg:px-20 py-24 bg-espresso text-cream">
        <div className="max-w-[1400px] mx-auto">
          <p className="text-[11px] uppercase tracking-[0.25em] text-cream/40 mb-4 text-center">Built different</p>
          <h2 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-light text-center mb-16 italic">
            Everything your stylist wish they had.
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Scan, title: 'Body Mapping', desc: 'Shape, undertone, and colour season in one scan.' },
              { icon: Sparkles, title: 'AI Stylist', desc: 'Three ranked outfits every morning with reasoning.' },
              { icon: Shirt, title: 'Smart Closet', desc: 'Auto-tagging, background removal, zero manual entry.' },
              { icon: Palette, title: 'Colour Match', desc: 'Every piece scored against your personal palette.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="p-6 rounded-2xl border border-cream/10 bg-cream/5 hover:bg-cream/8 transition-colors duration-300"
              >
                <Icon className="h-5 w-5 text-wheat mb-4" strokeWidth={1.5} />
                <p className="font-medium text-cream mb-2">{title}</p>
                <p className="text-sm text-cream/50 font-light leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="/images/yellow_sunglasses.png"
            alt="Join Drape and Drop"
            className="w-full h-full object-cover object-[center_20%] brightness-[0.35]"
          />
          <div className="absolute inset-0 bg-espresso/50" />
          <div className="absolute inset-0 grain" />
        </div>
        <div className="relative z-10 px-6 sm:px-12 lg:px-20 py-32 lg:py-40 text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <p className="text-[11px] uppercase tracking-[0.3em] text-cream/50 mb-6">Free to start</p>
            <h2 className="font-editorial text-4xl sm:text-6xl lg:text-7xl font-light text-cream leading-tight mb-6">
              Your best-dressed<br />
              <span className="italic">chapter starts now.</span>
            </h2>
            <p className="text-cream/60 font-light mb-10 max-w-md mx-auto">
              Join 50,000+ people who stopped guessing and started dressing with confidence.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/signup"
                className="inline-flex items-center justify-center gap-2 h-12 px-10 bg-cream hover:bg-ivory text-espresso rounded-full text-sm font-medium transition-all duration-300 shadow-warm hover:-translate-y-0.5"
              >
                Create free account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center justify-center h-12 px-10 border border-cream/30 hover:border-cream/60 text-cream rounded-full text-sm font-medium transition-all duration-300"
              >
                Sign in
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="bg-cream border-t border-espresso/10 px-6 sm:px-12 lg:px-20 py-12">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <Link to="/" className="font-serif italic text-xl text-espresso">Drape&amp;Drop</Link>
          <p className="text-xs text-espresso/40 font-light">© 2026 Drape&amp;Drop · AI Fashion Platform</p>
          <div className="flex gap-6 text-xs text-espresso/45">
            <a href="#" className="hover:text-espresso transition-colors">Privacy</a>
            <a href="#" className="hover:text-espresso transition-colors">Terms</a>
            <a href="#" className="hover:text-espresso transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
