import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { GoldCorner } from '@/components/GoldCorner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

const Login = () => {
  const { t } = useLanguage();
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        variant: "destructive",
        title: t.loginError,
        description: error,
      });
    }
    
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto px-4 py-20">
      <div className="relative bg-gradient-to-b from-card to-secondary p-12">
        <GoldCorner position="topLeft" />
        <GoldCorner position="topRight" />
        <GoldCorner position="bottomLeft" />
        <GoldCorner position="bottomRight" />
        <div className="absolute inset-0 border border-border"></div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-2xl text-center text-foreground tracking-[0.15em] uppercase mb-8 font-futura font-normal">
            {t.loginTitle}
          </h2>

          <Alert className="bg-muted border-accent/30">
            <Info className="h-4 w-4 text-accent" />
            <AlertDescription className="text-sm font-futura">
              {t.accountCreationNote}
            </AlertDescription>
          </Alert>

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              type="email"
              placeholder={t.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full p-4 bg-card border-border focus:border-accent font-futura"
            />
            <Input
              type="password"
              placeholder={t.password}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full p-4 bg-card border-border focus:border-accent font-futura"
            />

            <Button 
              type="submit"
              disabled={loading}
              className="w-full relative overflow-hidden bg-foreground hover:bg-foreground/90 text-background py-6 font-futura tracking-[0.15em] uppercase"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/20 to-accent/0 transform translate-x-full group-hover:translate-x-0 transition-transform duration-700"></div>
              <span className="relative">{loading ? '...' : t.loginButton}</span>
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground italic font-serif">
            {t.loginNote}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
