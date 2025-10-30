import { useState } from 'react';
import { Upload, Sparkles, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

export const RunwayVideoGenerator = () => {
  const { toast } = useToast();
  const { language } = useLanguage();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  
  // Question states
  const [imageDecade, setImageDecade] = useState<string>("");
  const [mainSubject, setMainSubject] = useState<string>("");
  const [imageDescription, setImageDescription] = useState<string>("");
  const [desiredMovement, setDesiredMovement] = useState<string>("");
  const [desiredStyle, setDesiredStyle] = useState<string>("");
  
  // Generation states
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationCount, setGenerationCount] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [showStyleQuestions, setShowStyleQuestions] = useState(false);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const ratio = img.width / img.height;
        let detectedRatio = "16:9";
        
        if (Math.abs(ratio - 1) < 0.1) detectedRatio = "1:1";
        else if (Math.abs(ratio - 4/3) < 0.1) detectedRatio = "4:3";
        else if (Math.abs(ratio - 16/9) < 0.1) detectedRatio = "16:9";
        
        setAspectRatio(detectedRatio);
        setUploadedImage(e.target?.result as string);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!uploadedImage) {
      toast({
        title: language === 'sv' ? "Ingen bild" : "No image",
        description: language === 'sv' ? "Ladda upp en bild först" : "Upload an image first",
        variant: "destructive",
      });
      return;
    }

    if (!imageDecade || !mainSubject || !imageDescription || !desiredMovement || !desiredStyle) {
      toast({
        title: language === 'sv' ? "Ofullständig information" : "Incomplete information",
        description: language === 'sv' ? "Vänligen svara på alla frågor" : "Please answer all questions",
        variant: "destructive",
      });
      return;
    }

    if (generationCount >= 3) {
      toast({
        title: language === 'sv' ? "Max antal försök" : "Max attempts reached",
        description: language === 'sv' ? "Du har använt alla 3 försök. Ladda upp en ny bild." : "You've used all 3 attempts. Upload a new image.",
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);

    try {
      // Step 1: Generate prompt
      const { data: promptData, error: promptError } = await supabase.functions.invoke('generate-runway-prompt', {
        body: {
          image_decade: imageDecade,
          main_subject: mainSubject,
          image_description: imageDescription,
          desired_movement: desiredMovement,
          desired_style: desiredStyle,
          current_prompt_feedback: feedback || ""
        }
      });

      if (promptError) throw promptError;

      console.log("Generated prompt:", promptData.generated_prompt);

      // Step 2: Generate video
      const { data: videoData, error: videoError } = await supabase.functions.invoke('generate-runway-video', {
        body: {
          imageUrl: uploadedImage,
          text_prompt: promptData.generated_prompt,
          aspect_ratio: aspectRatio
        }
      });

      if (videoError) throw videoError;

      console.log("Video generation started:", videoData.task_id);

      // Step 3: Poll for status
      const taskId = videoData.task_id;
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max (5s intervals)

      const pollStatus = setInterval(async () => {
        attempts++;
        
        try {
          const { data: statusData, error: statusError } = await supabase.functions.invoke('check-runway-status', {
            body: { task_id: taskId }
          });

          if (statusError) throw statusError;

          console.log("Status:", statusData.status);

          if (statusData.status === 'SUCCEEDED') {
            clearInterval(pollStatus);
            setVideoUrl(statusData.output?.[0] || null);
            setGenerationCount(prev => prev + 1);
            setIsGenerating(false);
            toast({
              title: language === 'sv' ? "Video klar!" : "Video ready!",
              description: language === 'sv' ? "Din video har genererats" : "Your video has been generated",
            });
          } else if (statusData.status === 'FAILED') {
            clearInterval(pollStatus);
            setIsGenerating(false);
            throw new Error("Video generation failed");
          }

          if (attempts >= maxAttempts) {
            clearInterval(pollStatus);
            setIsGenerating(false);
            throw new Error("Timeout waiting for video");
          }
        } catch (err) {
          clearInterval(pollStatus);
          setIsGenerating(false);
          throw err;
        }
      }, 5000);

    } catch (error: any) {
      console.error("Error:", error);
      toast({
        title: language === 'sv' ? "Fel" : "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!videoUrl) return;

    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'runway-video.mp4';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: language === 'sv' ? "Nedladdningsfel" : "Download error",
        variant: "destructive",
      });
    }
  };

  return (
    <section className="py-20 px-4 bg-gradient-to-br from-gray-900 via-green-950 to-gray-900">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 text-amber-100">
            RUNWAY VIDEO GENERATOR
          </h2>
          <p className="text-lg text-amber-200/80">
            {language === 'sv' 
              ? "Skapa professionella videos med AI-guidning" 
              : "Create professional videos with AI guidance"}
          </p>
        </div>

        {/* Image upload */}
        <div className="mb-8">
          <label className="block w-full cursor-pointer">
            <div className="border-2 border-dashed border-amber-600/50 rounded-lg p-8 hover:border-amber-600 transition-colors text-center bg-black/20">
              {uploadedImage ? (
                <img src={uploadedImage} alt="Uploaded" className="max-h-64 mx-auto rounded border-2 border-amber-600/30" />
              ) : (
                <div className="space-y-2">
                  <Upload className="w-12 h-12 mx-auto text-amber-500" />
                  <p className="text-amber-200">{language === 'sv' ? "Ladda upp bild" : "Upload image"}</p>
                </div>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Questions */}
        {uploadedImage && (
          <div className="space-y-6 mb-8">
            <div>
              <label className="block mb-2 font-medium text-amber-100">
                {language === 'sv' ? "Från vilket årtionde är bilden?" : "From which decade is the image?"}
              </label>
              <select
                value={imageDecade}
                onChange={(e) => setImageDecade(e.target.value)}
                className="w-full p-3 rounded-lg bg-black/40 border border-amber-600/40 text-amber-100"
              >
                <option value="">{language === 'sv' ? "Välj..." : "Select..."}</option>
                <option value="1900-1910">1900-1910</option>
                <option value="1920s">1920-tal</option>
                <option value="1930s">1930-tal</option>
                <option value="1940s">1940-tal</option>
                <option value="1950s">1950-tal</option>
                <option value="1960s">1960-tal</option>
                <option value="1970s">1970-tal</option>
                <option value="1980s">1980-tal</option>
                <option value="1990s">1990-tal</option>
                <option value="2000s">2000-tal</option>
                <option value="2010s">2010-tal</option>
                <option value="2020s">2020-tal</option>
                <option value="unknown">{language === 'sv' ? "Vet ej / Annat" : "Unknown / Other"}</option>
              </select>
            </div>

            <div>
              <label className="block mb-2 font-medium text-amber-100">
                {language === 'sv' ? "Vad är huvudmotivet?" : "What is the main subject?"}
              </label>
              <select
                value={mainSubject}
                onChange={(e) => setMainSubject(e.target.value)}
                className="w-full p-3 rounded-lg bg-black/40 border border-amber-600/40 text-amber-100"
              >
                <option value="">{language === 'sv' ? "Välj..." : "Select..."}</option>
                <option value="person">{language === 'sv' ? "En person" : "A person"}</option>
                <option value="group">{language === 'sv' ? "En grupp människor" : "A group of people"}</option>
                <option value="animal">{language === 'sv' ? "Ett djur" : "An animal"}</option>
                <option value="object">{language === 'sv' ? "Ett föremål" : "An object"}</option>
                <option value="landscape">{language === 'sv' ? "Ett landskap/byggnad" : "A landscape/building"}</option>
                <option value="other">{language === 'sv' ? "Annat" : "Other"}</option>
              </select>
            </div>

            <div>
              <label className="block mb-2 font-medium text-amber-100">
                {language === 'sv' ? "Beskriv kort bilden (max 100 tecken)" : "Describe the image briefly (max 100 chars)"}
              </label>
              <Textarea
                value={imageDescription}
                onChange={(e) => setImageDescription(e.target.value.slice(0, 100))}
                placeholder={language === 'sv' ? "T.ex. En familj på stranden..." : "E.g. A family at the beach..."}
                maxLength={100}
                className="resize-none bg-black/40 border-amber-600/40 text-amber-100"
              />
              <p className="text-sm text-amber-200/60 mt-1">{imageDescription.length}/100</p>
            </div>

            <div>
              <label className="block mb-2 font-medium text-amber-100">
                {language === 'sv' ? "Hur ska bilden animeras?" : "How should the image be animated?"}
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => setDesiredMovement("subtle")}
                  className={`w-full p-4 rounded-lg text-left transition-all ${
                    desiredMovement === "subtle" 
                      ? "bg-amber-600 border-2 border-amber-400" 
                      : "bg-black/40 border-2 border-amber-600/40 hover:border-amber-600/60"
                  }`}
                >
                  <span className="font-semibold text-amber-100">{language === 'sv' ? "Subtil animering" : "Subtle animation"}:</span>
                  <span className="ml-2 text-sm text-amber-200/80">
                    {language === 'sv' ? "Mjuk, levande känsla" : "Soft, living feeling"}
                  </span>
                </button>
                <button
                  onClick={() => setDesiredMovement("focus")}
                  className={`w-full p-4 rounded-lg text-left transition-all ${
                    desiredMovement === "focus" 
                      ? "bg-amber-600 border-2 border-amber-400" 
                      : "bg-black/40 border-2 border-amber-600/40 hover:border-amber-600/60"
                  }`}
                >
                  <span className="font-semibold text-amber-100">{language === 'sv' ? "Fokus på huvudmotiv" : "Focus on main subject"}:</span>
                  <span className="ml-2 text-sm text-amber-200/80">
                    {language === 'sv' ? "Huvudmotiv rör sig mer" : "Main subject moves more"}
                  </span>
                </button>
                <button
                  onClick={() => setDesiredMovement("creative")}
                  className={`w-full p-4 rounded-lg text-left transition-all ${
                    desiredMovement === "creative" 
                      ? "bg-amber-600 border-2 border-amber-400" 
                      : "bg-black/40 border-2 border-amber-600/40 hover:border-amber-600/60"
                  }`}
                >
                  <span className="font-semibold text-amber-100">{language === 'sv' ? "Kreativ tolkning" : "Creative interpretation"}:</span>
                  <span className="ml-2 text-sm text-amber-200/80">
                    {language === 'sv' ? "Mer uttrycksfull rörelse" : "More expressive movement"}
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label className="block mb-2 font-medium text-amber-100">
                {language === 'sv' ? "Vilken stil/känsla?" : "Which style/feeling?"}
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => setDesiredStyle("realistic")}
                  className={`w-full p-4 rounded-lg text-left transition-all ${
                    desiredStyle === "realistic" 
                      ? "bg-amber-600 border-2 border-amber-400" 
                      : "bg-black/40 border-2 border-amber-600/40 hover:border-amber-600/60"
                  }`}
                >
                  <span className="font-semibold text-amber-100">{language === 'sv' ? "Realistisk/Autentisk" : "Realistic/Authentic"}:</span>
                  <span className="ml-2 text-sm text-amber-200/80">
                    {language === 'sv' ? "Bevara ursprungligt utseende" : "Preserve original appearance"}
                  </span>
                </button>
                <button
                  onClick={() => setDesiredStyle("artistic")}
                  className={`w-full p-4 rounded-lg text-left transition-all ${
                    desiredStyle === "artistic" 
                      ? "bg-amber-600 border-2 border-amber-400" 
                      : "bg-black/40 border-2 border-amber-600/40 hover:border-amber-600/60"
                  }`}
                >
                  <span className="font-semibold text-amber-100">{language === 'sv' ? "Konstnärlig/Målad" : "Artistic/Painted"}:</span>
                  <span className="ml-2 text-sm text-amber-200/80">
                    {language === 'sv' ? "Mer konstnärlig känsla" : "More artistic feeling"}
                  </span>
                </button>
                <button
                  onClick={() => setDesiredStyle("dreamy")}
                  className={`w-full p-4 rounded-lg text-left transition-all ${
                    desiredStyle === "dreamy" 
                      ? "bg-amber-600 border-2 border-amber-400" 
                      : "bg-black/40 border-2 border-amber-600/40 hover:border-amber-600/60"
                  }`}
                >
                  <span className="font-semibold text-amber-100">{language === 'sv' ? "Drömlik/Magisk" : "Dreamy/Magical"}:</span>
                  <span className="ml-2 text-sm text-amber-200/80">
                    {language === 'sv' ? "Eterisk eller fantasifull touch" : "Ethereal or fantastical touch"}
                  </span>
                </button>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || generationCount >= 3}
              className="w-full h-12 bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 disabled:from-gray-700 disabled:to-gray-600 text-amber-50 font-bold rounded transition-all duration-300 shadow-lg hover:shadow-amber-600/50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>{language === 'sv' ? "Genererar..." : "Generating..."}</>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  {language === 'sv' ? "Generera Video" : "Generate Video"}
                  {generationCount > 0 && ` (${generationCount}/3)`}
                </>
              )}
            </button>
          </div>
        )}

        {/* Video result */}
        {videoUrl && (
          <div className="mt-8 space-y-4">
            <video src={videoUrl} controls className="w-full rounded-lg border-2 border-amber-600/50" />
            
            <div className="flex gap-2 flex-wrap">
              <button 
                onClick={handleDownload} 
                className="flex-1 bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-amber-50 font-bold py-3 rounded transition-all duration-300 shadow-lg hover:shadow-amber-600/50 flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                {language === 'sv' ? "Ladda ner" : "Download"}
              </button>
              
              {generationCount < 3 && (
                <>
                  <button
                    onClick={() => {
                      setShowFeedback(true);
                      setShowStyleQuestions(false);
                    }}
                    className="flex-1 bg-black/40 border-2 border-amber-600/40 hover:border-amber-600 text-amber-100 font-bold py-3 rounded transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" />
                    {language === 'sv' ? "Justera videon" : "Adjust video"}
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowStyleQuestions(true);
                      setShowFeedback(false);
                    }}
                    className="flex-1 bg-black/40 border-2 border-amber-600/40 hover:border-amber-600 text-amber-100 font-bold py-3 rounded transition-all flex items-center justify-center gap-2"
                  >
                    {language === 'sv' ? "Prova annan stil" : "Try other style"}
                  </button>
                </>
              )}
            </div>

            {showFeedback && (
              <div className="space-y-2">
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder={language === 'sv' ? "Vad vill du ändra?" : "What do you want to change?"}
                  className="resize-none bg-black/40 border-amber-600/40 text-amber-100"
                />
                <button 
                  onClick={handleGenerate} 
                  disabled={isGenerating} 
                  className="w-full bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 disabled:from-gray-700 disabled:to-gray-600 text-amber-50 font-bold py-3 rounded transition-all duration-300 shadow-lg hover:shadow-amber-600/50 disabled:cursor-not-allowed"
                >
                  {language === 'sv' ? "Generera Ny Version" : "Generate New Version"}
                </button>
              </div>
            )}

            {showStyleQuestions && (
              <div className="space-y-4 bg-black/20 p-4 rounded-lg border border-amber-600/30">
                <div>
                  <label className="block mb-2 font-medium text-amber-100">
                    {language === 'sv' ? "Ny rörelse:" : "New movement:"}
                  </label>
                  <div className="space-y-2">
                    {["subtle", "focus", "creative"].map((type) => (
                      <button
                        key={type}
                        onClick={() => setDesiredMovement(type)}
                        className={`w-full p-3 rounded text-left transition-all ${
                          desiredMovement === type
                            ? "bg-amber-600 border-2 border-amber-400"
                            : "bg-black/40 border-2 border-amber-600/40 hover:border-amber-600/60"
                        }`}
                      >
                        <span className="text-amber-100 font-semibold">
                          {type === "subtle" && (language === 'sv' ? "Subtil" : "Subtle")}
                          {type === "focus" && (language === 'sv' ? "Fokus på huvudmotiv" : "Focus on main subject")}
                          {type === "creative" && (language === 'sv' ? "Kreativ" : "Creative")}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block mb-2 font-medium text-amber-100">
                    {language === 'sv' ? "Ny stil:" : "New style:"}
                  </label>
                  <div className="space-y-2">
                    {["realistic", "artistic", "dreamy"].map((style) => (
                      <button
                        key={style}
                        onClick={() => setDesiredStyle(style)}
                        className={`w-full p-3 rounded text-left transition-all ${
                          desiredStyle === style
                            ? "bg-amber-600 border-2 border-amber-400"
                            : "bg-black/40 border-2 border-amber-600/40 hover:border-amber-600/60"
                        }`}
                      >
                        <span className="text-amber-100 font-semibold">
                          {style === "realistic" && (language === 'sv' ? "Realistisk" : "Realistic")}
                          {style === "artistic" && (language === 'sv' ? "Konstnärlig" : "Artistic")}
                          {style === "dreamy" && (language === 'sv' ? "Drömlik" : "Dreamy")}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                
                <button 
                  onClick={handleGenerate} 
                  disabled={isGenerating} 
                  className="w-full bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 disabled:from-gray-700 disabled:to-gray-600 text-amber-50 font-bold py-3 rounded transition-all duration-300 shadow-lg hover:shadow-amber-600/50 disabled:cursor-not-allowed"
                >
                  {language === 'sv' ? "Generera Ny Version" : "Generate New Version"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
