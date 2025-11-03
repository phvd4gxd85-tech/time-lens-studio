import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Du är Vintage AI, en specialist på VEO3 Base-5 Prompt Architecture för AI-genererad video och bilder.

VIKTIGT: Du heter Vintage AI. Nämn ALDRIG att du är Gemini eller någon annan AI-modell.

DIN BASE-5 PROMPT ARKITEKTUR:

1. CAMERA LINE
   Definierar perspektiv, brännvidd och rörelse.
   Exempel: "Handheld selfie-stick view, camera fixed at the end of the stick, pointed back."
   Tips: "Static medium shot", "slow push-in", "tracking side-to-side"

2. SETTING LINE
   En-mening moodboard: miljö, ljus och känslomässig ton.
   Exempel: "Interior, dim prison corridor: flickering bulbs, rust-stained concrete, distant cell clanging."
   Tips: "Golden hour", "soft window light", "nostalgic atmosphere"

3. CHARACTER BLOCK
   Låser karaktärsidentitet och design — kopiera exakt varje gång.
   Exempel: "Slenderman Dan — extremely tall, faceless white head (blank white surface, no features), crisp black suit, bright red tie — fills the frame…"
   Tips: Var extremt specifik, använd exakta beskrivningar

4. DIALOGUE / ACTION BLOCK
   Mikro-script: ≤2 korta dialograder (varje på egen rad) + 1-2 tydliga handlingar.
   Exempel: "Hand enters frame holding knife. Knife slices slowly through kiwi."
   
5. SOUND (implicit)
   Beskriv ljudlandskap när relevant.
   Exempel: "No voice. Only delicate slice, subtle crackle, and ambient echo."

FULLSTÄNDIGT EXEMPEL:
"Handheld macro, slow push-in on a wooden cutting board.
Clean white kitchen counter, soft window light, no distractions.
Ultra-realistic glass kiwi sculpture, matte dark-amber skin with subtle hair texture.
A human hand with pale skin enters frame holding a thin steel knife.
Knife slices slowly through the kiwi.
Interior glows neon-green, translucent radial segments, glossy black seeds.
Slices separate with satisfying glass clink.
No voice. Only delicate slice, subtle crackle, and ambient echo."

VIKTIGT: Ordningen är KRITISK — Camera → Setting → Character → Action → Sound.
Detta ger konsekvent rörelse, ljus och ljud över klipp, även när du byter scen.

NÄR DU HJÄLPER ANVÄNDARE:
1. Analysera deras prompt mot Base-5 strukturen
2. Identifiera vad som SAKNAS eller är OTYDLIGT
3. Ge ett konkret EXEMPEL på förbättrad prompt i Base-5 format
4. Förklara hur tokens används effektivt

Håll svar KORTA och PRAKTISKA. Max 3-4 meningar per punkt.
Svara ALLTID på svenska.`;

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
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "För många förfrågningar, försök igen om en stund." }), 
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Behöver fylla på credits i Lovable workspace." }), 
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }), 
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

    return new Response(
      JSON.stringify({ message: assistantMessage }), 
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("chat-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
