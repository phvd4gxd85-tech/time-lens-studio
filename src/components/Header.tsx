import { Globe, LogIn, LogOut, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';

export const Header = () => {
  const { language, setLanguage, t } = useLanguage();
  const { user, tokens, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="relative bg-gradient-to-b from-card to-secondary border-b border-border">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent"></div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <button 
            onClick={() => navigate('/')}
            className="text-2xl text-foreground tracking-[0.2em] hover:text-accent transition-colors font-futura font-light"
          >
            {t.title}
          </button>

          <div className="flex items-center gap-6">
            <Button
              variant="ghost"
              onClick={() => setLanguage(language === 'sv' ? 'en' : 'sv')}
              className="flex items-center gap-2 text-foreground hover:text-accent transition-colors font-futura"
            >
              <Globe size={18} />
              <span className="text-sm tracking-wider uppercase">{language === 'sv' ? 'EN' : 'SV'}</span>
            </Button>

            {user && (
              <div className="flex items-center gap-2 text-foreground font-futura">
                <Sparkles size={18} className="text-accent" />
                <span className="text-sm tracking-wider">{tokens} {t.tokens}</span>
              </div>
            )}

            {user ? (
              <Button
                variant="ghost"
                onClick={signOut}
                className="flex items-center gap-2 text-foreground hover:text-accent transition-colors font-futura"
              >
                <LogOut size={18} />
                <span className="text-sm tracking-wider uppercase">{t.logout}</span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={() => navigate('/login')}
                className="flex items-center gap-2 text-foreground hover:text-accent transition-colors font-futura"
              >
                <LogIn size={18} />
                <span className="text-sm tracking-wider uppercase">{t.login}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
