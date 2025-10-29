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
    if (!KYE_API_KEY) throw new Error('KYE_API_KEY is not configured');

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    console.log("Authenticated request received");

    const { generation_id } = await req.json();
    if (!generation_id) throw new Error("Generation ID is required");

    console.log("Checking video status for generation:", generation_id);

    // KIE API status check
    const kieResponse = await fetch(`https://api.kie.ai/api/v1/runway/record-detail?taskId=${generation_id}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${KYE_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!kieResponse.ok) {
      const errorText = await kieResponse.text();
      throw new Error(`KIE API error: ${kieResponse.status} ${errorText}`);
    }

    const kieData = await kieResponse.json();
    if (kieData.code !== 200) throw new Error(`KIE API error: ${kieData.msg}`);

    const state = kieData.data.state;
    const kieVideoUrl = kieData.data.videoInfo?.videoUrl || null;

    let status = "processing";
    let progress = 0;
    let finalVideoUrl: string | null = null;

    if (state === "success" && kieVideoUrl) {
      status = "completed";
      progress = 100;

      try {
        console.log("Streaming video from KIE to Supabase");

        const videoResponse = await fetch(kieVideoUrl);
        if (!videoResponse.body) throw new Error("No video stream available from KIE");

        // Supabase client
        const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // Get user ID from JWT
        const token = authHeader.replace("Bearer ", "");
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
        if (userError || !user) throw new Error("User not authenticated");

        const fileName = `${user.id}/${generation_id}-${Date.now()}.mp4`;

        // Stream upload
        const { error: uploadError } = await supabaseClient
          .storage
          .from("videos")
          .upload(fileName, videoResponse.body, {
            contentType: "video/mp4",
            upsert: false
          });

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

        // Internal playback URL
        const { data: { publicUrl } } = supabaseClient
          .storage
          .from("videos")
          .getPublicUrl(fileName);

        finalVideoUrl = publicUrl;

      } catch (uploadErr) {
        console.error("Streaming/upload error:", uploadErr);
        // fallback till KIE URL om streaming failar
        finalVideoUrl = kieVideoUrl;
      }

    } else if (state === "failed") {
      status = "failed";
    } else if (state === "submitted") {
      progress = 50;
    }

    return new Response(
      JSON.stringify({
        status,
        video_url: finalVideoUrl,
        progress
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error in Edge Function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
