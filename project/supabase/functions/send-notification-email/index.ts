import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { isGmailConfigured, sendGmailEmail } from "../_shared/sendGmailEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailRequest {
  to: string;
  subject: string;
  html: string;
  type: 'order_placed' | 'order_approved' | 'payment_submitted' | 'payment_verified' | 'order_rejected' | 'account_approval_request' | 'promotion_created';
  orderData?: {
    orderNumber: string;
    productName: string;
    quantity: number;
    totalAmount: string;
    userName: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = authHeader.replace("Bearer ", "");

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !caller) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailRequest: EmailRequest = await req.json();
    const { to, subject, html, type } = emailRequest;

    if (!to || !to.includes('@')) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email skipped - no valid recipient email',
          development: true
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Only allow sending to email addresses that belong to a real registered
    // user of this app - this is what stops an authenticated caller from
    // using this function as a relay to arbitrary external addresses.
    const { data: recipientProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", to)
      .maybeSingle();

    if (!recipientProfile) {
      return new Response(
        JSON.stringify({ success: false, error: "Recipient is not a registered user of this app" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!isGmailConfigured()) {
      console.log(`Gmail credentials not configured; email skipped for ${to} (development mode)`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Email skipped - Gmail not configured',
          development: true,
          recipient: to,
          type,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    await sendGmailEmail({ to, subject, html });

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
