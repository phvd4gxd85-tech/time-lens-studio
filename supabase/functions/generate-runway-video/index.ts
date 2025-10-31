import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RUNWAY_API_KEY = Deno.env.get("RUNWAY_API_KEY");
    if (!RUNWAY_API_KEY) {
      throw new Error("RUNWAY_API_KEY is not configured");
    }

    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!authHeader || !supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing authentication or Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { image_asset_id, text_prompt, aspect_ratio, imageUrl } = await req.json();

    console.log("Runway video generation request:", { 
      image_asset_id, 
      text_prompt, 
      aspect_ratio,
      hasImageUrl: !!imageUrl 
    });

    let finalAssetId = image_asset_id;

    // If imageUrl is provided (base64), upload to Runway first
    if (imageUrl && imageUrl.startsWith('data:image')) {
      console.log("Uploading base64 image to Runway...");
      
      const base64Data = imageUrl.split(',')[1];
      const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

      const uploadResponse = await fetch("https://api.dev.runwayml.com/v1/assets", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RUNWAY_API_KEY}`,
          "Content-Type": "image/png",
        },
        body: imageBuffer,
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error("Runway upload error:", uploadResponse.status, errorText);
        throw new Error(`Image upload failed: ${uploadResponse.status}`);
      }

      const uploadData = await uploadResponse.json();
      finalAssetId = uploadData.id;
      console.log("Image uploaded to Runway, assetId:", finalAssetId);
    }

    // Generate video
    const runwayResponse = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RUNWAY_API_KEY}`,
        "Content-Type": "application/json",
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify({
        model: "gen3a_turbo",
        promptImage: finalAssetId,
        promptText: text_prompt,
        duration: 5,
        ratio: aspect_ratio || "16:9",
        watermark: false,
      }),
    });

    if (!runwayResponse.ok) {
      const errorText = await runwayResponse.text();
      console.error("Runway generation error:", runwayResponse.status, errorText);
      throw new Error(`Video generation failed: ${runwayResponse.status}`);
    }

    const runwayData = await runwayResponse.json();
    console.log("Runway response:", runwayData);

    return new Response(
      JSON.stringify({ 
        task_id: runwayData.id,
        status: runwayData.status 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
