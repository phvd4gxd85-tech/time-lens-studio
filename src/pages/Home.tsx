import { Film, Video, Lightbulb, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

import ContactForm from '@/components/ContactForm';
import exampleVideo from '@/assets/example-video.mov';
import santaExample from '@/assets/santa-example.mov';
import showcaseVideo from '@/assets/example-showcase.mov';
import showcaseVideo2 from '@/assets/example-showcase-2.mov';

const Home = () => {
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const { user, refreshCredits } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);


  // Auto-pause videos when scrolled out of view
  const videoRef1 = useRef<HTMLVideoElement>(null);
  const videoRef2 = useRef<HTMLVideoElement>(null);
  const videoRef3 = useRef<HTMLVideoElement>(null);
  const videoRef4 = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.25 }
    );

    if (videoRef1.current) observer.observe(videoRef1.current);
    if (videoRef2.current) observer.observe(videoRef2.current);
    if (videoRef3.current) observer.observe(videoRef3.current);
    if (videoRef4.current) observer.observe(videoRef4.current);

    return () => observer.disconnect();
  }, []);

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

          // Redirect to dashboard after successful payment
          navigate('/dashboard');
        } catch (err) {
          console.error('Error verifying payment:', err);
        }
      };
      
      verifyPayment();
    }
  }, [language, refreshCredits, toast, navigate]);

  const PRICE_IDS = {
    klassisk: "price_1T8bfLQt7FLZjS8hIlinBJRL",
    standard: "price_1T8bfpQt7FLZjS8hTuCktjZn",
    premium: "price_1T8bgHQt7FLZjS8huUX28eWF",
  };

  const handlePurchase = async (packageType: 'klassisk' | 'standard' | 'premium') => {
    setLoading(packageType);
    try {
      const priceId = PRICE_IDS[packageType];
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { priceId, packageType }
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error) {
      toast({
        title: language === 'sv' ? "Fel vid betalning" : "Payment error",
        description: error instanceof Error ? error.message : (language === 'sv' ? "Kunde inte starta betalning." : "Could not start payment."),
        variant: "destructive",
      });
    } finally {
      setLoading(null);
    }
  };


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
      <div className="relative pt-4 pb-16 px-4">
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

          {/* Main Example Video - First thing visitors see */}
          <div className="max-w-4xl mx-auto mt-8">
            <video 
              ref={videoRef1}
              src={exampleVideo} 
              controls autoPlay loop muted playsInline
              className="w-full aspect-video rounded-lg shadow-2xl border-2 border-amber-600/50 object-cover"
            />
          </div>
        </div>
      </div>


      {/* Showcase Videos Side by Side */}
      <div className="relative py-16 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          <video 
            ref={videoRef3}
            src={showcaseVideo} 
            controls autoPlay loop muted playsInline
            className="w-full aspect-[9/16] rounded-lg shadow-2xl border-2 border-amber-600/50 object-cover"
          />
          <video 
            ref={videoRef4}
            src={showcaseVideo2} 
            controls autoPlay loop muted playsInline
            className="w-full aspect-[9/16] rounded-lg shadow-2xl border-2 border-amber-600/50 object-cover"
          />
        </div>
      </div>

      {/* Santa Example Video */}
      <div className="relative py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <video 
            ref={videoRef2}
            src={santaExample} 
            controls autoPlay loop muted playsInline
            className="w-full aspect-video rounded-lg shadow-2xl border-2 border-amber-600/50 object-cover"
          />
        </div>
      </div>

      {/* How to write a prompt */}
      <div className="relative py-16 px-4 bg-gradient-to-br from-gray-900 via-green-950 to-gray-900">
        <div className="max-w-4xl mx-auto">
          <h3 className="text-3xl font-bold text-amber-100 mb-8 text-center">
            {language === 'sv' ? 'Vad är en prompt?' : 'What is a prompt?'}
          </h3>
          
          <div className="bg-gradient-to-br from-gray-900 to-green-900 p-8 border border-amber-600/40 rounded-lg space-y-6">
            <p className="text-amber-200/90 text-lg leading-relaxed">
              {language === 'sv' 
                ? 'En prompt är den instruktion du ger till en AI, ungefär som en filmregissör beskriver en scen. Ju tydligare du beskriver miljö, stil, ljus och stämning, desto mer exakt blir resultatet.'
                : 'A prompt is the instruction you give to an AI, similar to how a director describes a scene. The clearer you describe environment, style, light and mood, the more accurate the result.'}
            </p>

            <div className="pt-4">
              <h4 className="text-xl font-bold text-amber-100 mb-4">
                {language === 'sv' ? 'Du kan beskriva:' : 'You can describe:'}
              </h4>
              <ul className="space-y-3 text-amber-200/90">
                <li className="flex items-start gap-3">
                  <span className="text-amber-500 font-bold">•</span>
                  <span><strong className="text-amber-100">{language === 'sv' ? 'Kamera:' : 'Camera:'}</strong> {language === 'sv' ? 'Närbild, helbild, fågelperspektiv, kameramodell' : 'Close-up, full shot, bird\'s eye view, camera model'}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-500 font-bold">•</span>
                  <span><strong className="text-amber-100">{language === 'sv' ? 'Miljö och tid:' : 'Setting and time:'}</strong> {language === 'sv' ? 'Var och när scenen utspelar sig' : 'Where and when the scene takes place'}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-500 font-bold">•</span>
                  <span><strong className="text-amber-100">{language === 'sv' ? 'Karaktärer:' : 'Characters:'}</strong> {language === 'sv' ? 'Vilka personer, djur eller föremål ska synas' : 'Which people, animals or objects should appear'}</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-amber-500 font-bold">•</span>
                  <span><strong className="text-amber-100">{language === 'sv' ? 'Färg och ljus:' : 'Color and light:'}</strong> {language === 'sv' ? 'Golden hour, kvällsljus, dimma, neon' : 'Golden hour, evening light, fog, neon'}</span>
                </li>
              </ul>
            </div>

            <div className="bg-black/30 p-4 rounded border border-amber-600/30">
              <p className="text-amber-300 font-bold mb-2">💡 {language === 'sv' ? 'Tips:' : 'Tip:'}</p>
              <p className="text-amber-200/90">
                {language === 'sv' 
                  ? 'Ange också vad AI:n inte får göra, t.ex. "ändra inte bakgrunden" eller "lägg inte till nya objekt".'
                  : 'Also specify what the AI must not do, e.g. "don\'t change the background" or "don\'t add new objects".'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div id="priser" className="relative py-24 px-4 bg-gradient-to-br from-gray-900 via-green-950 to-gray-900">
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
                name: language === 'sv' ? 'Klassisk' : 'Classic', 
                subtitle: language === 'sv' ? '$5 (ca 55 kr)' : '$5 (~55 SEK)',
                price: "$5", videos: 3, images: 8,
                color: "bg-amber-900", borderColor: "border-amber-600",
                packageType: "klassisk" as const
              },
              { 
                name: 'Standard', 
                subtitle: language === 'sv' ? '$12 (ca 130 kr)' : '$12 (~130 SEK)',
                price: "$12", videos: 8, images: 20,
                color: "bg-red-900", borderColor: "border-red-700",
                packageType: "standard" as const
              },
              { 
                name: 'Premium', 
                subtitle: language === 'sv' ? '$22 (ca 240 kr)' : '$22 (~240 SEK)',
                price: "$22", videos: 15, images: 40,
                color: "bg-slate-800", borderColor: "border-slate-600",
                packageType: "premium" as const
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
                      <Camera className="w-5 h-5 text-amber-500" />
                      <span className="font-semibold">{pkg.images} {t.images}</span>
                    </div>
                    <div className="flex items-center gap-3 text-amber-200">
                      <Video className="w-5 h-5 text-amber-500" />
                      <span className="font-semibold">{pkg.videos} {t.videos} ({language === 'sv' ? 'upp till 10 sek' : 'up to 10 sec'})</span>
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

      {/* CTA for logged in users */}
      {user && (
        <div className="relative py-16 px-4 bg-gradient-to-br from-amber-950/50 to-gray-900">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-amber-100 mb-4">
              {language === 'sv' ? 'Redo att skapa?' : 'Ready to create?'}
            </h2>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold py-4 px-8 rounded-lg transition-all duration-300 shadow-lg hover:shadow-amber-500/50 text-xl"
            >
              {language === 'sv' ? '🎬 Gå till din studio' : '🎬 Go to your studio'}
            </button>
          </div>
        </div>
      )}

      {/* Contact Form */}
      <ContactForm />

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
          <p className="text-amber-200/60 text-xs mb-4 max-w-2xl mx-auto">
            {language === 'sv' 
              ? 'Priser inklusive moms. Paketen ger tillgång till hög kvalitet och ljud i videon. Tack för att du testar!'
              : 'Prices include VAT. Packages include high quality and audio in videos. Thank you for trying!'}
          </p>
          <p className="text-amber-300/60">© 2024 Vintage AI • {t.footer}</p>
        </div>
      </div>
    </div>
  );
};

export default Home;
