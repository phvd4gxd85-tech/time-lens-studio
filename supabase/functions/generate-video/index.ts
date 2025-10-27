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

    const { prompt, imageUrl } = await req.json();

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    console.log("Generating video for user:", user.id);
    console.log("Prompt:", prompt);
    console.log("Image URL:", imageUrl || "No image provided");

    // If imageUrl is base64, upload to Supabase Storage first
    let publicImageUrl = imageUrl;
    
    if (imageUrl && imageUrl.startsWith('data:image')) {
      console.log("Uploading base64 image to storage...");
      
      // Extract base64 data
      const base64Data = imageUrl.split(',')[1];
      const mimeType = imageUrl.match(/data:(.*?);/)?.[1] || 'image/jpeg';
      const extension = mimeType.split('/')[1];
      
      // Convert base64 to binary
      const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      
      // Upload to Supabase Storage
      const fileName = `${user.id}/${Date.now()}.${extension}`;
      const { data: uploadData, error: uploadError } = await supabaseClient
        .storage
        .from('videos')
        .upload(fileName, binaryData, {
          contentType: mimeType,
          upsert: true
        });
      
      if (uploadError) {
        console.error("Storage upload error:", uploadError);
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabaseClient
        .storage
        .from('videos')
        .getPublicUrl(fileName);
      
      publicImageUrl = publicUrl;
      console.log("Image uploaded to:", publicImageUrl);
    }

    // Call KIE Runway API
    const kieResponse = await fetch("https://api.kie.ai/api/v1/runway/generate", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KYE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt,
        imageUrl: publicImageUrl || undefined,
        duration: 5,
        quality: "720p",
        waterMark: "",
      }),
    });

    if (!kieResponse.ok) {
      const errorText = await kieResponse.text();
      console.error("KIE API error:", kieResponse.status, errorText);
      throw new Error(`KIE API error: ${kieResponse.status} - ${errorText}`);
    }

    const kieData = await kieResponse.json();
    console.log("Video generation started:", kieData);

    if (kieData.code !== 200) {
      throw new Error(`KIE API error: ${kieData.msg}`);
    }

    return new Response(
      JSON.stringify({
        generation_id: kieData.data.taskId,
        status: "submitted",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in generate-video:", error);
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
