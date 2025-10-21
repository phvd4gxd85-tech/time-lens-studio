import { Film } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { PricingCard } from '@/components/PricingCard';
import { GoldCorner } from '@/components/GoldCorner';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const Home = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handlePurchase = (packageType: string) => {
    toast({
      title: "Coming Soon",
      description: "Payment integration will be available shortly.",
    });
  };

  return (
    <div className="space-y-20">
      <div className="text-center space-y-8 py-20 px-4">
        <div className="inline-block">
          <Film size={64} className="text-accent mx-auto mb-8" strokeWidth={1} />
        </div>
        <h1 className="text-7xl text-foreground tracking-wider font-futura font-light">
          {t.title}
        </h1>
        <div className="w-32 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent mx-auto"></div>
        <p className="text-xl text-muted-foreground italic max-w-2xl mx-auto font-serif">
          {t.hero}
        </p>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        <h2 className="text-4xl text-center text-foreground mb-12 tracking-[0.15em] uppercase font-futura font-normal">
          {t.pricingTitle}
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <PricingCard 
            title={t.trial} 
            price="2" 
            tokens="2" 
            desc={t.trialDesc} 
            videos="2" 
            images="8" 
            isOneTime={true}
            oneTimeText={t.oneTimeOffer}
            buyText={t.buyNow}
            videosText={t.videos}
            imagesText={t.images}
            onBuy={() => handlePurchase('trial')}
          />
          <PricingCard 
            title={t.starter} 
            price="15" 
            tokens="12" 
            desc={t.starterDesc} 
            videos="12" 
            images="48"
            buyText={t.buyNow}
            videosText={t.videos}
            imagesText={t.images}
            onBuy={() => handlePurchase('starter')}
          />
          <PricingCard 
            title={t.pro} 
            price="30" 
            tokens="25" 
            desc={t.proDesc} 
            videos="25" 
            images="100"
            buyText={t.buyNow}
            videosText={t.videos}
            imagesText={t.images}
            onBuy={() => handlePurchase('pro')}
          />
        </div>
        <div className="text-center mt-8 text-muted-foreground text-sm font-futura">
          {t.conversion}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4">
        <h2 className="text-3xl text-center text-foreground mb-12 tracking-[0.15em] uppercase font-futura font-normal">
          {t.howItWorks}
        </h2>
        <div className="grid md:grid-cols-4 gap-6">
          {[t.step1, t.step2, t.step3, t.step4].map((step, i) => (
            <div key={i} className="text-center">
              <div className="w-12 h-12 mx-auto mb-4 border border-accent flex items-center justify-center text-accent text-xl font-futura">
                {i + 1}
              </div>
              <p className="text-foreground text-sm font-futura">
                {step}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center py-12 px-4">
        <div className="max-w-2xl mx-auto relative bg-secondary p-8">
          <GoldCorner position="topLeft" />
          <GoldCorner position="topRight" />
          <GoldCorner position="bottomLeft" />
          <GoldCorner position="bottomRight" />
          <div className="absolute inset-0 border border-border"></div>
          <p className="relative text-foreground italic font-serif">
            {t.gdprNotice}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
