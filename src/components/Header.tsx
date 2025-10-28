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
    <header className="relative bg-transparent border-b border-amber-600/30">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-600 to-transparent"></div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <button 
            onClick={() => navigate('/')}
            className="text-2xl text-amber-100 tracking-[0.2em] hover:text-amber-300 transition-colors font-futura font-light"
          >
            {t.title}
          </button>

          <div className="flex items-center gap-6">
            <Button
              variant="ghost"
              onClick={() => setLanguage(language === 'sv' ? 'en' : 'sv')}
              className="flex items-center gap-2 text-amber-100 hover:text-amber-300 transition-colors font-futura"
            >
              <Globe size={18} />
              <span className="text-sm tracking-wider uppercase">{language === 'sv' ? 'EN' : 'SV'}</span>
            </Button>

            {user && (
              <div className="flex items-center gap-2 text-amber-100 font-futura">
                <Sparkles size={18} className="text-amber-500" />
                <span className="text-sm tracking-wider">{tokens} {t.tokens}</span>
              </div>
            )}

            {user ? (
              <Button
                variant="ghost"
                onClick={signOut}
                className="flex items-center gap-2 text-amber-100 hover:text-amber-300 transition-colors font-futura"
              >
                <LogOut size={18} />
                <span className="text-sm tracking-wider uppercase">{t.logout}</span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={() => navigate('/login')}
                className="flex items-center gap-2 text-amber-100 hover:text-amber-300 transition-colors font-futura"
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
