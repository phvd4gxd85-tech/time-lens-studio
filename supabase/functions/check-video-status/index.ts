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

    // Check status with KIE Runway API
    const kieResponse = await fetch(`https://api.kie.ai/api/v1/runway/record-detail?taskId=${generation_id}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${KYE_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!kieResponse.ok) {
      const errorText = await kieResponse.text();
      console.error("KIE API error:", kieResponse.status, errorText);
      throw new Error(`KIE API error: ${kieResponse.status}`);
    }

    const kieData = await kieResponse.json();
    console.log("Video status response:", kieData);

    if (kieData.code !== 200) {
      throw new Error(`KIE API error: ${kieData.msg}`);
    }

    const state = kieData.data.state;
    const videoUrl = kieData.data.videoInfo?.videoUrl || null;
    
    // Map KIE states to our states
    let status = "processing";
    let progress = 0;
    
    if (state === "success") {
      status = "completed";
      progress = 100;
    } else if (state === "failed") {
      status = "failed";
    } else if (state === "submitted") {
      progress = 50;
    }

    return new Response(
      JSON.stringify({
        status: status,
        video_url: videoUrl,
        progress: progress,
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
