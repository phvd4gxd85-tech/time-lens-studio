import { useState } from 'react';
import { Upload, Sparkles, Info, Video, Camera, Download } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { GoldCorner } from '@/components/GoldCorner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const Studio = () => {
  const { t } = useLanguage();
  const { user, videos, images, refreshCredits } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Video states
  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPromptGuide, setShowPromptGuide] = useState(false);
  
  // Image states
  const [imagePrompt, setImagePrompt] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageMode, setImageMode] = useState<'prompt' | 'edit'>('prompt');

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleGenerateVideo = () => {
    if (videos < 1) {
      toast({
        variant: "destructive",
        title: "Inga videos kvar",
        description: "Köp fler videos för att fortsätta.",
      });
      return;
    }

    toast({
      title: "Kommer snart",
      description: "Videogenerering kommer snart.",
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
        setImageMode('edit');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateImage = async () => {
    if (images < 1) {
      toast({
        variant: "destructive",
        title: "Inga bilder kvar",
        description: "Köp fler bilder för att fortsätta.",
      });
      return;
    }

    if (!imagePrompt && !uploadedImage) {
      toast({
        variant: "destructive",
        title: "Prompt krävs",
        description: "Skriv en beskrivning eller ladda upp en bild.",
      });
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: {
          prompt: imagePrompt,
          imageUrl: uploadedImage
        }
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
        await refreshCredits();
        toast({
          title: "Bild genererad!",
          description: "Din bild är klar.",
        });
      }
    } catch (error) {
      console.error('Image generation error:', error);
      toast({
        variant: "destructive",
        title: "Fel vid generering",
        description: error instanceof Error ? error.message : "Kunde inte generera bild.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadImage = () => {
    if (!generatedImage) return;

    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = 'vintage-ai-image.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Nedladdning startad",
      description: "Din bild laddas ner.",
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

          <Tabs defaultValue="videos" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-black/40 border border-amber-600/50">
              <TabsTrigger 
                value="videos" 
                className="data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-100 text-amber-400 font-futura tracking-wider"
              >
                <Video className="mr-2" size={18} />
                VIDEOS
              </TabsTrigger>
              <TabsTrigger 
                value="images"
                className="data-[state=active]:bg-amber-600/20 data-[state=active]:text-amber-100 text-amber-400 font-futura tracking-wider"
              >
                <Camera className="mr-2" size={18} />
                BILDER
              </TabsTrigger>
            </TabsList>

            <TabsContent value="videos" className="space-y-6 mt-6">
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
                  <option value="">Välj en scen...</option>
                  {t.presetOptions.map((option, i) => (
                    <option key={i} value={option}>{option}</option>
                  ))}
                </select>

                <div className="text-center my-4">
                  <span className="text-amber-400/60 text-sm font-futura">eller</span>
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
                onClick={handleGenerateVideo}
                className="w-full relative overflow-hidden bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-amber-50 py-6 font-futura tracking-[0.15em] uppercase mt-8"
              >
                <span className="relative">GENERERA VIDEO</span>
              </Button>
            </TabsContent>

            <TabsContent value="images" className="space-y-6 mt-6">
              <div className="grid md:grid-cols-2 gap-6">
                <label className="relative p-8 bg-black/40 border border-amber-600/50 hover:border-amber-500 transition-all duration-300 group cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Upload size={48} className="mx-auto mb-4 text-amber-500 group-hover:scale-110 transition-transform" strokeWidth={1} />
                  <p className="text-amber-200 tracking-wider uppercase font-futura text-sm">
                    LADDA UPP BILD
                  </p>
                  <p className="text-amber-400/60 text-xs mt-2 font-futura">
                    För att redigera befintlig bild
                  </p>
                </label>
                
                <button 
                  onClick={() => {
                    setImageMode('prompt');
                    setUploadedImage(null);
                  }}
                  className="relative p-8 bg-black/40 border border-amber-600/50 hover:border-amber-500 transition-all duration-300 group"
                >
                  <Sparkles size={48} className="mx-auto mb-4 text-amber-500 group-hover:scale-110 transition-transform" strokeWidth={1} />
                  <p className="text-amber-200 tracking-wider uppercase font-futura text-sm">
                    SKAPA MED TEXT
                  </p>
                  <p className="text-amber-400/60 text-xs mt-2 font-futura">
                    Beskriv din vision
                  </p>
                </button>
              </div>

              {uploadedImage && (
                <div className="bg-black/40 border border-amber-600/30 p-4">
                  <img src={uploadedImage} alt="Uploaded" className="w-full max-h-64 object-contain rounded" />
                </div>
              )}

              <div className="space-y-4">
                <Textarea
                  className="w-full p-4 bg-black/40 border border-amber-600/50 focus:border-amber-500 focus:outline-none text-amber-100 placeholder-amber-400/40 min-h-32 font-futura"
                  placeholder={imageMode === 'edit' ? "Beskriv hur bilden ska ändras... (t.ex. 'gör bakgrunden till en solnedgång')" : "Beskriv bilden du vill skapa... (t.ex. 'en katt på en gren i solnedgång')"}
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                />

                <div className="bg-amber-900/20 border border-amber-600/30 p-4 rounded">
                  <p className="text-amber-200 text-sm font-futura">
                    ⚠️ <strong>OBS:</strong> Det går inte alltid att ändra personer i bilder p.g.a integritetspolicy. Prova att ändra bakgrund, ljus, eller lägg till objekt istället.
                  </p>
                </div>
              </div>

              {generatedImage && (
                <div className="space-y-4">
                  <div className="bg-black/40 border border-amber-600/30 p-4">
                    <img src={generatedImage} alt="Generated" className="w-full rounded" />
                  </div>
                  <Button
                    onClick={handleDownloadImage}
                    className="w-full bg-green-700 hover:bg-green-600 text-white py-6 font-futura tracking-[0.15em] uppercase"
                  >
                    <Download className="mr-2" size={18} />
                    LADDA NER BILD
                  </Button>
                </div>
              )}

              <Button 
                onClick={handleGenerateImage}
                disabled={isGenerating}
                className="w-full relative overflow-hidden bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-amber-50 py-6 font-futura tracking-[0.15em] uppercase disabled:opacity-50"
              >
                <span className="relative">
                  {isGenerating ? "GENERERAR..." : "GENERERA BILD"}
                </span>
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
    </div>
  );
};

export default Studio;
