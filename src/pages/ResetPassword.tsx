import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const ResetPassword = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setReady(true);
    } else {
      // Also listen for auth state change with recovery event
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setReady(true);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({
        variant: 'destructive',
        title: language === 'sv' ? 'Lösenordet för kort' : 'Password too short',
        description: language === 'sv' ? 'Minst 6 tecken krävs.' : 'At least 6 characters required.',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        variant: 'destructive',
        title: language === 'sv' ? 'Lösenorden matchar inte' : 'Passwords do not match',
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast({
        variant: 'destructive',
        title: language === 'sv' ? 'Något gick fel' : 'Something went wrong',
        description: error.message,
      });
    } else {
      toast({
        title: language === 'sv' ? 'Lösenord uppdaterat!' : 'Password updated!',
        description: language === 'sv' ? 'Du kan nu logga in med ditt nya lösenord.' : 'You can now log in with your new password.',
      });
      navigate('/login');
    }
    setLoading(false);
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-green-950 to-gray-900">
        <p className="text-amber-200 text-xl animate-pulse">
          {language === 'sv' ? 'Verifierar länk...' : 'Verifying link...'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-950 to-gray-900 text-amber-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="relative bg-gradient-to-br from-gray-900 to-green-900 p-12 border-2 border-amber-600 rounded-lg shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-600/20 to-red-900/20 blur-xl"></div>
          <div className="relative z-10 space-y-6">
            <h2 className="text-3xl text-center text-amber-100 tracking-[0.15em] uppercase mb-8 font-bold">
              {language === 'sv' ? 'Nytt Lösenord' : 'New Password'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="password"
                placeholder={language === 'sv' ? 'Nytt lösenord' : 'New password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full p-4 bg-black/40 border-amber-600/50 focus:border-amber-500 text-amber-100 placeholder-amber-400/40"
              />
              <Input
                type="password"
                placeholder={language === 'sv' ? 'Bekräfta lösenord' : 'Confirm password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full p-4 bg-black/40 border-amber-600/50 focus:border-amber-500 text-amber-100 placeholder-amber-400/40"
              />
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-white py-6 font-bold tracking-[0.15em] uppercase"
              >
                {loading
                  ? '...'
                  : language === 'sv' ? 'Spara lösenord' : 'Save password'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;