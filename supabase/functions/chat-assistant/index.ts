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

    const systemPrompt = `Du är en expert på AI-genererad video och bild-prompts, särskilt för VEO3 och liknande modeller.

Din huvuduppgift:
1. Hjälpa användare att förbättra sina prompts för bättre resultat
2. Ge konstruktiv feedback på deras prompts
3. Förklara hur AI-modeller tolkar prompts och använder tokens
4. Ge konkreta förslag på förbättringar

När du granskar en prompt, titta på:
- Kameravinkel och perspektiv (t.ex. "static medium shot", "tracking side-to-side")
- Ljus och miljö (t.ex. "golden hour", "soft light", "nostalgic atmosphere")
- Detaljer och specifika beskrivningar
- Rörelser och timing (t.ex. "slowly", "gentle breeze", "subtle")
- Stil och känsla (t.ex. "vintage", "worn", "patina")

Ge alltid:
- Vad som är BRA med prompten
- Vad som kan FÖRBÄTTRAS
- Ett konkret EXEMPEL på en förbättrad version

Håll svaren KORTA och PRAKTISKA. Max 3-4 meningar per punkt.
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
