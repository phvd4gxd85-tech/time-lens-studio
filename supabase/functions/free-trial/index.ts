import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const XAI_API_KEY = Deno.env.get('XAI_API_KEY');
    if (!XAI_API_KEY) throw new Error('XAI_API_KEY is not configured');

    const { prompt, clientId, imageUrl } = await req.json();

    // Validate inputs
    if (!clientId || typeof clientId !== 'string') {
      // ALWAYS return 200 so supabase SDK puts body in `data`
      return new Response(
        JSON.stringify({ success: false, error: "Client ID krävs" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "En textprompt krävs" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if this client already used their trial
    const { data: existingTrial } = await supabaseClient
      .from('free_trials')
      .select('id')
      .eq('client_id', clientId)
      .maybeSingle();

    if (existingTrial) {
      return new Response(
        JSON.stringify({ success: false, error: "Du har redan använt ditt gratisprov", trial_used: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const trimmedPrompt = prompt.trim().substring(0, 2000);

    // Build xAI video request
    const videoPayload: Record<string, unknown> = {
      model: "grok-imagine-video",
      prompt: trimmedPrompt,
      duration: 6,
    };

    // If user provided an image URL, use it as reference
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('https://')) {
      videoPayload.image = { url: imageUrl };
      console.log("Using reference image:", imageUrl.substring(0, 100));
    }

    console.log("Starting free trial video for client:", clientId);

    // Start video generation
    const response = await fetch("https://api.x.ai/v1/videos/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(videoPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("xAI video error:", response.status, errorText);
      throw new Error(`Videogenerering misslyckades (${response.status})`);
    }

    const data = await response.json();
    const videoRequestId = data.request_id || data.id;
    if (!videoRequestId) throw new Error("Inget video-ID mottaget");

    console.log("Video generation started, requestId:", videoRequestId);

    // Record the trial
    const { error: insertError } = await supabaseClient
      .from('free_trials')
      .insert({
        client_id: clientId,
        ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
        video_request_id: videoRequestId,
      });

    if (insertError) {
      console.error("Failed to record trial:", insertError);
    }

    return new Response(
      JSON.stringify({ success: true, videoRequestId, status: "processing" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error in free-trial:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Ett oväntat fel uppstod" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  }
});
