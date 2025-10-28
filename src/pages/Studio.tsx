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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-950 to-gray-900 text-amber-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="relative bg-gradient-to-br from-gray-900 to-green-900 p-12 border-2 border-amber-600 rounded-lg shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-600/20 to-red-900/20 blur-xl"></div>

        <div className="relative z-10 space-y-8">
          <h2 className="text-3xl text-center text-amber-100 tracking-[0.15em] uppercase mb-8 font-futura font-normal">
            {t.studio}
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            <button className="relative p-8 bg-black/40 border border-amber-600/50 hover:border-amber-500 transition-all duration-300 group">
              <Upload size={48} className="mx-auto mb-4 text-amber-500 group-hover:scale-110 transition-transform" strokeWidth={1} />
              <p className="text-amber-200 tracking-wider uppercase font-futura text-sm">
                {t.uploadPhoto}
              </p>
            </button>
            
            <button className="relative p-8 bg-black/40 border border-amber-600/50 hover:border-amber-500 transition-all duration-300 group">
              <Sparkles size={48} className="mx-auto mb-4 text-amber-500 group-hover:scale-110 transition-transform" strokeWidth={1} />
              <p className="text-amber-200 tracking-wider uppercase font-futura text-sm">
                {t.usePrompt}
              </p>
            </button>
          </div>

          <div className="space-y-4">
            <label className="block text-amber-200 tracking-wider uppercase text-sm font-futura">
              {t.presetPrompts}
            </label>
            <select 
              className="w-full p-4 bg-black/40 border border-amber-600/50 focus:border-amber-500 focus:outline-none text-amber-100 font-futura"
              value={selectedPrompt}
              onChange={(e) => setSelectedPrompt(e.target.value)}
            >
              <option value="">Choose a scene...</option>
              {t.presetOptions.map((option, i) => (
                <option key={i} value={option}>{option}</option>
              ))}
            </select>

            <div className="text-center my-4">
              <span className="text-amber-400/60 text-sm font-futura">or</span>
            </div>

            <Textarea
              className="w-full p-4 bg-black/40 border border-amber-600/50 focus:border-amber-500 focus:outline-none text-amber-100 placeholder-amber-400/40 min-h-32 font-futura"
              placeholder={t.customPrompt}
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
            />

            <button 
              onClick={() => setShowPromptGuide(!showPromptGuide)}
              className="text-amber-400 text-sm flex items-center gap-2 hover:text-amber-300 transition-colors font-futura"
            >
              <Info size={16} />
              {t.promptGuideTitle}
            </button>

            {showPromptGuide && (
              <div className="bg-black/40 border border-amber-600/30 p-6 space-y-2">
                {t.promptGuide.map((tip, i) => (
                  <p key={i} className="text-sm text-amber-200 font-futura">
                    • {tip}
                  </p>
                ))}
              </div>
            )}
          </div>

          <Button 
            onClick={handleGenerate}
            className="w-full relative overflow-hidden bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-amber-50 py-6 font-futura tracking-[0.15em] uppercase mt-8"
          >
            <span className="relative">{t.generate}</span>
          </Button>
        </div>
      </div>
    </div>
    </div>
  );
};

export default Studio;
