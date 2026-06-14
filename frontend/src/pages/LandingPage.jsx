import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { ArrowRight, Sparkles, ScanFace, Brain } from 'lucide-react';

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
};

const features = [
  {
    title: 'AI Stylist',
    description: 'Personalized outfit curation tailored to your unique aesthetic, occasion, and environment.',
    icon: Sparkles,
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80&w=500'
  },
  {
    title: 'Virtual Try-On',
    description: 'See how any garment fits instantly. Upload a photo or use a 3D avatar to try on curated catalog pieces virtually before buying.',
    icon: ScanFace,
    image: '/images/virtual_tryon_showcase.png'
  },
  {
    title: 'Wardrobe Analytics',
    description: 'Deep insights into your style evolution, color palettes, and category preferences to optimize your daily looks.',
    icon: Brain,
    image: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&q=80&w=500'
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-[#09090b] text-black dark:text-white overflow-hidden transition-colors duration-300">
      {/* Editorial Hero Section */}
      <section className="relative pt-24 pb-16 lg:pt-32 lg:pb-24">
        {/* Subtle background gradient and glowing blobs */}
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 via-white to-neutral-50/50 dark:from-[#09090b] dark:via-[#0c0c0d] dark:to-[#09090b] pointer-events-none" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 dark:bg-blue-500/10 blur-[120px] rounded-full pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-purple-500/5 dark:bg-purple-500/10 blur-[150px] rounded-full pointer-events-none animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
        
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-8 items-center">
            
            {/* Left Content */}
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="flex flex-col items-start max-w-xl"
            >
              <motion.h1 variants={itemVariants} className="text-5xl md:text-7xl font-light text-black dark:text-white tracking-tight font-display leading-[1.05]">
                Elevate your <br/>
                wardrobe with AI.
              </motion.h1>

              <motion.p variants={itemVariants} className="mt-8 text-lg text-neutral-500 dark:text-neutral-400 font-light leading-relaxed max-w-md">
                Digitize your closet, generate perfect outfits for any occasion, and try on clothes virtually. Experience the future of personal styling.
              </motion.p>

              <motion.div variants={itemVariants} className="mt-12 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <Link to="/signup" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto gap-2 bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black">
                    Start Styling
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/login" className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto border-black text-black hover:bg-neutral-100 dark:border-white dark:text-white dark:hover:bg-neutral-900">
                    Sign In
                  </Button>
                </Link>
              </motion.div>
            </motion.div>

            {/* Right Images (Editorial Layout) */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="relative h-[600px] lg:h-[700px] w-full"
            >
              {/* Background frame — female model */}
              <div className="absolute top-0 right-10 w-[65%] h-[80%] bg-neutral-100 dark:bg-neutral-900 overflow-hidden shadow-soft border border-neutral-200/50 dark:border-neutral-800/50">
                <img 
                  src="/images/hero_fashion_female.png" 
                  alt="High-fashion minimal styling" 
                  className="w-full h-full object-cover object-center transition-transform duration-700 hover:scale-105"
                />
              </div>
              {/* Foreground frame — male model */}
              <div className="absolute bottom-0 left-0 w-[55%] h-[60%] bg-neutral-100 dark:bg-neutral-900 overflow-hidden shadow-soft border-4 border-white dark:border-[#09090b]">
                <img 
                  src="/images/hero_fashion_male.png" 
                  alt="Sleek menswear styling" 
                  className="w-full h-full object-cover object-center transition-transform duration-700 hover:scale-105"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Minimalist Feature Grid */}
      <section className="py-24 bg-neutral-50 dark:bg-[#0c0c0d] border-t border-neutral-100 dark:border-neutral-900 transition-colors duration-300">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
          <div className="mb-16">
            <h2 className="text-3xl font-light text-black dark:text-white tracking-tight font-display">
              Intelligent features.
            </h2>
            <div className="mt-3 h-0.5 w-12 bg-gradient-to-r from-black to-neutral-300 dark:from-white dark:to-neutral-850" />
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                className="group cursor-pointer p-8 bg-white dark:bg-[#111113] border border-neutral-200/60 dark:border-neutral-800/60 rounded-xl transition-all duration-300 hover:shadow-soft hover:border-black dark:hover:border-white relative overflow-hidden"
              >
                {/* Feature Card Image Header */}
                <div className="relative aspect-video w-full overflow-hidden rounded-lg mb-6 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/10 dark:border-neutral-800/20">
                  <img 
                    src={feature.image} 
                    alt={feature.title} 
                    className="w-full h-full object-cover transition-transform duration-750 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/15 via-transparent to-transparent pointer-events-none" />
                </div>

                {/* Subtle hover background glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 to-transparent dark:from-white/[0.01] dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center border border-neutral-200 dark:border-neutral-800 rounded-full transition-all duration-300 group-hover:bg-black dark:group-hover:bg-white group-hover:border-black dark:group-hover:border-white group-hover:scale-110">
                    <feature.icon className="h-4 w-4 text-black dark:text-white transition-colors duration-300 group-hover:text-white dark:group-hover:text-black" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-base font-medium text-black dark:text-white mb-2">{feature.title}</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 font-light leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-white dark:bg-[#09090b] relative overflow-hidden transition-colors duration-300 px-6">
        <div className="max-w-[1280px] mx-auto bg-[#09090b] dark:bg-[#0c0c0d] rounded-2xl p-16 md:p-24 relative overflow-hidden border border-neutral-200/10 dark:border-neutral-800 text-center shadow-2xl">
          {/* Background photo overlay with blur/opacity */}
          <div className="absolute inset-0 opacity-10 mix-blend-overlay">
            <img src="/images/hero_fashion_editorial.png" className="w-full h-full object-cover filter blur-[1px]" alt="" />
          </div>
          {/* Glowing blob */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto space-y-8">
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-4xl md:text-5xl font-light text-white font-display tracking-tight leading-tight"
            >
              Redefine your aesthetic.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="text-sm text-neutral-400 max-w-md mx-auto font-light leading-relaxed"
            >
              Start digitizing your collection and unlock AI styling recommendations. Join the future of personal styling today.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              <Link to="/signup">
                <Button size="lg" className="px-10 bg-white hover:bg-neutral-200 text-black rounded font-medium border-none">
                  Get Started
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

    </div>
  );
}
