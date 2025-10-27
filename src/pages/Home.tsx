import { Upload, Film, Sparkles, Video, Lightbulb, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

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

  const PRICE_IDS = {
    discover: "price_1SKbRvQt7FLZjS8hiRIqK4RZ",
    classic: "price_1SKbZhQt7FLZjS8hcsyNqiGM",
    premier: "price_1SKbTIQt7FLZjS8hIee7YD54",
  };

  const handlePurchase = async (packageType: 'discover' | 'classic' | 'premier') => {
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

  const handleGenerate = async () => {
    if (!prompt) {
      toast({
        title: language === 'sv' ? "Prompt krävs" : "Prompt required",
        description: language === 'sv' ? "Vänligen beskriv vad du vill skapa" : "Please describe what you want to create",
        variant: "destructive",
      });
      return;
    }

    // Temporarily show coming soon message
    toast({
      title: language === 'sv' ? "Funktion under utveckling" : "Feature in development",
      description: language === 'sv' ? "Videogenerering är tillfälligt inaktiverad för att fixa tekniska problem." : "Video generation is temporarily disabled to fix technical issues.",
    });
    return;

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

      if (error) throw error;

      const genId = data.generation_id;
      setGenerationId(genId);
      console.log('Video generation started:', genId);

      // Poll for status
      const pollInterval = setInterval(async () => {
        const { data: statusData, error: statusError } = await supabase.functions.invoke('check-video-status', {
          body: { generation_id: genId }
        });

        if (statusError) {
          console.error('Status check error:', statusError);
          clearInterval(pollInterval);
          setIsGenerating(false);
          return;
        }

        console.log('Video status:', statusData.status, 'Progress:', statusData.progress);
        setProgress(statusData.progress || 0);

        if (statusData.status === 'completed' && statusData.video_url) {
          setVideoUrl(statusData.video_url);
          setIsGenerating(false);
          clearInterval(pollInterval);
          toast({
            title: language === 'sv' ? "Video klar!" : "Video ready!",
            description: language === 'sv' ? "Din video har genererats framgångsrikt" : "Your video has been generated successfully",
          });
        } else if (statusData.status === 'failed') {
          clearInterval(pollInterval);
          setIsGenerating(false);
          toast({
            title: language === 'sv' ? "Generering misslyckades" : "Generation failed",
            description: language === 'sv' ? "Något gick fel. Försök igen." : "Something went wrong. Please try again.",
            variant: "destructive",
          });
        }
      }, 3000); // Check every 3 seconds

      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (isGenerating) {
          setIsGenerating(false);
          toast({
            title: language === 'sv' ? "Tidsgräns" : "Timeout",
            description: language === 'sv' ? "Videogenereringen tog för lång tid. Försök igen." : "Video generation took too long. Please try again.",
            variant: "destructive",
          });
        }
      }, 300000);

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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-950 to-gray-900 text-amber-50" style={{ fontFamily: "'Playfair Display', serif" }}>
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
      <div className="relative pt-20 pb-32 px-4">
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
                      <div className="text-center">
                        <Film className="w-16 h-16 mx-auto mb-4 text-amber-500 animate-pulse" />
                        <p className="text-amber-300">{t.creatingMagic}</p>
                        {progress > 0 && (
                          <div className="mt-4 w-48 mx-auto">
                            <div className="w-full bg-black/60 rounded-full h-2">
                              <div 
                                className="bg-amber-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              ></div>
                            </div>
                            <p className="text-amber-400 text-sm mt-2">{progress}%</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-amber-400/40">
                        <Video className="w-16 h-16 mx-auto mb-4" />
                        <p>{t.yourVideoHere}</p>
                      </div>
                    )}
                  </div>

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

      {/* Prompting Guide */}
      <div className="relative py-24 px-4 bg-gradient-to-br from-red-950 to-gray-900">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Lightbulb className="w-10 h-10 text-amber-500" />
            <h2 className="text-5xl font-bold text-center text-amber-100">
              {t.promptGuideTitle}
            </h2>
          </div>
          <p className="text-center text-amber-200/70 mb-16 text-xl">
            {t.promptInstruction}
          </p>

          {/* What is a prompt */}
          <div className="max-w-4xl mx-auto mb-16 bg-gradient-to-br from-gray-900 to-green-900 p-8 border-2 border-amber-600/40 rounded-lg">
            <h3 className="text-3xl font-bold text-amber-100 mb-4">{t.whatIsPrompt}</h3>
            <p className="text-amber-200/80 text-lg mb-6">
              {t.whatIsPromptDesc}
            </p>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-red-950/30 border border-red-700/50 rounded-lg p-6">
                <div className="text-red-400 font-bold mb-2 flex items-center gap-2">
                  <span className="text-2xl">❌</span> {t.tooSimple}
                </div>
                <p className="text-amber-200 italic">"{t.redBirdExample}"</p>
                <p className="text-amber-300/60 text-sm mt-3">{t.aiMustGuess}</p>
              </div>

              <div className="bg-green-950/30 border border-green-700/50 rounded-lg p-6">
                <div className="text-green-400 font-bold mb-2 flex items-center gap-2">
                  <span className="text-2xl">✅</span> {t.muchBetter}
                </div>
                <p className="text-amber-200 italic">"{t.redCardinalExample}"</p>
              </div>
            </div>
          </div>

          {/* Three ways to use */}
          <div className="mb-16">
            <h3 className="text-3xl font-bold text-amber-100 mb-8 text-center">{t.threeWays}</h3>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-gray-900 to-green-900 p-6 border border-amber-600/40 rounded-lg">
                <div className="w-12 h-12 bg-amber-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4">1</div>
                <h4 className="text-xl font-bold text-amber-100 mb-3">{t.simpleAnimation}</h4>
                <p className="text-amber-200/80 mb-3">{t.simpleAnimationDesc}</p>
                <p className="text-amber-300 italic bg-black/30 p-3 rounded">"{t.simpleAnimationExample}"</p>
              </div>

              <div className="bg-gradient-to-br from-gray-900 to-green-900 p-6 border border-amber-600/40 rounded-lg">
                <div className="w-12 h-12 bg-amber-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4">2</div>
                <h4 className="text-xl font-bold text-amber-100 mb-3">{t.addDetails}</h4>
                <p className="text-amber-200/80 mb-3">{t.addDetailsDesc}</p>
                <p className="text-amber-300 italic bg-black/30 p-3 rounded">"{t.addDetailsExample}"</p>
              </div>

              <div className="bg-gradient-to-br from-gray-900 to-green-900 p-6 border border-amber-600/40 rounded-lg">
                <div className="w-12 h-12 bg-amber-600 rounded-full flex items-center justify-center text-2xl font-bold mb-4">3</div>
                <h4 className="text-xl font-bold text-amber-100 mb-3">{t.createFromText}</h4>
                <p className="text-amber-200/80 mb-3">{t.createFromTextDesc}</p>
                <p className="text-amber-300 italic bg-black/30 p-3 rounded">"{t.createFromTextExample}"</p>
              </div>
            </div>
          </div>

          {/* Detail levels */}
          <div className="mb-16 max-w-4xl mx-auto">
            <h3 className="text-3xl font-bold text-amber-100 mb-8 text-center">{t.detailLevels}</h3>
            
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-gray-900 to-green-900 p-6 border border-amber-600/40 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Zap className="w-6 h-6 text-amber-500" />
                  <h4 className="text-xl font-bold text-amber-100">{t.basicLevel}</h4>
                </div>
                <ul className="text-amber-200/80 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{t.basicWhat}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{t.basicWhere}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{t.basicWhen}</span>
                  </li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-gray-900 to-green-900 p-6 border border-amber-600/40 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Zap className="w-6 h-6 text-amber-500" />
                  <Zap className="w-6 h-6 text-amber-500" />
                  <h4 className="text-xl font-bold text-amber-100">{t.mediumLevel}</h4>
                </div>
                <ul className="text-amber-200/80 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{t.mediumFeeling}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{t.mediumLight}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{t.mediumMovement}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{t.mediumWeather}</span>
                  </li>
                </ul>
              </div>

              <div className="bg-gradient-to-br from-gray-900 to-green-900 p-6 border border-amber-600/40 rounded-lg">
                <div className="flex items-center gap-3 mb-3">
                  <Zap className="w-6 h-6 text-amber-500" />
                  <Zap className="w-6 h-6 text-amber-500" />
                  <Zap className="w-6 h-6 text-amber-500" />
                  <h4 className="text-xl font-bold text-amber-100">{t.advancedLevel}</h4>
                </div>
                <ul className="text-amber-200/80 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{t.advancedLens}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{t.advancedMovement}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{t.advancedFilm}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{t.advancedAngle}</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500">•</span>
                    <span>{t.advancedBrands}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Example prompt */}
          <div className="max-w-4xl mx-auto bg-gradient-to-br from-amber-900/40 to-red-900/40 p-8 border-2 border-amber-500 rounded-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-amber-600 rounded-full flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-amber-50" />
              </div>
              <h3 className="text-2xl font-bold text-amber-100">{t.exampleTitle}</h3>
            </div>
            
            <div className="bg-black/40 p-6 rounded-lg mb-6">
              <p className="text-amber-200 text-lg italic leading-relaxed">
                "{t.examplePrompt}"
              </p>
            </div>

            <div className="space-y-3 text-amber-200/80">
              <p className="font-bold text-amber-100">{t.whyWorks}</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>{t.whyWork1}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>{t.whyWork2}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>{t.whyWork3}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>{t.whyWork4}</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400">✓</span>
                  <span>{t.whyWork5}</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => setPrompt(t.examplePrompt)}
              className="mt-6 w-full bg-amber-600 hover:bg-amber-500 text-amber-50 font-bold py-3 rounded transition-all"
            >
              {t.useThisPrompt}
            </button>
          </div>

          <p className="text-center text-amber-200 text-xl mt-12 font-bold">
            {t.moreDetailsCloser}
          </p>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="relative py-24 px-4 bg-gradient-to-br from-green-950 to-gray-900">
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
      <div className="relative py-24 px-4 bg-gradient-to-br from-gray-900 to-red-950">
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
                name: t.trial, 
                subtitle: t.trialDesc,
                price: "$5", 
                videos: 3,
                color: "from-amber-700 to-amber-900",
                borderColor: "border-amber-600",
                packageType: "discover" as const
              },
              { 
                name: t.starter, 
                subtitle: t.starterDesc,
                price: "$18", 
                videos: 12,
                color: "from-red-900 to-red-950",
                borderColor: "border-red-700",
                popular: true,
                packageType: "classic" as const
              },
              { 
                name: t.pro, 
                subtitle: t.proDesc,
                price: "$40", 
                videos: 25,
                color: "from-gray-800 to-gray-900",
                borderColor: "border-gray-600",
                packageType: "premier" as const
              }
            ].map((pkg, i) => (
              <div key={i} className="relative group">
                {pkg.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-600 text-amber-50 px-6 py-2 rounded-full text-sm font-bold shadow-lg z-10">
                    {t.popular}
                  </div>
                )}
                <div className={`relative bg-gradient-to-br ${pkg.color} p-8 border-2 ${pkg.borderColor} rounded-lg hover:scale-105 transition-all duration-300 shadow-2xl h-full flex flex-col`}>
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
                    <div className="bg-black/30 rounded px-4 py-3 text-center text-amber-300">
                      <div className="text-2xl font-bold">${(parseFloat(pkg.price.replace('$', '')) / pkg.videos).toFixed(2)}</div>
                      <div className="text-sm text-amber-400/60">{t.perVideo}</div>
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
      <div className="relative py-12 px-4 bg-gradient-to-br from-gray-900 to-black border-t border-amber-600/30">
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
