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
    if (!XAI_API_KEY) {
      throw new Error('XAI_API_KEY is not configured');
    }

    const { prompt, clientId } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      throw new Error("Valid prompt is required");
    }

    if (!clientId || typeof clientId !== 'string') {
      throw new Error("Client ID is required");
    }

    // Use service role for DB operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if this client has already used the trial
    const { data: existingTrial } = await supabaseClient
      .from('free_trials')
      .select('id')
      .eq('client_id', clientId)
      .single();

    if (existingTrial) {
      return new Response(
        JSON.stringify({ error: "Trial already used", trial_used: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    const trimmedPrompt = prompt.length > 2000 ? prompt.substring(0, 2000) : prompt;
    console.log("Free trial generation for client:", clientId);

    // Step 1: Generate image with xAI Grok
    console.log("Generating trial image...");
    const imageResponse = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-2-image-1212",
        prompt: trimmedPrompt,
        n: 1,
      })
    });

    if (!imageResponse.ok) {
      const errorText = await imageResponse.text();
      console.error("xAI image error:", imageResponse.status, errorText);
      throw new Error(`Image generation failed: ${imageResponse.status}`);
    }

    const imageData = await imageResponse.json();
    const imageUrl = imageData.data?.[0]?.url;

    if (!imageUrl) {
      throw new Error("No image returned from AI");
    }

    // Step 2: Generate short video (4 seconds) with xAI Grok
    console.log("Generating trial video (4 sec)...");
    const videoResponse = await fetch("https://api.x.ai/v1/videos/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-imagine-video",
        prompt: trimmedPrompt,
      })
    });

    if (!videoResponse.ok) {
      const errorText = await videoResponse.text();
      console.error("xAI video error:", videoResponse.status, errorText);
      throw new Error(`Video generation failed: ${videoResponse.status}`);
    }

    const videoData = await videoResponse.json();
    const videoRequestId = videoData.request_id || videoData.id;

    if (!videoRequestId) {
      throw new Error("No video generation ID received");
    }

    // Record the trial usage
    const { error: trialError } = await supabaseClient
      .from('free_trials')
      .insert({
        client_id: clientId,
        ip_address: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown',
      });

    if (trialError) {
      console.error("Failed to record trial:", trialError);
    }

    return new Response(
      JSON.stringify({ 
        imageUrl,
        videoRequestId,
        status: "processing"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in free-trial:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
