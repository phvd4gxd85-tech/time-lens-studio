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
    
    if (!session_id || typeof session_id !== 'string') {
      throw new Error("Valid session ID is required");
    }

    console.log("Verifying payment for session:", session_id);

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
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
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
    console.log("Customer email:", session.customer_email || session.customer_details?.email);
    console.log("Package type:", session.metadata?.package_type);

    const email = session.customer_email || session.customer_details?.email;
    const packageType = session.metadata?.package_type;
    
    if (!email || !packageType) {
      throw new Error("Missing email or package type");
    }

    // Define package credits based on actual pricing
    const packageCredits: Record<string, { videos: number; images: number }> = {
      klassisk: { videos: 3, images: 8 },      // $5
      standard: { videos: 8, images: 20 },     // $12
      premium: { videos: 15, images: 40 }      // $22
    };

    const credits = packageCredits[packageType];
    if (!credits) {
      throw new Error(`Unknown package type: ${packageType}`);
    }

    // Find or create user by email
    let userId = null;
    const users = (await supabaseClient.auth.admin.listUsers()).data.users;
    const matchingUser = users.find(u => u.email === email);
    
    if (matchingUser) {
      // Existing user
      userId = matchingUser.id;
      console.log("Found existing user:", userId);
    } else {
      // Create new user automatically after payment
      console.log("Creating new user account for:", email);
      
      const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
        email: email,
        email_confirm: true,
        user_metadata: { 
          created_via: 'payment',
          package_type: packageType 
        }
      });

      if (createError || !newUser.user) {
        console.error("Error creating user:", createError);
        throw new Error("Failed to create user account");
      }

      userId = newUser.user.id;
      console.log("New user created:", userId);

      // Send password reset email so user can set their password
      const { error: resetError } = await supabaseClient.auth.admin.generateLink({
        type: 'recovery',
        email: email
      });

      if (resetError) {
        console.error("Error sending password reset:", resetError);
        // Don't fail if reset email fails, user can request it later
      }
    }

    // Update or create user credits
    const { data: currentCredits } = await supabaseClient
      .from('user_tokens')
      .select('videos, images')
      .eq('user_id', userId)
      .single();

    if (currentCredits) {
      // User already has credits, add more
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
    } else {
      // New user, credits will be set by trigger (handle_new_user) then we update
      // Wait a moment for trigger to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const { error: updateError } = await supabaseClient
        .from('user_tokens')
        .update({
          videos: credits.videos,
          images: credits.images
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error("Error setting initial credits:", updateError);
        throw new Error("Failed to set credits");
      }

      console.log(`Set initial ${credits.videos} videos and ${credits.images} images for new user ${userId}`);
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
        user_created: !matchingUser,
        message: matchingUser 
          ? "Payment verified and credits added" 
          : "Payment verified, account created, and credits added. Check your email to set your password."
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