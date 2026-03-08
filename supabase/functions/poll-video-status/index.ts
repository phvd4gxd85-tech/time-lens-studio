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
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userId = claimsData.claims.sub;

    const KYE_API_KEY = Deno.env.get('KYE_API_KEY');
    if (!KYE_API_KEY) throw new Error('KYE_API_KEY is not configured');

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Only fetch THIS user's processing videos
    const { data: processingVideos, error: fetchError } = await supabaseClient
      .from('video_generations')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['processing', 'submitted'])
      .order('created_at', { ascending: true })
      .limit(20);

    if (fetchError) {
      console.error('Failed to fetch processing videos:', fetchError);
      throw fetchError;
    }

    if (!processingVideos || processingVideos.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    for (const video of processingVideos) {
      try {
        const kieResponse = await fetch(
          `https://api.kie.ai/api/v1/runway/record-detail?taskId=${encodeURIComponent(video.generation_id)}`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${KYE_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!kieResponse.ok) {
          console.error(`KIE API error for ${video.generation_id}:`, kieResponse.status);
          continue;
        }

        const kieData = await kieResponse.json();
        if (kieData.code !== 200) {
          await supabaseClient
            .from('video_generations')
            .update({ status: 'failed', error_message: kieData.msg, updated_at: new Date().toISOString() })
            .eq('id', video.id);
          continue;
        }

        const state = kieData.data.state;
        const kieVideoUrl = kieData.data.videoInfo?.videoUrl || null;

        let status = 'processing';
        let progress = video.progress || 0;
        let videoUrl = null;

        if (state === 'success' && kieVideoUrl) {
          status = 'completed';
          progress = 100;
          videoUrl = kieVideoUrl;
        } else if (state === 'failed') {
          status = 'failed';
        } else if (state === 'submitted') {
          progress = 50;
        }

        await supabaseClient
          .from('video_generations')
          .update({ status, progress, video_url: videoUrl, updated_at: new Date().toISOString() })
          .eq('id', video.id);

      } catch (videoError) {
        console.error(`Error processing video ${video.generation_id}:`, videoError);
      }
    }

    return new Response(
      JSON.stringify({ processed: processingVideos.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error in poll-video-status:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
