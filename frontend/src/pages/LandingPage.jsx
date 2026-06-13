import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '../components/ui/Button';
import { ArrowRight, Sparkles, Shirt, ScanFace, CheckCircle2, ChevronDown } from 'lucide-react';

export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const yParallax = useTransform(scrollYProgress, [0, 1], [0, 300]);

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Hero Section with Animated Mesh Gradient */}
      <section className="relative pt-20 pb-32 lg:pt-32 lg:pb-40 overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 -z-10 bg-background overflow-hidden">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              x: [0, 50, 0],
              y: [0, 30, 0]
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
            className="absolute top-[-20%] left-[-10%] w-[50%] h-[60%] rounded-full bg-primary/20 blur-[120px] mix-blend-screen"
          />
          <motion.div 
            animate={{ 
              scale: [1, 1.3, 1],
              x: [0, -60, 0],
              y: [0, -40, 0]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-purple-500/20 blur-[120px] mix-blend-screen"
          />
        </div>
        
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-8 items-center">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-2xl"
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-8 shadow-[0_0_15px_rgba(var(--primary),0.2)]"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Drape & Drop 2.0 is here
              </motion.div>
              
              <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl lg:text-7xl mb-6">
                Your <span className="bg-gradient-to-r from-primary via-purple-500 to-primary bg-[length:200%_auto] animate-gradient bg-clip-text text-transparent">AI Stylist</span> & Virtual Wardrobe
              </h1>
              
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className="text-xl text-muted-foreground mb-10 leading-relaxed"
              >
                Elevate your personal style. Upload your clothing, let AI mix and match outfits, and visualize looks with our virtual try-on technology.
              </motion.p>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="flex flex-col sm:flex-row gap-4"
              >
                <Link to="/signup">
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-600 rounded-lg blur opacity-40 group-hover:opacity-75 transition duration-500 animate-pulse"></div>
                    <Button size="lg" className="relative h-14 px-8 text-lg w-full sm:w-auto shadow-xl transition-all duration-300 group-hover:scale-[1.02]">
                      Start Styling for Free <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </div>
                </Link>
                <Link to="/login">
                  <Button size="lg" variant="outline" className="h-14 px-8 text-lg w-full sm:w-auto border-border hover:bg-muted/50 transition-all duration-300 hover:scale-[1.02]">
                    See How It Works
                  </Button>
                </Link>
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6, duration: 1 }}
                className="mt-12 flex items-center gap-4 text-sm text-muted-foreground font-medium"
              >
                <div className="flex -space-x-3">
                  <img className="inline-block h-10 w-10 rounded-full ring-2 ring-background transition-transform hover:-translate-y-1 hover:z-10" src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100&auto=format&fit=crop" alt=""/>
                  <img className="inline-block h-10 w-10 rounded-full ring-2 ring-background transition-transform hover:-translate-y-1 hover:z-10" src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=100&auto=format&fit=crop" alt=""/>
                  <img className="inline-block h-10 w-10 rounded-full ring-2 ring-background transition-transform hover:-translate-y-1 hover:z-10" src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100&auto=format&fit=crop" alt=""/>
                  <img className="inline-block h-10 w-10 rounded-full ring-2 ring-background transition-transform hover:-translate-y-1 hover:z-10" src="https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=100&auto=format&fit=crop" alt=""/>
                </div>
                <span>Join 10,000+ fashion enthusiasts</span>
              </motion.div>
            </motion.div>

            {/* Floating Hero Visuals */}
            <div className="relative hidden lg:block h-[600px] w-full perspective-1000">
              <motion.div
                initial={{ opacity: 0, y: 50, rotateY: 20 }}
                animate={{ opacity: 1, y: 0, rotateY: 0 }}
                transition={{ duration: 1.2, delay: 0.2, type: "spring", stiffness: 50 }}
                whileHover={{ scale: 1.05, rotate: -2, y: -10 }}
                className="absolute top-10 right-20 z-20 w-64 rounded-2xl border border-white/10 bg-card/80 backdrop-blur-xl p-4 shadow-2xl transition-all duration-300"
              >
                <img src="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=400&auto=format&fit=crop" className="rounded-xl h-64 w-full object-cover mb-4 shadow-inner" alt="Outfit" />
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-sm">Weekend Casual</h3>
                    <p className="text-xs text-muted-foreground">Generated by AI</p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 shadow-[0_0_10px_rgba(var(--primary),0.3)]">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 100, rotateY: -20 }}
                animate={{ opacity: 1, y: 0, rotateY: 0 }}
                transition={{ duration: 1.2, delay: 0.4, type: "spring", stiffness: 50 }}
                whileHover={{ scale: 1.05, rotate: 3, y: -10 }}
                className="absolute bottom-20 left-10 z-30 w-56 rounded-2xl border border-white/10 bg-card/80 backdrop-blur-xl p-4 shadow-2xl transition-all duration-300"
              >
                <img src="https://images.unsplash.com/photo-1591561954557-26941169b49e?q=80&w=400&auto=format&fit=crop" className="rounded-xl h-48 w-full object-cover mb-4 shadow-inner" alt="Bag" />
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-sm">Leather Tote</h3>
                  <Badge>Matches 8 outfits</Badge>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted By Logos */}
      <motion.section 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        className="border-y border-border/50 bg-muted/30 py-12"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-8">
            Trusted by stylists and featured in
          </p>
          <div className="flex flex-wrap justify-center gap-12 lg:gap-20 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
            <div className="text-2xl font-bold font-serif tracking-widest transition-transform hover:scale-110">VOGUE</div>
            <div className="text-2xl font-bold tracking-tighter transition-transform hover:scale-110">GQ</div>
            <div className="text-2xl font-bold tracking-widest transition-transform hover:scale-110">ELLE</div>
            <div className="text-2xl font-bold tracking-widest italic transition-transform hover:scale-110">Harper's BAZAAR</div>
            <div className="text-2xl font-bold transition-transform hover:scale-110">HYPEBEAST</div>
          </div>
        </div>
      </motion.section>

      {/* Features Showcase */}
      <section className="py-24 lg:py-32 relative">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-3xl mx-auto mb-20"
          >
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl mb-6">Everything you need to dress better</h2>
            <p className="text-xl text-muted-foreground">
              Stop standing in front of a full closet feeling like you have nothing to wear. Drape & Drop manages, organizes, and styles your clothes for you.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={Shirt}
              title="Digital Wardrobe"
              description="Easily digitize your closet. Snap a photo and our AI removes the background, categorizes the item, and extracts its dominant colors."
              image="https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?q=80&w=600&auto=format&fit=crop"
            />
            <FeatureCard 
              icon={Sparkles}
              title="AI Stylist"
              description="Get daily outfit recommendations based on weather, occasion, and your personal style preferences."
              image="https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=600&auto=format&fit=crop"
              delay={0.2}
            />
            <FeatureCard 
              icon={ScanFace}
              title="Virtual Try-On"
              description="See how outfits look before putting them on. Our state-of-the-art visualizer maps clothing onto a digital mannequin."
              image="https://images.unsplash.com/photo-1550614000-4b95dd24546a?q=80&w=600&auto=format&fit=crop"
              delay={0.4}
            />
          </div>
        </div>
      </section>

      {/* Stats Section with Parallax */}
      <section className="py-32 bg-zinc-950 text-white relative overflow-hidden">
        <motion.div 
          style={{ y: yParallax }}
          className="absolute inset-[-50%] opacity-20 bg-[url('https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=2942&auto=format&fit=crop')] bg-cover bg-center mix-blend-luminosity pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 to-transparent"></div>
        <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12 text-center divide-y md:divide-y-0 md:divide-x divide-white/10">
            <StatBlock value="2M+" label="Clothing Items Digitized" delay={0} />
            <StatBlock value="150k" label="Outfits Generated Daily" delay={0.2} />
            <StatBlock value="45m" label="Time Saved Every Morning" delay={0.4} />
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 lg:py-32 bg-muted/20">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl font-bold tracking-tight text-center mb-16"
          >
            Don't just take our word for it
          </motion.h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <TestimonialCard 
              quote="This app changed my life. I actually wear 100% of my closet now instead of the same 5 outfits."
              name="Sarah Jenkins"
              role="Art Director"
              image="https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150&auto=format&fit=crop"
              delay={0}
            />
            <TestimonialCard 
              quote="The AI stylist is scary good. It puts together combinations I never would have thought of."
              name="David Kim"
              role="Software Engineer"
              image="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=150&auto=format&fit=crop"
              delay={0.2}
            />
            <TestimonialCard 
              quote="Packing for trips used to be a nightmare. Now I just generate a capsule wardrobe in 2 minutes."
              name="Amelia Vance"
              role="Travel Blogger"
              image="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop"
              delay={0.4}
            />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 lg:py-32 relative">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[100px] -z-10"></div>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold tracking-tight mb-4">Frequently Asked Questions</h2>
            <p className="text-muted-foreground">Everything you need to know about the product and billing.</p>
          </motion.div>
          <div className="space-y-4">
            <FaqItem 
              question="How does the AI background removal work?"
              answer="Simply upload a photo of your clothing item laying flat or on a hanger. Our AI automatically detects the garment, removes the background perfectly, and crops it to save space."
            />
            <FaqItem 
              question="Is Drape & Drop free to use?"
              answer="We offer a generous free tier that lets you store up to 100 clothing items and generate 5 outfits per day. Our Pro plan ($8/mo) offers unlimited items, unlimited outfits, and advanced virtual try-on features."
            />
            <FaqItem 
              question="How accurate is the Virtual Try-On?"
              answer="Our latest V3 model uses advanced diffusion techniques to map clothing onto your body type with highly realistic drape, lighting, and shadow effects."
            />
          </div>
        </div>
      </section>

      {/* CTA Parallax */}
      <section className="relative py-32 overflow-hidden bg-black">
        <motion.div 
          style={{ y: yParallax }}
          className="absolute inset-[-50%] bg-[url('https://images.unsplash.com/photo-1550614000-4b95dd24546a?q=80&w=2940&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay opacity-30 pointer-events-none"
        />
        <div className="absolute inset-0 bg-primary/20 backdrop-blur-[2px]"></div>
        <div className="container relative z-10 mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-6xl mb-6 drop-shadow-lg">Ready to upgrade your style?</h2>
            <p className="text-xl text-white/90 mb-10 max-w-2xl mx-auto drop-shadow-md font-medium">
              Join the fashion revolution today. Start digitizing your wardrobe and let AI handle your daily outfit struggles.
            </p>
            <Link to="/signup">
              <div className="inline-block relative group">
                <div className="absolute -inset-1 bg-white rounded-full blur opacity-30 group-hover:opacity-70 transition duration-500 animate-pulse"></div>
                <Button size="lg" className="relative h-16 px-12 text-lg rounded-full font-bold bg-white text-black hover:bg-zinc-100 hover:scale-105 transition-all shadow-2xl">
                  Create Free Account
                </Button>
              </div>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

