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

    // JWT is automatically verified by Supabase when verify_jwt = true
    // We just verify the header exists
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    console.log("Authenticated request received");

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
    const kieVideoUrl = kieData.data.videoInfo?.videoUrl || null;
    
    // Map KIE states to our states
    let status = "processing";
    let progress = 0;
    let finalVideoUrl = null;
    
    if (state === "success" && kieVideoUrl) {
      status = "completed";
      progress = 100;
      
      try {
        console.log("Downloading video from KIE:", kieVideoUrl);
        
        // Download video from KIE
        const videoResponse = await fetch(kieVideoUrl);
        if (!videoResponse.ok) {
          throw new Error(`Failed to download video: ${videoResponse.status}`);
        }
        
        const videoBlob = await videoResponse.arrayBuffer();
        console.log("Video downloaded, size:", videoBlob.byteLength);
        
        // Get user ID from token
        const token = authHeader.replace("Bearer ", "");
        const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );
        
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
        if (userError || !user) {
          throw new Error("User not authenticated");
        }
        
        // Upload to Supabase Storage
        const fileName = `${user.id}/${generation_id}-${Date.now()}.mp4`;
        const { error: uploadError } = await supabaseClient
          .storage
          .from('videos')
          .upload(fileName, videoBlob, {
            contentType: 'video/mp4',
            upsert: false
          });
        
        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          throw new Error(`Failed to upload video: ${uploadError.message}`);
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabaseClient
          .storage
          .from('videos')
          .getPublicUrl(fileName);
        
        finalVideoUrl = publicUrl;
        console.log("Video uploaded to storage:", finalVideoUrl);
        
      } catch (uploadErr) {
        console.error("Error uploading video to storage:", uploadErr);
        // Fall back to KIE URL if upload fails
        finalVideoUrl = kieVideoUrl;
      }
    } else if (state === "failed") {
      status = "failed";
    } else if (state === "submitted") {
      progress = 50;
    }

    return new Response(
      JSON.stringify({
        status: status,
        video_url: finalVideoUrl,
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
