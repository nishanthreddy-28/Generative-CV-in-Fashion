import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/layout/Navbar';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Zap, Sparkles, TrendingUp, Heart, Shield, Rocket } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { AnimatedCard, GradientText, AnimatedBadge, SmoothDivider } from '../components/common/Utilities';

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

const FEATURES = [
  {
    icon: Sparkles,
    title: 'Digital Twin',
    description: 'AI maps your body shape, skin tone, and color season from a single photo.',
    badge: '01',
  },
  {
    icon: Zap,
    title: 'Smart Wardrobe',
    description: 'Digitize your closet in minutes with automatic tagging and categorization.',
    badge: '02',
  },
  {
    icon: TrendingUp,
    title: 'Daily Stylist',
    description: 'Get 3 personalized outfit recommendations every morning, ranked by compatibility.',
    badge: '03',
  },
  {
    icon: Heart,
    title: 'Virtual Try-On',
    description: 'Visualize any item on your body before purchasing from any retailer.',
    badge: '04',
  },
];

const TESTIMONIALS = [
  {
    quote: "Saved me 10 minutes every morning and I've stopped making impulse purchases.",
    name: 'Sarah Chen',
    role: 'Fashion Blogger',
    initials: 'SC',
  },
  {
    quote: 'The AI styling recommendations are eerily accurate. It understands my style better than I do.',
    name: 'Marcus Johnson',
    role: 'Creative Director',
    initials: 'MJ',
  },
  {
    quote: 'Finally, an AI that actually gets fashion. The virtual try-on is a game changer.',
    name: 'Priya Patel',
    role: 'Brand Founder',
    initials: 'PP',
  },
];

const PRICING_PLANS = [
  {
    name: 'Starter',
    price: '0',
    period: 'Free Forever',
    description: 'Perfect for exploring AI styling',
    features: [
      'Up to 50 wardrobe items',
      '5 AI outfits per day',
      'Basic virtual try-on',
      'Color analysis',
    ],
    cta: 'Get Started',
    variant: 'secondary',
  },
  {
    name: 'Pro',
    price: '9.99',
    period: 'per month',
    description: 'For serious fashion enthusiasts',
    features: [
      'Unlimited wardrobe items',
      'Unlimited AI outfits',
      'Advanced virtual try-on',
      'Trend tracking',
      'Gap analysis',
      'Priority support',
    ],
    cta: 'Start Free Trial',
    variant: 'primary',
    popular: true,
  },
  {
    name: 'Studio',
    price: 'Custom',
    period: 'Volume pricing',
    description: 'For fashion professionals',
    features: [
      'Everything in Pro',
      'Client management',
      'Team collaboration',
      'API access',
      'Custom branding',
      'Dedicated support',
    ],
    cta: 'Contact Sales',
    variant: 'secondary',
  },
];

