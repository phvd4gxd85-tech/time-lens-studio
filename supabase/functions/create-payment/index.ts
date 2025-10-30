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
    
    // Validate inputs
    if (!priceId || typeof priceId !== 'string') {
      throw new Error("Valid price ID is required");
    }
    
    if (!packageType || typeof packageType !== 'string') {
      throw new Error("Valid package type is required");
    }

    // Validate allowed price IDs
    const ALLOWED_PRICES: Record<string, string> = {
      'price_1SKbRvQt7FLZjS8hiRIqK4RZ': 'starter',
      'price_1SKbZhQt7FLZjS8hcsyNqiGM': 'classic',
      'price_1SKbTIQt7FLZjS8hIee7YD54': 'premier'
    };

    if (!ALLOWED_PRICES[priceId]) {
      throw new Error("Invalid price ID");
    }

    if (ALLOWED_PRICES[priceId] !== packageType) {
      throw new Error("Price ID does not match package type");
    }

    console.log("Creating payment session for price:", priceId, "package:", packageType);

    // Get user if authenticated (optional for guest checkout)
    let userEmail = null;
    let customerId = null;
    
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data } = await supabaseClient.auth.getUser(token);
      if (data.user?.email) {
        userEmail = data.user.email;
        console.log("User authenticated:", userEmail);
      }
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check for existing customer if we have an email
    if (userEmail) {
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        console.log("Found existing customer:", customerId);
      }
    }

    const sessionParams: any = {
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.get("origin")}/`,
      metadata: {
        package_type: packageType,
      },
    };

    // Only set one of customer or customer_email
    if (customerId) {
      sessionParams.customer = customerId;
    } else if (userEmail) {
      sessionParams.customer_email = userEmail;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    console.log("Payment session created:", session.id);

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