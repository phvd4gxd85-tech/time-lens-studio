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

    // Get user ID from JWT (automatically verified by Supabase when verify_jwt = true)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Extract JWT to get user info
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error("Auth error:", userError);
      throw new Error("User not authenticated");
    }

    console.log("Authenticated user:", user.id);

    const { prompt, imageUrl } = await req.json();

    if (!prompt) {
      throw new Error("Prompt is required");
    }

    console.log("Generating video for user:", user.id);
    console.log("Prompt:", prompt);
    console.log("Image URL provided:", !!imageUrl);

    let publicImageUrl = null;
    
    // If imageUrl is base64, upload to Supabase Storage first
    if (imageUrl && imageUrl.startsWith('data:image')) {
      console.log("Converting base64 image to public URL...");
      
      try {
        // Extract base64 data
        const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
        if (!matches) {
          throw new Error("Invalid base64 image format");
        }
        
        const mimeType = matches[1];
        const base64Data = matches[2];
        const extension = mimeType.split('/')[1] || 'jpg';
        
        // Convert base64 to binary
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        // Upload to Supabase Storage
        const fileName = `${user.id}/${Date.now()}.${extension}`;
        const { error: uploadError } = await supabaseClient
          .storage
          .from('videos')
          .upload(fileName, bytes, {
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
        console.log("Image uploaded successfully to:", publicImageUrl);
      } catch (uploadErr) {
        console.error("Error uploading image:", uploadErr);
        // Continue without image instead of failing
        publicImageUrl = null;
      }
    } else if (imageUrl) {
      // It's already a URL
      publicImageUrl = imageUrl;
    }

    // Build request body according to KIE API specs
    const requestBody: any = {
      prompt: prompt,
      duration: 5,
      quality: "720p",
      waterMark: ""
    };

    // Only add imageUrl if we have a valid public URL
    if (publicImageUrl) {
      requestBody.imageUrl = publicImageUrl;
    } else {
      // When no image, aspectRatio is REQUIRED
      requestBody.aspectRatio = "16:9";
    }

    console.log("Calling KIE API with:", JSON.stringify(requestBody, null, 2));

    // Call KIE Runway API
    const kieResponse = await fetch("https://api.kie.ai/api/v1/runway/generate", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KYE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await kieResponse.text();
    console.log("KIE API response status:", kieResponse.status);
    console.log("KIE API response:", responseText);

    if (!kieResponse.ok) {
      console.error("KIE API error:", kieResponse.status, responseText);
      throw new Error(`KIE API error: ${kieResponse.status} - ${responseText}`);
    }

    const kieData = JSON.parse(responseText);

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