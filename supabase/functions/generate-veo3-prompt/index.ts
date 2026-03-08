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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !data?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    console.log("Authenticated user for veo3 prompt:", data.claims.sub);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { 
      camera_angle, 
      setting_description, 
      character_description, 
      dialogue_action, 
      ambient_sound 
    } = await req.json();

    // Validate inputs
    const inputs = { camera_angle, setting_description, character_description, dialogue_action, ambient_sound };
    for (const [key, value] of Object.entries(inputs)) {
      if (value && typeof value !== 'string') {
        throw new Error(`Invalid input for ${key}`);
      }
      if (value && (value as string).length > 1000) {
        throw new Error(`${key} is too long (max 1000 chars)`);
      }
    }

    const systemPrompt = `Du är en expert på att skapa VEO3-videogenererings-prompts med "Base-5 Prompt Architecture".

Din uppgift är att kombinera användarens input till en perfekt strukturerad prompt med exakt följande format:

**VEO3 Base-5 Prompt Architecture:**

1. **Camera line** - Perspektiv, fokusavstånd och rörelse
2. **Setting line** - Miljö, ljussättning och emotionell ton (EN mening)
3. **Character block** - Exakt personbeskrivning (kopiera exakt varje gång)
4. **Dialogue/Action block** - Max 2 korta dialograder (varje på egen rad) + 1-2 tydliga handlingar
5. **Ambient-sound line** - Ljudkontext för att styra audio

**VIKTIGA REGLER:**
- Skriv promten på SVENSKA om användaren skrev på svenska, annars på engelska
- Var EXTREMT specifik om vad som ska hända i videon
- Fokusera på ACTION och MOVEMENT, inte statiska beskrivningar
- Inkludera tekniska detaljer för rätt känsla (t.ex. "kornig 1980-tals VHS-kvalitet")
- ALLTID bevara ansikten om det finns människor i beskrivningen
- Max 600 tecken total
- Använd exakt strukturen ovan

Svara ENDAST med den genererade promten i Base-5 format, ingen annan text.`;

    const userPrompt = `Skapa en VEO3 Base-5 prompt från:

1. Kameravinkel: ${camera_angle || 'ej angiven'}
2. Miljö & känsla: ${setting_description || 'ej angiven'}
3. Personbeskrivning: ${character_description || 'ej angiven'}
4. Dialog & handling: ${dialogue_action || 'ej angiven'}
5. Ljudkontext: ${ambient_sound || 'ej angiven'}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      throw new Error(`AI generation failed: ${response.status}`);
    }

    const aiData = await response.json();
    const generated_prompt = aiData.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ generated_prompt }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
