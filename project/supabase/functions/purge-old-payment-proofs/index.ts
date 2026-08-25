import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEFAULT_RETENTION_DAYS = 30;
const TERMINAL_STATUSES = ["completed", "rejected", "cancelled"];

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // This has no logged-in user - it's meant to be called by a scheduled job
  // (GitHub Actions cron), so it authenticates by requiring the caller to
  // present the service role key itself as proof, rather than a user JWT.
  const authHeader = req.headers.get("Authorization") || "";
  const presentedToken = authHeader.replace("Bearer ", "");
  if (presentedToken !== serviceRoleKey) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let retentionDays = DEFAULT_RETENTION_DAYS;
  try {
    const body = await req.json();
    if (typeof body?.retention_days === "number" && body.retention_days > 0) {
      retentionDays = body.retention_days;
    }
  } catch {
    // no body / not JSON - use the default
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: candidates, error: queryError } = await adminClient
    .from("orders")
    .select("id, order_number, payment_screenshot_url, payment_submitted_at")
    .not("payment_screenshot_url", "is", null)
    .in("status", TERMINAL_STATUSES)
    .lt("updated_at", cutoff);

  if (queryError) {
    console.error("Error querying orders for proof purge:", queryError);
    return jsonResponse({ error: queryError.message }, 500);
  }

  let purged = 0;
  const errors: string[] = [];

  for (const order of candidates || []) {
    const path = order.payment_screenshot_url as string;

    const { error: removeError } = await adminClient.storage
      .from("payment-proofs")
      .remove([path]);

    if (removeError) {
      errors.push(`${order.order_number}: ${removeError.message}`);
      continue;
    }

    const { error: logError } = await adminClient.from("payment_proof_logs").insert({
      order_id: order.id,
      order_number: order.order_number,
      original_path: path,
      submitted_at: order.payment_submitted_at,
    });

    if (logError) {
      errors.push(`${order.order_number}: logged deletion failed - ${logError.message}`);
    }

    const { error: updateError } = await adminClient
      .from("orders")
      .update({ payment_screenshot_url: null, payment_proof_purged: true })
      .eq("id", order.id);

    if (updateError) {
      errors.push(`${order.order_number}: order update failed - ${updateError.message}`);
      continue;
    }

    purged += 1;
  }

  return jsonResponse({
    success: true,
    retention_days: retentionDays,
    candidates: candidates?.length || 0,
    purged,
    errors,
  });
});
