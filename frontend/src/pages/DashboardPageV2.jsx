import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Sparkles, Shirt, Zap, TrendingUp, Calendar, ArrowRight, Plus,
  Clock, Eye, Star, ChevronRight, Briefcase, Activity
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import { AnimatedCard, AnimatedBadge, SmoothDivider } from '../components/common/Utilities';

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

function StatCard({ icon: Icon, label, value, trend, trendColor = 'emerald' }) {
  const trendColors = {
    emerald: 'text-emerald-400 bg-emerald-500/10',
    indigo: 'text-indigo-400 bg-indigo-500/10',
    rose: 'text-rose-400 bg-rose-500/10',
  };

  return (
    <motion.div variants={itemVariants}>
      <Card className="p-6 h-full">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-indigo-500/20 rounded-lg">
            <Icon className="w-5 h-5 text-indigo-400" />
          </div>
          {trend && (
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${trendColors[trendColor]}`}>
              {trend}
            </span>
          )}
        </div>
        <p className="text-3xl font-semibold text-white mb-1">{value}</p>
        <p className="text-sm text-white/60">{label}</p>
      </Card>
    </motion.div>
  );
}

function QuickActionCard({ icon: Icon, title, description, href, color = 'indigo' }) {
  const bgColors = {
    indigo: 'from-indigo-600/20 via-transparent to-indigo-600/5',
    emerald: 'from-emerald-600/20 via-transparent to-emerald-600/5',
    rose: 'from-rose-600/20 via-transparent to-rose-600/5',
  };

  return (
    <Link to={href}>
      <motion.div
        variants={itemVariants}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Card variant="interactive" className={`p-6 h-full group bg-gradient-to-br ${bgColors[color]}`}>
          <div className="flex items-start justify-between mb-6">
            <div className="p-3 bg-white/10 rounded-lg group-hover:bg-white/20 transition-colors">
              <Icon className="w-6 h-6 text-white" />
            </div>
            <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-white/60 transition-colors transform group-hover:translate-x-1" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
          <p className="text-sm text-white/70">{description}</p>
        </Card>
      </motion.div>
    </Link>
  );
}

function OutfitCard({ title, items, date, rating }) {
  return (
    <motion.div variants={itemVariants}>
      <Card className="overflow-hidden group">
        {/* Outfit Preview Placeholder */}
        <div className="h-40 bg-gradient-to-br from-indigo-600/20 via-indigo-600/10 to-transparent flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(99,102,241,0.1)_25%,rgba(99,102,241,0.1)_50%,transparent_50%,transparent_75%,rgba(99,102,241,0.1)_75%,rgba(99,102,241,0.1))] bg-[length:20px_20px] group-hover:animate-pulse" />
          <Sparkles className="w-8 h-8 text-indigo-400 opacity-50" />
        </div>

        <CardContent className="p-4">
          <h3 className="font-semibold text-white mb-2 line-clamp-2">{title}</h3>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-white/60 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {date}
            </p>
            <div className="flex gap-0.5">
              {[...Array(rating)].map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
          </div>
          <p className="text-xs text-white/60 mb-3">{items} items</p>
          <Button variant="ghost" size="sm" className="w-full text-indigo-400 hover:text-indigo-300">
            View Details <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [greeting, setGreeting] = useState('');
  const [currentHour, setCurrentHour] = useState(new Date().getHours());

  useEffect(() => {
    const hour = new Date().getHours();
    setCurrentHour(hour);
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const stats = [
    { icon: Shirt, label: 'Wardrobe Items', value: '47', trend: '+3 this week', trendColor: 'emerald' },
    { icon: Sparkles, label: 'Outfits Generated', value: '156', trend: '+24 this month', trendColor: 'indigo' },
    { icon: Star, label: 'Style Score', value: '8.7/10', trend: '+0.3 this month', trendColor: 'indigo' },
    { icon: Eye, label: 'Virtual Try-Ons', value: '28', trend: '+8 this month', trendColor: 'rose' },
  ];

  const quickActions = [
    {
      icon: Sparkles,
      title: 'Generate Outfit',
      description: 'Get AI-powered styling recommendations tailored to your wardrobe.',
      href: '/ai-stylist',
      color: 'indigo',
    },
    {
      icon: Plus,
      title: 'Add Item',
      description: 'Upload new clothing pieces to expand your digital wardrobe.',
      href: '/wardrobe',
      color: 'emerald',
    },
    {
      icon: Zap,
      title: 'Virtual Try-On',
      description: 'See how items look on you before making a purchase.',
      href: '/try-on',
      color: 'rose',
    },
    {
      icon: TrendingUp,
      title: 'View Insights',
      description: 'Analyze your style trends and get personalized recommendations.',
      href: '/insights',
      color: 'indigo',
    },
  ];

  const recentOutfits = [
    { title: 'Casual Friday Vibes', items: 3, date: 'Today', rating: 5 },
    { title: 'Office to Evening', items: 4, date: 'Yesterday', rating: 4 },
    { title: 'Weekend Brunch', items: 3, date: '2 days ago', rating: 5 },
  ];

  const todayActivities = [
    { icon: Sparkles, text: 'Generated 3 outfit recommendations', time: '2 hours ago' },
    { icon: Eye, text: 'Tried on 2 items from your wishlist', time: '4 hours ago' },
    { icon: Shirt, text: 'Added 1 new item to your wardrobe', time: '1 day ago' },
  ];

  return (
    <div className="space-y-12 pb-12">
      {/* Header */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-8 border-b border-white/10"
      >
        <motion.div variants={itemVariants}>
          <p className="text-sm text-white/60 mb-2 uppercase tracking-wider">Good morning</p>
          <h1 className="text-4xl md:text-5xl font-display font-semibold text-white text-balance">
            Welcome back, {user?.displayName?.split(' ')[0] || 'Guest'}! 👋
          </h1>
          <p className="text-white/60 mt-2">Here's what's happening with your style today.</p>
        </motion.div>
        <motion.div variants={itemVariants} className="flex gap-2">
          <Button variant="secondary" size="md">
            <Calendar className="w-4 h-4 mr-2" />
            Today
          </Button>
        </motion.div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </motion.div>

      <SmoothDivider />

      {/* Quick Actions */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.h2 variants={itemVariants} className="text-2xl font-semibold text-white mb-6">
          Quick Actions
        </motion.h2>
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          {quickActions.map((action) => (
            <QuickActionCard key={action.title} {...action} />
          ))}
        </motion.div>
      </motion.div>

      <SmoothDivider />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Outfits */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="lg:col-span-2"
        >
          <motion.div variants={itemVariants} className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold text-white">Recent Outfits</h2>
            <Link to="/ai-stylist" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors">
              View All <ArrowRight className="w-3 h-3 inline-block ml-1" />
            </Link>
          </motion.div>
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {recentOutfits.map((outfit) => (
              <OutfitCard key={outfit.title} {...outfit} />
            ))}
          </motion.div>
        </motion.div>

        {/* Activity Feed */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          <motion.h2 variants={itemVariants} className="text-2xl font-semibold text-white mb-6">
            Activity
          </motion.h2>
          <motion.div variants={itemVariants}>
            <Card className="p-6 space-y-4">
              {todayActivities.map((activity, i) => {
                const Icon = activity.icon;
                return (
                  <div key={i} className="flex items-start gap-4 pb-4 last:pb-0 last:border-b-0 border-b border-white/5">
                    <div className="p-2 bg-indigo-500/20 rounded-lg flex-shrink-0">
                      <Icon className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white">{activity.text}</p>
                      <p className="text-xs text-white/60 mt-1">{activity.time}</p>
                    </div>
                  </div>
                );
              })}
            </Card>
          </motion.div>
        </motion.div>
      </div>

      <SmoothDivider />

      {/* Premium CTA */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={itemVariants}>
          <Card className="p-8 border-indigo-500/30 bg-gradient-to-br from-indigo-600/10 via-transparent to-indigo-600/5">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-2xl font-semibold text-white mb-2">Upgrade to Pro</h3>
                <p className="text-white/70 mb-6">
                  Unlock unlimited wardrobe items, advanced AI styling, and priority support.
                </p>
                <Link to="/settings?tab=billing">
                  <Button variant="primary">
                    View Plans <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
              <Briefcase className="w-12 h-12 text-indigo-400 opacity-20 flex-shrink-0" />
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
