import { Video, Camera } from 'lucide-react';
import { GoldCorner } from './GoldCorner';
import { Button } from './ui/button';

interface PricingCardProps {
  title: string;
  price: string;
  tokens: string;
  desc: string;
  videos: string;
  images: string;
  isOneTime?: boolean;
  oneTimeText?: string;
  buyText: string;
  videosText: string;
  imagesText: string;
  onBuy: () => void;
}

export const PricingCard = ({ 
  title, 
  price, 
  tokens, 
  desc, 
  videos, 
  images, 
  isOneTime,
  oneTimeText,
  buyText,
  videosText,
  imagesText,
  onBuy
}: PricingCardProps) => (
  <div className="relative bg-gradient-to-b from-card to-secondary p-8 group hover:shadow-[var(--shadow-elegant)] transition-all duration-500">
    <GoldCorner position="topLeft" />
    <GoldCorner position="topRight" />
    <GoldCorner position="bottomLeft" />
    <GoldCorner position="bottomRight" />

    <div className="absolute inset-0 border border-border pointer-events-none"></div>
    <div className="absolute inset-0 border-2 border-transparent group-hover:border-accent/30 transition-all duration-500 pointer-events-none"></div>
    
    <div className="relative z-10">
      <div className="text-center mb-6">
        <div className="inline-block mb-4">
          <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent"></div>
        </div>
        <h3 className="text-2xl tracking-[0.2em] uppercase text-foreground mb-3 font-futura font-medium">
          {title}
        </h3>
        <p className="text-muted-foreground italic text-sm mb-4 font-serif">{desc}</p>
        <div className="text-5xl text-foreground mb-1 font-futura font-light">
          ${price}
        </div>
        {isOneTime && oneTimeText && (
          <div className="mt-2">
            <span className="text-xs tracking-wider uppercase text-accent font-futura">
              {oneTimeText}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-4 mb-8">
        <div className="flex items-center justify-center gap-3 text-foreground">
          <Video size={18} className="text-accent" />
          <span className="font-futura">{videos} {videosText}</span>
        </div>
        <div className="flex items-center justify-center gap-3 text-foreground">
          <Camera size={18} className="text-accent" />
          <span className="font-futura">{images} {imagesText}</span>
        </div>
        <div className="text-center">
          <div className="inline-block px-4 py-1 bg-muted text-foreground text-sm font-futura">
            {tokens} tokens
          </div>
        </div>
      </div>

      <Button 
        onClick={onBuy}
        className="w-full relative overflow-hidden bg-foreground hover:bg-foreground/90 text-background py-6 font-futura tracking-[0.15em] uppercase text-sm"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/20 to-accent/0 transform translate-x-full group-hover:translate-x-0 transition-transform duration-700"></div>
        <span className="relative">{buyText}</span>
      </Button>
    </div>
  </div>
);
