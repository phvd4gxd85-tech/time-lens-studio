import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const { requestId } = await req.json();

    if (!requestId || typeof requestId !== 'string') {
      throw new Error("Valid request ID is required");
    }

    // Check xAI video status
    const response = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
      headers: {
        "Authorization": `Bearer ${XAI_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("xAI poll error:", response.status, errorText);
      throw new Error(`Failed to check video status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Trial video status:", data.state || data.status);

    if (data.state === 'done' || data.status === 'completed') {
      const videoUrl = data.video_url || data.result_url || data.output?.video_url;
      return new Response(
        JSON.stringify({ status: 'completed', videoUrl }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (data.state === 'failed' || data.status === 'failed') {
      return new Response(
        JSON.stringify({ status: 'failed', error: data.error || 'Video generation failed' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    return new Response(
      JSON.stringify({ status: 'processing' }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in poll-trial-video:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
