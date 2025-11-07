import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const email = "art@telia.com";
    
    console.log("Creating special user:", email);

    // Check if user already exists
    const users = (await supabaseClient.auth.admin.listUsers()).data.users;
    const existingUser = users.find(u => u.email === email);
    
    let userId = null;
    
    if (existingUser) {
      userId = existingUser.id;
      console.log("User already exists:", userId);
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
        email: email,
        email_confirm: true,
        user_metadata: { 
          created_via: 'special_admin',
          special_account: true
        }
      });

      if (createError || !newUser.user) {
        console.error("Error creating user:", createError);
        throw new Error("Failed to create user account");
      }

      userId = newUser.user.id;
      console.log("New user created:", userId);

      // Send password reset email
      const { error: resetError } = await supabaseClient.auth.admin.generateLink({
        type: 'recovery',
        email: email
      });

      if (resetError) {
        console.error("Error sending password reset:", resetError);
      }
    }

    // Wait for trigger to complete
    await new Promise(resolve => setTimeout(resolve, 500));

    // Set credits to 20 videos and 20 images
    const { error: updateError } = await supabaseClient
      .from('user_tokens')
      .update({
        videos: 20,
        images: 20
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error("Error setting credits:", updateError);
      throw new Error("Failed to set credits");
    }

    console.log(`Set 20 videos and 20 images for user ${userId}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        user_id: userId,
        email: email,
        credits: { videos: 20, images: 20 },
        message: existingUser 
          ? "User already existed, credits updated to 20 videos and 20 images" 
          : "User created with 20 videos and 20 images. Password reset email sent."
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error creating special user:", error);
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
