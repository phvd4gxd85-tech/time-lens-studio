import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const KYE_API_KEY = Deno.env.get('KYE_API_KEY');
    if (!KYE_API_KEY) {
      throw new Error('KYE_API_KEY is not configured');
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    const { prompt, imageUrl } = await req.json();

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    console.log("Generating video for user:", user.id);
    console.log("Prompt:", prompt);
    console.log("Image URL:", imageUrl || "No image provided");

    // Call Kye API
    const kyeResponse = await fetch("https://api.kye.ai/v1/generation", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KYE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt,
        image_url: imageUrl,
        duration: 5, // 5 second video
      }),
    });

    if (!kyeResponse.ok) {
      const errorText = await kyeResponse.text();
      console.error("Kye API error:", kyeResponse.status, errorText);
      throw new Error(`Kye API error: ${kyeResponse.status} - ${errorText}`);
    }

    const kyeData = await kyeResponse.json();
    console.log("Video generation started:", kyeData);

    return new Response(
      JSON.stringify({
        generation_id: kyeData.id,
        status: kyeData.status,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in generate-video:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
