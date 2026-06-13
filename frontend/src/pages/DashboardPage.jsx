import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Shirt, Camera, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { user } = useAuth();

  const quickActions = [
    {
      title: 'Upload Items',
      description: 'Add new clothing to your virtual wardrobe',
      icon: Camera,
      link: '/wardrobe',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      title: 'Browse Wardrobe',
      description: 'Mix and match your existing items',
      icon: Shirt,
      link: '/wardrobe',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      title: 'AI Stylist',
      description: 'Get outfit recommendations for today',
      icon: Sparkles,
      link: '#',
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10'
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Welcome back!</h1>
        <p className="text-muted-foreground mt-2">
          Here's an overview of your wardrobe and style stats.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {quickActions.map((action) => (
          <div key={action.title} className="rounded-xl border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className={`inline-flex rounded-lg p-3 ${action.bgColor}`}>
              <action.icon className={`h-6 w-6 ${action.color}`} />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{action.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{action.description}</p>
            <div className="mt-4">
              <Link to={action.link}>
                <Button variant="outline" className="w-full">Open</Button>
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
        <div className="text-sm text-muted-foreground italic">
          No recent activity. Start by uploading some items to your wardrobe!
        </div>
      </div>
    </div>
  );
}
