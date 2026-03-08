import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const userId = claimsData.claims.sub;

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { session_id } = await req.json();
    
    if (!session_id || typeof session_id !== 'string') {
      throw new Error("Valid session ID is required");
    }

    console.log("Verifying payment for session:", session_id, "user:", userId);

    // Check if this session has already been processed (idempotency)
    const { data: existingPurchase } = await supabaseClient
      .from('purchases')
      .select('id, stripe_session_id')
      .eq('stripe_session_id', session_id)
      .single();

    if (existingPurchase) {
      console.log("Payment already processed for session:", session_id);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Payment already processed",
          already_processed: true
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    if (session.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }

    console.log("Payment confirmed for session:", session_id);

    const email = session.customer_email || session.customer_details?.email;
    const packageType = session.metadata?.package_type;
    
    if (!email || !packageType) {
      throw new Error("Missing email or package type");
    }

    // Verify that the authenticated user's email matches the payment email
    const { data: userData } = await supabaseAuth.auth.getUser(token);
    if (userData?.user?.email?.toLowerCase() !== email.toLowerCase()) {
      console.error("Email mismatch: auth=", userData?.user?.email, "stripe=", email);
      throw new Error("Payment email does not match authenticated user");
    }

    // Define package credits
    const packageCredits: Record<string, { videos: number; images: number }> = {
      klassisk: { videos: 3, images: 8 },
      standard: { videos: 8, images: 20 },
      premium: { videos: 15, images: 40 }
    };

    const credits = packageCredits[packageType];
    if (!credits) {
      throw new Error(`Unknown package type: ${packageType}`);
    }

    // Update credits for authenticated user
    const { data: currentCredits } = await supabaseClient
      .from('user_tokens')
      .select('videos, images')
      .eq('user_id', userId)
      .single();

    if (currentCredits) {
      const { error: updateError } = await supabaseClient
        .from('user_tokens')
        .update({
          videos: currentCredits.videos + credits.videos,
          images: currentCredits.images + credits.images
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error("Error updating credits:", updateError);
        throw new Error("Failed to add credits");
      }
    } else {
      // User has no token record yet (shouldn't happen due to trigger, but handle gracefully)
      const { error: insertError } = await supabaseClient
        .from('user_tokens')
        .insert({
          user_id: userId,
          videos: credits.videos,
          images: credits.images
        });

      if (insertError) {
        console.error("Error inserting credits:", insertError);
        throw new Error("Failed to set credits");
      }
    }

    console.log(`Added ${credits.videos} videos and ${credits.images} images to user ${userId}`);

    // Record the purchase
    const { error: purchaseError } = await supabaseClient
      .from('purchases')
      .insert({
        user_id: userId,
        email: email,
        package_type: packageType,
        videos: credits.videos,
        images: credits.images,
        tokens: 0,
        amount: session.amount_total || 0,
        paid: true,
        stripe_session_id: session_id,
        stripe_payment_id: session.payment_intent as string
      });

    if (purchaseError) {
      console.error("Error recording purchase:", purchaseError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        credits_added: credits,
        message: "Payment verified and credits added"
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );

  } catch (error) {
    console.error("Error verifying payment:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
