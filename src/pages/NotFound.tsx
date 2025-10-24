import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-950 to-gray-900 text-amber-50 flex items-center justify-center relative">
      {/* Art Deco Corner Ornaments */}
      <div className="fixed top-0 left-0 w-32 h-32 pointer-events-none z-50">
        <svg viewBox="0 0 100 100" className="w-full h-full opacity-60">
          <path d="M0,0 L60,0 L55,5 L5,5 L5,55 L0,60 Z" fill="#D4AF37"/>
          <path d="M0,0 L50,0 L45,5 L10,5 L10,45 L5,50 L0,50 Z" fill="#B8860B"/>
        </svg>
      </div>
      <div className="fixed top-0 right-0 w-32 h-32 pointer-events-none z-50">
        <svg viewBox="0 0 100 100" className="w-full h-full opacity-60">
          <path d="M100,0 L40,0 L45,5 L95,5 L95,55 L100,60 Z" fill="#D4AF37"/>
          <path d="M100,0 L50,0 L55,5 L90,5 L90,45 L95,50 L100,50 Z" fill="#B8860B"/>
        </svg>
      </div>

      <div className="text-center max-w-2xl mx-auto px-4">
        <div className="relative bg-gradient-to-br from-gray-900 to-green-900 p-12 border-2 border-amber-600 rounded-lg shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-600/20 to-red-900/20 blur-xl"></div>
          
          <div className="relative z-10 space-y-6">
            <div className="flex justify-center mb-6">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <text x="40" y="60" fontSize="48" fill="#D4AF37" textAnchor="middle" fontWeight="bold">404</text>
              </svg>
            </div>

            <h1 className="text-4xl font-bold text-amber-100 tracking-[0.15em] uppercase mb-4">
              Page Not Found
            </h1>
            
            <p className="text-xl text-amber-200/80 mb-8">
              The page you're looking for doesn't exist in our vintage collection.
            </p>

            <Button
              onClick={() => navigate('/')}
              className="bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-amber-50 font-bold py-4 px-8 tracking-[0.15em] uppercase"
            >
              <Home className="w-5 h-5 mr-2" />
              {t.goToHome}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
