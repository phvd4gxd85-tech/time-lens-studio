import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    const { prompt, imageUrl } = await req.json();
    
    if (!prompt) {
      throw new Error("Prompt is required");
    }

    console.log("Generating image for user:", user.id, "with prompt:", prompt);

    // Check if user has enough images
    const { data: tokensData, error: tokensError } = await supabaseClient
      .from('user_tokens')
      .select('images')
      .eq('user_id', user.id)
      .single();

    if (tokensError || !tokensData || tokensData.images < 1) {
      throw new Error("Insufficient images credits");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Build messages array
    const messages: any[] = [];
    
    if (imageUrl) {
      // If user uploaded an image, include it in the request
      messages.push({
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl } }
        ]
      });
    } else {
      // Text-only prompt
      messages.push({
        role: "user",
        content: prompt
      });
    }

    console.log("Calling Lovable AI for image generation...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages,
        modalities: ["image", "text"]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      throw new Error(`AI generation failed: ${response.status}`);
    }

    const data = await response.json();
    const generatedImageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImageUrl) {
      throw new Error("No image returned from AI");
    }

    console.log("Image generated successfully");

    // Deduct one image credit
    const { error: updateError } = await supabaseClient
      .from('user_tokens')
      .update({ images: tokensData.images - 1 })
      .eq('user_id', user.id);

    if (updateError) {
      console.error("Error updating image credits:", updateError);
    }

    return new Response(
      JSON.stringify({ imageUrl: generatedImageUrl }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error in generate-image function:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
