import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { 
      image_decade, 
      main_subject, 
      image_description, 
      desired_movement, 
      desired_style,
      current_prompt_feedback 
    } = await req.json();

    console.log("Generating prompt with params:", { 
      image_decade, 
      main_subject, 
      image_description, 
      desired_movement, 
      desired_style,
      current_prompt_feedback 
    });

    const systemPrompt = `Du är en expert på att skapa prompts för videogenerering med RunwayML API. Din uppgift är att skapa en precis, detaljerad prompt som:

1. BEVARAR ANSIKTEN: Om det finns ansikten i bilden, måste promten ALLTID inkludera "preserve facial features exactly, maintain face identity, no face morphing" eller liknande.

2. BEVARAR STILPERIOD: Om bilden är från ett specifikt årtionde (${image_decade}), inkludera detaljer om den tidens filmkvalitet, färgpalett, kornighet, etc.

3. FOKUSERAR PÅ RÖRELSE: Baserat på önskat rörelsetyp (${desired_movement}), beskriv exakt vilka element som ska röra sig och hur.

4. MATCHAR STIL: Baserat på önskad stil (${desired_style}), justera prompten för att få rätt känsla.

5. HANTERAR FEEDBACK: Om användaren ger feedback (${current_prompt_feedback}), justera promten därefter.

Viktiga regler:
- Max 512 tecken
- Fokusera på ACTION och MOVEMENT, inte statiska beskrivningar
- Inkludera tekniska detaljer för perioden (t.ex. "grainy 1980s VHS quality" för 80-tal)
- Var specifik om vad som ska hända i videon
- ALLTID bevara ansikten om det finns människor

Svara ENDAST med den genererade promten, ingen annan text.`;

    const userPrompt = `Skapa en prompt för:
Årtionde: ${image_decade}
Huvudmotiv: ${main_subject}
Bildbeskrivning: ${image_description}
Önskad rörelse: ${desired_movement}
Önskad stil: ${desired_style}
${current_prompt_feedback ? `Använderfeedback från förra försöket: ${current_prompt_feedback}` : ''}`;

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

    const data = await response.json();
    const generated_prompt = data.choices?.[0]?.message?.content || "";

    console.log("Generated prompt:", generated_prompt);

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
