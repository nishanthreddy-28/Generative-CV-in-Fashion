import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  User, 
  Shirt, 
  Settings, 
  LogOut, 
  ShoppingBag, 
  Sparkles, 
  Bookmark, 
  ScanFace 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';

export function Sidebar() {
  const location = useLocation();
  const { signOut, user } = useAuth();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'My Wardrobe', href: '/wardrobe', icon: Shirt },
    { name: 'AI Stylist', href: '/ai-stylist', icon: Sparkles },
    { name: 'Virtual Try-On', href: '/try-on', icon: ScanFace },
    { name: 'Saved Outfits', href: '/saved', icon: Bookmark },
  ];

  const secondaryNavigation = [
    { name: 'Profile', href: '/profile', icon: User },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="hidden border-r bg-background/50 backdrop-blur-xl md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col z-30">
      <div className="flex h-16 items-center px-6 border-b border-border/50">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight transition-opacity hover:opacity-80">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <ShoppingBag className="h-5 w-5 text-primary" />
          </div>
          <span className="text-lg">Drape & Drop</span>
        </Link>
      </div>
      
      <div className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar">
        <div className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Platform
        </div>
        <nav className="grid gap-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className={cn(
                  "h-4 w-4 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Account
        </div>
        <nav className="grid gap-1">
          {secondaryNavigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all",
                  isActive 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className={cn(
                  "h-4 w-4 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      
      <div className="mt-auto border-t border-border/50 p-4">
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary font-bold shadow-inner">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex flex-1 flex-col overflow-hidden">
            <span className="truncate text-sm font-semibold">{user?.displayName || 'User'}</span>
            <span className="truncate text-xs text-muted-foreground">{user?.email || 'Not logged in'}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={signOut} title="Log out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
