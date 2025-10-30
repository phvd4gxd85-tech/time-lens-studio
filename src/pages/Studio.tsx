import { useState } from 'react';
import { Upload, Sparkles, Video, Camera, Download } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
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
  const [videoPrompt, setVideoPrompt] = useState('');
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null);
  
  // Image states
  const [imagePrompt, setImagePrompt] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedVideo(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

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
              STUDIO
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
                  <label className="relative p-8 bg-black/40 border border-amber-600/50 hover:border-amber-500 transition-all duration-300 group cursor-pointer">
                    <input
                      type="file"
                      accept="video/*,image/*"
                      onChange={handleVideoUpload}
                      className="hidden"
                    />
                    <Upload size={48} className="mx-auto mb-4 text-amber-500 group-hover:scale-110 transition-transform" strokeWidth={1} />
                    <p className="text-amber-200 tracking-wider uppercase font-futura text-sm">
                      LADDA UPP BILD/VIDEO
                    </p>
                  </label>
                  
                  <button 
                    onClick={() => setUploadedVideo(null)}
                    className="relative p-8 bg-black/40 border border-amber-600/50 hover:border-amber-500 transition-all duration-300 group"
                  >
                    <Sparkles size={48} className="mx-auto mb-4 text-amber-500 group-hover:scale-110 transition-transform" strokeWidth={1} />
                    <p className="text-amber-200 tracking-wider uppercase font-futura text-sm">
                      SKAPA MED TEXT
                    </p>
                  </button>
                </div>

                {uploadedVideo && (
                  <div className="bg-black/40 border border-amber-600/30 p-4">
                    <img src={uploadedVideo} alt="Uploaded" className="w-full max-h-64 object-contain rounded" />
                  </div>
                )}

                <Textarea
                  className="w-full p-4 bg-black/40 border border-amber-600/50 focus:border-amber-500 focus:outline-none text-amber-100 placeholder-amber-400/40 min-h-32 font-futura"
                  placeholder="Beskriv vad som ska hända... (t.ex. 'hon vänder sig om och ler, vinden vajar')"
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                />

                <Button 
                  onClick={handleGenerateVideo}
                  className="w-full relative overflow-hidden bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-amber-50 py-6 font-futura tracking-[0.15em] uppercase mt-8"
                >
                  <span className="relative">GENERERA</span>
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
                    onClick={() => setUploadedImage(null)}
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

                <Textarea
                  className="w-full p-4 bg-black/40 border border-amber-600/50 focus:border-amber-500 focus:outline-none text-amber-100 placeholder-amber-400/40 min-h-32 font-futura"
                  placeholder={uploadedImage ? "Beskriv hur bilden ska ändras... (t.ex. 'gör bakgrunden till en solnedgång')" : "Beskriv bilden du vill skapa... (t.ex. 'en katt på en gren i solnedgång')"}
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                />

                <div className="bg-amber-900/20 border border-amber-600/30 p-4 rounded">
                  <p className="text-amber-200 text-sm font-futura">
                    ⚠️ <strong>OBS:</strong> Det går inte alltid att ändra personer i bilder p.g.a integritetspolicy. Prova att ändra bakgrund, ljus, eller lägg till objekt istället.
                  </p>
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
                    {isGenerating ? "GENERERAR..." : "GENERERA"}
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
