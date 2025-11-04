import { Upload, Film, Sparkles, Video, Lightbulb, Zap, Download, Camera, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import vintageAiExample from '@/assets/vintage-ai-example.jpeg';
import exampleVideo from '@/assets/example-video.mov';
import santaExample from '@/assets/santa-example.mov';
import { VEO3VideoGenerator } from '@/components/VEO3VideoGenerator';
import { PromptAssistant } from '@/components/PromptAssistant';

const Home = () => {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const { refreshCredits } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  
  // Image generation states
  const [imagePrompt, setImagePrompt] = useState('');
  const [uploadedImageForGen, setUploadedImageForGen] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  // Check for Stripe payment success on page load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    
    if (sessionId) {
      console.log('Stripe session detected, verifying payment:', sessionId);
      
      // Clear URL parameters
      window.history.replaceState({}, '', window.location.pathname);
      
      // Verify payment and add credits
      const verifyPayment = async () => {
        try {
          const { data, error } = await supabase.functions.invoke('verify-payment', {
            body: { session_id: sessionId }
          });

          if (error) {
            console.error('Payment verification error:', error);
            toast({
              title: language === 'sv' ? "Verifieringsfel" : "Verification Error",
              description: language === 'sv' 
                ? "Kunde inte verifiera betalningen. Kontakta support om problemet kvarstår." 
                : "Could not verify payment. Contact support if the issue persists.",
              variant: "destructive",
            });
            return;
          }

          console.log('Payment verified:', data);
          
          // Refresh credits
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

  const PRICE_IDS = {
    starter: "price_1SNsvKQt7FLZjS8hXtfTMW47",  // $6
    classic: "price_1SNsvaQt7FLZjS8hoxcTNsfN",  // $20
    premier: "price_1SNswDQt7FLZjS8huIapxFyx",  // $55
  };

  const handlePurchase = async (packageType: 'starter' | 'classic' | 'premier') => {
    setLoading(packageType);
    console.log('Starting payment for package:', packageType);
    
    try {
      const priceId = PRICE_IDS[packageType];
      console.log('Using price ID:', priceId);
      
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { priceId, packageType }
      });

      console.log('Payment response:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data?.url) {
        console.log('Redirecting to Stripe checkout:', data.url);
        window.location.href = data.url;
      } else {
        throw new Error(language === 'sv' ? 'Ingen checkout URL mottagen' : 'No checkout URL received');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: language === 'sv' ? "Fel vid betalning" : "Payment error",
        description: error instanceof Error ? error.message : (language === 'sv' ? "Kunde inte starta betalning. Försök igen." : "Could not start payment. Please try again."),
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setUploadedImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

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
        console.error('Generate image error:', error);
        if (error.message?.includes('Insufficient tokens')) {
          toast({
            title: language === 'sv' ? "Inte tillräckligt med tokens" : "Insufficient tokens",
            description: language === 'sv' ? "Du har inte tillräckligt med image tokens. Köp fler tokens för att fortsätta." : "You don't have enough image tokens. Please purchase more tokens to continue.",
            variant: "destructive",
          });
          setIsGeneratingImage(false);
          return;
        }
        throw new Error(error.message || 'Failed to generate image');
      }

      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
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
    
    toast({
      title: language === 'sv' ? "Nedladdning startad" : "Download started",
      description: language === 'sv' ? "Din bild laddas ner" : "Your image is downloading",
    });
  };

  const handleDownload = async () => {
    if (!videoUrl) return;

    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const file = new File([blob], 'vintage-ai-video.mp4', { type: 'video/mp4' });

      // Check if Web Share API is available (mobile devices)
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: language === 'sv' ? 'Min Vintage AI Video' : 'My Vintage AI Video',
          text: language === 'sv' ? 'Kolla in den här videon jag skapade!' : 'Check out this video I created!'
        });
      } else {
        // Fallback to traditional download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'vintage-ai-video.mp4';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        toast({
          title: language === 'sv' ? "Nedladdning startad" : "Download started",
          description: language === 'sv' ? "Din video laddas ner" : "Your video is downloading",
        });
      }
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: language === 'sv' ? "Nedladdningsfel" : "Download error",
        description: language === 'sv' ? "Kunde inte ladda ner videon" : "Could not download the video",
        variant: "destructive",
      });
    }
  };

  const handleGenerate = async () => {
    if (!prompt) {
      toast({
        title: language === 'sv' ? "Prompt krävs" : "Prompt required",
        description: language === 'sv' ? "Vänligen beskriv vad du vill skapa" : "Please describe what you want to create",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setVideoUrl(null);
    setProgress(0);

    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: language === 'sv' ? "Autentisering krävs" : "Authentication required",
          description: language === 'sv' ? "Vänligen logga in för att generera videor" : "Please log in to generate videos",
          variant: "destructive",
        });
        setIsGenerating(false);
        return;
      }

      // Start video generation
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: { 
          prompt,
          imageUrl: uploadedImage 
        }
      });

      if (error) {
        console.error('Generate video error:', error);
        // Check if it's a token error
        if (error.message?.includes('Insufficient tokens')) {
          toast({
            title: language === 'sv' ? "Inte tillräckligt med tokens" : "Insufficient tokens",
            description: language === 'sv' ? "Du har inte tillräckligt med tokens. Köp fler tokens för att fortsätta." : "You don't have enough tokens. Please purchase more tokens to continue.",
            variant: "destructive",
          });
          setIsGenerating(false);
          return;
        }
        throw new Error(error.message || 'Failed to start video generation');
      }

      if (!data?.generation_id) {
        console.error('Invalid response:', data);
        throw new Error('No generation ID received from server');
      }

      const genId = data.generation_id;
      setGenerationId(genId);
      console.log('Video generation started:', genId);

      // Start polling for status updates
      const pollInterval = setInterval(async () => {
        console.log('Polling video status...');
        try {
          await supabase.functions.invoke('poll-video-status');
          
          // Also check status directly as backup
          const { data: videoData } = await supabase
            .from('video_generations')
            .select('*')
            .eq('generation_id', genId)
            .single();
          
          if (videoData) {
            console.log('Direct status check:', videoData);
            setProgress(videoData.progress || 0);
            
            if (videoData.status === 'completed' && videoData.video_url) {
              setVideoUrl(videoData.video_url);
              setIsGenerating(false);
              clearInterval(pollInterval);
              channel.unsubscribe();
              toast({
                title: language === 'sv' ? "Video klar!" : "Video ready!",
                description: language === 'sv' ? "Din video har genererats framgångsrikt" : "Your video has been generated successfully",
              });
            } else if (videoData.status === 'failed') {
              setIsGenerating(false);
              clearInterval(pollInterval);
              channel.unsubscribe();
              toast({
                title: language === 'sv' ? "Generering misslyckades" : "Generation failed",
                description: videoData.error_message || (language === 'sv' ? "Något gick fel. Försök igen." : "Something went wrong. Please try again."),
                variant: "destructive",
              });
            }
          }
        } catch (error) {
          console.error('Poll error:', error);
        }
      }, 3000); // Poll every 3 seconds

      // Subscribe to realtime updates
      const channel = supabase
        .channel('video-generation-updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'video_generations',
            filter: `generation_id=eq.${genId}`
          },
          (payload) => {
            console.log('Realtime update:', payload);
            const newData = payload.new as any;
            
            setProgress(newData.progress || 0);
            
            if (newData.status === 'completed' && newData.video_url) {
              setVideoUrl(newData.video_url);
              setIsGenerating(false);
              clearInterval(pollInterval);
              channel.unsubscribe();
              toast({
                title: language === 'sv' ? "Video klar!" : "Video ready!",
                description: language === 'sv' ? "Din video har genererats framgångsrikt" : "Your video has been generated successfully",
              });
            } else if (newData.status === 'failed') {
              setIsGenerating(false);
              clearInterval(pollInterval);
              channel.unsubscribe();
              toast({
                title: language === 'sv' ? "Generering misslyckades" : "Generation failed",
                description: newData.error_message || (language === 'sv' ? "Något gick fel. Försök igen." : "Something went wrong. Please try again."),
                variant: "destructive",
              });
            }
          }
        )
        .subscribe();

      // Timeout after 10 minutes
      const timeout = setTimeout(() => {
        if (isGenerating) {
          setIsGenerating(false);
          clearInterval(pollInterval);
          channel.unsubscribe();
          toast({
            title: language === 'sv' ? "Tidsgräns" : "Timeout",
            description: language === 'sv' ? "Videogenereringen tog för lång tid. Försök igen." : "Video generation took too long. Please try again.",
            variant: "destructive",
          });
        }
      }, 600000);

    } catch (error) {
      console.error('Generate error:', error);
      setIsGenerating(false);
      toast({
        title: language === 'sv' ? "Genereringsfel" : "Generation error",
        description: error instanceof Error ? error.message : (language === 'sv' ? "Misslyckades med att generera video" : "Failed to generate video"),
        variant: "destructive",
      });
    }
  };

  const examplePrompt = "Wayne Gretzky åker framåt mot kameran, Edmonton Oilers tröja, tar skottet mot mål, is sprayas upp när han bromsar, arenaljus reflekterar i isen, 80-talets kornig VHS-känsla, slow motion, publiken suddig i bakgrunden";

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-900 via-green-950 to-gray-900 text-amber-50" style={{ fontFamily: "'Playfair Display', serif" }}>
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

      {/* Hero Section */}
      <div className="relative pt-4 pb-32 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="mb-8">
            <h1 className="text-7xl md:text-8xl font-bold tracking-wider mb-4 text-amber-100">
              Vintage AI
            </h1>
            <div className="flex justify-center mb-6">
              <svg width="200" height="60" viewBox="0 0 200 60">
                <path d="M20,30 Q40,10 60,30 T100,30 T140,30 T180,30" 
                      stroke="#D4AF37" strokeWidth="2" fill="none"/>
                <rect x="15" y="20" width="8" height="20" fill="#D4AF37" opacity="0.6"/>
                <rect x="25" y="20" width="8" height="20" fill="#D4AF37" opacity="0.4"/>
                <rect x="35" y="20" width="8" height="20" fill="#D4AF37" opacity="0.6"/>
                <rect x="157" y="20" width="8" height="20" fill="#D4AF37" opacity="0.6"/>
                <rect x="167" y="20" width="8" height="20" fill="#D4AF37" opacity="0.4"/>
                <rect x="177" y="20" width="8" height="20" fill="#D4AF37" opacity="0.6"/>
              </svg>
            </div>
            <p className="text-2xl md:text-3xl text-amber-200 font-light mb-4">
              {t.subtitle}
            </p>
            <p className="text-lg md:text-xl text-amber-300/80 max-w-3xl mx-auto">
              {t.tagline}
            </p>
          </div>

          {/* Example Video Showcase */}
          <div className="max-w-4xl mx-auto mt-12 mb-12">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-600/20 to-amber-800/20 blur-2xl"></div>
              <div className="relative">
                <video 
                  src={exampleVideo} 
                  controls 
                  autoPlay
                  loop
                  playsInline
                  className="w-full aspect-video rounded-lg shadow-2xl border-2 border-amber-600/50 object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VEO3 Video Generator Section */}
      <div className="relative py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <VEO3VideoGenerator />
        </div>
      </div>

      {/* Image Generator Section */}
      <div className="relative py-24 px-4">
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

              <div className="bg-amber-900/30 p-6 rounded-lg border border-amber-500/50 mb-8">
                <div className="flex items-start gap-3">
                  <MessageCircle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-1" />
                  <div>
                    <h4 className="text-xl font-bold text-amber-100 mb-2">
                      {language === 'sv' ? 'Behöver du hjälp med prompten?' : 'Need help with your prompt?'}
                    </h4>
                    <p className="text-amber-200/90">
                      {language === 'sv' 
                        ? 'Du kan alltid diskutera med Chatbotten nere i högra hörnet först. Chatbotten kan hjälpa dig att formulera en perfekt prompt för just din vision! (Läs mer om hur du skriver en bra prompt längre ner på sidan.)' 
                        : 'You can always discuss with the Chatbot in the bottom right corner first. The Chatbot can help you formulate a perfect prompt for your specific vision! (Read more about how to write a good prompt further down the page.)'}
                    </p>
                  </div>
                </div>
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

              <div className="flex justify-center mt-8">
                <div className="flex items-center gap-4">
                  <div className="w-24 h-0.5 bg-gradient-to-r from-transparent to-amber-600"></div>
                  <div className="w-2 h-2 bg-amber-600 rotate-45"></div>
                  <div className="w-24 h-0.5 bg-gradient-to-l from-transparent to-amber-600"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inspiration Example */}
      <div className="relative py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-amber-100 mb-4">
              {language === 'sv' ? 'Skapa Magin' : 'Create the Magic'}
            </h2>
            <p className="text-amber-200/70 text-lg">
              {language === 'sv' 
                ? 'Ett exempel på vad du kan skapa med Vintage AI' 
                : 'An example of what you can create with Vintage AI'}
            </p>
          </div>
          
          <div className="max-w-5xl mx-auto relative">
            {/* Gold frame */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-600/30 to-amber-800/30 blur-2xl"></div>
            <div className="relative border-2 border-amber-600 shadow-2xl shadow-amber-600/50 rounded-lg overflow-hidden">
              {/* Corner decorations */}
              <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-amber-400"></div>
              <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-amber-400"></div>
              <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-amber-400"></div>
              <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-amber-400"></div>
              
              {/* Inner border */}
              <div className="absolute inset-2 border border-amber-500/50 rounded pointer-events-none"></div>
              
              {/* Image */}
              <img 
                src={vintageAiExample} 
                alt="Vintage AI Example" 
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>

      {/* How to Use Guide */}
      <div className="relative py-24 px-4 bg-gradient-to-br from-gray-900 via-green-950 to-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Lightbulb className="w-10 h-10 text-amber-500" />
            <h2 className="text-5xl font-bold text-center text-amber-100">
              {language === 'sv' ? 'Så Här Använder Du Vintage AI' : 'How to Use Vintage AI'}
            </h2>
          </div>
          <p className="text-center text-amber-200/70 mb-16 text-xl max-w-4xl mx-auto leading-relaxed">
            {language === 'sv' 
              ? (
                <>
                  Välkommen till VEO3 Video! Här kan du skapa fantastiska videor direkt med AI – allt från realistiska scener till fantasifulla världar, precis som du föreställer dig dem. För att resultatet ska bli så bra som möjligt behöver AI:n tydliga instruktioner. Ju mer detaljerad du är, desto närmare din vision kommer videon. Dessa instruktioner kallas för prompts – det är din beskrivning av vad som ska hända i videon.
                  <br/><br/>
                  Med VEO3 har du två sätt att börja: antingen svarar du på våra guidade frågor som gör det enkelt att skapa en professionell prompt, eller så skriver du din egen detaljerade prompt och får full kontroll. När du känner dig mer bekväm kan du experimentera fritt och låta kreativiteten styra.
                  <br/><br/>
                  Behöver du hjälp med din prompt finns en AI-chatt i det högra hörnet. Där kan du diskutera idéer, finslipa beskrivningar och få konkreta tips för att skapa exakt den scen eller bild du vill ha.
                </>
              )
              : 'Learn to create magical videos and images with AI'
            }
          </p>


          {/* VIDEO Section */}
          <div className="mb-20">
            <div className="flex items-center justify-center gap-3 mb-12">
              <Film className="w-8 h-8 text-amber-500" />
              <h3 className="text-4xl font-bold text-amber-100">
                {language === 'sv' ? 'SKAPA VIDEOS' : 'CREATE VIDEOS'}
              </h3>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {/* Option 1: Animate existing image */}
              <div className="bg-gradient-to-br from-gray-900 to-green-900 p-8 border-2 border-amber-600/40 rounded-lg">
                <div className="w-12 h-12 bg-amber-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4">1</div>
                <h4 className="text-2xl font-bold text-amber-100 mb-4">
                  {language === 'sv' ? 'Gör Bilder Levande' : 'Bring Images to Life'}
                </h4>
                <p className="text-amber-200/80 mb-4">
                  {language === 'sv' 
                    ? 'Ladda upp en befintlig bild och få den att röra sig! Perfekt för att få personer att le, röra på sig, eller skapa subtila rörelser.' 
                    : 'Upload an existing image and make it move! Perfect for making people smile, move, or create subtle movements.'}
                </p>
                <div className="bg-black/30 p-4 rounded border border-amber-600/30">
                  <p className="text-amber-300 text-sm font-bold mb-2">
                    {language === 'sv' ? 'EXEMPEL:' : 'EXAMPLE:'}
                  </p>
                <p className="text-amber-200 italic">
                  "{language === 'sv' 
                    ? 'En gammal Stomatol reklamskylt som hänger och svänger sakta i vinden' 
                    : 'An old Stomatol advertising sign hanging and swaying slowly in the wind'}"
                </p>
                </div>
              </div>

              {/* Option 2: Create from scratch */}
              <div className="bg-gradient-to-br from-gray-900 to-green-900 p-8 border-2 border-amber-600/40 rounded-lg">
                <div className="w-12 h-12 bg-amber-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4">2</div>
                <h4 className="text-2xl font-bold text-amber-100 mb-4">
                  {language === 'sv' ? 'Skapa Helt Ny Scen' : 'Create Brand New Scene'}
                </h4>
                <p className="text-amber-200/80 mb-4">
                  {language === 'sv' 
                    ? 'Beskriv en hel scen i text och AI:n skapar en video från grunden.' 
                    : 'Describe an entire scene in text and AI creates a video from scratch.'}
                </p>
                <div className="bg-black/30 p-4 rounded border border-amber-600/30">
                  <p className="text-amber-300 text-sm font-bold mb-2">
                    {language === 'sv' ? 'EXEMPEL:' : 'EXAMPLE:'}
                  </p>
                  <p className="text-amber-200 italic">
                    "{language === 'sv' 
                      ? 'En vintage reklamskylt som lyser i neonfärger över snötäckta tak i Stockholm, vintermorgon' 
                      : 'A vintage neon sign glowing over snow-covered rooftops in Stockholm, winter morning'}"
                  </p>
                </div>
              </div>
            </div>

            {/* Video Example with actual prompt */}
            <div className="max-w-4xl mx-auto bg-gradient-to-br from-amber-900/40 to-red-900/40 p-8 border-2 border-amber-500 rounded-lg">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-amber-600 rounded-full flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-amber-50" />
                </div>
                <h4 className="text-2xl font-bold text-amber-100">
                  {language === 'sv' ? 'Exempel-Prompt för Video' : 'Example Video Prompt'}
                </h4>
              </div>
              
              <div className="bg-black/40 p-6 rounded-lg mb-4">
                <p className="text-amber-200 text-lg italic leading-relaxed">
                  "{language === 'sv' 
                    ? 'En gammal Stomatol reklamskylt som hänger och svänger sakta i vinden. Skylten är lite sliten och vintage. Lägg till en subtil vinglans-effekt som rör sig över skylten och få det att kännas levande med lätt rörelse.' 
                    : 'An old Stomatol advertising sign hanging and swaying slowly in the wind. The sign is slightly worn and vintage. Add a subtle glass reflection effect moving across the sign and make it feel alive with gentle movement.'}"
                </p>
              </div>
              
              <p className="text-amber-200/70 text-sm">
                {language === 'sv' 
                  ? '💡 Tips: Ladda först upp bilden, skriv sedan prompten för bästa resultat' 
                  : '💡 Tip: First upload the image, then write the prompt for best results'}
              </p>
            </div>
          </div>

          {/* Stomatol Example Video */}
          <div className="max-w-5xl mx-auto mb-20">
            <video 
              src={santaExample} 
              controls 
              autoPlay
              loop
              playsInline
              className="w-full aspect-video rounded-lg shadow-2xl border-2 border-amber-600/50 object-cover"
            />
          </div>

          {/* IMAGE Section */}
          <div className="mb-20">
            <div className="flex items-center justify-center gap-3 mb-12">
              <Camera className="w-8 h-8 text-amber-500" />
              <h3 className="text-4xl font-bold text-amber-100">
                {language === 'sv' ? 'SKAPA BILDER' : 'CREATE IMAGES'}
              </h3>
            </div>

            <div className="max-w-4xl mx-auto mb-12">
              <p className="text-center text-amber-200/80 mb-6 text-lg leading-relaxed">
                {language === 'sv' 
                  ? 'Med detta verktyg kan du enkelt förvandla dina idéer till bilder. Du kan antingen skapa en helt ny bild, eller redigera ett befintligt foto genom att ge AI:n tydliga instruktioner – så kallade prompts.' 
                  : 'With this tool, you can easily transform your ideas into images. You can either create a brand new image or edit an existing photo by giving the AI clear instructions – so-called prompts.'}
              </p>

              <h4 className="text-2xl font-bold text-amber-100 mb-6 text-center">
                {language === 'sv' ? 'Hur fungerar det?' : 'How does it work?'}
              </h4>
              
              <p className="text-center text-amber-200/80 mb-8 text-lg">
                {language === 'sv' 
                  ? 'Du har två kraftfulla sätt att använda tjänsten:' 
                  : 'You have two powerful ways to use the service:'}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {/* Option 1: Edit existing */}
              <div className="bg-gradient-to-br from-gray-900 to-green-900 p-8 border-2 border-amber-600/40 rounded-lg">
                <div className="w-12 h-12 bg-amber-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4">1</div>
                <h4 className="text-2xl font-bold text-amber-100 mb-4">
                  {language === 'sv' ? 'Ändra din befintliga bild (Bildredigering)' : 'Edit Your Existing Image (Image Editing)'}
                </h4>
                <p className="text-amber-200/80 mb-4">
                  {language === 'sv' 
                    ? 'Ladda upp en bild (valfritt) och beskriv i prompten vad du vill ändra. Exempelvis: "Byt bakgrunden till en tropisk strand" eller "Måla bilen röd".' 
                    : 'Upload an image (optional) and describe in the prompt what you want to change. For example: "Change the background to a tropical beach" or "Paint the car red".'}
                </p>
              </div>

              {/* Option 2: Create from scratch */}
              <div className="bg-gradient-to-br from-gray-900 to-green-900 p-8 border-2 border-amber-600/40 rounded-lg">
                <div className="w-12 h-12 bg-amber-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4">2</div>
                <h4 className="text-2xl font-bold text-amber-100 mb-4">
                  {language === 'sv' ? 'Skapa en helt ny bild (Generering)' : 'Create a Brand New Image (Generation)'}
                </h4>
                <p className="text-amber-200/80 mb-4">
                  {language === 'sv' 
                    ? 'Skriv din prompt som beskriver motivet, stilen och känslan du vill ha.' 
                    : 'Write your prompt describing the subject, style, and feeling you want.'}
                </p>
              </div>
            </div>

            <div className="max-w-4xl mx-auto bg-gradient-to-br from-amber-900/40 to-red-900/40 p-8 border-2 border-amber-500 rounded-lg">
              <div className="flex items-center gap-3 mb-4">
                <MessageCircle className="w-6 h-6 text-amber-400" />
                <h4 className="text-xl font-bold text-amber-100">
                  {language === 'sv' ? 'Behöver du hjälp med prompten?' : 'Need help with your prompt?'}
                </h4>
              </div>
              <p className="text-amber-200/90 leading-relaxed">
                {language === 'sv' 
                  ? 'Du kan alltid diskutera med Chatbotten nere i högra hörnet först. Chatbotten kan hjälpa dig att formulera en perfekt prompt för just din vision! (Läs mer om hur du skriver en bra prompt längre ner på sidan.)' 
                  : 'You can always discuss with the Chatbot in the right corner first. The Chatbot can help you formulate a perfect prompt for your specific vision! (Read more about how to write a good prompt further down the page.)'}
              </p>
            </div>
          </div>

          {/* How to Build a Great Prompt */}
          <div className="mb-16 max-w-4xl mx-auto">
            <h3 className="text-3xl font-bold text-amber-100 mb-8 text-center">
              {language === 'sv' ? 'Vad är en prompt?' : 'What is a prompt?'}
            </h3>
            
            <div className="bg-gradient-to-br from-gray-900 to-green-900 p-8 border border-amber-600/40 rounded-lg space-y-6">
              <p className="text-amber-200/90 text-lg leading-relaxed">
                {language === 'sv' 
                  ? 'En prompt är den instruktion du ger till en AI, ungefär som en filmregissör beskriver en scen för sitt team. Du berättar vad som ska synas, kännas och hända så att AI:n förstår din vision. Om du lämnar delar otydliga kommer AI:n att försöka fylla luckorna själv, och resultatet blir ofta något du inte hade tänkt dig. Ju tydligare du beskriver miljö, stil, ljus, perspektiv och stämning, desto mer exakt blir tolkningen.'
                  : 'A prompt is the instruction you give to an AI, similar to how a film director describes a scene to their team. You tell what should be seen, felt, and happen so that the AI understands your vision. If you leave parts unclear, the AI will try to fill in the gaps itself, and the result often becomes something you didn\'t imagine. The clearer you describe environment, style, light, perspective, and mood, the more accurate the interpretation will be.'}
              </p>

              <p className="text-amber-200/90 text-lg leading-relaxed">
                {language === 'sv' 
                  ? 'När du skriver en prompt, tänk på att AI:n inte vet vad du menar förrän du berättar det. Om du till exempel skriver att du vill ha en röd fågel, vet den inte om det är en liten fågel i en svensk skog eller en tropisk papegoja i Sydamerika. Därför behöver du specificera allt som påverkar hur bilden eller videon ska se ut.'
                  : 'When you write a prompt, keep in mind that the AI doesn\'t know what you mean until you tell it. For example, if you write that you want a red bird, it doesn\'t know if it\'s a small bird in a Swedish forest or a tropical parrot in South America. Therefore, you need to specify everything that affects how the image or video should look.'}
              </p>

              <div className="pt-4">
                <h4 className="text-xl font-bold text-amber-100 mb-4">
                  {language === 'sv' ? 'Du kan beskriva:' : 'You can describe:'}
                </h4>
                <ul className="space-y-3 text-amber-200/90">
                  <li className="flex items-start gap-3">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>
                      <strong className="text-amber-100">{language === 'sv' ? 'Kamera eller perspektiv:' : 'Camera or perspective:'}</strong>{' '}
                      {language === 'sv' 
                        ? 'Är det en närbild, helbild eller fågelperspektiv? Du kan till och med ange vilken kameralins eller kameramodell som används, till exempel Canon EOS R5, Nikon D850 eller Hasselblad, för att styra stil och skärpedjup.'
                        : 'Is it a close-up, full shot, or bird\'s eye view? You can even specify which camera lens or camera model is used, such as Canon EOS R5, Nikon D850, or Hasselblad, to control style and depth of field.'}
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>
                      <strong className="text-amber-100">{language === 'sv' ? 'Miljö och tid:' : 'Environment and time:'}</strong>{' '}
                      {language === 'sv' 
                        ? 'Beskriv var och när scenen utspelar sig, till exempel utomhus på 1980-talet, inomhus i ett futuristiskt laboratorium eller på en kuststad på morgonen.'
                        : 'Describe where and when the scene takes place, for example outdoors in the 1980s, indoors in a futuristic laboratory, or in a coastal town in the morning.'}
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>
                      <strong className="text-amber-100">{language === 'sv' ? 'Karaktärer och objekt:' : 'Characters and objects:'}</strong>{' '}
                      {language === 'sv' 
                        ? 'Vilka personer, djur eller föremål ska synas? Hur ser de ut, hur är de klädda, vad gör de?'
                        : 'Which people, animals, or objects should be visible? How do they look, how are they dressed, what are they doing?'}
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>
                      <strong className="text-amber-100">{language === 'sv' ? 'Handling eller rörelse:' : 'Action or movement:'}</strong>{' '}
                      {language === 'sv' 
                        ? 'Vad sker i bilden eller videon? Är det ett stilla ögonblick, eller händer något i scenen?'
                        : 'What happens in the image or video? Is it a still moment, or is something happening in the scene?'}
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>
                      <strong className="text-amber-100">{language === 'sv' ? 'Färg, ljus och känsla:' : 'Color, light, and feeling:'}</strong>{' '}
                      {language === 'sv' 
                        ? 'Beskriv ljuset och stämningen med konkreta termer, till exempel dagsljus, soligt, golden hour, kvällsljus, dimma eller neonlysande.'
                        : 'Describe the light and mood with concrete terms, such as daylight, sunny, golden hour, evening light, fog, or neon-lit.'}
                    </span>
                  </li>
                </ul>
              </div>

              <p className="text-amber-200/90 text-lg leading-relaxed pt-4">
                {language === 'sv' 
                  ? 'Ju mer exakt du formulerar din vision, desto närmare kommer AI:n att komma din idé. En bra prompt fungerar som ett manus – tydligt, detaljerat och med en känsla för vad som gör bilden eller scenen levande.'
                  : 'The more precisely you formulate your vision, the closer the AI will come to your idea. A good prompt works like a script – clear, detailed, and with a sense of what makes the image or scene come alive.'}
              </p>

              <div className="bg-black/30 p-4 rounded border border-amber-600/30">
                <p className="text-amber-300 font-bold mb-2">
                  💡 {language === 'sv' ? 'Tips:' : 'Tip:'}
                </p>
                <p className="text-amber-200/90">
                  {language === 'sv' 
                    ? 'Ibland kan det också vara viktigt att ange vad AI:n inte får göra. Till exempel kan du skriva "ändra inte bakgrunden" eller "lägg inte till nya objekt". Det gör att AI:n inte tolkar din vision på fel sätt och behåller det du faktiskt vill ha i scenen.'
                    : 'Sometimes it can also be important to specify what the AI must not do. For example, you can write "don\'t change the background" or "don\'t add new objects". This ensures that the AI doesn\'t misinterpret your vision and keeps what you actually want in the scene.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="relative py-24 px-4 bg-gradient-to-br from-gray-900 via-green-950 to-gray-900">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-5xl font-bold text-center mb-16 text-amber-100">
            {t.howItWorksTitle}
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { num: "1", title: t.step1Title, desc: t.step1Desc },
              { num: "2", title: t.step2Title, desc: t.step2Desc },
              { num: "3", title: t.step3Title, desc: t.step3Desc }
            ].map((step, i) => (
              <div key={i} className="text-center group">
                <div className="relative inline-block mb-6">
                  <div className="w-24 h-24 bg-gradient-to-br from-amber-600 to-amber-800 rounded-full flex items-center justify-center text-4xl font-bold text-amber-50 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-amber-600/30">
                    {step.num}
                  </div>
                  <div className="absolute inset-0 bg-amber-500 rounded-full blur-xl opacity-0 group-hover:opacity-30 transition-opacity"></div>
                </div>
                <h3 className="text-2xl font-bold mb-3 text-amber-100">{step.title}</h3>
                <p className="text-amber-200/80">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="relative py-24 px-4 bg-gradient-to-br from-gray-900 via-green-950 to-gray-900">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-5xl font-bold text-center mb-4 text-amber-100">
            {t.pricingTitle.toUpperCase()}
          </h2>
          <p className="text-center text-amber-200/60 mb-16 text-lg">
            {t.pricingSubtitle}
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { 
                name: t.starter, 
                subtitle: t.starterDesc,
                price: "$6", 
                videos: 2,
                images: 5,
                color: "bg-amber-900",
                borderColor: "border-amber-600",
                packageType: "starter" as const
              },
              { 
                name: t.pro, 
                subtitle: t.proDesc,
                price: "$20", 
                videos: 8,
                images: 15,
                color: "bg-red-900",
                borderColor: "border-red-700",
                packageType: "classic" as const
              },
              { 
                name: t.trial, 
                subtitle: t.trialDesc,
                price: "$55", 
                videos: 25,
                images: 40,
                color: "bg-slate-800",
                borderColor: "border-slate-600",
                packageType: "premier" as const
              }
            ].map((pkg, i) => (
              <div key={i} className="relative group">
                <div className={`relative ${pkg.color} p-8 border-2 ${pkg.borderColor} rounded-lg hover:scale-105 transition-all duration-300 shadow-2xl h-full flex flex-col`}>
                  <div className="absolute top-4 right-4 w-8 h-8">
                    <svg viewBox="0 0 20 20" className="w-full h-full opacity-40">
                      <path d="M0,0 L20,0 L20,20 Z" fill="#D4AF37"/>
                    </svg>
                  </div>

                  <h3 className="text-3xl font-bold mb-2 text-amber-100">{pkg.name}</h3>
                  <p className="text-amber-300/60 italic mb-4">{pkg.subtitle}</p>
                  <div className="text-5xl font-bold mb-6 text-amber-100">{pkg.price}</div>
                  
                  <div className="space-y-3 mb-8 flex-grow">
                    <div className="flex items-center gap-3 text-amber-200">
                      <Video className="w-5 h-5 text-amber-500" />
                      <span className="font-semibold">{pkg.videos} {t.videos}</span>
                    </div>
                    <div className="flex items-center gap-3 text-amber-200">
                      <Camera className="w-5 h-5 text-amber-500" />
                      <span className="font-semibold">{pkg.images} {t.images}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => handlePurchase(pkg.packageType)}
                    disabled={loading === pkg.packageType}
                    className="w-full bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 disabled:from-gray-700 disabled:to-gray-600 text-amber-50 font-bold py-4 rounded transition-all duration-300 shadow-lg hover:shadow-amber-600/50 disabled:cursor-not-allowed"
                  >
                    {loading === pkg.packageType ? t.loading : t.choosePackage}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative py-12 px-4 bg-gradient-to-br from-gray-900 via-green-950 to-gray-900 border-t border-amber-600/30">
        <div className="max-w-6xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-0.5 bg-gradient-to-r from-transparent to-amber-600"></div>
              <Film className="w-6 h-6 text-amber-600" />
              <div className="w-16 h-0.5 bg-gradient-to-l from-transparent to-amber-600"></div>
            </div>
          </div>
          <p className="text-amber-300/60">© 2024 Vintage AI • {t.footer}</p>
        </div>
      </div>

      {/* Prompt Assistant */}
      <PromptAssistant />
    </div>
  );
};

export default Home;
