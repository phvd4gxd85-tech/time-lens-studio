import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

const Login = () => {
  const { t } = useLanguage();
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSignUp && password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: t.passwordsDontMatch,
      });
      return;
    }
    
    setLoading(true);

    const { error } = isSignUp 
      ? await signUp(email, password)
      : await signIn(email, password);
    
    if (error) {
      toast({
        variant: "destructive",
        title: t.loginError,
        description: error,
      });
    } else if (isSignUp) {
      toast({
        title: t.signupSuccess,
      });
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setIsSignUp(false);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-950 to-gray-900 text-amber-50 relative">
      {/* Art Deco Corner Ornaments */}
      <div className="fixed top-0 left-0 w-32 h-32 pointer-events-none z-50">
        <svg viewBox="0 0 100 100" className="w-full h-full opacity-60">
          <path d="M0,0 L60,0 L55,5 L5,5 L5,55 L0,60 Z" fill="#D4AF37"/>
          <path d="M0,0 L50,0 L45,5 L10,5 L10,45 L5,50 L0,50 Z" fill="#B8860B"/>
          <path d="M0,0 L40,0 L35,5 L15,5 L15,35 L10,40 L0,40 Z" fill="#DAA520"/>
        </svg>
      </div>
      <div className="fixed top-0 right-0 w-32 h-32 pointer-events-none z-50">
        <svg viewBox="0 0 100 100" className="w-full h-full opacity-60">
          <path d="M100,0 L40,0 L45,5 L95,5 L95,55 L100,60 Z" fill="#D4AF37"/>
          <path d="M100,0 L50,0 L55,5 L90,5 L90,45 L95,50 L100,50 Z" fill="#B8860B"/>
          <path d="M100,0 L60,0 L65,5 L85,5 L85,35 L90,40 L100,40 Z" fill="#DAA520"/>
        </svg>
      </div>
      <div className="fixed bottom-0 left-0 w-32 h-32 pointer-events-none z-50">
        <svg viewBox="0 0 100 100" className="w-full h-full opacity-60">
          <path d="M0,100 L60,100 L55,95 L5,95 L5,45 L0,40 Z" fill="#D4AF37"/>
          <path d="M0,100 L50,100 L45,95 L10,95 L10,55 L5,50 L0,50 Z" fill="#B8860B"/>
          <path d="M0,100 L40,100 L35,95 L15,95 L15,65 L10,60 L0,60 Z" fill="#DAA520"/>
        </svg>
      </div>
      <div className="fixed bottom-0 right-0 w-32 h-32 pointer-events-none z-50">
        <svg viewBox="0 0 100 100" className="w-full h-full opacity-60">
          <path d="M100,100 L40,100 L45,95 L95,95 L95,45 L100,40 Z" fill="#D4AF37"/>
          <path d="M100,100 L50,100 L55,95 L90,95 L90,55 L95,50 L100,50 Z" fill="#B8860B"/>
          <path d="M100,100 L60,100 L65,95 L85,95 L85,65 L90,60 L100,60 Z" fill="#DAA520"/>
        </svg>
      </div>

      <div className="max-w-md mx-auto px-4 py-8">
        <div className="relative bg-gradient-to-br from-gray-900 to-green-900 p-12 border-2 border-amber-600 rounded-lg shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-600/20 to-red-900/20 blur-xl"></div>

          <div className="relative z-10 space-y-6">
            <div className="flex justify-center mb-8">
              <div className="flex items-center gap-4">
                <div className="w-16 h-0.5 bg-gradient-to-r from-transparent to-amber-600"></div>
                <svg width="40" height="40" viewBox="0 0 40 40">
                  <path d="M20,5 L25,15 L35,15 L27,22 L30,32 L20,25 L10,32 L13,22 L5,15 L15,15 Z" fill="#D4AF37"/>
                </svg>
                <div className="w-16 h-0.5 bg-gradient-to-l from-transparent to-amber-600"></div>
              </div>
            </div>

            <h2 className="text-3xl text-center text-amber-100 tracking-[0.15em] uppercase mb-8 font-bold">
              {isSignUp ? t.signupTitle : t.loginTitle}
            </h2>

            <Alert className="bg-black/40 border-amber-600/30">
              <Info className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-sm text-amber-200/80">
                {t.accountCreationNote}
              </AlertDescription>
            </Alert>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                placeholder={t.email}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full p-4 bg-black/40 border-amber-600/50 focus:border-amber-500 text-amber-100 placeholder-amber-400/40"
              />
              <Input
                type="password"
                placeholder={t.password}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full p-4 bg-black/40 border-amber-600/50 focus:border-amber-500 text-amber-100 placeholder-amber-400/40"
              />
              
              {isSignUp && (
                <Input
                  type="password"
                  placeholder={t.confirmPassword}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full p-4 bg-black/40 border-amber-600/50 focus:border-amber-500 text-amber-100 placeholder-amber-400/40"
                />
              )}

              <Button 
                type="submit"
                disabled={loading}
                className="w-full relative overflow-hidden bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-amber-50 py-6 font-bold tracking-[0.15em] uppercase"
              >
                <span className="relative">{loading ? '...' : (isSignUp ? t.signupButton : t.loginButton)}</span>
              </Button>
            </form>

            <div className="text-center space-y-2">
              <p className="text-sm text-amber-300/60 italic">
                {isSignUp ? t.alreadyHaveAccount : t.noAccountYet}
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setEmail('');
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="text-amber-400 hover:text-amber-300 underline text-sm font-semibold"
              >
                {isSignUp ? t.switchToLogin : t.switchToSignup}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
