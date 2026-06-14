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
  },
  {
    title: 'Virtual Try-On',
    description: 'See how any garment fits instantly. Upload a photo or use a 3D avatar to try on curated catalog pieces virtually before buying.',
    icon: ScanFace,
  },
  {
    title: 'Wardrobe Analytics',
    description: 'Deep insights into your style evolution, color palettes, and category preferences to optimize your daily looks.',
    icon: Brain,
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

          <div className="grid md:grid-cols-3 gap-12">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6 }}
                className="group cursor-default"
              >
                <div className="mb-6 flex h-12 w-12 items-center justify-center border border-black dark:border-white rounded-full transition-all duration-300 group-hover:bg-black dark:group-hover:bg-white group-hover:scale-110">
                  <feature.icon className="h-5 w-5 text-black dark:text-white transition-colors duration-300 group-hover:text-white dark:group-hover:text-black" strokeWidth={1.5} />
                </div>
                <h3 className="text-lg font-medium text-black dark:text-white mb-3">{feature.title}</h3>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 font-light leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 bg-white dark:bg-[#09090b] relative overflow-hidden transition-colors duration-300">
        {/* Subtle radial gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,0,0,0.02)_0%,_transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.01)_0%,_transparent_70%)] pointer-events-none" />
        
        <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
           <motion.h2 
             initial={{ opacity: 0, y: 20 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             transition={{ duration: 0.6 }}
             className="text-4xl font-light text-black dark:text-white font-display tracking-tight mb-8"
           >
             Redefine your aesthetic.
           </motion.h2>
           <motion.div
             initial={{ opacity: 0, y: 10 }}
             whileInView={{ opacity: 1, y: 0 }}
             viewport={{ once: true }}
             transition={{ delay: 0.2, duration: 0.6 }}
           >
             <Link to="/signup">
               <Button size="lg" className="px-10 bg-black hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-200 dark:text-black">
                 Get Started
               </Button>
             </Link>
           </motion.div>
        </div>
      </section>
    </div>
  );
}
