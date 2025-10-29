import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const { generation_id } = await req.json();
    if (!generation_id) throw new Error("Generation ID is required");

    // Poll Kie for video status
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
      finalVideoUrl = kieVideoUrl; // Directly use Kie URL
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
