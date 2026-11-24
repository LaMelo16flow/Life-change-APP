import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { isGmailConfigured, sendGmailEmail } from "../_shared/sendGmailEmail.ts";
import { cleanupGmailIfNeeded } from "../_shared/gmailCleanup.ts";

// At most once a day, after an email goes out, check how full the LC Shop
// Gmail account is and free space if it is close to 50% (see gmailCleanup.ts).
// Runs in the background so the email reply is not delayed. The last result
// is kept in admin_settings under 'gmail_cleanup'.
// deno-lint-ignore no-explicit-any
async function dailyMailboxCleanup(adminClient: any) {
  const { data } = await adminClient
    .from("admin_settings")
    .select("value")
    .eq("key", "gmail_cleanup")
    .maybeSingle();
  const last = Date.parse(data?.value?.last_check ?? "") || 0;
  if (Date.now() - last < 24 * 60 * 60 * 1000) return;

  const save = (value: Record<string, unknown>) =>
    adminClient.from("admin_settings").upsert({
      key: "gmail_cleanup",
      value: { last_check: new Date().toISOString(), ...value },
      description: "Automatic cleanup of lcshop.app@gmail.com (last check)",
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });

  await save({ status: "running" }); // claim today's check first
  try {
    const result = await cleanupGmailIfNeeded();
    console.log("Gmail cleanup:", JSON.stringify(result));
    await save({ status: "ok", ...result });
  } catch (err) {
    console.error("Gmail cleanup failed:", err);
    await save({ status: "error", error: String((err as Error)?.message || err) });
  }
}

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

    // A customer may only email themselves or the shop staff (order/payment
    // alerts). Only staff can email other customers - otherwise any member
    // could send messages to everyone from the official LC Shop address.
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("email, role, is_master")
      .eq("id", caller.id)
      .maybeSingle();
    const callerIsStaff = !!callerProfile && (callerProfile.role === "admin" || callerProfile.role === "manager" || callerProfile.is_master === true);
    if (!callerIsStaff && to.toLowerCase() !== (caller.email || "").toLowerCase()) {
      const { data: target } = await adminClient
        .from("profiles")
        .select("role, is_master")
        .eq("id", recipientProfile.id)
        .maybeSingle();
      const targetIsStaff = !!target && (target.role === "admin" || target.role === "manager" || target.is_master === true);
      const { data: contact } = await adminClient
        .from("admin_settings")
        .select("value")
        .eq("key", "admin_contact_email")
        .maybeSingle();
      const isShopAddress = (contact?.value?.email || "").toLowerCase() === to.toLowerCase();
      if (!targetIsStaff && !isShopAddress) {
        return new Response(
          JSON.stringify({ success: false, error: "Not allowed to email this recipient" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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

    // deno-lint-ignore no-explicit-any
    (globalThis as any).EdgeRuntime?.waitUntil(
      dailyMailboxCleanup(adminClient).catch((err) => console.error("Gmail cleanup check failed:", err))
    );

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
