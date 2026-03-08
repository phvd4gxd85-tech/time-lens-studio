import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
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
    console.log("Authenticated user for image generation:", userId);

    // Use service role for DB operations
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { prompt, imageUrl } = await req.json();
    
    if (!prompt || typeof prompt !== 'string') {
      throw new Error("Valid prompt is required");
    }

    if (prompt.length < 3) {
      throw new Error("Prompt must be at least 3 characters");
    }

    if (prompt.length > 2000) {
      throw new Error("Prompt must be less than 2000 characters");
    }

    if (imageUrl && typeof imageUrl !== 'string') {
      throw new Error("Invalid image URL format");
    }

    if (imageUrl && !imageUrl.startsWith('data:image') && !imageUrl.startsWith('https://')) {
      throw new Error("Image URL must be HTTPS or base64 data");
    }

    // Check credits
    const { data: tokensData, error: tokensError } = await supabaseClient
      .from('user_tokens')
      .select('images')
      .eq('user_id', userId)
      .single();

    if (tokensError || !tokensData || tokensData.images < 1) {
      throw new Error("Insufficient images credits");
    }

    const XAI_API_KEY = Deno.env.get("XAI_API_KEY");
    if (!XAI_API_KEY) {
      throw new Error("XAI_API_KEY not configured");
    }

    // If user uploaded an image for editing, we need to handle it differently
    // xAI grok-2-image only supports text-to-image, so we append image context to prompt
    let finalPrompt = prompt;
    if (imageUrl) {
      // For image editing, enhance the prompt to describe the edit
      finalPrompt = `Based on the reference image provided, ${prompt}`;
    }

    // Call xAI Grok image generation API
    const response = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-imagine-image",
        prompt: finalPrompt,
        n: 1,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("xAI image API error:", response.status, errorText);
      throw new Error(`Image generation failed: ${response.status}`);
    }

    const data = await response.json();
    const generatedImageUrl = data.data?.[0]?.url;

    if (!generatedImageUrl) {
      console.error("No image URL in xAI response:", data);
      throw new Error("No image returned from AI");
    }

    // Deduct credit
    const { error: updateError } = await supabaseClient
      .from('user_tokens')
      .update({ images: tokensData.images - 1 })
      .eq('user_id', userId);

    if (updateError) console.error("Error updating image credits:", updateError);

    return new Response(
      JSON.stringify({ imageUrl: generatedImageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in generate-image function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
