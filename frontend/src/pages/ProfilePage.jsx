import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import toast from 'react-hot-toast';
import { Camera } from 'lucide-react';

export default function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(user?.displayName || '');
  
  // Style preferences dummy state
  const [preferences, setPreferences] = useState({
    casual: true,
    formal: false,
    streetwear: true,
    minimalist: false,
  });

  const handleSave = (e) => {
    e.preventDefault();
    setLoading(true);
    // Simulate save
    setTimeout(() => {
      toast.success('Profile updated successfully');
      setLoading(false);
    }, 1000);
  };

  const togglePreference = (key) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground mt-2">Manage your public profile and style preferences.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        <div className="flex items-center gap-6">
          <div className="relative h-24 w-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-muted-foreground">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            )}
            <button type="button" className="absolute bottom-0 left-0 right-0 bg-black/50 py-1 text-center text-xs text-white hover:bg-black/70">
              <Camera className="mx-auto h-4 w-4" />
            </button>
          </div>
          <div>
            <h3 className="font-medium">Profile Picture</h3>
            <p className="text-sm text-muted-foreground">JPG, GIF or PNG. Max size of 2MB.</p>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Display Name</label>
            <Input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Your name" 
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Email</label>
            <Input 
              value={user?.email || ''} 
              disabled 
              className="bg-muted/50 cursor-not-allowed" 
            />
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium">Style Preferences</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(preferences).map(([key, value]) => (
              <button
                key={key}
                type="button"
                onClick={() => togglePreference(key)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors border ${
                  value 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'bg-transparent text-foreground hover:bg-muted border-input'
                }`}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    </div>
  );
}
