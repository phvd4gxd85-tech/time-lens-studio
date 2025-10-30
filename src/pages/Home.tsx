import { Upload, Film, Sparkles, Video, Lightbulb, Zap, Download, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import vintageAiExample from '@/assets/vintage-ai-example.jpeg';
import exampleVideo from '@/assets/example-video.mov';

const Home = () => {
  const { toast } = useToast();
  const { t, language } = useLanguage();
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

  const PRICE_IDS = {
    starter: "price_1SKbRvQt7FLZjS8hiRIqK4RZ",
    classic: "price_1SKbZhQt7FLZjS8hcsyNqiGM",
    premier: "price_1SKbTIQt7FLZjS8hIee7YD54",
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

          {/* Main Generator Box */}
          <div className="max-w-4xl mx-auto mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-600/20 to-red-900/20 blur-xl"></div>
            <div className="relative bg-gradient-to-br from-gray-900 to-green-900 p-8 md:p-12 border-2 border-amber-600 rounded-lg shadow-2xl">
              <div className="flex justify-center mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-0.5 bg-gradient-to-r from-transparent to-amber-600"></div>
                  <Sparkles className="w-8 h-8 text-amber-500" />
                  <div className="w-16 h-0.5 bg-gradient-to-l from-transparent to-amber-600"></div>
                </div>
              </div>

              <h2 className="text-3xl md:text-4xl font-bold mb-8 text-amber-100">
                {t.createYourVideo}
              </h2>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <label className="block">
                    <div className="border-2 border-dashed border-amber-600 rounded-lg p-8 hover:border-amber-500 transition-all cursor-pointer bg-black/30 hover:bg-black/50 group">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      {uploadedImage ? (
                        <img src={uploadedImage} alt="Uploaded" className="w-full h-48 object-cover rounded" />
                      ) : (
                        <div className="text-center">
                          <Upload className="w-16 h-16 mx-auto mb-4 text-amber-600 group-hover:text-amber-500 transition-colors" />
                          <p className="text-amber-200 text-lg">{t.uploadYourImage}</p>
                          <p className="text-amber-400/60 text-sm mt-2">{t.optionalUpload}</p>
                        </div>
                      )}
                    </div>
                  </label>

                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={t.describeWhat}
                    className="w-full p-4 bg-black/40 border border-amber-600/50 rounded text-amber-100 placeholder-amber-400/40 focus:outline-none focus:border-amber-500 h-32"
                  />
                </div>

                <div className="space-y-4">
                  <div className="bg-black/40 border border-amber-600/50 rounded-lg p-6 h-48 flex items-center justify-center overflow-hidden">
                    {videoUrl ? (
                      <video 
                        src={videoUrl} 
                        controls 
                        className="w-full h-full object-contain rounded"
                      />
                    ) : isGenerating ? (
                      <div className="text-center w-full px-4">
                        <Film className="w-16 h-16 mx-auto mb-4 text-amber-500 animate-pulse" />
                        <p className="text-amber-300 text-lg font-semibold mb-4">{t.creatingMagic}</p>
                        <div className="w-full max-w-xs mx-auto">
                          <div className="w-full bg-black/60 rounded-full h-3 border border-amber-600/30 overflow-hidden">
                            <div 
                              className="bg-gradient-to-r from-amber-600 to-amber-400 h-3 rounded-full transition-all duration-500 ease-out shadow-lg shadow-amber-500/50"
                              style={{ width: `${progress}%` }}
                            >
                              <div className="w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                            </div>
                          </div>
                          <p className="text-amber-400 font-bold text-base mt-3">{progress}%</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-amber-400/40">
                        <Video className="w-16 h-16 mx-auto mb-4" />
                        <p>{t.yourVideoHere}</p>
                      </div>
                    )}
                  </div>

                   {videoUrl && (
                    <button
                      onClick={handleDownload}
                      className="w-full bg-gradient-to-r from-amber-800 to-amber-700 hover:from-amber-700 hover:to-amber-600 text-amber-50 font-bold py-4 px-6 rounded transition-all duration-300 shadow-lg hover:shadow-amber-700/50 flex items-center justify-center gap-2"
                    >
                      <Download className="w-5 h-5" />
                      {language === 'sv' ? 'LADDA NER VIDEO' : 'DOWNLOAD VIDEO'}
                    </button>
                  )}
                  
                  <button
                    onClick={handleGenerate}
                    disabled={!prompt || isGenerating}
                    className="w-full bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 disabled:from-gray-700 disabled:to-gray-600 text-amber-50 font-bold py-4 px-6 rounded transition-all duration-300 shadow-lg hover:shadow-amber-600/50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-5 h-5" />
                    {isGenerating ? (language === 'sv' ? 'GENERERAR...' : 'GENERATING...') : t.generate.toUpperCase()}
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
          <p className="text-center text-amber-200/70 mb-16 text-xl">
            {language === 'sv' 
              ? 'Lär dig skapa magiska videos och bilder med AI' 
              : 'Learn to create magical videos and images with AI'}
          </p>

          {/* Example Video Section */}
          <div className="mb-16">
            <div className="max-w-3xl mx-auto">
              <video 
                src={exampleVideo} 
                controls 
                className="w-full rounded-lg shadow-2xl border-2 border-amber-600/30 object-cover"
              />
              <div className="mt-6 bg-gradient-to-br from-amber-900/40 to-red-900/40 p-6 rounded-lg border-2 border-amber-500">
                <h4 className="font-semibold mb-3 text-xl text-amber-100">
                  <span className="text-amber-400">
                    {language === 'sv' ? 'Prompt som användes:' : 'Prompt used:'}
                  </span>
                </h4>
                <p className="text-lg text-amber-200 leading-relaxed italic">
                  "{language === 'sv' 
                    ? 'En gammal Stomatol reklamskylt som hänger och svänger sakta i vinden. Skylten är lite sliten och vintage. Lägg till en subtil vinglans-effekt som rör sig över skylten och få det att kännas levande med lätt rörelse.' 
                    : 'An old Stomatol advertising sign hanging and swaying slowly in the wind. The sign is slightly worn and vintage. Add a subtle glass reflection effect moving across the sign and make it feel alive with gentle movement.'}"
                </p>
              </div>
            </div>
          </div>

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

          {/* IMAGE Section */}
          <div className="mb-20">
            <div className="flex items-center justify-center gap-3 mb-12">
              <Camera className="w-8 h-8 text-amber-500" />
              <h3 className="text-4xl font-bold text-amber-100">
                {language === 'sv' ? 'SKAPA BILDER' : 'CREATE IMAGES'}
              </h3>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-12">
              {/* Option 1: Edit existing */}
              <div className="bg-gradient-to-br from-gray-900 to-green-900 p-8 border-2 border-amber-600/40 rounded-lg">
                <div className="w-12 h-12 bg-amber-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4">1</div>
                <h4 className="text-2xl font-bold text-amber-100 mb-4">
                  {language === 'sv' ? 'Redigera Befintlig Bild' : 'Edit Existing Image'}
                </h4>
                <p className="text-amber-200/80 mb-4">
                  {language === 'sv' 
                    ? 'Ladda upp en bild och ändra detaljer - byt färg på kläder, ändra bakgrund, eller lägg till element.' 
                    : 'Upload an image and change details - change clothing colors, alter background, or add elements.'}
                </p>
                <div className="bg-black/30 p-4 rounded border border-amber-600/30">
                  <p className="text-amber-300 text-sm font-bold mb-2">
                    {language === 'sv' ? 'EXEMPEL:' : 'EXAMPLE:'}
                  </p>
                  <p className="text-amber-200 italic">
                    "{language === 'sv' 
                      ? 'Byt ut jackan till en röd färg, behåll allt annat' 
                      : 'Change the jacket to red color, keep everything else'}"
                  </p>
                </div>
              </div>

              {/* Option 2: Create from scratch */}
              <div className="bg-gradient-to-br from-gray-900 to-green-900 p-8 border-2 border-amber-600/40 rounded-lg">
                <div className="w-12 h-12 bg-amber-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4">2</div>
                <h4 className="text-2xl font-bold text-amber-100 mb-4">
                  {language === 'sv' ? 'Skapa Helt Ny Bild' : 'Create Brand New Image'}
                </h4>
                <p className="text-amber-200/80 mb-4">
                  {language === 'sv' 
                    ? 'Beskriv din vision i text och AI:n skapar bilden från grunden.' 
                    : 'Describe your vision in text and AI creates the image from scratch.'}
                </p>
                <div className="bg-black/30 p-4 rounded border border-amber-600/30">
                  <p className="text-amber-300 text-sm font-bold mb-2">
                    {language === 'sv' ? 'EXEMPEL:' : 'EXAMPLE:'}
                  </p>
                  <p className="text-amber-200 italic">
                    "{language === 'sv' 
                      ? 'En vintage reklamskylt med texten VINTAGE AI och en filmrulle, neonljus, Stockholms takåsar' 
                      : 'A vintage sign with text VINTAGE AI and a film reel, neon lights, Stockholm rooftops'}"
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* How to Build a Great Prompt */}
          <div className="mb-16 max-w-4xl mx-auto">
            <h3 className="text-3xl font-bold text-amber-100 mb-8 text-center">
              {language === 'sv' ? 'Hur Bygger Man En Bra Prompt?' : 'How to Build a Great Prompt?'}
            </h3>
            
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-gray-900 to-green-900 p-6 border border-amber-600/40 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Zap className="w-6 h-6 text-amber-500" />
                  <h4 className="text-xl font-bold text-amber-100">
                    {language === 'sv' ? 'Grund-Nivå' : 'Basic Level'}
                  </h4>
                </div>
                <ul className="text-amber-200/80 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{language === 'sv' ? 'Vad händer i bilden/videon?' : 'What happens in the image/video?'}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{language === 'sv' ? 'Var utspelar det sig?' : 'Where does it take place?'}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{language === 'sv' ? 'När på dagen?' : 'What time of day?'}</span>
                  </li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-gray-900 to-green-900 p-6 border border-amber-600/40 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Zap className="w-6 h-6 text-amber-500" />
                  <Zap className="w-6 h-6 text-amber-500" />
                  <h4 className="text-xl font-bold text-amber-100">
                    {language === 'sv' ? 'Mellan-Nivå' : 'Medium Level'}
                  </h4>
                </div>
                <ul className="text-amber-200/80 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{language === 'sv' ? 'Känslor och stämning' : 'Emotions and mood'}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{language === 'sv' ? 'Ljussättning (varmt, kallt, dramatiskt)' : 'Lighting (warm, cold, dramatic)'}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{language === 'sv' ? 'Rörelser (mjuka, snabba, subtila)' : 'Movements (smooth, fast, subtle)'}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{language === 'sv' ? 'Väder och atmosfär' : 'Weather and atmosphere'}</span>
                  </li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-gray-900 to-green-900 p-6 border border-amber-600/40 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Zap className="w-6 h-6 text-amber-500" />
                  <Zap className="w-6 h-6 text-amber-500" />
                  <Zap className="w-6 h-6 text-amber-500" />
                  <h4 className="text-xl font-bold text-amber-100">
                    {language === 'sv' ? 'Avancerad-Nivå' : 'Advanced Level'}
                  </h4>
                </div>
                <ul className="text-amber-200/80 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{language === 'sv' ? 'Kamerarörelser (zoom, pan, statisk)' : 'Camera movements (zoom, pan, static)'}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{language === 'sv' ? 'Filmstil (vintage, modern, noir)' : 'Film style (vintage, modern, noir)'}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{language === 'sv' ? 'Kameravinkel (fågelperspektiv, grodperspektiv)' : 'Camera angle (bird\'s eye, worm\'s eye)'}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{language === 'sv' ? 'Specifika filmreferenser' : 'Specific film references'}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <p className="text-center text-amber-200 text-xl mt-12 font-bold">
            {language === 'sv' 
              ? '✨ Ju mer detaljer, desto närmare din vision kommer resultatet ✨' 
              : '✨ The more details, the closer to your vision the result will be ✨'}
          </p>
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
    </div>
  );
};

export default Home;
