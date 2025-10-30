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
    <section className="py-20 px-4 bg-gradient-to-br from-purple-950/20 to-pink-950/20">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Runway Video Generator
          </h2>
          <p className="text-lg text-muted-foreground">
            {language === 'sv' 
              ? "Skapa professionella videos med AI-guidning" 
              : "Create professional videos with AI guidance"}
          </p>
        </div>

        {/* Image upload */}
        <div className="mb-8">
          <label className="block w-full cursor-pointer">
            <div className="border-2 border-dashed border-primary/50 rounded-lg p-8 hover:border-primary transition-colors text-center">
              {uploadedImage ? (
                <img src={uploadedImage} alt="Uploaded" className="max-h-64 mx-auto rounded" />
              ) : (
                <div className="space-y-2">
                  <Upload className="w-12 h-12 mx-auto text-primary" />
                  <p>{language === 'sv' ? "Ladda upp bild" : "Upload image"}</p>
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
              <label className="block mb-2 font-medium">
                {language === 'sv' ? "Från vilket årtionde är bilden?" : "From which decade is the image?"}
              </label>
              <select
                value={imageDecade}
                onChange={(e) => setImageDecade(e.target.value)}
                className="w-full p-3 rounded-lg bg-background border border-input"
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
              <label className="block mb-2 font-medium">
                {language === 'sv' ? "Vad är huvudmotivet?" : "What is the main subject?"}
              </label>
              <select
                value={mainSubject}
                onChange={(e) => setMainSubject(e.target.value)}
                className="w-full p-3 rounded-lg bg-background border border-input"
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
              <label className="block mb-2 font-medium">
                {language === 'sv' ? "Beskriv kort bilden (max 100 tecken)" : "Describe the image briefly (max 100 chars)"}
              </label>
              <Textarea
                value={imageDescription}
                onChange={(e) => setImageDescription(e.target.value.slice(0, 100))}
                placeholder={language === 'sv' ? "T.ex. En familj på stranden..." : "E.g. A family at the beach..."}
                maxLength={100}
                className="resize-none"
              />
              <p className="text-sm text-muted-foreground mt-1">{imageDescription.length}/100</p>
            </div>

            <div>
              <label className="block mb-2 font-medium">
                {language === 'sv' ? "Hur ska bilden animeras?" : "How should the image be animated?"}
              </label>
              <div className="space-y-2">
                <Button
                  variant={desiredMovement === "subtle" ? "default" : "outline"}
                  onClick={() => setDesiredMovement("subtle")}
                  className="w-full justify-start text-left"
                >
                  <span className="font-semibold">{language === 'sv' ? "Subtil animering" : "Subtle animation"}:</span>
                  <span className="ml-2 text-sm opacity-80">
                    {language === 'sv' ? "Mjuk, levande känsla" : "Soft, living feeling"}
                  </span>
                </Button>
                <Button
                  variant={desiredMovement === "focus" ? "default" : "outline"}
                  onClick={() => setDesiredMovement("focus")}
                  className="w-full justify-start text-left"
                >
                  <span className="font-semibold">{language === 'sv' ? "Fokus på huvudmotiv" : "Focus on main subject"}:</span>
                  <span className="ml-2 text-sm opacity-80">
                    {language === 'sv' ? "Huvudmotiv rör sig mer" : "Main subject moves more"}
                  </span>
                </Button>
                <Button
                  variant={desiredMovement === "creative" ? "default" : "outline"}
                  onClick={() => setDesiredMovement("creative")}
                  className="w-full justify-start text-left"
                >
                  <span className="font-semibold">{language === 'sv' ? "Kreativ tolkning" : "Creative interpretation"}:</span>
                  <span className="ml-2 text-sm opacity-80">
                    {language === 'sv' ? "Mer uttrycksfull rörelse" : "More expressive movement"}
                  </span>
                </Button>
              </div>
            </div>

            <div>
              <label className="block mb-2 font-medium">
                {language === 'sv' ? "Vilken stil/känsla?" : "Which style/feeling?"}
              </label>
              <div className="space-y-2">
                <Button
                  variant={desiredStyle === "realistic" ? "default" : "outline"}
                  onClick={() => setDesiredStyle("realistic")}
                  className="w-full justify-start text-left"
                >
                  <span className="font-semibold">{language === 'sv' ? "Realistisk/Autentisk" : "Realistic/Authentic"}:</span>
                  <span className="ml-2 text-sm opacity-80">
                    {language === 'sv' ? "Bevara ursprungligt utseende" : "Preserve original appearance"}
                  </span>
                </Button>
                <Button
                  variant={desiredStyle === "artistic" ? "default" : "outline"}
                  onClick={() => setDesiredStyle("artistic")}
                  className="w-full justify-start text-left"
                >
                  <span className="font-semibold">{language === 'sv' ? "Konstnärlig/Målad" : "Artistic/Painted"}:</span>
                  <span className="ml-2 text-sm opacity-80">
                    {language === 'sv' ? "Mer konstnärlig känsla" : "More artistic feeling"}
                  </span>
                </Button>
                <Button
                  variant={desiredStyle === "dreamy" ? "default" : "outline"}
                  onClick={() => setDesiredStyle("dreamy")}
                  className="w-full justify-start text-left"
                >
                  <span className="font-semibold">{language === 'sv' ? "Drömlik/Magisk" : "Dreamy/Magical"}:</span>
                  <span className="ml-2 text-sm opacity-80">
                    {language === 'sv' ? "Eterisk eller fantasifull touch" : "Ethereal or fantastical touch"}
                  </span>
                </Button>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || generationCount >= 3}
              className="w-full h-12"
            >
              {isGenerating ? (
                <>{language === 'sv' ? "Genererar..." : "Generating..."}</>
              ) : (
                <>
                  <Sparkles className="mr-2" />
                  {language === 'sv' ? "Generera Video" : "Generate Video"}
                  {generationCount > 0 && ` (${generationCount}/3)`}
                </>
              )}
            </Button>
          </div>
        )}

        {/* Video result */}
        {videoUrl && (
          <div className="mt-8 space-y-4">
            <video src={videoUrl} controls className="w-full rounded-lg" />
            
            <div className="flex gap-2 flex-wrap">
              <Button onClick={handleDownload} className="flex-1">
                <Download className="mr-2" />
                {language === 'sv' ? "Ladda ner" : "Download"}
              </Button>
              
              {generationCount < 3 && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowFeedback(true);
                      setShowStyleQuestions(false);
                    }}
                    className="flex-1"
                  >
                    <RefreshCw className="mr-2" />
                    {language === 'sv' ? "Justera videon" : "Adjust video"}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowStyleQuestions(true);
                      setShowFeedback(false);
                    }}
                    className="flex-1"
                  >
                    {language === 'sv' ? "Prova annan stil" : "Try other style"}
                  </Button>
                </>
              )}
            </div>

            {showFeedback && (
              <div className="space-y-2">
                <Textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder={language === 'sv' ? "Vad vill du ändra?" : "What do you want to change?"}
                  className="resize-none"
                />
                <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
                  {language === 'sv' ? "Generera Ny Version" : "Generate New Version"}
                </Button>
              </div>
            )}

            {showStyleQuestions && (
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 font-medium">
                    {language === 'sv' ? "Ny rörelse:" : "New movement:"}
                  </label>
                  <div className="space-y-2">
                    <Button
                      variant={desiredMovement === "subtle" ? "default" : "outline"}
                      onClick={() => setDesiredMovement("subtle")}
                      className="w-full text-left justify-start"
                    >
                      {language === 'sv' ? "Subtil" : "Subtle"}
                    </Button>
                    <Button
                      variant={desiredMovement === "focus" ? "default" : "outline"}
                      onClick={() => setDesiredMovement("focus")}
                      className="w-full text-left justify-start"
                    >
                      {language === 'sv' ? "Fokus på huvudmotiv" : "Focus on main subject"}
                    </Button>
                    <Button
                      variant={desiredMovement === "creative" ? "default" : "outline"}
                      onClick={() => setDesiredMovement("creative")}
                      className="w-full text-left justify-start"
                    >
                      {language === 'sv' ? "Kreativ" : "Creative"}
                    </Button>
                  </div>
                </div>
                
                <div>
                  <label className="block mb-2 font-medium">
                    {language === 'sv' ? "Ny stil:" : "New style:"}
                  </label>
                  <div className="space-y-2">
                    <Button
                      variant={desiredStyle === "realistic" ? "default" : "outline"}
                      onClick={() => setDesiredStyle("realistic")}
                      className="w-full text-left justify-start"
                    >
                      {language === 'sv' ? "Realistisk" : "Realistic"}
                    </Button>
                    <Button
                      variant={desiredStyle === "artistic" ? "default" : "outline"}
                      onClick={() => setDesiredStyle("artistic")}
                      className="w-full text-left justify-start"
                    >
                      {language === 'sv' ? "Konstnärlig" : "Artistic"}
                    </Button>
                    <Button
                      variant={desiredStyle === "dreamy" ? "default" : "outline"}
                      onClick={() => setDesiredStyle("dreamy")}
                      className="w-full text-left justify-start"
                    >
                      {language === 'sv' ? "Drömlik" : "Dreamy"}
                    </Button>
                  </div>
                </div>
                
                <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
                  {language === 'sv' ? "Generera Ny Version" : "Generate New Version"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
