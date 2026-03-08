import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
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
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const { priceId, packageType } = await req.json();
    
    if (!priceId || typeof priceId !== 'string') {
      throw new Error("Valid price ID is required");
    }
    
    if (!packageType || typeof packageType !== 'string') {
      throw new Error("Valid package type is required");
    }

    const ALLOWED_PRICES: Record<string, string> = {
      'price_1T8bfLQt7FLZjS8hIlinBJRL': 'klassisk',   // $5
      'price_1T8bfpQt7FLZjS8hTuCktjZn': 'standard',   // $12
      'price_1T8bgHQt7FLZjS8huUX28eWF': 'premium'     // $22
    };

    if (!ALLOWED_PRICES[priceId]) {
      throw new Error("Invalid price ID");
    }

    if (ALLOWED_PRICES[priceId] !== packageType) {
      throw new Error("Price ID does not match package type");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Resolve user auth and build session params in parallel where possible
    let userEmail: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabaseClient.auth.getUser(token);
      if (data.user?.email) {
        userEmail = data.user.email;
      }
    }

    // Build session params - use customer_email directly to skip the slow customers.list call
    const sessionParams: any = {
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      success_url: `https://time-lens-studio.lovable.app/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://time-lens-studio.lovable.app/`,
      metadata: { package_type: packageType },
    };

    if (userEmail) {
      sessionParams.customer_email = userEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error creating payment session:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