function StatBlock({ value, label, delay }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay }}
      className="pt-8 md:pt-0"
    >
      <div className="text-6xl font-extrabold text-primary mb-3 drop-shadow-[0_0_15px_rgba(var(--primary),0.5)]">{value}</div>
      <div className="text-lg text-zinc-300 font-medium">{label}</div>
    </motion.div>
  );
}

function FeatureCard({ icon: Icon, title, description, image, delay = 0 }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -10 }}
      className="group rounded-[2rem] border border-border/50 bg-card overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500"
    >
      <div className="h-64 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent z-10 transition-opacity duration-500 group-hover:opacity-80"></div>
        <motion.img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
        />
      </div>
      <div className="p-8 relative z-20 -mt-20">
        <motion.div 
          whileHover={{ scale: 1.1, rotate: 5 }}
          className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mb-6 shadow-xl shadow-primary/30"
        >
          <Icon className="h-8 w-8" />
        </motion.div>
        <h3 className="text-2xl font-bold mb-3 transition-colors group-hover:text-primary">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

function TestimonialCard({ quote, name, role, image, delay }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="rounded-3xl border border-border/50 bg-card p-8 shadow-md hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
    >
      <div className="flex gap-1 text-primary mb-6">
        {[...Array(5)].map((_, i) => (
          <motion.svg 
            key={i} 
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ delay: delay + (i * 0.1) }}
            className="h-5 w-5 fill-current drop-shadow-[0_0_5px_rgba(var(--primary),0.5)]" 
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </motion.svg>
        ))}
      </div>
      <p className="text-lg italic mb-8 text-foreground/90">"{quote}"</p>
      <div className="flex items-center gap-4">
        <img src={image} alt={name} className="h-12 w-12 rounded-full object-cover ring-2 ring-primary/20" />
        <div>
          <div className="font-semibold">{name}</div>
          <div className="text-sm text-muted-foreground">{role}</div>
        </div>
      </div>
    </motion.div>
  );
}

function FaqItem({ question, answer }) {
  const [isOpen, setIsOpen] = React.useState(false);
  
  return (
    <motion.div 
      initial={false}
      animate={{ backgroundColor: isOpen ? "var(--muted)" : "var(--card)" }}
      className="border border-border/50 rounded-2xl overflow-hidden transition-colors"
    >
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-6 text-left group focus:outline-none"
      >
        <span className="text-lg font-semibold group-hover:text-primary transition-colors">{question}</span>
        <motion.div 
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <ChevronDown className="h-5 w-5" />
        </motion.div>
      </button>
      <motion.div 
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="overflow-hidden px-6"
      >
        <p className="text-muted-foreground pb-6 leading-relaxed">{answer}</p>
      </motion.div>
    </motion.div>
  );
}

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary/20 shadow-sm">
      {children}
    </span>
  );
}
