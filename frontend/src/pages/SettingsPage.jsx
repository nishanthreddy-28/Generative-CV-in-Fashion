import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Failed to log out');
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your account settings and preferences.</p>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Account</h3>
            <p className="text-sm text-muted-foreground mt-1">Update your email and password.</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email Address</p>
                <p className="text-sm text-muted-foreground">Your email cannot be changed currently.</p>
              </div>
              <Button variant="outline" disabled>Change</Button>
            </div>
            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <p className="font-medium">Password</p>
                <p className="text-sm text-muted-foreground">Change your password to keep your account secure.</p>
              </div>
              <Button variant="outline">Update</Button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Notifications</h3>
            <p className="text-sm text-muted-foreground mt-1">Manage what we send to your inbox.</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Outfit Suggestions</p>
                <p className="text-sm text-muted-foreground">Daily AI generated outfit ideas.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <p className="font-medium">Marketing Emails</p>
                <p className="text-sm text-muted-foreground">Receive news and updates about Drape & Drop.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-destructive/20 bg-destructive/5 overflow-hidden">
          <div className="p-6 border-b border-destructive/20">
            <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
            <p className="text-sm text-destructive/80 mt-1">Irreversible actions for your account.</p>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Sign Out</p>
                <p className="text-sm text-muted-foreground">Log out of this device.</p>
              </div>
              <Button variant="outline" onClick={handleSignOut}>Log Out</Button>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-destructive/20">
              <div>
                <p className="font-medium">Delete Account</p>
                <p className="text-sm text-muted-foreground">Permanently remove your account and all data.</p>
              </div>
              <Button variant="destructive">Delete Account</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
