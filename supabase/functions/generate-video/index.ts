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
    if (!XAI_API_KEY) {
      throw new Error('XAI_API_KEY is not configured');
    }

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
    console.log("Authenticated user:", userId);

    // Use service role for DB operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check user has credits
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('user_tokens')
      .select('videos')
      .eq('user_id', userId)
      .single();

    if (tokenError || !tokenData) {
      throw new Error("Could not fetch user video credits");
    }

    if (tokenData.videos < 1) {
      throw new Error("Insufficient video credits. Please purchase more to continue.");
    }

    console.log(`User ${userId} has ${tokenData.videos} video credits`);

    const { prompt, imageUrl } = await req.json();

    // Validate prompt
    if (!prompt || typeof prompt !== 'string') {
      throw new Error("Valid prompt is required");
    }

    if (prompt.length < 3) {
      throw new Error("Prompt must be at least 3 characters");
    }

    const trimmedPrompt = prompt.length > 2000 ? prompt.substring(0, 2000) : prompt;

    console.log("Generating video with xAI Grok for user:", userId);

    // Build xAI request body
    const requestBody: any = {
      model: "grok-imagine-video",
      prompt: trimmedPrompt,
      duration: 10,
    };

    // If image provided, upload to storage and use as reference
    if (imageUrl && typeof imageUrl === 'string') {
      let publicImageUrl = null;

      if (imageUrl.startsWith('data:image')) {
        try {
          const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (!matches) throw new Error("Invalid base64 image format");
          
          const mimeType = matches[1];
          const base64Data = matches[2];
          const extension = mimeType.split('/')[1] || 'jpg';
          
          const binaryString = atob(base64Data);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          const fileName = `${userId}/${Date.now()}.${extension}`;
          const { error: uploadError } = await supabaseClient
            .storage.from('videos').upload(fileName, bytes, { contentType: mimeType, upsert: true });
          
          if (uploadError) throw new Error(`Failed to upload image: ${uploadError.message}`);
          
          const { data: { publicUrl } } = supabaseClient.storage.from('videos').getPublicUrl(fileName);
          publicImageUrl = publicUrl;
        } catch (uploadErr) {
          console.error("Error uploading image:", uploadErr);
        }
      } else if (imageUrl.startsWith('https://')) {
        publicImageUrl = imageUrl;
      }

      if (publicImageUrl) {
        requestBody.image = { url: publicImageUrl, type: "url" };
        console.log("Using reference image:", publicImageUrl);
      }
    }

    // Call xAI Grok video generation API
    const xaiResponse = await fetch("https://api.x.ai/v1/videos/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await xaiResponse.text();

    if (!xaiResponse.ok) {
      console.error("xAI API error:", xaiResponse.status, responseText);
      throw new Error(`xAI API error: ${xaiResponse.status} - ${responseText}`);
    }

    const xaiData = JSON.parse(responseText);
    const generationId = xaiData.request_id || xaiData.id;

    if (!generationId) {
      console.error("No request_id in xAI response:", xaiData);
      throw new Error("No generation ID received from xAI");
    }

    // Deduct credit
    const { error: updateError } = await supabaseClient
      .from('user_tokens')
      .update({ videos: tokenData.videos - 1 })
      .eq('user_id', userId);

    if (updateError) {
      console.error("Failed to deduct video credit:", updateError);
    }

    // Create tracking record
    const { error: dbError } = await supabaseClient
      .from('video_generations')
      .insert({
        user_id: userId,
        generation_id: generationId,
        prompt: trimmedPrompt,
        status: 'processing',
        progress: 0
      });

    if (dbError) console.error('Failed to create database record:', dbError);

    return new Response(
      JSON.stringify({ generation_id: generationId, status: "submitted" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in generate-video:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
