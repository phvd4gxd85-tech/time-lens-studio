import { useState } from 'react';
import { Upload, Sparkles, Download, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { downloadFileFromUrl } from '@/lib/download';

export const VEO3VideoGenerator = () => {
  const { toast } = useToast();
  const { language } = useLanguage();
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState<string>("");
  
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
    const files = e.target.files;
    if (!files) return;
    
    const remainingSlots = 3 - uploadedImages.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);
    
    filesToProcess.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImages(prev => [...prev, event.target?.result as string].slice(0, 3));
      };
      reader.readAsDataURL(file);
    });
    
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (useCustomPrompt) {
      if (!customPrompt.trim()) {
        toast({
          title: language === 'sv' ? "Prompt krävs" : "Prompt required",
          description: language === 'sv' ? "Skriv en prompt för bästa resultat" : "Write a prompt for best results",
          variant: "destructive"
        });
        return;
      }
    } else {
      if (!cameraAngle || !settingDescription || !characterDescription || !dialogueAction || !ambientSound) {
        toast({
          title: language === 'sv' ? "Alla fält krävs" : "All fields required",
          description: language === 'sv' ? "Fyll i alla fält för bästa resultat" : "Fill in all fields for best results",
          variant: "destructive"
        });
        return;
      }
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

      let finalPrompt: string;
      
      if (useCustomPrompt) {
        // Use custom prompt directly
        finalPrompt = customPrompt;
        console.log("Using custom prompt:", finalPrompt);
      } else {
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

        finalPrompt = promptData.generated_prompt;
        console.log("Generated VEO3 prompt:", finalPrompt);
      }

      // Step 2: Generate video with VEO3
      console.log("Step 2: Calling generate-video with VEO3 prompt");
      const { data: videoData, error: videoError } = await supabase.functions.invoke('generate-video', {
        body: {
          prompt: finalPrompt,
          imageUrl: uploadedImages[0] || null
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
                description: language === 'sv' ? "Din video är nu klar!" : "Your video is now ready!",
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
                description: language === 'sv' ? "Din video är nu klar!" : "Your video is now ready!",
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

    const result = await downloadFileFromUrl(videoUrl, `veo3-video-${Date.now()}.mp4`);

    toast({
      title: language === 'sv' ? 'Nedladdning startad' : 'Download started',
      description:
        result === 'downloaded'
          ? (language === 'sv' ? 'Din video laddas ner.' : 'Your video is downloading.')
          : (language === 'sv' ? 'Videon öppnades i ny flik – spara därifrån på mobilen.' : 'Video opened in a new tab — save it there on mobile.'),
    });
  };

  return (
    <div className="relative bg-gradient-to-br from-gray-900 to-red-900 p-8 md:p-12 border-2 border-amber-600 rounded-lg shadow-2xl">
      <div className="flex justify-center mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-0.5 bg-gradient-to-r from-transparent to-amber-600"></div>
          <Film className="w-8 h-8 text-amber-500" />
          <div className="w-16 h-0.5 bg-gradient-to-l from-transparent to-amber-600"></div>
        </div>
      </div>

      <h2 className="text-3xl md:text-4xl font-bold mb-2 text-center text-amber-100">
        {language === 'sv' ? 'Skapa Videos' : 'Create Videos'}
      </h2>
      <p className="text-center text-amber-200/60 mb-8">
        {language === 'sv' ? 'AI-driven Videogenerering (upp till 10 sek)' : 'AI-Powered Video Generation (up to 10 sec)'}
      </p>

      {/* Introduction - What is a prompt */}
      <div className="mb-8 bg-black/20 p-6 rounded-lg border border-amber-600/20">
        <h3 className="text-xl font-semibold text-amber-100 mb-4">
          {language === 'sv' ? 'Välkommen till Video!' : 'Welcome to Video!'}
        </h3>
        <p className="text-amber-200/80 mb-3 leading-relaxed">
          {language === 'sv' 
            ? 'När du ska göra en video är det viktigt att ge AI:n rätt instruktioner. Ju mer detaljerad du är, desto bättre blir resultatet. Dessa instruktioner kallas för prompts - det är din beskrivning av vad som ska hända i videon.' 
            : 'When creating a video, it\'s important to give the AI the right instructions. The more detailed you are, the better the result. These instructions are called prompts - it\'s your description of what should happen in the video.'}
        </p>
        <p className="text-amber-200/70 leading-relaxed">
          {language === 'sv' 
            ? 'Du har två val: antingen svarar du på de guidade frågorna som vi har lagt in för att göra det enklare för dig, eller så skriver du din egen prompt. När du känner dig mer bekväm kan du gå över till att skriva egna prompts och testa dig fram.' 
            : 'You have two choices: either answer the guided questions we\'ve included to make it easier for you, or write your own prompt. When you feel more comfortable, you can move on to writing your own prompts and experiment.'}
        </p>
      </div>

      {/* Instructions */}
      <div className="mb-8 bg-black/30 p-6 rounded-lg border border-amber-600/30">
        <h3 className="text-xl font-semibold text-amber-100 mb-3">
          {language === 'sv' ? 'Hur fungerar det?' : 'How does it work?'}
        </h3>
        <p className="text-amber-200/80 mb-2">
          {language === 'sv' 
            ? 'Du har två sätt att skapa din video:' 
            : 'You have two ways to create your video:'}
        </p>
        <ul className="text-amber-200/70 space-y-2 ml-4">
          <li>
            <strong className="text-amber-100">
              {language === 'sv' ? '1. Guidade frågor:' : '1. Guided questions:'}
            </strong>{' '}
            {language === 'sv' 
              ? 'Svara på 5 enkla frågor och AI:n skapar en professionell prompt åt dig. Perfekt om du är osäker på hur du ska formulera dig.' 
              : 'Answer 5 simple questions and the AI creates a professional prompt for you. Perfect if you\'re unsure how to phrase it.'}
          </li>
          <li>
            <strong className="text-amber-100">
              {language === 'sv' ? '2. Egen prompt:' : '2. Custom prompt:'}
            </strong>{' '}
            {language === 'sv' 
              ? 'Skriv en detaljerad beskrivning själv om du vill ha full kontroll. Inkludera kameravinkel, miljö, karaktär, handling och ljud för bästa resultat. Tips: Berätta också vad AI:n inte får göra - till exempel "förändra inte bildens bakgrund" eller "lägg inte till nya objekt".' 
              : 'Write a detailed description yourself if you want full control. Include camera angle, setting, character, action, and sound for best results. Tip: Also tell the AI what it should not do - for example "don\'t change the background" or "don\'t add new objects".'}
          </li>
        </ul>
      </div>

      {/* Image upload - up to 3 images */}
      <div className="mb-8">
        <Label className="text-amber-200 mb-2 block">
          {language === 'sv' ? 'Ladda upp bilder (max 3, valfritt)' : 'Upload images (max 3, optional)'}
        </Label>
        
        {/* Uploaded images grid */}
        {uploadedImages.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            {uploadedImages.map((img, index) => (
              <div key={index} className="relative group">
                <img src={img} alt={`Uploaded ${index + 1}`} className="w-full h-32 object-cover rounded border border-amber-600/50" />
                <button 
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {uploadedImages.length < 3 && (
          <div className="border-2 border-dashed border-amber-600 rounded-lg p-6 hover:border-amber-500 transition-all cursor-pointer bg-black/30 hover:bg-black/50 group">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
              id="veo3-image-upload"
            />
            <label htmlFor="veo3-image-upload" className="cursor-pointer block text-center">
              <Upload className="w-12 h-12 mx-auto mb-2 text-amber-600 group-hover:text-amber-500 transition-colors" />
              <p className="text-amber-200">{language === 'sv' ? `Klicka för att ladda upp (${uploadedImages.length}/3)` : `Click to upload (${uploadedImages.length}/3)`}</p>
            </label>
          </div>
        )}
      </div>

      {/* Toggle between custom prompt and questions */}
      <div className="mb-6 flex items-center justify-center gap-4 bg-black/30 p-4 rounded-lg">
          <Label className="text-amber-200">
            {language === 'sv' ? 'Använd egna frågor' : 'Use guided questions'}
          </Label>
          <Switch
            checked={useCustomPrompt}
            onCheckedChange={setUseCustomPrompt}
          />
          <Label className="text-amber-200">
            {language === 'sv' ? 'Skriv egen prompt' : 'Write custom prompt'}
          </Label>
        </div>

      {/* Custom prompt or Questions based on VEO3 Base-5 Prompt Architecture */}
      {useCustomPrompt && (
        <div className="mb-8">
          <Label className="text-amber-200 mb-2 block">
            {language === 'sv' ? 'Din egen prompt' : 'Your custom prompt'}
          </Label>
          <Textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder={language === 'sv' 
              ? "Närbild dynamisk tagning från midjan och upp, kamera lätt vinklad för att fånga rörelse, fast position.\nUtomhus, fridfull gräsplan under mulen himmel: mjukt naturligt dagsljus, avlägsna träd suddiga i bakgrunden, nostalgisk 1980-talskänsla med vintage färggradering.\nUng man ungefär 1,70 m lång — ljus hy, blont hår kammat bakåt prydligt, subtilt leende med lätt öppnade läppar, iklädd ljusblå knäppt skjorta över svart polotröja — centrerad i bilden, kroppen naturligt poserad.\nSparkar en klassisk svartvit fotboll framåt med höger fot, mitt i rörelsen när bollen lämnar tån." 
              : "Close-up dynamic shot from waist up, camera slightly angled to capture motion, fixed position.\nExterior, serene grassy field under overcast sky: soft natural daylight, distant trees blurring in the background, nostalgic 1980s vibe with vintage color grading.\nYoung man approximately 1.70 m tall — fair skin, blonde hair slicked back neatly, subtle smile with slight lip part, wearing a light blue button-up shirt over a black turtleneck — centered in frame, body posed naturally.\nKicking a classic black-and-white soccer ball forward with his right foot, mid-motion as the ball leaves his toe."}
            className="bg-black/40 border-amber-600/50 text-amber-100 placeholder-amber-400/40 min-h-[150px]"
          />
        </div>
      )}

      {!useCustomPrompt && (
        <div className="space-y-6 mb-8">
          <div>
            <Label className="text-amber-200 mb-2 block">
              {language === 'sv' ? '1. Kameravinkel' : '1. Camera Angle'}
            </Label>
            <Input
              value={cameraAngle}
              onChange={(e) => setCameraAngle(e.target.value)}
              placeholder={language === 'sv' ? "T.ex: Närbild på ansiktet, från midjan och upp, helbild" : "E.g: Close-up on face, from waist up, full body"}
              className="bg-black/40 border-amber-600/50 text-amber-100 placeholder-amber-400/40"
            />
          </div>

          <div>
            <Label className="text-amber-200 mb-2 block">
              {language === 'sv' ? '2. Var är du? Vad känns runt dig?' : '2. Where are you? What feels around you?'}
            </Label>
            <Textarea
              value={settingDescription}
              onChange={(e) => setSettingDescription(e.target.value)}
              placeholder={language === 'sv' ? "T.ex: Utomhus i en solig trädgård, blommor i bakgrunden, mjukt ljus, sommarvärme" : "E.g: Outdoors in a sunny garden, flowers in background, soft light, summer warmth"}
              className="bg-black/40 border-amber-600/50 text-amber-100 placeholder-amber-400/40 min-h-[80px]"
            />
          </div>

          <div>
            <Label className="text-amber-200 mb-2 block">
              {language === 'sv' ? '3. Hur ser du ut?' : '3. How do you look?'}
            </Label>
            <Textarea
              value={characterDescription}
              onChange={(e) => setCharacterDescription(e.target.value)}
              placeholder={language === 'sv' ? "T.ex: Kvinna i 30-årsåldern, blont hår, blå klänning, vänligt leende" : "E.g: Woman in her 30s, blonde hair, blue dress, friendly smile"}
              className="bg-black/40 border-amber-600/50 text-amber-100 placeholder-amber-400/40 min-h-[80px]"
            />
          </div>

          <div>
            <Label className="text-amber-200 mb-2 block">
              {language === 'sv' ? '4. Vad gör du?' : '4. What are you doing?'}
            </Label>
            <Textarea
              value={dialogueAction}
              onChange={(e) => setDialogueAction(e.target.value)}
              placeholder={language === 'sv' ? 'T.ex: Vinkar mot kameran, går sakta framåt, ler brett' : 'E.g: Waving at camera, walking slowly forward, smiling widely'}
              className="bg-black/40 border-amber-600/50 text-amber-100 placeholder-amber-400/40 min-h-[80px]"
            />
          </div>

          <div>
            <Label className="text-amber-200 mb-2 block">
              {language === 'sv' ? '5. Vilka ljud hörs?' : '5. What sounds are heard?'}
            </Label>
            <Textarea
              value={ambientSound}
              onChange={(e) => setAmbientSound(e.target.value)}
              placeholder={language === 'sv' ? "T.ex: Fåglar kvittrar, mjukt vindbruk, avlägset skratt" : "E.g: Birds chirping, gentle wind, distant laughter"}
              className="bg-black/40 border-amber-600/50 text-amber-100 placeholder-amber-400/40 min-h-[60px]"
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
