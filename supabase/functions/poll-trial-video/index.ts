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
    if (!XAI_API_KEY) throw new Error('XAI_API_KEY is not configured');

    const { requestId, clientId } = await req.json();

    if (!requestId || typeof requestId !== 'string') {
      throw new Error("Valid request ID is required");
    }
    if (!clientId || typeof clientId !== 'string') {
      throw new Error("Client ID is required");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: trial, error: trialError } = await supabaseClient
      .from('free_trials')
      .select('id')
      .eq('client_id', clientId)
      .eq('video_request_id', requestId)
      .maybeSingle();

    if (trialError || !trial) {
      return new Response(
        JSON.stringify({ error: "Invalid or unauthorized request" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 }
      );
    }

    // Poll xAI — use same format as poll-video-status (data.status + data.video.url)
    const response = await fetch(`https://api.x.ai/v1/videos/${encodeURIComponent(requestId)}`, {
      headers: { "Authorization": `Bearer ${XAI_API_KEY}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("xAI poll error:", response.status, errorText);
      throw new Error(`Failed to check video status: ${response.status}`);
    }

    const data = await response.json();
    const state = data.status;
    console.log("Trial poll - state:", state, "full:", JSON.stringify(data).substring(0, 300));

    if (state === 'done' && data.video?.url) {
      return new Response(
        JSON.stringify({ status: 'completed', videoUrl: data.video.url }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    if (state === 'failed') {
      return new Response(
        JSON.stringify({ status: 'failed', error: data.error || 'Videogenerering misslyckades' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Still processing
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
