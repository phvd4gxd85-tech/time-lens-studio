import { useState } from 'react';
import { Upload, Sparkles, Download, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

export const VEO3VideoGenerator = () => {
  const { toast } = useToast();
  const { language } = useLanguage();
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  
  // Question states for VEO3 Base-5 Prompt Architecture
  const [cameraAngle, setCameraAngle] = useState<string>("");
  const [settingDescription, setSettingDescription] = useState<string>("");
  const [characterDescription, setCharacterDescription] = useState<string>("");
  const [dialogueAction, setDialogueAction] = useState<string>("");
  const [ambientSound, setAmbientSound] = useState<string>("");
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!uploadedImage) {
      toast({
        title: language === 'sv' ? "Bild krävs" : "Image required",
        description: language === 'sv' ? "Ladda upp en bild först" : "Please upload an image first",
        variant: "destructive"
      });
      return;
    }

    if (!cameraAngle || !settingDescription || !characterDescription || !dialogueAction || !ambientSound) {
      toast({
        title: language === 'sv' ? "Alla fält krävs" : "All fields required",
        description: language === 'sv' ? "Fyll i alla fält för bästa resultat" : "Fill in all fields for best results",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    setVideoUrl(null);
    setProgress(0);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: language === 'sv' ? "Inte inloggad" : "Not logged in",
          description: language === 'sv' ? "Du måste vara inloggad för att generera videos" : "You must be logged in to generate videos",
          variant: "destructive"
        });
        setIsGenerating(false);
        return;
      }

      // Step 1: Generate VEO3 prompt using AI
      console.log("Step 1: Generating VEO3 prompt with AI");
      const { data: promptData, error: promptError } = await supabase.functions.invoke('generate-veo3-prompt', {
        body: {
          camera_angle: cameraAngle,
          setting_description: settingDescription,
          character_description: characterDescription,
          dialogue_action: dialogueAction,
          ambient_sound: ambientSound
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (promptError) {
        console.error("Prompt generation error:", promptError);
        throw new Error(promptError.message || "Failed to generate prompt");
      }

      if (!promptData?.generated_prompt) {
        console.error("No prompt returned:", promptData);
        throw new Error("No prompt was generated");
      }

      console.log("Generated VEO3 prompt:", promptData.generated_prompt);

      // Step 2: Generate video with VEO3
      console.log("Step 2: Calling generate-video with VEO3 prompt");
      const { data: videoData, error: videoError } = await supabase.functions.invoke('generate-video', {
        body: {
          prompt: promptData.generated_prompt,
          imageUrl: uploadedImage
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      });

      if (videoError) {
        console.error("Video generation error:", videoError);
        if (videoError.message?.includes('Insufficient tokens')) {
          toast({
            title: language === 'sv' ? "Inte tillräckligt med tokens" : "Insufficient tokens",
            description: language === 'sv' ? "Du har inte tillräckligt med tokens. Köp fler tokens för att fortsätta." : "You don't have enough tokens. Please purchase more tokens to continue.",
            variant: "destructive",
          });
          setIsGenerating(false);
          return;
        }
        throw new Error(videoError.message || "Failed to generate video");
      }

      if (!videoData?.generation_id) {
        console.error("No generation_id:", videoData);
        throw new Error("No generation ID received");
      }

      const genId = videoData.generation_id;
      setGenerationId(genId);
      console.log('VEO3 video generation started:', genId);

      // Step 3: Poll for status
      const pollInterval = setInterval(async () => {
        console.log('Polling VEO3 video status...');
        try {
          await supabase.functions.invoke('poll-video-status');
          
          const { data: videoStatusData } = await supabase
            .from('video_generations')
            .select('*')
            .eq('generation_id', genId)
            .single();
          
          if (videoStatusData) {
            console.log('VEO3 status:', videoStatusData);
            setProgress(videoStatusData.progress || 0);
            
            if (videoStatusData.status === 'completed' && videoStatusData.video_url) {
              setVideoUrl(videoStatusData.video_url);
              setIsGenerating(false);
              clearInterval(pollInterval);
              channel.unsubscribe();
              toast({
                title: language === 'sv' ? "Video klar!" : "Video ready!",
                description: language === 'sv' ? "Din VEO3-video har genererats" : "Your VEO3 video has been generated",
              });
            } else if (videoStatusData.status === 'failed') {
              setIsGenerating(false);
              clearInterval(pollInterval);
              channel.unsubscribe();
              toast({
                title: language === 'sv' ? "Generering misslyckades" : "Generation failed",
                description: videoStatusData.error_message || (language === 'sv' ? "Något gick fel" : "Something went wrong"),
                variant: "destructive",
              });
            }
          }
        } catch (error) {
          console.error('Poll error:', error);
        }
      }, 3000);

      // Subscribe to realtime updates
      const channel = supabase
        .channel('veo3-video-updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'video_generations',
            filter: `generation_id=eq.${genId}`
          },
          (payload) => {
            console.log('VEO3 realtime update:', payload);
            const newData = payload.new as any;
            
            setProgress(newData.progress || 0);
            
            if (newData.status === 'completed' && newData.video_url) {
              setVideoUrl(newData.video_url);
              setIsGenerating(false);
              clearInterval(pollInterval);
              channel.unsubscribe();
              toast({
                title: language === 'sv' ? "Video klar!" : "Video ready!",
                description: language === 'sv' ? "Din VEO3-video har genererats" : "Your VEO3 video has been generated",
              });
            } else if (newData.status === 'failed') {
              setIsGenerating(false);
              clearInterval(pollInterval);
              channel.unsubscribe();
              toast({
                title: language === 'sv' ? "Generering misslyckades" : "Generation failed",
                description: newData.error_message || (language === 'sv' ? "Något gick fel" : "Something went wrong"),
                variant: "destructive",
              });
            }
          }
        )
        .subscribe();

    } catch (error) {
      console.error("VEO3 generation error:", error);
      toast({
        title: language === 'sv' ? "Ett fel uppstod" : "An error occurred",
        description: error instanceof Error ? error.message : (language === 'sv' ? "Kunde inte generera video" : "Could not generate video"),
        variant: "destructive"
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
      a.download = `veo3-video-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: language === 'sv' ? "Nedladdning startad" : "Download started",
        description: language === 'sv' ? "Din video laddas ner" : "Your video is downloading",
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: language === 'sv' ? "Nedladdningsfel" : "Download error",
        description: language === 'sv' ? "Kunde inte ladda ner videon" : "Could not download the video",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="relative bg-[#0f172a] p-8 md:p-12 border-2 border-amber-600 rounded-lg shadow-2xl">
      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-0.5 bg-gradient-to-r from-transparent to-amber-600"></div>
          <Film className="w-8 h-8 text-amber-500" />
          <div className="w-16 h-0.5 bg-gradient-to-l from-transparent to-amber-600"></div>
        </div>
      </div>

      <h2 className="text-3xl md:text-4xl font-bold mb-2 text-center text-amber-100">
        {language === 'sv' ? 'Skapa Videos med VEO3' : 'Create Videos with VEO3'}
      </h2>
      <p className="text-center text-amber-200/60 mb-8">
        {language === 'sv' ? 'Google Veo - Professionell Videogenerering' : 'Google Veo - Professional Video Generation'}
      </p>

      {/* Image upload */}
      <div className="mb-8">
        <Label className="text-amber-200 mb-2 block">
          {language === 'sv' ? 'Ladda upp bild' : 'Upload image'}
        </Label>
        <div className="border-2 border-dashed border-amber-600 rounded-lg p-8 hover:border-amber-500 transition-all cursor-pointer bg-black/30 hover:bg-black/50 group">
          <input
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
            id="veo3-image-upload"
          />
          <label htmlFor="veo3-image-upload" className="cursor-pointer block">
            {uploadedImage ? (
              <img src={uploadedImage} alt="Uploaded" className="w-full h-64 object-cover rounded" />
            ) : (
              <div className="text-center">
                <Upload className="w-16 h-16 mx-auto mb-4 text-amber-600 group-hover:text-amber-500 transition-colors" />
                <p className="text-amber-200 text-lg">{language === 'sv' ? 'Klicka för att ladda upp' : 'Click to upload'}</p>
              </div>
            )}
          </label>
        </div>
      </div>

      {/* Questions based on VEO3 Base-5 Prompt Architecture */}
      {uploadedImage && (
        <div className="space-y-6 mb-8">
          <div>
            <Label className="text-amber-200 mb-2 block">
              {language === 'sv' ? '1. Kameravinkel & Rörelse' : '1. Camera Angle & Movement'}
            </Label>
            <Input
              value={cameraAngle}
              onChange={(e) => setCameraAngle(e.target.value)}
              placeholder={language === 'sv' ? "T.ex: Handheld selfie-stick view, kameran pekar tillbaka mot personen" : "E.g: Handheld selfie-stick view, camera pointed back at person"}
              className="bg-black/40 border-amber-600/50 text-amber-100 placeholder-amber-400/40"
            />
          </div>

          <div>
            <Label className="text-amber-200 mb-2 block">
              {language === 'sv' ? '2. Miljö & Känsla' : '2. Setting & Mood'}
            </Label>
            <Textarea
              value={settingDescription}
              onChange={(e) => setSettingDescription(e.target.value)}
              placeholder={language === 'sv' ? "T.ex: Inomhus, mörk fängelsekorridor: flimrande lampor, rostfläckad betong, avlägsna cellrassel" : "E.g: Interior, dim prison corridor: flickering bulbs, rust-stained concrete, distant cell clanging"}
              className="bg-black/40 border-amber-600/50 text-amber-100 placeholder-amber-400/40 min-h-[80px]"
            />
          </div>

          <div>
            <Label className="text-amber-200 mb-2 block">
              {language === 'sv' ? '3. Personbeskrivning' : '3. Character Description'}
            </Label>
            <Textarea
              value={characterDescription}
              onChange={(e) => setCharacterDescription(e.target.value)}
              placeholder={language === 'sv' ? "T.ex: Extremt lång man, ansiktslös vit mask, svart kostym, röd slips" : "E.g: Extremely tall man, faceless white mask, black suit, red tie"}
              className="bg-black/40 border-amber-600/50 text-amber-100 placeholder-amber-400/40 min-h-[80px]"
            />
          </div>

          <div>
            <Label className="text-amber-200 mb-2 block">
              {language === 'sv' ? '4. Dialog & Handling' : '4. Dialogue & Action'}
            </Label>
            <Textarea
              value={dialogueAction}
              onChange={(e) => setDialogueAction(e.target.value)}
              placeholder={language === 'sv' ? 'T.ex: "hej, kolla vad jag hittade..." - personen går framåt och pekar' : 'E.g: "hey, look what I found..." - person walks forward and points'}
              className="bg-black/40 border-amber-600/50 text-amber-100 placeholder-amber-400/40 min-h-[80px]"
            />
          </div>

          <div>
            <Label className="text-amber-200 mb-2 block">
              {language === 'sv' ? '5. Ljudkontext' : '5. Ambient Sound'}
            </Label>
            <Input
              value={ambientSound}
              onChange={(e) => setAmbientSound(e.target.value)}
              placeholder={language === 'sv' ? "T.ex: Ingen musik - bara fluorescerande brumning och avlägset prassel" : "E.g: No music - just fluorescent buzz and distant chatter"}
              className="bg-black/40 border-amber-600/50 text-amber-100 placeholder-amber-400/40"
            />
          </div>
        </div>
      )}

      {/* Video result */}
      {videoUrl && (
        <div className="mb-8">
          <div className="bg-black/40 border border-amber-600/50 rounded-lg p-6 overflow-hidden">
            <video src={videoUrl} controls className="w-full rounded" />
          </div>
          <Button
            onClick={handleDownload}
            className="w-full mt-4 bg-gradient-to-r from-amber-800 to-amber-700 hover:from-amber-700 hover:to-amber-600 text-amber-50"
          >
            <Download className="w-5 h-5 mr-2" />
            {language === 'sv' ? 'Ladda ner video' : 'Download video'}
          </Button>
        </div>
      )}

      {/* Generate button */}
      {uploadedImage && (
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 disabled:from-gray-700 disabled:to-gray-600 text-amber-50 h-12"
        >
          {isGenerating ? (
            <>
              <Film className="w-5 h-5 mr-2 animate-pulse" />
              {language === 'sv' ? 'Genererar...' : 'Generating...'}
              {progress > 0 && ` (${progress}%)`}
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              {language === 'sv' ? 'Generera Video' : 'Generate Video'}
            </>
          )}
        </Button>
      )}

      <div className="flex justify-center mt-8">
        <div className="flex items-center gap-4">
          <div className="w-24 h-0.5 bg-gradient-to-r from-transparent to-amber-600"></div>
          <div className="w-2 h-2 bg-amber-600 rotate-45"></div>
          <div className="w-24 h-0.5 bg-gradient-to-l from-transparent to-amber-600"></div>
        </div>
      </div>
    </div>
  );
};
