import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

serve(async (req) => {
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const email = "art@telia.com";
    
    console.log("Setting up special user:", email);

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
      await supabaseClient.auth.admin.generateLink({
        type: 'recovery',
        email: email
      });
    }

    // Wait for trigger
    await new Promise(resolve => setTimeout(resolve, 500));

    // Set credits
    const { error: updateError } = await supabaseClient
      .from('user_tokens')
      .update({
        videos: 20,
        images: 20
      })
      .eq('user_id', userId);

    if (updateError) {
      throw new Error("Failed to set credits: " + updateError.message);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `User ${email} set up with 20 videos and 20 images`
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