export default function LandingPageV2() {
  const [selectedPlan, setSelectedPlan] = useState(1);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white overflow-hidden">
      <Navbar showNavLinks />

      {/* ═══ HERO SECTION ══════════════════════════════════════════════════ */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Gradient blobs for ambient effect */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          className="relative z-10 text-center max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <AnimatedBadge variant="indigo" className="mb-6">
            ✨ Introducing Drape & Drop v2.0
          </AnimatedBadge>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-semibold tracking-tight text-balance mb-6">
            See Every Outfit <GradientText>Before You Buy</GradientText>
          </h1>

          <p className="text-lg sm:text-xl text-white/70 text-balance max-w-2xl mx-auto mb-8 leading-relaxed">
            AI-powered virtual try-on and personalized styling. Visualize outfits on your body, 
            optimize your wardrobe, and shop with confidence.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link to="/signup">
              <Button variant="primary" size="lg">
                Start Free <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Button variant="secondary" size="lg">
              Watch Demo
            </Button>
          </div>

          {/* Social Proof */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-8 border-t border-white/10">
            <div className="text-center sm:text-left">
              <p className="text-2xl font-semibold text-white">50K+</p>
              <p className="text-sm text-white/60">Active users</p>
            </div>
            <div className="w-px h-8 bg-white/20 hidden sm:block" />
            <div className="text-center sm:text-left">
              <p className="text-2xl font-semibold text-white">2M+</p>
              <p className="text-sm text-white/60">Outfits generated</p>
            </div>
            <div className="w-px h-8 bg-white/20 hidden sm:block" />
            <div className="text-center sm:text-left">
              <p className="text-2xl font-semibold text-white">4.9★</p>
              <p className="text-sm text-white/60">App rating</p>
            </div>
          </div>
        </motion.div>

        {/* Hero Product Image Placeholder */}
        <motion.div
          className="mt-20 relative z-10"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <div className="aspect-video rounded-2xl bg-gradient-to-b from-indigo-600/20 via-indigo-600/5 to-transparent border border-white/10 overflow-hidden group">
            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(99,102,241,0.1)_25%,rgba(99,102,241,0.1)_50%,transparent_50%,transparent_75%,rgba(99,102,241,0.1)_75%,rgba(99,102,241,0.1))] bg-[length:40px_40px] animate-pulse" />
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Sparkles className="w-16 h-16 text-indigo-400 mx-auto mb-4 opacity-50" />
                <p className="text-white/60">Product Demo Coming Soon</p>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      <SmoothDivider className="my-20" />

      {/* ═══ FEATURES SECTION ═════════════════════════════════════════════ */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.badge}
                variants={itemVariants}
              >
                <Card variant="interactive" className="h-full flex flex-col p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div className="p-3 bg-indigo-500/20 rounded-lg">
                      <Icon className="w-6 h-6 text-indigo-400" />
                    </div>
                    <span className="text-xs font-semibold text-indigo-400">{feature.badge}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-white/70 flex-grow">{feature.description}</p>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      <SmoothDivider className="my-20" />

      {/* ═══ HOW IT WORKS ═════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-display font-semibold tracking-tight text-center text-balance mb-4">
            How It Works
          </h2>
          <p className="text-center text-white/70 max-w-2xl mx-auto">
            Get started in 3 simple steps and transform the way you shop.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            { step: '1', title: 'Upload Your Profile', desc: 'Take a quick photo to create your digital twin.' },
            { step: '2', title: 'Scan Your Wardrobe', desc: 'Upload photos of your clothes for automatic tagging.' },
            { step: '3', title: 'Get Styled Daily', desc: 'Receive 3 AI-powered outfit recommendations each day.' },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative"
            >
              <Card className="p-8 text-center h-full">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg mx-auto mb-6">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-white mb-3">{item.title}</h3>
                <p className="text-sm text-white/70">{item.desc}</p>
              </Card>
              {i < 2 && (
                <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-0.5 bg-gradient-to-r from-indigo-500 to-transparent" />
              )}
            </motion.div>
          ))}
        </div>
      </section>

      <SmoothDivider className="my-20" />

      {/* ═══ TESTIMONIALS ═════════════════════════════════════════════════ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-display font-semibold tracking-tight text-center text-balance mb-4">
            Loved by Fashion Enthusiasts
          </h2>
          <p className="text-center text-white/70 max-w-2xl mx-auto">
            See what users are saying about their experience.
          </p>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
        >
          {TESTIMONIALS.map((testimonial) => (
            <motion.div key={testimonial.name} variants={itemVariants}>
              <Card variant="elevated" className="p-8 h-full flex flex-col">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className="text-yellow-400">★</span>
                  ))}
                </div>
                <p className="text-white/90 text-lg mb-6 flex-grow italic">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3 pt-6 border-t border-white/10">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                    {testimonial.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{testimonial.name}</p>
                    <p className="text-xs text-white/60">{testimonial.role}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <SmoothDivider className="my-20" />

      {/* ═══ PRICING SECTION ═══════════════════════════════════════════════ */}
      <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-display font-semibold tracking-tight text-center text-balance mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-center text-white/70 max-w-2xl mx-auto">
            Choose the plan that works best for you. Start free, upgrade anytime.
          </p>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto"
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
        >
          {PRICING_PLANS.map((plan, i) => (
            <motion.div
              key={plan.name}
              variants={itemVariants}
              className={plan.popular ? "md:scale-110 md:col-span-1" : ""}
            >
              <Card
                variant={plan.popular ? "elevated" : "interactive"}
                className={`p-8 h-full flex flex-col relative ${plan.popular ? "border-indigo-500/50" : ""}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-1 rounded-full text-xs font-semibold text-white">
                      Most Popular
                    </span>
                  </div>
                )}

                <h3 className="text-2xl font-semibold text-white mb-2">{plan.name}</h3>
                <p className="text-sm text-white/60 mb-6">{plan.description}</p>

                <div className="mb-6">
                  <span className="text-5xl font-semibold text-white">${plan.price}</span>
                  <span className="text-white/60 ml-2">/{plan.period}</span>
                </div>

                <Button
                  variant={plan.popular ? "primary" : "secondary"}
                  size="lg"
                  className="w-full mb-8"
                >
                  {plan.cta}
                </Button>

                <div className="space-y-4 flex-grow">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span className="text-white/80">{feature}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        <p className="text-center text-white/60 text-sm mt-12">
          All plans include a 14-day free trial. No credit card required.
        </p>
      </section>

      <SmoothDivider className="my-20" />

      {/* ═══ CTA SECTION ═════════════════════════════════════════════════ */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto text-center"
        >
          <div className="relative">
            <div className="absolute -inset-20 bg-gradient-to-r from-indigo-600/20 via-indigo-600/10 to-transparent rounded-2xl blur-3xl" />
            <Card className="relative p-12 border-indigo-500/30 bg-gradient-to-br from-indigo-600/10 via-indigo-600/5 to-transparent">
              <h2 className="text-4xl md:text-5xl font-display font-semibold text-white mb-6 text-balance">
                Ready to Transform Your Style?
              </h2>
              <p className="text-lg text-white/70 mb-8 max-w-2xl mx-auto">
                Join thousands of users who are shopping smarter and looking better.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/signup">
                  <Button variant="primary" size="lg">
                    Get Started Free <Rocket className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        </motion.div>
      </section>

      {/* ═══ FOOTER ═══════════════════════════════════════════════════════ */}
      <footer className="border-t border-white/10 py-12 px-4 sm:px-6 lg:px-8 mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <p className="font-semibold text-white mb-4">Drape & Drop</p>
              <p className="text-sm text-white/60">AI-powered styling for the modern fashionista.</p>
            </div>
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'Security', 'Blog'] },
              { title: 'Company', links: ['About', 'Career', 'Press', 'Contact'] },
              { title: 'Legal', links: ['Privacy', 'Terms', 'Cookies', 'License'] },
            ].map((col) => (
              <div key={col.title}>
                <p className="font-semibold text-white mb-4">{col.title}</p>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}>
                      <a href="#" className="text-sm text-white/60 hover:text-white transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 pt-8">
            <p className="text-center text-sm text-white/60">
              © 2026 Drape & Drop. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
