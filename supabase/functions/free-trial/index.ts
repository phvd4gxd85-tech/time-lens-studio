import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const errorResponse = (message: string, status = 500) =>
  jsonResponse({ error: message }, status);

async function uploadDataUrlToStorage(
  supabase: ReturnType<typeof createClient>,
  dataUrl: string,
  pathPrefix: string,
  clientId: string
): Promise<string> {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) throw new Error("Ogiltigt bildformat (base64 krävs)");

  const mimeType = matches[1];
  const base64Data = matches[2];
  const extension = mimeType.split('/')[1] || 'jpg';

  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const fileName = `${pathPrefix}/${clientId}/${Date.now()}.${extension}`;
  const { error: uploadError } = await supabase
    .storage.from('videos')
    .upload(fileName, bytes, { contentType: mimeType, upsert: true });

  if (uploadError) throw new Error(`Kunde inte ladda upp bild: ${uploadError.message}`);

  const { data: { publicUrl } } = supabase.storage.from('videos').getPublicUrl(fileName);
  return publicUrl;
}

async function editImageWithAI(
  referenceImageUrl: string,
  prompt: string,
  lovableApiKey: string
): Promise<string> {
  console.log("Editing image with AI. Prompt:", prompt);

  const editResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-image',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You MUST modify this image based on the user's prompt. The result must be visibly different from the original. Do NOT return the original image unchanged. Apply all changes described in the prompt. User prompt: "${prompt}"`,
            },
            {
              type: 'image_url',
              image_url: { url: referenceImageUrl },
            },
          ],
        },
      ],
      modalities: ['image', 'text'],
    }),
  });

  if (!editResponse.ok) {
    const errorText = await editResponse.text();
    console.error('AI image edit error:', editResponse.status, errorText);
    if (editResponse.status === 429) throw new Error("För många förfrågningar, försök igen om en stund");
    if (editResponse.status === 402) throw new Error("AI-tjänsten är tillfälligt otillgänglig");
    throw new Error(`Bildredigering misslyckades (${editResponse.status})`);
  }

  const editData = await editResponse.json();
  const editedImageUrl = editData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

  if (!editedImageUrl || typeof editedImageUrl !== 'string') {
    console.error('No edited image in response:', JSON.stringify(editData).substring(0, 500));
    throw new Error('AI returnerade ingen redigerad bild');
  }

  return editedImageUrl;
}

async function generateImageFromPrompt(prompt: string, xaiApiKey: string): Promise<string> {
  console.log("Generating image from prompt...");
  const response = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${xaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "grok-imagine-image",
      prompt,
      n: 1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("xAI image error:", response.status, errorText);
    throw new Error(`Bildgenerering misslyckades (${response.status})`);
  }

  const data = await response.json();
  const imageUrl = data.data?.[0]?.url;
  if (!imageUrl) throw new Error("Ingen bild returnerades från AI");
  return imageUrl;
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeoutId: number | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function startVideoGeneration(
  prompt: string,
  imageUrl: string | null,
  xaiApiKey: string
): Promise<string> {
  console.log("Starting video generation (4 sec)...");
  const payload: Record<string, unknown> = {
    model: "grok-imagine-video",
    prompt,
    duration: 4,
  };

  if (imageUrl) {
    payload.image = { url: imageUrl };
    console.log("Using reference image for video:", imageUrl);
  }

  const response = await fetch("https://api.x.ai/v1/videos/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${xaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("xAI video error:", response.status, errorText);
    throw new Error(`Videogenerering misslyckades (${response.status})`);
  }

  const data = await response.json();
  const requestId = data.request_id || data.id;
  if (!requestId) throw new Error("Inget video-ID mottaget");
  return requestId;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const XAI_API_KEY = Deno.env.get('XAI_API_KEY');
    if (!XAI_API_KEY) throw new Error('XAI_API_KEY is not configured');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const { prompt, clientId, imageUrl } = await req.json();

    if (!clientId || typeof clientId !== 'string') {
      return errorResponse("Client ID krävs", 400);
    }

    const hasPrompt = typeof prompt === 'string' && prompt.trim().length > 0;
    const hasImage = typeof imageUrl === 'string' && (imageUrl.startsWith('data:image') || imageUrl.startsWith('https://'));

    if (!hasPrompt) {
      return errorResponse("En textprompt krävs", 400);
    }

    const trimmedPrompt = prompt.trim().substring(0, 2000);

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // --- Rate limiting: IP only (generous cap to avoid blocking legitimate retries) ---
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip')
      || 'unknown';

    if (ipAddress !== 'unknown') {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: trialsByIp } = await supabaseClient
        .from('free_trials')
        .select('id')
        .eq('ip_address', ipAddress)
        .gte('created_at', since);

      if (trialsByIp && trialsByIp.length >= 20) {
        return jsonResponse({ error: "Provgräns nådd för ditt nätverk", trial_used: true }, 403);
      }
    }

    console.log("Free trial for client:", clientId, "IP:", ipAddress, "hasImage:", hasImage);

    // --- Step 1: Resolve the output image ---
    let finalImageUrl: string | null = null;

    if (hasImage) {
      // User uploaded an image — prioritize speed to avoid frontend timeout
      let referenceUrl: string;

      if (imageUrl.startsWith('data:image')) {
        referenceUrl = await uploadDataUrlToStorage(supabaseClient, imageUrl, 'trial-input', clientId);
      } else {
        referenceUrl = imageUrl;
      }

      finalImageUrl = referenceUrl;

      // Try to AI-edit quickly, but fall back to original if it takes too long
      try {
        const editedDataUrl = await withTimeout(
          editImageWithAI(referenceUrl, trimmedPrompt, LOVABLE_API_KEY),
          6500,
          'Bildredigering timeout'
        );

        if (editedDataUrl.startsWith('data:image')) {
          finalImageUrl = await uploadDataUrlToStorage(supabaseClient, editedDataUrl, 'trial-edited', clientId);
        } else {
          finalImageUrl = editedDataUrl;
        }

        console.log("Image edited successfully. Original:", referenceUrl.substring(0, 80), "Edited:", finalImageUrl?.substring(0, 80));
      } catch (editError) {
        console.warn("Image edit skipped due to timeout/error, using original image", editError);
      }
    } else {
      // No image uploaded — generate a new one from the prompt
      finalImageUrl = await generateImageFromPrompt(trimmedPrompt, XAI_API_KEY);
    }

    if (!finalImageUrl) {
      return errorResponse("Kunde inte skapa bilden", 500);
    }

    // --- Step 2: Generate video from the (new/edited) image ---
    const videoRequestId = await startVideoGeneration(trimmedPrompt, finalImageUrl, XAI_API_KEY);

    // --- Step 3: Record trial usage ---
    const { error: trialError } = await supabaseClient
      .from('free_trials')
      .insert({
        client_id: clientId,
        ip_address: ipAddress,
        video_request_id: videoRequestId,
      });

    if (trialError) console.error("Failed to record trial:", trialError);

    return jsonResponse({
      imageUrl: finalImageUrl,
      videoRequestId,
      status: "processing",
    });
  } catch (error) {
    console.error("Error in free-trial:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Ett oväntat fel uppstod"
    );
  }
});
