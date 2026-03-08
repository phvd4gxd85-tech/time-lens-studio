import { Upload, Film, Sparkles, Video, Download, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { VEO3VideoGenerator } from '@/components/VEO3VideoGenerator';
import { PromptAssistant } from '@/components/PromptAssistant';

const Dashboard = () => {
  const { toast } = useToast();
  const { language } = useLanguage();
  const { user, loading, refreshCredits } = useAuth();
  const navigate = useNavigate();

  // Image generation states
  const [imagePrompt, setImagePrompt] = useState('');
  const [uploadedImageForGen, setUploadedImageForGen] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  // Check for Stripe payment success on page load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    
    if (sessionId) {
      window.history.replaceState({}, '', window.location.pathname);
      
      const verifyPayment = async () => {
        try {
          const { data, error } = await supabase.functions.invoke('verify-payment', {
            body: { session_id: sessionId }
          });

          if (error) {
            toast({
              title: language === 'sv' ? "Verifieringsfel" : "Verification Error",
              description: language === 'sv' 
                ? "Kunde inte verifiera betalningen. Kontakta support." 
                : "Could not verify payment. Contact support.",
              variant: "destructive",
            });
            return;
          }

          await refreshCredits();
          
          toast({
            title: language === 'sv' ? "Betalning Lyckades!" : "Payment Successful!",
            description: language === 'sv' 
              ? `Dina krediter har lagts till: ${data.credits_added.videos} videos och ${data.credits_added.images} bilder` 
              : `Your credits have been added: ${data.credits_added.videos} videos and ${data.credits_added.images} images`,
          });
        } catch (err) {
          console.error('Error verifying payment:', err);
        }
      };
      
      verifyPayment();
    }
  }, [language, refreshCredits, toast]);

  const handleImageUploadForGen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setUploadedImageForGen(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt && !uploadedImageForGen) {
      toast({
        title: language === 'sv' ? "Prompt eller bild krävs" : "Prompt or image required",
        description: language === 'sv' ? "Vänligen beskriv vad du vill skapa eller ladda upp en bild" : "Please describe what you want to create or upload an image",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingImage(true);
    setGeneratedImage(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: language === 'sv' ? "Autentisering krävs" : "Authentication required",
          description: language === 'sv' ? "Vänligen logga in för att generera bilder" : "Please log in to generate images",
          variant: "destructive",
        });
        setIsGeneratingImage(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-image', {
        body: { 
          prompt: imagePrompt,
          imageUrl: uploadedImageForGen 
        }
      });

      if (error) {
        if (error.message?.includes('Insufficient')) {
          toast({
            title: language === 'sv' ? "Inte tillräckligt med krediter" : "Insufficient credits",
            description: language === 'sv' ? "Köp fler krediter för att fortsätta." : "Purchase more credits to continue.",
            variant: "destructive",
          });
          setIsGeneratingImage(false);
          return;
        }
        throw new Error(error.message || 'Failed to generate image');
      }

      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
        await refreshCredits();
        toast({
          title: language === 'sv' ? "Bild klar!" : "Image ready!",
          description: language === 'sv' ? "Din bild har genererats framgångsrikt" : "Your image has been generated successfully",
        });
      }
    } catch (error) {
      console.error('Generate image error:', error);
      toast({
        title: language === 'sv' ? "Genereringsfel" : "Generation error",
        description: error instanceof Error ? error.message : (language === 'sv' ? "Misslyckades med att generera bild" : "Failed to generate image"),
        variant: "destructive",
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleDownloadImage = () => {
    if (!generatedImage) return;
    const a = document.createElement('a');
    a.href = generatedImage;
    a.download = 'vintage-ai-image.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-green-950 to-gray-900">
        <p className="text-amber-200 text-xl animate-pulse">
          {language === 'sv' ? 'Laddar...' : 'Loading...'}
        </p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 via-green-950 to-gray-900 text-amber-50" style={{ fontFamily: "'Playfair Display', serif" }}>
      
      {/* Welcome Section */}
      <div className="relative pt-8 pb-12 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-amber-100 mb-4">
            {language === 'sv' ? 'Din Studio' : 'Your Studio'}
          </h1>
          <p className="text-amber-200/70 text-lg">
            {language === 'sv' ? 'Skapa bilder och videor med AI' : 'Create images and videos with AI'}
          </p>
        </div>
      </div>

      {/* Video Generator Section */}
      <div className="relative py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <VEO3VideoGenerator />
        </div>
      </div>

      {/* Image Generator Section */}
      <div className="relative py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-4xl mx-auto relative">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-600/20 to-red-900/20 blur-xl"></div>
            <div className="relative bg-[#0f172a] p-8 md:p-12 border-2 border-amber-600 rounded-lg shadow-2xl">
              <div className="flex justify-center mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-0.5 bg-gradient-to-r from-transparent to-amber-600"></div>
                  <Camera className="w-8 h-8 text-amber-500" />
                  <div className="w-16 h-0.5 bg-gradient-to-l from-transparent to-amber-600"></div>
                </div>
              </div>

              <h2 className="text-3xl md:text-4xl font-bold mb-8 text-amber-100">
                {language === 'sv' ? 'Skapa Bilder' : 'Create Images'}
              </h2>

              <div className="bg-black/30 p-6 rounded-lg border border-amber-600/30 mb-8">
                <p className="text-amber-200/90 leading-relaxed">
                  {language === 'sv' 
                    ? 'Skapa en helt ny bild från en textbeskrivning, eller ladda upp en befintlig bild och beskriv vad du vill ändra.' 
                    : 'Create a brand new image from a text description, or upload an existing image and describe what you want to change.'}
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="block">
                    <div className="border-2 border-dashed border-amber-600 rounded-lg p-8 hover:border-amber-500 transition-all cursor-pointer bg-black/30 hover:bg-black/50 group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUploadForGen}
                        className="hidden"
                      />
                      {uploadedImageForGen ? (
                        <img src={uploadedImageForGen} alt="Uploaded" className="w-full h-48 object-cover rounded" />
                      ) : (
                        <div className="text-center">
                          <Upload className="w-16 h-16 mx-auto mb-4 text-amber-600 group-hover:text-amber-500 transition-colors" />
                          <p className="text-amber-200 text-lg">{language === 'sv' ? 'Ladda upp bild' : 'Upload image'}</p>
                          <p className="text-amber-400/60 text-sm mt-2">{language === 'sv' ? 'Valfritt - för bildredigering' : 'Optional - for image editing'}</p>
                        </div>
                      )}
                    </div>
                  </label>

                  <textarea
                    value={imagePrompt}
                    onChange={(e) => setImagePrompt(e.target.value)}
                    placeholder={language === 'sv' ? 'Beskriv bilden du vill skapa...' : 'Describe the image you want to create...'}
                    className="w-full p-4 bg-black/40 border border-amber-600/50 rounded text-amber-100 placeholder-amber-400/40 focus:outline-none focus:border-amber-500 h-32"
                  />
                </div>

                <div className="space-y-4">
                  <div className="bg-black/40 border border-amber-600/50 rounded-lg p-6 h-48 flex items-center justify-center overflow-hidden">
                    {generatedImage ? (
                      <img src={generatedImage} alt="Generated" className="w-full h-full object-contain rounded" />
                    ) : isGeneratingImage ? (
                      <div className="text-center">
                        <Camera className="w-16 h-16 mx-auto mb-4 text-amber-500 animate-pulse" />
                        <p className="text-amber-300 text-lg font-semibold">{language === 'sv' ? 'Skapar bild...' : 'Creating image...'}</p>
                      </div>
                    ) : (
                      <div className="text-center text-amber-400/40">
                        <Camera className="w-16 h-16 mx-auto mb-4" />
                        <p>{language === 'sv' ? 'Din bild här' : 'Your image here'}</p>
                      </div>
                    )}
                  </div>

                  {generatedImage && (
                    <button
                      onClick={handleDownloadImage}
                      className="w-full bg-gradient-to-r from-amber-800 to-amber-700 hover:from-amber-700 hover:to-amber-600 text-amber-50 font-bold py-4 px-6 rounded transition-all duration-300 shadow-lg hover:shadow-amber-700/50 flex items-center justify-center gap-2"
                    >
                      <Download className="w-5 h-5" />
                      {language === 'sv' ? 'LADDA NER BILD' : 'DOWNLOAD IMAGE'}
                    </button>
                  )}

                  <button
                    onClick={handleGenerateImage}
                    disabled={(!imagePrompt && !uploadedImageForGen) || isGeneratingImage}
                    className="w-full bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 disabled:from-gray-700 disabled:to-gray-600 text-amber-50 font-bold py-4 px-6 rounded transition-all duration-300 shadow-lg hover:shadow-amber-600/50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-5 h-5" />
                    {isGeneratingImage ? (language === 'sv' ? 'GENERERAR...' : 'GENERATING...') : (language === 'sv' ? 'GENERERA BILD' : 'GENERATE IMAGE')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing / Buy more credits */}
      <div className="relative py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-amber-100 mb-4">
            {language === 'sv' ? 'Köp fler krediter' : 'Buy more credits'}
          </h2>
          <p className="text-amber-200/60 mb-8">
            {language === 'sv' ? 'Behöver du fler bilder eller videor?' : 'Need more images or videos?'}
          </p>
          <button
            onClick={() => navigate('/#priser')}
            className="bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-amber-50 font-bold py-4 px-8 rounded-lg transition-all duration-300 shadow-lg hover:shadow-amber-600/50"
          >
            {language === 'sv' ? 'Se paket & priser' : 'View packages & pricing'}
          </button>
        </div>
      </div>

      {/* Prompt Assistant */}
      <PromptAssistant />
    </div>
  );
};

export default Dashboard;
