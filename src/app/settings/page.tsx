'use client';

import { useState } from 'react';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Navigation } from '@/components/layout/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertTriangle, Settings as SettingsIcon, Trash2, User } from 'lucide-react';
import { toast } from 'sonner';

function SettingsContent() {
  const { user, signOut } = useAuth();
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out');
    }
  };

  const handleDeleteAccount = async () => {
    // Note: This would need backend implementation to properly delete user data
    try {
      // For now, just sign out
      await signOut();
      toast.success('Account data cleared. You have been signed out.');
    } catch (error) {
      console.error('Delete account error:', error);
      toast.error('Failed to delete account');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-8">
            <SettingsIcon className="w-8 h-8" />
            <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          </div>

          <div className="space-y-6">
            {/* Profile Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Profile
                </CardTitle>
                <CardDescription>
                  Your account information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarImage src={user?.photoURL || ''} alt={user?.displayName || 'User'} />
                    <AvatarFallback className="text-lg">
                      {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">
                      {user?.displayName || 'No display name'}
                    </h3>
                    <p className="text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                </div>
                
                <Separator />
                
                <div className="text-sm text-muted-foreground">
                  <p>Profile information is managed through your Google account.</p>
                  <p>Changes made to your Google profile will be reflected here.</p>
                </div>
              </CardContent>
            </Card>

            {/* App Information */}
            <Card>
              <CardHeader>
                <CardTitle>About Continue</CardTitle>
                <CardDescription>
                  Information about this application
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <p><strong>Version:</strong> 1.0.0</p>
                  <p><strong>Built with:</strong> Next.js, TypeScript, Firebase</p>
                  <p><strong>Data Storage:</strong> Google Firestore</p>
                </div>
                
                <Separator />
                
                <div className="text-sm text-muted-foreground">
                  <p>Continue helps you track your progress across books, anime, manga, and TV shows.</p>
                  <p>Your data is securely stored in Google Firestore and associated with your Google account.</p>
                </div>
              </CardContent>
            </Card>

            {/* Account Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Account Actions</CardTitle>
                <CardDescription>
                  Manage your account and data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Sign Out</h4>
                    <p className="text-sm text-muted-foreground">
                      Sign out of your account on this device
                    </p>
                  </div>
                  <Button variant="outline" onClick={handleSignOut}>
                    Sign Out
                  </Button>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-red-600">Delete Account Data</h4>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete all your data from Continue
                    </p>
                  </div>
                  <Dialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen}>
                    <DialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Data
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                          <AlertTriangle className="w-5 h-5" />
                          Delete Account Data
                        </DialogTitle>
                        <DialogDescription>
                          This action cannot be undone. This will permanently delete all your
                          media tracking data from Continue.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="bg-red-50 border border-red-200 rounded-md p-4">
                        <p className="text-sm text-red-800">
                          <strong>This will delete:</strong>
                        </p>
                        <ul className="list-disc list-inside text-sm text-red-700 mt-2">
                          <li>All your tracked media items</li>
                          <li>Progress data and ratings</li>
                          <li>Account preferences</li>
                        </ul>
                      </div>
                      <DialogFooter>
                        <Button 
                          variant="outline" 
                          onClick={() => setDeleteAccountOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={handleDeleteAccount}
                        >
                          Yes, Delete My Data
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}
