import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildDeletionEmailHtml(
  deletedName: string,
  deletedEmail: string,
  deletedBy: string,
  isSelfDelete: boolean
) {
  const actionText = isSelfDelete
    ? `${deletedName} has voluntarily deleted their own account.`
    : `${deletedName}'s account was deleted by admin ${deletedBy}.`;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #dc2626; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="color: #ffffff; margin: 0;">Account Deleted</h2>
      </div>
      <div style="background-color: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="color: #374151; font-size: 15px; line-height: 1.6;">
          ${actionText}
        </p>
        <div style="background-color: #fef2f2; padding: 16px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <p style="margin: 0 0 8px 0; color: #991b1b;"><strong>Deleted User Details</strong></p>
          <p style="margin: 4px 0; color: #7f1d1d;">Name: ${deletedName}</p>
          <p style="margin: 4px 0; color: #7f1d1d;">Email: ${deletedEmail}</p>
          <p style="margin: 4px 0; color: #7f1d1d;">Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
        </div>
        <p style="color: #6b7280; font-size: 13px;">
          This is an automated notification from the LifeChangers platform.
        </p>
      </div>
    </div>
  `;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Missing authorization header" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = authHeader.replace("Bearer ", "");

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user: caller },
      error: authError,
    } = await adminClient.auth.getUser(token);

    if (authError || !caller) {
      return jsonResponse({ error: "Invalid or expired token" }, 401);
    }

    let targetUserId: string | undefined;
    try {
      const body = await req.json();
      targetUserId = body.targetUserId;
    } catch {
      targetUserId = undefined;
    }

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role, is_master, full_name, email")
      .eq("id", caller.id)
      .maybeSingle();

    const isAdmin =
      callerProfile?.role === "admin" || callerProfile?.is_master === true;
    const isSelfDelete = !targetUserId || targetUserId === caller.id;
    const userIdToDelete = isSelfDelete ? caller.id : targetUserId;

    if (!isSelfDelete && !isAdmin) {
      return jsonResponse(
        { error: "Only admins can delete other accounts" },
        403
      );
    }

    let deletedUserName = callerProfile?.full_name || "Unknown";
    let deletedUserEmail = callerProfile?.email || caller.email || "Unknown";

    if (!isSelfDelete) {
      const { data: targetProfile } = await adminClient
        .from("profiles")
        .select("role, is_master, full_name, email")
        .eq("id", userIdToDelete)
        .maybeSingle();

      if (!targetProfile) {
        return jsonResponse({ error: "User not found" }, 404);
      }

      if (targetProfile.is_master) {
        return jsonResponse(
          { error: "Cannot delete a master account" },
          403
        );
      }

      deletedUserName = targetProfile.full_name || "Unknown";
      deletedUserEmail = targetProfile.email || "Unknown";
    }

    const { data: recipients } = await adminClient
      .from("profiles")
      .select("id, email, role, is_master")
      .or("role.eq.manager,is_master.eq.true")
      .neq("id", userIdToDelete);

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(
      userIdToDelete
    );

    if (deleteError) {
      return jsonResponse({ error: deleteError.message }, 500);
    }

    const callerName = callerProfile?.full_name || "Unknown admin";
    const notificationTitle = "Account Deleted";
    const notificationMessage = isSelfDelete
      ? `${deletedUserName} (${deletedUserEmail}) has deleted their own account.`
      : `${deletedUserName} (${deletedUserEmail}) was deleted by ${callerName}.`;

    if (recipients && recipients.length > 0) {
      const inAppNotifications = recipients.map((r) => ({
        user_id: r.id,
        type: "account_deleted",
        title: notificationTitle,
        message: notificationMessage,
        action_url: "/admin/users",
      }));

      await adminClient.from("notifications").insert(inAppNotifications);

      const emailHtml = buildDeletionEmailHtml(
        deletedUserName,
        deletedUserEmail,
        callerName,
        isSelfDelete
      );

      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

      if (RESEND_API_KEY) {
        const emailPromises = recipients
          .filter((r) => r.email)
          .map((r) =>
            fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "LifeChangers <notifications@lifechangers.com>",
                to: [r.email],
                subject: `Account Deleted: ${deletedUserName}`,
                html: emailHtml,
              }),
            }).catch((err) =>
              console.error(`Failed to email ${r.email}:`, err)
            )
          );

        EdgeRuntime.waitUntil(Promise.allSettled(emailPromises));
      }
    }

    return jsonResponse({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (err) {
    console.error("Delete account error:", err);
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
