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

    const { generation_id } = await req.json();

    if (!generation_id) {
      throw new Error("Generation ID is required");
    }

    console.log("Checking video status for generation:", generation_id);

    // Check status with Kye API
    const kyeResponse = await fetch(`https://api.kye.ai/v1/generation/${generation_id}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${KYE_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!kyeResponse.ok) {
      const errorText = await kyeResponse.text();
      console.error("Kye API error:", kyeResponse.status, errorText);
      throw new Error(`Kye API error: ${kyeResponse.status}`);
    }

    const kyeData = await kyeResponse.json();
    console.log("Video status:", kyeData.status);

    return new Response(
      JSON.stringify({
        status: kyeData.status,
        video_url: kyeData.video_url || null,
        progress: kyeData.progress || 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in check-video-status:", error);
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
