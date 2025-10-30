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
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { session_id } = await req.json();
    
    if (!session_id) {
      throw new Error("Session ID is required");
    }

    console.log("Verifying payment for session:", session_id);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    if (session.payment_status !== "paid") {
      throw new Error("Payment not completed");
    }

    console.log("Payment confirmed for session:", session_id);
    console.log("Customer email:", session.customer_email || session.customer_details?.email);
    console.log("Package type:", session.metadata?.package_type);

    const email = session.customer_email || session.customer_details?.email;
    const packageType = session.metadata?.package_type;
    
    if (!email || !packageType) {
      throw new Error("Missing email or package type");
    }

    // Define package credits
    const packageCredits: Record<string, { videos: number; images: number }> = {
      starter: { videos: 50, images: 100 },
      classic: { videos: 250, images: 500 },
      premier: { videos: 1000, images: 2000 }
    };

    const credits = packageCredits[packageType];
    if (!credits) {
      throw new Error(`Unknown package type: ${packageType}`);
    }

    // Find user by email
    const { data: userData, error: userError } = await supabaseClient
      .from('user_tokens')
      .select('user_id, videos, images')
      .eq('user_id', (await supabaseClient.auth.admin.listUsers()).data.users.find(u => u.email === email)?.id)
      .single();

    // If no user found, this might be a guest purchase - we'll still record it
    let userId = null;
    const users = (await supabaseClient.auth.admin.listUsers()).data.users;
    const matchingUser = users.find(u => u.email === email);
    
    if (matchingUser) {
      userId = matchingUser.id;
      
      // Update user credits
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

        console.log(`Added ${credits.videos} videos and ${credits.images} images to user ${userId}`);
      }
    }

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
      // Don't fail if we can't record the purchase, credits were already added
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        credits_added: credits,
        message: userId 
          ? "Payment verified and credits added" 
          : "Payment verified but no user account found"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error verifying payment:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});