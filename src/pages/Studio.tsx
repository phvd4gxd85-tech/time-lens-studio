import { useState } from 'react';
import { Upload, Sparkles, Info } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { GoldCorner } from '@/components/GoldCorner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const Studio = () => {
  const { t } = useLanguage();
  const { user, tokens } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPromptGuide, setShowPromptGuide] = useState(false);

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleGenerate = () => {
    if (tokens < 1) {
      toast({
        variant: "destructive",
        title: "Insufficient tokens",
        description: "Please purchase more tokens to continue.",
      });
      return;
    }

    toast({
      title: "Coming Soon",
      description: "Video generation will be available shortly.",
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="relative bg-gradient-to-b from-card to-secondary p-12">
        <GoldCorner position="topLeft" />
        <GoldCorner position="topRight" />
        <GoldCorner position="bottomLeft" />
        <GoldCorner position="bottomRight" />
        <div className="absolute inset-0 border border-border"></div>

        <div className="relative z-10 space-y-8">
          <h2 className="text-3xl text-center text-foreground tracking-[0.15em] uppercase mb-8 font-futura font-normal">
            {t.studio}
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <button className="relative p-8 bg-card border border-border hover:border-accent transition-all duration-300 group">
              <Upload size={48} className="mx-auto mb-4 text-accent group-hover:scale-110 transition-transform" strokeWidth={1} />
              <p className="text-foreground tracking-wider uppercase font-futura text-sm">
                {t.uploadPhoto}
              </p>
            </button>
            
            <button className="relative p-8 bg-card border border-border hover:border-accent transition-all duration-300 group">
              <Sparkles size={48} className="mx-auto mb-4 text-accent group-hover:scale-110 transition-transform" strokeWidth={1} />
              <p className="text-foreground tracking-wider uppercase font-futura text-sm">
                {t.usePrompt}
              </p>
            </button>
          </div>

          <div className="space-y-4">
            <label className="block text-foreground tracking-wider uppercase text-sm font-futura">
              {t.presetPrompts}
            </label>
            <select 
              className="w-full p-4 bg-card border border-border focus:border-accent focus:outline-none text-foreground font-futura"
              value={selectedPrompt}
              onChange={(e) => setSelectedPrompt(e.target.value)}
            >
              <option value="">Choose a scene...</option>
              {t.presetOptions.map((option, i) => (
                <option key={i} value={option}>{option}</option>
              ))}
            </select>

            <div className="text-center my-4">
              <span className="text-muted-foreground text-sm font-futura">or</span>
            </div>

            <Textarea
              className="w-full p-4 bg-card border border-border focus:border-accent focus:outline-none text-foreground min-h-32 font-futura"
              placeholder={t.customPrompt}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
            />

            <button 
              onClick={() => setShowPromptGuide(!showPromptGuide)}
              className="text-accent text-sm flex items-center gap-2 hover:text-accent/80 transition-colors font-futura"
            >
              <Info size={16} />
              {t.promptGuideTitle}
            </button>

            {showPromptGuide && (
              <div className="bg-card border border-accent/30 p-6 space-y-2">
                {t.promptGuide.map((tip, i) => (
                  <p key={i} className="text-sm text-foreground font-futura">
                    • {tip}
                  </p>
                ))}
              </div>
            )}
          </div>

          <Button 
            onClick={handleGenerate}
            className="w-full relative overflow-hidden bg-foreground hover:bg-foreground/90 text-background py-6 font-futura tracking-[0.15em] uppercase mt-8"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/20 to-accent/0 transform translate-x-full group-hover:translate-x-0 transition-transform duration-700"></div>
            <span className="relative">{t.generate}</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Studio;
