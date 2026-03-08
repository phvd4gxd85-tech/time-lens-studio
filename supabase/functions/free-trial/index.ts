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

    const { prompt, clientId, imageUrl } = await req.json();

    if (!clientId || typeof clientId !== 'string') {
      throw new Error("Client ID is required");
    }

    const hasPrompt = typeof prompt === 'string' && prompt.trim().length > 0;
    const hasImage = typeof imageUrl === 'string' && (imageUrl.startsWith('data:image') || imageUrl.startsWith('https://'));

    if (!hasPrompt) {
      throw new Error("Prompt is required");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get IP address for server-side rate limiting
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip')
      || 'unknown';

    // Check BOTH clientId AND IP address to prevent bypass
    const { data: existingByClient } = await supabaseClient
      .from('free_trials')
      .select('id')
      .eq('client_id', clientId)
      .maybeSingle();

    if (existingByClient) {
      return new Response(
        JSON.stringify({ error: "Trial already used", trial_used: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Also check by IP - max 2 trials per IP to account for shared networks
    if (ipAddress !== 'unknown') {
      const { data: trialsByIp, error: ipError } = await supabaseClient
        .from('free_trials')
        .select('id')
        .eq('ip_address', ipAddress);

      if (!ipError && trialsByIp && trialsByIp.length >= 2) {
        return new Response(
          JSON.stringify({ error: "Trial limit reached for your network", trial_used: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
        );
      }
    }

    const trimmedPrompt = hasPrompt
      ? prompt.trim().substring(0, 2000)
      : "Create subtle cinematic movement from the image";

    console.log("Free trial generation for client:", clientId, "IP:", ipAddress);

    let trialImageUrl: string | null = null;

    // If user uploaded a data image, upload it
    if (hasImage && imageUrl.startsWith('data:image')) {
      try {
        const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) throw new Error("Invalid base64 image format");

        const mimeType = matches[1];
        const base64Data = matches[2];
        const extension = mimeType.split('/')[1] || 'jpg';

        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const fileName = `trial/${clientId}/${Date.now()}.${extension}`;
        const { error: uploadError } = await supabaseClient
          .storage
          .from('videos')
          .upload(fileName, bytes, { contentType: mimeType, upsert: true });

        if (uploadError) throw new Error(`Failed to upload trial image: ${uploadError.message}`);

        const { data: { publicUrl } } = supabaseClient.storage.from('videos').getPublicUrl(fileName);
        trialImageUrl = publicUrl;
      } catch (uploadError) {
        console.error("Trial image upload error:", uploadError);
        throw new Error("Failed to process uploaded image");
      }
    } else if (hasImage && imageUrl.startsWith('https://')) {
      trialImageUrl = imageUrl;
    }

    // If no image was provided, generate one from prompt
    if (!trialImageUrl) {
      console.log("Generating trial image from prompt...");
      const imageResponse = await fetch("https://api.x.ai/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${XAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "grok-imagine-image",
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
      trialImageUrl = imageData.data?.[0]?.url ?? null;

      if (!trialImageUrl) {
        throw new Error("No image returned from AI");
      }
    }

    // Generate short video (4 seconds)
    console.log("Generating trial video (4 sec)...");
    const videoPayload: Record<string, unknown> = {
      model: "grok-imagine-video",
      prompt: trimmedPrompt,
      duration: 4,
    };

    if (trialImageUrl) {
      videoPayload.image = { url: trialImageUrl };
      console.log("Using trial reference image URL:", trialImageUrl);
    }

    const videoResponse = await fetch("https://api.x.ai/v1/videos/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(videoPayload)
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

    // Record the trial usage with IP and video request ID
    const { error: trialError } = await supabaseClient
      .from('free_trials')
      .insert({
        client_id: clientId,
        ip_address: ipAddress,
        video_request_id: videoRequestId,
      });

    if (trialError) {
      console.error("Failed to record trial:", trialError);
    }

    return new Response(
      JSON.stringify({
        imageUrl: trialImageUrl,
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
